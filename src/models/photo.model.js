import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	type: { type: String, required: true }, // ❤️ 😂 😮 etc.
	createdAt: { type: Date, default: Date.now },
});

const photoSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	imageUrl: { type: String, required: true },
	publicId: { type: String }, // Cloudinary public ID for management
	caption: { type: String, maxlength: 500 },
	sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
	location: {
		lat: { type: Number, min: -90, max: 90 },
		lng: { type: Number, min: -180, max: 180 },
	},
	reactions: [reactionSchema],
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

export default mongoose.model("Photo", photoSchema);
