import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, unique: true },
    phoneNumber: { type: String, unique: true },
    passwordHash: { type: String, required: true },
    avatarUrl: { type: String },
    isVerified: { type: Boolean, default: false },
    lastActiveAt: { type: Date },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    chatRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' }],
    createdAt: { type: Date, default: Date.now }
  });
  
export default mongoose.model('User', userSchema);