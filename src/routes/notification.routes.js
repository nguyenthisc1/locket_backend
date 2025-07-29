import express from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { MarkAsReadDTO } from '../dtos/notification.dto.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

// Get user's notifications
router.get('/', NotificationController.getNotifications);

// Get notification by ID
router.get('/:notificationId', NotificationController.getNotification);

// Mark notifications as read
router.patch('/mark-read', MarkAsReadDTO.validationRules(), NotificationController.markAsRead);

// Delete notification
router.delete('/:notificationId', NotificationController.deleteNotification);

// Get unread count
router.get('/unread/count', NotificationController.getUnreadCount);

// Clear old notifications
router.delete('/clear/old', NotificationController.clearOldNotifications);

export default router;