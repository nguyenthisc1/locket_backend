import Conversation from '../models/conversation.model.js';
import User from '../models/user.model.js';

class SocketService {
    constructor(socketManager) {
        this.socketManager = socketManager;
    }

    // ===========================================
    // MESSAGE EVENTS
    // ===========================================

    // Send new message to conversation participants
    async sendNewMessage(conversationId, data, excludeUserId = null) {
        try {
            if (!this.socketManager) return;

            const room = `conversation:${conversationId}`;

            if (excludeUserId) {
                const sockets = await this.socketManager.io.in(room).fetchSockets();
                sockets.forEach(socket => {
                    const userId = this.socketManager.socketUsers.get(socket.id);
                    if (userId && userId.toString() !== excludeUserId.toString()) {
                        socket.emit("message:send", {
                            conversationId,
                            data,
                            timestamp: new Date()
                        });
                    }
                });
                console.log('test new message' + data);
            } else {

                console.log(`🔥 Emit message:send to room=${room}`, data);
                this.socketManager.io.to(room).emit("message:send", data);
            }

            console.log(`Message sent to conversation ${conversationId}`);
        } catch (error) {
            console.error("Send new message error:", error);
        }
    }

    // Send message read receipt
    async markConversationReadReceipt(conversationId, lastReadMessage, userId) {
        try {
            if (!this.socketManager) return;

            this.socketManager.io.to(`conversation:${conversationId}`).emit('message:read', {
                conversationId,
                lastReadMessage,
                userId,
                timestamp: new Date()
            });

            console.log(`Read receipt sent for conversation ${conversationId} by user ${userId}`);
        } catch (error) {
            console.error('Send message read receipt error:', error);
        }
    }

    // Send message update (edit)
    async sendMessageUpdate(conversationId, data) {
        console.log('socket 123' + data)
        try {
            if (!this.socketManager) return;

            this.socketManager.io.to(`conversation:${conversationId}`).emit('message:updated', {
                conversationId,
                data,
                timestamp: new Date()
            });

            console.log(`Message update sent for conversation ${conversationId}`);
        } catch (error) {
            console.error('Send message update error:', error);
        }
    }

    // Send message deletion
    async sendMessageDeletion(conversationId, messageId, userId) {
        try {
            if (!this.socketManager) return;

            this.socketManager.io.to(`conversation:${conversationId}`).emit('message:deleted', {
                conversationId,
                messageId,
                userId,
                timestamp: new Date()
            });

            console.log(`Message deletion sent for conversation ${conversationId}`);
        } catch (error) {
            console.error('Send message deletion error:', error);
        }
    }

    // ===========================================
    // CONVERSATION EVENTS
    // ===========================================

    // Send new conversation creation
    async sendNewConversation(conversation, participants) {
        try {
            if (!this.socketManager) return;

            participants.forEach(participantId => {
                this.socketManager.joinConversation(participantId.toString(), conversation._id);
                this.socketManager.sendNotification(participantId.toString(), {
                    type: 'conversation_invite',
                    title: 'New Conversation',
                    content: `You've been added to ${conversation.isGroup ? 'a group' : 'a conversation'}`,
                    relatedConversationId: conversation._id,
                    timestamp: new Date()
                });
            });

            console.log(`New conversation ${conversation._id} participants notified`);
        } catch (error) {
            console.error('Send new conversation error:', error);
        }
    }

    // Send conversation update
    async sendConversationUpdate(conversationId, updateData, userId) {
        try {
            if (!this.socketManager) return;

            this.socketManager.io.to(`conversation:${conversationId}`).emit('conversation:updated', {
                conversationId,
                updateData,
                updatedBy: userId,
                timestamp: new Date()
            });

            console.log(`Conversation update sent for ${conversationId}`);
        } catch (error) {
            console.error('Send conversation update error:', error);
        }
    }

    // Send participant added to conversation
    async sendParticipantAdded(conversationId, newParticipantId, addedBy) {
        try {
            if (!this.socketManager) return;

            // Join new participant to conversation room
            this.socketManager.joinConversation(newParticipantId.toString(), conversationId);

            // Notify all participants
            this.socketManager.io.to(`conversation:${conversationId}`).emit('conversation:participant_added', {
                conversationId,
                newParticipantId,
                addedBy,
                timestamp: new Date()
            });

            console.log(`Participant ${newParticipantId} added to conversation ${conversationId}`);
        } catch (error) {
            console.error('Send participant added error:', error);
        }
    }

    // Send participant removed from conversation
    async sendParticipantRemoved(conversationId, removedParticipantId, removedBy) {
        try {
            if (!this.socketManager) return;

            // Remove participant from conversation room
            this.socketManager.leaveConversation(removedParticipantId.toString(), conversationId);

            // Notify remaining participants
            this.socketManager.io.to(`conversation:${conversationId}`).emit('conversation:participant_removed', {
                conversationId,
                removedParticipantId,
                removedBy,
                timestamp: new Date()
            });

            console.log(`Participant ${removedParticipantId} removed from conversation ${conversationId}`);
        } catch (error) {
            console.error('Send participant removed error:', error);
        }
    }

    // ===========================================
    // TYPING INDICATORS
    // ===========================================

    // Send typing start indicator
    async sendTypingStart(conversationId, userId) {
        try {
            if (!this.socketManager) return;

            this.socketManager.sendTypingIndicator(conversationId, userId, true);
            console.log(`Typing start sent for user ${userId} in conversation ${conversationId}`);
        } catch (error) {
            console.error('Send typing start error:', error);
        }
    }

    // Send typing stop indicator
    async sendTypingStop(conversationId, userId) {
        try {
            if (!this.socketManager) return;

            this.socketManager.sendTypingIndicator(conversationId, userId, false);
            console.log(`Typing stop sent for user ${userId} in conversation ${conversationId}`);
        } catch (error) {
            console.error('Send typing stop error:', error);
        }
    }

    // ===========================================
    // USER STATUS EVENTS
    // ===========================================

    // Send user online status
    async sendUserOnlineStatus(userId, status = 'online') {
        try {
            if (!this.socketManager) return;

            // Get user's friends to notify
            const user = await User.findById(userId).populate('friends', '_id');
            if (!user) return;

            // Notify friends about status change
            user.friends.forEach(friend => {
                this.socketManager.sendNotification(friend._id.toString(), {
                    type: 'user_status',
                    userId,
                    status,
                    timestamp: new Date()
                });
            });

            console.log(`User ${userId} status updated to ${status}`);
        } catch (error) {
            console.error('Send user online status error:', error);
        }
    }

    // Send user offline status
    async sendUserOfflineStatus(userId) {
        await this.sendUserOnlineStatus(userId, 'offline');
    }

    // ===========================================
    // FEED EVENTS
    // ===========================================

    // Send new feed notification to friends
    async sendNewFeedNotification(feed, userId) {
        try {
            if (!this.socketManager) return;

            // Get user's friends
            const user = await User.findById(userId).populate('friends', '_id');
            if (!user) return;

            // Notify friends about new feed
            const friendIds = user.friends.map(friend => friend._id.toString());
            friendIds.forEach(friendId => {
                this.socketManager.sendNotification(friendId, {
                    type: 'new_feed',
                    title: 'New Feed',
                    content: `${user.username} shared a new ${feed.mediaType}`,
                    imageUrl: feed.imageUrl,
                    relatedFeedId: feed._id,
                    fromUserId: userId,
                    timestamp: new Date()
                });
            });

            console.log(`New feed notification sent to ${friendIds.length} friends`);
        } catch (error) {
            console.error('Send new feed notification error:', error);
        }
    }

    // Send feed reaction
    async sendFeedReaction(feedId, reaction, userId) {
        try {
            if (!this.socketManager) return;

            // Emit to all users who have access to this feed
            this.socketManager.io.emit('feed:reaction', {
                feedId,
                reaction,
                userId,
                timestamp: new Date()
            });

            console.log(`Feed reaction sent for feed ${feedId}`);
        } catch (error) {
            console.error('Send feed reaction error:', error);
        }
    }

    // ===========================================
    // UTILITY METHODS
    // ===========================================

    // Join user to multiple conversation rooms
    async joinUserToConversations(userId) {
        try {
            if (!this.socketManager) return;

            // Get all user's active conversations
            const conversations = await Conversation.find({
                participants: userId,
                isActive: true
            }).select('_id');

            // Join user to all conversation rooms
            conversations.forEach(conversation => {
                this.socketManager.joinConversation(userId, conversation._id.toString());
            });

            console.log(`User ${userId} joined ${conversations.length} conversation rooms`);
        } catch (error) {
            console.error('Join user to conversations error:', error);
        }
    }

    // Get online users in conversation
    async getOnlineUsersInConversation(conversationId) {
        try {
            if (!this.socketManager) return [];

            const conversation = await Conversation.findById(conversationId).populate('participants', '_id');
            if (!conversation) return [];

            const onlineUsers = conversation.participants.filter(participant =>
                this.socketManager.isUserOnline(participant._id.toString())
            );

            return onlineUsers.map(user => user._id.toString());
        } catch (error) {
            console.error('Get online users in conversation error:', error);
            return [];
        }
    }

    // Send custom event to user
    async sendCustomEventToUser(userId, eventName, data) {
        try {
            if (!this.socketManager) return;

            const socketId = this.socketManager.userSockets.get(userId);
            if (socketId) {
                this.socketManager.io.to(socketId).emit(eventName, {
                    ...data,
                    timestamp: new Date()
                });
            }

            console.log(`Custom event ${eventName} sent to user ${userId}`);
        } catch (error) {
            console.error('Send custom event to user error:', error);
        }
    }

    // Send custom event to conversation
    async sendCustomEventToConversation(conversationId, eventName, data) {
        try {
            if (!this.socketManager) return;

            this.socketManager.io.to(`conversation:${conversationId}`).emit(eventName, {
                ...data,
                conversationId,
                timestamp: new Date()
            });

            console.log(`Custom event ${eventName} sent to conversation ${conversationId}`);
        } catch (error) {
            console.error('Send custom event to conversation error:', error);
        }
    }

    // ===========================================
    // HELPER METHODS
    // ===========================================

    // Check if socket manager is available
    isAvailable() {
        return !!this.socketManager;
    }

    // Get connected users count
    getConnectedUsersCount() {
        return this.socketManager ? this.socketManager.getOnlineUsers().length : 0;
    }

    // Get all online users
    getOnlineUsers() {
        return this.socketManager ? this.socketManager.getOnlineUsers() : [];
    }
}

export default SocketService;