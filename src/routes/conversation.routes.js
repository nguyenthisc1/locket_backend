import express from "express";
import { ConversationController } from "../controllers/conversation.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

import { CreateConversationDTO, UpdateConversationDTO, AddParticipantDTO, RemoveParticipantDTO, SearchConversationsDTO } from "../dtos/conversation.dto.js";

const router = express.Router();

router.use(authMiddleware);

// Create a new conversation
router.post("/", CreateConversationDTO.validationRules(), ConversationController.createConversation);

// Get user's conversations
router.get("/", ConversationController.getUserConversations);

// Search conversations
router.get("/search", SearchConversationsDTO.validationRules(), ConversationController.searchConversations);

// Get conversation by ID
router.get("/:conversationId", ConversationController.getConversation);

// Update conversation
router.put("/:conversationId", UpdateConversationDTO.validationRules(), ConversationController.updateConversation);

// Add participants to conversation
router.post("/:conversationId/participants", AddParticipantDTO.validationRules(), ConversationController.addParticipants);

// Remove participant from conversation
router.delete("/:conversationId/participants", RemoveParticipantDTO.validationRules(), ConversationController.removeParticipant);

// Get conversation threads
router.get("/:conversationId/threads", ConversationController.getConversationThreads);

// Leave conversation
router.post("/:conversationId/leave", ConversationController.leaveConversation);

// Delete conversation (soft delete)
router.delete("/:conversationId", ConversationController.deleteConversation);

export default router;
