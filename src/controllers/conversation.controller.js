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
import User from "../models/user.model.js";
import mongoose from "mongoose";

export class ConversationController {
	// Create a new conversation
	static async createConversation(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
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

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants);

			res.status(201).json({
				success: true,
				message: "Conversation created successfully",
				data: response.toJSON(),
			});
		} catch (error) {
			console.error("Create conversation error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to create conversation",
				error: error.message,
			});
		}
	}

	// Get or create conversation when first send message
	static async getOrCreateConversation(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
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

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants);

			res.status(200).json({
				success: true,
				message: conversation.isNew ? "Conversation created" : "Conversation fetched",
				data: response.toJSON(),
			});
		} catch (error) {
			console.error("Get or create conversation error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to get or create conversation",
				error: error.message,
			});
		}
	}

	// Get user's conversations
	static async getUserConversations(req, res) {
		try {
			const userId = req.user._id;
			const { page = 1, limit = 20 } = req.query;
			const skip = (page - 1) * limit;

			const conversations = await Conversation.find({
				participants: userId,
				isActive: true,
			})
				.sort({ "lastMessage.timestamp": -1, updatedAt: -1 })
				.skip(skip)
				.limit(parseInt(limit))
				.populate("participants", "username avatarUrl email")
				.populate("admin", "username avatarUrl")
				.populate("lastMessage.messageId")
				.populate("lastMessage.senderId", "username avatarUrl");

			const total = await Conversation.countDocuments({
				participants: userId,
				isActive: true,
			});

			const pagination = {
				page: parseInt(page),
				limit: parseInt(limit),
				total,
				pages: Math.ceil(total / limit),
			};

			const response = ConversationListResponseDTO.fromConversations(conversations, pagination);

			res.json({
				success: true,
				message: "Conversations retrieved successfully",
				data: response.toJSON(),
			});
		} catch (error) {
			console.error("Get conversations error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to retrieve conversations",
				error: error.message,
			});
		}
	}

	// Get conversation by ID
	static async getConversation(req, res) {
		try {
			const { conversationId } = req.params;
			const userId = req.user._id;

			// Convert string ID to ObjectId
			const objectId = new mongoose.Types.ObjectId(conversationId);

			const conversation = await Conversation.findOne({
				_id: objectId,
				participants: userId,
				isActive: true,
			})
				.populate("participants", "username avatarUrl email")
				.populate("admin", "username avatarUrl")
				.populate("readReceipts.userId", "username avatarUrl");

			if (!conversation) {
				return res.status(404).json({
					success: false,
					message: "Conversation not found",
				});
			}

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants);

			res.json({
				success: true,
				message: "Conversation retrieved successfully",
				data: response.toJSON(),
			});
		} catch (error) {
			console.error("Get conversation error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to retrieve conversation",
				error: error.message,
			});
		}
	}

	// Update conversation
	static async updateConversation(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
			}

			const { conversationId } = req.params;
			const userId = req.user._id;
			const updateDTO = new UpdateConversationDTO(req.body);

			const conversation = await Conversation.findOne({
				_id: conversationId,
				participants: userId,
				isActive: true,
			});

			if (!conversation) {
				return res.status(404).json({
					success: false,
					message: "Conversation not found",
				});
			}

			// Check permissions for group settings
			if (conversation.isGroup && !conversation.admin.equals(userId)) {
				if (updateDTO.groupSettings) {
					return res.status(403).json({
						success: false,
						message: "Only admin can update group settings",
					});
				}
			}

			const updateData = updateDTO.toUpdateData();
			Object.assign(conversation, updateData);
			await conversation.save();

			await conversation.populate("participants", "username avatarUrl email");
			await conversation.populate("admin", "username avatarUrl");

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants);

			res.json({
				success: true,
				message: "Conversation updated successfully",
				data: response.toJSON(),
			});
		} catch (error) {
			console.error("Update conversation error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to update conversation",
				error: error.message,
			});
		}
	}

	// Add participants to conversation
	static async addParticipants(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
			}

			const { conversationId } = req.params;
			const userId = req.user._id;
			const addDTO = new AddParticipantDTO(req.body);

			const conversation = await Conversation.findOne({
				_id: conversationId,
				participants: userId,
				isActive: true,
			});

			if (!conversation) {
				return res.status(404).json({
					success: false,
					message: "Conversation not found",
				});
			}

			// Check if user can add participants
			if (conversation.isGroup && !conversation.admin.equals(userId)) {
				if (!conversation.groupSettings.allowMemberInvite) {
					return res.status(403).json({
						success: false,
						message: "You do not have permission to add participants",
					});
				}
			}

			// Verify users exist
			const users = await User.find({ _id: { $in: addDTO.userIds } });
			if (users.length !== addDTO.userIds.length) {
				return res.status(400).json({
					success: false,
					message: "Some users not found",
				});
			}

			// Add participants
			for (const userIdToAdd of addDTO.userIds) {
				await conversation.addParticipant(userIdToAdd);
			}

			await conversation.populate("participants", "username avatarUrl email");

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants);

			res.json({
				success: true,
				message: "Participants added successfully",
				data: response.toJSON(),
			});
		} catch (error) {
			console.error("Add participants error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to add participants",
				error: error.message,
			});
		}
	}

	// Remove participant from conversation
	static async removeParticipant(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
			}
			
			const { conversationId } = req.params;
			const userId = req.user._id;
			const removeDTO = new RemoveParticipantDTO(req.body);
			
			const conversation = await Conversation.findOne({
				_id: conversationId,
				participants: userId,
				isActive: true,
			});

			if (!conversation) {
				return res.status(404).json({
					success: false,
					message: "Conversation not found",
				});
			}

			// Check permissions
			if (conversation.isGroup && !conversation.admin.equals(userId)) {
				if (!conversation.groupSettings.allowMemberEdit) {
					return res.status(403).json({
						success: false,
						message: "You do not have permission to remove participants",
					});
				}
			}

			// Cannot remove admin from group
			if (conversation.isGroup && conversation.admin.equals(removeDTO.userId)) {
				return res.status(400).json({
					success: false,
					message: "Cannot remove admin from group",
				});
			}

			await conversation.removeParticipant(removeDTO.userId);

			await conversation.populate("participants", "username avatarUrl email");

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants);

			res.json({
				success: true,
				message: "Participant removed successfully",
				data: response.toJSON(),
			});
		} catch (error) {
			console.error("Remove participant error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to remove participant",
				error: error.message,
			});
		}
	}

	// Search conversations
	static async searchConversations(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: errors.array(),
				});
			}

			const userId = req.user._id;
			const searchDTO = new SearchConversationsDTO(req.query);
			const skip = (searchDTO.page - 1) * searchDTO.limit;

			let query = {
				participants: userId,
				isActive: true,
			};

			if (searchDTO.query) {
				query.name = { $regex: searchDTO.query, $options: "i" };
			}

			if (searchDTO.isGroup !== undefined) {
				query.isGroup = searchDTO.isGroup;
			}

			const conversations = await Conversation.find(query)
				.sort({ "lastMessage.timestamp": -1, updatedAt: -1 })
				.skip(skip)
				.limit(searchDTO.limit)
				.populate("participants", "username avatarUrl email")
				.populate("admin", "username avatarUrl")
				.populate("lastMessage.messageId")
				.populate("lastMessage.senderId", "username avatarUrl");

			const total = await Conversation.countDocuments(query);

			const pagination = {
				page: searchDTO.page,
				limit: searchDTO.limit,
				total,
				pages: Math.ceil(total / searchDTO.limit),
			};

			const response = ConversationListResponseDTO.fromConversations(conversations, pagination);

			res.json({
				success: true,
				message: "Conversations found successfully",
				data: response.toJSON(),
			});
		} catch (error) {
			console.error("Search conversations error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to search conversations",
				error: error.message,
			});
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
				return res.status(404).json({
					success: false,
					message: "Conversation not found",
				});
			}

			const threads = await Conversation.find({
				parentConversation: conversationId,
				isActive: true,
			})
				.sort({ "threadInfo.lastThreadMessage": -1 })
				.skip(skip)
				.limit(parseInt(limit))
				.populate("participants", "username avatarUrl email")
				.populate("threadInfo.parentMessageId")
				.populate("lastMessage.messageId")
				.populate("lastMessage.senderId", "username avatarUrl");

			const total = await Conversation.countDocuments({
				parentConversation: conversationId,
				isActive: true,
			});

			const pagination = {
				page: parseInt(page),
				limit: parseInt(limit),
				total,
				pages: Math.ceil(total / limit),
			};

			const response = ConversationListResponseDTO.fromConversations(threads, pagination);

			res.json({
				success: true,
				message: "Threads retrieved successfully",
				data: response.toJSON(),
			});
		} catch (error) {
			console.error("Get threads error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to retrieve threads",
				error: error.message,
			});
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
				return res.status(404).json({
					success: false,
					message: "Conversation not found",
				});
			}

			// Cannot leave if you're the only participant
			if (conversation.participants.length === 1) {
				return res.status(400).json({
					success: false,
					message: "Cannot leave conversation with only one participant",
				});
			}

			// If admin leaves group, transfer admin to another participant
			if (conversation.isGroup && conversation.admin.equals(userId)) {
				const newAdmin = conversation.participants.find((p) => p.toString() !== userId);
				if (newAdmin) {
					conversation.admin = newAdmin;
				}
			}

			await conversation.removeParticipant(userId);

			res.json({
				success: true,
				message: "Left conversation successfully",
			});
		} catch (error) {
			console.error("Leave conversation error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to leave conversation",
				error: error.message,
			});
		}
	}

	// Delete conversation (soft delete)
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
				return res.status(404).json({
					success: false,
					message: "Conversation not found",
				});
			}

			// Only admin can delete group conversations
			if (conversation.isGroup && !conversation.admin.equals(userId)) {
				return res.status(403).json({
					success: false,
					message: "Only admin can delete group conversation",
				});
			}

			conversation.isActive = false;
			await conversation.save();

			res.json({
				success: true,
				message: "Conversation deleted successfully",
			});
		} catch (error) {
			console.error("Delete conversation error:", error);
			res.status(500).json({
				success: false,
				message: "Failed to delete conversation",
				error: error.message,
			});
		}
	}
}
