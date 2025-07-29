import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../src/routes/auth.routes.js';
import userRoutes from '../src/routes/user.routes.js';
import photoRoutes from '../src/routes/photo.routes.js';
import conversationRoutes from '../src/routes/conversation.routes.js';
import messageRoutes from '../src/routes/message.routes.js';


const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/test/auth', authRoutes);
app.use('/api/test/user', userRoutes);
app.use('/api/test/photo', photoRoutes);
app.use('/api/test/conversation', conversationRoutes);
app.use('/api/test/message', messageRoutes);

export default app;