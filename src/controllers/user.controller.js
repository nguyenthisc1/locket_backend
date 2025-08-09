import { validationResult } from "express-validator";
import { UpdateProfileDTO, UserListDTO, UserProfileResponseDTO, FriendRequestDTO, FriendStatusDTO, FriendResponseDTO } from "../dtos/index.js";
import User from "../models/user.model.js";
import Friend from "../models/friend.model.js";
import CloudinaryService from "../services/cloudinary.service.js";
import { createSuccessResponse, createErrorResponse, createValidationErrorResponse, detectLanguage } from "../utils/translations.js";

export class UserController {
	static async getProfile(req, res) {
		try {
			console.log('user: ', req.user._id);
			
			const user = await User.findById(req.user._id).select("-passwordHash");
			if (!user) {
				return res.status(404).json(createErrorResponse("user.userNotFound", null, null, detectLanguage(req)));
			}

			const profileResponse = UserProfileResponseDTO.fromUser(user);
			console.log('profile Response' + profileResponse.toJSON());
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

	static async updateAvatar(req, res) {
		try {
			const { avatarData } = req.body;
			
			if (!avatarData) {
				return res.status(400).json(createErrorResponse("validation.avatarRequired", null, null, detectLanguage(req)));
			}

			// Delete old avatar from Cloudinary if it exists
			const currentUser = await User.findById(req.user._id);
			if (currentUser.avatarUrl && CloudinaryService.isCloudinaryUrl(currentUser.avatarUrl)) {
				const oldPublicId = CloudinaryService.extractPublicId(currentUser.avatarUrl);
				if (oldPublicId) {
					try {
						await CloudinaryService.deleteImage(oldPublicId);
					} catch (deleteError) {
						console.error("Error deleting old avatar:", deleteError);
						// Continue with upload even if deletion fails
					}
				}
			}

			// Upload new avatar
			const cloudinaryResult = await CloudinaryService.uploadImage(avatarData, {
				folder: `locket-users/${req.user._id}/avatar`,
				public_id: `avatar_${req.user._id}`,
				transformation: [
					{ width: 300, height: 300, crop: "fill" },
					{ quality: "auto:good" },
					{ fetch_format: "auto" }
				]
			});

			// Update user with new avatar URL
			const updatedUser = await User.findByIdAndUpdate(
				req.user._id, 
				{ avatarUrl: cloudinaryResult.url }, 
				{ new: true, runValidators: true }
			).select("-passwordHash");

			const profileResponse = UserProfileResponseDTO.fromUser(updatedUser);
			res.json(createSuccessResponse("user.avatarUpdated", profileResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error updating user avatar:", error);
			res.status(500).json(createErrorResponse("user.avatarUpdateFailed", error.message, null, detectLanguage(req)));
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

	// ==================== FRIEND MANAGEMENT ====================

	// Send friend request
	static async sendFriendRequest(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const friendRequestData = new FriendRequestDTO(req.body);
			const { friendId } = friendRequestData;

			// DEBUG: Log the request details
			console.log('=== SEND FRIEND REQUEST DEBUG ===');
			console.log('Sender ID:', req.user._id);
			console.log('Friend ID:', friendId);

			// Check if trying to add self
			if (friendId === req.user._id.toString()) {
				return res.status(400).json(createErrorResponse("friend.cannotAddSelf", null, null, detectLanguage(req)));
			}

			// Check if friend exists
			const friendUser = await User.findById(friendId);
			if (!friendUser) {
				return res.status(404).json(createErrorResponse("user.userNotFound", null, null, detectLanguage(req)));
			}

			// Check if friendship already exists
			const existingFriendship = await Friend.findOne({
				$or: [
					{ userId: req.user._id, friendId },
					{ userId: friendId, friendId: req.user._id }
				]
			});

			if (existingFriendship) {
				if (existingFriendship.status === 'accepted') {
					return res.status(400).json(createErrorResponse("friend.alreadyFriends", null, null, detectLanguage(req)));
				} else if (existingFriendship.status === 'pending') {
					return res.status(400).json(createErrorResponse("friend.requestPending", null, null, detectLanguage(req)));
				} else if (existingFriendship.status === 'blocked') {
					return res.status(400).json(createErrorResponse("friend.userBlocked", null, null, detectLanguage(req)));
				}
			}

			// Create friend request
			const friendRequest = await Friend.create({
				userId: req.user._id,
				friendId,
				status: 'pending'
			});

			console.log('Created friend request:', friendRequest);
			console.log('=== END SEND DEBUG ===');

			const populatedRequest = await Friend.findById(friendRequest._id)
				.populate('friendId', 'username email avatarUrl')
				.populate('userId', 'username email avatarUrl');

			const friendResponse = FriendResponseDTO.fromFriend(populatedRequest);
			res.status(201).json(createSuccessResponse("friend.requestSent", friendResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error sending friend request:", error);
			res.status(500).json(createErrorResponse("friend.requestFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Respond to friend request (accept/reject)
	static async respondToFriendRequest(req, res) {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json(createValidationErrorResponse(errors.array(), detectLanguage(req)));
			}

			const { requestId } = req.params;
			const statusData = new FriendStatusDTO(req.body);
			const { status } = statusData;

			// Find the friend request where current user is the recipient
			const friendRequest = await Friend.findOne({
				_id: requestId,
				friendId: req.user._id,  // Current user must be the recipient
				status: 'pending'
			});

			if (!friendRequest) {
				return res.status(404).json(createErrorResponse("friend.requestNotFound", null, null, detectLanguage(req)));
			}

			// Update friend request status
			friendRequest.status = status;
			await friendRequest.save();

			// If accepted, add both users to each other's friend lists
			if (status === 'accepted') {
				await User.findByIdAndUpdate(friendRequest.userId, {
					$addToSet: { friends: req.user._id }
				});
				await User.findByIdAndUpdate(req.user._id, {
					$addToSet: { friends: friendRequest.userId }
				});
			}

			const populatedRequest = await Friend.findById(friendRequest._id)
				.populate('friendId', 'username email avatarUrl')
				.populate('userId', 'username email avatarUrl');

			const friendResponse = FriendResponseDTO.fromFriend(populatedRequest);
			const successMessage = status === 'accepted' ? "friend.requestAccepted" : "friend.requestRejected";
			res.json(createSuccessResponse(successMessage, friendResponse.toJSON(), detectLanguage(req)));
		} catch (error) {
			console.error("Error responding to friend request:", error);
			res.status(500).json(createErrorResponse("friend.responseFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Get friend requests (received)
	static async getFriendRequests(req, res) {
		try {
			const { limit = 10, page = 1 } = req.query;
			const skip = (page - 1) * limit;

			const requests = await Friend.find({
				friendId: req.user._id,
				status: 'pending'
			})
			.populate('userId', 'username email avatarUrl')
			.sort({ createdAt: -1 })
			.limit(parseInt(limit))
			.skip(skip);

			const total = await Friend.countDocuments({
				friendId: req.user._id,
				status: 'pending'
			});

			const pagination = {
				currentPage: parseInt(page),
				totalPages: Math.ceil(total / limit),
				totalRequests: total,
				hasNextPage: page < Math.ceil(total / limit),
				hasPrevPage: page > 1,
			};

			res.json(createSuccessResponse("friend.requestsRetrieved", { requests, pagination }, detectLanguage(req)));
		} catch (error) {
			console.error("Error getting friend requests:", error);
			res.status(500).json(createErrorResponse("friend.requestsGetFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Get friends list
	static async getFriends(req, res) {
		try {
			const { limit = 10, page = 1, status = 'accepted' } = req.query;
			const skip = (page - 1) * limit;

			const searchQuery = {
				$or: [
					{ userId: req.user._id, status },
					{ friendId: req.user._id, status }
				]
			};

			const friendships = await Friend.find(searchQuery)
				.populate('userId', 'username email avatarUrl')
				.populate('friendId', 'username email avatarUrl')
				.sort({ createdAt: -1 })
				.limit(parseInt(limit))
				.skip(skip);

			// Transform to show the friend (not the current user)
			const friends = friendships.map(friendship => {
				const friend = friendship.userId._id.toString() === req.user._id.toString() 
					? friendship.friendId 
					: friendship.userId;
				
				return {
					...friendship.toObject(),
					friend
				};
			});

			const total = await Friend.countDocuments(searchQuery);
			const pagination = {
				currentPage: parseInt(page),
				totalPages: Math.ceil(total / limit),
				totalFriends: total,
				hasNextPage: page < Math.ceil(total / limit),
				hasPrevPage: page > 1,
			};

			res.json(createSuccessResponse("friend.friendsRetrieved", { friends, pagination }, detectLanguage(req)));
		} catch (error) {
			console.error("Error getting friends:", error);
			res.status(500).json(createErrorResponse("friend.friendsGetFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Remove friend
	static async removeFriend(req, res) {
		try {
			const { friendId } = req.params;

			// Find and remove friendship
			const friendship = await Friend.findOneAndDelete({
				$or: [
					{ userId: req.user._id, friendId },
					{ userId: friendId, friendId: req.user._id }
				],
				status: 'accepted'
			});

			if (!friendship) {
				return res.status(404).json(createErrorResponse("friend.friendshipNotFound", null, null, detectLanguage(req)));
			}

			// Remove from both users' friend lists
			await User.findByIdAndUpdate(req.user._id, {
				$pull: { friends: friendId }
			});
			await User.findByIdAndUpdate(friendId, {
				$pull: { friends: req.user._id }
			});

			res.json(createSuccessResponse("friend.friendRemoved", null, detectLanguage(req)));
		} catch (error) {
			console.error("Error removing friend:", error);
			res.status(500).json(createErrorResponse("friend.removeFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Block/Unblock user
	static async blockUser(req, res) {
		try {
			const { userId } = req.params;
			const { action = 'block' } = req.body; // 'block' or 'unblock'

			if (userId === req.user._id.toString()) {
				return res.status(400).json(createErrorResponse("friend.cannotBlockSelf", null, null, detectLanguage(req)));
			}

			if (action === 'block') {
				// Remove existing friendship if any
				await Friend.findOneAndDelete({
					$or: [
						{ userId: req.user._id, friendId: userId },
						{ userId: userId, friendId: req.user._id }
					]
				});

				// Remove from friend lists
				await User.findByIdAndUpdate(req.user._id, {
					$pull: { friends: userId }
				});
				await User.findByIdAndUpdate(userId, {
					$pull: { friends: req.user._id }
				});

				// Create block relationship
				await Friend.create({
					userId: req.user._id,
					friendId: userId,
					status: 'blocked'
				});

				res.json(createSuccessResponse("friend.userBlocked", { action: 'blocked' }, detectLanguage(req)));
			} else {
				// Remove block
				await Friend.findOneAndDelete({
					userId: req.user._id,
					friendId: userId,
					status: 'blocked'
				});

				res.json(createSuccessResponse("friend.userUnblocked", { action: 'unblocked' }, detectLanguage(req)));
			}
		} catch (error) {
			console.error("Error blocking/unblocking user:", error);
			res.status(500).json(createErrorResponse("friend.blockFailed", error.message, null, detectLanguage(req)));
		}
	}

	// Get mutual friends
	static async getMutualFriends(req, res) {
		try {
			const { userId } = req.params;
			const { limit = 10 } = req.query;

			// Get current user's friends
			const currentUserFriends = await User.findById(req.user._id).select('friends');
			// Get target user's friends  
			const targetUserFriends = await User.findById(userId).select('friends');

			if (!targetUserFriends) {
				return res.status(404).json(createErrorResponse("user.userNotFound", null, null, detectLanguage(req)));
			}

			// Find mutual friends
			const mutualFriendIds = currentUserFriends.friends.filter(friendId => 
				targetUserFriends.friends.some(targetFriendId => 
					targetFriendId.toString() === friendId.toString()
				)
			).slice(0, parseInt(limit));

			const mutualFriends = await User.find({
				_id: { $in: mutualFriendIds }
			}).select('username email avatarUrl');

			res.json(createSuccessResponse("friend.mutualFriendsRetrieved", {
				mutualFriends,
				count: mutualFriends.length
			}, detectLanguage(req)));
		} catch (error) {
			console.error("Error getting mutual friends:", error);
			res.status(500).json(createErrorResponse("friend.mutualFriendsFailed", error.message, null, detectLanguage(req)));
		}
	}

	// ==================== USER SEARCH ====================

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
