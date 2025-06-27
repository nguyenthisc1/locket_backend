import Photo from "../models/photo.model.js";
import User from "../models/user.model.js";
import { validationResult } from 'express-validator';
import { 
	CreatePhotoDTO, 
	UpdatePhotoDTO, 
	AddReactionDTO, 
	PhotoResponseDTO, 
	PhotoListResponseDTO,
	SearchPhotosDTO
} from '../dtos/index.js';

// Get all photos (with pagination and filtering)
export const getPhotos = async (req, res) => {
	try {
		const { query, userId, sharedWithMe, limit = 10, page = 1 } = req.query;
		const skip = (page - 1) * limit;

		let searchQuery = {};

		if (userId) searchQuery.userId = userId;
		if (sharedWithMe === 'true') searchQuery.sharedWith = req.user._id;
		if (query) searchQuery.caption = { $regex: query, $options: 'i' };

		const photos = await Photo.find(searchQuery)
			.populate('userId', 'username avatarUrl')
			.populate('sharedWith', 'username avatarUrl')
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip(skip);

		const total = await Photo.countDocuments(searchQuery);
		const totalPages = Math.ceil(total / limit);

		const pagination = {
			currentPage: parseInt(page),
			totalPages,
			totalPhotos: total,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1
		};

		const photoListResponse = PhotoListResponseDTO.fromPhotos(photos, pagination);
		res.json(photoListResponse.toJSON());
	} catch (error) {
		console.error('Error fetching photos:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Get a single photo by ID
export const getPhotoById = async (req, res) => {
	try {
		const { photoId } = req.params;

		const photo = await Photo.findById(photoId)
			.populate('userId', 'username avatarUrl')
			.populate('sharedWith', 'username avatarUrl');

		if (!photo) {
			return res.status(404).json({ message: 'Photo not found' });
		}

		const hasAccess = photo.userId._id.equals(req.user._id) || 
						 photo.sharedWith.some(user => user._id.equals(req.user._id));

		if (!hasAccess) {
			return res.status(403).json({ message: 'Access denied' });
		}

		const photoResponse = PhotoResponseDTO.fromPhoto(photo);
		res.json(photoResponse.toJSON());
	} catch (error) {
		console.error('Error fetching photo:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Create a new photo
export const createPhoto = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ 
				message: 'Validation failed', 
				errors: errors.array() 
			});
		}

		const createData = new CreatePhotoDTO(req.body);
		const { imageUrl, caption, sharedWith, location } = createData;

		const photo = await Photo.create({
			userId: req.user._id,
			imageUrl,
			caption,
			sharedWith,
			location
		});

		const populatedPhoto = await Photo.findById(photo._id)
			.populate('userId', 'username avatarUrl')
			.populate('sharedWith', 'username avatarUrl');

		const photoResponse = PhotoResponseDTO.fromPhoto(populatedPhoto);
		res.status(201).json(photoResponse.toJSON());
	} catch (error) {
		console.error('Error creating photo:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Update a photo
export const updatePhoto = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ 
				message: 'Validation failed', 
				errors: errors.array() 
			});
		}

		const { photoId } = req.params;
		const updateData = new UpdatePhotoDTO(req.body);
		const updateFields = updateData.toUpdateData();

		const photo = await Photo.findById(photoId);
		if (!photo) {
			return res.status(404).json({ message: 'Photo not found' });
		}

		if (!photo.userId.equals(req.user._id)) {
			return res.status(403).json({ message: 'Access denied' });
		}

		const updatedPhoto = await Photo.findByIdAndUpdate(
			photoId,
			updateFields,
			{ new: true, runValidators: true }
		).populate('userId', 'username avatarUrl')
		 .populate('sharedWith', 'username avatarUrl');

		const photoResponse = PhotoResponseDTO.fromPhoto(updatedPhoto);
		res.json(photoResponse.toJSON());
	} catch (error) {
		console.error('Error updating photo:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Delete a photo
export const deletePhoto = async (req, res) => {
	try {
		const { photoId } = req.params;

		const photo = await Photo.findById(photoId);
		if (!photo) {
			return res.status(404).json({ message: 'Photo not found' });
		}

		if (!photo.userId.equals(req.user._id)) {
			return res.status(403).json({ message: 'Access denied' });
		}

		await Photo.findByIdAndDelete(photoId);
		res.json({ message: 'Photo deleted successfully' });
	} catch (error) {
		console.error('Error deleting photo:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Add reaction to a photo
export const addReaction = async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ 
				message: 'Validation failed', 
				errors: errors.array() 
			});
		}

		const { photoId } = req.params;
		const reactionData = new AddReactionDTO(req.body);
		const { type } = reactionData;

		const photo = await Photo.findById(photoId);
		if (!photo) {
			return res.status(404).json({ message: 'Photo not found' });
		}

		const hasAccess = photo.userId.equals(req.user._id) || 
						 photo.sharedWith.some(userId => userId.equals(req.user._id));

		if (!hasAccess) {
			return res.status(403).json({ message: 'Access denied' });
		}

		const existingReaction = photo.reactions.find(
			reaction => reaction.userId.equals(req.user._id)
		);

		if (existingReaction) {
			existingReaction.type = type;
			existingReaction.createdAt = new Date();
		} else {
			photo.reactions.push({
				userId: req.user._id,
				type,
				createdAt: new Date()
			});
		}

		await photo.save();

		const updatedPhoto = await Photo.findById(photoId)
			.populate('userId', 'username avatarUrl')
			.populate('sharedWith', 'username avatarUrl');

		const photoResponse = PhotoResponseDTO.fromPhoto(updatedPhoto);
		res.json(photoResponse.toJSON());
	} catch (error) {
		console.error('Error adding reaction:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Remove reaction from a photo
export const removeReaction = async (req, res) => {
	try {
		const { photoId } = req.params;

		const photo = await Photo.findById(photoId);
		if (!photo) {
			return res.status(404).json({ message: 'Photo not found' });
		}

		const hasAccess = photo.userId.equals(req.user._id) || 
						 photo.sharedWith.some(userId => userId.equals(req.user._id));

		if (!hasAccess) {
			return res.status(403).json({ message: 'Access denied' });
		}

		photo.reactions = photo.reactions.filter(
			reaction => !reaction.userId.equals(req.user._id)
		);

		await photo.save();

		const updatedPhoto = await Photo.findById(photoId)
			.populate('userId', 'username avatarUrl')
			.populate('sharedWith', 'username avatarUrl');

		const photoResponse = PhotoResponseDTO.fromPhoto(updatedPhoto);
		res.json(photoResponse.toJSON());
	} catch (error) {
		console.error('Error removing reaction:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
};

// Get user's photos
export const getUserPhotos = async (req, res) => {
	try {
		const { userId } = req.params;
		const { limit = 10, page = 1 } = req.query;
		const skip = (page - 1) * limit;

		// Check if user exists
		const user = await User.findById(userId);
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		// Build query based on relationship
		let searchQuery = { userId };

		// If viewing own photos, show all
		// If viewing someone else's photos, only show shared ones
		if (!userId.equals(req.user._id)) {
			searchQuery.sharedWith = req.user._id;
		}

		const photos = await Photo.find(searchQuery)
			.populate('userId', 'username avatarUrl')
			.populate('sharedWith', 'username avatarUrl')
			.populate('reactions.userId', 'username avatarUrl')
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip(skip);

		const total = await Photo.countDocuments(searchQuery);
		const totalPages = Math.ceil(total / limit);

		const pagination = {
			currentPage: parseInt(page),
			totalPages,
			totalPhotos: total,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1
		};

		const photoListResponse = PhotoListResponseDTO.fromPhotos(photos, pagination);
		res.json(photoListResponse.toJSON());
	} catch (error) {
		console.error('Error fetching user photos:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
};
