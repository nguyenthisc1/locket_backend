import cloudinary from '../config/cloudinary.js';

class CloudinaryService {
  /**
   * Upload image to Cloudinary
   * @param {Buffer|string} file - File buffer or base64 string
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  static async uploadImage(file, options = {}) {
    try {
      const uploadOptions = {
        folder: 'locket-photos',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ],
        ...options
      };

      let uploadResult;
      
      if (Buffer.isBuffer(file)) {
        // Upload from buffer
        uploadResult = await cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) throw error;
            return result;
          }
        ).end(file);
      } else if (typeof file === 'string') {
        // Upload from URL or base64
        uploadResult = await cloudinary.uploader.upload(file, uploadOptions);
      } else {
        throw new Error('Invalid file format. Expected Buffer or string.');
      }

      return {
        public_id: uploadResult.public_id,
        url: uploadResult.secure_url,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        created_at: uploadResult.created_at
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Delete image from Cloudinary
   * @param {string} publicId - Cloudinary public ID
   * @returns {Promise<Object>} Delete result
   */
  static async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image'
      });
      
      return {
        success: result.result === 'ok',
        message: result.result
      };
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Generate optimized image URL with transformations
   * @param {string} publicId - Cloudinary public ID
   * @param {Object} options - Transformation options
   * @returns {string} Optimized image URL
   */
  static getOptimizedUrl(publicId, options = {}) {
    const defaultOptions = {
      quality: 'auto:good',
      fetch_format: 'auto',
      ...options
    };

    return cloudinary.url(publicId, {
      ...defaultOptions,
      secure: true
    });
  }

  /**
   * Generate thumbnail URL
   * @param {string} publicId - Cloudinary public ID
   * @param {number} width - Thumbnail width
   * @param {number} height - Thumbnail height
   * @returns {string} Thumbnail URL
   */
  static getThumbnailUrl(publicId, width = 300, height = 300) {
    return cloudinary.url(publicId, {
      width,
      height,
      crop: 'fill',
      quality: 'auto:good',
      fetch_format: 'auto',
      secure: true
    });
  }

  /**
   * Generate responsive image URLs
   * @param {string} publicId - Cloudinary public ID
   * @returns {Object} Responsive image URLs
   */
  static getResponsiveUrls(publicId) {
    return {
      thumbnail: this.getThumbnailUrl(publicId, 150, 150),
      small: this.getOptimizedUrl(publicId, { width: 300, height: 300, crop: 'fill' }),
      medium: this.getOptimizedUrl(publicId, { width: 600, height: 600, crop: 'fill' }),
      large: this.getOptimizedUrl(publicId, { width: 1200, height: 1200, crop: 'fill' }),
      original: this.getOptimizedUrl(publicId)
    };
  }

  /**
   * Extract public ID from Cloudinary URL
   * @param {string} url - Cloudinary URL
   * @returns {string} Public ID
   */
  static extractPublicId(url) {
    try {
      const urlParts = url.split('/');
      const uploadIndex = urlParts.findIndex(part => part === 'upload');
      if (uploadIndex === -1) return null;
      
      const publicIdParts = urlParts.slice(uploadIndex + 2);
      const publicId = publicIdParts.join('/').split('.')[0];
      return publicId;
    } catch (error) {
      console.error('Error extracting public ID:', error);
      return null;
    }
  }

  /**
   * Validate if URL is from Cloudinary
   * @param {string} url - URL to validate
   * @returns {boolean} True if Cloudinary URL
   */
  static isCloudinaryUrl(url) {
    return url && url.includes('res.cloudinary.com');
  }
}

export default CloudinaryService; 