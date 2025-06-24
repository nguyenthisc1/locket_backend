import mongoose from 'mongoose';

const emoteSchema = new mongoose.Schema({
  imageUrl: { type: String },
  description: { type: String },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('Emote', emoteSchema);
