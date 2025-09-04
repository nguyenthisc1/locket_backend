import mongoose from 'mongoose';
import reactionSchema from "./reaction.model.js";

// Attachment schema for media files
const attachmentSchema = new mongoose.Schema({
	url: { 
		type: String, 
		required: true 
	},
	type: { 
		type: String, 
		enum: ['image', 'video', 'file', 'audio', 'sticker'],
		required: true 
	},
	fileName: { 
		type: String 
	},
	fileSize: { 
		type: Number 
	},
	duration: { 
		type: Number 
	}, // for video/audio
	thumbnail: { 
		type: String 
	}, // for video thumbnails
	mimeType: { 
		type: String 
	},
	width: { 
		type: Number 
	}, // for images/videos
	height: { 
		type: Number 
	} // for images/videos
});

// Reply information schema
const replyInfoSchema = new mongoose.Schema({
	messageId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'Message',
		required: true 
	},
	text: { 
		type: String 
	}, // Preview of replied message
	senderName: { 
		type: String 
	},
	attachmentType: { 
		type: String 
	} // If replied message has attachment
});

// Forward information schema
const forwardInfoSchema = new mongoose.Schema({
	originalMessageId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'Message' 
	},
	originalSenderId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User' 
	},
	originalSenderName: { 
		type: String 
	},
	originalConversationId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'Conversation' 
	},
	originalConversationName: { 
		type: String 
	},
	forwardedAt: { 
		type: Date, 
		default: Date.now 
	}
});

// Thread information schema
const threadInfoSchema = new mongoose.Schema({
	parentMessageId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'Message' 
	},
	replyCount: { 
		type: Number, 
		default: 0 
	},
	lastReplyAt: { 
		type: Date 
	},
	participants: [{ 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User' 
	}]
});

// Main message schema
const messageSchema = new mongoose.Schema({
	// Basic message info
	conversationId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'Conversation',
		required: true 
	},
	senderId: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User',
		required: true 
	},
	
	// Message content
	text: { 
		type: String, 
		maxlength: 5000 
	},
	
	// Message type
	type: {
		type: String,
		enum: ['text', 'image', 'video', 'sticker', 'file', 'audio', 'emote'],
		default: 'text'
	},
	
	// Attachments (for media messages)
	attachments: [attachmentSchema],
	
	// Reply functionality
	replyTo: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'Message' 
	},
	replyInfo: replyInfoSchema,
	
	// Forward functionality
	forwardedFrom: { 
		type: mongoose.Schema.Types.ObjectId, 
		ref: 'User' 
	},
	forwardInfo: forwardInfoSchema,
	
	// Thread functionality
	threadInfo: threadInfoSchema,
	
	// Reactions
	reactions: [reactionSchema],
	
	// Message status
	isRead: { 
		type: Boolean, 
		default: false 
	},
	readBy: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	}],
	isEdited: { 
		type: Boolean, 
		default: false 
	},
	isDeleted: { 
		type: Boolean, 
		default: false 
	},
	isPinned: { 
		type: Boolean, 
		default: false 
	},
	
	// Edit history
	editHistory: [{
		text: { type: String },
		editedAt: { type: Date, default: Date.now }
	}],
	
	// Message metadata
	metadata: {
		clientMessageId: { type: String }, // For client-side message tracking
		deviceId: { type: String }, // Device that sent the message
		platform: { type: String } // Platform (ios, android, web)
	},
	
	// Sticker specific fields
	sticker: {
		stickerId: { type: String },
		stickerPackId: { type: String },
		emoji: { type: String }
	},
	
	// Emote specific fields
	emote: {
		emoteId: { type: String },
		emoteType: { type: String },
		emoji: { type: String }
	}
}, { 
	timestamps: true 
});

// Indexes for better performance
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ replyTo: 1 });
messageSchema.index({ 'threadInfo.parentMessageId': 1 });
messageSchema.index({ type: 1 });
messageSchema.index({ 'reactions.userId': 1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ isPinned: 1 });

// Virtual for reaction count
messageSchema.virtual('reactionCount').get(function() {
	return this.reactions.length;
});

// Virtual for unique reaction types
messageSchema.virtual('reactionTypes').get(function() {
	const types = {};
	this.reactions.forEach(reaction => {
		types[reaction.type] = (types[reaction.type] || 0) + 1;
	});
	return types;
});

// Method to add reaction
messageSchema.methods.addReaction = function(userId, reactionType) {
	// Remove existing reaction from this user
	this.reactions = this.reactions.filter(r => !r.userId.equals(userId));
	
	// Add new reaction
	this.reactions.push({
		userId,
		type: reactionType,
		createdAt: new Date()
	});
	
	return this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(userId) {
	this.reactions = this.reactions.filter(r => !r.userId.equals(userId));
	return this.save();
};

// Method to edit message
messageSchema.methods.editMessage = function(newText) {
	// Store edit history
	if (this.text) {
		this.editHistory.push({
			text: this.text,
			editedAt: new Date()
		});
	}
	
	this.text = newText;
	this.isEdited = true;
	return this.save();
};

// Method to delete message (soft delete)
messageSchema.methods.deleteMessage = function() {
	this.isDeleted = true;
	this.text = null;
	this.attachments = [];
	this.reactions = [];
	return this.save();
};

// Method to pin/unpin message
messageSchema.methods.togglePin = function() {
	this.isPinned = !this.isPinned;
	return this.save();
};

// Method to mark message as read by user
messageSchema.methods.markAsReadBy = function(userId) {
	if (!this.readBy.includes(userId)) {
		this.readBy.push(userId);
	}
	return this.save();
};

// Static method to get thread messages
messageSchema.statics.getThreadMessages = function(parentMessageId, limit = 50, skip = 0) {
	return this.find({
		'threadInfo.parentMessageId': parentMessageId,
		isDeleted: false
	})
	.sort({ createdAt: 1 })
	.limit(limit)
	.skip(skip)
	.populate('senderId', 'username avatarUrl')
	.populate('replyTo')
	.populate('forwardedFrom', 'username avatarUrl');
};

// Static method to get conversation messages (offset-based pagination)
messageSchema.statics.getConversationMessages = function(conversationId, limit = 50, skip = 0) {
	return this.find({
		conversationId,
		isDeleted: false
	})
	.sort({ createdAt: -1 })
	.limit(limit)
	.skip(skip)
	.populate('senderId', 'username avatarUrl')
	.populate('replyTo')
	.populate('replyInfo.messageId')
	.populate('forwardedFrom', 'username avatarUrl')
	.populate('forwardInfo.originalSenderId', 'username avatarUrl');
};

// Static method to get conversation messages with cursor-based pagination
messageSchema.statics.getConversationMessagesCursor = function(conversationId, limit = 50, lastCreatedAt = null) {
	let query = {
		conversationId,
		isDeleted: false
	};
	
	if (lastCreatedAt) {
		query.createdAt = { $lt: new Date(lastCreatedAt) };
	}
	
	return this.find(query)
	.sort({ createdAt: -1 })
	.limit(limit)
	.populate('senderId', 'username avatarUrl')
	.populate('replyTo')
	.populate('replyInfo.messageId')
	.populate('forwardedFrom', 'username avatarUrl')
	.populate('forwardInfo.originalSenderId', 'username avatarUrl');
};

export default mongoose.model('Message', messageSchema);
