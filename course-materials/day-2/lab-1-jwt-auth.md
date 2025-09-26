# Lab 1: Implementing JWT Authentication with Role-Based Access

## Objective

Build a secure Express.js API using JSON Web Tokens (JWT) for authentication and implement Role-Based Access Control (RBAC) to restrict access to endpoints based on user roles and permissions.

## Setup

### Create Project Structure

```bash
mkdir jwt-auth-lab
cd jwt-auth-lab
npm init -y
```

### Install Dependencies

```bash
npm install express jsonwebtoken bcryptjs cors helmet morgan dotenv
npm install --save-dev nodemon
```

### Environment Configuration

Create a `.env` file:

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_SECRET=your-refresh-token-secret
REFRESH_TOKEN_EXPIRES_IN=7d
```

## Instructions

### Part 1: User Management and Data Models (`models/user.js`)

#### 1.1 User Data Structure

```javascript
const bcrypt = require('bcryptjs');

class User {
  constructor(
    id,
    username,
    email,
    password,
    roles = ['user'],
    permissions = []
  ) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.password = password;
    this.roles = roles;
    this.permissions = permissions;
    this.createdAt = new Date();
    this.lastLogin = null;
    this.isActive = true;
  }

  // Hash password before storing
  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password
  async verifyPassword(password) {
    return await bcrypt.compare(password, this.password);
  }

  // Check if user has specific role
  hasRole(role) {
    return this.roles.includes(role);
  }

  // Check if user has specific permission
  hasPermission(permission) {
    return this.permissions.includes(permission);
  }

  // Get safe user data (without password)
  toSafeObject() {
    const { password, ...safeUser } = this;
    return safeUser;
  }
}

module.exports = User;
```

#### 1.2 User Repository (`repositories/userRepository.js`)

```javascript
const User = require('../models/user');

class UserRepository {
  constructor() {
    this.users = new Map();
    this.nextId = 1;
    this.initializeDefaultUsers();
  }

  async initializeDefaultUsers() {
    // Create sample users with different roles
    const users = [
      {
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        roles: ['admin', 'user'],
        permissions: ['read', 'write', 'delete', 'manage_users'],
      },
      {
        username: 'manager',
        email: 'manager@example.com',
        password: 'manager123',
        roles: ['manager', 'user'],
        permissions: ['read', 'write', 'manage_team'],
      },
      {
        username: 'user1',
        email: 'user1@example.com',
        password: 'user123',
        roles: ['user'],
        permissions: ['read'],
      },
      {
        username: 'user2',
        email: 'user2@example.com',
        password: 'user123',
        roles: ['user'],
        permissions: ['read', 'write'],
      },
    ];

    for (const userData of users) {
      const hashedPassword = await User.hashPassword(userData.password);
      const user = new User(
        this.nextId++,
        userData.username,
        userData.email,
        hashedPassword,
        userData.roles,
        userData.permissions
      );
      this.users.set(user.id, user);
    }
  }

  // Find user by username or email
  findByCredentials(usernameOrEmail) {
    return Array.from(this.users.values()).find(
      (user) =>
        user.username === usernameOrEmail || user.email === usernameOrEmail
    );
  }

  // Find user by ID
  findById(id) {
    return this.users.get(parseInt(id));
  }

  // Create new user
  async create(userData) {
    const existingUser =
      this.findByCredentials(userData.username) ||
      this.findByCredentials(userData.email);

    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await User.hashPassword(userData.password);
    const user = new User(
      this.nextId++,
      userData.username,
      userData.email,
      hashedPassword,
      userData.roles || ['user'],
      userData.permissions || ['read']
    );

    this.users.set(user.id, user);
    return user;
  }

  // Update user
  update(id, updates) {
    const user = this.findById(id);
    if (!user) return null;

    Object.assign(user, updates);
    return user;
  }

  // Delete user
  delete(id) {
    return this.users.delete(parseInt(id));
  }

  // Get all users (admin only)
  getAll() {
    return Array.from(this.users.values());
  }
}

module.exports = new UserRepository();
```

### Part 2: JWT Authentication System

#### 2.1 JWT Service (`services/jwtService.js`)

```javascript
const jwt = require('jsonwebtoken');

class JWTService {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    this.refreshSecret = process.env.REFRESH_TOKEN_SECRET;
    this.expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

    if (!this.secret || !this.refreshSecret) {
      throw new Error('JWT secrets must be defined in environment variables');
    }
  }

  // Generate access token
  generateAccessToken(payload) {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: 'jwt-auth-lab',
      audience: 'jwt-auth-users',
    });
  }

  // Generate refresh token
  generateRefreshToken(payload) {
    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn,
      issuer: 'jwt-auth-lab',
      audience: 'jwt-auth-users',
    });
  }

  // Verify access token
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.secret, {
        issuer: 'jwt-auth-lab',
        audience: 'jwt-auth-users',
      });
    } catch (error) {
      throw new Error(`Invalid access token: ${error.message}`);
    }
  }

  // Verify refresh token
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshSecret, {
        issuer: 'jwt-auth-lab',
        audience: 'jwt-auth-users',
      });
    } catch (error) {
      throw new Error(`Invalid refresh token: ${error.message}`);
    }
  }

  // Generate token pair
  generateTokenPair(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken({ id: user.id }),
      expiresIn: this.expiresIn,
    };
  }

  // Decode token without verification (for expired token info)
  decodeToken(token) {
    return jwt.decode(token);
  }
}

module.exports = new JWTService();
```

#### 2.2 Authentication Middleware (`middleware/auth.js`)

```javascript
const jwtService = require('../services/jwtService');
const userRepository = require('../repositories/userRepository');

// Extract token from request
const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Also check for token in cookies
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  return null;
};

// Basic authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    const decoded = jwtService.verifyAccessToken(token);
    const user = userRepository.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or inactive user',
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      error: error.message,
    });
  }
};

// Role-based authorization middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const hasRole = roles.some((role) => req.user.hasRole(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`,
        userRoles: req.user.roles,
      });
    }

    next();
  };
};

// Permission-based authorization middleware
const requirePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const hasPermission = permissions.some((permission) =>
      req.user.hasPermission(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permissions: ${permissions.join(
          ', '
        )}`,
        userPermissions: req.user.permissions,
      });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = jwtService.verifyAccessToken(token);
      const user = userRepository.findById(decoded.id);

      if (user && user.isActive) {
        req.user = user;
        req.token = token;
      }
    }
  } catch (error) {
    // Silently ignore token errors for optional auth
  }

  next();
};

module.exports = {
  authenticate,
  requireRole,
  requirePermission,
  optionalAuth,
  extractToken,
};
```

### Part 3: API Routes and Controllers

#### 3.1 Authentication Controller (`controllers/authController.js`)

```javascript
const jwtService = require('../services/jwtService');
const userRepository = require('../repositories/userRepository');

class AuthController {
  // User login
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required',
        });
      }

      const user = userRepository.findByCredentials(username);

      if (!user || !(await user.verifyPassword(password))) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated',
        });
      }

      // Update last login
      user.lastLogin = new Date();

      const tokens = jwtService.generateTokenPair(user);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: user.toSafeObject(),
          ...tokens,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message,
      });
    }
  }

  // User registration
  async register(req, res) {
    try {
      const { username, email, password, roles, permissions } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username, email, and password are required',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long',
        });
      }

      const user = await userRepository.create({
        username,
        email,
        password,
        roles: roles || ['user'],
        permissions: permissions || ['read'],
      });

      const tokens = jwtService.generateTokenPair(user);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: user.toSafeObject(),
          ...tokens,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Registration failed',
        error: error.message,
      });
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required',
        });
      }

      const decoded = jwtService.verifyRefreshToken(refreshToken);
      const user = userRepository.findById(decoded.id);

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token',
        });
      }

      const tokens = jwtService.generateTokenPair(user);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: tokens,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        error: error.message,
      });
    }
  }

  // Get current user profile
  async profile(req, res) {
    try {
      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: req.user.toSafeObject(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile',
        error: error.message,
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { username, email } = req.body;
      const updates = {};

      if (username) updates.username = username;
      if (email) updates.email = email;

      const updatedUser = userRepository.update(req.user.id, updates);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: updatedUser.toSafeObject(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message,
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required',
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long',
        });
      }

      const isValidPassword = await req.user.verifyPassword(currentPassword);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }

      const hashedPassword = await req.user.constructor.hashPassword(
        newPassword
      );
      userRepository.update(req.user.id, { password: hashedPassword });

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to change password',
        error: error.message,
      });
    }
  }

  // Logout (client-side token removal)
  async logout(req, res) {
    try {
      // In a production app, you might want to blacklist the token
      res.status(200).json({
        success: true,
        message: 'Logout successful',
        data: {
          instruction: 'Please remove the token from client storage',
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: error.message,
      });
    }
  }
}

module.exports = new AuthController();
```

#### 3.2 User Management Controller (`controllers/userController.js`)

```javascript
const userRepository = require('../repositories/userRepository');

class UserController {
  // Get all users (admin only)
  async getAllUsers(req, res) {
    try {
      const users = userRepository.getAll();
      const safeUsers = users.map((user) => user.toSafeObject());

      res.status(200).json({
        success: true,
        message: 'Users retrieved successfully',
        data: {
          users: safeUsers,
          total: safeUsers.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users',
        error: error.message,
      });
    }
  }

  // Get user by ID (admin or own profile)
  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const requestedUser = userRepository.findById(parseInt(id));

      if (!requestedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Users can only view their own profile unless they're admin
      if (req.user.id !== requestedUser.id && !req.user.hasRole('admin')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      res.status(200).json({
        success: true,
        message: 'User retrieved successfully',
        data: {
          user: requestedUser.toSafeObject(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user',
        error: error.message,
      });
    }
  }

  // Update user (admin only)
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { roles, permissions, isActive } = req.body;

      const user = userRepository.findById(parseInt(id));

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const updates = {};
      if (roles !== undefined) updates.roles = roles;
      if (permissions !== undefined) updates.permissions = permissions;
      if (isActive !== undefined) updates.isActive = isActive;

      const updatedUser = userRepository.update(parseInt(id), updates);

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: {
          user: updatedUser.toSafeObject(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update user',
        error: error.message,
      });
    }
  }

  // Delete user (admin only)
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      if (req.user.id === parseInt(id)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account',
        });
      }

      const deleted = userRepository.delete(parseInt(id));

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete user',
        error: error.message,
      });
    }
  }
}

module.exports = new UserController();
```

### Part 4: Express Application Setup (`app.js`)

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import middleware
const {
  authenticate,
  requireRole,
  requirePermission,
  optionalAuth,
} = require('./middleware/auth');

// Import controllers
const authController = require('./controllers/authController');
const userController = require('./controllers/userController');

// Create Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'],
    credentials: true,
  })
);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Public routes (no authentication required)
app.post('/api/auth/login', authController.login);
app.post('/api/auth/register', authController.register);
app.post('/api/auth/refresh', authController.refreshToken);

// Protected routes (authentication required)
app.use('/api/auth/profile', authenticate);
app.get('/api/auth/profile', authController.profile);
app.put('/api/auth/profile', authController.updateProfile);
app.post('/api/auth/change-password', authController.changePassword);
app.post('/api/auth/logout', authController.logout);

// User management routes (role-based access)
app.get(
  '/api/users',
  authenticate,
  requireRole('admin'),
  userController.getAllUsers
);
app.get('/api/users/:id', authenticate, userController.getUserById);
app.put(
  '/api/users/:id',
  authenticate,
  requireRole('admin'),
  userController.updateUser
);
app.delete(
  '/api/users/:id',
  authenticate,
  requireRole('admin'),
  userController.deleteUser
);

// Example protected resources with different access levels
app.get('/api/public', optionalAuth, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'This is a public endpoint',
    data: {
      authenticated: !!req.user,
      user: req.user ? req.user.toSafeObject() : null,
    },
  });
});

app.get('/api/protected', authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'This is a protected endpoint',
    data: {
      user: req.user.toSafeObject(),
      timestamp: new Date().toISOString(),
    },
  });
});

app.get('/api/admin', authenticate, requireRole('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'This is an admin-only endpoint',
    data: {
      user: req.user.toSafeObject(),
      serverInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
      },
    },
  });
});

app.get(
  '/api/manager',
  authenticate,
  requireRole('admin', 'manager'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'This endpoint requires admin or manager role',
      data: {
        user: req.user.toSafeObject(),
        accessLevel: 'manager',
      },
    });
  }
);

app.get(
  '/api/write-access',
  authenticate,
  requirePermission('write'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'This endpoint requires write permission',
      data: {
        user: req.user.toSafeObject(),
        permissions: req.user.permissions,
      },
    });
  }
);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  res.status(error.status || 500).json({
    success: false,
    message: 'Internal server error',
    error:
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'Something went wrong',
  });
});

module.exports = app;
```

## Running Your Application

### Start the Server (`server.js`)

```javascript
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 JWT Auth Lab server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);

  // Log sample users for testing
  console.log('\n👥 Sample Users for Testing:');
  console.log('  Admin: username=admin, password=admin123');
  console.log('  Manager: username=manager, password=manager123');
  console.log('  User: username=user1, password=user123');
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

## Testing Your API

### Using cURL Examples

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Access protected endpoint
curl -X GET http://localhost:3000/api/protected \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Admin endpoint
curl -X GET http://localhost:3000/api/admin \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Deliverables

- [ ] Complete Express.js server with JWT authentication
- [ ] User model with password hashing and role management
- [ ] Authentication middleware with role and permission checking
- [ ] Public, protected, and role-specific API endpoints
- [ ] Token refresh mechanism
- [ ] Comprehensive error handling and validation
- [ ] API testing documentation with sample requests

## Key Learning Objectives

- **JWT Structure**: Understanding token composition and validation
- **Role-Based Access Control**: Implementing hierarchical permissions
- **Security Best Practices**: Password hashing, token expiration, secure headers
- **Middleware Patterns**: Reusable authentication and authorization logic
- **API Design**: RESTful endpoints with consistent response formats

## Resources

- [JWT.io](https://jwt.io/) - JWT token decoder and documentation
- [Express.js Documentation](https://expressjs.com/) - Framework reference
- [bcryptjs Documentation](https://www.npmjs.com/package/bcryptjs) - Password hashing
- [Helmet.js](https://helmetjs.github.io/) - Security middleware

---

**💡 Pro Tips:**

- Always use HTTPS in production for token security
- Implement token blacklisting for logout functionality
- Use environment variables for all secrets
- Consider implementing rate limiting for authentication endpoints
- Log authentication events for security monitoring
