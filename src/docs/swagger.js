import swaggerJSDoc from 'swagger-jsdoc';
import path from 'path';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Locket App API',
      version: '1.0.0',
      description: 'API documentation for the Locket clone backend with authentication, user management, and social features',
    },
    servers: [
      { url: 'http://localhost:3000' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token for API authentication'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'JWT refresh token stored in httpOnly cookie'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'User ID' },
            username: { type: 'string', description: 'Username' },
            email: { type: 'string', format: 'email', description: 'User email' },
            phoneNumber: { type: 'string', description: 'Phone number' },
            avatarUrl: { type: 'string', description: 'Avatar URL' },
            isVerified: { type: 'boolean', description: 'Verification status' },
            lastActiveAt: { type: 'string', format: 'date-time', description: 'Last active timestamp' },
            friends: { type: 'array', items: { type: 'string' }, description: 'Friend user IDs' },
            chatRooms: { type: 'array', items: { type: 'string' }, description: 'Chat room IDs' },
            createdAt: { type: 'string', format: 'date-time', description: 'Account creation date' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['password'],
          properties: {
            email: { type: 'string', format: 'email', description: 'User email (required if phoneNumber not provided)' },
            phoneNumber: { type: 'string', description: 'Phone number (required if email not provided)' },
            password: { type: 'string', description: 'User password' },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['username', 'email', 'phoneNumber', 'password'],
          properties: {
            username: { type: 'string', description: 'Username' },
            email: { type: 'string', format: 'email', description: 'User email' },
            phoneNumber: { type: 'string', description: 'Phone number' },
            password: { type: 'string', minLength: 6, description: 'Password (minimum 6 characters)' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', description: 'JWT access token' },
            refreshToken: { type: 'string', description: 'JWT refresh token' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'User ID' },
                username: { type: 'string', description: 'Username' },
                email: { type: 'string', description: 'User email' },
                phoneNumber: { type: 'string', description: 'Phone number' },
              },
            },
          },
        },
        RefreshTokenResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', description: 'New JWT access token' },
            refreshToken: { type: 'string', description: 'New JWT refresh token' },
          },
        },
        ProfileUpdateRequest: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Username' },
            email: { type: 'string', format: 'email', description: 'User email' },
            phoneNumber: { type: 'string', description: 'Phone number' },
            avatarUrl: { type: 'string', description: 'Avatar URL' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Error message' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', description: 'Field name' },
                  message: { type: 'string', description: 'Validation message' },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [
    path.resolve('src/routes/*.js'),  
    path.resolve('src/docs/*.yaml'),  
  ],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;