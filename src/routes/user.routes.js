import express from "express";
import { UserController } from "../controllers/user.controller.js";
import {UpdateProfileDTO} from '../dtos/user.dto.js'
import { FriendRequestDTO, FriendStatusDTO } from '../dtos/friend.dto.js';
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// All user routes require authentication
router.use(authMiddleware);

// User profile routes
router.get("/", UserController.getProfile);
router.put("/", UpdateProfileDTO.validationRules(), UserController.updateProfile);
router.put("/avatar", UserController.updateAvatar);
router.delete("/:userId", UserController.deleteAccount);
router.get("/search", UserController.searchUsers);

// Friend management routes
router.post("/friends/request", FriendRequestDTO.validationRules(), UserController.sendFriendRequest);
router.put("/friends/request/:requestId", FriendStatusDTO.validationRules(), UserController.respondToFriendRequest);
router.get("/friends/requests", UserController.getFriendRequests);
router.get("/friends", UserController.getFriends);
router.delete("/friends/:friendId", UserController.removeFriend);
router.post("/friends/block/:userId", UserController.blockUser);
router.get("/friends/mutual/:userId", UserController.getMutualFriends);

export default router;
