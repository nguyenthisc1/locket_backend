import { validationResult } from "express-validator";
import { PhotoResponseDTO } from "../dtos/index.js";
import Photo from "../models/photo.model.js";
import CloudinaryService from "../services/cloudinary.service.js";
import { createSuccessResponse, createErrorResponse, createValidationErrorResponse, detectLanguage } from "../utils/translations.js";

export class PhotoUploadController {

  // Upload photo on cloudinary
	static async uploadPhoto(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const { caption, sharedWith, location, imageData } = req.body;

			console.log(req.body.imageData.slice(0, 100));

			let cloudinaryResult;

			// Handle different image input types
			if (req.file) {
				// File upload via multer
				cloudinaryResult = await CloudinaryService.uploadImage(req.file.buffer, {
					folder: `locket-photos/${req.user._id}`,
					public_id: `photo_${Date.now()}_${req.user._id}`,
				});
			} else if (imageData) {
				// Base64 image data from Flutter
				cloudinaryResult = await CloudinaryService.uploadImage(imageData, {
					folder: `locket-photos/${req.user._id}`,
					public_id: `photo_${Date.now()}_${req.user._id}`,
				});
			} else {
				return res.status(400).json(createErrorResponse("upload.noFileProvided", null, null, detectLanguage(req)));
			}

			// Create photo record in database
			const photoData = {
				userId: req.user._id,
				imageUrl: cloudinaryResult.url,
				publicId: cloudinaryResult.public_id,
				caption: caption || "",
				sharedWith: sharedWith || [],
				location: location || null,
			};

			const photo = await Photo.create(photoData);

			// Populate user data
			const populatedPhoto = await Photo.findById(photo._id).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

			const photoResponse = PhotoResponseDTO.fromPhoto(populatedPhoto);

			res.status(201).json(createSuccessResponse("upload.fileUploaded", {
				photo: photoResponse.toJSON(),
				cloudinary: {
					publicId: cloudinaryResult.public_id,
					url: cloudinaryResult.url,
					width: cloudinaryResult.width,
					height: cloudinaryResult.height,
					format: cloudinaryResult.format,
					size: cloudinaryResult.bytes,
				},
			}, detectLanguage(req)));
		} catch (error) {
			console.error("Photo upload error:", error);
			res.status(500).json(createErrorResponse("upload.uploadFailed", error.message, null, detectLanguage(req)));
		}
	}

  // Upload multi photos 
	static async uploadMultiplePhotos(req, res) {
		try {
			const { photos } = req.body; // Array of photo objects with imageData

			if (!Array.isArray(photos) || photos.length === 0) {
				return res.status(400).json(createErrorResponse("upload.noFileProvided", null, null, detectLanguage(req)));
			}

			if (photos.length > 10) {
				return res.status(400).json(createErrorResponse("upload.maxFilesExceeded", null, null, detectLanguage(req)));
			}

			const uploadedPhotos = [];

			for (const photoData of photos) {
				const { imageData, caption, sharedWith, location } = photoData;

				if (!imageData) {
					continue; // Skip photos without image data
				}

				try {
					// Upload to Cloudinary
					const cloudinaryResult = await CloudinaryService.uploadImage(imageData, {
						folder: `locket-photos/${req.user._id}`,
						public_id: `photo_${Date.now()}_${req.user._id}_${Math.random().toString(36).substr(2, 9)}`,
					});

					// Create photo record
					const photo = await Photo.create({
						userId: req.user._id,
						imageUrl: cloudinaryResult.url,
						publicId: cloudinaryResult.public_id,
						caption: caption || "",
						sharedWith: sharedWith || [],
						location: location || null,
					});

					const populatedPhoto = await Photo.findById(photo._id).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

					uploadedPhotos.push({
						photo: PhotoResponseDTO.fromPhoto(populatedPhoto).toJSON(),
						cloudinary: {
							publicId: cloudinaryResult.public_id,
							url: cloudinaryResult.url,
							width: cloudinaryResult.width,
							height: cloudinaryResult.height,
							format: cloudinaryResult.format,
							size: cloudinaryResult.bytes,
						},
					});
				} catch (uploadError) {
					console.error("Error uploading individual photo:", uploadError);
					// Continue with other photos even if one fails
				}
			}

			res.status(201).json(createSuccessResponse("upload.multipleFilesUploaded", {
				photos: uploadedPhotos,
				total: uploadedPhotos.length,
			}, detectLanguage(req)));
		} catch (error) {
			console.error("Multiple photo upload error:", error);
			res.status(500).json(createErrorResponse("upload.uploadFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Delete photo with cloudinary
	static async deletePhotoWithCloudinary(req, res) {
		try {
			const { photoId } = req.params;

			const photo = await Photo.findById(photoId);
			if (!photo) {
				return res.status(404).json(createErrorResponse("photo.photoNotFound", null, null, detectLanguage(req)));
			}

			if (!photo.userId.equals(req.user._id)) {
				return res.status(403).json(createErrorResponse("photo.unauthorizedPhotoAccess", null, null, detectLanguage(req)));
			}

			// Delete from Cloudinary
			if (photo.publicId) {
				await CloudinaryService.deleteImage(photo.publicId);
			}

			// Delete from database
			await Photo.findByIdAndDelete(photoId);

			res.json(createSuccessResponse("photo.photoDeleted", null, detectLanguage(req)));
		} catch (error) {
			console.error("Delete photo with cloudinary error:", error);
			res.status(500).json(createErrorResponse("photo.photoDeleteFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Get image URLs
	static async getImageUrls(req, res) {
		try {
			const { photoIds } = req.body;

			if (!Array.isArray(photoIds)) {
				return res.status(400).json(createErrorResponse("validation.invalidArray", null, null, detectLanguage(req)));
			}

			const photos = await Photo.find({
				_id: { $in: photoIds },
				$or: [
					{ userId: req.user._id },
					{ sharedWith: req.user._id }
				]
			}).select('imageUrl publicId');

			const imageUrls = photos.map(photo => ({
				id: photo._id,
				url: photo.imageUrl,
				publicId: photo.publicId
			}));

			res.json(createSuccessResponse("photo.photosRetrieved", { imageUrls }, detectLanguage(req)));
		} catch (error) {
			console.error("Get image URLs error:", error);
			res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
		}
	}
}
