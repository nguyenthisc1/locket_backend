import express from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import { 
  getPhotos, 
  getPhotoById, 
  createPhoto, 
  updatePhoto, 
  deletePhoto,
  addReaction,
  removeReaction
} from '../controllers/photo.controller.js';
import { 
  CreatePhotoDTO, 
  UpdatePhotoDTO, 
  AddReactionDTO 
} from '../dtos/index.js';

const router = express.Router();

// All photo routes require authentication
router.use(authMiddleware);

// Photo CRUD operations
router.get('/', getPhotos);
router.get('/:photoId', getPhotoById);
router.post('/', CreatePhotoDTO.validationRules(), createPhoto);
router.put('/:photoId', UpdatePhotoDTO.validationRules(), updatePhoto);
router.delete('/:photoId', deletePhoto);

// Photo reactions
router.post('/:photoId/reactions', AddReactionDTO.validationRules(), addReaction);
router.delete('/:photoId/reactions', removeReaction);

export default router;
