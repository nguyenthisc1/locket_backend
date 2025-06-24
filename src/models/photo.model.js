import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	type: { type: String }, // ❤️ 😂 😮 etc.
	createdAt: { type: Date, default: Date.now },
});

const photoSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	imageUrl: { type: String, required: true },
	caption: { type: String },
	sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
	location: {
		lat: { type: Number },
		lng: { type: Number },
	},
	reactions: [reactionSchema],
	createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Photo", photoSchema);
