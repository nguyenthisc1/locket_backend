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
	// Helper method to migrate old participant structure to new structure
	static migrateParticipantsStructure(conversation) {
		if (conversation.participants && conversation.participants.length > 0) {
			// Check if it's the old structure (array of ObjectIds)
			const firstParticipant = conversation.participants[0];
			if (!firstParticipant.userId && !firstParticipant.user) {
				// Old structure - migrate it
				conversation.participants = conversation.participants.map(participantId => ({
					userId: participantId._id || participantId,
					user: participantId, // If populated, this will be the user object
					lastReadMessageId: null,
					lastReadAt: null,
					joinedAt: new Date()
				}));
			}
		}
		return conversation;
	}

	// Helper method to check if last message is read by user
	static async isLastMessageRead(conversationId, userId) {
		try {
			const lastMessage = await Message.findOne({
				conversationId: conversationId,
				isDeleted: false
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

			// Get the conversation to check participant's lastReadMessageId
			const conversation = await Conversation.findById(conversationId).lean();
			if (!conversation) {
				return true; // Default to read if conversation not found
			}

			// Find the participant's lastReadMessageId
			let participant = null;
			if (conversation.participants && conversation.participants.length > 0) {
				const firstParticipant = conversation.participants[0];

				// Check if it's new structure (has userId field)
				if (firstParticipant && typeof firstParticipant === 'object' && firstParticipant.userId) {
					participant = conversation.participants.find(p => p.userId.toString() === userId.toString());
				} else {
					// Old structure - participant is ObjectId, need to transform
					return true; // For old structure without lastReadMessageId, consider read
				}
			}

			if (!participant || !participant.lastReadMessageId) {
				return false; // No read record = unread
			}

			// Check if the lastReadMessageId is >= the last message (by createdAt)
			const lastReadMessage = await Message.findById(participant.lastReadMessageId).lean();
			if (!lastReadMessage) {
				return false; // Invalid lastReadMessageId = unread
			}

			// If the last read message is newer than or equal to the last message, it's read
			return lastReadMessage.createdAt >= lastMessage.createdAt;
		} catch (error) {
			console.error("Error checking last message read status:", error);
			return true; // Default to read on error
		}
	}

	// Helper method to get enriched last message with read status
	static async getLastMessageWithReadStatus(conversationId, userId) {
		try {
			const lastMessage = await Message.findOne({
				conversationId: conversationId,
				isDeleted: false
			})
				.sort({ createdAt: -1 })
				.lean();

			if (!lastMessage) {
				return null;
			}

			return {
				messageId: lastMessage._id,
				text: lastMessage.text || (lastMessage.attachments && lastMessage.attachments.length > 0 ? "Media" : ""),
				senderId: lastMessage.senderId,
				timestamp: lastMessage.createdAt,
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

			// Get all user's conversations (support both old and new structure)
			const conversations = await Conversation.find({
				$or: [
					{ "participants.userId": userId },
					{ "participants": userId }
				],
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

			// Verify conversation exists and user is participant (support both structures)
			const conversation = await Conversation.findOne({
				_id: conversationId,
				$or: [
					{ "participants.userId": userId },
					{ "participants": userId }
				],
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
			const updateResult = await Message.updateMany(
				{
					conversationId: conversationId,
					readBy: { $nin: [userId] },
					status: { $in: ['delivered', 'sent'] } // Only update messages not already read by user
				},
				{
					$addToSet: { readBy: userId },
					$set: { status: 'read' } // Update status to read
				}
			);

			// Update participant's lastReadMessageId if any messages were marked as read
			if (updateResult.modifiedCount > 0) {
				const lastMessage = await Message.findOne({
					conversationId: conversationId
				}).sort({ createdAt: -1 });

				if (lastMessage) {
					await conversation.updateParticipantLastRead(userId, lastMessage._id);
				}
			}

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

			// Transform participants to new structure
			const participantObjects = createDTO.participants.map(participantId => ({
				userId: participantId,
				lastReadMessageId: null,
				lastReadAt: null,
				joinedAt: new Date()
			}));

			// Add current user if not already included
			const currentUserExists = participantObjects.some(p => p.userId.toString() === userId.toString());
			if (!currentUserExists) {
				participantObjects.push({
					userId: userId,
					lastReadMessageId: null,
					lastReadAt: null,
					joinedAt: new Date()
				});
			}

			if (createDTO.isGroup && !createDTO.admin) {
				createDTO.admin = userId;
			}

			const conversation = new Conversation({
				name: createDTO.name,
				participants: participantObjects,
				isGroup: createDTO.isGroup,
				admin: createDTO.admin,
				groupSettings: createDTO.groupSettings,
				settings: createDTO.settings,
			});

			await conversation.save();

			// After successful conversation creation, add:
			// if (global.socketManager && conversation.participants) {
			// 	conversation.participants.forEach(participantId => {
			// 		global.socketManager.joinConversation(participantId.toString(), conversation._id);
			// 	});
			// }

			if (global.socketService) {
				await global.socketService.sendNewConversation(
					conversation,
					conversation.participants
				);
			}

			// Populate participants
			await conversation.populate("participants.userId", "username avatarUrl email");
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

			// Transform participants to new structure
			const participantObjects = createDTO.participants.map(participantId => ({
				userId: participantId,
				lastReadMessageId: null,
				lastReadAt: null,
				joinedAt: new Date()
			}));

			// Add current user if not already included
			const currentUserExists = participantObjects.some(p => p.userId.toString() === userId.toString());
			if (!currentUserExists) {
				participantObjects.push({
					userId: userId,
					lastReadMessageId: null,
					lastReadAt: null,
					joinedAt: new Date()
				});
			}

			let conversation;

			if (!createDTO.isGroup && participantObjects.length === 2) {
				// Search for 1-1 conversation (check both old and new structure)
				const participantIds = participantObjects.map(p => p.userId);

				// Try new structure first
				conversation = await Conversation.findOne({
					isGroup: false,
					"participants.userId": { $all: participantIds, $size: 2 },
				});

				// Try old structure for backward compatibility
				if (!conversation) {
					conversation = await Conversation.findOne({
						isGroup: false,
						participants: { $all: participantIds, $size: 2 },
					});
				}
			}

			if (!conversation) {
				// Create new conversation
				if (createDTO.isGroup && !createDTO.admin) {
					createDTO.admin = userId;
				}

				conversation = new Conversation({
					name: createDTO.name,
					participants: participantObjects,
					isGroup: createDTO.isGroup,
					admin: createDTO.admin,
					groupSettings: createDTO.groupSettings,
					settings: createDTO.settings,
				});

				await conversation.save();
			} else {
				// Migrate old conversation structure if needed
				conversation = ConversationController.migrateParticipantsStructure(conversation);
			}

			await conversation.populate("participants.userId", "username avatarUrl email");
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
				$or: [
					{ "participants.userId": userId },
					{ "participants": userId }
				],
				isActive: true,
			};

			// Cursor-based pagination: fetch conversations updated before lastUpdatedAt
			if (lastUpdatedAt) {
				matchStage.updatedAt = { ...matchStage.updatedAt, $lt: new Date(lastUpdatedAt) };
			}

			// Simplified approach: Get conversations and handle participant population manually
			const conversations = await Conversation.find(matchStage)
				.sort({ updatedAt: -1 })
				.limit(parsedLimit)
				.populate("admin", "username avatarUrl")
				.lean();

			// Optimize: Collect all participant IDs first to avoid N+1 queries
			const allParticipantIds = new Set();

			conversations.forEach(conversation => {
				if (conversation.participants && conversation.participants.length > 0) {
					const firstParticipant = conversation.participants[0];

					// Check if it's new structure (has userId field)
					if (firstParticipant && typeof firstParticipant === 'object' && firstParticipant.userId) {
						// New structure - participants have userId field
						conversation.participants.forEach(participant => {
							if (participant.userId) {
								allParticipantIds.add(participant.userId.toString());
							}
						});
					} else {
						// Old structure - participants are ObjectIds (string or ObjectId objects)
						conversation.participants.forEach(participantId => {
							// Convert ObjectId to string for consistent handling
							const idString = participantId.toString ? participantId.toString() : participantId;
							allParticipantIds.add(idString);
						});
					}
				}
			});

			// Fetch all users at once
			const allUsers = await User.find({ _id: { $in: Array.from(allParticipantIds) } })
				.select("username avatarUrl email")
				.lean();

			// Create a user lookup map for faster access
			const userMap = new Map();
			allUsers.forEach(user => {
				userMap.set(user._id.toString(), user);
			});

			// Handle participant population for both old and new structures
			conversations.forEach(conversation => {
				if (conversation.participants && conversation.participants.length > 0) {
					const firstParticipant = conversation.participants[0];

					// Check if it's new structure (has userId field)
					if (firstParticipant && typeof firstParticipant === 'object' && firstParticipant.userId) {
						// New structure - participants have userId field
						conversation.participants = conversation.participants.map(participant => ({
							...participant,
							user: userMap.get(participant.userId.toString())
						}));
					} else {
						// Old structure - participants are ObjectIds (string or ObjectId objects)
						conversation.participants = conversation.participants.map(participantId => {
							const idString = participantId.toString ? participantId.toString() : participantId;
							return {
								userId: participantId,
								lastReadMessageId: null,
								lastReadAt: null,
								joinedAt: new Date(),
								user: userMap.get(idString)
							};
						});
					}
				}
			});

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

			// Use the same query logic as getUserConversations for consistency
			const conversation = await Conversation.findOne({
				_id: conversationId,
				$or: [
					{ "participants.userId": userId },
					{ "participants": userId }
				],
				isActive: true,
			})
				.populate("admin", "username avatarUrl")
				.lean();

			if (!conversation) {
				return res.status(404).json(createErrorResponse("conversation.conversationNotFound", null, null, detectLanguage(req)));
			}

			// Handle participant population manually like in getUserConversations
			if (conversation.participants && conversation.participants.length > 0) {
				const firstParticipant = conversation.participants[0];

				// Check if it's new structure (has userId field)
				if (firstParticipant && typeof firstParticipant === 'object' && firstParticipant.userId) {
					// New structure - participants have userId field
					const participantIds = conversation.participants.map(p => p.userId);
					const users = await User.find({ _id: { $in: participantIds } })
						.select("username avatarUrl email")
						.lean();

					// Add user data to existing structure
					conversation.participants = conversation.participants.map(participant => ({
						...participant,
						user: users.find(user => user._id.toString() === participant.userId.toString())
					}));
				} else {
					// Old structure - participants are ObjectIds
					const participantIds = conversation.participants;
					const users = await User.find({ _id: { $in: participantIds } })
						.select("username avatarUrl email")
						.lean();

					// Transform to new structure
					conversation.participants = participantIds.map(participantId => {
						const idString = participantId.toString ? participantId.toString() : participantId;
						return {
							userId: participantId,
							lastReadMessageId: null,
							lastReadAt: null,
							joinedAt: new Date(),
							user: users.find(user => user._id.toString() === idString)
						};
					});
				}
			}

			// Enrich conversation with proper lastMessage including read status
			const lastMessage = await ConversationController.getLastMessageWithReadStatus(conversation._id, userId);
			const enrichedConversation = {
				...conversation,
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
				$or: [
					{ "participants.userId": userId },
					{ "participants": userId }
				],
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
				$or: [
					{ "participants.userId": userId },
					{ "participants": userId }
				],
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
				$or: [
					{ "participants.userId": userId },
					{ "participants": userId }
				],
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
				$or: [
					{ "participants.userId": userId },
					{ "participants": userId }
				],
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
				$or: [
					{ "participants.userId": userId },
					{ "participants": userId }
				],
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
				$or: [
					{ "participants.userId": userId },
					{ "participants": userId }
				],
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
				$or: [
					{ "participants.userId": userId },
					{ "participants": userId }
				],
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
