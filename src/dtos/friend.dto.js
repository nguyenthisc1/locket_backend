import { body } from 'express-validator';

// Friend Request DTO
export class FriendRequestDTO {
  constructor(data) {
    this.friendId = data.friendId;
  }

  static validationRules() {
    return [
      body('friendId')
        .notEmpty()
        .withMessage('Friend ID is required')
        .isMongoId()
        .withMessage('Friend ID must be a valid MongoDB ObjectId')
    ];
  }
}

// Friend Status Update DTO
export class FriendStatusDTO {
  constructor(data) {
    this.status = data.status;
  }

  static validationRules() {
    return [
      body('status')
        .notEmpty()
        .withMessage('Status is required')
        .isIn(['accepted', 'blocked'])
        .withMessage('Status must be either "accepted" or "blocked"')
    ];
  }
}

// Friend Response DTO
export class FriendResponseDTO {
  constructor(data) {
    this.id = data._id || data.id;
    this.userId = data.userId;
    this.friendId = data.friendId;
    this.status = data.status;
    this.createdAt = data.createdAt;
    this.friend = data.friend; // Populated friend user data
  }

  static fromFriend(friend) {
    return new FriendResponseDTO(friend);
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      friendId: this.friendId,
      status: this.status,
      createdAt: this.createdAt,
      friend: this.friend
    };
  }
}