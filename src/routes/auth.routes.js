import express from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { LoginUserDTO, RegisterUserDTO } from "../dtos/user.dto.js";

const router = express.Router();

router.post("/register", RegisterUserDTO.validationRules(), AuthController.register);
router.post("/login", LoginUserDTO.validationRules(), AuthController.login);
router.post("/logout", AuthController.logout);
router.post("/refresh", AuthController.refreshToken);

export default router;
