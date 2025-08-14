import multer from 'multer';
import path from 'path';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function for images and videos
const fileFilter = (req, file, cb) => {
  console.log('🔍 File validation:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname
  });

  // Allowed MIME types - comprehensive list
  const allowedMimeTypes = [
    // Image types
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    // Video types
    'video/mp4',
    'video/quicktime',     // MOV
    'video/x-msvideo',     // AVI
    'video/x-matroska',    // MKV
    'video/webm',
    'video/avi',           // Alternative AVI
    'video/mov',           // Alternative MOV
    'video/m4v'            // M4V
  ];

  // Check if the MIME type is allowed
  const isMimeTypeAllowed = allowedMimeTypes.includes(file.mimetype.toLowerCase());
  
  // Also check file extension as backup
  const extname = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|webm|m4v)$/i;
  const isExtensionAllowed = allowedExtensions.test(extname);

  if (isMimeTypeAllowed || isExtensionAllowed) {
    console.log('✅ File validation passed');
    return cb(null, true);
  } else {
    console.log('❌ File validation failed:', {
      mimetype: file.mimetype,
      extension: extname,
      allowed: allowedMimeTypes
    });
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
export const uploadSingleMedia = upload.single('mediaData');

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