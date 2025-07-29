import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import { getTranslation } from './translations.js';

export class NotificationService {
	constructor(socketManager) {
		this.socketManager = socketManager;
	}

	// Create and send notification
	async createAndSendNotification(data) {
		try {
			const notification = await this.createNotification(data);
			
			// Send real-time notification
			if (this.socketManager) {
				this.socketManager.sendNotification(data.userId, {
					id: notification._id,
					type: notification.type,
					title: notification.title,
					content: notification.content,
					imageUrl: notification.imageUrl,
					relatedPhotoId: notification.relatedPhotoId,
					relatedMessageId: notification.relatedMessageId,
					relatedConversationId: notification.relatedConversationId,
					createdAt: notification.createdAt,
					priority: notification.priority
				});
			}

			return notification;
		} catch (error) {
			console.error('Create and send notification error:', error);
			throw error;
		}
	}

	// Create a new notification
	async createNotification(data) {
		try {
			const {
				userId,
				fromUserId,
				type,
				title,
				content,
				imageUrl,
				relatedPhotoId,
				relatedMessageId,
				relatedConversationId,
				priority = 'normal',
				metadata = {},
				expiresAt
			} = data;

			// Validate user exists
			const user = await User.findById(userId);
			if (!user) {
				throw new Error('User not found');
			}

			// Create notification
			const notification = new Notification({
				userId,
				fromUserId,
				type,
				title,
				content,
				imageUrl,
				relatedPhotoId,
				relatedMessageId,
				relatedConversationId,
				priority,
				metadata,
				expiresAt
			});

			await notification.save();
			return notification;
		} catch (error) {
			console.error('Create notification error:', error);
			throw error;
		}
	}

	// Create photo-related notifications with socket
	async createPhotoNotification(photo, action, fromUserId) {
		try {
			const notifications = [];

			// Get users to notify (shared with + owner)
			const usersToNotify = new Set([photo.userId.toString()]);
			if (photo.sharedWith) {
				photo.sharedWith.forEach(userId => {
					usersToNotify.add(userId.toString());
				});
			}

			// Remove the user who performed the action
			usersToNotify.delete(fromUserId.toString());

			// Create notifications for each user
			for (const userId of usersToNotify) {
				let title, content;

				switch (action) {
					case 'new_photo':
						title = getTranslation('notification.newPhotoTitle', 'vi');
						content = getTranslation('notification.newPhotoContent', 'vi');
						break;
					case 'photo_like':
						title = getTranslation('notification.photoLikeTitle', 'vi');
						content = getTranslation('notification.photoLikeContent', 'vi');
						break;
					case 'photo_comment':
						title = getTranslation('notification.photoCommentTitle', 'vi');
						content = getTranslation('notification.photoCommentContent', 'vi');
						break;
					default:
						continue;
				}

				const notification = await this.createAndSendNotification({
					userId,
					fromUserId,
					type: action,
					title,
					content,
					imageUrl: photo.imageUrl,
					relatedPhotoId: photo._id,
					priority: action === 'new_photo' ? 'high' : 'normal'
				});

				notifications.push(notification);
			}

			return notifications;
		} catch (error) {
			console.error('Create photo notification error:', error);
			throw error;
		}
	}

	// Create message notifications with socket
	async createMessageNotification(conversation, message, fromUserId) {
		try {
			const notifications = [];

			// Get participants to notify (excluding sender)
			const participantsToNotify = conversation.participants.filter(
				participantId => participantId.toString() !== fromUserId.toString()
			);

			for (const userId of participantsToNotify) {
				const notification = await this.createAndSendNotification({
					userId,
					fromUserId,
					type: 'message',
					title: getTranslation('notification.newMessageTitle', 'vi'),
					content: getTranslation('notification.newMessageContent', 'vi'),
					relatedMessageId: message._id,
					relatedConversationId: conversation._id,
					priority: 'high'
				});

				notifications.push(notification);
			}

			return notifications;
		} catch (error) {
			console.error('Create message notification error:', error);
			throw error;
		}
	}

	// Create friend request notification with socket
	async createFriendRequestNotification(toUserId, fromUserId) {
		try {
			const notification = await this.createAndSendNotification({
				userId: toUserId,
				fromUserId,
				type: 'friend_request',
				title: getTranslation('notification.friendRequestTitle', 'vi'),
				content: getTranslation('notification.friendRequestContent', 'vi'),
				priority: 'normal'
			});

			return notification;
		} catch (error) {
			console.error('Create friend request notification error:', error);
			throw error;
		}
	}

	// Create group update notification with socket
	async createGroupUpdateNotification(conversation, action, fromUserId) {
		try {
			const notifications = [];

			// Notify all participants except the one who made the change
			const participantsToNotify = conversation.participants.filter(
				participantId => participantId.toString() !== fromUserId.toString()
			);

			let title, content;

			switch (action) {
				case 'member_added':
					title = getTranslation('notification.memberAddedTitle', 'vi');
					content = getTranslation('notification.memberAddedContent', 'vi');
					break;
				case 'member_removed':
					title = getTranslation('notification.memberRemovedTitle', 'vi');
					content = getTranslation('notification.memberRemovedContent', 'vi');
					break;
				case 'group_updated':
					title = getTranslation('notification.groupUpdatedTitle', 'vi');
					content = getTranslation('notification.groupUpdatedContent', 'vi');
					break;
				default:
					return notifications;
			}

			for (const userId of participantsToNotify) {
				const notification = await this.createAndSendNotification({
					userId,
					fromUserId,
					type: 'group_update',
					title,
					content,
					relatedConversationId: conversation._id,
					priority: 'normal'
				});

				notifications.push(notification);
			}

			return notifications;
		} catch (error) {
			console.error('Create group update notification error:', error);
			throw error;
		}
	}
}