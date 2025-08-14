import cloudinary from "../config/cloudinary.js";
import streamifier from 'streamifier'

class CloudinaryService {
	/**
	 * Upload media (image/video) to Cloudinary
	 * @param {Buffer|string} file - File buffer or base64 string
	 * @param {Object} options - Upload options
	 * @returns {Promise<Object>} Upload result
	 */
	static async uploadMedia(file, options = {}) {
		// Debug: log file type and preview
		if (typeof file === "string") {
			console.log("🚀 ~ CloudinaryService ~ uploadMedia ~ file (first 100):", file.slice(0, 100));
		} else if (Buffer.isBuffer(file)) {
			console.log("🚀 ~ CloudinaryService ~ uploadMedia ~ file (Buffer):", true, "length:", file.length);
		} else {
			console.log("🚀 ~ CloudinaryService ~ uploadMedia ~ file (Unknown type):", typeof file);
		}

		let mediaBuffer;

		try {
			// Handle string input (base64, with or without data URI)
			if (typeof file === "string") {
				let base64String = file;
				// Extract base64 from data URI if present
				const dataUriMatch = file.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
				if (dataUriMatch && dataUriMatch.length === 3) {
					base64String = dataUriMatch[2];
				} else {
					// Remove whitespace and check for valid base64
					const base64Test = base64String.replace(/\s/g, "");
					if (!/^[A-Za-z0-9+/=]+$/.test(base64Test)) {
						throw new Error("Invalid base64 string format.");
					}
				}
				try {
					mediaBuffer = Buffer.from(base64String, "base64");
					if (mediaBuffer.length < 4) {
						throw new Error("Decoded buffer too short to be a valid media file.");
					}
				} catch (err) {
					throw new Error("Could not decode base64 media data.");
				}
			} else if (Buffer.isBuffer(file)) {
				mediaBuffer = file;
			} else {
				throw new Error("Invalid file format. Expected Buffer or base64 string.");
			}

			// Validate buffer
			if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer) || mediaBuffer.length === 0) {
				throw new Error("Media buffer is empty after decoding.");
			}

			// Determine if file is video based on buffer or options
			const isVideo = options.resource_type === "video" || this.isVideoBuffer(mediaBuffer);
			
			const uploadOptions = {
				folder: options.folder || (isVideo ? "locket-videos" : "locket-photos"), // Use provided folder or default
				resource_type: isVideo ? "video" : "image",
				allowed_formats: isVideo 
					? ["mp4", "mov", "avi", "mkv", "webm", "m4v"]
					: ["jpg", "jpeg", "png", "gif", "webp"],
				transformation: isVideo 
					? [{ quality: "auto:good" }]
					: [{ quality: "auto:good" }, { fetch_format: "auto" }],
				...options,
			};

			// Upload to Cloudinary using stream
			const uploadResult = await new Promise((resolve, reject) => {
				const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
					if (error) {
						// Provide detailed error for debugging
						reject(new Error(`Failed to upload media: ${error.message}`));
					} else {
						resolve(result);
					}
				});
				streamifier.createReadStream(mediaBuffer).pipe(uploadStream);
			});

			// Validate upload result
			if (!uploadResult || !uploadResult.secure_url) {
				throw new Error("Cloudinary did not return a valid upload result.");
			}

			// Return relevant upload info
			return {
				public_id: uploadResult.public_id,
				url: uploadResult.secure_url,
				width: uploadResult.width,
				height: uploadResult.height,
				format: uploadResult.format,
				bytes: uploadResult.bytes,
				created_at: uploadResult.created_at,
			};
		} catch (error) {
			// Comprehensive error logging
			console.error("Photo upload error:", error);
			// Root cause analysis: log stack if available
			if (error && error.stack) {
				console.error("Stack trace:", error.stack);
			}
			throw new Error(`Failed to upload image: ${error.message}`);
		}
	}

	/**
	 * Upload image to Cloudinary (backward compatibility)
	 * @param {Buffer|string} file - File buffer or base64 string
	 * @param {Object} options - Upload options
	 * @returns {Promise<Object>} Upload result
	 */
	static async uploadImage(file, options = {}) {
		return this.uploadMedia(file, { ...options, resource_type: "image" });
	}

	/**
	 * Upload video to Cloudinary
	 * @param {Buffer|string} file - File buffer or base64 string
	 * @param {Object} options - Upload options
	 * @returns {Promise<Object>} Upload result
	 */
	static async uploadVideo(file, options = {}) {
		return this.uploadMedia(file, { ...options, resource_type: "video" });
	}

	/**
	 * Detect if buffer contains video data
	 * @param {Buffer} buffer - File buffer
	 * @returns {boolean} True if video
	 */
	static isVideoBuffer(buffer) {
		if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

		// Check for common video file signatures
		const signature = buffer.toString('hex', 0, 12).toLowerCase();
		
		// MP4 signatures
		if (signature.includes('667479706d703') || // ftyp mp4
			signature.includes('667479706973') || // ftyp isom
			signature.includes('667479704d534e56') || // ftyp MSNV
			signature.includes('66747970717434')) { // ftyp qt
			return true;
		}

		// MOV (QuickTime) signature
		if (signature.includes('6d6f6f76') || // moov
			signature.includes('667265654d4f56') || // free MOV
			signature.includes('6d646174')) { // mdat
			return true;
		}

		// AVI signature
		if (signature.slice(0, 8) === '52494646' && signature.slice(16, 24) === '41564920') {
			return true;
		}

		// WebM signature
		if (signature.slice(0, 8) === '1a45dfa3') {
			return true;
		}

		return false;
	}

	/**
	 * Detect if base64 string contains video data
	 * @param {string} base64String - Base64 encoded string
	 * @returns {boolean} True if video
	 */
	static isVideoBase64(base64String) {
		try {
			// Handle data URI format
			let base64Data = base64String;
			const dataUriMatch = base64String.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
			if (dataUriMatch) {
				// Check MIME type first if it's a data URI
				const mimeType = dataUriMatch[1];
				if (mimeType.startsWith('video/')) {
					return true;
				}
				base64Data = dataUriMatch[2];
			}

			// Decode first few bytes to check file signature
			const headerBytes = Buffer.from(base64Data.substring(0, 32), 'base64');
			return this.isVideoBuffer(headerBytes);
		} catch (error) {
			// If we can't decode, assume it's an image
			return false;
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
				resource_type: "image",
			});

			return {
				success: result.result === "ok",
				message: result.result,
			};
		} catch (error) {
			console.error("Cloudinary delete error:", error);
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
			quality: "auto:good",
			fetch_format: "auto",
			...options,
		};

		return cloudinary.url(publicId, {
			...defaultOptions,
			secure: true,
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
			crop: "fill",
			quality: "auto:good",
			fetch_format: "auto",
			secure: true,
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
			small: this.getOptimizedUrl(publicId, { width: 300, height: 300, crop: "fill" }),
			medium: this.getOptimizedUrl(publicId, { width: 600, height: 600, crop: "fill" }),
			large: this.getOptimizedUrl(publicId, { width: 1200, height: 1200, crop: "fill" }),
			original: this.getOptimizedUrl(publicId),
		};
	}

	/**
	 * Extract public ID from Cloudinary URL
	 * @param {string} url - Cloudinary URL
	 * @returns {string} Public ID
	 */
	static extractPublicId(url) {
		try {
			const urlParts = url.split("/");
			const uploadIndex = urlParts.findIndex((part) => part === "upload");
			if (uploadIndex === -1) return null;

			const publicIdParts = urlParts.slice(uploadIndex + 2);
			const publicId = publicIdParts.join("/").split(".")[0];
			return publicId;
		} catch (error) {
			console.error("Error extracting public ID:", error);
			return null;
		}
	}

	/**
	 * Validate if URL is from Cloudinary
	 * @param {string} url - URL to validate
	 * @returns {boolean} True if Cloudinary URL
	 */
	static isCloudinaryUrl(url) {
		return url && url.includes("res.cloudinary.com");
	}
}

export default CloudinaryService;
