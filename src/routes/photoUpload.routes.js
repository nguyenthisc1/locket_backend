import express from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import { 
  uploadPhoto, 
  uploadMultiplePhotos, 
  deletePhotoWithCloudinary,
  getImageUrls
} from '../controllers/photoUpload.controller.js';
import { uploadSingleImage, handleUploadError } from '../middleware/upload.middleware.js';

const router = express.Router();

// All upload routes require authentication
router.use(authMiddleware);

router.post('/', uploadSingleImage, handleUploadError, uploadPhoto);

router.post('/upload-multiple', uploadMultiplePhotos);

router.delete('/:photoId', deletePhotoWithCloudinary);

router.get('/:photoId/urls', getImageUrls);

export default router; 