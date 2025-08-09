import mongoose from "mongoose";
import reactionSchema from "./reaction.model.js";

const photoSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	imageUrl: { type: String, required: true }, // Can be image or video URL
	publicId: { type: String }, // Cloudinary public ID for management
	caption: { type: String, maxlength: 500 },
	sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
	location: {
		lat: { type: Number, min: -90, max: 90 },
		lng: { type: Number, min: -180, max: 180 },
	},
	reactions: [reactionSchema],
	// Media type and metadata
	mediaType: { 
		type: String, 
		enum: ['image', 'video'], 
		default: 'image' 
	},
	// Video-specific fields
	duration: { type: Number }, // Duration in seconds for videos
	format: { type: String }, // File format (jpg, png, mp4, etc.)
	width: { type: Number },
	height: { type: Number },
	fileSize: { type: Number }, // File size in bytes
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

// Update the updatedAt field before saving
photoSchema.pre('save', function(next) {
	this.updatedAt = new Date();
	next();
});

// Index for better query performance
photoSchema.index({ userId: 1, createdAt: -1 });
photoSchema.index({ sharedWith: 1, createdAt: -1 });
photoSchema.index({ publicId: 1 }); // Index for Cloudinary public ID
photoSchema.index({ mediaType: 1 }); // Index for media type queries

export default mongoose.model("Photo", photoSchema);
