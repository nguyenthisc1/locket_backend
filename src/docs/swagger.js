import path from 'path';
import swaggerJSDoc from 'swagger-jsdoc';

const PORT = process.env.PORT || 8000;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Locket App API',
      version: '1.0.0',
      description: '',
    },
    servers: [
      { 
        url: `http://localhost:${PORT}`,
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token for API authentication. Include in Authorization header as: Bearer YOUR_TOKEN'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'JWT refresh token stored in httpOnly cookie. Automatically handled by the browser.'
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
            email: { 
              type: 'string', 
              format: 'email', 
              description: 'User email (required if phoneNumber not provided)',
              example: 'user@example.com'
            },
            phoneNumber: { 
              type: 'string', 
              description: 'Phone number (required if email not provided)',
              example: '+1234567890'
            },
            password: { 
              type: 'string', 
              description: 'User password',
              example: 'password123'
            },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['username', 'email', 'phoneNumber', 'password'],
          properties: {
            username: { 
              type: 'string', 
              description: 'Username (3-30 characters, alphanumeric + underscore)',
              example: 'john_doe'
            },
            email: { 
              type: 'string', 
              format: 'email', 
              description: 'User email',
              example: 'john@example.com'
            },
            phoneNumber: { 
              type: 'string', 
              description: 'Phone number',
              example: '+1234567890'
            },
            password: { 
              type: 'string', 
              minLength: 6, 
              description: 'Password (minimum 6 characters, must contain lowercase, uppercase, and number)',
              example: 'Password123'
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            accessToken: { 
              type: 'string', 
              description: 'JWT access token (use in Authorization header)',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            refreshToken: { 
              type: 'string', 
              description: 'JWT refresh token (stored in httpOnly cookie)',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
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
            accessToken: { 
              type: 'string', 
              description: 'New JWT access token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            refreshToken: { 
              type: 'string', 
              description: 'New JWT refresh token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
          },
        },
        ProfileUpdateRequest: {
          type: 'object',
          properties: {
            username: { 
              type: 'string', 
              description: 'Username (3-30 characters, alphanumeric + underscore)',
              example: 'new_username'
            },
            email: { 
              type: 'string', 
              format: 'email', 
              description: 'User email',
              example: 'newemail@example.com'
            },
            phoneNumber: { 
              type: 'string', 
              description: 'Phone number',
              example: '+1987654321'
            },
            avatarUrl: { 
              type: 'string', 
              description: 'Avatar URL',
              example: 'https://example.com/avatar.jpg'
            },
          },
        },
        UserProfileResponse: {
          type: 'object',
          properties: {
            user: {
              $ref: '#/components/schemas/User'
            }
          }
        },
        UserListResponse: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/User'
              }
            },
            pagination: {
              type: 'object',
              properties: {
                currentPage: { type: 'integer', example: 1 },
                totalPages: { type: 'integer', example: 5 },
                totalUsers: { type: 'integer', example: 50 },
                hasNextPage: { type: 'boolean', example: true },
                hasPrevPage: { type: 'boolean', example: false }
              }
            }
          }
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