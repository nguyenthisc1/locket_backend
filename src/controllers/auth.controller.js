import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import { 
	RegisterUserDTO, 
	LoginUserDTO, 
	AuthResponseDTO 
} from "../dtos/index.js";

// Validation for registration
export const registerValidation = RegisterUserDTO.validationRules();

// Validation for login
export const loginValidation = LoginUserDTO.validationRules();

// Register controller
export const register = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}
	try {
		const registerData = new RegisterUserDTO(req.body);
		const { username, email, phoneNumber, password } = registerData;
		
		const existing = await User.findOne({ $or: [{ email }, { phoneNumber }] });
		if (existing) return res.status(409).json({ message: "User already exists." });

		const passwordHash = await bcrypt.hash(password, 10);
		const user = await User.create({ username, email, phoneNumber, passwordHash });

		// Generate tokens
		const accessToken = jwt.sign(
			{ id: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN }
		);
		const refreshToken = jwt.sign(
			{ id: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN }
		);

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
			}
		});

		res.status(201).json(authResponse.toJSON());
	} catch (err) {
		res.status(500).json({ message: "Registration failed", error: err.message });
	}
};

// Login controller
export const login = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}
	try {
		const loginData = new LoginUserDTO(req.body);
		const { email, phoneNumber, password } = loginData;
		
		const user = await User.findOne(email ? { email } : { phoneNumber });
		if (!user) return res.status(404).json({ message: "User not found." });

		const isMatch = await bcrypt.compare(password, user.passwordHash);
		if (!isMatch) return res.status(401).json({ message: "Invalid credentials." });

		// Generate tokens
		const accessToken = jwt.sign(
			{ id: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN }
		);
		const refreshToken = jwt.sign(
			{ id: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN }
		);

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
			}
		});

		res.json(authResponse.toJSON());
	} catch (err) {
		res.status(500).json({ message: "Login failed", error: err.message });
	}
};

// Refresh token controller
export const refreshToken = async (req, res) => {
	const token = req.cookies.refreshToken;
	if (!token) return res.status(401).json({ message: "Missing refresh token" });

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const accessToken = jwt.sign(
			{ id: decoded.id },
			process.env.JWT_SECRET,
			{ expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN }
		);
		const newRefreshToken = jwt.sign(
			{ id: decoded.id },
			process.env.JWT_SECRET,
			{ expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN }
		);

		// Set new refresh token in httpOnly cookie
		res.cookie("refreshToken", newRefreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "Strict",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		});

		res.json({ accessToken, refreshToken: newRefreshToken });
	} catch (err) {
		res.status(401).json({ message: "Invalid refresh token", error: err.message });
	}
};

// Logout controller
export const logout = (req, res) => {
	try {
		res.clearCookie("refreshToken", {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "Strict",
		});
		res.status(200).json({ message: "Logged out successfully" });
	} catch (err) {
		res.status(500).json({ message: "Logout failed", error: err.message });
	}
};
