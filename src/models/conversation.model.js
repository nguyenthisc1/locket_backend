import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
	{
		// Basic conversation info
		name: {
			type: String,
			maxlength: 100,
			default: null, // null for direct messages, name for group chats
		},

		// Participants with read tracking
		participants: [
			{
				userId: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "User",
					required: true,
				},
				lastReadMessageId: {
					type: mongoose.Schema.Types.ObjectId,
					ref: "Message",
					default: null,
				},
				lastReadAt: {
					type: Date,
					default: null,
				},
				joinedAt: {
					type: Date,
					default: Date.now,
				},
			},
		],

		// Group chat specific fields
		isGroup: {
			type: Boolean,
			default: false,
		},

		// Group admin (only for group chats)
		admin: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},

		// Group settings
		groupSettings: {
			allowMemberInvite: { type: Boolean, default: true },
			allowMemberEdit: { type: Boolean, default: false },
			allowMemberDelete: { type: Boolean, default: false },
			allowMemberPin: { type: Boolean, default: false },
		},

		// Conversation metadata
		lastMessage: {
			messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
			text: { type: String },
			senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
			timestamp: { type: Date },
			isRead: { type: Boolean, default: false },
		},

		// Thread support
		parentConversation: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Conversation",
		},

		// Thread metadata
		threadInfo: {
			parentMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
			threadCount: { type: Number, default: 0 },
			lastThreadMessage: { type: Date },
		},

		// Conversation status
		isActive: {
			type: Boolean,
			default: true,
		},

		// Pinned messages
		pinnedMessages: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Message",
			},
		],

		// Conversation settings
		settings: {
			muteNotifications: { type: Boolean, default: false },
			customEmoji: { type: String }, // Custom emoji for the conversation
			theme: { type: String, default: "default" },
			wallpaper: { type: String }, // Background image URL
		},

		// Metadata
		startedAt: {
			type: Date,
			default: Date.now,
		},

		// Read receipts tracking
		readReceipts: [
			{
				userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
				lastReadMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
				lastReadAt: { type: Date, default: Date.now },
			},
		],
	},
	{
		timestamps: true,
	}
);

// Indexes for better performance
conversationSchema.index({ "participants.userId": 1 });
conversationSchema.index({ isGroup: 1 });
conversationSchema.index({ parentConversation: 1 });
conversationSchema.index({ "lastMessage.timestamp": -1 });
conversationSchema.index({ "threadInfo.lastThreadMessage": -1 });
conversationSchema.index({ "participants.lastReadMessageId": 1 });

// Virtual for unread count
conversationSchema.virtual("unreadCount").get(function () {
	return this.readReceipts.length;
});

// Method to add participant
conversationSchema.methods.addParticipant = function (userId) {
	const existingParticipant = this.participants.find(p => p.userId.equals(userId));
	if (!existingParticipant) {
		this.participants.push({
			userId: userId,
			lastReadMessageId: null,
			lastReadAt: null,
			joinedAt: new Date()
		});
	}
	return this.save();
};

// Method to remove participant
conversationSchema.methods.removeParticipant = function (userId) {
	this.participants = this.participants.filter((p) => !p.userId.equals(userId));
	return this.save();
};

// Method to update participant's last read message
conversationSchema.methods.updateParticipantLastRead = function (userId, messageId) {
	const participant = this.participants.find(p => p.userId.equals(userId));
	if (participant) {
		participant.lastReadMessageId = messageId;
		participant.lastReadAt = new Date();
	}
	return this.save();
};

// Method to pin message
conversationSchema.methods.pinMessage = function (messageId) {
	if (!this.pinnedMessages.includes(messageId)) {
		this.pinnedMessages.push(messageId);
	}
	return this.save();
};

// Method to unpin message
conversationSchema.methods.unpinMessage = function (messageId) {
	this.pinnedMessages = this.pinnedMessages.filter((id) => !id.equals(messageId));
	return this.save();
};

// Method to update last message
conversationSchema.methods.updateLastMessage = function (message) {
	this.lastMessage = {
		messageId: message._id,
		text: message.text || message.attachments?.[0]?.type || "Media",
		senderId: message.senderId,
		timestamp: message.createdAt,
	};
	return this.save();
};

export default mongoose.model("Conversation", conversationSchema);
