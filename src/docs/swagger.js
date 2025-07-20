import path from 'path';
import swaggerJSDoc from 'swagger-jsdoc';
import fs from 'fs';
import yaml from 'js-yaml';

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
        Photo: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Photo ID' },
            userId: { type: 'string', description: 'User ID who created the photo' },
            imageUrl: { type: 'string', description: 'URL of the photo' },
            caption: { type: 'string', description: 'Photo caption' },
            sharedWith: { 
              type: 'array', 
              items: { type: 'string' }, 
              description: 'Array of user IDs the photo is shared with' 
            },
            location: {
              type: 'object',
              properties: {
                lat: { type: 'number', description: 'Latitude' },
                lng: { type: 'number', description: 'Longitude' }
              }
            },
            reactions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string', description: 'User ID who reacted' },
                  type: { type: 'string', description: 'Reaction type (emoji)' },
                  createdAt: { type: 'string', format: 'date-time', description: 'Reaction timestamp' }
                }
              }
            },
            createdAt: { type: 'string', format: 'date-time', description: 'Photo creation date' },
            updatedAt: { type: 'string', format: 'date-time', description: 'Photo last update date' }
          }
        },
        CreatePhotoRequest: {
          type: 'object',
          required: ['imageUrl'],
          properties: {
            imageUrl: { 
              type: 'string', 
              description: 'URL of the photo (required)',
              example: 'https://example.com/photo.jpg'
            },
            caption: { 
              type: 'string', 
              maxLength: 500,
              description: 'Photo caption (optional)',
              example: 'Amazing sunset at the beach! 🌅'
            },
            sharedWith: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Array of user IDs to share the photo with (optional)',
              example: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013']
            },
            location: {
              type: 'object',
              properties: {
                lat: { 
                  type: 'number', 
                  minimum: -90, 
                  maximum: 90,
                  description: 'Latitude (optional)',
                  example: 40.7128
                },
                lng: { 
                  type: 'number', 
                  minimum: -180, 
                  maximum: 180,
                  description: 'Longitude (optional)',
                  example: -74.0060
                }
              }
            }
          }
        },
        UpdatePhotoRequest: {
          type: 'object',
          properties: {
            caption: { 
              type: 'string', 
              maxLength: 500,
              description: 'Photo caption (optional)',
              example: 'Updated caption for the photo'
            },
            sharedWith: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Array of user IDs to share the photo with (optional)',
              example: ['507f1f77bcf86cd799439012']
            },
            location: {
              type: 'object',
              properties: {
                lat: { 
                  type: 'number', 
                  minimum: -90, 
                  maximum: 90,
                  description: 'Latitude (optional)',
                  example: 40.7589
                },
                lng: { 
                  type: 'number', 
                  minimum: -180, 
                  maximum: 180,
                  description: 'Longitude (optional)',
                  example: -73.9851
                }
              }
            }
          }
        },
        AddReactionRequest: {
          type: 'object',
          required: ['type'],
          properties: {
            type: { 
              type: 'string', 
              minLength: 1,
              maxLength: 10,
              description: 'Reaction type (emoji)',
              example: '❤️'
            }
          }
        },
        PhotoResponse: {
          type: 'object',
          properties: {
            photo: {
              $ref: '#/components/schemas/Photo'
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'User ID' },
                username: { type: 'string', description: 'Username' },
                avatarUrl: { type: 'string', description: 'User avatar URL' }
              }
            }
          }
        },
        PhotoListResponse: {
          type: 'object',
          properties: {
            photos: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Photo'
              }
            },
            pagination: {
              type: 'object',
              properties: {
                currentPage: { type: 'integer', example: 1 },
                totalPages: { type: 'integer', example: 5 },
                totalPhotos: { type: 'integer', example: 50 },
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

// Load YAML documentation files
const loadYamlDocs = () => {
  const docsDir = path.resolve('src/docs');
  const yamlFiles = ['conversation.docs.yaml', 'message.docs.yaml'];
  const yamlDocs = [];

  yamlFiles.forEach(file => {
    try {
      const filePath = path.join(docsDir, file);
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const parsed = yaml.load(fileContent);
        yamlDocs.push(parsed);
      }
    } catch (error) {
      console.warn(`Warning: Could not load ${file}:`, error.message);
    }
  });

  return yamlDocs;
};

const swaggerSpec = swaggerJSDoc(options);

// Merge YAML docs with main spec
const yamlDocs = loadYamlDocs();
if (yamlDocs.length > 0) {
  // Merge paths
  yamlDocs.forEach(doc => {
    if (doc.paths) {
      Object.assign(swaggerSpec.paths, doc.paths);
    }
    // Merge components
    if (doc.components) {
      if (doc.components.schemas) {
        Object.assign(swaggerSpec.components.schemas, doc.components.schemas);
      }
      if (doc.components.securitySchemes) {
        Object.assign(swaggerSpec.components.securitySchemes, doc.components.securitySchemes);
      }
    }
  });
}

export default swaggerSpec;