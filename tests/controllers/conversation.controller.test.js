import request from "supertest";
import "../config/db.js";
import app from "../index.js";

const baseUrl = "/api/test/conversation";
const authBaseUrl = "/api/test/auth";

const validUser = {
	username: "testuser",
	email: "test@example.com",
	phoneNumber: "1234567890",
	password: "Testuser123",
};

const secondUser = {
	username: "seconduser",
	email: "second@example.com",
	phoneNumber: "0987654321",
	password: "Seconduser123",
};

const thirdUser = {
	username: "thirduser",
	email: "third@example.com",
	phoneNumber: "1122334455",
	password: "Thirduser123",
};

let cookies = "";
let userId = "";
let secondUserCookies = "";
let secondUserId = "";
let thirdUserCookies = "";
let thirdUserId = "";
let conversationId = "";

async function registerAndLogin(user = validUser) {
	const registerRes = await request(app).post(`${authBaseUrl}/register`).send(user);
	expect(registerRes.statusCode).toBe(201);

	const loginRes = await request(app).post(`${authBaseUrl}/login`).send({
		email: user.email,
		password: user.password,
	});
	expect(loginRes.statusCode).toBe(200);

	return {
		cookies: loginRes.headers["set-cookie"],
		userId: loginRes.body.user.id,
	};
}

async function createConversation(conversationData, userCookies = cookies) {
	const res = await request(app)
		.post(`${baseUrl}/`)
		.set("Cookie", userCookies)
		.send(conversationData);
	return res;
}

describe("Conversation API", () => {
	beforeEach(async () => {
		const user1 = await registerAndLogin(validUser);
		cookies = user1.cookies;
		userId = user1.userId;

		const user2 = await registerAndLogin(secondUser);
		secondUserCookies = user2.cookies;
		secondUserId = user2.userId;

		const user3 = await registerAndLogin(thirdUser);
		thirdUserCookies = user3.cookies;
		thirdUserId = user3.userId;
	});

	// Debug test
	it("should debug create conversation", async () => {
		const conversationData = {
			participants: [secondUserId],
			isGroup: false,
		};

		const res = await request(app)
			.post(`${baseUrl}/`)
			.set("Cookie", cookies)
			.send(conversationData);

		console.log('Debug response:', {
			status: res.statusCode,
			body: res.body,
			headers: res.headers,
			errors: res.body.errors || res.body?.errors || (res.body && res.body.data && res.body.data.errors)
		});
	});

	describe("POST / (createConversation)", () => {
		it("should create a private conversation", async () => {
			const conversationData = {
				participants: [secondUserId],
				isGroup: false,
			};

			const res = await createConversation(conversationData);
			expect(res.statusCode).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.data.conversation.isGroup).toBe(false);
			expect(res.body.data.participants).toHaveLength(2);
			expect(res.body.data.participants.some((p) => p._id === userId)).toBe(true);
			expect(res.body.data.participants.some((p) => p._id === secondUserId)).toBe(true);
		});

		it("should create a group conversation", async () => {
			const conversationData = {
				name: "Test Group",
				participants: [secondUserId, thirdUserId],
				isGroup: true,
				groupSettings: {
					allowMemberInvite: true,
					allowMemberEdit: false,
				},
			};

			const res = await createConversation(conversationData);
			expect(res.statusCode).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.data.conversation.isGroup).toBe(true);
			expect(res.body.data.conversation.name).toBe("Test Group");
			expect(res.body.data.participants).toHaveLength(3);
			expect(res.body.data.conversation.admin._id).toBe(userId);
		});

		it("should fail with invalid participant ID", async () => {
			const conversationData = {
				participants: ["invalid-id"],
				isGroup: false,
			};

			const res = await createConversation(conversationData);
			expect(res.statusCode).toBe(400);
			expect(res.body.success).toBe(false);
		});

		it("should fail with empty participants array", async () => {
			const conversationData = {
				participants: [],
				isGroup: false,
			};

			const res = await createConversation(conversationData);
			expect(res.statusCode).toBe(400);
			expect(res.body.success).toBe(false);
		});

		it("should fail with invalid group settings", async () => {
			const conversationData = {
				name: "Test Group",
				participants: [secondUserId],
				isGroup: true,
				groupSettings: {
					allowMemberInvite: "invalid",
				},
			};

			const res = await createConversation(conversationData);
			expect(res.statusCode).toBe(400);
			expect(res.body.success).toBe(false);
		});
	});

	describe("GET / (getUserConversations)", () => {
		beforeEach(async () => {
			await createConversation({
				participants: [secondUserId],
				isGroup: false,
			});
		});

		it("should return user's conversations", async () => {
			const res = await request(app).get(`${baseUrl}/user`).set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.conversations).toBeDefined();
			expect(res.body.data.pagination).toBeDefined();
			expect(res.body.data.conversations.length).toBeGreaterThan(0);
		});

		it("should paginate results", async () => {
			const res = await request(app)
				.get(`${baseUrl}/user/?page=1&limit=1`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.data.conversations.length).toBeLessThanOrEqual(1);
			expect(res.body.data.pagination.page).toBe(1);
		});
	});

	describe("GET /:conversationId (getConversation)", () => {
		beforeEach(async () => {
			const convRes = await createConversation({
				participants: [secondUserId],
				isGroup: false,
			});
			conversationId = convRes.body.data.conversation.id;
		});

		it("should return conversation by ID", async () => {
			const res = await request(app)
				.get(`${baseUrl}/${conversationId}`)
				.set("Cookie", cookies);
			
			console.log('Get conversation debug:', {
				status: res.statusCode,
				body: res.body,
				conversationId,
				headers: res.headers
			});
			
			expect(res.statusCode).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.conversation.id).toBe(conversationId);
		});

		it("should return 404 for non-existent conversation", async () => {
			const fakeId = "507f1f77bcf86cd799439011";
			const res = await request(app)
				.get(`${baseUrl}/${fakeId}`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(404);
			expect(res.body.success).toBe(false);
		});

		it("should return 404 for conversation user is not part of", async () => {
			const res = await request(app)
				.get(`${baseUrl}/${conversationId}`)
				.set("Cookie", thirdUserCookies);
			expect(res.statusCode).toBe(404);
			expect(res.body.success).toBe(false);
		});
	});

	describe("PUT /:conversationId (updateConversation)", () => {
		beforeEach(async () => {
			const convRes = await createConversation({
				name: "Original Name",
				participants: [secondUserId],
				isGroup: true,
			});
			conversationId = convRes.body.data.conversation.id;
		});

		it("should update conversation name", async () => {
			const res = await request(app)
				.put(`${baseUrl}/${conversationId}`)
				.set("Cookie", cookies)
				.send({ name: "Updated Name" });
			expect(res.statusCode).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.conversation.name).toBe("Updated Name");
		});

		it("should update group settings", async () => {
			const res = await request(app)
				.put(`${baseUrl}/${conversationId}`)
				.set("Cookie", cookies)
				.send({
					groupSettings: {
						allowMemberInvite: false,
						allowMemberEdit: true,
					},
				});
			expect(res.statusCode).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.conversation.groupSettings.allowMemberInvite).toBe(false);
			expect(res.body.data.conversation.groupSettings.allowMemberEdit).toBe(true);
		});

		it("should fail when non-admin tries to update group settings", async () => {
			const res = await request(app)
				.put(`${baseUrl}/${conversationId}`)
				.set("Cookie", secondUserCookies)
				.send({
					groupSettings: {
						allowMemberInvite: false,
					},
				});
			expect(res.statusCode).toBe(403);
			expect(res.body.success).toBe(false);
		});

		it("should return 404 for non-existent conversation", async () => {
			const fakeId = "507f1f77bcf86cd799439011";
			const res = await request(app)
				.put(`${baseUrl}/${fakeId}`)
				.set("Cookie", cookies)
				.send({ name: "Updated Name" });
			expect(res.statusCode).toBe(404);
			expect(res.body.success).toBe(false);
		});
	});

	describe("POST /:conversationId/participants (addParticipants)", () => {
		beforeEach(async () => {
			const convRes = await createConversation({
				participants: [secondUserId],
				isGroup: true,
			});
			conversationId = convRes.body.data.conversation.id;
		});

		it("should add participants to group conversation", async () => {
			const res = await request(app)
				.post(`${baseUrl}/${conversationId}/participants`)
				.set("Cookie", cookies)
				.send({ userIds: [thirdUserId] });
			expect(res.statusCode).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.participants).toHaveLength(3);
			expect(res.body.data.participants.some((p) => p._id === thirdUserId)).toBe(true);
		});

		it("should fail when non-admin tries to add participants", async () => {
			// First, update group settings to disallow member invites
			await request(app)
				.put(`${baseUrl}/${conversationId}`)
				.set("Cookie", cookies)
				.send({
					groupSettings: {
						allowMemberInvite: false,
					},
				});

			const res = await request(app)
				.post(`${baseUrl}/${conversationId}/participants`)
				.set("Cookie", secondUserCookies)
				.send({ userIds: [thirdUserId] });
			expect(res.statusCode).toBe(403);
			expect(res.body.success).toBe(false);
		});

		it("should fail with invalid user IDs", async () => {
			const res = await request(app)
				.post(`${baseUrl}/${conversationId}/participants`)
				.set("Cookie", cookies)
				.send({ userIds: ["invalid-id"] });
			expect(res.statusCode).toBe(400);
			expect(res.body.success).toBe(false);
		});

		it("should return 404 for non-existent conversation", async () => {
			const fakeId = "507f1f77bcf86cd799439011";
			const res = await request(app)
				.post(`${baseUrl}/${fakeId}/participants`)
				.set("Cookie", cookies)
				.send({ userIds: [thirdUserId] });
			expect(res.statusCode).toBe(404);
			expect(res.body.success).toBe(false);
		});
	});

	describe("DELETE /:conversationId/participants (removeParticipant)", () => {
		beforeEach(async () => {
			const convRes = await createConversation({
				participants: [secondUserId, thirdUserId],
				isGroup: true,
			});
			conversationId = convRes.body.data.conversation.id;
		});

		it("should remove participant from group conversation", async () => {
			const res = await request(app)
				.delete(`${baseUrl}/${conversationId}/participants`)
				.set("Cookie", cookies)
				.send({ userId: secondUserId });
			expect(res.statusCode).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.participants).toHaveLength(2);
			expect(res.body.data.participants.some((p) => p._id === secondUserId)).toBe(false);
		});

		it("should fail when trying to remove admin", async () => {
			// First, enable member edit permissions so the code reaches the admin check
			await request(app)
				.put(`${baseUrl}/${conversationId}`)
				.set("Cookie", cookies)
				.send({
					groupSettings: {
						allowMemberEdit: true,
					},
				});

			const res = await request(app)
				.delete(`${baseUrl}/${conversationId}/participants`)
				.set("Cookie", secondUserCookies)
				.send({ userId: userId });
			expect(res.statusCode).toBe(400);
			expect(res.body.success).toBe(false);
		});

		it("should fail with invalid user ID", async () => {
			const res = await request(app)
				.delete(`${baseUrl}/${conversationId}/participants`)
				.set("Cookie", cookies)
				.send({ userId: "invalid-id" });
			expect(res.statusCode).toBe(400);
			expect(res.body.success).toBe(false);
		});
	});

	describe("GET /search (searchConversations)", () => {
		beforeEach(async () => {
			await createConversation({
				name: "Test Group Chat",
				participants: [secondUserId],
				isGroup: true,
			});
			await createConversation({
				participants: [thirdUserId],
				isGroup: false,
			});
		});

		it("should search conversations by name", async () => {
			const res = await request(app)
				.get(`${baseUrl}/search?query=Group`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.conversations.length).toBeGreaterThan(0);
		});

		it("should filter by group conversations", async () => {
			const res = await request(app)
				.get(`${baseUrl}/search?isGroup=true`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.conversations.every((c) => c.isGroup)).toBe(true);
		});

		it("should filter by private conversations", async () => {
			const res = await request(app)
				.get(`${baseUrl}/search?isGroup=false`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.conversations.every((c) => !c.isGroup)).toBe(true);
		});

		it("should paginate search results", async () => {
			const res = await request(app)
				.get(`${baseUrl}/search?page=1&limit=1`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.data.conversations.length).toBeLessThanOrEqual(1);
		});
	});

	describe("GET /:conversationId/threads (getConversationThreads)", () => {
		beforeEach(async () => {
			const convRes = await createConversation({
				participants: [secondUserId],
				isGroup: true,
			});
			conversationId = convRes.body.data.conversation.id;
		});

		it("should return conversation threads", async () => {
			const res = await request(app)
				.get(`${baseUrl}/${conversationId}/threads`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.conversations).toBeDefined();
			expect(res.body.data.pagination).toBeDefined();
		});

		it("should return 404 for non-existent conversation", async () => {
			const fakeId = "507f1f77bcf86cd799439011";
			const res = await request(app)
				.get(`${baseUrl}/${fakeId}/threads`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(404);
			expect(res.body.success).toBe(false);
		});
	});

	describe("POST /:conversationId/leave (leaveConversation)", () => {
		beforeEach(async () => {
			const convRes = await createConversation({
				participants: [secondUserId, thirdUserId],
				isGroup: true,
			});
			conversationId = convRes.body.data.conversation.id;
		});

		it("should allow user to leave conversation", async () => {
			const res = await request(app)
				.post(`${baseUrl}/${conversationId}/leave`)
				.set("Cookie", secondUserCookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.success).toBe(true);
		});

		it("should fail when trying to leave single-participant conversation", async () => {
			// First remove other participants
			await request(app)
				.delete(`${baseUrl}/${conversationId}/participants`)
				.set("Cookie", cookies)
				.send({ userId: secondUserId });
			await request(app)
				.delete(`${baseUrl}/${conversationId}/participants`)
				.set("Cookie", cookies)
				.send({ userId: thirdUserId });

			const res = await request(app)
				.post(`${baseUrl}/${conversationId}/leave`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(400);
			expect(res.body.success).toBe(false);
		});

		it("should return 404 for non-existent conversation", async () => {
			const fakeId = "507f1f77bcf86cd799439011";
			const res = await request(app)
				.post(`${baseUrl}/${fakeId}/leave`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(404);
			expect(res.body.success).toBe(false);
		});
	});

	describe("DELETE /:conversationId (deleteConversation)", () => {
		beforeEach(async () => {
			const convRes = await createConversation({
				participants: [secondUserId],
				isGroup: true,
			});
			conversationId = convRes.body.data.conversation.id;
		});

		it("should allow admin to delete group conversation", async () => {
			const res = await request(app)
				.delete(`${baseUrl}/${conversationId}`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.success).toBe(true);
		});

		it("should fail when non-admin tries to delete group conversation", async () => {
			const res = await request(app)
				.delete(`${baseUrl}/${conversationId}`)
				.set("Cookie", secondUserCookies);
			expect(res.statusCode).toBe(403);
			expect(res.body.success).toBe(false);
		});

		it("should return 404 for non-existent conversation", async () => {
			const fakeId = "507f1f77bcf86cd799439011";
			const res = await request(app)
				.delete(`${baseUrl}/${fakeId}`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(404);
			expect(res.body.success).toBe(false);
		});
	});
}); 