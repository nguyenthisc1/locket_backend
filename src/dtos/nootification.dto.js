import { body } from 'express-validator';

export class NotificationResponseDTO {
	constructor(data) {
		this.id = data._id;
		this.userId = data.userId;
		this.fromUserId = data.fromUserId;
		this.type = data.type;
		this.title = data.title;
		this.content = data.content;
		this.imageUrl = data.imageUrl;
		this.relatedPhotoId = data.relatedPhotoId;
		this.relatedMessageId = data.relatedMessageId;
		this.relatedConversationId = data.relatedConversationId;
		this.isRead = data.isRead;
		this.priority = data.priority;
		this.createdAt = data.createdAt;
		this.readAt = data.readAt;
		this.metadata = data.metadata;
	}

	static fromNotification(notification) {
		return new NotificationResponseDTO(notification);
	}

	toJSON() {
		return {
			id: this.id,
			userId: this.userId,
			fromUserId: this.fromUserId,
			type: this.type,
			title: this.title,
			content: this.content,
			imageUrl: this.imageUrl,
			relatedPhotoId: this.relatedPhotoId,
			relatedMessageId: this.relatedMessageId,
			relatedConversationId: this.relatedConversationId,
			isRead: this.isRead,
			priority: this.priority,
			createdAt: this.createdAt,
			readAt: this.readAt,
			metadata: this.metadata
		};
	}
}

export class NotificationListResponseDTO {
	constructor(notifications, total, unreadCount) {
		this.notifications = notifications.map(n => NotificationResponseDTO.fromNotification(n));
		this.total = total;
		this.unreadCount = unreadCount;
	}

	toJSON() {
		return {
			notifications: this.notifications.map(n => n.toJSON()),
			total: this.total,
			unreadCount: this.unreadCount
		};
	}
}

export class MarkAsReadDTO {
	constructor(data) {
		this.notificationIds = data.notificationIds || [];
		this.markAllAsRead = data.markAllAsRead || false;
	}

	static validationRules() {
		return [
			body('notificationIds')
				.optional()
				.isArray()
				.withMessage('Notification IDs must be an array'),
			body('notificationIds.*')
				.optional()
				.isMongoId()
				.withMessage('Invalid notification ID format'),
			body('markAllAsRead')
				.optional()
				.isBoolean()
				.withMessage('markAllAsRead must be a boolean')
		];
	}
}