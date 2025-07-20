import express from 'express';
import { 
  getProfile, 
  updateProfile, 
  deleteAccount, 
  updateProfileValidation,
  searchUsers
} from '../controllers/user.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

// All user routes require authentication
router.use(authMiddleware);

router.get('/', getProfile);
router.put('/', updateProfileValidation, updateProfile);
router.delete('/:userId', deleteAccount);
router.get('/search', searchUsers);

export default router;
