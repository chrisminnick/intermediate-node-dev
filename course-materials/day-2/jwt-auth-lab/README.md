# JWT Authentication Lab

A complete implementation of JWT authentication with role-based access control in Node.js and Express.

## Features

- ✅ JWT Authentication with Access & Refresh Tokens
- ✅ Role-Based Access Control (RBAC)
- ✅ Permission-Based Authorization
- ✅ User Registration & Login
- ✅ Password Hashing with bcrypt
- ✅ Account Security (login attempts, account locking)
- ✅ Token Blacklisting
- ✅ Security Middleware (Helmet, CORS, Rate Limiting)
- ✅ Comprehensive User Management
- ✅ Error Handling & Validation
- ✅ API Documentation

## Quick Start

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Set up Environment Variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the Server**

   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

4. **Test the API**
   - Server runs on `http://localhost:3000`
   - Visit `http://localhost:3000` for API documentation
   - Health check: `GET /health`

## Default Users

The application creates sample users for testing:

**Admin User:**

- Username: `admin`
- Password: `admin123`
- Roles: `admin`, `user`

**Regular User:**

- Username: `user`
- Password: `user123`
- Roles: `user`

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint           | Description          | Auth Required  |
| ------ | ------------------ | -------------------- | -------------- |
| POST   | `/register`        | Register new user    | No             |
| POST   | `/login`           | User login           | No             |
| POST   | `/refresh`         | Refresh access token | No             |
| POST   | `/logout`          | Logout user          | Yes            |
| GET    | `/profile`         | Get user profile     | Yes            |
| PUT    | `/profile`         | Update profile       | Yes            |
| POST   | `/change-password` | Change password      | Yes            |
| GET    | `/token-info`      | Get token info       | Yes            |
| POST   | `/validate-token`  | Validate token       | Token Required |

### User Management (`/api/users`)

| Method | Endpoint          | Description     | Auth Required |
| ------ | ----------------- | --------------- | ------------- |
| GET    | `/`               | Get all users   | Admin         |
| GET    | `/search`         | Search users    | Admin         |
| GET    | `/stats`          | User statistics | Admin         |
| GET    | `/:id`            | Get user by ID  | Admin or Own  |
| PUT    | `/:id`            | Update user     | Admin or Own  |
| DELETE | `/:id`            | Delete user     | Admin         |
| POST   | `/:id/activate`   | Activate user   | Admin         |
| POST   | `/:id/deactivate` | Deactivate user | Admin         |

### Demo Endpoints

| Method | Endpoint         | Description    | Auth Required |
| ------ | ---------------- | -------------- | ------------- |
| GET    | `/api/protected` | Protected demo | Yes           |
| GET    | `/api/admin`     | Admin demo     | Admin         |
| GET    | `/health`        | Health check   | No            |

## Authentication Flow

1. **Register/Login**: Obtain access and refresh tokens
2. **Access Protected Routes**: Include `Authorization: Bearer <access_token>` header
3. **Token Refresh**: Use refresh token to get new access token when expired
4. **Logout**: Blacklist tokens to invalidate them

## Example Usage

### Register User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "newuser@example.com",
    "password": "password123"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

### Access Protected Endpoint

```bash
curl -X GET http://localhost:3000/api/protected \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get User Profile

```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Security Features

- **Password Hashing**: bcrypt with configurable rounds
- **JWT Security**: Separate secrets for access/refresh tokens
- **Rate Limiting**: Configurable limits for API and auth endpoints
- **CORS**: Configurable allowed origins
- **Security Headers**: Helmet.js for security headers
- **Account Protection**: Login attempt limiting and account locking
- **Token Blacklisting**: Logout invalidates tokens
- **Input Validation**: Comprehensive validation for all inputs

## Project Structure

```
jwt-auth-lab/
├── models/
│   └── user.js              # User model with security features
├── repositories/
│   └── userRepository.js    # User data access layer
├── services/
│   └── jwtService.js        # JWT token management
├── middleware/
│   └── auth.js              # Authentication & authorization middleware
├── controllers/
│   ├── authController.js    # Authentication endpoints
│   └── userController.js    # User management endpoints
├── routes/
│   ├── auth.js              # Authentication routes
│   └── users.js             # User management routes
├── app.js                   # Express app configuration
├── server.js                # Server startup
├── package.json             # Dependencies and scripts
├── .env.example             # Environment variables template
└── README.md                # This file
```

## Environment Variables

See `.env.example` for all available configuration options.

**Important**: Change the JWT secrets in production!

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE",
  "details": "Additional details (development only)"
}
```

## Common Error Codes

- `INVALID_CREDENTIALS`: Login failed
- `TOKEN_EXPIRED`: Access token expired
- `ACCESS_DENIED`: Insufficient permissions
- `USER_NOT_FOUND`: User doesn't exist
- `VALIDATION_ERROR`: Input validation failed
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Development

- Uses `nodemon` for development with auto-restart
- Comprehensive error logging
- Development-specific error details
- Sample users created automatically

## Production Considerations

- Change JWT secrets
- Set `NODE_ENV=production`
- Configure proper CORS origins
- Adjust rate limiting as needed
- Disable sample user creation
- Set up proper logging
- Use environment variables for all configuration

## License

MIT License - See LICENSE file for details.
