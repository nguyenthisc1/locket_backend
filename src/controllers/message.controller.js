import { validationResult } from 'express-validator';
import {
  AddReactionDTO,
  CreateMessageDTO,
  ForwardMessageDTO,
  MessageListResponseDTO,
  MessageResponseDTO,
  PinMessageDTO,
  ReplyMessageDTO,
  SearchMessagesDTO,
  UpdateMessageDTO
} from '../dtos/message.dto.js';
import Conversation from '../models/conversation.model.js';
import Message from '../models/message.model.js';
import { createErrorResponse, createSuccessResponse, createValidationErrorResponse, detectLanguage } from '../utils/translations.js';

export class MessageController {

  static async markConversationAsRead(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user._id;

      // Find the conversation and verify access
      const conversation = await Conversation.findOne({
        _id: conversationId,
        $or: [
          { "participants.userId": userId },
          { "participants": userId }
        ],
        isActive: true
      });

      if (!conversation) {
        return res.status(404).json(createErrorResponse("conversation.conversationNotFound", null, null, detectLanguage(req)));
      }

      // Get the latest message in the conversation
      // Retrieve the latest non-deleted message in the conversation
      const lastMessage = await Message.findOne({
        conversationId: conversationId,
        isDeleted: false
      })
        .sort({ createdAt: -1 });

      if (lastMessage) {
        await conversation.updateParticipantLastRead(userId, lastMessage._id);

        // Update message status to read
        // await Message.updateMany(
        //   {
        //     conversationId,
        //     senderId: { $ne: userId },
        //     _id: { $lte: lastMessage._id },
        //     status: { $ne: "read" }
        //   },
        //   { $set: { status: "read" } }
        // );

        await Message.updateMany(
          {
            conversationId,
            senderId: { $ne: userId },
            createdAt: { $lte: lastMessage.createdAt }, // all messages <= lastMessage
            status: { $ne: "read" }
          },
          { $set: { status: "read" } }
        );
      
      }

      if (global.socketService) {
        // Send a minimal message object for the read receipt
        await global.socketService.markConversationReadReceipt(
          conversation.id,
          lastMessage
            ? {
              messageId: lastMessage._id,
              text: lastMessage.text || (lastMessage.attachments && lastMessage.attachments.length > 0 ? "Media" : ""),
              senderId: lastMessage.senderId,
              timestamp: lastMessage.createdAt,
            }
            : null,
          userId
        );
      }

      res.json(createSuccessResponse("message.messageMarkedAsRead", null, detectLanguage(req)));
    } catch (error) {
      console.error('Mark conversation as read error:', error);
      res.status(500).json(createErrorResponse("message.markAsReadFailed", error.message, null, detectLanguage(req)));
    }
  }

  // Update message status (for delivered, etc.)
  static async updateMessageStatus(req, res) {
    try {
      const { messageId } = req.params;
      const { status } = req.body;
      const userId = req.user._id;

      if (!['sent', 'delivered', 'read'].includes(status)) {
        return res.status(400).json(createErrorResponse("message.invalidStatus", null, null, detectLanguage(req)));
      }

      // Find the message and verify user access
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json(createErrorResponse("message.messageNotFound", null, null, detectLanguage(req)));
      }

      // Check if user has access to this message's conversation
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        $or: [
          { "participants.userId": userId },
          { "participants": userId }
        ],
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json(createErrorResponse("message.unauthorizedAccess", null, null, detectLanguage(req)));
      }

      // Update status
      await message.updateStatus(status);

      // If status is 'read', update participant's lastReadMessageId in conversation
      if (status === 'read') {
        const conversation = await Conversation.findOne({
          _id: message.conversationId,
          $or: [
            { "participants.userId": userId },
            { "participants": userId }
          ],
          isActive: true
        });

        if (conversation) {
          await conversation.updateParticipantLastRead(userId, messageId);
        }
      }

      // Send socket event for status update
      if (global.socketService) {
        await global.socketService.sendMessageStatusUpdate(
          messageId,
          message.conversationId,
          status,
          userId
        );
      }

      res.json(createSuccessResponse("message.statusUpdated", { messageId, status }, detectLanguage(req)));
    } catch (error) {
      console.error('Update message status error:', error);
      res.status(500).json(createErrorResponse("message.statusUpdateFailed", error.message, null, detectLanguage(req)));
    }
  }

  // Send a message
  static async sendMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
      }

      const createDTO = new CreateMessageDTO(req.body);
      console.log('message DTO response', createDTO)
      const userId = req.user._id;

      // Verify conversation exists and user is participant
      const conversation = await Conversation.findOne({
        _id: createDTO.conversationId,
        $or: [
          { "participants.userId": userId },
          { "participants": userId }
        ],
        isActive: true
      });

      if (!conversation) {
        return res.status(404).json(createErrorResponse("message.conversationNotFound", null, null, detectLanguage(req)));
      }

      // Handle reply message
      let replyInfo = null;
      if (createDTO.replyTo) {
        const replyMessage = await Message.findOne({
          _id: createDTO.replyTo,
          conversationId: createDTO.conversationId,
          isDeleted: false
        });

        if (replyMessage) {
          replyInfo = {
            messageId: replyMessage._id,
            text: replyMessage.text || 'Media',
            senderName: 'User', // Since senderId is no longer populated, we use a generic name
            attachmentType: replyMessage.attachments?.[0]?.type
          };
        }
      }

      // Handle forwarded message
      let forwardInfo = null;
      if (createDTO.forwardedFrom) {
        forwardInfo = {
          originalMessageId: createDTO.forwardInfo?.originalMessageId,
          originalSenderId: createDTO.forwardedFrom,
          originalSenderName: createDTO.forwardInfo?.originalSenderName,
          originalConversationId: createDTO.forwardInfo?.originalConversationId,
          originalConversationName: createDTO.forwardInfo?.originalConversationName,
          forwardedAt: new Date()
        };
      }

      // Handle thread message
      let threadInfo = null;
      if (createDTO.threadInfo?.parentMessageId) {
        const parentMessage = await Message.findOne({
          _id: createDTO.threadInfo.parentMessageId,
          isDeleted: false
        });

        if (parentMessage) {
          threadInfo = {
            parentMessageId: parentMessage._id,
            replyCount: 0,
            lastReplyAt: new Date(),
            participants: [userId]
          };
        }
      }

      const message = new Message({
        conversationId: createDTO.conversationId,
        senderId: userId,
        text: createDTO.text,
        type: createDTO.type,
        attachments: createDTO.attachments,
        replyTo: createDTO.replyTo,
        replyInfo,
        forwardedFrom: createDTO.forwardedFrom,
        forwardInfo,
        threadInfo,
        status: 'sent',
        metadata: {
          ...createDTO.metadata,
          clientMessageId: createDTO.metadata?.clientMessageId,
          deviceId: createDTO.metadata?.deviceId,
          platform: createDTO.metadata?.platform
        },
        sticker: createDTO.sticker,
        emote: createDTO.emote
      });

      await message.save();

      // Populate message data
      await message.populate('replyTo');
      await message.populate('forwardedFrom');

      // Prepare response DTO for the new message
      const response = MessageResponseDTO.fromMessage(message);

      // Update the conversation's last message reference
      await conversation.updateLastMessage(message);

      // Mark the message as read for the sender (since they sent it)
      await conversation.updateParticipantLastRead(userId, message._id);

      // Prepare the last message payload for sidebar/conversation list updates
      const lastMessagePayload = {
        conversationId: conversation._id,
        lastMessage: {
          messageId: message._id,
          text: message.text || (message.attachments?.length ? 'Media' : ''),
          senderId: message.senderId,
          timestamp: message.createdAt,
        },
        updatedAt: new Date()
      };

      // Emit socket events if socketService is available
      if (global.socketService) {
        // Notify chat detail screen participants of the new message
        await global.socketService.sendNewMessage(
          message.conversationId,
          response.toJSON(),
          message.senderId
        );

        // Notify conversation list (sidebar) of the last message update
        await global.socketService.sendConversationUpdate(
          message.conversationId,
          lastMessagePayload,
          message.senderId
        );
      }

      // Update the message status to 'delivered'
      
      await message.updateStatus('delivered');
      
      // Emit a message status update event
      if (global.socketService) {
              // Introduce a short delay before updating the message status to 'delivered'
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        await global.socketService.sendMessageUpdate(
          message.conversationId,
          MessageResponseDTO.fromMessage(message).toJSON()
        );
      }

      // Debug log for message response DTO
      console.log('[MessageController] Message sent:', MessageResponseDTO.fromMessage(message).toJSON());

      // Update thread info if this is a thread message
      if (threadInfo) {
        await Message.updateOne(
          { _id: threadInfo.parentMessageId },
          {
            $inc: { 'threadInfo.replyCount': 1 },
            $set: { 'threadInfo.lastReplyAt': new Date() },
            $addToSet: { 'threadInfo.participants': userId }
          }
        );
      }

      res.status(201).json(createSuccessResponse("message.messageSent", response.toJSON(), detectLanguage(req)));
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json(createErrorResponse("message.messageSendFailed", error.message, null, detectLanguage(req)));
    }
  }

  // Get conversation messages
  // static async getConversationMessages(req, res) {
  //   try {
  //     const { conversationId } = req.params;
  //     const userId = req.user._id;
  //     const { page = 1, limit = 50 } = req.query;
  //     const skip = (page - 1) * limit;

  //     // Verify conversation access
  //     const conversation = await Conversation.findOne({
  //       _id: conversationId,
  //       participants: userId,
  //       isActive: true
  //     });

  //     if (!conversation) {
  //       return res.status(404).json(createErrorResponse("message.conversationNotFound", null, null, detectLanguage(req)));
  //     }

  //     const messages = await Message.getConversationMessages(conversationId, parseInt(limit), skip);

  //     const total = await Message.countDocuments({
  //       conversationId,
  //       isDeleted: false
  //     });

  //     const pagination = {
  //       page: parseInt(page),
  //       limit: parseInt(limit),
  //       total,
  //       pages: Math.ceil(total / limit)
  //     };

  //     const response = MessageListResponseDTO.fromMessages(messages, pagination);

  //     res.json(createSuccessResponse("message.messagesRetrieved", response.toJSON(), detectLanguage(req)));
  //   } catch (error) {
  //     console.error('Get messages error:', error);
  //     res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
  //   }
  // }

  static async getConversationMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user._id;
      const { limit = 50, lastCreatedAt } = req.query;
      const parsedLimit = parseInt(limit);

      // Verify conversation access (support both old and new participant structures)
      const conversation = await Conversation.findOne({
        _id: conversationId,
        $or: [
          { "participants.userId": userId },
          { "participants": userId }
        ],
        isActive: true
      });

      if (!conversation) {
        return res.status(404).json(createErrorResponse("message.conversationNotFound", null, null, detectLanguage(req)));
      }

      // Fetch messages with cursor-based pagination
      const messages = await Message.getConversationMessagesCursor(conversationId, parsedLimit, lastCreatedAt);

      // Check if there are more messages (for hasNextPage)
      const hasNextPage = messages.length === parsedLimit;
      const nextCursor = hasNextPage ? messages[messages.length - 1].createdAt : null;

      const pagination = {
        limit: parsedLimit,
        hasNextPage,
        nextCursor,
      };

      const response = MessageListResponseDTO.fromMessages(messages, pagination);

      res.json(createSuccessResponse("message.messagesRetrieved", response.toJSON(), detectLanguage(req)));
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
    }
  }


  // Get message by ID
  static async getMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user._id;

      const message = await Message.findOne({
        _id: messageId,
        isDeleted: false
      })
        .populate('replyTo')
        .populate('replyInfo.messageId')
        .populate('forwardedFrom')
        .populate('forwardInfo.originalSenderId');
      console.log("🚀 ~ MessageController ~ getMessage ~ message:", message)

      if (!message) {
        return res.status(404).json(createErrorResponse("message.messageNotFound", null, null, detectLanguage(req)));
      }

      // Check if user has access to this message
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        $or: [
          { "participants.userId": userId },
          { "participants": userId }
        ],
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json(createErrorResponse("message.unauthorizedAccess", null, null, detectLanguage(req)));
      }

      const response = MessageResponseDTO.fromMessage(message);

      res.json(createSuccessResponse("message.messageRetrieved", response.toJSON(), detectLanguage(req)));
    } catch (error) {
      console.error('Get message error:', error);
      res.status(500).json(createErrorResponse("message.messageRetrievedFailed", error.message, null, detectLanguage(req)));
    }
  }

  // Edit message
  static async editMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
      }

      const { messageId } = req.params;
      const userId = req.user._id;
      const updateDTO = new UpdateMessageDTO(req.body);

      let message;
      try {
        message = await Message.findOne({
          _id: messageId,
          senderId: userId,
          isDeleted: false
        });
      } catch (err) {
        if (err.name === 'CastError') {
          return res.status(400).json(createErrorResponse("message.invalidMessageId", null, null, detectLanguage(req)));
        }
        throw err;
      }

      if (!message) {
        return res.status(404).json(createErrorResponse("message.cannotEditOthersMessage", null, null, detectLanguage(req)));
      }

      // Check if message is too old to edit (e.g., 15 minutes)
      const editTimeLimit = 15 * 60 * 1000; // 15 minutes in milliseconds
      if (Date.now() - message.createdAt.getTime() > editTimeLimit) {
        return res.status(400).json(createErrorResponse("message.messageUpdateFailed", "Message is too old to edit", null, detectLanguage(req)));
      }

      await message.editMessage(updateDTO.text);

      const response = MessageResponseDTO.fromMessage(message);

      res.json(createSuccessResponse("message.messageUpdated", response.toJSON(), detectLanguage(req)));
    } catch (error) {
      console.error('Edit message error:', error);
      res.status(500).json(createErrorResponse("message.messageUpdateFailed", error.message, null, detectLanguage(req)));
    }
  }

  // Delete message
  static async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user._id;

      const message = await Message.findOne({
        _id: messageId,
        senderId: userId,
        isDeleted: false
      });

      if (!message) {
        return res.status(404).json(createErrorResponse("message.cannotDeleteOthersMessage", null, null, detectLanguage(req)));
      }

      await message.deleteMessage();

      res.json(createSuccessResponse("message.messageDeleted", null, detectLanguage(req)));
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json(createErrorResponse("message.messageDeleteFailed", error.message, null, detectLanguage(req)));
    }
  }

  // Add reaction to message
  static async addReaction(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
      }

      const { messageId } = req.params;
      const userId = req.user._id;
      const addDTO = new AddReactionDTO(req.body);

      let message;
      try {
        message = await Message.findOne({
          _id: messageId,
          isDeleted: false
        });
      } catch (err) {
        if (err.name === 'CastError') {
          return res.status(400).json(createErrorResponse("message.invalidMessageId", null, null, detectLanguage(req)));
        }
        throw err;
      }

      if (!message) {
        return res.status(404).json(createErrorResponse("message.messageNotFound", null, null, detectLanguage(req)));
      }

      // Check if user has access to this message
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        $or: [
          { "participants.userId": userId },
          { "participants": userId }
        ],
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json(createErrorResponse("message.unauthorizedAccess", null, null, detectLanguage(req)));
      }

      await message.addReaction(userId, addDTO.reactionType);

      const response = MessageResponseDTO.fromMessage(message);

      res.json(createSuccessResponse("message.reactionAdded", response.toJSON(), detectLanguage(req)));
    } catch (error) {
      console.error('Add reaction error:', error);
      res.status(500).json(createErrorResponse("message.reactionFailed", error.message, null, detectLanguage(req)));
    }
  }

  // Remove reaction from message
  static async removeReaction(req, res) {
    try {
      const { messageId, reactionType } = req.params;
      const userId = req.user._id;

      let message;
      try {
        message = await Message.findOne({
          _id: messageId,
          isDeleted: false
        });
      } catch (err) {
        if (err.name === 'CastError') {
          return res.status(400).json(createErrorResponse("message.invalidMessageId", null, null, detectLanguage(req)));
        }
        throw err;
      }

      if (!message) {
        return res.status(404).json(createErrorResponse("message.messageNotFound", null, null, detectLanguage(req)));
      }

      // Check if user has access to this message
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        $or: [
          { "participants.userId": userId },
          { "participants": userId }
        ],
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json(createErrorResponse("message.unauthorizedAccess", null, null, detectLanguage(req)));
      }

      await message.removeReaction(userId, reactionType);

      const response = MessageResponseDTO.fromMessage(message);

      res.json(createSuccessResponse("message.reactionRemoved", response.toJSON(), detectLanguage(req)));
    } catch (error) {
      console.error('Remove reaction error:', error);
      res.status(500).json(createErrorResponse("message.reactionFailed", error.message, null, detectLanguage(req)));
    }
  }

  // Forward messages
  static async forwardMessages(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
      }

      const forwardDTO = new ForwardMessageDTO(req.body);
      const userId = req.user._id;

      // Verify target conversation exists and user is participant
      const targetConversation = await Conversation.findOne({
        _id: forwardDTO.targetConversationId,
        $or: [
          { "participants.userId": userId },
          { "participants": userId }
        ],
        isActive: true
      });

      if (!targetConversation) {
        return res.status(404).json(createErrorResponse("message.conversationNotFound", null, null, detectLanguage(req)));
      }

      const forwardedMessages = [];

      for (const messageId of forwardDTO.messageIds) {
        try {
          const originalMessage = await Message.findOne({
            _id: messageId,
            isDeleted: false
          });

          if (!originalMessage) {
            continue; // Skip if message not found
          }

          // Check if user has access to original message
          const originalConversation = await Conversation.findOne({
            _id: originalMessage.conversationId,
            $or: [
              { "participants.userId": userId },
              { "participants": userId }
            ],
            isActive: true
          });

          if (!originalConversation) {
            continue; // Skip if no access to original message
          }

          // Create forwarded message
          const forwardedMessage = new Message({
            conversationId: forwardDTO.targetConversationId,
            senderId: userId,
            text: originalMessage.text,
            type: originalMessage.type,
            attachments: originalMessage.attachments,
            forwardInfo: {
              originalMessageId: originalMessage._id,
              originalSenderId: originalMessage.senderId,
              originalSenderName: 'User', // Since senderId is no longer populated, we use a generic name
              originalConversationId: originalMessage.conversationId,
              originalConversationName: originalConversation.name,
              forwardedAt: new Date()
            },
            metadata: {
              clientMessageId: `forward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              deviceId: req.headers['device-id'] || 'unknown',
              platform: req.headers['platform'] || 'unknown'
            }
          });

          await forwardedMessage.save();

          const messageResponse = MessageResponseDTO.fromMessage(forwardedMessage);
          forwardedMessages.push(messageResponse.toJSON());
        } catch (error) {
          console.error(`Error forwarding message ${messageId}:`, error);
          // Continue with other messages
        }
      }

      // Update target conversation's last message
      if (forwardedMessages.length > 0) {
        await targetConversation.updateLastMessage(forwardedMessages[forwardedMessages.length - 1]);
      }

      res.json(createSuccessResponse("message.messageForwarded", { messages: forwardedMessages }, detectLanguage(req)));
    } catch (error) {
      console.error('Forward messages error:', error);
      res.status(500).json(createErrorResponse("message.forwardFailed", error.message, null, detectLanguage(req)));
    }
  }

  // Reply to message
  static async replyToMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
      }

      const { messageId } = req.params;
      const userId = req.user._id;
      const replyDTO = new ReplyMessageDTO(req.body);

      // Find the parent message
      const parentMessage = await Message.findOne({
        _id: messageId,
        isDeleted: false
      });

      if (!parentMessage) {
        return res.status(404).json(createErrorResponse("message.parentMessageNotFound", null, null, detectLanguage(req)));
      }

      // Check if user has access to the parent message
      const conversation = await Conversation.findOne({
        _id: parentMessage.conversationId,
        $or: [
          { "participants.userId": userId },
          { "participants": userId }
        ],
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json(createErrorResponse("message.unauthorizedAccess", null, null, detectLanguage(req)));
      }

      // Create reply message
      const replyMessage = new Message({
        conversationId: parentMessage.conversationId,
        senderId: userId,
        text: replyDTO.text,
        type: replyDTO.type || 'text',
        attachments: replyDTO.attachments,
        replyTo: parentMessage._id,
        replyInfo: {
          messageId: parentMessage._id,
          text: parentMessage.text || 'Media',
          senderName: 'User', // Since senderId is no longer populated, we use a generic name
          attachmentType: parentMessage.attachments?.[0]?.type
        },
        threadInfo: {
          parentMessageId: parentMessage._id,
          replyCount: 0,
          lastReplyAt: new Date(),
          participants: [userId]
        },
        metadata: {
          clientMessageId: replyDTO.metadata?.clientMessageId,
          deviceId: replyDTO.metadata?.deviceId,
          platform: replyDTO.metadata?.platform
        }
      });

      await replyMessage.save();

      // Update parent message's thread info
      await Message.updateOne(
        { _id: parentMessage._id },
        {
          $inc: { 'threadInfo.replyCount': 1 },
          $set: { 'threadInfo.lastReplyAt': new Date() },
          $addToSet: { 'threadInfo.participants': userId }
        }
      );

      // Update conversation's last message
      await conversation.updateLastMessage(replyMessage);

      // Auto-mark the reply message as read for the sender
      await conversation.updateParticipantLastRead(userId, replyMessage._id);

      await replyMessage.populate('replyTo');

      const response = MessageResponseDTO.fromMessage(replyMessage);

      res.status(201).json(createSuccessResponse("message.messageReplied", response.toJSON(), detectLanguage(req)));
    } catch (error) {
      console.error('Reply to message error:', error);
      res.status(500).json(createErrorResponse("message.replyFailed", error.message, null, detectLanguage(req)));
    }
  }

  // Get thread messages
  static async getThreadMessages(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user._id;
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      // Find the parent message
      const parentMessage = await Message.findOne({
        _id: messageId,
        isDeleted: false
      });

      if (!parentMessage) {
        return res.status(404).json(createErrorResponse("message.parentMessageNotFound", null, null, detectLanguage(req)));
      }

      // Check if user has access to the parent message
      const conversation = await Conversation.findOne({
        _id: parentMessage.conversationId,
        $or: [
          { "participants.userId": userId },
          { "participants": userId }
        ],
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json(createErrorResponse("message.unauthorizedAccess", null, null, detectLanguage(req)));
      }

      // Get thread messages
      const threadMessages = await Message.find({
        replyTo: messageId,
        isDeleted: false
      })
        .populate('replyTo')
        .sort({ createdAt: 1 })
        .limit(parseInt(limit))
        .skip(skip);

      const total = await Message.countDocuments({
        replyTo: messageId,
        isDeleted: false
      });

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      };

      const response = MessageListResponseDTO.fromMessages(threadMessages, pagination);

      res.json(createSuccessResponse("message.threadMessagesRetrieved", response.toJSON(), detectLanguage(req)));
    } catch (error) {
      console.error('Get thread messages error:', error);
      res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
    }
  }

  // Search messages
  static async searchMessages(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
      }

      const searchDTO = new SearchMessagesDTO(req.query);
      const userId = req.user._id;
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      // Get user's conversations
      const userConversations = await Conversation.find({
        $or: [
          { "participants.userId": userId },
          { "participants": userId }
        ],
        isActive: true
      }).select('_id');

      const conversationIds = userConversations.map(conv => conv._id);

      let searchQuery = {
        conversationId: { $in: conversationIds },
        isDeleted: false
      };

      if (searchDTO.query) {
        searchQuery.text = { $regex: searchDTO.query, $options: 'i' };
      }

      if (searchDTO.conversationId) {
        searchQuery.conversationId = searchDTO.conversationId;
      }

      if (searchDTO.senderId) {
        searchQuery.senderId = searchDTO.senderId;
      }

      if (searchDTO.type) {
        searchQuery.type = searchDTO.type;
      }

      if (searchDTO.dateFrom || searchDTO.dateTo) {
        searchQuery.createdAt = {};
        if (searchDTO.dateFrom) {
          searchQuery.createdAt.$gte = new Date(searchDTO.dateFrom);
        }
        if (searchDTO.dateTo) {
          searchQuery.createdAt.$lte = new Date(searchDTO.dateTo);
        }
      }

      const messages = await Message.find(searchQuery)
        .populate('conversationId', 'name')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip);

      const total = await Message.countDocuments(searchQuery);

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      };

      const response = MessageListResponseDTO.fromMessages(messages, pagination);

      res.json(createSuccessResponse("message.searchResults", response.toJSON(), detectLanguage(req)));
    } catch (error) {
      console.error('Search messages error:', error);
      res.status(500).json(createErrorResponse("message.searchFailed", error.message, null, detectLanguage(req)));
    }
  }

  // Pin/Unpin message
  static async pinMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
      }

      const { messageId } = req.params;
      const userId = req.user._id;
      const pinDTO = new PinMessageDTO(req.body);

      const message = await Message.findOne({
        _id: messageId,
        isDeleted: false
      });

      if (!message) {
        return res.status(404).json(createErrorResponse("message.messageNotFound", null, null, detectLanguage(req)));
      }

      // Check if user has access to this message
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        $or: [
          { "participants.userId": userId },
          { "participants": userId }
        ],
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json(createErrorResponse("message.unauthorizedAccess", null, null, detectLanguage(req)));
      }

      // Check if user is admin for group conversations
      if (conversation.isGroup && !conversation.admin.equals(userId)) {
        return res.status(403).json(createErrorResponse("message.unauthorizedAccess", null, null, detectLanguage(req)));
      }

      if (pinDTO.pinned) {
        // Pin message
        await Message.updateOne(
          { _id: messageId },
          { $addToSet: { pinnedBy: userId } }
        );
        res.json(createSuccessResponse("message.messagePinned", null, detectLanguage(req)));
      } else {
        // Unpin message
        await Message.updateOne(
          { _id: messageId },
          { $pull: { pinnedBy: userId } }
        );
        res.json(createSuccessResponse("message.messageUnpinned", null, detectLanguage(req)));
      }
    } catch (error) {
      console.error('Pin/Unpin message error:', error);
      res.status(500).json(createErrorResponse("message.pinFailed", error.message, null, detectLanguage(req)));
    }
  }
} 