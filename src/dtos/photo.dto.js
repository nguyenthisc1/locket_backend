import { body } from 'express-validator';

// Base Photo DTO for common photo data
export class PhotoDTO {
  constructor(data) {
    this.id = data._id || data.id;
    this.userId = data.userId;
    this.imageUrl = data.imageUrl;
    this.caption = data.caption;
    this.sharedWith = data.sharedWith || [];
    this.location = data.location;
    this.reactions = data.reactions || [];
    this.createdAt = data.createdAt;
  }

  static fromModel(photo) {
    return new PhotoDTO(photo);
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      imageUrl: this.imageUrl,
      caption: this.caption,
      sharedWith: this.sharedWith,
      location: this.location,
      reactions: this.reactions,
      createdAt: this.createdAt
    };
  }
}

// Create Photo DTO
export class CreatePhotoDTO {
  constructor(data) {
    this.imageUrl = data.imageUrl;
    this.caption = data.caption;
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

// Update Photo DTO
export class UpdatePhotoDTO {
  constructor(data) {
    this.caption = data.caption;
    this.sharedWith = data.sharedWith;
    this.location = data.location;
  }

  static validationRules() {
    return [
      body('caption')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Caption must be less than 500 characters'),
      
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

// Photo Response DTO
export class PhotoResponseDTO {
  constructor(photo, user = null) {
    this.photo = PhotoDTO.fromModel(photo);
    this.user = user;
  }

  static fromPhoto(photo, user = null) {
    return new PhotoResponseDTO(photo, user);
  }

  toJSON() {
    return {
      photo: this.photo.toJSON(),
      user: this.user ? {
        id: this.user._id,
        username: this.user.username,
        avatarUrl: this.user.avatarUrl
      } : null
    };
  }
}

// Photo List Response DTO
export class PhotoListResponseDTO {
  constructor(photos, pagination = null) {
    this.photos = photos.map(photo => PhotoDTO.fromModel(photo));
    this.pagination = pagination;
  }

  static fromPhotos(photos, pagination = null) {
    return new PhotoListResponseDTO(photos, pagination);
  }

  toJSON() {
    return {
      photos: this.photos.map(photo => photo.toJSON()),
      pagination: this.pagination
    };
  }
}

// Search Photos DTO
export class SearchPhotosDTO {
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