import { body } from 'express-validator';

// Base Feed DTO for common media data (feeds/videos)
export class FeedDTO {
  constructor(data) {
    this.id = data._id || data.id;
    this.userId = data.userId;
    this.imageUrl = data.imageUrl; // URL for both images and videos
    this.caption = data.caption;
    this.isFrontCamera = data.isFrontCamera;
    this.sharedWith = data.sharedWith || [];
    this.location = data.location;
    this.reactions = data.reactions || [];
    this.mediaType = data.mediaType || 'image';
    this.duration = data.duration; // For videos
    this.format = data.format;
    this.width = data.width;
    this.height = data.height;
    this.fileSize = data.fileSize;
    this.createdAt = data.createdAt;
  }

  static fromModel(feed) {
    return new FeedDTO(feed);
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      imageUrl: this.imageUrl,
      caption: this.caption,
      isFrontCamera: this.isFrontCamera,
      sharedWith: this.sharedWith,
      location: this.location,
      reactions: this.reactions,
      mediaType: this.mediaType,
      duration: this.duration,
      format: this.format,
      width: this.width,
      height: this.height,
      fileSize: this.fileSize,
      createdAt: this.createdAt
    };
  }
}

// Create Feed DTO
export class CreateFeedDTO {
  constructor(data) {
    this.imageUrl = data.imageUrl;
    this.caption = data.caption;
    this.isFrontCamera = data.isFrontCamera;
    this.sharedWith = data.sharedWith || [];
    this.location = data.location;
  }

  static validationRules() {
    return [
      body('imageUrl')
        .notEmpty()
        .withMessage('Image URL is required')
        .isURL()
        .withMessage('Image URL must be a valid URL'),
      
      body('caption')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Caption must be less than 500 characters'),
      
      body('isFrontCamera')
        .optional()
        .isBoolean()
        .withMessage('isFrontCamera must be a boolean value'),
      
      body('sharedWith')
        .optional()
        .isArray()
        .withMessage('Shared with must be an array of user IDs'),
      
      body('sharedWith.*')
        .optional()
        .isMongoId()
        .withMessage('Invalid user ID in sharedWith array'),
      
      body('location.lat')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
      
      body('location.lng')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180')
    ];
  }
}

// Update Feed DTO
export class UpdateFeedDTO {
  constructor(data) {
    this.caption = data.caption;
    this.isFrontCamera = data.isFrontCamera;
    this.sharedWith = data.sharedWith;
    this.location = data.location;
  }

  static validationRules() {
    return [
      body('caption')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Caption must be less than 500 characters'),
      
      body('isFrontCamera')
        .optional()
        .isBoolean()
        .withMessage('isFrontCamera must be a boolean value'),
      
      body('sharedWith')
        .optional()
        .isArray()
        .withMessage('Shared with must be an array of user IDs'),
      
      body('sharedWith.*')
        .optional()
        .isMongoId()
        .withMessage('Invalid user ID in sharedWith array'),
      
      body('location.lat')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
      
      body('location.lng')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180')
    ];
  }

  toUpdateData() {
    const updateData = {};
    if (this.caption !== undefined) updateData.caption = this.caption;
    if (this.isFrontCamera !== undefined) updateData.isFrontCamera = this.isFrontCamera;
    if (this.sharedWith !== undefined) updateData.sharedWith = this.sharedWith;
    if (this.location !== undefined) updateData.location = this.location;
    return updateData;
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
        .notEmpty()
        .withMessage('Reaction type is required')
        .isLength({ min: 1, max: 10 })
        .withMessage('Reaction type must be between 1 and 10 characters')
    ];
  }
}

// Feed Response DTO
export class FeedResponseDTO {
  constructor(feed, user = null) {
    this.feed = FeedDTO.fromModel(feed);
    this.user = user;
  }

  static fromFeed(feed, user = null) {
    return new FeedResponseDTO(feed, user);
  }

  static fromAggregatedFeed(aggregatedFeed) {
    // For aggregated feeds that already include user data
    const feedData = {
      ...aggregatedFeed,
      userId: aggregatedFeed.user || aggregatedFeed.userId
    };
    return new FeedResponseDTO(feedData, aggregatedFeed.user);
  }

  toJSON() {
    return {
      feed: this.feed.toJSON(),
      user: this.user ? {
        id: this.user._id,
        username: this.user.username,
        avatarUrl: this.user.avatarUrl
      } : null
    };
  }
}

// Feed List Response DTO
export class FeedListResponseDTO {
  constructor(feeds, pagination = null, processedFeeds = null) {
    this.feeds = processedFeeds || feeds.map(feed => FeedDTO.fromModel(feed));
    this.pagination = pagination;
  }

  static fromFeeds(feeds, pagination = null) {
    return new FeedListResponseDTO(feeds, pagination);
  }

  static fromAggregatedFeeds(aggregatedFeeds, pagination = null) {
    console.log("Processing aggregated feeds:", aggregatedFeeds.length);
    
    // For aggregated feeds that include user data
    const processedFeeds = aggregatedFeeds.map(feed => {
      console.log("Processing feed:", feed._id);
      // Create a proper feed structure that FeedDTO can handle
      const feedData = {
        ...feed,
        userId: feed.user || feed.userId
      };
      return FeedDTO.fromModel(feedData);
    });
    
    console.log("Processed feeds count:", processedFeeds.length);
    
    // Create instance with processed feeds directly
    const instance = new FeedListResponseDTO([], pagination);
    instance.feeds = processedFeeds;
    return instance;
  }

  toJSON() {
    return {
      feeds: this.feeds.map(feed => feed.toJSON()),
      pagination: this.pagination
    };
  }
}

// Search Feeds DTO
export class SearchFeedsDTO {
  constructor(data) {
    this.query = data.query;
    this.userId = data.userId;
    this.sharedWithMe = data.sharedWithMe === 'true';
    this.limit = parseInt(data.limit) || 10;
    this.page = parseInt(data.page) || 1;
  }

  static validationRules() {
    return [
      body('query')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters'),
      
      body('userId')
        .optional()
        .isMongoId()
        .withMessage('Invalid user ID'),
      
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