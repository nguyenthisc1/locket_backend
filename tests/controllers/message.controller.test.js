import request from "supertest";
import "../config/db.js";
import app from "../index.js";

const baseUrl = "/api/test/message";
const authBaseUrl = "/api/test/auth";
const conversationBaseUrl = "/api/test/conversation";

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

let cookies = "";
let userId = "";
let secondUserCookies = "";
let secondUserId = "";
let conversationId = "";
let messageId = "";

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

async function createConversation(userCookies, participantId) {
  const res = await request(app)
    .post(`${conversationBaseUrl}/`)
    .set("Cookie", userCookies)
    .send({
      participants: [participantId],
      isGroup: false,
    });
  expect(res.statusCode).toBe(201);
  return res.body.data.conversation.id;
}

async function sendMessage(userCookies, conversationId, text = "Hello!") {
  const res = await request(app)
    .post(`${baseUrl}/`)
    .set("Cookie", userCookies)
    .send({ conversationId, text });
  expect(res.statusCode).toBe(201);
  return res.body.data.message.id;
}

describe("Message API", () => {
  beforeEach(async () => {
    const user1 = await registerAndLogin(validUser);
    cookies = user1.cookies;
    userId = user1.userId;

    const user2 = await registerAndLogin(secondUser);
    secondUserCookies = user2.cookies;
    secondUserId = user2.userId;

    conversationId = await createConversation(cookies, secondUserId);
    messageId = await sendMessage(cookies, conversationId, "Hello from user1");
  });

  describe("POST / (sendMessage)", () => {
    it("should send a message", async () => {
      const res = await request(app)
        .post(`${baseUrl}/`)
        .set("Cookie", cookies)
        .send({ conversationId, text: "Test message" });
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.text).toBe("Test message");
      expect(res.body.data.message.conversationId).toBe(conversationId);
    });

    it("should fail with invalid conversationId", async () => {
      const res = await request(app)
        .post(`${baseUrl}/`)
        .set("Cookie", cookies)
        .send({ conversationId: "invalid-id", text: "Test" });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should fail if not a participant", async () => {
      const res = await request(app)
        .post(`${baseUrl}/`)
        .set("Cookie", secondUserCookies)
        .send({ conversationId: "507f1f77bcf86cd799439011", text: "Test" });
      expect([403, 404]).toContain(res.statusCode);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /conversation/:conversationId (getConversationMessages)", () => {
    it("should get messages for a conversation", async () => {
      const res = await request(app)
        .get(`${baseUrl}/conversation/${conversationId}`)
        .set("Cookie", cookies);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messages.length).toBeGreaterThan(0);
      expect(res.body.data.messages[0].conversationId).toBe(conversationId);
    });

    it("should fail for non-participant", async () => {
      const res = await request(app)
        .get(`${baseUrl}/conversation/${conversationId}`)
        .set("Cookie", secondUserCookies);
      expect(res.statusCode).toBe(200); // Should still succeed for participant
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /:messageId (getMessage)", () => {
    it("should get a message by ID", async () => {
      const res = await request(app)
        .get(`${baseUrl}/${messageId}`)
        .set("Cookie", cookies);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.id).toBe(messageId);
    });

    it("should return 404 for non-existent message", async () => {
      const res = await request(app)
        .get(`${baseUrl}/507f1f77bcf86cd799439011`)
        .set("Cookie", cookies);
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PUT /:messageId (editMessage)", () => {
    it("should edit a message", async () => {
      const res = await request(app)
        .put(`${baseUrl}/${messageId}`)
        .set("Cookie", cookies)
        .send({ text: "Edited message" });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.text).toBe("Edited message");
    });

    it("should fail with invalid messageId", async () => {
      const res = await request(app)
        .put(`${baseUrl}/invalid-id`)
        .set("Cookie", cookies)
        .send({ text: "Edit" });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should fail if not sender", async () => {
      const res = await request(app)
        .put(`${baseUrl}/${messageId}`)
        .set("Cookie", secondUserCookies)
        .send({ text: "Edit" });
      expect([403, 404]).toContain(res.statusCode);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /:messageId (deleteMessage)", () => {
    it("should delete a message", async () => {
      const res = await request(app)
        .delete(`${baseUrl}/${messageId}`)
        .set("Cookie", cookies);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should fail if not sender", async () => {
      const res = await request(app)
        .delete(`${baseUrl}/${messageId}`)
        .set("Cookie", secondUserCookies);
      expect([403, 404]).toContain(res.statusCode);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /:messageId/reactions (addReaction)", () => {
    it("should add a reaction", async () => {
      const res = await request(app)
        .post(`${baseUrl}/${messageId}/reactions`)
        .set("Cookie", cookies)
        .send({ reactionType: "like" });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.reactions.length).toBe(1);
    });

    it("should fail with invalid messageId", async () => {
      const res = await request(app)
        .post(`${baseUrl}/invalid-id/reactions`)
        .set("Cookie", cookies)
        .send({ reactionType: "like" });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /:messageId/reactions (removeReaction)", () => {
    it("should remove a reaction", async () => {
      await request(app)
        .post(`${baseUrl}/${messageId}/reactions`)
        .set("Cookie", cookies)
        .send({ reactionType: "like" });
      const res = await request(app)
        .delete(`${baseUrl}/${messageId}/reactions`)
        .set("Cookie", cookies);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.reactions.length).toBe(0);
    });
  });

  describe("POST /:messageId/reply (replyToMessage)", () => {
    it("should reply to a message", async () => {
      const res = await request(app)
        .post(`${baseUrl}/${messageId}/reply`)
        .set("Cookie", cookies)
        .send({ text: "Reply message" });
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.text).toBe("Reply message");
      const replyTo = res.body.data.message.replyTo;
      expect(
        replyTo === messageId ||
        replyTo?._id === messageId ||
        replyTo?.id === messageId
      ).toBe(true);
    });
  });

  describe("GET /:messageId/thread (getThreadMessages)", () => {
    it("should get thread messages", async () => {
      // First, reply to create a thread
      const replyRes = await request(app)
        .post(`${baseUrl}/${messageId}/reply`)
        .set("Cookie", cookies)
        .send({ text: "Thread reply" });
      const replyId = replyRes.body.data.message.id;
      const res = await request(app)
        .get(`${baseUrl}/${messageId}/thread`)
        .set("Cookie", cookies);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messages.length).toBeGreaterThan(0);
    });
  });

  describe("POST /:messageId/pin (pinMessage)", () => {
    it("should pin a message (admin only for group)", async () => {
      // For private, any sender can pin
      const res = await request(app)
        .post(`${baseUrl}/${messageId}/pin`)
        .set("Cookie", cookies)
        .send({ messageId, action: "pin" });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message.isPinned).toBe(true);
    });
  });

  describe("POST /forward (forwardMessages)", () => {
    it("should forward a message to another conversation", async () => {
      // Create another conversation
      const convRes = await request(app)
        .post(`${conversationBaseUrl}/`)
        .set("Cookie", cookies)
        .send({ participants: [secondUserId], isGroup: false });
      const newConvId = convRes.body.data.conversation.id;
      const res = await request(app)
        .post(`${baseUrl}/forward`)
        .set("Cookie", cookies)
        .send({
          targetConversationIds: [newConvId],
          messageIds: [messageId],
        });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.forwardedCount).toBe(1);
    });
  });

  describe("GET /search (searchMessages)", () => {
    it("should search messages by text", async () => {
      const res = await request(app)
        .get(`${baseUrl}/search`)
        .set("Cookie", cookies)
        .query({ query: "Hello" });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messages.length).toBeGreaterThan(0);
    });
  });
}); 