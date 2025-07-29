import { validationResult } from 'express-validator';
import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import { 
	NotificationResponseDTO, 
	NotificationListResponseDTO, 
	MarkAsReadDTO 
} from '../dtos/notification.dto.js';
import { 
	createSuccessResponse, 
	createErrorResponse, 
	createValidationErrorResponse, 
	detectLanguage 
} from '../utils/translations.js';

export class NotificationController {
	// Get user's notifications
	static async getNotifications(req, res) {
		try {
			const userId = req.user._id;
			const { page = 1, limit = 20, type, isRead } = req.query;
			const skip = (page - 1) * limit;

			// Build query
			const query = { userId, isDeleted: false };
			if (type) query.type = type;
			if (isRead !== undefined) query.isRead = isRead === 'true';

			// Get notifications with pagination
			const notifications = await Notification.find(query)
				.populate('fromUserId', 'username avatarUrl')
				.populate('relatedPhotoId', 'imageUrl caption')
				.populate('relatedMessageId', 'text type')
				.populate('relatedConversationId', 'name')
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(parseInt(limit));

			// Get total count
			const total = await Notification.countDocuments(query);
			const unreadCount = await Notification.getUnreadCount(userId);

			const response = new NotificationListResponseDTO(notifications, total, unreadCount);

			res.json(createSuccessResponse(
				"notification.notificationsRetrieved", 
				response.toJSON(), 
				detectLanguage(req)
			));
		} catch (error) {
			console.error('Get notifications error:', error);
			res.status(500).json(createErrorResponse(
				"notification.notificationsRetrieveFailed", 
				error.message, 
				null, 
				detectLanguage(req)
			));
		}
	}

	// Get notification by ID
	static async getNotification(req, res) {
		try {
			const { notificationId } = req.params;
			const userId = req.user._id;

			const notification = await Notification.findOne({
				_id: notificationId,
				userId,
				isDeleted: false
			})
			.populate('fromUserId', 'username avatarUrl')
			.populate('relatedPhotoId', 'imageUrl caption')
			.populate('relatedMessageId', 'text type')
			.populate('relatedConversationId', 'name');

			if (!notification) {
				return res.status(404).json(createErrorResponse(
					"notification.notificationNotFound", 
					null, 
					null, 
					detectLanguage(req)
				));
			}

			const response = NotificationResponseDTO.fromNotification(notification);

			res.json(createSuccessResponse(
				"notification.notificationRetrieved", 
				response.toJSON(), 
				detectLanguage(req)
			));
		} catch (error) {
			console.error('Get notification error:', error);
			res.status(500).json(createErrorResponse(
				"notification.notificationRetrieveFailed", 
				error.message, 
				null, 
				detectLanguage(req)
			));
		}
	}

	// Mark notifications as read
	static async markAsRead(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const userId = req.user._id;
			const markAsReadDTO = new MarkAsReadDTO(req.body);

			if (markAsReadDTO.markAllAsRead) {
				// Mark all notifications as read
				await Notification.updateMany(
					{ userId, isRead: false, isDeleted: false },
					{ $set: { isRead: true, readAt: new Date() } }
				);
			} else if (markAsReadDTO.notificationIds.length > 0) {
				// Mark specific notifications as read
				await Notification.markAsRead(userId, markAsReadDTO.notificationIds);
			} else {
				return res.status(400).json(createErrorResponse(
					"notification.noNotificationsToMark", 
					null, 
					null, 
					detectLanguage(req)
				));
			}

			// Get updated unread count
			const unreadCount = await Notification.getUnreadCount(userId);

			res.json(createSuccessResponse(
				"notification.markedAsRead", 
				{ unreadCount }, 
				detectLanguage(req)
			));
		} catch (error) {
			console.error('Mark as read error:', error);
			res.status(500).json(createErrorResponse(
				"notification.markAsReadFailed", 
				error.message, 
				null, 
				detectLanguage(req)
			));
		}
	}

	// Delete notification
	static async deleteNotification(req, res) {
		try {
			const { notificationId } = req.params;
			const userId = req.user._id;

			const notification = await Notification.findOneAndUpdate(
				{ _id: notificationId, userId, isDeleted: false },
				{ $set: { isDeleted: true } },
				{ new: true }
			);

			if (!notification) {
				return res.status(404).json(createErrorResponse(
					"notification.notificationNotFound", 
					null, 
					null, 
					detectLanguage(req)
				));
			}

			res.json(createSuccessResponse(
				"notification.notificationDeleted", 
				null, 
				detectLanguage(req)
			));
		} catch (error) {
			console.error('Delete notification error:', error);
			res.status(500).json(createErrorResponse(
				"notification.notificationDeleteFailed", 
				error.message, 
				null, 
				detectLanguage(req)
			));
		}
	}

	// Get unread count
	static async getUnreadCount(req, res) {
		try {
			const userId = req.user._id;
			const unreadCount = await Notification.getUnreadCount(userId);

			res.json(createSuccessResponse(
				"notification.unreadCountRetrieved", 
				{ unreadCount }, 
				detectLanguage(req)
			));
		} catch (error) {
			console.error('Get unread count error:', error);
			res.status(500).json(createErrorResponse(
				"notification.unreadCountRetrieveFailed", 
				error.message, 
				null, 
				detectLanguage(req)
			));
		}
	}

	// Clear old notifications
	static async clearOldNotifications(req, res) {
		try {
			const userId = req.user._id;
			const { daysOld = 30 } = req.body;

			await Notification.deleteOldNotifications(userId, daysOld);

			res.json(createSuccessResponse(
				"notification.oldNotificationsCleared", 
				null, 
				detectLanguage(req)
			));
		} catch (error) {
			console.error('Clear old notifications error:', error);
			res.status(500).json(createErrorResponse(
				"notification.clearOldNotificationsFailed", 
				error.message, 
				null, 
				detectLanguage(req)
			));
		}
	}
}