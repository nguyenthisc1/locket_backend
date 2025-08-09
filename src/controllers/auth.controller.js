import bcrypt from "bcryptjs";
import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AuthResponseDTO, LoginUserDTO, RegisterUserDTO } from "../dtos/index.js";
import User from "../models/user.model.js";
import CloudinaryService from "../services/cloudinary.service.js";
import { createErrorResponse, createSuccessResponse, createValidationErrorResponse, detectLanguage } from "../utils/translations.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AuthController {
	// Register controller
	static async register(req, res) {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
		}
		try {
			const registerData = new RegisterUserDTO(req.body);
			const { username, email, phoneNumber, password } = registerData;

			const existing = await User.findOne({ $or: [{ email }, { phoneNumber }] });
			if (existing) return res.status(409).json(createErrorResponse("auth.userExists", null, null, detectLanguage(req)));

			const passwordHash = await bcrypt.hash(password, 10);

			// Create user first to get the user ID
			const user = await User.create({ username, email, phoneNumber, passwordHash });

			// Handle avatar upload - use provided avatar or default user.png
			// let avatarUrl = null;
			// try {
			// 	let imageToUpload;

			// 	if (avatarData) {
			// 		// Use provided avatar data
			// 		imageToUpload = avatarData;
			// 	} else {
			// 		// Use default user.png
			// 		const defaultAvatarPath = path.join(__dirname, '../assets/images/user.png');
			// 		const defaultAvatarBuffer = fs.readFileSync(defaultAvatarPath);
			// 		imageToUpload = defaultAvatarBuffer;
			// 	}

			// 	const cloudinaryResult = await CloudinaryService.uploadImage(imageToUpload, {
			// 		folder: `locket-users/${user._id}/avatar`,
			// 		public_id: `avatar_${user._id}`,
			// 		transformation: [
			// 			{ width: 300, height: 300, crop: "fill" },
			// 			{ quality: "auto:good" },
			// 			{ fetch_format: "auto" }
			// 		]
			// 	});
			// 	avatarUrl = cloudinaryResult.url;

			// 	// Update user with avatar URL
			// 	await User.findByIdAndUpdate(user._id, { avatarUrl });
			// 	user.avatarUrl = avatarUrl;
			// } catch (avatarError) {
			// 	console.error("Avatar upload error:", avatarError);
			// 	// Continue registration even if avatar upload fails
			// }

			// Generate tokens
			const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
			const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

			// Set tokens in httpOnly cookies
			res.cookie("accessToken", accessToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "Strict",
				maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
			});
			res.cookie("refreshToken", refreshToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "Strict",
				maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
			});

			const authResponse = AuthResponseDTO.fromAuthData({
				accessToken,
				refreshToken,
				user: {
					id: user._id,
					username: user.username,
					email: user.email,
					phoneNumber: user.phoneNumber,
					// avatarUrl: user.avatarUrl,
				},
			});

			res.status(201).json(createSuccessResponse("auth.registrationSuccess", authResponse.toJSON(), detectLanguage(req)));
		} catch (err) {
			res.status(500).json(createErrorResponse("auth.registrationFailed", err.message, null, detectLanguage(req)));
		}
	}

	// Login controller
	static async login(req, res) {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
		}
		try {
			const loginData = new LoginUserDTO(req.body);
			const { email, phoneNumber, password } = loginData;
			console.log(email);

			const user = await User.findOne(email ? { email } : { phoneNumber });
			if (!user) return res.status(404).json(createErrorResponse("auth.userNotFound", null, null, detectLanguage(req)));
			console.log(user);

			const isMatch = await bcrypt.compare(password, user.passwordHash);
			if (!isMatch) return res.status(401).json(createErrorResponse("auth.invalidCredentials", null, null, detectLanguage(req)));
			console.log(isMatch);

			// Generate tokens
			const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
			const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

			// Set tokens in httpOnly cookies
			res.cookie("accessToken", accessToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "Strict",
				maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
			});
			res.cookie("refreshToken", refreshToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "Strict",
				maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
			});

			const authResponse = AuthResponseDTO.fromAuthData({
				accessToken,
				refreshToken,
				user: {
					id: user._id,
					username: user.username,
					email: user.email,
					phoneNumber: user.phoneNumber,
					avatarUrl: user.avatarUrl,
				},
			});
			console.log(authResponse);

			res.json(createSuccessResponse("auth.loginSuccess", authResponse.toJSON(), detectLanguage(req)));

		} catch (err) {
			res.status(500).json(createErrorResponse("auth.loginFailed", err.message, null, detectLanguage(req)));
		}
	}

	// Refresh token controller
	static async refreshToken(req, res) {
		const token = req.cookies.refreshToken;
		if (!token) return res.status(401).json(createErrorResponse("auth.missingRefreshToken", null, null, detectLanguage(req)));

		try {
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '7d' });
			const newRefreshToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' });

			// Set new tokens in httpOnly cookies
			res.cookie("accessToken", accessToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "Strict",
				maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
			});
			res.cookie("refreshToken", newRefreshToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "Strict",
				maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
			});

			res.json(createSuccessResponse("auth.tokenRefreshed", { accessToken, refreshToken: newRefreshToken }, detectLanguage(req)));
		} catch (err) {
			res.status(401).json(createErrorResponse("auth.invalidRefreshToken", err.message, null, detectLanguage(req)));
		}
	}

	// Logout controller
	static async logout(req, res) {
		try {
			res.clearCookie("accessToken", {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "Strict",
			});
			res.clearCookie("refreshToken", {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "Strict",
			});
			res.status(200).json(createSuccessResponse("auth.logoutSuccess", null, detectLanguage(req)));
		} catch (err) {
			res.status(500).json(createErrorResponse("auth.logoutFailed", err.message, null, detectLanguage(req)));
		}
	}
}
