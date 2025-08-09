import { validationResult } from "express-validator";
import { PhotoResponseDTO } from "../dtos/index.js";
import Photo from "../models/photo.model.js";
import CloudinaryService from "../services/cloudinary.service.js";
import { createSuccessResponse, createErrorResponse, createValidationErrorResponse, detectLanguage } from "../utils/translations.js";

export class PhotoUploadController {

  // Upload media (photo/video) on cloudinary
	static async uploadPhoto(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const { caption, sharedWith, location, imageData, mediaData } = req.body;
			const mediaInput = imageData || mediaData; // Support both field names

			if (mediaInput) {
				console.log("Media data received (first 100 chars):", mediaInput.slice(0, 100));
			}

			let cloudinaryResult;
			let isVideo = false;

			// Handle different media input types
			if (req.file) {
				// File upload via multer
				isVideo = req.file.mimetype.startsWith('video/');
				const folder = isVideo ? `locket-users/${req.user._id}/videos` : `locket-users/${req.user._id}/photos`;
				const prefix = isVideo ? 'video' : 'photo';
				
				cloudinaryResult = await CloudinaryService.uploadMedia(req.file.buffer, {
					folder,
					public_id: `${prefix}_${Date.now()}_${req.user._id}`,
					resource_type: isVideo ? "video" : "auto"
				});
			} else if (mediaInput) {
				// Base64 media data from Flutter
				// Try to detect media type from base64 data first
				const isVideoData = CloudinaryService.isVideoBase64(mediaInput);
				const folder = isVideoData ? `locket-users/${req.user._id}/videos` : `locket-users/${req.user._id}/photos`;
				const prefix = isVideoData ? 'video' : 'media';
				
				cloudinaryResult = await CloudinaryService.uploadMedia(mediaInput, {
					folder,
					public_id: `${prefix}_${Date.now()}_${req.user._id}`,
					resource_type: "auto" // Let Cloudinary auto-detect
				});
				
				// Check if the uploaded file is a video based on Cloudinary result
				isVideo = cloudinaryResult.resource_type === 'video';
			} else {
				return res.status(400).json(createErrorResponse("upload.noFileProvided", null, null, detectLanguage(req)));
			}

			// Create media record in database
			const photoData = {
				userId: req.user._id,
				imageUrl: cloudinaryResult.url,
				publicId: cloudinaryResult.public_id,
				caption: caption || "",
				sharedWith: sharedWith || [],
				location: location || null,
				mediaType: isVideo ? 'video' : 'image',
				duration: isVideo ? cloudinaryResult.duration : undefined,
				format: cloudinaryResult.format,
				width: cloudinaryResult.width || undefined,
				height: cloudinaryResult.height || undefined,
				fileSize: cloudinaryResult.bytes
			};

			const photo = await Photo.create(photoData);

			// Populate user data
			const populatedPhoto = await Photo.findById(photo._id).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

			const photoResponse = PhotoResponseDTO.fromPhoto(populatedPhoto);

			const successMessage = isVideo ? "upload.videoUploaded" : "upload.fileUploaded";
			res.status(201).json(createSuccessResponse(successMessage, {
				photo: photoResponse.toJSON(),
				cloudinary: {
					publicId: cloudinaryResult.public_id,
					url: cloudinaryResult.url,
					format: cloudinaryResult.format,
					size: cloudinaryResult.bytes,
					duration: cloudinaryResult.duration,
					resourceType: cloudinaryResult.resource_type
				},
			}, detectLanguage(req)));
		} catch (error) {
			console.error("Photo upload error:", error);
			res.status(500).json(createErrorResponse("upload.uploadFailed", error.message, null, detectLanguage(req)));
		}
	}

  // Upload multiple media files (photos/videos)
	static async uploadMultiplePhotos(req, res) {
		try {
			const { photos, media } = req.body; // Support both field names
			const mediaArray = photos || media;

			if (!Array.isArray(mediaArray) || mediaArray.length === 0) {
				return res.status(400).json(createErrorResponse("upload.noFileProvided", null, null, detectLanguage(req)));
			}

			if (mediaArray.length > 10) {
				return res.status(400).json(createErrorResponse("upload.maxFilesExceeded", null, null, detectLanguage(req)));
			}

			const uploadedMedia = [];

			for (const mediaData of mediaArray) {
				const { imageData, mediaData: rawMediaData, caption, sharedWith, location } = mediaData;
				const mediaInput = imageData || rawMediaData;

				if (!mediaInput) {
					continue; // Skip media without data
				}

				try {
					// Try to detect media type from base64 data first
					const isVideoData = CloudinaryService.isVideoBase64(mediaInput);
					const folder = isVideoData ? `locket-users/${req.user._id}/videos` : `locket-users/${req.user._id}/photos`;
					const prefix = isVideoData ? 'video' : 'photo';
					
					// Upload to Cloudinary with proper folder
					const cloudinaryResult = await CloudinaryService.uploadMedia(mediaInput, {
						folder,
						public_id: `${prefix}_${Date.now()}_${req.user._id}_${Math.random().toString(36).substr(2, 9)}`,
						resource_type: "auto"
					});

					const isVideo = cloudinaryResult.resource_type === 'video';

					// Create media record
					const photo = await Photo.create({
						userId: req.user._id,
						imageUrl: cloudinaryResult.url,
						publicId: cloudinaryResult.public_id,
						caption: caption || "",
						sharedWith: sharedWith || [],
						location: location || null,
						mediaType: isVideo ? 'video' : 'image',
						duration: isVideo ? cloudinaryResult.duration : undefined,
						format: cloudinaryResult.format,
						width: cloudinaryResult.width || undefined,
						height: cloudinaryResult.height || undefined,
						fileSize: cloudinaryResult.bytes
					});

					const populatedPhoto = await Photo.findById(photo._id).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

					uploadedMedia.push({
						photo: PhotoResponseDTO.fromPhoto(populatedPhoto).toJSON(),
						cloudinary: {
							publicId: cloudinaryResult.public_id,
							url: cloudinaryResult.url,
							format: cloudinaryResult.format,
							size: cloudinaryResult.bytes,
							duration: cloudinaryResult.duration,
							resourceType: cloudinaryResult.resource_type
						},
					});
				} catch (uploadError) {
					console.error("Error uploading individual photo:", uploadError);
					// Continue with other photos even if one fails
				}
			}

			res.status(201).json(createSuccessResponse("upload.multipleFilesUploaded", {
				media: uploadedMedia,
				total: uploadedMedia.length,
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
