import { validationResult } from "express-validator";
import { FeedResponseDTO } from "../dtos/index.js";
import Feed from "../models/feed.model.js";
import CloudinaryService from "../services/cloudinary.service.js";
import { createSuccessResponse, createErrorResponse, createValidationErrorResponse, detectLanguage } from "../utils/translations.js";

export class UploadController {

  // Upload media (photo/video) to Cloudinary only
	static async uploadMedia(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			console.log("🚀 ~ UploadController ~ uploadMedia ~ req.body:", req.body);
			console.log("🚀 ~ UploadController ~ uploadMedia ~ req.file:", req.file);

			let cloudinaryResult;
			let isVideo = false;

			// Handle file upload via multer
			if (req.file) {
				// Detect media type from file
				isVideo = req.file.mimetype.startsWith('video/');
				
				// Add additional logging to debug video detection
				console.log('🔍 Video Detection Debug:');
				console.log('- File mimetype:', req.file.mimetype);
				console.log('- Detected as video:', isVideo);
				console.log('- Buffer length:', req.file.buffer?.length);
				
				// Double-check with buffer analysis if mimetype detection fails
				if (!isVideo && req.file.buffer) {
					const bufferIsVideo = CloudinaryService.isVideoBuffer(req.file.buffer);
					console.log('- Buffer analysis says video:', bufferIsVideo);
					if (bufferIsVideo) {
						isVideo = true;
						console.log('- Overriding mimetype detection with buffer analysis');
					}
				}
				
				const folder = isVideo ? `locket-users/${req.user._id}/videos` : `locket-users/${req.user._id}/photos`;
				const prefix = isVideo ? 'video' : 'photo';
				
				console.log(`📁 Uploading ${isVideo ? 'video' : 'image'} to folder: ${folder}`);
				console.log(`🏷️  Using prefix: ${prefix}`);
				
				cloudinaryResult = await CloudinaryService.uploadMedia(req.file.buffer, {
					folder,
					public_id: `${prefix}_${Date.now()}_${req.user._id}`,
					resource_type: isVideo ? "video" : "auto"
				});
			} else {
				return res.status(400).json(createErrorResponse("upload.noFileProvided", null, null, detectLanguage(req)));
			}

			// Log upload result
			console.log("Upload completed:");
			console.log("- Cloudinary URL:", cloudinaryResult.url);
			console.log("- Detected as:", isVideo ? 'video' : 'image');
			console.log("- Resource type:", cloudinaryResult.resource_type);
			console.log("- Duration:", cloudinaryResult.duration);

			// Automatically create feed after successful upload
			const feedData = {
				url: cloudinaryResult.url,
				publicId: cloudinaryResult.public_id,
				mediaType: isVideo ? 'video' : 'image',
				caption: req.body.caption || "",
				isFrontCamera: req.body.isFrontCamera ?? true,
				sharedWith: req.body.sharedWith || [],
				location: req.body.location || null,
				duration: cloudinaryResult.duration,
				format: cloudinaryResult.format,
				width: cloudinaryResult.width,
				height: cloudinaryResult.height,
				fileSize: cloudinaryResult.bytes
			};

			// Create feed entry in database
			const feed = await Feed.create({
				userId: req.user._id,
				imageUrl: feedData.url,
				publicId: feedData.publicId,
				caption: feedData.caption,
				isFrontCamera: feedData.isFrontCamera,
				sharedWith: feedData.sharedWith,
				location: feedData.location,
				mediaType: feedData.mediaType,
				duration: feedData.mediaType === 'video' ? feedData.duration : undefined,
				format: feedData.format,
				width: feedData.width,
				height: feedData.height,
				fileSize: feedData.fileSize
			});

			// Populate user data
			const populatedFeed = await Feed.findById(feed._id)
				.populate("userId", "username avatarUrl")
				.populate("sharedWith", "username avatarUrl");

			const feedResponse = FeedResponseDTO.fromFeed(populatedFeed);

			// Return both upload success and created feed
			const successMessage = isVideo ? "upload.videoUploaded" : "upload.fileUploaded";
			res.status(201).json(createSuccessResponse(successMessage, {
				upload: {
					url: cloudinaryResult.url,
					publicId: cloudinaryResult.public_id,
					mediaType: isVideo ? 'video' : 'image',
					format: cloudinaryResult.format,
					width: cloudinaryResult.width,
					height: cloudinaryResult.height,
					duration: cloudinaryResult.duration,
					fileSize: cloudinaryResult.bytes,
					resourceType: cloudinaryResult.resource_type
				},
				feed: feedResponse.toJSON()
			}, detectLanguage(req)));
		} catch (error) {
			console.error("Media upload error:", error);
			res.status(500).json(createErrorResponse("upload.uploadFailed", error.message, null, detectLanguage(req)));
		}
	}

  // Upload multiple media files (photos/videos)
	// static async uploadMultiplePhotos(req, res) {
	// 	try {
	// 		const { photos, media } = req.body; // Support both field names
	// 		const mediaArray = photos || media;

	// 		if (!Array.isArray(mediaArray) || mediaArray.length === 0) {
	// 			return res.status(400).json(createErrorResponse("upload.noFileProvided", null, null, detectLanguage(req)));
	// 		}

	// 		if (mediaArray.length > 10) {
	// 			return res.status(400).json(createErrorResponse("upload.maxFilesExceeded", null, null, detectLanguage(req)));
	// 		}

	// 		const uploadedMedia = [];

	// 		for (const mediaData of mediaArray) {
	// 			const { imageData, mediaData: rawMediaData, caption, sharedWith, location } = mediaData;
	// 			const mediaInput = imageData || rawMediaData;

	// 			if (!mediaInput) {
	// 				continue; // Skip media without data
	// 			}

	// 			try {
	// 				// Try to detect media type from base64 data first
	// 				const isVideoData = CloudinaryService.isVideoBase64(mediaInput);
	// 				const folder = isVideoData ? `locket-users/${req.user._id}/videos` : `locket-users/${req.user._id}/photos`;
	// 				const prefix = isVideoData ? 'video' : 'photo';
					
	// 				// Upload to Cloudinary with proper folder
	// 				const cloudinaryResult = await CloudinaryService.uploadMedia(mediaInput, {
	// 					folder,
	// 					public_id: `${prefix}_${Date.now()}_${req.user._id}_${Math.random().toString(36).substr(2, 9)}`,
	// 					resource_type: "auto"
	// 				});

	// 				const isVideo = cloudinaryResult.resource_type === 'video';

	// 				// Create media record
	// 				const photo = await Feed.create({
	// 					userId: req.user._id,
	// 					imageUrl: cloudinaryResult.url,
	// 					publicId: cloudinaryResult.public_id,
	// 					caption: caption || "",
	// 					sharedWith: sharedWith || [],
	// 					location: location || null,
	// 					mediaType: isVideo ? 'video' : 'image',
	// 					duration: isVideo ? cloudinaryResult.duration : undefined,
	// 					format: cloudinaryResult.format,
	// 					width: cloudinaryResult.width || undefined,
	// 					height: cloudinaryResult.height || undefined,
	// 					fileSize: cloudinaryResult.bytes
	// 				});

	// 				const populatedPhoto = await Feed.findById(photo._id).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

	// 				uploadedMedia.push({
	// 					photo: PhotoResponseDTO.fromPhoto(populatedPhoto).toJSON(),
	// 					cloudinary: {
	// 						publicId: cloudinaryResult.public_id,
	// 						url: cloudinaryResult.url,
	// 						format: cloudinaryResult.format,
	// 						size: cloudinaryResult.bytes,
	// 						duration: cloudinaryResult.duration,
	// 						resourceType: cloudinaryResult.resource_type
	// 					},
	// 				});
	// 			} catch (uploadError) {
	// 				console.error("Error uploading individual photo:", uploadError);
	// 				// Continue with other photos even if one fails
	// 			}
	// 		}

	// 		res.status(201).json(createSuccessResponse("upload.multipleFilesUploaded", {
	// 			media: uploadedMedia,
	// 			total: uploadedMedia.length,
	// 		}, detectLanguage(req)));
	// 	} catch (error) {
	// 		console.error("Multiple photo upload error:", error);
	// 		res.status(500).json(createErrorResponse("upload.uploadFailed", error.message, null, detectLanguage(req)));
	// 	}
	// }

	// // Delete photo with cloudinary
	// static async deletePhotoWithCloudinary(req, res) {
	// 	try {
	// 		const { photoId } = req.params;

	// 		const photo = await Photo.findById(photoId);
	// 		if (!photo) {
	// 			return res.status(404).json(createErrorResponse("photo.photoNotFound", null, null, detectLanguage(req)));
	// 		}

	// 		if (!photo.userId.equals(req.user._id)) {
	// 			return res.status(403).json(createErrorResponse("photo.unauthorizedPhotoAccess", null, null, detectLanguage(req)));
	// 		}

	// 		// Delete from Cloudinary
	// 		if (photo.publicId) {
	// 			await CloudinaryService.deleteImage(photo.publicId);
	// 		}

	// 		// Delete from database
	// 		await Photo.findByIdAndDelete(photoId);

	// 		res.json(createSuccessResponse("photo.photoDeleted", null, detectLanguage(req)));
	// 	} catch (error) {
	// 		console.error("Delete photo with cloudinary error:", error);
	// 		res.status(500).json(createErrorResponse("photo.photoDeleteFailed", error.message, null, detectLanguage(req)));
	// 	}
	// }

	// // Get image URLs
	// static async getImageUrls(req, res) {
	// 	try {
	// 		const { photoIds } = req.body;

	// 		if (!Array.isArray(photoIds)) {
	// 			return res.status(400).json(createErrorResponse("validation.invalidArray", null, null, detectLanguage(req)));
	// 		}

	// 		const photos = await Photo.find({
	// 			_id: { $in: photoIds },
	// 			$or: [
	// 				{ userId: req.user._id },
	// 				{ sharedWith: req.user._id }
	// 			]
	// 		}).select('imageUrl publicId');

	// 		const imageUrls = photos.map(photo => ({
	// 			id: photo._id,
	// 			url: photo.imageUrl,
	// 			publicId: photo.publicId
	// 		}));

	// 		res.json(createSuccessResponse("photo.photosRetrieved", { imageUrls }, detectLanguage(req)));
	// 	} catch (error) {
	// 		console.error("Get image URLs error:", error);
	// 		res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
	// 	}
	// }
}
