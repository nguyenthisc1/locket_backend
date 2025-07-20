import { body } from 'express-validator';

// Base Conversation DTO
export class ConversationDTO {
  constructor(data) {
    this.id = data._id || data.id;
    this.name = data.name;
    this.participants = data.participants || [];
    this.isGroup = data.isGroup || false;
    this.admin = data.admin;
    this.groupSettings = data.groupSettings || {};
    this.lastMessage = data.lastMessage;
    this.parentConversation = data.parentConversation;
    this.threadInfo = data.threadInfo;
    this.isActive = data.isActive;
    this.pinnedMessages = data.pinnedMessages || [];
    this.settings = data.settings || {};
    this.startedAt = data.startedAt;
    this.readReceipts = data.readReceipts || [];
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  static fromModel(conversation) {
    return new ConversationDTO(conversation);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      participants: this.participants,
      isGroup: this.isGroup,
      admin: this.admin,
      groupSettings: this.groupSettings,
      lastMessage: this.lastMessage,
      parentConversation: this.parentConversation,
      threadInfo: this.threadInfo,
      isActive: this.isActive,
      pinnedMessages: this.pinnedMessages,
      settings: this.settings,
      startedAt: this.startedAt,
      readReceipts: this.readReceipts,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

// Create Conversation DTO
export class CreateConversationDTO {
  constructor(data) {
    this.name = data.name;
    this.participants = data.participants || [];
    this.isGroup = data.isGroup || false;
    this.admin = data.admin;
    this.groupSettings = data.groupSettings;
    this.settings = data.settings;
  }

  static validationRules() {
    return [
      body('name')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Conversation name must be less than 100 characters'),
      
      body('participants')
        .isArray({ min: 1 })
        .withMessage('At least one participant is required'),
      
      body('participants.*')
        .isMongoId()
        .withMessage('Invalid user ID in participants array'),
      
      body('isGroup')
        .optional()
        .isBoolean()
        .withMessage('isGroup must be a boolean'),
      
      body('admin')
        .optional()
        .isMongoId()
        .withMessage('Invalid admin user ID'),
      
      body('groupSettings.allowMemberInvite')
        .optional()
        .isBoolean()
        .withMessage('allowMemberInvite must be a boolean'),
      
      body('groupSettings.allowMemberEdit')
        .optional()
        .isBoolean()
        .withMessage('allowMemberEdit must be a boolean'),
      
      body('groupSettings.allowMemberDelete')
        .optional()
        .isBoolean()
        .withMessage('allowMemberDelete must be a boolean'),
      
      body('groupSettings.allowMemberPin')
        .optional()
        .isBoolean()
        .withMessage('allowMemberPin must be a boolean')
    ];
  }
}

// Update Conversation DTO
export class UpdateConversationDTO {
  constructor(data) {
    this.name = data.name;
    this.groupSettings = data.groupSettings;
    this.settings = data.settings;
  }

  static validationRules() {
    return [
      body('name')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Conversation name must be less than 100 characters'),
      
      body('groupSettings.allowMemberInvite')
        .optional()
        .isBoolean()
        .withMessage('allowMemberInvite must be a boolean'),
      
      body('groupSettings.allowMemberEdit')
        .optional()
        .isBoolean()
        .withMessage('allowMemberEdit must be a boolean'),
      
      body('groupSettings.allowMemberDelete')
        .optional()
        .isBoolean()
        .withMessage('allowMemberDelete must be a boolean'),
      
      body('groupSettings.allowMemberPin')
        .optional()
        .isBoolean()
        .withMessage('allowMemberPin must be a boolean'),
      
      body('settings.muteNotifications')
        .optional()
        .isBoolean()
        .withMessage('muteNotifications must be a boolean'),
      
      body('settings.customEmoji')
        .optional()
        .isLength({ max: 10 })
        .withMessage('Custom emoji must be less than 10 characters'),
      
      body('settings.theme')
        .optional()
        .isIn(['default', 'dark', 'light', 'custom'])
        .withMessage('Invalid theme value'),
      
      body('settings.wallpaper')
        .optional()
        .isURL()
        .withMessage('Wallpaper must be a valid URL')
    ];
  }

  toUpdateData() {
    const updateData = {};
    if (this.name !== undefined) updateData.name = this.name;
    if (this.groupSettings !== undefined) updateData.groupSettings = this.groupSettings;
    if (this.settings !== undefined) updateData.settings = this.settings;
    return updateData;
  }
}

// Add Participant DTO
export class AddParticipantDTO {
  constructor(data) {
    this.userIds = data.userIds || [];
  }

  static validationRules() {
    return [
      body('userIds')
        .isArray({ min: 1 })
        .withMessage('At least one user ID is required'),
      
      body('userIds.*')
        .isMongoId()
        .withMessage('Invalid user ID in userIds array')
    ];
  }
}

// Remove Participant DTO
export class RemoveParticipantDTO {
  constructor(data) {
    this.userId = data.userId;
  }

  static validationRules() {
    return [
      body('userId')
        .isMongoId()
        .withMessage('Invalid user ID')
    ];
  }
}

// Conversation Response DTO
export class ConversationResponseDTO {
  constructor(conversation, participants = [], lastMessage = null) {
    this.conversation = ConversationDTO.fromModel(conversation);
    this.participants = participants;
    this.lastMessage = lastMessage;
  }

  static fromConversation(conversation, participants = [], lastMessage = null) {
    return new ConversationResponseDTO(conversation, participants, lastMessage);
  }

  toJSON() {
    return {
      conversation: this.conversation.toJSON(),
      participants: this.participants,
      lastMessage: this.lastMessage
    };
  }
}

// Conversation List Response DTO
export class ConversationListResponseDTO {
  constructor(conversations, pagination = null) {
    this.conversations = conversations.map(conv => ConversationDTO.fromModel(conv));
    this.pagination = pagination;
  }

  static fromConversations(conversations, pagination = null) {
    return new ConversationListResponseDTO(conversations, pagination);
  }

  toJSON() {
    return {
      conversations: this.conversations.map(conv => conv.toJSON()),
      pagination: this.pagination
    };
  }
}

// Search Conversations DTO
export class SearchConversationsDTO {
  constructor(data) {
    this.query = data.query;
    this.isGroup = data.isGroup;
    this.limit = parseInt(data.limit) || 20;
    this.page = parseInt(data.page) || 1;
  }

  static validationRules() {
    return [
      body('query')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters'),
      
      body('isGroup')
        .optional()
        .isBoolean()
        .withMessage('isGroup must be a boolean'),
      
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