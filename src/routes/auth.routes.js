import express from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { RegisterUserDTO, LoginUserDTO } from "../dtos/index.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/register", RegisterUserDTO.validationRules(), AuthController.register);
router.post("/login", LoginUserDTO.validationRules(), AuthController.login);
router.post("/refresh", AuthController.refreshToken);
router.post("/logout", AuthController.logout);

// Test endpoint to verify token
router.get("/test-token", authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: "Token is valid",
    data: {
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email
      }
    }
  });
});

export default router;
