import express from 'express';
import {PhotoUploadController} from '../controllers/photoUpload.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { handleUploadError, uploadSingleImage, uploadSingleMedia } from '../middleware/upload.middleware.js';

const router = express.Router();

router.use(authMiddleware);

// Upload media (photo/video) on cloudinary
router.post('/', uploadSingleMedia, handleUploadError, PhotoUploadController.uploadPhoto);

// Upload media (photos/videos) on cloudinary  
router.post('/upload-multiple', PhotoUploadController.uploadMultiplePhotos);

// Legacy route for backward compatibility
router.post('/photo', uploadSingleImage, handleUploadError, PhotoUploadController.uploadPhoto);

// Delete photo
router.delete('/:photoId', PhotoUploadController.deletePhotoWithCloudinary);

// Get all url photo
router.get('/:photoId/urls', PhotoUploadController.getImageUrls);

export default router; 