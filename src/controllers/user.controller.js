import { validationResult } from 'express-validator';
import {
  UpdateProfileDTO,
  UserListDTO,
  UserProfileResponseDTO
} from '../dtos/index.js';
import User from '../models/user.model.js';

// Get user profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const profileResponse = UserProfileResponseDTO.fromUser(user);
    res.json(profileResponse.toJSON());
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const updateData = new UpdateProfileDTO(req.body);
    const updateFields = updateData.toUpdateData();

    // Check if email or phone number already exists (excluding current user)
    if (updateFields.email) {
      const existingUser = await User.findOne({ 
        email: updateFields.email, 
        _id: { $ne: req.user._id } 
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    if (updateFields.phoneNumber) {
      const existingUser = await User.findOne({ 
        phoneNumber: updateFields.phoneNumber, 
        _id: { $ne: req.user._id } 
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Phone number already in use' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profileResponse = UserProfileResponseDTO.fromUser(updatedUser);
    res.json({ 
      message: 'Profile updated successfully', 
      ...profileResponse.toJSON()
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete user account
export const deleteAccount = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting user account:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Validation middleware for profile updates
export const updateProfileValidation = UpdateProfileDTO.validationRules();

// Search users
export const searchUsers = async (req, res) => {
  try {
    const { query, limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    let searchQuery = {};
    if (query) {
      searchQuery = {
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      };
    }

    // Exclude current user from search results
    searchQuery._id = { $ne: req.user._id };

    const users = await User.find(searchQuery)
      .select('-passwordHash')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ username: 1 });

    const total = await User.countDocuments(searchQuery);
    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: parseInt(page),
      totalPages,
      totalUsers: total,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };

    const userListResponse = UserListDTO.fromUsers(users, pagination);
    res.json(userListResponse.toJSON());
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
