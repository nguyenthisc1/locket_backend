import multer from 'multer';
import path from 'path';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function for images and videos
const fileFilter = (req, file, cb) => {
  // Check file type - support both images and videos
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedVideoTypes = /mp4|mov|avi|mkv|webm|m4v/;
  
  const extname = path.extname(file.originalname).toLowerCase();
  const isImageType = allowedImageTypes.test(extname) && file.mimetype.startsWith('image/');
  const isVideoType = allowedVideoTypes.test(extname) && file.mimetype.startsWith('video/');

  if (isImageType || isVideoType) {
    return cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
    files: 1 // Only allow 1 file at a time
  },
  fileFilter: fileFilter
});

// Middleware for single media upload (image or video)
export const uploadSingleMedia = upload.single('media');
export const uploadSingleImage = upload.single('image'); 

// Error handling middleware for multer
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File too large. Maximum size is 100MB.',
        error: error.message
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        message: 'Too many files. Only one file allowed.',
        error: error.message
      });
    }
    return res.status(400).json({
      message: 'File upload error',
      error: error.message
    });
  }
  
  if (error.message === 'Only image and video files are allowed!') {
    return res.status(400).json({
      message: 'Invalid file type. Only JPEG, PNG, GIF, WebP images and MP4, MOV, AVI, MKV, WebM videos are allowed.',
      error: error.message
    });
  }
  
  next(error);
};

export default upload; 