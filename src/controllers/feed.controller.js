import Feed from "../models/feed.model.js";
import User from "../models/user.model.js";
import { validationResult } from "express-validator";
import { CreateFeedDTO, UpdateFeedDTO, AddReactionDTO, FeedResponseDTO, FeedListResponseDTO, SearchFeedsDTO } from "../dtos/index.js";
import mongoose from "mongoose";
import { createSuccessResponse, createErrorResponse, createValidationErrorResponse, detectLanguage } from "../utils/translations.js";

export class FeedController {
	// Get all feeds (with pagination and filtering)
	// static async getFeeds (req, res) {
	// 	try {
	// 		const { query, userId, sharedWithMe, limit = 10, page = 1 } = req.query;
	// 		const skip = (page - 1) * limit;

	// 		let searchQuery = {};

	// 		if (userId) searchQuery.userId = userId;
	// 		if (sharedWithMe === 'true') searchQuery.sharedWith = req.user._id;
	// 		if (query) searchQuery.caption = { $regex: query, $options: 'i' };

	// 		const feeds = await Feed.find(searchQuery)
	// 			.populate('userId', 'username avatarUrl')
	// 			.populate('sharedWith', 'username avatarUrl')
	// 			.sort({ createdAt: -1 })
	// 			.limit(parseInt(limit))
	// 			.skip(skip);

	// 		const total = await Feed.countDocuments(searchQuery);
	// 		const totalPages = Math.ceil(total / limit);

	// 		const pagination = {
	// 			currentPage: parseInt(page),
	// 			totalPages,
	// 			totalFeeds: total,
	// 			hasNextPage: page < totalPages,
	// 			hasPrevPage: page > 1
	// 		};

	// 		const feedListResponse = FeedListResponseDTO.fromFeeds(feeds, pagination);
	// 		res.json(feedListResponse.toJSON());
	// 	} catch (error) {
	// 		console.error('Error fetching feeds:', error);
	// 		res.status(500).json({ message: 'Internal server error' });
	// 	}
	// };

	// Get feeds (with cursor-based pagination)
	// static async getFeeds2(req, res) {
	// 	try {
	// 		const { query, limit = 10, lastCreatedAt } = req.query;
	// 		const parsedLimit = parseInt(limit);

	// 		// Get current user with friends
	// 		const currentUser = await User.findById(req.user._id).populate('friends', '_id');
	// 		if (!currentUser) {
	// 			return res.status(404).json(createErrorResponse("user.userNotFound", null, null, detectLanguage(req)));
	// 		}

	// 		// Create array of user IDs including current user and friends
	// 		const userIds = [req.user._id, ...currentUser.friends.map(friend => friend._id)];

	// 		let searchQuery = {
	// 			$or: [
	// 				{ userId: { $in: userIds } }, // Feeds from user and friends
	// 				{ sharedWith: req.user._id }  // Feeds shared with current user
	// 			]
	// 		};

	// 		// Add caption search if provided
	// 		if (query) {
	// 			searchQuery.caption = { $regex: query, $options: "i" };
	// 		}

	// 		// Add cursor-based pagination
	// 		if (lastCreatedAt) {
	// 			searchQuery.createdAt = { $lt: new Date(lastCreatedAt) };
	// 		}

	// 		const feeds = await Feed.find(searchQuery)
	// 			.populate("userId", "username avatarUrl")
	// 			.populate("sharedWith", "username avatarUrl")
	// 			.sort({ createdAt: -1 })
	// 			.limit(parsedLimit);

	// 		const hasNextPage = feeds.length === parsedLimit;
	// 		const nextCursor = hasNextPage ? feeds[feeds.length - 1].createdAt : null;

	// 		const pagination = {
	// 			limit: parsedLimit,
	// 			hasNextPage,
	// 			nextCursor,
	// 		};

	// 		const feedListResponse = FeedListResponseDTO.fromFeeds(feeds, pagination);
	// 		res.json(createSuccessResponse("feed.feedsRetrieved", feedListResponse.toJSON(), detectLanguage(req)));
	// 	} catch (error) {
	// 		console.error("Error fetching feeds (cursor-based):", error);
	// 		res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
	// 	}
	// }

	static async getFeeds(req, res) {
		try {
			const { query, limit =  10, lastCreatedAt, mediaType, userId, sharedWithMe } = req.query;

			console.log("Request query params:", req.query);
			console.log("User ID from auth:", req.user._id);
			const parsedLimit = parseInt(limit);

			// Get current user and their friends (lean for performance)
			const currentUser = await User.findById(req.user._id).select("friends").lean();
			console.log("Current user friends:", currentUser?.friends);
			if (!currentUser) {
				return res.status(404).json(createErrorResponse("user.userNotFound", null, null, detectLanguage(req)));
			}

			// Include feeds from friends AND self
			let userIds = [req.user._id]; // Start with current user
			if (currentUser.friends && currentUser.friends.length > 0) {
				userIds.push(...currentUser.friends); // Add friends
			}

			// If userId is provided, filter by that user (must be current user or a friend)
			if (userId && userIds.map(id => id.toString()).includes(userId)) {
				userIds = [mongoose.Types.ObjectId(userId)];
			}

			console.log("Final userIds for feeds query:", userIds);

			let matchStage = {
				userId: { $in: userIds }
			};

			// Filter: sharedWithMe (feeds shared with current user)
			if (sharedWithMe === 'true') {
				matchStage.sharedWith = { $elemMatch: { $eq: req.user._id } };
			}

			// Filter: mediaType
			if (mediaType && ["image", "video"].includes(mediaType)) {
				matchStage.mediaType = mediaType;
			}

			// Cursor-based pagination
			if (lastCreatedAt) {
				matchStage.createdAt = { ...matchStage.createdAt, $lt: new Date(lastCreatedAt) };
			}

			console.log("Final match stage:", JSON.stringify(matchStage, null, 2));

			// Debug: Check if friend has any feeds at all
			if (userIds.length > 0) {
				const friendFeeds = await Feed.find({ userId: { $in: userIds } }).countDocuments();
				console.log(`Friend(s) ${userIds.join(', ')} have ${friendFeeds} total feeds`);
			}

			// Debug: Check total feeds in database
			const totalFeeds = await Feed.countDocuments();
			console.log(`Total feeds in database: ${totalFeeds}`);

			// Build aggregation pipeline
			const pipeline = [
				{ $match: matchStage },
				{
					$lookup: {
						from: "users",
						localField: "userId",
						foreignField: "_id",
						as: "user"
					}
				},
				{ $unwind: "$user" }
			];

			// Filter: query (search in caption or user.username, case-insensitive)
			if (query && typeof query === "string" && query.trim().length > 0) {
				const regex = { $regex: query.trim(), $options: "i" };
				pipeline.push({
					$match: {
						$or: [
							{ caption: regex },
							{ "user.username": regex }
						]
					}
				});
			}

			pipeline.push(
				{ $sort: { createdAt: -1 } },
				{ $limit: parsedLimit },
				{
					$project: {
						_id: 1,
						userId: "$user._id",
						imageUrl: 1,
						publicId: 1,
						caption: 1,
						isFrontCamera: 1,
						sharedWith: 1,
						location: 1,
						reactions: 1,
						mediaType: 1,
						duration: 1,
						format: 1,
						width: 1,
						height: 1,
						fileSize: 1,
						createdAt: 1,
						user: {
							_id: "$user._id",
							username: "$user.username",
							email: "$user.email",
							avatarUrl: "$user.avatarUrl"
						}
					}
				}
			);

			const feeds = await Feed.aggregate(pipeline);
			console.log("Raw aggregation result:", feeds);
			console.log("Number of feeds found:", feeds.length);

			const hasNextPage = feeds.length === parsedLimit;
			const nextCursor = hasNextPage ? feeds[feeds.length - 1].createdAt : null;

			const pagination = {
				limit: parsedLimit,
				hasNextPage,
				nextCursor,
			};

			const feedListResponse = FeedListResponseDTO.fromAggregatedFeeds(feeds, pagination);
			console.log(feedListResponse);
			
			res.json(createSuccessResponse("feed.feedsRetrieved", feedListResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error fetching feeds (friends only):", error);
			res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
		}
	}

	// Get a single feed by ID
	static async getFeedById(req, res) {
		try {
			const { feedId } = req.params;

			const feed = await Feed.findById(feedId).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

			if (!feed) {
				return res.status(404).json(createErrorResponse("feed.feedNotFound", null, null, detectLanguage(req)));
			}

			const hasAccess = feed.userId._id.equals(req.user._id) || feed.sharedWith.some((user) => user._id.equals(req.user._id));

			if (!hasAccess) {
				return res.status(403).json(createErrorResponse("feed.unauthorizedFeedAccess", null, null, detectLanguage(req)));
			}

			const feedResponse = FeedResponseDTO.fromFeed(feed);
			res.json(createSuccessResponse("feed.feedRetrieved", feedResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error fetching feed:", error);
			res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
		}
	}

	// Create a new feed from uploaded media
	static async createFeed(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			console.log("🚀 ~ FeedController ~ createFeed ~ req.body:", req.body);

			const {
				url,           // Cloudinary URL from upload
				publicId,      // Cloudinary public ID
				mediaType,     // 'image' or 'video'
				caption,       // Caption text
				isFrontCamera, // Whether front camera was used
				sharedWith,    // Array of user IDs
				location,      // Location object {lat, lng}
				duration,      // Video duration (optional)
				format,        // File format
				width,         // Media width
				height,        // Media height
				fileSize       // File size in bytes
			} = req.body;

			// Validate required fields
			if (!url || !publicId || !mediaType) {
				return res.status(400).json(createErrorResponse("validation.missingRequiredFields", "url, publicId, and mediaType are required", null, detectLanguage(req)));
			}

			// Create feed entry in database
			const feedData = {
				userId: req.user._id,
				imageUrl: url,
				publicId: publicId,
				caption: caption || "",
				isFrontCamera: isFrontCamera ?? true,
				sharedWith: sharedWith || [],
				location: location || null,
				mediaType: mediaType,
				duration: mediaType === 'video' ? duration : undefined,
				format: format,
				width: width,
				height: height,
				fileSize: fileSize
			};

			const feed = await Feed.create(feedData);

			// Populate user data
			const populatedFeed = await Feed.findById(feed._id).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

			const feedResponse = FeedResponseDTO.fromFeed(populatedFeed);
			res.status(201).json(createSuccessResponse("feed.feedCreated", feedResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error creating feed:", error);
			res.status(500).json(createErrorResponse("feed.feedCreationFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Create a new feed (legacy method - kept for backward compatibility)
	// static async createFeed(req, res) {
	// 	try {
	// 		const errors = validationResult(req);
	// 		if (!errors.isEmpty()) {
	// 			return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
	// 		}

	// 		const feedData = new CreateFeedDTO(req.body);
	// 		const feed = new Feed({
	// 			...feedData,
	// 			userId: req.user._id,
	// 		});

	// 		await feed.save();

	// 		const populatedFeed = await Feed.findById(feed._id).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

	// 		const feedResponse = FeedResponseDTO.fromFeed(populatedFeed);
	// 		res.status(201).json(createSuccessResponse("feed.feedCreated", feedResponse.toJSON(), detectLanguage(req)));
	// 	} catch (error) {
	// 		console.error("Error creating feed:", error);
	// 		res.status(500).json(createErrorResponse("feed.feedCreationFailed", error.message, null, detectLanguage(req)));
	// 	}
	// }

	// Update a feed
	static async updateFeed(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const { feedId } = req.params;
			const updateData = new UpdateFeedDTO(req.body);

			const feed = await Feed.findById(feedId);
			if (!feed) {
				return res.status(404).json(createErrorResponse("feed.feedNotFound", null, null, detectLanguage(req)));
			}

			if (!feed.userId.equals(req.user._id)) {
				return res.status(403).json(createErrorResponse("feed.unauthorizedFeedAccess", null, null, detectLanguage(req)));
			}

			const updatedFeed = await Feed.findByIdAndUpdate(feedId, updateData, { new: true, runValidators: true }).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

			const feedResponse = FeedResponseDTO.fromFeed(updatedFeed);
			res.json(createSuccessResponse("feed.feedUpdated", feedResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error updating feed:", error);
			res.status(500).json(createErrorResponse("feed.feedUpdateFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Delete a feed
	static async deleteFeed(req, res) {
		try {
			const { feedId } = req.params;

			const feed = await Feed.findById(feedId);
			if (!feed) {
				return res.status(404).json(createErrorResponse("feed.feedNotFound", null, null, detectLanguage(req)));
			}

			if (!feed.userId.equals(req.user._id)) {
				return res.status(403).json(createErrorResponse("feed.unauthorizedFeedAccess", null, null, detectLanguage(req)));
			}

			await Feed.findByIdAndDelete(feedId);
			res.json(createSuccessResponse("feed.feedDeleted", null, detectLanguage(req)));
		} catch (error) {
			console.error("Error deleting feed:", error);
			res.status(500).json(createErrorResponse("feed.feedDeleteFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Add reaction to feed
	static async addReaction(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const { feedId } = req.params;
			const reactionData = new AddReactionDTO(req.body);

			const feed = await Feed.findById(feedId);
			if (!feed) {
				return res.status(404).json(createErrorResponse("feed.feedNotFound", null, null, detectLanguage(req)));
			}

			// Check if user has access to the feed
			const hasAccess = feed.userId.equals(req.user._id) || feed.sharedWith.some((userId) => userId.equals(req.user._id));
			if (!hasAccess) {
				return res.status(403).json(createErrorResponse("feed.unauthorizedFeedAccess", null, null, detectLanguage(req)));
			}

			// Check if reaction already exists
			const existingReaction = feed.reactions.find((reaction) => reaction.userId.equals(req.user._id) && reaction.type === reactionData.type);

			if (existingReaction) {
				return res.status(400).json(createErrorResponse("feed.reactionFailed", "Reaction already exists", null, detectLanguage(req)));
			}

			feed.reactions.push({
				userId: req.user._id,
				type: reactionData.type,
			});

			await feed.save();

			const updatedFeed = await Feed.findById(feedId).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

			const feedResponse = FeedResponseDTO.fromFeed(updatedFeed);
			res.json(createSuccessResponse("feed.reactionAdded", feedResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error adding reaction:", error);
			res.status(500).json(createErrorResponse("feed.reactionFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Remove reaction from feed
	static async removeReaction(req, res) {
		try {
			const { feedId, reactionType } = req.params;

			const feed = await Feed.findById(feedId);
			if (!feed) {
				return res.status(404).json(createErrorResponse("feed.feedNotFound", null, null, detectLanguage(req)));
			}

			// Check if user has access to the feed
			const hasAccess = feed.userId.equals(req.user._id) || feed.sharedWith.some((userId) => userId.equals(req.user._id));
			if (!hasAccess) {
				return res.status(403).json(createErrorResponse("feed.unauthorizedFeedAccess", null, null, detectLanguage(req)));
			}

			// Find and remove the reaction
			const reactionIndex = feed.reactions.findIndex((reaction) => reaction.userId.equals(req.user._id) && reaction.type === reactionType);

			if (reactionIndex === -1) {
				return res.status(404).json(createErrorResponse("feed.reactionFailed", "Reaction not found", null, detectLanguage(req)));
			}

			feed.reactions.splice(reactionIndex, 1);
			await feed.save();

			const updatedFeed = await Feed.findById(feedId).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl");

			const feedResponse = FeedResponseDTO.fromFeed(updatedFeed);
			res.json(createSuccessResponse("feed.reactionRemoved", feedResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error removing reaction:", error);
			res.status(500).json(createErrorResponse("feed.reactionFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Get user feeds
	static async getUserFeeds(req, res) {
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
			// If viewing own feeds, show all
			// If viewing someone else's feeds, only show shared ones
			if (userId !== req.user._id.toString()) {
				searchQuery.sharedWith = req.user._id;
			}

			const feeds = await Feed.find(searchQuery).populate("userId", "username avatarUrl").populate("sharedWith", "username avatarUrl").sort({ createdAt: -1 }).limit(parseInt(limit)).skip(skip);

			const total = await Feed.countDocuments(searchQuery);
			const totalPages = Math.ceil(total / limit);

			const pagination = {
				currentPage: parseInt(page),
				totalPages,
				totalFeeds: total,
				hasNextPage: page < totalPages,
				hasPrevPage: page > 1,
			};

			const feedListResponse = FeedListResponseDTO.fromFeeds(feeds, pagination);
			res.json(createSuccessResponse("feed.feedsRetrieved", feedListResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error fetching user feeds:", error);
			res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
		}
	}
}
