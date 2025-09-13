import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import swaggerUi from "swagger-ui-express";
import connectDB from "./config/db.js";
import swaggerSpec from "./docs/swagger.js";
import SocketService from "./services/socket.service.js"; 
import SocketManager from "./utils/socket.js";
import validateEnv from "./utils/validateEnv.js";

import authRoutes from "./routes/auth.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import feedRoutes from "./routes/feed.routes.js";
import messageRoutes from "./routes/message.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import userRoutes from "./routes/user.routes.js";

dotenv.config();
validateEnv();

const app = express();
const server = createServer(app);
const PORT = validateEnv.PORT || 8000;
const API_VERSION = "api/v1";

// Initialize Socket.IO
let socketManager;
let socketService; 

// Middleware
app.use(
	cors({
		origin: "*",
		credentials: true,
	})
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// API Documentation
app.use(`/${API_VERSION}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use(`/${API_VERSION}/auth`, authRoutes);
app.use(`/${API_VERSION}/user`, userRoutes);
app.use(`/${API_VERSION}/feed`, feedRoutes);
app.use(`/${API_VERSION}/upload`, uploadRoutes);
app.use(`/${API_VERSION}/conversation`, conversationRoutes);
app.use(`/${API_VERSION}/message`, messageRoutes);
app.use(`/${API_VERSION}/notifications`, notificationRoutes);

// Health check routes
app.get("/", (req, res) => {
	res.send("Locket Backend API is running!");
});

app.get("/api/health", (req, res) => {
	res.status(200).json({
		status: "OK",
		message: "Locket Backend API is healthy",
		timestamp: new Date().toISOString(),
		version: "1.0.0",
	});
});

// Centralized error handler
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).json({ message: "Internal Server Error", error: err.message });
});

// Start server after DB connection
const startServer = async () => {
	try {
		await connectDB();
		
		// Initialize Socket.IO after server starts
		socketManager = new SocketManager(server);
		socketService = new SocketService(socketManager);
		
		// Make both globally available
		global.socketManager = socketManager;
		global.socketService = socketService;
		
		server.listen(PORT, () => {
			console.log(`Server is running on http://localhost:${PORT}/${API_VERSION}`);
			console.log(`Socket.IO server is ready and listening`);
			console.log(`Socket service initialized`);
		});
	} catch (err) {
		console.error("Failed to connect to database:", err);
		process.exit(1);
	}
};

startServer();

export { socketManager, socketService };
