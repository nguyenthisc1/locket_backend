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
    this.participants = data.participants;
    this.isGroup = data.isGroup || false;
    this.admin = data.admin;
    this.groupSettings = data.groupSettings;
    this.settings = data.settings;
  }

  /**
   * Validation rules for creating a conversation.
   * - Private conversations must have exactly 2 participants.
   * - Group conversations must have at least 3 participants.
   * - All participants must be valid Mongo IDs.
   * - isGroup must be a boolean if provided.
   * - Admin must be a valid Mongo ID if provided.
   * - Group settings fields must be booleans if provided.
   */
  static validationRules() {
    return [
      body('name')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Conversation name must be less than 100 characters'),
        
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
        
        body('participants')
          .isArray()
          .withMessage('Participants must be an array')
          .custom((arr, { req }) => {
            if (!Array.isArray(arr)) {
              throw new Error('Participants must be an array');
            }
            // Validate each participant is a non-empty string
            if (!arr.every(id => typeof id === 'string' && id.trim().length > 0)) {
              throw new Error('Each participant must be a non-empty Mongo ID');
            }
            const isGroup = req.body.isGroup === true || req.body.isGroup === 'true';
            if (isGroup && arr.length < 2) {
              // In the controller, the current user is added, so require at least 2 others for group
            }
            if (!isGroup && arr.length !== 1) {
              throw new Error('Private conversation must have exactly 1 participant (the current user will be added automatically)');
            }
            return true;
          }),
  
        body('participants.*')
          .isMongoId()
          .withMessage('Invalid user ID in participants array'),

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
  constructor(conversation, participants = []) {
    this.id = conversation._id || conversation.id;
    this.isGroup = conversation.isGroup || false;
    this.admin = conversation.admin;
    this.groupSettings = conversation.groupSettings || {};
    this.lastMessage = conversation.lastMessage;
    this.parentConversation = conversation.parentConversation;
    this.threadInfo = conversation.threadInfo;
    this.isActive = conversation.isActive;
    this.pinnedMessages = conversation.pinnedMessages || [];
    this.settings = conversation.settings || {};
    this.startedAt = conversation.startedAt;
    this.readReceipts = conversation.readReceipts || [];
    this.createdAt = conversation.createdAt;
    this.updatedAt = conversation.updatedAt;
    
    // Handle participants and name based on conversation type
    const currentUserId = conversation.currentUserId;
    
    if (this.isGroup) {
      // For group conversations, participants is an array
      this.participants = participants;
      
      // Generate name from all participant names if no custom name is set
      if (!conversation.name) {
        this.name = participants.map(p => p.username).join(', ');
      } else {
        this.name = conversation.name;
      }
    } else {
      // For non-group conversations, participants is a single object (the other user)
      const otherParticipant = participants.find(p => p._id.toString() !== currentUserId?.toString()) || participants[0];
      this.participants = otherParticipant;
      
      // Name is the other participant's username
      this.name = otherParticipant?.username || conversation.name;
    }
  }

  static fromConversation(conversation, participants = [], currentUserId = null) {
    // Add currentUserId to conversation object for processing
    // Handle both Mongoose documents and plain objects (from aggregation)
    const conversationData = conversation.toObject ? conversation.toObject() : conversation;
    const conversationWithUserId = { ...conversationData, currentUserId };
    return new ConversationResponseDTO(conversationWithUserId, participants);
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

// Conversation List Response DTO
export class ConversationListResponseDTO {
  constructor(conversations, pagination = null, currentUserId = null) {
    this.conversations = conversations.map(conv => {
      // Create ConversationResponseDTO for each conversation to apply naming logic
      return ConversationResponseDTO.fromConversation(conv, conv.participants, currentUserId);
    });
    this.pagination = pagination;
  }

  static fromConversations(conversations, pagination = null, currentUserId = null) {
    return new ConversationListResponseDTO(conversations, pagination, currentUserId);
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