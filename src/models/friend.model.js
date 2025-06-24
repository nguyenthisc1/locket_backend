import mongoose from 'mongoose';

const friendSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	friendId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	status: { type: String, enum: ["pending", "accepted", "blocked"], default: "pending" },
	createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Friend", friendSchema);
