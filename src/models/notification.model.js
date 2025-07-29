import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
	fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	
	type: { 
		type: String, 
		enum: [
			"new_image", 
			"reaction", 
			"friend_request", 
			"message", 
			"conversation_invite",
			"photo_comment",
			"photo_like",
			"group_update",
			"mention",
			"system"
		], 
		required: true 
	},
	
	title: { type: String, required: true },
	content: { type: String, required: true },
	imageUrl: { type: String }, // For photo notifications
	
	relatedPhotoId: { type: mongoose.Schema.Types.ObjectId, ref: "Photo" },
	relatedMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
	relatedConversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
	
	isRead: { type: Boolean, default: false },
	isDeleted: { type: Boolean, default: false },
	priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
	
	createdAt: { type: Date, default: Date.now },
	readAt: { type: Date },
	expiresAt: { type: Date },
	
	metadata: {
		type: Map,
		of: mongoose.Schema.Types.Mixed,
		default: {}
	}
}, {
	timestamps: true
});

// Indexes for better performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Virtual for unread count
notificationSchema.virtual('isExpired').get(function() {
	return this.expiresAt && new Date() > this.expiresAt;
});

// Pre-save middleware
notificationSchema.pre('save', function(next) {
	// Set readAt when marking as read
	if (this.isModified('isRead') && this.isRead && !this.readAt) {
		this.readAt = new Date();
	}
	next();
});

// Static methods
notificationSchema.statics.markAsRead = function(userId, notificationIds) {
	return this.updateMany(
		{ _id: { $in: notificationIds }, userId },
		{ $set: { isRead: true, readAt: new Date() } }
	);
};

notificationSchema.statics.getUnreadCount = function(userId) {
	return this.countDocuments({ userId, isRead: false, isDeleted: false });
};

notificationSchema.statics.deleteOldNotifications = function(userId, daysOld = 30) {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - daysOld);
	
	return this.updateMany(
		{ userId, createdAt: { $lt: cutoffDate }, isRead: true },
		{ $set: { isDeleted: true } }
	);
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;