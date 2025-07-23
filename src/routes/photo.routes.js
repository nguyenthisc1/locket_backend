import express from "express";
import { PhotoController } from "../controllers/photo.controller.js";
import { AddReactionDTO, CreatePhotoDTO, UpdatePhotoDTO } from "../dtos/index.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

// Get all photos
router.get("/", PhotoController.getPhotos);

// Get photo
router.get("/:photoId", PhotoController.getPhotoById);

// Get user photos
router.get("/:userId", PhotoController.getUserPhotos)

// Create photo
router.post("/", CreatePhotoDTO.validationRules(), PhotoController.createPhoto);

// Update photo
router.put("/:photoId", UpdatePhotoDTO.validationRules(), PhotoController.updatePhoto);

// Delete photo
router.delete("/:photoId", PhotoController.deletePhoto);
// Photo reactions
router.post("/:photoId/reactions", AddReactionDTO.validationRules(), PhotoController.addReaction);
router.delete("/:photoId/reactions", PhotoController.removeReaction);

export default router;
