import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

const authMiddleware = async (req, res, next) => {
  let token;

  // Prefer Authorization header, fallback to cookie
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.refreshToken) {
    token = req.cookies.refreshToken;
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ message: 'Missing or invalid token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export default authMiddleware;