import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	type: { type: String, required: true }, // ❤️ 😂 😮 etc.
	createdAt: { type: Date, default: Date.now },
});

export default reactionSchema;