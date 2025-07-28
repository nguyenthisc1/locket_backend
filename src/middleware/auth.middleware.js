import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { createErrorResponse, detectLanguage } from '../utils/translations.js';

const authMiddleware = async (req, res, next) => {
  let token;

  // Check multiple possible token sources
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.accessToken || req.cookies?.refreshToken;
  const queryToken = req.query.token;
  const bodyToken = req.body?.token;

  // Priority order: Authorization header > Cookie > Query > Body
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (cookieToken) {
    token = cookieToken;
  } else if (queryToken) {
    token = queryToken;
  } else if (bodyToken) {
    token = bodyToken;
  }

  if (!token) {
    return res.status(401).json(createErrorResponse("auth.missingToken", null, null, detectLanguage(req)));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json(createErrorResponse("auth.userNotFound", null, null, detectLanguage(req)));
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (err) {
    // Provide more specific error messages
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json(createErrorResponse("auth.tokenExpired", null, null, detectLanguage(req)));
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json(createErrorResponse("auth.invalidToken", null, null, detectLanguage(req)));
    } else {
      return res.status(401).json(createErrorResponse("auth.tokenVerificationFailed", err.message, null, detectLanguage(req)));
    }
  }
};

export default authMiddleware;