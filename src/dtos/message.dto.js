import { body } from 'express-validator';

// Base Message DTO
export class MessageDTO {
  constructor(data) {
    this.id = data._id || data.id;
    this.conversationId = data.conversationId;
    this.senderId = data.senderId;
    this.text = data.text;
    this.type = data.type || 'text';
    this.attachments = data.attachments || [];
    this.replyTo = data.replyTo;
    this.replyInfo = data.replyInfo;
    this.forwardedFrom = data.forwardedFrom;
    this.forwardInfo = data.forwardInfo;
    this.threadInfo = data.threadInfo;
    this.reactions = data.reactions || [];
    this.isRead = data.isRead;
    this.isEdited = data.isEdited;
    this.isDeleted = data.isDeleted;
    this.isPinned = data.isPinned;
    this.editHistory = data.editHistory || [];
    this.metadata = data.metadata || {};
    this.sticker = data.sticker;
    this.emote = data.emote;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static fromModel(message) {
    return new MessageDTO(message);
  }

  toJSON() {
    return {
      id: this.id,
      conversationId: this.conversationId,
      senderId: this.senderId,
      text: this.text,
      type: this.type,
      attachments: this.attachments,
      replyTo: this.replyTo,
      replyInfo: this.replyInfo,
      forwardedFrom: this.forwardedFrom,
      forwardInfo: this.forwardInfo,
      threadInfo: this.threadInfo,
      reactions: this.reactions,
      isRead: this.isRead,
      isEdited: this.isEdited,
      isDeleted: this.isDeleted,
      isPinned: this.isPinned,
      editHistory: this.editHistory,
      metadata: this.metadata,
      sticker: this.sticker,
      emote: this.emote,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

// Create Message DTO
export class CreateMessageDTO {
  constructor(data) {
    this.conversationId = data.conversationId;
    this.text = data.text;
    this.type = data.type || 'text';
    this.attachments = data.attachments || [];
    this.replyTo = data.replyTo;
    this.forwardedFrom = data.forwardedFrom;
    this.forwardInfo = data.forwardInfo;
    this.threadInfo = data.threadInfo;
    this.metadata = data.metadata || {};
    this.sticker = data.sticker;
    this.emote = data.emote;
  }

  static validationRules() {
    return [
      body('conversationId')
        .isMongoId()
        .withMessage('Invalid conversation ID'),
      
      body('text')
        .optional()
        .isLength({ max: 5000 })
        .withMessage('Message text must be less than 5000 characters'),
      
      body('type')
        .optional()
        .isIn(['text', 'image', 'video', 'sticker', 'file', 'audio', 'emote'])
        .withMessage('Invalid message type'),
      
      body('attachments')
        .optional()
        .isArray()
        .withMessage('Attachments must be an array'),
      
      body('attachments.*.url')
        .optional()
        .isURL()
        .withMessage('Invalid attachment URL'),
      
      body('attachments.*.type')
        .optional()
        .isIn(['image', 'video', 'file', 'audio', 'sticker'])
        .withMessage('Invalid attachment type'),
      
      body('attachments.*.fileName')
        .optional()
        .isLength({ max: 255 })
        .withMessage('File name must be less than 255 characters'),
      
      body('attachments.*.fileSize')
        .optional()
        .isInt({ min: 0 })
        .withMessage('File size must be a positive integer'),
      
      body('attachments.*.duration')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Duration must be a positive number'),
      
      body('attachments.*.width')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Width must be a positive integer'),
      
      body('attachments.*.height')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Height must be a positive integer'),
      
      body('replyTo')
        .optional()
        .isMongoId()
        .withMessage('Invalid reply message ID'),
      
      body('forwardedFrom')
        .optional()
        .isMongoId()
        .withMessage('Invalid forwarded from user ID'),
      
      body('forwardInfo.originalMessageId')
        .optional()
        .isMongoId()
        .withMessage('Invalid original message ID'),
      
      body('forwardInfo.originalSenderId')
        .optional()
        .isMongoId()
        .withMessage('Invalid original sender ID'),
      
      body('forwardInfo.originalConversationId')
        .optional()
        .isMongoId()
        .withMessage('Invalid original conversation ID'),
      
      body('threadInfo.parentMessageId')
        .optional()
        .isMongoId()
        .withMessage('Invalid parent message ID'),
      
      body('metadata.clientMessageId')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Client message ID must be less than 100 characters'),
      
      body('metadata.deviceId')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Device ID must be less than 100 characters'),
      
      body('metadata.platform')
        .optional()
        .isIn(['ios', 'android', 'web'])
        .withMessage('Invalid platform'),
      
      body('sticker.stickerId')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Sticker ID must be less than 100 characters'),
      
      body('sticker.stickerPackId')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Sticker pack ID must be less than 100 characters'),
      
      body('sticker.emoji')
        .optional()
        .isLength({ max: 10 })
        .withMessage('Sticker emoji must be less than 10 characters'),
      
      body('emote.emoteId')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Emote ID must be less than 100 characters'),
      
      body('emote.emoteType')
        .optional()
        .isLength({ max: 50 })
        .withMessage('Emote type must be less than 50 characters'),
      
      body('emote.emoji')
        .optional()
        .isLength({ max: 10 })
        .withMessage('Emote emoji must be less than 10 characters')
    ];
  }
}

// Update Message DTO
export class UpdateMessageDTO {
  constructor(data) {
    this.text = data.text;
  }

  static validationRules() {
    return [
      body('text')
        .isLength({ min: 1, max: 5000 })
        .withMessage('Message text must be between 1 and 5000 characters')
    ];
  }

  toUpdateData() {
    return { text: this.text };
  }
}

// Add Reaction DTO
export class AddReactionDTO {
  constructor(data) {
    this.reactionType = data.reactionType;
  }

  static validationRules() {
    return [
      body('reactionType')
        .isLength({ min: 1, max: 10 })
        .withMessage('Reaction type must be between 1 and 10 characters')
    ];
  }
}

// Remove Reaction DTO
export class RemoveReactionDTO {
  constructor(data) {
    this.reactionType = data.reactionType;
  }

  static validationRules() {
    return [
      body('reactionType')
        .optional()
        .isLength({ min: 1, max: 10 })
        .withMessage('Reaction type must be between 1 and 10 characters')
    ];
  }
}

// Forward Message DTO
export class ForwardMessageDTO {
  constructor(data) {
    this.targetConversationIds = data.targetConversationIds || [];
    this.messageIds = data.messageIds || [];
  }

  static validationRules() {
    return [
      body('targetConversationIds')
        .isArray({ min: 1 })
        .withMessage('At least one target conversation is required'),
      
      body('targetConversationIds.*')
        .isMongoId()
        .withMessage('Invalid target conversation ID'),
      
      body('messageIds')
        .isArray({ min: 1 })
        .withMessage('At least one message ID is required'),
      
      body('messageIds.*')
        .isMongoId()
        .withMessage('Invalid message ID')
    ];
  }
}

// Reply Message DTO
export class ReplyMessageDTO {
  constructor(data) {
    this.text = data.text;
    this.type = data.type || 'text';
    this.attachments = data.attachments || [];
    this.metadata = data.metadata || {};
  }

  static validationRules() {
    return [
      body('text')
        .optional()
        .isLength({ max: 5000 })
        .withMessage('Message text must be less than 5000 characters'),
      
      body('type')
        .optional()
        .isIn(['text', 'image', 'video', 'sticker', 'file', 'audio', 'emote'])
        .withMessage('Invalid message type'),
      
      body('attachments')
        .optional()
        .isArray()
        .withMessage('Attachments must be an array'),
      
      body('attachments.*.url')
        .optional()
        .isURL()
        .withMessage('Invalid attachment URL'),
      
      body('attachments.*.type')
        .optional()
        .isIn(['image', 'video', 'file', 'audio', 'sticker'])
        .withMessage('Invalid attachment type')
    ];
  }
}

// Message Response DTO
export class MessageResponseDTO {
  constructor(message, sender = null, replyMessage = null, forwardedFrom = null) {
    this.message = MessageDTO.fromModel(message);
    this.sender = sender;
    this.replyMessage = replyMessage;
    this.forwardedFrom = forwardedFrom;
  }

  static fromMessage(message, sender = null, replyMessage = null, forwardedFrom = null) {
    return new MessageResponseDTO(message, sender, replyMessage, forwardedFrom);
  }

  toJSON() {
    return {
      message: this.message.toJSON(),
      sender: this.sender,
      replyMessage: this.replyMessage,
      forwardedFrom: this.forwardedFrom
    };
  }
}

// Message List Response DTO
export class MessageListResponseDTO {
  constructor(messages, pagination = null) {
    this.messages = messages.map(msg => MessageDTO.fromModel(msg));
    this.pagination = pagination;
  }

  static fromMessages(messages, pagination = null) {
    return new MessageListResponseDTO(messages, pagination);
  }

  toJSON() {
    return {
      messages: this.messages.map(msg => msg.toJSON()),
      pagination: this.pagination
    };
  }
}

// Search Messages DTO
export class SearchMessagesDTO {
  constructor(data) {
    this.query = data.query;
    this.conversationId = data.conversationId;
    this.type = data.type;
    this.senderId = data.senderId;
    this.hasAttachments = data.hasAttachments;
    this.hasReactions = data.hasReactions;
    this.dateFrom = data.dateFrom;
    this.dateTo = data.dateTo;
    this.limit = parseInt(data.limit) || 20;
    this.page = parseInt(data.page) || 1;
  }

  static validationRules() {
    return [
      body('query')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters'),
      
      body('conversationId')
        .optional()
        .isMongoId()
        .withMessage('Invalid conversation ID'),
      
      body('type')
        .optional()
        .isIn(['text', 'image', 'video', 'sticker', 'file', 'audio', 'emote'])
        .withMessage('Invalid message type'),
      
      body('senderId')
        .optional()
        .isMongoId()
        .withMessage('Invalid sender ID'),
      
      body('hasAttachments')
        .optional()
        .isBoolean()
        .withMessage('hasAttachments must be a boolean'),
      
      body('hasReactions')
        .optional()
        .isBoolean()
        .withMessage('hasReactions must be a boolean'),
      
      body('dateFrom')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format for dateFrom'),
      
      body('dateTo')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format for dateTo'),
      
      body('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50'),
      
      body('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
    ];
  }
}

// Thread Messages DTO
export class ThreadMessagesDTO {
  constructor(data) {
    this.parentMessageId = data.parentMessageId;
    this.limit = parseInt(data.limit) || 50;
    this.page = parseInt(data.page) || 1;
  }

  static validationRules() {
    return [
      body('parentMessageId')
        .isMongoId()
        .withMessage('Invalid parent message ID'),
      
      body('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
      
      body('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
    ];
  }
}

// Pin/Unpin Message DTO
export class PinMessageDTO {
  constructor(data) {
    this.messageId = data.messageId;
    this.action = data.action; // 'pin' or 'unpin'
  }

  static validationRules() {
    return [
      body('messageId')
        .isMongoId()
        .withMessage('Invalid message ID'),
      
      body('action')
        .isIn(['pin', 'unpin'])
        .withMessage('Action must be either "pin" or "unpin"')
    ];
  }
} 