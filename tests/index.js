import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../src/routes/auth.routes';
import userRoutes from '../src/routes/user.routes';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/test/auth', authRoutes);
app.use('/api/test/user', userRoutes);

export default app;