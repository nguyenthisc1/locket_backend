import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

/**
 * SocketAuthMiddleware
 * 
 * Handles authentication, authorization, rate limiting, and logging for Socket.IO connections.
 * 
 * Updated to expect both 'token' and 'userId' in the socket handshake auth object,
 * matching the client connection pattern:
 * 
 *   IO.io(
 *     serverUrl,
 *     IO.OptionBuilder()
 *       .setTransports(['websocket'])
 *       .setAuth({'token': authToken, 'userId': userId})
 *       .enableAutoConnect()
 *       .build(),
 *   );
 */
export class SocketAuthMiddleware {
  /**
   * Main authentication middleware for Socket.IO.
   * Expects both 'token' and 'userId' in socket.handshake.auth.
   */
  static authenticate() {
    return async (socket, next) => {
      try {
        console.log('🔐 Socket authentication attempt for socket:', socket.id);

        // Extract token and userId
        const { token, userId } = SocketAuthMiddleware.extractAuthCredentials(socket);

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }
        if (!userId) {
          return next(new Error('Authentication error: No userId provided'));
        }

        // ✅ Verify token
        const decoded = await SocketAuthMiddleware.verifyToken(token);
        if (!decoded) {
          return next(new Error('Authentication error: Invalid token'));
        }

        // ✅ Ensure token id matches userId
        if (decoded.id !== userId) {
          return next(new Error('Authentication error: Token userId mismatch'));
        }

        // (Optional) fetch user từ DB
        const user = await SocketAuthMiddleware.getUser(userId);
        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        // Attach info vào socket
        socket.userId = userId;
        socket.user = user;
        socket.authenticated = true;

        console.log('✅ Socket authenticated successfully:', {
          socketId: socket.id,
          userId: socket.userId,
          username: socket.user.username
        });

        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error(`Authentication error: ${error.message}`));
      }
    };
  }

  /**
   * Extracts 'token' and 'userId' from the socket handshake.
   * Priority: handshake.auth, then fallback to legacy methods for token only.
   * @param {Socket} socket 
   * @returns {{token: string|null, userId: string|null}}
   */
  static extractAuthCredentials(socket) {
    const handshake = socket.handshake;
    let token = null;
    let userId = null;

    // Preferred: handshake.auth.token and handshake.auth.userId
    if (handshake.auth) {
      if (handshake.auth.token) {
        token = handshake.auth.token;
      }
      if (handshake.auth.userId) {
        userId = handshake.auth.userId;
      }
    }

    // Fallback for token only (legacy support)
    if (!token) {
      // Authorization header
      if (handshake.headers && handshake.headers.authorization) {
        const authHeader = handshake.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        }
      }
      // Query parameter 'token'
      else if (handshake.query && handshake.query.token) {
        token = handshake.query.token;
      }
      // Query parameter 'access_token'
      else if (handshake.query && handshake.query.access_token) {
        token = handshake.query.access_token;
      }
    }

    // Log extraction details
    console.log('🔍 Extracting credentials from handshake:', {
      hasAuthToken: !!handshake.auth?.token,
      hasAuthUserId: !!handshake.auth?.userId,
      hasAuthHeader: !!handshake.headers?.authorization,
      hasQueryToken: !!handshake.query?.token,
      hasAccessToken: !!handshake.query?.access_token
    });

    return { token, userId };
  }

  // Verify JWT token
  static async verifyToken(token) {
    return new Promise((resolve) => {
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          console.log('JWT verification failed:', err.name, err.message);
          resolve(null);
        } else {
          console.log('✅ JWT verified for user ID:', decoded.id);
          resolve(decoded);
        }
      });
    });
  }

  // Get user from database
  static async getUser(userId) {
    try {
      const user = await User.findById(userId).select('-passwordHash');
      return user;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  // Middleware to check if socket is authenticated
  static requireAuth() {
    return (socket, next) => {
      if (socket.authenticated && socket.user) {
        next();
      } else {
        next(new Error('Socket not authenticated'));
      }
    };
  }

  // Middleware to check user permissions
  static requirePermission(permission) {
    return (socket, next) => {
      if (!socket.authenticated || !socket.user) {
        return next(new Error('Socket not authenticated'));
      }

      // Add your permission logic here
      // For example, checking user role or specific permissions
      if (socket.user.role && socket.user.permissions?.includes(permission)) {
        next();
      } else {
        next(new Error(`Permission denied: ${permission} required`));
      }
    };
  }

  // Middleware to rate limit socket connections per user
  static rateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      maxConnections = 5, // max connections per window
    } = options;

    const connections = new Map(); // userId -> { count, resetTime }

    return (socket, next) => {
      if (!socket.userId) {
        return next(new Error('User ID required for rate limiting'));
      }

      const now = Date.now();
      const userConnections = connections.get(socket.userId) || { count: 0, resetTime: now + windowMs };

      // Reset counter if window has expired
      if (now > userConnections.resetTime) {
        userConnections.count = 0;
        userConnections.resetTime = now + windowMs;
      }

      // Check if user has exceeded the limit
      if (userConnections.count >= maxConnections) {
        console.log(`❌ Rate limit exceeded for user ${socket.userId}`);
        return next(new Error('Too many connections. Please try again later.'));
      }

      // Increment counter
      userConnections.count++;
      connections.set(socket.userId, userConnections);

      // Clean up on disconnect
      socket.on('disconnect', () => {
        const userConns = connections.get(socket.userId);
        if (userConns) {
          userConns.count = Math.max(0, userConns.count - 1);
          if (userConns.count === 0) {
            connections.delete(socket.userId);
          }
        }
      });

      next();
    };
  }

  // Middleware to log connection attempts
  static logger() {
    return (socket, next) => {
      const handshake = socket.handshake;
      // console.log('Socket response:', socket)
      console.log('🔗 Socket connection attempt:', {
        socketId: socket.id,
        userId: socket.userId,
        ip: handshake.address,
        userAgent: handshake.headers['user-agent'],
        origin: handshake.headers.origin,
        timestamp: new Date().toISOString()
      });
      next();
    };
  }

  // Middleware to validate origin
  static validateOrigin(allowedOrigins = []) {
    return (socket, next) => {
      const origin = socket.handshake.headers.origin;

      if (allowedOrigins.length === 0) {
        return next(); // No origin validation
      }

      if (!origin || !allowedOrigins.includes(origin)) {
        console.log(`❌ Invalid origin: ${origin}`);
        return next(new Error('Invalid origin'));
      }

      console.log(`✅ Valid origin: ${origin}`);
      next();
    };
  }
}

export default SocketAuthMiddleware;