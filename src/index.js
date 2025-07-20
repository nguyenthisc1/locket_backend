import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import connectDB from './config/db.js';
import swaggerSpec from './docs/swagger.js';
import validateEnv from './utils/validateEnv.js';

import authRoutes from './routes/auth.routes.js';
import photoRoutes from './routes/photo.routes.js';
import photoUploadRoutes from './routes/photoUpload.routes.js';
import userRoutes from './routes/user.routes.js';
import conversationRoutes from './routes/conversation.routes.js';
import messageRoutes from './routes/message.routes.js';

dotenv.config();
validateEnv();

const app = express();
const PORT = validateEnv.PORT || 8000;
const API_VERSION =  'api/v1'

// Middleware
app.use(cors({
  origin: `http://localhost:${PORT}`, 
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Documentation
app.use(`/${API_VERSION}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use(`/${API_VERSION}/auth`, authRoutes);
app.use(`/${API_VERSION}/users`, userRoutes);
app.use(`/${API_VERSION}/photo`, photoRoutes);
app.use(`/${API_VERSION}/upload`, photoUploadRoutes);
app.use(`/${API_VERSION}/conversations`, conversationRoutes);
app.use(`/${API_VERSION}/messages`, messageRoutes);

// Health check route
app.get('/', (req, res) => {
  res.send('Locket Backend API is running!');
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// Start server after DB connection
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on host http://localhost:${PORT}/${API_VERSION}`);
    });
  } catch (err) {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  }
};

startServer();