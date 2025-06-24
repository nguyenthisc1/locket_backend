import express from 'express';
import { 
  getProfile, 
  updateProfile, 
  deleteAccount, 
  updateProfileValidation 
} from '../controllers/user.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

// All user routes require authentication
router.use(authMiddleware);

router.get('/profile', getProfile);
router.put('/profile', updateProfileValidation, updateProfile);
router.delete('/account', deleteAccount);

export default router;
