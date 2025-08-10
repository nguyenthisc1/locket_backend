import express from "express";
import { FeedController } from "../controllers/feed.controller.js";
import { AddReactionDTO, CreateFeedDTO, UpdateFeedDTO } from "../dtos/index.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

// Get all feeds
router.get("/", FeedController.getFeeds);

// Get feed by ID
router.get("/:feedId", FeedController.getFeedById);

// Get user feeds
router.get("/user/:userId", FeedController.getUserFeeds)

// Create feed from uploaded media
router.post("/", FeedController.createFeed);

// Create feed (legacy)
router.post("/legacy", CreateFeedDTO.validationRules(), FeedController.createFeed);

// Update feed
router.put("/:feedId", UpdateFeedDTO.validationRules(), FeedController.updateFeed);

// Delete feed
router.delete("/:feedId", FeedController.deleteFeed);

// Feed reactions
router.post("/:feedId/reactions", AddReactionDTO.validationRules(), FeedController.addReaction);
router.delete("/:feedId/reactions/:reactionType", FeedController.removeReaction);

export default router;
