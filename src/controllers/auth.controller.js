import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import { RegisterUserDTO, LoginUserDTO, AuthResponseDTO } from "../dtos/index.js";
import { createSuccessResponse, createErrorResponse, createValidationErrorResponse, detectLanguage } from "../utils/translations.js";

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
			const user = await User.create({ username, email, phoneNumber, passwordHash });

			// Generate tokens
			const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN });
			const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN });

			// Set refresh token in httpOnly cookie
			res.cookie("refreshToken", refreshToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "Strict",
				maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
			});

			const authResponse = AuthResponseDTO.fromAuthData({
				accessToken,
				refreshToken,
				user: {
					id: user._id,
					username: user.username,
					email: user.email,
					phoneNumber: user.phoneNumber,
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

			const user = await User.findOne(email ? { email } : { phoneNumber });
			if (!user) return res.status(404).json(createErrorResponse("auth.userNotFound", null, null, detectLanguage(req)));

			const isMatch = await bcrypt.compare(password, user.passwordHash);
			if (!isMatch) return res.status(401).json(createErrorResponse("auth.invalidCredentials", null, null, detectLanguage(req)));

			// Generate tokens
			const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN });
			const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN });

			// Set refresh token in httpOnly cookie
			res.cookie("refreshToken", refreshToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "Strict",
				maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
			});

			const authResponse = AuthResponseDTO.fromAuthData({
				accessToken,
				refreshToken,
				user: {
					id: user._id,
					username: user.username,
					email: user.email,
					phoneNumber: user.phoneNumber,
				},
			});

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
			const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN });
			const newRefreshToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN });

			// Set new refresh token in httpOnly cookie
			res.cookie("refreshToken", newRefreshToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "Strict",
				maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
			});

			res.json(createSuccessResponse("auth.tokenRefreshed", { accessToken, refreshToken: newRefreshToken }, detectLanguage(req)));
		} catch (err) {
			res.status(401).json(createErrorResponse("auth.invalidRefreshToken", err.message, null, detectLanguage(req)));
		}
	}

	// Logout controller
	static async logout(req, res) {
		try {
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
