import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export class SocketManager {
	constructor(server) {
		this.io = new Server(server, {
			cors: {
				origin: process.env.CLIENT_URL || "http://localhost:3000",
				methods: ["GET", "POST"],
				credentials: true
			},
			transports: ['websocket', 'polling']
		});

		this.userSockets = new Map(); // userId -> socketId
		this.socketUsers = new Map(); // socketId -> userId

		this.setupMiddleware();
		this.setupEventHandlers();
	}

	setupMiddleware() {
		// Authentication middleware
		this.io.use(async (socket, next) => {
			try {
				const token = socket.handshake.auth.token || 
							 socket.handshake.headers.authorization?.split(' ')[1];

				if (!token) {
					return next(new Error('Authentication error: No token provided'));
				}

				const decoded = jwt.verify(token, process.env.JWT_SECRET);
				const user = await User.findById(decoded.id).select('-passwordHash');

				if (!user) {
					return next(new Error('Authentication error: User not found'));
				}

				socket.userId = user._id.toString();
				socket.user = user;
				next();
			} catch (error) {
				next(new Error('Authentication error: Invalid token'));
			}
		});
	}

	setupEventHandlers() {
		this.io.on('connection', (socket) => {
			console.log(`User connected: ${socket.userId}`);

			// Store socket mapping
			this.userSockets.set(socket.userId, socket.id);
			this.socketUsers.set(socket.id, socket.userId);

			// Join user to their personal room
			socket.join(`user:${socket.userId}`);

			// Handle disconnection
			socket.on('disconnect', () => {
				console.log(`User disconnected: ${socket.userId}`);
				this.userSockets.delete(socket.userId);
				this.socketUsers.delete(socket.id);
			});

			// Handle typing events
			socket.on('typing:start', (data) => {
				this.handleTypingStart(socket, data);
			});

			socket.on('typing:stop', (data) => {
				this.handleTypingStop(socket, data);
			});

			// Handle online status
			socket.on('user:online', () => {
				this.handleUserOnline(socket);
			});

			// Handle message read receipts
			socket.on('message:read', (data) => {
				this.handleMessageRead(socket, data);
			});

			// Handle upload progress
			socket.on('upload:progress', (data) => {
				this.handleUploadProgress(socket, data);
			});
		});
	}

	// Send notification to specific user
	sendNotification(userId, notification) {
		const socketId = this.userSockets.get(userId);
		if (socketId) {
			this.io.to(socketId).emit('notification:new', notification);
		}
	}

	// Send notification to multiple users
	sendNotificationToUsers(userIds, notification) {
		userIds.forEach(userId => {
			this.sendNotification(userId, notification);
		});
	}

	// Send message to conversation participants
	sendMessageToConversation(conversationId, message, excludeUserId = null) {
		this.io.to(`conversation:${conversationId}`).emit('message:new', {
			conversationId,
			message,
			excludeUserId
		});
	}

	// Send typing indicator
	sendTypingIndicator(conversationId, userId, isTyping) {
		this.io.to(`conversation:${conversationId}`).emit('typing:update', {
			conversationId,
			userId,
			isTyping
		});
	}

	// Send upload progress
	sendUploadProgress(userId, uploadId, progress) {
		const socketId = this.userSockets.get(userId);
		if (socketId) {
			this.io.to(socketId).emit('upload:progress', {
				uploadId,
				progress
			});
		}
	}

	// Join user to conversation room
	joinConversation(userId, conversationId) {
		const socketId = this.userSockets.get(userId);
		if (socketId) {
			this.io.sockets.sockets.get(socketId).join(`conversation:${conversationId}`);
		}
	}

	// Leave conversation room
	leaveConversation(userId, conversationId) {
		const socketId = this.userSockets.get(userId);
		if (socketId) {
			this.io.sockets.sockets.get(socketId).leave(`conversation:${conversationId}`);
		}
	}

	// Handle typing start
	handleTypingStart(socket, data) {
		const { conversationId } = data;
		this.sendTypingIndicator(conversationId, socket.userId, true);
	}

	// Handle typing stop
	handleTypingStop(socket, data) {
		const { conversationId } = data;
		this.sendTypingIndicator(conversationId, socket.userId, false);
	}

	// Handle user online
	handleUserOnline(socket) {
		// Broadcast to friends that user is online
		this.io.emit('user:status', {
			userId: socket.userId,
			status: 'online',
			timestamp: new Date()
		});
	}

	// Handle message read
	handleMessageRead(socket, data) {
		const { messageId, conversationId } = data;
		this.io.to(`conversation:${conversationId}`).emit('message:read', {
			messageId,
			userId: socket.userId,
			timestamp: new Date()
		});
	}

	// Handle upload progress
	handleUploadProgress(socket, data) {
		const { uploadId, progress } = data;
		this.sendUploadProgress(socket.userId, uploadId, progress);
	}

	// Get online users
	getOnlineUsers() {
		return Array.from(this.userSockets.keys());
	}

	// Check if user is online
	isUserOnline(userId) {
		return this.userSockets.has(userId);
	}
}

export default SocketManager;