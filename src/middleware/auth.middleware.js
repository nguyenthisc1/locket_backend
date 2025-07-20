import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // Debug logging
  // console.log('🔐 Auth Middleware Debug:');
  // console.log('Headers:', req.headers);
  // console.log('Authorization header:', authHeader);

  if (!authHeader?.startsWith('Bearer ')) {
    console.log('❌ No Bearer token found in Authorization header');
    return res.status(401).json({ 
      message: 'Missing or invalid token',
      debug: {
        hasAuthHeader: !!authHeader,
        authHeaderValue: authHeader,
        expectedFormat: 'Bearer YOUR_TOKEN'
      }
    });
  }

  const token = authHeader.split(' ')[1];
  console.log('🔑 Token extracted:', token ? `${token.substring(0, 20)}...` : 'null');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified, user ID:', decoded.id);
    
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(401).json({ message: 'User not found' });
    }

    console.log('✅ User found:', user.username);
    req.user = user;
    next();
  } catch (err) {
    console.log('❌ Token verification failed:', err.message);
    return res.status(401).json({ 
      message: 'Invalid or expired token', 
      error: err.message,
      debug: {
        tokenLength: token ? token.length : 0,
        jwtSecretExists: !!process.env.JWT_SECRET
      }
    });
  }
};

export default authMiddleware;