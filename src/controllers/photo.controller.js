import Photo from "../models/photo.model.js";
import User from "../models/user.model.js";
import { validationResult } from "express-validator";
import { CreatePhotoDTO, UpdatePhotoDTO, AddReactionDTO, PhotoResponseDTO, PhotoListResponseDTO, SearchPhotosDTO } from "../dtos/index.js";
import mongoose from "mongoose";
import { createSuccessResponse, createErrorResponse, createValidationErrorResponse, detectLanguage } from "../utils/translations.js";

export class PhotoController {
	// Get all photos (with pagination and filtering)
	// static async getPhotos (req, res) {
	// 	try {
	// 		const { query, userId, sharedWithMe, limit = 10, page = 1 } = req.query;
	// 		const skip = (page - 1) * limit;

	// 		let searchQuery = {};

	// 		if (userId) searchQuery.userId = userId;
	// 		if (sharedWithMe === 'true') searchQuery.sharedWith = req.user._id;
	// 		if (query) searchQuery.caption = { $regex: query, $options: 'i' };

	// 		const photos = await Photo.find(searchQuery)
	// 			.populate('userId', 'username avatarUrl')
	// 			.populate('sharedWith', 'username avatarUrl')
	// 			.sort({ createdAt: -1 })
	// 			.limit(parseInt(limit))
	// 			.skip(skip);

	// 		const total = await Photo.countDocuments(searchQuery);
	// 		const totalPages = Math.ceil(total / limit);

	// 		const pagination = {
	// 			currentPage: parseInt(page),
	// 			totalPages,
	// 			totalPhotos: total,
	// 			hasNextPage: page < totalPages,
	// 			hasPrevPage: page > 1
	// 		};

	// 		const photoListResponse = PhotoListResponseDTO.fromPhotos(photos, pagination);
	// 		res.json(photoListResponse.toJSON());
	// 	} catch (error) {
	// 		console.error('Error fetching photos:', error);
	// 		res.status(500).json({ message: 'Internal server error' });
	// 	}
	// };

	// Get photos for feed (with cursor-based pagination)
	static async getPhotos(req, res) {
		try {
			const { query, userId, sharedWithMe, limit = 10, lastCreatedAt } = req.query;
			const parsedLimit = parseInt(limit);

			let searchQuery = {};

			if (userId) searchQuery.userId = userId;
			if (sharedWithMe === "true") searchQuery.sharedWith = req.user._id;
			if (query) searchQuery.caption = { $regex: query, $options: "i" };
			if (lastCreatedAt) {
				searchQuery.createdAt = { $lt: new Date(lastCreatedAt) };
			}

			const photos = await Photo.find(searchQuery).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl").sort({ createdAt: -1 }).limit(parsedLimit);

			const hasNextPage = photos.length === parsedLimit;
			const nextCursor = hasNextPage ? photos[photos.length - 1].createdAt : null;

			const pagination = {
				limit: parsedLimit,
				hasNextPage,
				nextCursor,
			};

			const photoListResponse = PhotoListResponseDTO.fromPhotos(photos, pagination);
			res.json(createSuccessResponse("photo.photosRetrieved", photoListResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error fetching photos (cursor-based):", error);
			res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
		}
	}

	// Get a single photo by ID
	static async getPhotoById(req, res) {
		try {
			const { photoId } = req.params;

			const photo = await Photo.findById(photoId).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

			if (!photo) {
				return res.status(404).json(createErrorResponse("photo.photoNotFound", null, null, detectLanguage(req)));
			}

			const hasAccess = photo.userId._id.equals(req.user._id) || photo.sharedWith.some((user) => user._id.equals(req.user._id));

			if (!hasAccess) {
				return res.status(403).json(createErrorResponse("photo.unauthorizedPhotoAccess", null, null, detectLanguage(req)));
			}

			const photoResponse = PhotoResponseDTO.fromPhoto(photo);
			res.json(createSuccessResponse("photo.photoRetrieved", photoResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error fetching photo:", error);
			res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
		}
	}

	// Create a new photo
	static async createPhoto(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const photoData = new CreatePhotoDTO(req.body);
			const photo = new Photo({
				...photoData,
				userId: req.user._id,
			});

			await photo.save();

			const populatedPhoto = await Photo.findById(photo._id).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

			const photoResponse = PhotoResponseDTO.fromPhoto(populatedPhoto);
			res.status(201).json(createSuccessResponse("photo.photoCreated", photoResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error creating photo:", error);
			res.status(500).json(createErrorResponse("photo.photoCreationFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Update a photo
	static async updatePhoto(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const { photoId } = req.params;
			const updateData = new UpdatePhotoDTO(req.body);

			const photo = await Photo.findById(photoId);
			if (!photo) {
				return res.status(404).json(createErrorResponse("photo.photoNotFound", null, null, detectLanguage(req)));
			}

			if (!photo.userId.equals(req.user._id)) {
				return res.status(403).json(createErrorResponse("photo.unauthorizedPhotoAccess", null, null, detectLanguage(req)));
			}

			const updatedPhoto = await Photo.findByIdAndUpdate(photoId, updateData, { new: true, runValidators: true }).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

			const photoResponse = PhotoResponseDTO.fromPhoto(updatedPhoto);
			res.json(createSuccessResponse("photo.photoUpdated", photoResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error updating photo:", error);
			res.status(500).json(createErrorResponse("photo.photoUpdateFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Delete a photo
	static async deletePhoto(req, res) {
		try {
			const { photoId } = req.params;

			const photo = await Photo.findById(photoId);
			if (!photo) {
				return res.status(404).json(createErrorResponse("photo.photoNotFound", null, null, detectLanguage(req)));
			}

			if (!photo.userId.equals(req.user._id)) {
				return res.status(403).json(createErrorResponse("photo.unauthorizedPhotoAccess", null, null, detectLanguage(req)));
			}

			await Photo.findByIdAndDelete(photoId);
			res.json(createSuccessResponse("photo.photoDeleted", null, detectLanguage(req)));
		} catch (error) {
			console.error("Error deleting photo:", error);
			res.status(500).json(createErrorResponse("photo.photoDeleteFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Add reaction to photo
	static async addReaction(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const { photoId } = req.params;
			const reactionData = new AddReactionDTO(req.body);

			const photo = await Photo.findById(photoId);
			if (!photo) {
				return res.status(404).json(createErrorResponse("photo.photoNotFound", null, null, detectLanguage(req)));
			}

			// Check if user has access to the photo
			const hasAccess = photo.userId.equals(req.user._id) || photo.sharedWith.some((userId) => userId.equals(req.user._id));
			if (!hasAccess) {
				return res.status(403).json(createErrorResponse("photo.unauthorizedPhotoAccess", null, null, detectLanguage(req)));
			}

			// Check if reaction already exists
			const existingReaction = photo.reactions.find((reaction) => reaction.userId.equals(req.user._id) && reaction.type === reactionData.type);

			if (existingReaction) {
				return res.status(400).json(createErrorResponse("photo.reactionFailed", "Reaction already exists", null, detectLanguage(req)));
			}

			photo.reactions.push({
				userId: req.user._id,
				type: reactionData.type,
			});

			await photo.save();

			const updatedPhoto = await Photo.findById(photoId).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

			const photoResponse = PhotoResponseDTO.fromPhoto(updatedPhoto);
			res.json(createSuccessResponse("photo.reactionAdded", photoResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error adding reaction:", error);
			res.status(500).json(createErrorResponse("photo.reactionFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Remove reaction from photo
	static async removeReaction(req, res) {
		try {
			const { photoId, reactionType } = req.params;

			const photo = await Photo.findById(photoId);
			if (!photo) {
				return res.status(404).json(createErrorResponse("photo.photoNotFound", null, null, detectLanguage(req)));
			}

			// Check if user has access to the photo
			const hasAccess = photo.userId.equals(req.user._id) || photo.sharedWith.some((userId) => userId.equals(req.user._id));
			if (!hasAccess) {
				return res.status(403).json(createErrorResponse("photo.unauthorizedPhotoAccess", null, null, detectLanguage(req)));
			}

			// Find and remove the reaction
			const reactionIndex = photo.reactions.findIndex((reaction) => reaction.userId.equals(req.user._id) && reaction.type === reactionType);

			if (reactionIndex === -1) {
				return res.status(404).json(createErrorResponse("photo.reactionFailed", "Reaction not found", null, detectLanguage(req)));
			}

			photo.reactions.splice(reactionIndex, 1);
			await photo.save();

			const updatedPhoto = await Photo.findById(photoId).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

			const photoResponse = PhotoResponseDTO.fromPhoto(updatedPhoto);
			res.json(createSuccessResponse("photo.reactionRemoved", photoResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error removing reaction:", error);
			res.status(500).json(createErrorResponse("photo.reactionFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Get user photos
	static async getUserPhotos(req, res) {
		try {
			const { userId } = req.params;
			const { limit = 10, page = 1 } = req.query;
			const skip = (page - 1) * limit;

			// Check if user exists
			const user = await User.findById(userId);
			if (!user) {
				return res.status(404).json(createErrorResponse("user.userNotFound", null, null, detectLanguage(req)));
			}

			let searchQuery = { userId };
			// If viewing own photos, show all
			// If viewing someone else's photos, only show shared ones
			if (userId !== req.user._id.toString()) {
				searchQuery.sharedWith = req.user._id;
			}

			const photos = await Photo.find(searchQuery).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl").sort({ createdAt: -1 }).limit(parseInt(limit)).skip(skip);

			const total = await Photo.countDocuments(searchQuery);
			const totalPages = Math.ceil(total / limit);

			const pagination = {
				currentPage: parseInt(page),
				totalPages,
				totalPhotos: total,
				hasNextPage: page < totalPages,
				hasPrevPage: page > 1,
			};

			const photoListResponse = PhotoListResponseDTO.fromPhotos(photos, pagination);
			res.json(createSuccessResponse("photo.photosRetrieved", photoListResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error fetching user photos:", error);
			res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
		}
	}
}
