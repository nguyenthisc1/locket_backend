import Message from '../models/message.model.js';
import Conversation from '../models/conversation.model.js';
import User from '../models/user.model.js';
import {
  MessageDTO,
  CreateMessageDTO,
  UpdateMessageDTO,
  AddReactionDTO,
  RemoveReactionDTO,
  ForwardMessageDTO,
  ReplyMessageDTO,
  MessageResponseDTO,
  MessageListResponseDTO,
  SearchMessagesDTO,
  ThreadMessagesDTO,
  PinMessageDTO
} from '../dtos/message.dto.js';
import { validationResult } from 'express-validator';

export class MessageController {
  // Send a message
  static async sendMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const createDTO = new CreateMessageDTO(req.body);
      const { userId } = req.user;

      // Verify conversation exists and user is participant
      const conversation = await Conversation.findOne({
        _id: createDTO.conversationId,
        participants: userId,
        isActive: true
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found or access denied'
        });
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
            senderName: replyMessage.senderId.username,
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

      // Update conversation's last message
      await conversation.updateLastMessage(message);

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

      // Populate message data
      await message.populate('senderId', 'username avatarUrl');
      await message.populate('replyTo');
      await message.populate('forwardedFrom', 'username avatarUrl');

      const response = MessageResponseDTO.fromMessage(message, message.senderId);

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: response.toJSON()
      });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: error.message
      });
    }
  }

  // Get conversation messages
  static async getConversationMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { userId } = req.user;
      const { page = 1, limit = 50 } = req.query;
      const skip = (page - 1) * limit;

      // Verify conversation access
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
        isActive: true
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found or access denied'
        });
      }

      const messages = await Message.getConversationMessages(conversationId, parseInt(limit), skip);

      const total = await Message.countDocuments({
        conversationId,
        isDeleted: false
      });

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      };

      const response = MessageListResponseDTO.fromMessages(messages, pagination);

      res.json({
        success: true,
        message: 'Messages retrieved successfully',
        data: response.toJSON()
      });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve messages',
        error: error.message
      });
    }
  }

  // Get message by ID
  static async getMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { userId } = req.user;

      const message = await Message.findOne({
        _id: messageId,
        isDeleted: false
      })
      .populate('senderId', 'username avatarUrl')
      .populate('replyTo')
      .populate('replyInfo.messageId')
      .populate('forwardedFrom', 'username avatarUrl')
      .populate('forwardInfo.originalSenderId', 'username avatarUrl');

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      // Check if user has access to this message
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        participants: userId,
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this message'
        });
      }

      const response = MessageResponseDTO.fromMessage(message, message.senderId);

      res.json({
        success: true,
        message: 'Message retrieved successfully',
        data: response.toJSON()
      });
    } catch (error) {
      console.error('Get message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve message',
        error: error.message
      });
    }
  }

  // Edit message
  static async editMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { messageId } = req.params;
      const { userId } = req.user;
      const updateDTO = new UpdateMessageDTO(req.body);

      const message = await Message.findOne({
        _id: messageId,
        senderId: userId,
        isDeleted: false
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found or you cannot edit this message'
        });
      }

      // Check if message is too old to edit (e.g., 15 minutes)
      const editTimeLimit = 15 * 60 * 1000; // 15 minutes in milliseconds
      if (Date.now() - message.createdAt.getTime() > editTimeLimit) {
        return res.status(400).json({
          success: false,
          message: 'Message is too old to edit'
        });
      }

      await message.editMessage(updateDTO.text);

      await message.populate('senderId', 'username avatarUrl');

      const response = MessageResponseDTO.fromMessage(message, message.senderId);

      res.json({
        success: true,
        message: 'Message edited successfully',
        data: response.toJSON()
      });
    } catch (error) {
      console.error('Edit message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to edit message',
        error: error.message
      });
    }
  }

  // Delete message
  static async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { userId } = req.user;

      const message = await Message.findOne({
        _id: messageId,
        senderId: userId,
        isDeleted: false
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found or you cannot delete this message'
        });
      }

      await message.deleteMessage();

      res.json({
        success: true,
        message: 'Message deleted successfully'
      });
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete message',
        error: error.message
      });
    }
  }

  // Add reaction to message
  static async addReaction(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { messageId } = req.params;
      const { userId } = req.user;
      const addDTO = new AddReactionDTO(req.body);

      const message = await Message.findOne({
        _id: messageId,
        isDeleted: false
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      // Check if user has access to this message
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        participants: userId,
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this message'
        });
      }

      await message.addReaction(userId, addDTO.reactionType);

      await message.populate('senderId', 'username avatarUrl');

      const response = MessageResponseDTO.fromMessage(message, message.senderId);

      res.json({
        success: true,
        message: 'Reaction added successfully',
        data: response.toJSON()
      });
    } catch (error) {
      console.error('Add reaction error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add reaction',
        error: error.message
      });
    }
  }

  // Remove reaction from message
  static async removeReaction(req, res) {
    try {
      const { messageId } = req.params;
      const { userId } = req.user;

      const message = await Message.findOne({
        _id: messageId,
        isDeleted: false
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      // Check if user has access to this message
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        participants: userId,
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this message'
        });
      }

      await message.removeReaction(userId);

      await message.populate('senderId', 'username avatarUrl');

      const response = MessageResponseDTO.fromMessage(message, message.senderId);

      res.json({
        success: true,
        message: 'Reaction removed successfully',
        data: response.toJSON()
      });
    } catch (error) {
      console.error('Remove reaction error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove reaction',
        error: error.message
      });
    }
  }

  // Forward messages
  static async forwardMessages(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId } = req.user;
      const forwardDTO = new ForwardMessageDTO(req.body);

      // Verify target conversations exist and user has access
      const targetConversations = await Conversation.find({
        _id: { $in: forwardDTO.targetConversationIds },
        participants: userId,
        isActive: true
      });

      if (targetConversations.length !== forwardDTO.targetConversationIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some target conversations not found or access denied'
        });
      }

      // Get original messages
      const originalMessages = await Message.find({
        _id: { $in: forwardDTO.messageIds },
        isDeleted: false
      }).populate('senderId', 'username avatarUrl');

      if (originalMessages.length !== forwardDTO.messageIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some messages not found'
        });
      }

      const forwardedMessages = [];

      // Forward each message to each target conversation
      for (const conversation of targetConversations) {
        for (const originalMessage of originalMessages) {
          const forwardInfo = {
            originalMessageId: originalMessage._id,
            originalSenderId: originalMessage.senderId._id,
            originalSenderName: originalMessage.senderId.username,
            originalConversationId: originalMessage.conversationId,
            originalConversationName: conversation.name,
            forwardedAt: new Date()
          };

          const message = new Message({
            conversationId: conversation._id,
            senderId: userId,
            text: originalMessage.text,
            type: originalMessage.type,
            attachments: originalMessage.attachments,
            forwardedFrom: originalMessage.senderId._id,
            forwardInfo,
            metadata: {
              clientMessageId: `forward_${Date.now()}_${Math.random()}`,
              deviceId: 'server',
              platform: 'web'
            }
          });

          await message.save();
          forwardedMessages.push(message);

          // Update conversation's last message
          await conversation.updateLastMessage(message);
        }
      }

      res.json({
        success: true,
        message: 'Messages forwarded successfully',
        data: {
          forwardedCount: forwardedMessages.length,
          targetConversations: forwardDTO.targetConversationIds.length
        }
      });
    } catch (error) {
      console.error('Forward messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to forward messages',
        error: error.message
      });
    }
  }

  // Reply to message
  static async replyToMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { messageId } = req.params;
      const { userId } = req.user;
      const replyDTO = new ReplyMessageDTO(req.body);

      const originalMessage = await Message.findOne({
        _id: messageId,
        isDeleted: false
      });

      if (!originalMessage) {
        return res.status(404).json({
          success: false,
          message: 'Original message not found'
        });
      }

      // Check if user has access to the conversation
      const conversation = await Conversation.findOne({
        _id: originalMessage.conversationId,
        participants: userId,
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this conversation'
        });
      }

      const replyInfo = {
        messageId: originalMessage._id,
        text: originalMessage.text || 'Media',
        senderName: originalMessage.senderId.username,
        attachmentType: originalMessage.attachments?.[0]?.type
      };

      const message = new Message({
        conversationId: originalMessage.conversationId,
        senderId: userId,
        text: replyDTO.text,
        type: replyDTO.type,
        attachments: replyDTO.attachments,
        replyTo: originalMessage._id,
        replyInfo,
        metadata: {
          ...replyDTO.metadata,
          clientMessageId: `reply_${Date.now()}_${Math.random()}`,
          deviceId: replyDTO.metadata?.deviceId || 'server',
          platform: replyDTO.metadata?.platform || 'web'
        }
      });

      await message.save();

      // Update conversation's last message
      await conversation.updateLastMessage(message);

      await message.populate('senderId', 'username avatarUrl');
      await message.populate('replyTo');

      const response = MessageResponseDTO.fromMessage(message, message.senderId, originalMessage);

      res.status(201).json({
        success: true,
        message: 'Reply sent successfully',
        data: response.toJSON()
      });
    } catch (error) {
      console.error('Reply to message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send reply',
        error: error.message
      });
    }
  }

  // Get thread messages
  static async getThreadMessages(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId } = req.user;
      const threadDTO = new ThreadMessagesDTO(req.params);
      const skip = (threadDTO.page - 1) * threadDTO.limit;

      const parentMessage = await Message.findOne({
        _id: threadDTO.parentMessageId,
        isDeleted: false
      });

      if (!parentMessage) {
        return res.status(404).json({
          success: false,
          message: 'Parent message not found'
        });
      }

      // Check if user has access to the conversation
      const conversation = await Conversation.findOne({
        _id: parentMessage.conversationId,
        participants: userId,
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this conversation'
        });
      }

      const messages = await Message.getThreadMessages(threadDTO.parentMessageId, threadDTO.limit, skip);

      const total = await Message.countDocuments({
        'threadInfo.parentMessageId': threadDTO.parentMessageId,
        isDeleted: false
      });

      const pagination = {
        page: threadDTO.page,
        limit: threadDTO.limit,
        total,
        pages: Math.ceil(total / threadDTO.limit)
      };

      const response = MessageListResponseDTO.fromMessages(messages, pagination);

      res.json({
        success: true,
        message: 'Thread messages retrieved successfully',
        data: response.toJSON()
      });
    } catch (error) {
      console.error('Get thread messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve thread messages',
        error: error.message
      });
    }
  }

  // Search messages
  static async searchMessages(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId } = req.user;
      const searchDTO = new SearchMessagesDTO(req.query);
      const skip = (searchDTO.page - 1) * searchDTO.limit;

      // Build search query
      let query = { isDeleted: false };

      // Add conversation filter
      if (searchDTO.conversationId) {
        query.conversationId = searchDTO.conversationId;
      } else {
        // If no specific conversation, get user's conversations
        const userConversations = await Conversation.find({
          participants: userId,
          isActive: true
        }).select('_id');
        
        query.conversationId = { $in: userConversations.map(c => c._id) };
      }

      // Add text search
      if (searchDTO.query) {
        query.text = { $regex: searchDTO.query, $options: 'i' };
      }

      // Add type filter
      if (searchDTO.type) {
        query.type = searchDTO.type;
      }

      // Add sender filter
      if (searchDTO.senderId) {
        query.senderId = searchDTO.senderId;
      }

      // Add attachment filter
      if (searchDTO.hasAttachments !== undefined) {
        if (searchDTO.hasAttachments) {
          query.attachments = { $exists: true, $ne: [] };
        } else {
          query.$or = [
            { attachments: { $exists: false } },
            { attachments: { $size: 0 } }
          ];
        }
      }

      // Add reaction filter
      if (searchDTO.hasReactions !== undefined) {
        if (searchDTO.hasReactions) {
          query.reactions = { $exists: true, $ne: [] };
        } else {
          query.$or = [
            { reactions: { $exists: false } },
            { reactions: { $size: 0 } }
          ];
        }
      }

      // Add date range filter
      if (searchDTO.dateFrom || searchDTO.dateTo) {
        query.createdAt = {};
        if (searchDTO.dateFrom) {
          query.createdAt.$gte = new Date(searchDTO.dateFrom);
        }
        if (searchDTO.dateTo) {
          query.createdAt.$lte = new Date(searchDTO.dateTo);
        }
      }

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(searchDTO.limit)
        .populate('senderId', 'username avatarUrl')
        .populate('conversationId', 'name')
        .populate('replyTo')
        .populate('forwardedFrom', 'username avatarUrl');

      const total = await Message.countDocuments(query);

      const pagination = {
        page: searchDTO.page,
        limit: searchDTO.limit,
        total,
        pages: Math.ceil(total / searchDTO.limit)
      };

      const response = MessageListResponseDTO.fromMessages(messages, pagination);

      res.json({
        success: true,
        message: 'Messages found successfully',
        data: response.toJSON()
      });
    } catch (error) {
      console.error('Search messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search messages',
        error: error.message
      });
    }
  }

  // Pin/Unpin message
  static async pinMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { messageId } = req.params;
      const { userId } = req.user;
      const pinDTO = new PinMessageDTO(req.body);

      const message = await Message.findOne({
        _id: messageId,
        isDeleted: false
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      // Check if user has access to the conversation
      const conversation = await Conversation.findOne({
        _id: message.conversationId,
        participants: userId,
        isActive: true
      });

      if (!conversation) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this conversation'
        });
      }

      // Check permissions for pinning
      if (conversation.isGroup && conversation.admin.toString() !== userId) {
        if (!conversation.groupSettings.allowMemberPin) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to pin messages'
          });
        }
      }

      if (pinDTO.action === 'pin') {
        await conversation.pinMessage(messageId);
        message.isPinned = true;
      } else {
        await conversation.unpinMessage(messageId);
        message.isPinned = false;
      }

      await message.save();
      await message.populate('senderId', 'username avatarUrl');

      const response = MessageResponseDTO.fromMessage(message, message.senderId);

      res.json({
        success: true,
        message: `Message ${pinDTO.action}ned successfully`,
        data: response.toJSON()
      });
    } catch (error) {
      console.error('Pin message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to pin/unpin message',
        error: error.message
      });
    }
  }
} 