import { validationResult } from "express-validator";
import {
	AddParticipantDTO,
	ConversationListResponseDTO,
	ConversationResponseDTO,
	CreateConversationDTO,
	RemoveParticipantDTO,
	SearchConversationsDTO,
	UpdateConversationDTO,
} from "../dtos/conversation.dto.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { createErrorResponse, createSuccessResponse, createValidationErrorResponse, detectLanguage } from "../utils/translations.js";

export class ConversationController {
	// Helper method to check if last message is read by user
	static async isLastMessageRead(conversationId, userId) {
		try {
			const lastMessage = await Message.findOne({
				conversationId: conversationId
			})
			.sort({ createdAt: -1 })
			.lean();

			if (!lastMessage) {
				return true; // No messages = considered read
			}

			// If current user sent the last message, consider it "read" (don't count as unread)
			if (lastMessage.senderId.toString() === userId.toString()) {
				return true;
			}

			// If someone else sent the message, check if current user has read it
			return lastMessage.readBy && lastMessage.readBy.includes(userId);
		} catch (error) {
			console.error("Error checking last message read status:", error);
			return true; // Default to read on error
		}
	}

	// Helper method to get enriched last message with read status
	static async getLastMessageWithReadStatus(conversationId, userId) {
		try {
			const lastMessage = await Message.findOne({
				conversationId: conversationId
			})
			.sort({ createdAt: -1 })
			.populate("senderId", "username avatarUrl")
			.lean();

			if (!lastMessage) {
				return null;
			}

			// Calculate isRead status for the current user
			// If current user sent the message, consider it "read"
			// If someone else sent it, check if current user has read it
			const isRead = lastMessage.senderId.toString() === userId.toString() || 
				(lastMessage.readBy && lastMessage.readBy.includes(userId));

			return {
				messageId: lastMessage._id,
				text: lastMessage.text || (lastMessage.attachments && lastMessage.attachments.length > 0 ? "Media" : ""),
				// senderId removed as requested
				sender: lastMessage.senderId,
				timestamp: lastMessage.createdAt,
				isRead: isRead
			};
		} catch (error) {
			console.error("Error fetching last message:", error);
			return null;
		}
	}

	// Get count of unread conversations
	static async getUnreadConversationsCount(req, res) {
		try {
			const userId = req.user._id;

			// Get all user's conversations
			const conversations = await Conversation.find({
				participants: userId,
				isActive: true
			}).select('_id').lean();

			let unreadCount = 0;

			// Check each conversation's last message read status
			for (const conv of conversations) {
				const isRead = await ConversationController.isLastMessageRead(conv._id, userId);
				if (!isRead) {
					unreadCount++;
				}
			}

			res.json(createSuccessResponse("conversation.unreadCountRetrieved", { unreadCount }, detectLanguage(req)));
		} catch (error) {
			console.error("Get unread conversations count error:", error);
			res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
		}
	}

	// Mark conversation messages as read
	static async markConversationAsRead(req, res) {
		try {
			const { conversationId } = req.params;
			const userId = req.user._id;

			// Verify conversation exists and user is participant
			const conversation = await Conversation.findOne({
				_id: conversationId,
				participants: userId,
				isActive: true,
			});

			if (!conversation) {
				return res.status(404).json(createErrorResponse("conversation.conversationNotFound", null, null, detectLanguage(req)));
			}

			// Initialize readBy field for messages that don't have it
			await Message.updateMany(
				{
					conversationId: conversationId,
					readBy: { $exists: false }
				},
				{
					$set: { readBy: [] }
				}
			);

			// Mark all unread messages in this conversation as read by the user
			// Now includes user's own messages since isRead defaults to false for everyone
			await Message.updateMany(
				{
					conversationId: conversationId,
					readBy: { $nin: [userId] } // Only update messages not already read by user
				},
				{
					$addToSet: { readBy: userId } // Add user to readBy array
				}
			);

			res.json(createSuccessResponse("conversation.conversationMarkedAsRead", null, detectLanguage(req)));
		} catch (error) {
			console.error("Mark conversation as read error:", error);
			res.status(500).json(createErrorResponse("conversation.markAsReadFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Create a new conversation
	static async createConversation(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}
			const createDTO = new CreateConversationDTO(req.body);
			const userId = req.user._id;

			if (!createDTO.participants.includes(userId)) {
				createDTO.participants.push(userId);
			}

			if (createDTO.isGroup && !createDTO.admin) {
				createDTO.admin = userId;
			}

			const conversation = new Conversation({
				name: createDTO.name,
				participants: createDTO.participants,
				isGroup: createDTO.isGroup,
				admin: createDTO.admin,
				groupSettings: createDTO.groupSettings,
				settings: createDTO.settings,
			});

			await conversation.save();

			// Populate participants
			await conversation.populate("participants", "username avatarUrl email");
			await conversation.populate("admin", "username avatarUrl");

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants, userId);

			res.status(201).json(createSuccessResponse("conversation.conversationCreated", response.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Create conversation error:", error);
			res.status(500).json(createErrorResponse("conversation.conversationCreationFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Get or create conversation when first send message
	static async getOrCreateConversation(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const createDTO = new CreateConversationDTO(req.body);
			const userId = req.user._id;

			if (!createDTO.participants.includes(userId)) {
				createDTO.participants.push(userId);
			}

			let conversation;

			if (!createDTO.isGroup && createDTO.participants.length === 2) {
				// Search for 1-1 conversation (unordered match)
				conversation = await Conversation.findOne({
					isGroup: false,
					participants: { $all: createDTO.participants, $size: 2 },
				});
			}

			if (!conversation) {
				// Create new conversation
				if (createDTO.isGroup && !createDTO.admin) {
					createDTO.admin = userId;
				}

				conversation = new Conversation({
					name: createDTO.name,
					participants: createDTO.participants,
					isGroup: createDTO.isGroup,
					admin: createDTO.admin,
					groupSettings: createDTO.groupSettings,
					settings: createDTO.settings,
				});

				await conversation.save();
			}

			await conversation.populate("participants", "username avatarUrl email");
			await conversation.populate("admin", "username avatarUrl");

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants, userId);

			res.status(200).json(
				createSuccessResponse(conversation.isNew ? "conversation.conversationCreated" : "conversation.conversationRetrieved", response.toJSON(), detectLanguage(req))
			);
		} catch (error) {
			console.error("Get or create conversation error:", error);
			res.status(500).json(createErrorResponse("conversation.conversationCreationFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Get user conversations
	static async getUserConversations(req, res) {
		try {
			const userId = req.user._id;
			const { limit = 20, lastUpdatedAt } = req.query;
			const parsedLimit = parseInt(limit);

			let matchStage = {
				participants: userId,
				isActive: true,
			};

			// Cursor-based pagination: fetch conversations updated before lastUpdatedAt
			if (lastUpdatedAt) {
				matchStage.updatedAt = { ...matchStage.updatedAt, $lt: new Date(lastUpdatedAt) };
			}

			// Build aggregation pipeline
			const pipeline = [
				{ $match: matchStage },
				{ $sort: { updatedAt: -1 } },
				{ $limit: parsedLimit },
				{
					$lookup: {
						from: "users",
						localField: "participants",
						foreignField: "_id",
						as: "participants"
					}
				},
				{
					$lookup: {
						from: "users",
						localField: "admin",
						foreignField: "_id",
						as: "admin"
					}
				},
				{
					$unwind: {
						path: "$admin",
						preserveNullAndEmptyArrays: true
					}
				},
				{
					$project: {
						_id: 1,
						name: 1,
						participants: {
							_id: 1,
							username: 1,
							avatarUrl: 1,
							email: 1
						},
						isGroup: 1,
						admin: {
							_id: 1,
							username: 1,
							avatarUrl: 1
						},
						lastMessage: {
							messageId: 1,
							text: 1,
							timestamp: 1,
							isRead: 1
						},
						groupSettings: 1,
						settings: 1,
						updatedAt: 1,
						createdAt: 1,
						isActive: 1
					}
				}
			];

			const conversations = await Conversation.aggregate(pipeline);

			// Enrich conversations with proper lastMessage including read status
			const enrichedConversations = await Promise.all(
				conversations.map(async (conv) => {
					const lastMessage = await ConversationController.getLastMessageWithReadStatus(conv._id, userId);
					return {
						...conv,
						lastMessage: lastMessage
					};
				})
			);

			const hasNextPage = enrichedConversations.length === parsedLimit;
			const nextCursor = hasNextPage ? enrichedConversations[enrichedConversations.length - 1].updatedAt : null;

			const pagination = {
				limit: parsedLimit,
				hasNextPage,
				nextCursor,
			};

			const conversationListResponse = ConversationListResponseDTO.fromConversations(enrichedConversations, pagination, userId);

			res.json(createSuccessResponse("conversation.conversationsRetrieved", conversationListResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Get user conversations error:", error);
			res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
		}
	}

	// Get conversation by ID
	static async getConversation(req, res) {
		try {
			const { conversationId } = req.params;
			const userId = req.user._id;

			const conversation = await Conversation.findOne({
				_id: conversationId,
				participants: userId,
				isActive: true,
			})
				.populate("participants", "username avatarUrl email")
				.populate("admin", "username avatarUrl");

			if (!conversation) {
				return res.status(404).json(createErrorResponse("conversation.conversationNotFound", null, null, detectLanguage(req)));
			}

			// Enrich conversation with proper lastMessage including read status
			const lastMessage = await ConversationController.getLastMessageWithReadStatus(conversation._id, userId);
			const enrichedConversation = {
				...conversation.toObject(),
				lastMessage: lastMessage
			};

			const response = ConversationResponseDTO.fromConversation(enrichedConversation, conversation.participants, userId);

			res.json(createSuccessResponse("conversation.conversationRetrieved", response.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Get conversation error:", error);
			res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
		}
	}

	// Update conversation
	static async updateConversation(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const { conversationId } = req.params;
			const updateDTO = new UpdateConversationDTO(req.body);
			const userId = req.user._id;

			const conversation = await Conversation.findOne({
				_id: conversationId,
				participants: userId,
				isActive: true,
			});

			if (!conversation) {
				return res.status(404).json(createErrorResponse("conversation.conversationNotFound", null, null, detectLanguage(req)));
			}

			// Check if user is admin for group conversations
			if (conversation.isGroup && !conversation.admin.equals(userId)) {
				return res.status(403).json(createErrorResponse("conversation.unauthorizedAccess", null, null, detectLanguage(req)));
			}

			const updatedConversation = await Conversation.findByIdAndUpdate(conversationId, updateDTO, { new: true, runValidators: true })
				.populate("participants", "username avatarUrl email")
				.populate("admin", "username avatarUrl");

			const response = ConversationResponseDTO.fromConversation(updatedConversation, updatedConversation.participants, userId);

			res.json(createSuccessResponse("conversation.conversationUpdated", response.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Update conversation error:", error);
			res.status(500).json(createErrorResponse("conversation.conversationUpdateFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Add participants to conversation
	static async addParticipants(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const { conversationId } = req.params;
			const addDTO = new AddParticipantDTO(req.body);
			const userId = req.user._id;

			const conversation = await Conversation.findOne({
				_id: conversationId,
				participants: userId,
				isActive: true,
			});

			if (!conversation) {
				return res.status(404).json(createErrorResponse("conversation.conversationNotFound", null, null, detectLanguage(req)));
			}

			// Check if user is admin for group conversations
			if (conversation.isGroup && !conversation.admin.equals(userId)) {
				return res.status(403).json(createErrorResponse("conversation.unauthorizedAccess", null, null, detectLanguage(req)));
			}

			// Validate participants exist
			const participants = await User.find({ _id: { $in: addDTO.userIds } });
			if (participants.length !== addDTO.userIds.length) {
				return res.status(400).json(createErrorResponse("user.userNotFound", null, null, detectLanguage(req)));
			}

			// Check if participants are already in conversation
			const existingParticipants = conversation.participants.filter((p) => addDTO.userIds.includes(p.toString()));
			if (existingParticipants.length > 0) {
				return res.status(400).json(createErrorResponse("conversation.participantAlreadyExists", null, null, detectLanguage(req)));
			}

			// Add participants
			conversation.participants.push(...addDTO.userIds);
			await conversation.save();

			await conversation.populate("participants", "username avatarUrl email");
			await conversation.populate("admin", "username avatarUrl");

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants, userId);

			res.json(createSuccessResponse("conversation.participantAdded", response.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Add participants error:", error);
			res.status(500).json(createErrorResponse("conversation.participantManagementFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Remove participant from conversation
	static async removeParticipant(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const { conversationId } = req.params;
			const removeDTO = new RemoveParticipantDTO(req.body);
			const userId = req.user._id;

			const conversation = await Conversation.findOne({
				_id: conversationId,
				participants: userId,
				isActive: true,
			});

			if (!conversation) {
				return res.status(404).json(createErrorResponse("conversation.conversationNotFound", null, null, detectLanguage(req)));
			}

			// Check if user is admin for group conversations
			if (conversation.isGroup && !conversation.admin.equals(userId)) {
				return res.status(403).json(createErrorResponse("conversation.unauthorizedAccess", null, null, detectLanguage(req)));
			}

			// Check if trying to remove self
			if (removeDTO.userId === userId.toString()) {
				return res.status(400).json(createErrorResponse("conversation.cannotRemoveSelf", null, null, detectLanguage(req)));
			}

			// Check if participant exists in conversation
			const participantIndex = conversation.participants.findIndex((p) => p.toString() === removeDTO.userId);
			if (participantIndex === -1) {
				return res.status(404).json(createErrorResponse("conversation.participantNotFound", null, null, detectLanguage(req)));
			}

			// Remove participant
			conversation.participants.splice(participantIndex, 1);
			await conversation.save();

			await conversation.populate("participants", "username avatarUrl email");
			await conversation.populate("admin", "username avatarUrl");

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants, userId);

			res.json(createSuccessResponse("conversation.participantRemoved", response.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Remove participant error:", error);
			res.status(500).json(createErrorResponse("conversation.participantManagementFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Search conversations
	static async searchConversations(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const searchDTO = new SearchConversationsDTO(req.query);
			const userId = req.user._id;
			const { page = 1, limit = 20 } = req.query;
			const skip = (page - 1) * limit;

			let searchQuery = {
				participants: userId,
				isActive: true,
			};

			if (searchDTO.query) {
				searchQuery.name = { $regex: searchDTO.query, $options: "i" };
			}

			const conversations = await Conversation.find(searchQuery)
				.populate("participants", "username avatarUrl email")
				.populate("admin", "username avatarUrl")
				.sort({ updatedAt: -1 })
				.limit(parseInt(limit))
				.skip(skip);

			const total = await Conversation.countDocuments(searchQuery);
			const totalPages = Math.ceil(total / limit);

			const pagination = {
				currentPage: parseInt(page),
				totalPages,
				totalConversations: total,
				hasNextPage: page < totalPages,
				hasPrevPage: page > 1,
			};

			const conversationListResponse = ConversationListResponseDTO.fromConversations(conversations, pagination, userId);

			res.json(createSuccessResponse("conversation.searchResults", conversationListResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Search conversations error:", error);
			res.status(500).json(createErrorResponse("conversation.searchFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Get conversation threads
	static async getConversationThreads(req, res) {
		try {
			const { conversationId } = req.params;
			const userId = req.user._id;
			const { page = 1, limit = 20 } = req.query;
			const skip = (page - 1) * limit;

			const conversation = await Conversation.findOne({
				_id: conversationId,
				participants: userId,
				isActive: true,
			});

			if (!conversation) {
				return res.status(404).json(createErrorResponse("conversation.conversationNotFound", null, null, detectLanguage(req)));
			}

			// Get threads from messages (this would need to be implemented based on your message model)
			// For now, returning empty threads
			const threads = [];
			const total = 0;
			const totalPages = Math.ceil(total / limit);

			const pagination = {
				currentPage: parseInt(page),
				totalPages,
				totalThreads: total,
				hasNextPage: page < totalPages,
				hasPrevPage: page > 1,
			};

			res.json(createSuccessResponse("conversation.threadsRetrieved", { threads, pagination }, detectLanguage(req)));
		} catch (error) {
			console.error("Get conversation threads error:", error);
			res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
		}
	}

	// Leave conversation
	static async leaveConversation(req, res) {
		try {
			const { conversationId } = req.params;
			const userId = req.user._id;

			const conversation = await Conversation.findOne({
				_id: conversationId,
				participants: userId,
				isActive: true,
			});

			if (!conversation) {
				return res.status(404).json(createErrorResponse("conversation.conversationNotFound", null, null, detectLanguage(req)));
			}

			// Remove user from participants
			conversation.participants = conversation.participants.filter((p) => !p.equals(userId));

			// If no participants left, deactivate conversation
			if (conversation.participants.length === 0) {
				conversation.isActive = false;
			}

			await conversation.save();

			res.json(createSuccessResponse("conversation.conversationLeft", null, detectLanguage(req)));
		} catch (error) {
			console.error("Leave conversation error:", error);
			res.status(500).json(createErrorResponse("conversation.leaveFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Delete conversation
	static async deleteConversation(req, res) {
		try {
			const { conversationId } = req.params;
			const userId = req.user._id;

			const conversation = await Conversation.findOne({
				_id: conversationId,
				participants: userId,
				isActive: true,
			});

			if (!conversation) {
				return res.status(404).json(createErrorResponse("conversation.conversationNotFound", null, null, detectLanguage(req)));
			}

			// Check if user is admin for group conversations
			if (conversation.isGroup && !conversation.admin.equals(userId)) {
				return res.status(403).json(createErrorResponse("conversation.unauthorizedAccess", null, null, detectLanguage(req)));
			}

			// Deactivate conversation
			conversation.isActive = false;
			await conversation.save();

			res.json(createSuccessResponse("conversation.conversationDeleted", null, detectLanguage(req)));
		} catch (error) {
			console.error("Delete conversation error:", error);
			res.status(500).json(createErrorResponse("conversation.conversationDeleteFailed", error.message, null, detectLanguage(req)));
		}
	}
}
