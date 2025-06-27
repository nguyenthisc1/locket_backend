import { body } from 'express-validator';

// Base User DTO for common user data
export class UserDTO {
  constructor(data) {
    this.id = data._id || data.id;
    this.username = data.username;
    this.email = data.email;
    this.phoneNumber = data.phoneNumber;
    this.avatarUrl = data.avatarUrl;
    this.isVerified = data.isVerified;
    this.lastActiveAt = data.lastActiveAt;
    this.createdAt = data.createdAt;
  }

  static fromModel(user) {
    return new UserDTO(user);
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      phoneNumber: this.phoneNumber,
      avatarUrl: this.avatarUrl,
      isVerified: this.isVerified,
      lastActiveAt: this.lastActiveAt,
      createdAt: this.createdAt
    };
  }
}

// Registration DTO
export class RegisterUserDTO {
  constructor(data) {
    this.username = data.username;
    this.email = data.email;
    this.phoneNumber = data.phoneNumber;
    this.password = data.password;
  }

  static validationRules() {
    return [
      body('username')
        .notEmpty()
        .withMessage('Username is required')
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
      
      body('email')
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
      
      body('phoneNumber')
        .notEmpty()
        .withMessage('Phone number is required')
        .matches(/^\+?[\d\s\-\(\)]+$/)
        .withMessage('Please provide a valid phone number'),
      
      body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
    ];
  }
}

// Login DTO
export class LoginUserDTO {
  constructor(data) {
    this.email = data.email;
    this.phoneNumber = data.phoneNumber;
    this.password = data.password;
  }

  static validationRules() {
    return [
      body('email')
        .optional()
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
      
      body('phoneNumber')
        .optional()
        .matches(/^\+?[\d\s\-\(\)]+$/)
        .withMessage('Please provide a valid phone number'),
      
      body('password')
        .notEmpty()
        .withMessage('Password is required'),
      
      // Custom validation to ensure either email or phoneNumber is provided
      body()
        .custom((value, { req }) => {
          if (!req.body.email && !req.body.phoneNumber) {
            throw new Error('Either email or phone number is required');
          }
          return true;
        })
    ];
  }
}

// Update Profile DTO
export class UpdateProfileDTO {
  constructor(data) {
    this.username = data.username;
    this.email = data.email;
    this.phoneNumber = data.phoneNumber;
    this.avatarUrl = data.avatarUrl;
  }

  static validationRules() {
    return [
      body('username')
        .optional()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
      
      body('email')
        .optional()
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
      
      body('phoneNumber')
        .optional()
        .matches(/^\+?[\d\s\-\(\)]+$/)
        .withMessage('Please provide a valid phone number'),
      
      body('avatarUrl')
        .optional()
        .isURL()
        .withMessage('Avatar URL must be a valid URL')
    ];
  }

  toUpdateData() {
    const updateData = {};
    if (this.username) updateData.username = this.username;
    if (this.email) updateData.email = this.email;
    if (this.phoneNumber) updateData.phoneNumber = this.phoneNumber;
    if (this.avatarUrl) updateData.avatarUrl = this.avatarUrl;
    return updateData;
  }
}

// Auth Response DTO
export class AuthResponseDTO {
  constructor(data) {
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.user = data.user;
  }

  static fromAuthData(authData) {
    return new AuthResponseDTO({
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      user: UserDTO.fromModel(authData.user)
    });
  }

  toJSON() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      user: this.user.toJSON()
    };
  }
}

// User Profile Response DTO
export class UserProfileResponseDTO {
  constructor(user) {
    this.user = UserDTO.fromModel(user);
  }

  static fromUser(user) {
    return new UserProfileResponseDTO(user);
  }

  toJSON() {
    return {
      user: this.user.toJSON()
    };
  }
}

// User List DTO (for friend lists, search results, etc.)
export class UserListDTO {
  constructor(users, pagination = null) {
    this.users = users.map(user => UserDTO.fromModel(user));
    this.pagination = pagination;
  }

  static fromUsers(users, pagination = null) {
    return new UserListDTO(users, pagination);
  }

  toJSON() {
    return {
      users: this.users.map(user => user.toJSON()),
      pagination: this.pagination
    };
  }
}

// Search Users DTO
export class SearchUsersDTO {
  constructor(data) {
    this.query = data.query;
    this.limit = data.limit || 10;
    this.page = data.page || 1;
    this.excludeCurrentUser = data.excludeCurrentUser !== false;
  }

  static validationRules() {
    return [
      body('query')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search query must be between 1 and 100 characters'),
      
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