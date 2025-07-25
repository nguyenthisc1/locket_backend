import request from "supertest";
import "../config/db.js";
import app from "../index.js";

const baseUrl = "/api/test/user";
const authBaseUrl = "/api/test/auth";

const validUser = {
	username: "testuser",
	email: "test@example.com",
	phoneNumber: "1234567890",
	password: "Testuser123",
};

const secondUser = {
	username: "otheruser",
	email: "other@example.com",
	phoneNumber: "0987654321",
	password: "Otheruser123",
};

let cookies = "";
let userId = "";

async function registerAndLogin(user = validUser) {
	await request(app).post(`${authBaseUrl}/register`).send(user);
	const res = await request(app).post(`${authBaseUrl}/login`).send({ email: user.email, password: user.password });
	cookies = res.headers["set-cookie"];
	userId = res.body.user.id;
}

describe("User API", () => {
	beforeEach(async () => {
		await registerAndLogin();
	});

	describe("GET / (getProfile)", () => {
		it("should return the current user's profile", async () => {
			const res = await request(app).get(`${baseUrl}/`).set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.user).toBeDefined();
			expect(res.body.user.email).toBe(validUser.email);
		});

		it("should return 401 if user is deleted", async () => {
			await request(app).delete(`${baseUrl}/${userId}`).set("Cookie", cookies);
			const res = await request(app).get(`${baseUrl}/`).set("Cookie", cookies);
			expect(res.statusCode).toBe(401);
			expect(res.body.message).toMatch(/user not found/i);
		});
	});

	describe("PUT / (updateProfile)", () => {
		it("should update the user profile", async () => {
			const res = await request(app)
				.put(`${baseUrl}/`)
				.set("Cookie", cookies)
				.send({ username: "updateduser" });
			expect(res.statusCode).toBe(200);
			expect(res.body.message).toMatch(/updated successfully/i);
			expect(res.body.user.username).toBe("updateduser");
		});

		it("should fail with invalid email", async () => {
			const res = await request(app)
				.put(`${baseUrl}/`)
				.set("Cookie", cookies)
				.send({ email: "bademail" });
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});

		it("should fail with duplicate email", async () => {
			await request(app).post(`${authBaseUrl}/register`).send(secondUser);
			const res = await request(app)
				.put(`${baseUrl}/`)
				.set("Cookie", cookies)
				.send({ email: secondUser.email });
			expect(res.statusCode).toBe(400);
			expect(res.body.message).toMatch(/already in use/i);
		});

		it("should fail with duplicate phone number", async () => {
			await request(app).post(`${authBaseUrl}/register`).send(secondUser);
			const res = await request(app)
				.put(`${baseUrl}/`)
				.set("Cookie", cookies)
				.send({ phoneNumber: secondUser.phoneNumber });
			expect(res.statusCode).toBe(400);
			expect(res.body.message).toMatch(/already in use/i);
		});

		it("should return 401 if user is deleted", async () => {
			await request(app).delete(`${baseUrl}/${userId}`).set("Cookie", cookies);
			const res = await request(app)
				.put(`${baseUrl}/`)
				.set("Cookie", cookies)
				.send({ username: "ghost" });
			expect(res.statusCode).toBe(401);
			expect(res.body.message).toMatch(/user not found/i);
		});
	});

	describe("DELETE /:userId (deleteAccount)", () => {
		it("should delete the user account", async () => {
			const res = await request(app).delete(`${baseUrl}/${userId}`).set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.message).toMatch(/deleted successfully/i);
		});

		it("should return 401 if user is already deleted", async () => {
			await request(app).delete(`${baseUrl}/${userId}`).set("Cookie", cookies);
			const res = await request(app).delete(`${baseUrl}/${userId}`).set("Cookie", cookies);
			expect(res.statusCode).toBe(401);
			expect(res.body.message).toMatch(/user not found/i);
		});
	});

	describe("GET /search (searchUsers)", () => {
		beforeEach(async () => {
			await request(app).post(`${authBaseUrl}/register`).send(secondUser);
		});

		it("should return users matching the query", async () => {
			const res = await request(app)
				.get(`${baseUrl}/search?query=other`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.users.length).toBeGreaterThan(0);
			// Should not include the current user
			for (const user of res.body.users) {
				expect(user.email).not.toBe(validUser.email);
			}
		});

		it("should paginate results", async () => {
			const res = await request(app)
				.get(`${baseUrl}/search?query=user&limit=1&page=1`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.users.length).toBeLessThanOrEqual(1);
			expect(res.body.pagination).toBeDefined();
		});

		it("should return empty list if no match", async () => {
			const res = await request(app)
				.get(`${baseUrl}/search?query=nomatch`)
				.set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.users.length).toBe(0);
		});
	});
}); 