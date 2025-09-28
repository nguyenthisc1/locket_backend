import { Server } from 'socket.io';
import SocketAuthMiddleware from '../middleware/socket.auth.middleware.js';

class SocketManager {
  constructor(server) {
    this.io = new Server(server, {
      // cors: {
      //   origin: process.env.CLIENT_URL || "*",
      //   methods: ["GET", "POST"],
      //   credentials: true
      // },
      transports: ['websocket']
    });

    this.userSockets = new Map(); // userId -> socketId
    this.socketUsers = new Map(); // socketId -> userId

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Apply authentication middleware in order
    this.io.use(SocketAuthMiddleware.authenticate());
    // this.io.use(SocketAuthMiddleware.validateOrigin([
    //   process.env.CLIENT_URL,
    //   '*',
    //   // Add other allowed origins
    // ]));
    // this.io.use(SocketAuthMiddleware.rateLimit({
    //   windowMs: 15 * 60 * 1000, // 15 minutes
    //   maxConnections: 10 // max 10 connections per user per window
    // }));
    this.io.use(SocketAuthMiddleware.logger());

  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`✅ User connected: ${socket.userId}`);

      // Store socket mapping
      this.userSockets.set(socket.userId, socket.id);
      this.socketUsers.set(socket.id, socket.userId);

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);
      console.log(`🚪 User ${socket.userId} joined room: user:${socket.userId}`);
      console.log(`🔍 Socket rooms after join:`, Array.from(socket.rooms));

      // Auto-join user to their conversation rooms
      // this.joinUserToExistingConversations(socket);

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`❌ User disconnected: ${socket.userId} - Reason: ${reason}`);
        this.userSockets.delete(socket.userId);
        this.socketUsers.delete(socket.id);

        // Emit offline status to friends
        this.handleUserOffline(socket);
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

      // Handle message send
      socket.on('message:send', (data) => {
        console.log('message:send data', JSON.stringify(data, null, 2))
        this.handleMessageSend(socket, data);
      });

      // Handle message read receipts
      socket.on('message:read', (data) => {
        this.handleMessageRead(socket, data);
      });

      // Handle conversation join/leave
      socket.on('conversation:join', (data) => {
        this.handleConversationJoin(socket, data);
      });

      socket.on('conversation:leave', (data) => {
        this.handleConversationLeave(socket, data);
      });

      // Handle upload progress
      socket.on('upload:progress', (data) => {
        this.handleUploadProgress(socket, data);
      });

      // Emit online status to friends
      this.handleUserOnline(socket);
    });
  }

  // === MISSING METHODS - ADD THESE ===

  // Send notification to specific user
  sendNotification(userId, notification) {
    const socketId = this.userSockets.get(userId.toString());
    if (socketId) {
      this.io.to(socketId).emit('notification:new', notification);
    }
  }

  // Send notification to multiple users
  sendNotificationToUsers(userIds, notification) {
    userIds.forEach(userId => {
      this.sendNotification(userId.toString(), notification);
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
    const socketId = this.userSockets.get(userId.toString());
    if (socketId) {
      this.io.to(socketId).emit('upload:progress', {
        uploadId,
        progress
      });
    }
  }

  // Join user to conversation room
  joinConversation(userId, conversationId) {
    const socketId = this.userSockets.get(userId.toString());
    if (socketId) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.join(`conversation:${conversationId}`);
      }
    }
  }

  // Leave conversation room
  leaveConversation(userId, conversationId) {
    const socketId = this.userSockets.get(userId.toString());
    if (socketId) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.leave(`conversation:${conversationId}`);
      }
    }
  }

  // Auto-join user to their existing conversations
  async joinUserToExistingConversations(socket) {
    try {
      const { default: Conversation } = await import('../models/conversation.model.js');

      const conversations = await Conversation.find({
        participants: socket.userId,
        isActive: true
      }).select('_id');

      conversations.forEach(conversation => {
        socket.join(`conversation:${conversation._id}`);
      });

      console.log(`User ${socket.userId} joined ${conversations.length} conversation rooms`);
    } catch (error) {
      console.error('Error joining user to conversations:', error);
    }
  }

  // Handle conversation join with validation
  handleConversationJoin(socket, data) {
    const { conversationId } = data;
    if (!conversationId) return;

    socket.join(`conversation:${conversationId}`);
    console.log(`User ${socket.userId} joined conversation ${conversationId}`);
  }

  // Handle conversation leave
  handleConversationLeave(socket, data) {
    const { conversationId } = data;
    if (!conversationId) return;

    socket.leave(`conversation:${conversationId}`);
    console.log(`User ${socket.userId} left conversation ${conversationId}`);
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

  // Handle user offline status
  handleUserOffline(socket) {
    // Broadcast to friends that user is offline
    this.io.emit('user:status', {
      userId: socket.userId,
      status: 'offline',
      timestamp: new Date()
    });
  }

  // Handle message send
  handleMessageSend(socket, data) {
    const { conversationId } = data;
    console.log('Check send message', JSON.stringify(data, null, 2));

    this.io.to(`conversation:${conversationId}`).emit('message:send', {
      conversationId: conversationId,
      data
    });
  }

  // Handle message read
  handleMessageRead(socket, data) {
    const { messageId, conversationId } = data;
    // console.log('Check message', JSON.stringify(data, null, 2));
    this.io.to(`conversation:${conversationId}`).emit('message:read', {
      messageId,
      conversationId,
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
    return this.userSockets.has(userId.toString());
  }
}

export default SocketManager