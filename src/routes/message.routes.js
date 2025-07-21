import express from 'express';
import { MessageController } from '../controllers/message.controller.js';
import {
  AddReactionDTO,
  CreateMessageDTO,
  ForwardMessageDTO,
  PinMessageDTO,
  ReplyMessageDTO,
  SearchMessagesDTO,
  ThreadMessagesDTO,
  UpdateMessageDTO
} from '../dtos/message.dto.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

// Send a message
router.post(
  '/',
  CreateMessageDTO.validationRules(),
  MessageController.sendMessage
);

// Get conversation messages
router.get('/conversation/:conversationId', MessageController.getConversationMessages);

// Get message by ID
router.get('/:messageId', MessageController.getMessage);

// Edit message
router.put(
  '/:messageId',
  UpdateMessageDTO.validationRules(),
  MessageController.editMessage
);

// Delete message
router.delete('/:messageId', MessageController.deleteMessage);

// Add reaction to message
router.post(
  '/:messageId/reactions',
  AddReactionDTO.validationRules(),
  MessageController.addReaction
);

// Remove reaction from message
router.delete('/:messageId/reactions', MessageController.removeReaction);

// Reply to message
router.post(
  '/:messageId/reply',
  ReplyMessageDTO.validationRules(),
  MessageController.replyToMessage
);

// Get thread messages
router.get(
  '/:messageId/thread',
  ThreadMessagesDTO.validationRules(),
  MessageController.getThreadMessages
);

// Pin/Unpin message
router.post(
  '/:messageId/pin',
  PinMessageDTO.validationRules(),
  MessageController.pinMessage
);

// Forward messages
router.post(
  '/forward',
  ForwardMessageDTO.validationRules(),
  MessageController.forwardMessages
);

// Search messages
router.get(
  '/search',
  SearchMessagesDTO.validationRules(),
  MessageController.searchMessages
);

export default router; 