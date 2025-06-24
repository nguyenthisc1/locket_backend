import express from 'express';
import { register, login, refreshToken, registerValidation, loginValidation } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh', refreshToken);

export default router;