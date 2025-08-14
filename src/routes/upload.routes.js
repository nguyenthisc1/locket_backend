import express from 'express';
import {UploadController} from '../controllers/upload.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { handleUploadError, uploadSingleMedia } from '../middleware/upload.middleware.js';

const router = express.Router();

router.use(authMiddleware);

// Upload media (photo/video) to Cloudinary only
router.post('/', uploadSingleMedia, handleUploadError, UploadController.uploadMedia);

// // Upload media (photos/videos) on cloudinary  
// router.post('/upload-multiple', UploadController.uploadMultiplePhotos);

// // Legacy route for backward compatibility
// router.post('/photo', uploadSingleImage, handleUploadError, UploadController.uploadMedia);

// // Delete photo
// router.delete('/:photoId', UploadController.deletePhotoWithCloudinary);

// // Get all url photo
// router.get('/:photoId/urls', UploadController.getImageUrls);

export default router; 