import { validationResult } from 'express-validator';
import CloudinaryService from '../utils/cloudinaryService.js';
import Photo from '../models/photo.model.js';
import User from '../models/user.model.js';
import { CreatePhotoDTO, PhotoResponseDTO } from '../dtos/index.js';

/**
 * Upload photo from Flutter app
 * Handles both file uploads and base64 image data
 */
export const uploadPhoto = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { caption, sharedWith, location, imageData } = req.body;
    
    let cloudinaryResult;

    // Handle different image input types
    if (req.file) {
      // File upload via multer
      cloudinaryResult = await CloudinaryService.uploadImage(req.file.buffer, {
        folder: `locket-photos/${req.user._id}`,
        public_id: `photo_${Date.now()}_${req.user._id}`
      });
    } else if (imageData) {
      // Base64 image data from Flutter
      cloudinaryResult = await CloudinaryService.uploadImage(imageData, {
        folder: `locket-photos/${req.user._id}`,
        public_id: `photo_${Date.now()}_${req.user._id}`
      });
    } else {
      return res.status(400).json({ 
        message: 'No image provided. Please upload a file or provide imageData.' 
      });
    }

    // Create photo record in database
    const photoData = {
      userId: req.user._id,
      imageUrl: cloudinaryResult.url,
      publicId: cloudinaryResult.public_id,
      caption: caption || '',
      sharedWith: sharedWith || [],
      location: location || null
    };

    const photo = await Photo.create(photoData);

    // Populate user data
    const populatedPhoto = await Photo.findById(photo._id)
      .populate('userId', 'username avatarUrl')
      .populate('sharedWith', 'username avatarUrl');

    const photoResponse = PhotoResponseDTO.fromPhoto(populatedPhoto);
    
    res.status(201).json({
      message: 'Photo uploaded successfully',
      photo: photoResponse.toJSON(),
      cloudinary: {
        publicId: cloudinaryResult.public_id,
        url: cloudinaryResult.url,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height,
        format: cloudinaryResult.format,
        size: cloudinaryResult.bytes
      }
    });

  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ 
      message: 'Failed to upload photo', 
      error: error.message 
    });
  }
};

/**
 * Upload multiple photos from Flutter app
 */
export const uploadMultiplePhotos = async (req, res) => {
  try {
    const { photos } = req.body; // Array of photo objects with imageData
    
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ 
        message: 'No photos provided or invalid format' 
      });
    }

    if (photos.length > 10) {
      return res.status(400).json({ 
        message: 'Maximum 10 photos allowed per request' 
      });
    }

    const uploadedPhotos = [];

    for (const photoData of photos) {
      const { imageData, caption, sharedWith, location } = photoData;

      if (!imageData) {
        continue; // Skip photos without image data
      }

      try {
        // Upload to Cloudinary
        const cloudinaryResult = await CloudinaryService.uploadImage(imageData, {
          folder: `locket-photos/${req.user._id}`,
          public_id: `photo_${Date.now()}_${req.user._id}_${Math.random().toString(36).substr(2, 9)}`
        });

        // Create photo record
        const photo = await Photo.create({
          userId: req.user._id,
          imageUrl: cloudinaryResult.url,
          publicId: cloudinaryResult.public_id,
          caption: caption || '',
          sharedWith: sharedWith || [],
          location: location || null
        });

        const populatedPhoto = await Photo.findById(photo._id)
          .populate('userId', 'username avatarUrl')
          .populate('sharedWith', 'username avatarUrl');

        uploadedPhotos.push({
          photo: PhotoResponseDTO.fromPhoto(populatedPhoto).toJSON(),
          cloudinary: {
            publicId: cloudinaryResult.public_id,
            url: cloudinaryResult.url,
            width: cloudinaryResult.width,
            height: cloudinaryResult.height,
            format: cloudinaryResult.format,
            size: cloudinaryResult.bytes
          }
        });

      } catch (uploadError) {
        console.error('Error uploading individual photo:', uploadError);
        // Continue with other photos even if one fails
      }
    }

    res.status(201).json({
      message: `${uploadedPhotos.length} photos uploaded successfully`,
      photos: uploadedPhotos,
      total: uploadedPhotos.length
    });

  } catch (error) {
    console.error('Multiple photo upload error:', error);
    res.status(500).json({ 
      message: 'Failed to upload photos', 
      error: error.message 
    });
  }
};

/**
 * Delete photo and remove from Cloudinary
 */
export const deletePhotoWithCloudinary = async (req, res) => {
  try {
    const { photoId } = req.params;

    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    if (!photo.userId.equals(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete from Cloudinary if it's a Cloudinary URL
    if (photo.publicId && CloudinaryService.isCloudinaryUrl(photo.imageUrl)) {
      try {
        await CloudinaryService.deleteImage(photo.publicId);
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Delete from database
    await Photo.findByIdAndDelete(photoId);

    res.json({ 
      message: 'Photo deleted successfully',
      deletedPhoto: {
        id: photo._id,
        publicId: photo.publicId,
        imageUrl: photo.imageUrl
      }
    });

  } catch (error) {
    console.error('Photo deletion error:', error);
    res.status(500).json({ 
      message: 'Failed to delete photo', 
      error: error.message 
    });
  }
};

/**
 * Get optimized image URLs for different sizes
 */
export const getImageUrls = async (req, res) => {
  try {
    const { photoId } = req.params;

    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    // Check access
    const hasAccess = photo.userId.equals(req.user._id) || 
                     photo.sharedWith.some(userId => userId.equals(req.user._id));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Generate responsive URLs if it's a Cloudinary image
    let imageUrls = null;
    if (photo.publicId && CloudinaryService.isCloudinaryUrl(photo.imageUrl)) {
      imageUrls = CloudinaryService.getResponsiveUrls(photo.publicId);
    }

    res.json({
      photo: {
        id: photo._id,
        imageUrl: photo.imageUrl,
        publicId: photo.publicId,
        caption: photo.caption
      },
      responsiveUrls: imageUrls,
      isCloudinaryImage: CloudinaryService.isCloudinaryUrl(photo.imageUrl)
    });

  } catch (error) {
    console.error('Get image URLs error:', error);
    res.status(500).json({ 
      message: 'Failed to get image URLs', 
      error: error.message 
    });
  }
}; 