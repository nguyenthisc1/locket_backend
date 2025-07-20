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

// Middleware
app.use(cors({
  origin: `http://localhost:${PORT}`, 
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Documentation
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/photo', photoRoutes);
app.use('/api/v1/upload', photoUploadRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/messages', messageRoutes);

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
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  }
};

startServer();