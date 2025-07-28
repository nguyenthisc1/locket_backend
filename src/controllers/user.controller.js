import { validationResult } from "express-validator";
import { UpdateProfileDTO, UserListDTO, UserProfileResponseDTO } from "../dtos/index.js";
import User from "../models/user.model.js";
import { createSuccessResponse, createErrorResponse, createValidationErrorResponse, detectLanguage } from "../utils/translations.js";

export class UserController {
	static async getProfile(req, res) {
		try {
			const user = await User.findById(req.user._id).select("-passwordHash");
			if (!user) {
				return res.status(404).json(createErrorResponse("user.userNotFound", null, null, detectLanguage(req)));
			}

			const profileResponse = UserProfileResponseDTO.fromUser(user);
			res.json(createSuccessResponse("user.userRetrieved", profileResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error fetching user profile:", error);
			res.status(500).json(createErrorResponse("general.serverError", error.message, null, detectLanguage(req)));
		}
	}

	static async updateProfile(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const updateData = new UpdateProfileDTO(req.body);
			const updateFields = updateData.toUpdateData();
			console.log(req.user._id);
			
			// Check if email or phone number already exists (excluding current user)
			if (updateFields.email) {
				const existingUser = await User.findOne({
					email: updateFields.email,
					_id: { $ne: req.user._id },
				});
				if (existingUser) {
					return res.status(400).json(createErrorResponse("auth.userExists", null, null, detectLanguage(req)));
				}
			}

			if (updateFields.phoneNumber) {
				const existingUser = await User.findOne({
					phoneNumber: updateFields.phoneNumber,
					_id: { $ne: req.user._id },
				});
				if (existingUser) {
					return res.status(400).json(createErrorResponse("auth.userExists", null, null, detectLanguage(req)));
				}
			}

			const updatedUser = await User.findByIdAndUpdate(req.user._id, updateFields, { new: true, runValidators: true }).select("-passwordHash");

			if (!updatedUser) {
				return res.status(404).json(createErrorResponse("user.userNotFound", null, null, detectLanguage(req)));
			}

			const profileResponse = UserProfileResponseDTO.fromUser(updatedUser);
			res.json(createSuccessResponse("user.profileUpdated", profileResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error updating user profile:", error);
			res.status(500).json(createErrorResponse("user.profileUpdateFailed", error.message, null, detectLanguage(req)));
		}
	}

	static async deleteAccount(req, res) {
		try {
			const user = await User.findByIdAndDelete(req.user._id);
			if (!user) {
				return res.status(404).json(createErrorResponse("user.userNotFound", null, null, detectLanguage(req)));
			}

			res.json(createSuccessResponse("user.userDeleted", null, detectLanguage(req)));
		} catch (error) {
			console.error("Error deleting user account:", error);
			res.status(500).json(createErrorResponse("user.userDeleteFailed", error.message, null, detectLanguage(req)));
		}
	}

	static async searchUsers(req, res) {
		try {
			const { query, limit = 10, page = 1 } = req.query;
			const skip = (page - 1) * limit;

			let searchQuery = {};
			if (query) {
				searchQuery = {
					$or: [{ username: { $regex: query, $options: "i" } }, { email: { $regex: query, $options: "i" } }],
				};
			}

			// Exclude current user from search results
			searchQuery._id = { $ne: req.user._id };

			const users = await User.find(searchQuery).select("-passwordHash").limit(parseInt(limit)).skip(skip).sort({ username: 1 });

			const total = await User.countDocuments(searchQuery);
			const totalPages = Math.ceil(total / limit);

			const pagination = {
				currentPage: parseInt(page),
				totalPages,
				totalUsers: total,
				hasNextPage: page < totalPages,
				hasPrevPage: page > 1,
			};

			const userListResponse = UserListDTO.fromUsers(users, pagination);
			res.json(createSuccessResponse("user.searchResults", userListResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error searching users:", error);
			res.status(500).json(createErrorResponse("user.searchFailed", error.message, null, detectLanguage(req)));
		}
	}
}
