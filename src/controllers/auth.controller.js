import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";

// Validation for registration
export const registerValidation = [
	body("username").notEmpty().withMessage("Username is required"),
	body("email").isEmail().withMessage("Valid email is required"),
	body("phoneNumber").notEmpty().withMessage("Phone number is required"),
	body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

// Validation for login
export const loginValidation = [
	body("email").optional().isEmail().withMessage("Valid email is required"),
	body("phoneNumber").optional().notEmpty().withMessage("Phone number is required"),
	body("password").notEmpty().withMessage("Password is required"),
];

// Register controller
export const register = async (req, res) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}
	try {
		const { username, email, phoneNumber, password } = req.body;
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

		res.status(201).json({
			accessToken,
			refreshToken,
			user: {
				id: user._id,
				username: user.username,
				email: user.email,
				phoneNumber: user.phoneNumber,
			},
		});
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
		const { email, phoneNumber, password } = req.body;
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

		res.json({
			accessToken,
			refreshToken,
			user: {
				id: user._id,
				username: user.username,
				email: user.email,
				phoneNumber: user.phoneNumber,
			},
		});
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
