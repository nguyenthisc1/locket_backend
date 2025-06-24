# Locket Backend API

A backend API for a Locket clone, built with Node.js, Express, and MongoDB. This project provides user authentication and serves as the foundation for a Locket-style application.

## Features

- User registration and login (with JWT authentication)
- API documentation via Swagger UI
- Centralized error handling
- MongoDB integration with Mongoose
- CORS enabled for cross-origin requests

## Tech Stack

- **Node.js** (runtime)
- **Express** (web framework)
- **MongoDB** with **Mongoose** (database & ODM)
- **JWT** (authentication)
- **Swagger** (API documentation)
- **pnpm** (package manager)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/) (preferred package manager)
- [MongoDB](https://www.mongodb.com/) instance (local or cloud)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/locket-backend.git
   cd locket-backend
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**

   Create a `.env` file in the root directory with the following content:

   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   PORT=3000
   ```

4. **Start the server:**
   ```bash
   pnpm start
   ```
   For development with auto-reload:
   ```bash
   pnpm run dev
   ```

## API Documentation

Swagger UI is available at:  
[http://localhost:3000/api/docs](http://localhost:3000/api/docs)

## API Endpoints

### Auth

- `POST /api/auth/register`  
  Register a new user.  
  **Body:**  
  ```json
  {
    "username": "string",
    "email": "string",
    "phoneNumber": "string",
    "password": "string"
  }
  ```

- `POST /api/auth/login`  
  Login with email or phone number and password.  
  **Body:**  
  ```json
  {
    "email": "string", // or "phoneNumber": "string"
    "password": "string"
  }
  ```

## Development

- Uses `pnpm` for package management.
- Code is organized by feature (controllers, routes, models, config, docs).
- Error handling is centralized for maintainability.
- Swagger documentation is auto-generated from route JSDoc comments.

## Scripts

| Command         | Description                |
|-----------------|---------------------------|
| `pnpm start`    | Start the server          |
| `pnpm run dev`  | Start with nodemon        |

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)

---
