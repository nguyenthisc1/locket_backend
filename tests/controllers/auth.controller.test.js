import request from "supertest";
import "../config/db.js";
import app from "../index.js";

const baseUrl = "/api/test/auth";

const validUser = {
	username: "testuser",
	email: "test@example.com",
	phoneNumber: "1234567890",
	password: "Testuser123",
};

let cookies = "";

// Helper to register a user
async function registerUser(user = validUser) {
	return await request(app).post(`${baseUrl}/register`).send(user);
}

// Helper to login a user
async function loginUser({ email, phoneNumber, password }) {
	return await request(app).post(`${baseUrl}/login`).send({ email, phoneNumber, password });
}

describe("Auth API", () => {
	describe("POST /register", () => {
		it("should register a new user", async () => {
			const res = await registerUser();
			expect(res.statusCode).toBe(201);
			expect(res.body).toHaveProperty("accessToken");
			expect(res.body).toHaveProperty("refreshToken");
			expect(res.body).toHaveProperty("user");
			expect(res.body.user.email).toBe(validUser.email);
		});

		it("should not allow duplicate registration", async () => {
			await registerUser();
			const res = await registerUser();
			expect(res.statusCode).toBe(409);
			expect(res.body.message).toMatch(/already exists/i);
		});

		it("should fail with missing fields", async () => {
			const res = await registerUser({});
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});

		it("should fail with invalid email", async () => {
			const res = await registerUser({ ...validUser, email: "bademail" });
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});

		it("should fail with weak password", async () => {
			const res = await registerUser({ ...validUser, password: "123" });
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});

		it("should fail with invalid username", async () => {
			const res = await registerUser({ ...validUser, username: "!!" });
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});

		it("should fail with invalid phone number", async () => {
			const res = await registerUser({ ...validUser, phoneNumber: "abc" });
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});
	});

	describe("POST /login", () => {
		beforeEach(async () => {
			await registerUser();
		});

		it("should login with email and password", async () => {
			const res = await loginUser({ email: validUser.email, password: validUser.password });
			expect(res.statusCode).toBe(200);
			expect(res.body).toHaveProperty("accessToken");
			expect(res.body).toHaveProperty("refreshToken");
			expect(res.body).toHaveProperty("user");
			expect(res.body.user.email).toBe(validUser.email);
			cookies = res.headers["set-cookie"];
		});

		it("should login with phone number and password", async () => {
			const res = await loginUser({ phoneNumber: validUser.phoneNumber, password: validUser.password });
			expect(res.statusCode).toBe(200);
			expect(res.body.user.phoneNumber).toBe(validUser.phoneNumber);
		});

		it("should fail with wrong password", async () => {
			const res = await loginUser({ email: validUser.email, password: "WrongPass123" });
			expect(res.statusCode).toBe(401);
			expect(res.body.message).toMatch(/invalid credentials/i);
		});

		it("should fail with non-existent user", async () => {
			const res = await loginUser({ email: "nouser@example.com", password: "Testuser123" });
			expect(res.statusCode).toBe(404);
			expect(res.body.message).toMatch(/not found/i);
		});

		it("should fail with missing password", async () => {
			const res = await loginUser({ email: validUser.email });
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});

		it("should fail with missing email and phone", async () => {
			const res = await loginUser({ password: validUser.password });
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});
	});

	describe("POST /refresh", () => {
		beforeEach(async () => {
			await registerUser();
			const res = await loginUser({ email: validUser.email, password: validUser.password });
			cookies = res.headers["set-cookie"];
		});

		it("should refresh tokens with valid refresh token", async () => {
			const res = await request(app).post(`${baseUrl}/refresh`).set("Cookie", cookies).send();
			expect(res.statusCode).toBe(200);
			expect(res.body).toHaveProperty("accessToken");
			expect(res.body).toHaveProperty("refreshToken");
		});

		it("should fail without refresh token", async () => {
			const res = await request(app).post(`${baseUrl}/refresh`).send();
			expect(res.statusCode).toBe(401);
			expect(res.body.message).toMatch(/missing refresh token/i);
		});

		it("should fail with invalid refresh token", async () => {
			const res = await request(app).post(`${baseUrl}/refresh`).set("Cookie", "refreshToken=invalidtoken").send();
			expect(res.statusCode).toBe(401);
			expect(res.body.message).toMatch(/invalid refresh token/i);
		});
	});

	describe("POST /logout", () => {
		beforeEach(async () => {
			await registerUser();
			const res = await loginUser({ email: validUser.email, password: validUser.password });
			cookies = res.headers["set-cookie"];
		});

		it("should logout and clear refresh token cookie", async () => {
			const res = await request(app).post(`${baseUrl}/logout`).set("Cookie", cookies).send();
			expect(res.statusCode).toBe(200);
			expect(res.body.message).toMatch(/logged out/i);
		});
	});
});
