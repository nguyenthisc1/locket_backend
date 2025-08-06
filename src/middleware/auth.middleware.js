import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { createErrorResponse, detectLanguage } from '../utils/translations.js';

const authMiddleware = async (req, res, next) => {
  // Check multiple possible token sources
  const authHeader = req.headers.authorization;
  const cookieAccessToken = req.cookies?.accessToken; // Only access token from cookies
  const queryToken = req.query.token;
  const bodyToken = req.body?.token;
  
  // Debug logging
  console.log('Auth Debug:', { 
    authHeader: !!authHeader, 
    cookieAccessToken: !!cookieAccessToken, 
    queryToken: !!queryToken, 
    bodyToken: !!bodyToken 
  });

  // Get available tokens in priority order
  const tokens = [];
  if (authHeader?.startsWith('Bearer ')) {
    tokens.push({ source: 'Authorization header', token: authHeader.split(' ')[1] });
  }
  if (cookieAccessToken) {
    tokens.push({ source: 'Cookie access token', token: cookieAccessToken });
  }
  if (queryToken) {
    tokens.push({ source: 'Query token', token: queryToken });
  }
  if (bodyToken) {
    tokens.push({ source: 'Body token', token: bodyToken });
  }

  if (tokens.length === 0) {
    return res.status(401).json(createErrorResponse("auth.missingToken", null, null, detectLanguage(req)));
  }

  // Try tokens in priority order with fallback
  for (let i = 0; i < tokens.length; i++) {
    const { source, token } = tokens[i];
    
    try {
      console.log(`Trying ${source}...`);
      console.log('Token preview:', token.substring(0, 20) + '...');
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log(`✅ ${source} verified successfully for user:`, decoded.id);
      
      // Check if user exists
      const user = await User.findById(decoded.id).select('-passwordHash');
      if (!user) {
        console.log(`❌ User not found for ${source}`);
        continue; // Try next token
      }

      // Success! Add user to request object
      req.user = user;
      return next();
      
    } catch (err) {
      console.log(`❌ ${source} failed:`, err.name, err.message);
      if (err.name === 'TokenExpiredError') {
        console.log('Token expired at:', err.expiredAt);
      }
      
      // If this is the last token, return error
      if (i === tokens.length - 1) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json(createErrorResponse("auth.tokenExpired", null, null, detectLanguage(req)));
        } else if (err.name === 'JsonWebTokenError') {
          return res.status(401).json(createErrorResponse("auth.invalidToken", null, null, detectLanguage(req)));
        } else {
          return res.status(401).json(createErrorResponse("auth.tokenVerificationFailed", err.message, null, detectLanguage(req)));
        }
      }
      // Continue to next token
    }
  }
};

export default authMiddleware;