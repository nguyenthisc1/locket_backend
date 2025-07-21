import express from "express";
import { UserController } from "../controllers/user.controller.js";
import {UpdateProfileDTO} from '../dtos/user.dto.js'
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// All user routes require authentication
router.use(authMiddleware);

router.get("/", UserController.getProfile);
router.put("/", UpdateProfileDTO.validationRules(), UserController.updateProfile);
router.delete("/:userId", UserController.deleteAccount);
router.get("/search", UserController.searchUsers);

export default router;
