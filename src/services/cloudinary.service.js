import cloudinary from "../config/cloudinary.js";
import streamifier from 'streamifier'

class CloudinaryService {
	/**
	 * Upload image to Cloudinary
	 * @param {Buffer|string} file - File buffer or base64 string
	 * @param {Object} options - Upload options
	 * @returns {Promise<Object>} Upload result
	 */
	static async uploadImage(file, options = {}) {
		// Debug: log file type and preview
		if (typeof file === "string") {
			console.log("🚀 ~ CloudinaryService ~ uploadImage ~ file (first 100):", file.slice(0, 100));
		} else if (Buffer.isBuffer(file)) {
			console.log("🚀 ~ CloudinaryService ~ uploadImage ~ file (Buffer):", true, "length:", file.length);
		} else {
			console.log("🚀 ~ CloudinaryService ~ uploadImage ~ file (Unknown type):", typeof file);
		}

		let imageBuffer;

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
					imageBuffer = Buffer.from(base64String, "base64");
					if (imageBuffer.length < 4) {
						throw new Error("Decoded buffer too short to be a valid image.");
					}
				} catch (err) {
					throw new Error("Could not decode base64 image data.");
				}
			} else if (Buffer.isBuffer(file)) {
				imageBuffer = file;
			} else {
				throw new Error("Invalid file format. Expected Buffer or base64 string.");
			}

			// Validate buffer
			if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
				throw new Error("Image buffer is empty after decoding.");
			}

			// Prepare upload options
			const uploadOptions = {
				folder: "locket-photos",
				resource_type: "image",
				allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
				transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
				...options,
			};

			// Upload to Cloudinary using stream
			const uploadResult = await new Promise((resolve, reject) => {
				const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
					if (error) {
						// Provide detailed error for debugging
						reject(new Error(`Failed to upload image: ${error.message}`));
					} else {
						resolve(result);
					}
				});
				streamifier.createReadStream(imageBuffer).pipe(uploadStream);
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
