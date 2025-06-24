import mongoose from 'mongoose';

const reactionSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	type: { type: String }, // e.g., emoji or emote type
	createdAt: { type: Date, default: Date.now },
});

const messageSchema = new mongoose.Schema({
	conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
	senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	text: { type: String },
	imageUrl: { type: String },
	isRead: { type: Boolean, default: false },
	reactions: [reactionSchema],
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);
