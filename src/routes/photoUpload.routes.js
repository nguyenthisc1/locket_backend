import express from 'express';
import {PhotoUploadController} from '../controllers/photoUpload.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { handleUploadError, uploadSingleImage } from '../middleware/upload.middleware.js';

const router = express.Router();

router.use(authMiddleware);

// Upload photo on cloudinary
router.post('/', uploadSingleImage, handleUploadError, PhotoUploadController.uploadPhoto);

// Upload photos on cloudinary
router.post('/upload-multiple', PhotoUploadController.uploadMultiplePhotos);

// Delete photo
router.delete('/:photoId', PhotoUploadController.deletePhotoWithCloudinary);

// Get all url photo
router.get('/:photoId/urls', PhotoUploadController.getImageUrls);

export default router; 