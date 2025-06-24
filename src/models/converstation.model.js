import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  startedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('Conversation', conversationSchema); 