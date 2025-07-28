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
import { createSuccessResponse, createErrorResponse, createValidationErrorResponse, detectLanguage } from "../utils/translations.js";

export class ConversationController {
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

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants);

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

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants);

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
			const { page = 1, limit = 20 } = req.query;
			const skip = (page - 1) * limit;

			const conversations = await Conversation.find({
				participants: userId,
				isActive: true,
			})
				.populate("participants", "username avatarUrl email")
				.populate("admin", "username avatarUrl")
				.sort({ updatedAt: -1 })
				.limit(parseInt(limit))
				.skip(skip);

			const total = await Conversation.countDocuments({
				participants: userId,
				isActive: true,
			});

			const totalPages = Math.ceil(total / limit);

			const pagination = {
				currentPage: parseInt(page),
				totalPages,
				totalConversations: total,
				hasNextPage: page < totalPages,
				hasPrevPage: page > 1,
			};

			const conversationListResponse = ConversationListResponseDTO.fromConversations(conversations, pagination);

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

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants);

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

			const response = ConversationResponseDTO.fromConversation(updatedConversation, updatedConversation.participants);

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
			const participants = await User.find({ _id: { $in: addDTO.participantIds } });
			if (participants.length !== addDTO.participantIds.length) {
				return res.status(400).json(createErrorResponse("user.userNotFound", null, null, detectLanguage(req)));
			}

			// Check if participants are already in conversation
			const existingParticipants = conversation.participants.filter((p) => addDTO.participantIds.includes(p.toString()));
			if (existingParticipants.length > 0) {
				return res.status(400).json(createErrorResponse("conversation.participantAlreadyExists", null, null, detectLanguage(req)));
			}

			// Add participants
			conversation.participants.push(...addDTO.participantIds);
			await conversation.save();

			await conversation.populate("participants", "username avatarUrl email");
			await conversation.populate("admin", "username avatarUrl");

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants);

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
			if (removeDTO.participantId === userId.toString()) {
				return res.status(400).json(createErrorResponse("conversation.cannotRemoveSelf", null, null, detectLanguage(req)));
			}

			// Check if participant exists in conversation
			const participantIndex = conversation.participants.findIndex((p) => p.toString() === removeDTO.participantId);
			if (participantIndex === -1) {
				return res.status(404).json(createErrorResponse("conversation.participantNotFound", null, null, detectLanguage(req)));
			}

			// Remove participant
			conversation.participants.splice(participantIndex, 1);
			await conversation.save();

			await conversation.populate("participants", "username avatarUrl email");
			await conversation.populate("admin", "username avatarUrl");

			const response = ConversationResponseDTO.fromConversation(conversation, conversation.participants);

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

			const conversationListResponse = ConversationListResponseDTO.fromConversations(conversations, pagination);

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
