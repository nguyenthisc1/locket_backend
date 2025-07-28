export const productionConfig = {
  // Server Configuration
  port: process.env.PORT || 10000,
  nodeEnv: process.env.NODE_ENV || 'production',
  
  // Database Configuration
  mongodbUri: process.env.MONGODB_URI,
  
  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET,
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '7d',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  
  // Cloudinary Configuration
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  
  // CORS Configuration
  corsOrigin: process.env.CORS_ORIGIN || 'https://your-frontend-domain.com',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // API Configuration
  apiVersion: 'api/v1',
  apiPrefix: '/api/v1',
  
  // File Upload Limits
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxFiles: 10,
  
  // Security
  rateLimitWindow: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 100, // requests per window
};

export default productionConfig; 