// Vietnamese Translation System for Locket Backend API

export const TRANSLATIONS = {
	en: {
		// Auth Messages
		auth: {
			registrationSuccess: "Registration successful",
			loginSuccess: "Login successful",
			tokenRefreshed: "Token refreshed successfully",
			userExists: "User already exists",
			userNotFound: "User not found",
			invalidCredentials: "Invalid credentials",
			registrationFailed: "Registration failed",
			loginFailed: "Login failed",
			missingToken: "Missing or invalid token",
			tokenExpired: "Token has expired",
			invalidToken: "Invalid token format",
			tokenVerificationFailed: "Token verification failed",
			missingRefreshToken: "Missing refresh token",
			invalidRefreshToken: "Invalid refresh token",
			logoutSuccess: "Logout successful",
			logoutFailed: "Logout failed",
		},

		// User Messages
		user: {
			profileUpdated: "Profile updated successfully",
			profileUpdateFailed: "Failed to update profile",
			userDeleted: "User deleted successfully",
			userDeleteFailed: "Failed to delete user",
			userNotFound: "User not found",
			searchResults: "Search results retrieved",
			searchFailed: "Search failed",
			unauthorizedAccess: "Unauthorized access",
			invalidUserId: "Invalid user ID",
			cannotDeleteSelf: "Cannot delete your own account",
			userRetrieved: "User retrieved successfully",
		},

		// Photo Messages
		photo: {
			photoCreated: "Photo created successfully",
			photoCreationFailed: "Failed to create photo",
			photoUpdated: "Photo updated successfully",
			photoUpdateFailed: "Failed to update photo",
			photoDeleted: "Photo deleted successfully",
			photoDeleteFailed: "Failed to delete photo",
			photoNotFound: "Photo not found",
			photosRetrieved: "Photos retrieved successfully",
			photoRetrieved: "Photo retrieved successfully",
			reactionAdded: "Reaction added successfully",
			reactionRemoved: "Reaction removed successfully",
			reactionFailed: "Failed to manage reaction",
			unauthorizedPhotoAccess: "Unauthorized access to photo",
			invalidPhotoId: "Invalid photo ID",
			photoShared: "Photo shared successfully",
			photoUnshared: "Photo unshared successfully",
			shareFailed: "Failed to manage photo sharing",
		},

		// Conversation Messages
		conversation: {
			conversationCreated: "Conversation created successfully",
			conversationCreationFailed: "Failed to create conversation",
			conversationUpdated: "Conversation updated successfully",
			conversationUpdateFailed: "Failed to update conversation",
			conversationDeleted: "Conversation deleted successfully",
			conversationDeleteFailed: "Failed to delete conversation",
			conversationNotFound: "Conversation not found",
			conversationsRetrieved: "Conversations retrieved successfully",
			conversationRetrieved: "Conversation retrieved successfully",
			participantAdded: "Participant added successfully",
			participantRemoved: "Participant removed successfully",
			participantManagementFailed: "Failed to manage participants",
			conversationLeft: "Left conversation successfully",
			leaveFailed: "Failed to leave conversation",
			searchResults: "Search results retrieved",
			searchFailed: "Search failed",
			threadsRetrieved: "Threads retrieved successfully",
			unauthorizedAccess: "Unauthorized access to conversation",
			invalidConversationId: "Invalid conversation ID",
			groupSettingsUpdated: "Group settings updated successfully",
			privateConversationParticipants: "Private conversation must have exactly 1 participant (the current user will be added automatically)",
			groupConversationParticipants: "Group conversation must have at least 2 participants",
			participantNotFound: "Participant not found in conversation",
			cannotRemoveSelf: "Cannot remove yourself from conversation",
			cannotAddSelf: "Cannot add yourself to conversation",
			participantAlreadyExists: "Participant already exists in conversation",
		},

		// Message Messages
		message: {
			messageSent: "Message sent successfully",
			messageSendFailed: "Failed to send message",
			messageUpdated: "Message updated successfully",
			messageUpdateFailed: "Failed to update message",
			messageDeleted: "Message deleted successfully",
			messageDeleteFailed: "Failed to delete message",
			messageNotFound: "Message not found",
			messagesRetrieved: "Messages retrieved successfully",
			messageRetrieved: "Message retrieved successfully",
			messageRetrievedFailed: "Failed to retrieve message",
			reactionAdded: "Reaction added successfully",
			reactionRemoved: "Reaction removed successfully",
			reactionFailed: "Failed to manage reaction",
			messageReplied: "Reply sent successfully",
			replyFailed: "Failed to send reply",
			messagePinned: "Message pinned successfully",
			messageUnpinned: "Message unpinned successfully",
			pinFailed: "Failed to manage message pin",
			messageForwarded: "Message forwarded successfully",
			forwardFailed: "Failed to forward message",
			searchResults: "Search results retrieved",
			searchFailed: "Search failed",
			threadMessagesRetrieved: "Thread messages retrieved successfully",
			unauthorizedAccess: "Unauthorized access to message",
			invalidMessageId: "Invalid message ID",
			cannotEditOthersMessage: "Cannot edit another user's message",
			cannotDeleteOthersMessage: "Cannot delete another user's message",
			parentMessageNotFound: "Parent message not found",
			conversationNotFound: "Conversation not found",
			invalidConversationId: "Invalid conversation ID",
		},

		// Add to your translations object
		notification: {
			notificationsRetrieved: "Notifications retrieved",
			notificationRetrieved: "Notification retrieved",
			notificationNotFound: "Notification not found",
			markedAsRead: "Marked as read",
			notificationDeleted: "Notification deleted",
			unreadCountRetrieved: "Unread notification count retrieved",
			oldNotificationsCleared: "Old notifications cleared",
			noNotificationsToMark: "No notifications to mark as read",

			// Notification titles and content
			newPhotoTitle: "New Photo",
			newPhotoContent: "A new photo has been shared",
			photoLikeTitle: "Photo Liked",
			photoLikeContent: "Someone liked your photo",
			photoCommentTitle: "Photo Comment",
			photoCommentContent: "Someone commented on your photo",
			newMessageTitle: "New Message",
			newMessageContent: "You have a new message",
			friendRequestTitle: "Friend Request",
			friendRequestContent: "You have received a friend request",
			memberAddedTitle: "New Member",
			memberAddedContent: "A new member has joined the group",
			memberRemovedTitle: "Member Left",
			memberRemovedContent: "A member has left the group",
			groupUpdatedTitle: "Group Updated",
			groupUpdatedContent: "Group information has been updated",
		},

		// Upload Messages
		upload: {
			fileUploaded: "File uploaded successfully",
			uploadFailed: "Failed to upload file",
			invalidFileType: "Invalid file type",
			fileTooLarge: "File size too large",
			noFileProvided: "No file provided",
			cloudinaryError: "Cloudinary upload failed",
			multipleFilesUploaded: "Multiple files uploaded successfully",
			maxFilesExceeded: "Maximum number of files exceeded",
		},

		// Validation Messages
		validation: {
			required: "This field is required",
			invalidEmail: "Invalid email format",
			invalidPhone: "Invalid phone number format",
			passwordTooShort: "Password must be at least 6 characters",
			invalidMongoId: "Invalid ID format",
			invalidDate: "Invalid date format",
			invalidBoolean: "Invalid boolean value",
			invalidNumber: "Invalid number format",
			invalidArray: "Invalid array format",
			invalidObject: "Invalid object format",
			validationError: "Validation error",
		},

		// General Messages
		general: {
			success: "Operation completed successfully",
			error: "An error occurred",
			notFound: "Resource not found",
			unauthorized: "Unauthorized access",
			forbidden: "Access forbidden",
			badRequest: "Bad request",
			serverError: "Internal server error",
			validationError: "Validation error",
			databaseError: "Database error",
			networkError: "Network error",
		},
	},

	vi: {
		// Auth Messages
		auth: {
			registrationSuccess: "Đăng ký thành công",
			loginSuccess: "Đăng nhập thành công",
			tokenRefreshed: "Làm mới token thành công",
			userExists: "Người dùng đã tồn tại",
			userNotFound: "Không tìm thấy người dùng",
			invalidCredentials: "Thông tin đăng nhập không đúng",
			registrationFailed: "Đăng ký thất bại",
			loginFailed: "Đăng nhập thất bại",
			missingToken: "Thiếu hoặc token không hợp lệ",
			tokenExpired: "Token đã hết hạn",
			invalidToken: "Định dạng token không hợp lệ",
			tokenVerificationFailed: "Xác thực token thất bại",
			missingRefreshToken: "Thiếu refresh token",
			invalidRefreshToken: "Refresh token không hợp lệ",
			logoutSuccess: "Đăng xuất thành công",
			logoutFailed: "Đăng xuất thất bại",
		},

		// User Messages
		user: {
			profileUpdated: "Cập nhật hồ sơ thành công",
			profileUpdateFailed: "Cập nhật hồ sơ thất bại",
			userDeleted: "Xóa người dùng thành công",
			userDeleteFailed: "Xóa người dùng thất bại",
			userNotFound: "Không tìm thấy người dùng",
			searchResults: "Kết quả tìm kiếm",
			searchFailed: "Tìm kiếm thất bại",
			unauthorizedAccess: "Truy cập không được phép",
			invalidUserId: "ID người dùng không hợp lệ",
			cannotDeleteSelf: "Không thể xóa tài khoản của chính mình",
			userRetrieved: "Lấy thông tin người dùng thành công",
		},

		// Photo Messages
		photo: {
			photoCreated: "Tạo ảnh thành công",
			photoCreationFailed: "Tạo ảnh thất bại",
			photoUpdated: "Cập nhật ảnh thành công",
			photoUpdateFailed: "Cập nhật ảnh thất bại",
			photoDeleted: "Xóa ảnh thành công",
			photoDeleteFailed: "Xóa ảnh thất bại",
			photoNotFound: "Không tìm thấy ảnh",
			photosRetrieved: "Lấy danh sách ảnh thành công",
			photoRetrieved: "Lấy thông tin ảnh thành công",
			reactionAdded: "Thêm phản ứng thành công",
			reactionRemoved: "Xóa phản ứng thành công",
			reactionFailed: "Quản lý phản ứng thất bại",
			unauthorizedPhotoAccess: "Không có quyền truy cập ảnh",
			invalidPhotoId: "ID ảnh không hợp lệ",
			photoShared: "Chia sẻ ảnh thành công",
			photoUnshared: "Hủy chia sẻ ảnh thành công",
			shareFailed: "Quản lý chia sẻ ảnh thất bại",
		},

		// Conversation Messages
		conversation: {
			conversationCreated: "Tạo cuộc trò chuyện thành công",
			conversationCreationFailed: "Tạo cuộc trò chuyện thất bại",
			conversationUpdated: "Cập nhật cuộc trò chuyện thành công",
			conversationUpdateFailed: "Cập nhật cuộc trò chuyện thất bại",
			conversationDeleted: "Xóa cuộc trò chuyện thành công",
			conversationDeleteFailed: "Xóa cuộc trò chuyện thất bại",
			conversationNotFound: "Không tìm thấy cuộc trò chuyện",
			conversationsRetrieved: "Lấy danh sách cuộc trò chuyện thành công",
			conversationRetrieved: "Lấy thông tin cuộc trò chuyện thành công",
			participantAdded: "Thêm người tham gia thành công",
			participantRemoved: "Xóa người tham gia thành công",
			participantManagementFailed: "Quản lý người tham gia thất bại",
			conversationLeft: "Rời cuộc trò chuyện thành công",
			leaveFailed: "Rời cuộc trò chuyện thất bại",
			searchResults: "Kết quả tìm kiếm",
			searchFailed: "Tìm kiếm thất bại",
			threadsRetrieved: "Lấy danh sách luồng thành công",
			unauthorizedAccess: "Không có quyền truy cập cuộc trò chuyện",
			invalidConversationId: "ID cuộc trò chuyện không hợp lệ",
			groupSettingsUpdated: "Cập nhật cài đặt nhóm thành công",
			privateConversationParticipants: "Cuộc trò chuyện riêng tư phải có đúng 1 người tham gia (người dùng hiện tại sẽ được thêm tự động)",
			groupConversationParticipants: "Cuộc trò chuyện nhóm phải có ít nhất 2 người tham gia",
			participantNotFound: "Không tìm thấy người tham gia trong cuộc trò chuyện",
			cannotRemoveSelf: "Không thể xóa chính mình khỏi cuộc trò chuyện",
			cannotAddSelf: "Không thể thêm chính mình vào cuộc trò chuyện",
			participantAlreadyExists: "Người tham gia đã tồn tại trong cuộc trò chuyện",
		},

		// Message Messages
		message: {
			messageSent: "Gửi tin nhắn thành công",
			messageSendFailed: "Gửi tin nhắn thất bại",
			messageUpdated: "Cập nhật tin nhắn thành công",
			messageUpdateFailed: "Cập nhật tin nhắn thất bại",
			messageDeleted: "Xóa tin nhắn thành công",
			messageDeleteFailed: "Xóa tin nhắn thất bại",
			messageNotFound: "Không tìm thấy tin nhắn",
			messagesRetrieved: "Lấy danh sách tin nhắn thành công",
			messageRetrieved: "Lấy thông tin tin nhắn thành công",
			messageRetrievedFailed: "Lấy thông tin tin nhắn thất bại",
			reactionAdded: "Thêm phản ứng thành công",
			reactionRemoved: "Xóa phản ứng thành công",
			reactionFailed: "Quản lý phản ứng thất bại",
			messageReplied: "Gửi phản hồi thành công",
			replyFailed: "Gửi phản hồi thất bại",
			messagePinned: "Ghim tin nhắn thành công",
			messageUnpinned: "Bỏ ghim tin nhắn thành công",
			pinFailed: "Quản lý ghim tin nhắn thất bại",
			messageForwarded: "Chuyển tiếp tin nhắn thành công",
			forwardFailed: "Chuyển tiếp tin nhắn thất bại",
			searchResults: "Kết quả tìm kiếm",
			searchFailed: "Tìm kiếm thất bại",
			threadMessagesRetrieved: "Lấy tin nhắn luồng thành công",
			unauthorizedAccess: "Không có quyền truy cập tin nhắn",
			invalidMessageId: "ID tin nhắn không hợp lệ",
			cannotEditOthersMessage: "Không thể chỉnh sửa tin nhắn của người khác",
			cannotDeleteOthersMessage: "Không thể xóa tin nhắn của người khác",
			parentMessageNotFound: "Không tìm thấy tin nhắn gốc",
			conversationNotFound: "Không tìm thấy cuộc trò chuyện",
			invalidConversationId: "ID cuộc trò chuyện không hợp lệ",
		},

		// Add to your translations object
		notification: {
			notificationsRetrieved: "Thông báo đã được tải",
			notificationRetrieved: "Thông báo đã được tải",
			notificationNotFound: "Không tìm thấy thông báo",
			markedAsRead: "Đã đánh dấu là đã đọc",
			notificationDeleted: "Thông báo đã được xóa",
			unreadCountRetrieved: "Số thông báo chưa đọc đã được tải",
			oldNotificationsCleared: "Thông báo cũ đã được xóa",
			noNotificationsToMark: "Không có thông báo nào để đánh dấu",

			// Notification titles and content
			newPhotoTitle: "Ảnh mới",
			newPhotoContent: "Có ảnh mới được chia sẻ",
			photoLikeTitle: "Thích ảnh",
			photoLikeContent: "Đã thích ảnh của bạn",
			photoCommentTitle: "Bình luận ảnh",
			photoCommentContent: "Đã bình luận ảnh của bạn",
			newMessageTitle: "Tin nhắn mới",
			newMessageContent: "Có tin nhắn mới",
			friendRequestTitle: "Lời mời kết bạn",
			friendRequestContent: "Đã gửi lời mời kết bạn",
			memberAddedTitle: "Thành viên mới",
			memberAddedContent: "Có thành viên mới tham gia nhóm",
			memberRemovedTitle: "Thành viên rời nhóm",
			memberRemovedContent: "Có thành viên rời khỏi nhóm",
			groupUpdatedTitle: "Nhóm được cập nhật",
			groupUpdatedContent: "Thông tin nhóm đã được cập nhật",
		},

		// Upload Messages
		upload: {
			fileUploaded: "Tải lên tệp thành công",
			uploadFailed: "Tải lên tệp thất bại",
			invalidFileType: "Loại tệp không hợp lệ",
			fileTooLarge: "Kích thước tệp quá lớn",
			noFileProvided: "Không có tệp được cung cấp",
			cloudinaryError: "Tải lên Cloudinary thất bại",
			multipleFilesUploaded: "Tải lên nhiều tệp thành công",
			maxFilesExceeded: "Vượt quá số lượng tệp tối đa",
		},

		// Validation Messages
		validation: {
			required: "Trường này là bắt buộc",
			invalidEmail: "Định dạng email không hợp lệ",
			invalidPhone: "Định dạng số điện thoại không hợp lệ",
			passwordTooShort: "Mật khẩu phải có ít nhất 6 ký tự",
			invalidMongoId: "Định dạng ID không hợp lệ",
			invalidDate: "Định dạng ngày không hợp lệ",
			invalidBoolean: "Giá trị boolean không hợp lệ",
			invalidNumber: "Định dạng số không hợp lệ",
			invalidArray: "Định dạng mảng không hợp lệ",
			invalidObject: "Định dạng đối tượng không hợp lệ",
			validationError: "Lỗi xác thực",
		},

		// General Messages
		general: {
			success: "Thao tác hoàn thành thành công",
			error: "Đã xảy ra lỗi",
			notFound: "Không tìm thấy tài nguyên",
			unauthorized: "Truy cập không được phép",
			forbidden: "Truy cập bị cấm",
			badRequest: "Yêu cầu không hợp lệ",
			serverError: "Lỗi máy chủ nội bộ",
			validationError: "Lỗi xác thực",
			databaseError: "Lỗi cơ sở dữ liệu",
			networkError: "Lỗi mạng",
		},
	},
};

// Translation utility functions
export const getTranslation = (key, language = "vi") => {
	const keys = key.split(".");
	let translation = TRANSLATIONS[language] || TRANSLATIONS.en;

	for (const k of keys) {
		if (translation && translation[k]) {
			translation = translation[k];
		} else {
			// Fallback to English if translation not found
			let fallback = TRANSLATIONS.en;
			for (const fk of keys) {
				if (fallback && fallback[fk]) {
					fallback = fallback[fk];
				} else {
					return key; // Return original key if not found
				}
			}
			return fallback;
		}
	}

	return translation;
};

// Standardized response functions
export const createSuccessResponse = (message, data = null, language = "vi") => {
	return {
		success: true,
		message: getTranslation(message, language),
		data: data,
	};
};

export const createErrorResponse = (message, errors = null, data = null, language = "vi") => {
	return {
		success: false,
		message: getTranslation(message, language),
		errors: errors,
		data: data,
	};
};

export const createValidationErrorResponse = (errors, language = "vi") => {
	return {
		success: false,
		message: getTranslation("validation.validationError", language),
		errors: errors,
		data: null,
	};
};

// Legacy functions for backward compatibility
export const translateResponse = (response, language = "vi") => {
	if (response.message) {
		response.message = getTranslation(response.message, language);
	}
	if (response.error) {
		response.error = getTranslation(response.error, language);
	}
	return response;
};

export const createTranslatedResponse = (message, data = null, language = "vi") => {
	const response = {
		message: getTranslation(message, language),
		...(data && { data }),
	};
	return response;
};

export const createTranslatedError = (message, error = null, language = "vi") => {
	const response = {
		message: getTranslation(message, language),
		...(error && { error: getTranslation(error, language) }),
	};
	return response;
};

// Language detection from request headers
export const detectLanguage = (req) => {
	const acceptLanguage = req.headers["accept-language"];
	if (acceptLanguage && acceptLanguage.includes("en")) {
		return "en";
	}
	return "vi"; // Default to Vietnamese
};

export default {
	TRANSLATIONS,
	getTranslation,
	createSuccessResponse,
	createErrorResponse,
	createValidationErrorResponse,
	translateResponse,
	createTranslatedResponse,
	createTranslatedError,
	detectLanguage,
};
