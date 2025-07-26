import request from "supertest";
import "../config/db.js";
import app from "../index.js";

const baseUrl = "/api/test/photo";
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

const validPhoto = {
	imageUrl: "https://example.com/photo.jpg",
	caption: "Test photo caption",
	sharedWith: [],
	location: { lat: 40.7128, lng: -74.0060 },
};

let cookies = "";
let userId = "";
let secondUserCookies = "";
let secondUserId = "";
let photoId = "";

async function registerAndLogin(user = validUser) {
	await request(app).post(`${authBaseUrl}/register`).send(user);
	const res = await request(app).post(`${authBaseUrl}/login`).send({ email: user.email, password: user.password });
	return {
		cookies: res.headers["set-cookie"],
		userId: res.body.user.id,
	};
}

async function createPhoto(photoData = validPhoto, userCookies = cookies) {
	const res = await request(app).post(`${baseUrl}/`).set("Cookie", userCookies).send(photoData);
	return res;
}

describe("Photo API", () => {
	beforeEach(async () => {
		const user1 = await registerAndLogin(validUser);
		cookies = user1.cookies;
		userId = user1.userId;

		const user2 = await registerAndLogin(secondUser);
		secondUserCookies = user2.cookies;
		secondUserId = user2.userId;
	});

	describe("POST / (createPhoto)", () => {
		it("should create a new photo", async () => {
			const res = await createPhoto();
			expect(res.statusCode).toBe(201);
			expect(res.body.photo).toBeDefined();
			expect(res.body.photo.imageUrl).toBe(validPhoto.imageUrl);
			expect(res.body.photo.caption).toBe(validPhoto.caption);
			photoId = res.body.photo.id;
		});

		it("should fail with invalid image URL", async () => {
			const res = await createPhoto({ ...validPhoto, imageUrl: "not-a-url" });
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});

		it("should fail with missing image URL", async () => {
			const res = await createPhoto({ ...validPhoto, imageUrl: "" });
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});

		it("should fail with caption too long", async () => {
			const longCaption = "a".repeat(501);
			const res = await createPhoto({ ...validPhoto, caption: longCaption });
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});

		it("should fail with invalid location coordinates", async () => {
			const res = await createPhoto({ ...validPhoto, location: { lat: 100, lng: 200 } });
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});
	});

	describe("GET / (getPhotos)", () => {
		beforeEach(async () => {
			await createPhoto();
		});

		it("should return photos with cursor-based pagination", async () => {
			const res = await request(app).get(`${baseUrl}/?limit=5`).set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.photos).toBeDefined();
			expect(res.body.pagination).toBeDefined();
			expect(res.body.pagination.hasNextPage).toBeDefined();
		});

		it("should filter photos by query", async () => {
			const res = await request(app).get(`${baseUrl}/?query=test`).set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.photos.length).toBeGreaterThan(0);
		});

		it("should filter photos by userId", async () => {
			const res = await request(app).get(`${baseUrl}/?userId=${userId}`).set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.photos.length).toBeGreaterThan(0);
		});

		it("should return shared photos when sharedWithMe=true", async () => {
			// Create a photo shared with second user
			await createPhoto({ ...validPhoto, sharedWith: [secondUserId] });
			const res = await request(app).get(`${baseUrl}/?sharedWithMe=true`).set("Cookie", secondUserCookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.photos.length).toBeGreaterThan(0);
		});
	});

	describe("GET /:photoId (getPhotoById)", () => {
		beforeEach(async () => {
			const res = await createPhoto();
			photoId = res.body.photo.id;
		});

		it("should return photo by ID", async () => {
			const res = await request(app).get(`${baseUrl}/${photoId}`).set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.photo.id).toBe(photoId);
		});

		it("should return 404 for non-existent photo", async () => {
			const fakeId = "507f1f77bcf86cd799439011";
			const res = await request(app).get(`${baseUrl}/${fakeId}`).set("Cookie", cookies);
			expect(res.statusCode).toBe(404);
			expect(res.body.message).toMatch(/not found/i);
		});

		it("should return 403 for photo not shared with user", async () => {
			const res = await request(app).get(`${baseUrl}/${photoId}`).set("Cookie", secondUserCookies);
			expect(res.statusCode).toBe(403);
			expect(res.body.message).toMatch(/access denied/i);
		});

		it("should allow access to shared photo", async () => {
			// Update photo to share with second user
			await request(app)
				.put(`${baseUrl}/${photoId}`)
				.set("Cookie", cookies)
				.send({ sharedWith: [secondUserId] });

			const res = await request(app).get(`${baseUrl}/${photoId}`).set("Cookie", secondUserCookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.photo.id).toBe(photoId);
		});
	});

	describe("PUT /:photoId (updatePhoto)", () => {
		beforeEach(async () => {
			const res = await createPhoto();
			photoId = res.body.photo.id;
		});

		it("should update photo caption", async () => {
			const res = await request(app)
				.put(`${baseUrl}/${photoId}`)
				.set("Cookie", cookies)
				.send({ caption: "Updated caption" });
			expect(res.statusCode).toBe(200);
			expect(res.body.photo.caption).toBe("Updated caption");
		});

		it("should update photo sharing", async () => {
			const res = await request(app)
				.put(`${baseUrl}/${photoId}`)
				.set("Cookie", cookies)
				.send({ sharedWith: [secondUserId] });
			expect(res.statusCode).toBe(200);
			expect(res.body.photo.sharedWith).toHaveLength(1);
			expect(res.body.photo.sharedWith[0]._id).toBe(secondUserId);
		});

		it("should return 404 for non-existent photo", async () => {
			const fakeId = "507f1f77bcf86cd799439011";
			const res = await request(app)
				.put(`${baseUrl}/${fakeId}`)
				.set("Cookie", cookies)
				.send({ caption: "Updated" });
			expect(res.statusCode).toBe(404);
			expect(res.body.message).toMatch(/not found/i);
		});

		it("should return 403 when updating another user's photo", async () => {
			const res = await request(app)
				.put(`${baseUrl}/${photoId}`)
				.set("Cookie", secondUserCookies)
				.send({ caption: "Hacked!" });
			expect(res.statusCode).toBe(403);
			expect(res.body.message).toMatch(/access denied/i);
		});

		it("should fail with invalid caption length", async () => {
			const longCaption = "a".repeat(501);
			const res = await request(app)
				.put(`${baseUrl}/${photoId}`)
				.set("Cookie", cookies)
				.send({ caption: longCaption });
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});
	});

	describe("DELETE /:photoId (deletePhoto)", () => {
		beforeEach(async () => {
			const res = await createPhoto();
			photoId = res.body.photo.id;
		});

		it("should delete photo", async () => {
			const res = await request(app).delete(`${baseUrl}/${photoId}`).set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.message).toMatch(/deleted successfully/i);
		});

		it("should return 404 for non-existent photo", async () => {
			const fakeId = "507f1f77bcf86cd799439011";
			const res = await request(app).delete(`${baseUrl}/${fakeId}`).set("Cookie", cookies);
			expect(res.statusCode).toBe(404);
			expect(res.body.message).toMatch(/not found/i);
		});

		it("should return 403 when deleting another user's photo", async () => {
			const res = await request(app).delete(`${baseUrl}/${photoId}`).set("Cookie", secondUserCookies);
			expect(res.statusCode).toBe(403);
			expect(res.body.message).toMatch(/access denied/i);
		});
	});

	describe("POST /:photoId/reactions (addReaction)", () => {
		beforeEach(async () => {
			const res = await createPhoto();
			photoId = res.body.photo.id;
		});

		it("should add reaction to photo", async () => {
			const res = await request(app)
				.post(`${baseUrl}/${photoId}/reactions`)
				.set("Cookie", cookies)
				.send({ reactionType: "like" });
			expect(res.statusCode).toBe(200);
			expect(res.body.photo.reactions.length).toBe(1);
			expect(res.body.photo.reactions[0].type).toBe("like");
		});

		it("should update existing reaction", async () => {
			// Add initial reaction
			await request(app)
				.post(`${baseUrl}/${photoId}/reactions`)
				.set("Cookie", cookies)
				.send({ reactionType: "like" });

			// Update reaction
			const res = await request(app)
				.post(`${baseUrl}/${photoId}/reactions`)
				.set("Cookie", cookies)
				.send({ reactionType: "love" });
			expect(res.statusCode).toBe(200);
			expect(res.body.photo.reactions[0].type).toBe("love");
		});

		it("should return 404 for non-existent photo", async () => {
			const fakeId = "507f1f77bcf86cd799439011";
			const res = await request(app)
				.post(`${baseUrl}/${fakeId}/reactions`)
				.set("Cookie", cookies)
				.send({ reactionType: "like" });
			expect(res.statusCode).toBe(404);
			expect(res.body.message).toMatch(/not found/i);
		});

		it("should return 403 for photo not shared with user", async () => {
			const res = await request(app)
				.post(`${baseUrl}/${photoId}/reactions`)
				.set("Cookie", secondUserCookies)
				.send({ reactionType: "like" });
			expect(res.statusCode).toBe(403);
			expect(res.body.message).toMatch(/access denied/i);
		});

		it("should fail with missing reaction type", async () => {
			const res = await request(app)
				.post(`${baseUrl}/${photoId}/reactions`)
				.set("Cookie", cookies)
				.send({});
			expect(res.statusCode).toBe(400);
			expect(res.body.errors).toBeDefined();
		});
	});

	describe("DELETE /:photoId/reactions (removeReaction)", () => {
		beforeEach(async () => {
			const res = await createPhoto();
			photoId = res.body.photo.id;
			// Add a reaction first
			await request(app)
				.post(`${baseUrl}/${photoId}/reactions`)
				.set("Cookie", cookies)
				.send({ reactionType: "like" });
		});

		it("should remove reaction from photo", async () => {
			const res = await request(app).delete(`${baseUrl}/${photoId}/reactions`).set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.photo.reactions.length).toBe(0);
		});

		it("should return 404 for non-existent photo", async () => {
			const fakeId = "507f1f77bcf86cd799439011";
			const res = await request(app).delete(`${baseUrl}/${fakeId}/reactions`).set("Cookie", cookies);
			expect(res.statusCode).toBe(404);
			expect(res.body.message).toMatch(/not found/i);
		});

		it("should return 403 for photo not shared with user", async () => {
			const res = await request(app).delete(`${baseUrl}/${photoId}/reactions`).set("Cookie", secondUserCookies);
			expect(res.statusCode).toBe(403);
			expect(res.body.message).toMatch(/access denied/i);
		});
	});

	describe("GET /:userId (getUserPhotos)", () => {
		beforeEach(async () => {
			await createPhoto();
		});

		it("should return user's own photos", async () => {
			const res = await request(app).get(`${baseUrl}/user/${userId}`).set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.photos).toBeDefined();
			expect(res.body.pagination).toBeDefined();
		});

		it("should return shared photos when viewing another user's photos", async () => {
			// Create a photo shared with second user
			await createPhoto({ ...validPhoto, sharedWith: [secondUserId] });
			const res = await request(app).get(`${baseUrl}/user/${userId}`).set("Cookie", secondUserCookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.photos.length).toBeGreaterThan(0);
		});

		it("should return 404 for non-existent user", async () => {
			const fakeId = "507f1f77bcf86cd799439011";
			const res = await request(app).get(`${baseUrl}/user/${fakeId}`).set("Cookie", cookies);
			expect(res.statusCode).toBe(404);
			expect(res.body.message).toMatch(/user not found/i);
		});

		it("should paginate results", async () => {
			const res = await request(app).get(`${baseUrl}/user/${userId}?limit=1&page=1`).set("Cookie", cookies);
			expect(res.statusCode).toBe(200);
			expect(res.body.photos.length).toBeLessThanOrEqual(1);
			expect(res.body.pagination).toBeDefined();
		});
	});
}); 