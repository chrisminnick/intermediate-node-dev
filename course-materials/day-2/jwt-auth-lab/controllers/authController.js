const jwtService = require('../services/jwtService');
const userRepository = require('../repositories/userRepository');
const User = require('../models/user');

class AuthController {
  // User login
  async login(req, res) {
    try {
      const { username, password, rememberMe = false } = req.body;

      // Validate input
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required',
          error: 'MISSING_CREDENTIALS',
        });
      }

      // Find user
      const user = userRepository.findByCredentials(username);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          error: 'INVALID_CREDENTIALS',
        });
      }

      // Check if account is locked
      if (user.isLocked()) {
        return res.status(401).json({
          success: false,
          message: 'Account is temporarily locked due to failed login attempts',
          error: 'ACCOUNT_LOCKED',
          lockUntil: user.lockUntil,
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated',
          error: 'ACCOUNT_DEACTIVATED',
        });
      }

      // Verify password
      const isValidPassword = await user.verifyPassword(password);

      if (!isValidPassword) {
        // Increment failed login attempts
        user.incrementLoginAttempts();

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          error: 'INVALID_CREDENTIALS',
          remainingAttempts: Math.max(0, 5 - user.loginAttempts),
        });
      }

      // Successful login - reset attempts and update last login
      user.resetLoginAttempts();
      user.updateLastLogin();

      // Generate tokens
      const tokens = jwtService.generateTokenPair(user);

      // Log successful login
      console.log(`✅ User ${user.username} logged in successfully`);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: tokens,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: 'INTERNAL_ERROR',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // User registration
  async register(req, res) {
    try {
      const { username, email, password, confirmPassword } = req.body;

      // Validate input
      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username, email, and password are required',
          error: 'MISSING_FIELDS',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long',
          error: 'PASSWORD_TOO_SHORT',
        });
      }

      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match',
          error: 'PASSWORD_MISMATCH',
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format',
          error: 'INVALID_EMAIL',
        });
      }

      // Create user with default role and permissions
      const user = await userRepository.create({
        username,
        email,
        password,
        roles: ['user'],
        permissions: ['read'],
      });

      // Generate tokens for auto-login after registration
      const tokens = jwtService.generateTokenPair(user);

      console.log(`✅ New user registered: ${user.username}`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: tokens,
      });
    } catch (error) {
      console.error('Registration error:', error);

      let statusCode = 400;
      let errorCode = 'REGISTRATION_FAILED';

      if (error.message.includes('already exists')) {
        errorCode = 'USER_EXISTS';
      } else if (error.message.includes('Validation failed')) {
        errorCode = 'VALIDATION_ERROR';
      }

      res.status(statusCode).json({
        success: false,
        message: 'Registration failed',
        error: errorCode,
        details: error.message,
      });
    }
  }

  // Refresh access token using refresh token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required',
          error: 'MISSING_REFRESH_TOKEN',
        });
      }

      // Verify refresh token
      const decoded = jwtService.verifyRefreshToken(refreshToken);
      const user = userRepository.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token - user not found',
          error: 'USER_NOT_FOUND',
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated',
          error: 'ACCOUNT_DEACTIVATED',
        });
      }

      // Generate new token pair
      const tokens = jwtService.generateTokenPair(user);

      console.log(`🔄 Token refreshed for user: ${user.username}`);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: tokens,
      });
    } catch (error) {
      console.error('Token refresh error:', error);

      let errorCode = 'INVALID_REFRESH_TOKEN';
      if (error.message.includes('expired')) {
        errorCode = 'REFRESH_TOKEN_EXPIRED';
      } else if (error.message.includes('revoked')) {
        errorCode = 'REFRESH_TOKEN_REVOKED';
      }

      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
        error: errorCode,
        details: error.message,
      });
    }
  }

  // Get current user profile
  async profile(req, res) {
    try {
      const user = req.user;

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: user.toSafeObject(),
          tokenInfo: {
            issuedAt: req.tokenPayload.iat,
            expiresAt: req.tokenPayload.exp,
            tokenId: req.tokenPayload.jti,
          },
        },
      });
    } catch (error) {
      console.error('Profile retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile',
        error: 'INTERNAL_ERROR',
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { username, email } = req.body;
      const updates = {};

      // Validate and prepare updates
      if (username !== undefined) {
        if (username.length < 3) {
          return res.status(400).json({
            success: false,
            message: 'Username must be at least 3 characters long',
            error: 'INVALID_USERNAME',
          });
        }

        // Check if username is taken by another user
        const existingUser = userRepository.findByUsername(username);
        if (existingUser && existingUser.id !== req.user.id) {
          return res.status(400).json({
            success: false,
            message: 'Username is already taken',
            error: 'USERNAME_TAKEN',
          });
        }

        updates.username = username;
      }

      if (email !== undefined) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid email format',
            error: 'INVALID_EMAIL',
          });
        }

        // Check if email is taken by another user
        const existingUser = userRepository.findByEmail(email);
        if (existingUser && existingUser.id !== req.user.id) {
          return res.status(400).json({
            success: false,
            message: 'Email is already taken',
            error: 'EMAIL_TAKEN',
          });
        }

        updates.email = email;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid updates provided',
          error: 'NO_UPDATES',
        });
      }

      const updatedUser = userRepository.update(req.user.id, updates);

      console.log(`✅ Profile updated for user: ${updatedUser.username}`);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: updatedUser.toSafeObject(),
        },
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: 'INTERNAL_ERROR',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword, confirmNewPassword } = req.body;

      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required',
          error: 'MISSING_PASSWORDS',
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long',
          error: 'PASSWORD_TOO_SHORT',
        });
      }

      if (confirmNewPassword && newPassword !== confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: 'New passwords do not match',
          error: 'PASSWORD_MISMATCH',
        });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password must be different from current password',
          error: 'SAME_PASSWORD',
        });
      }

      // Verify current password
      const isValidPassword = await req.user.verifyPassword(currentPassword);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
          error: 'INVALID_CURRENT_PASSWORD',
        });
      }

      // Hash new password and update
      const hashedPassword = await User.hashPassword(newPassword);
      userRepository.update(req.user.id, { password: hashedPassword });

      console.log(`✅ Password changed for user: ${req.user.username}`);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
        data: {
          message:
            'Your password has been updated. Please log in again with your new password.',
        },
      });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password',
        error: 'INTERNAL_ERROR',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // Logout (blacklist current token)
  async logout(req, res) {
    try {
      // Blacklist the current token
      const tokenBlacklisted = jwtService.blacklistToken(req.token);

      console.log(`✅ User ${req.user.username} logged out`);

      res.status(200).json({
        success: true,
        message: 'Logout successful',
        data: {
          message: 'Token has been invalidated',
          tokenBlacklisted,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: 'INTERNAL_ERROR',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // Get token information
  async tokenInfo(req, res) {
    try {
      const tokenInfo = jwtService.getTokenInfo(req.token);

      res.status(200).json({
        success: true,
        message: 'Token information retrieved',
        data: {
          token: tokenInfo,
          user: req.user.toSafeObject(),
          isExpiringSoon: jwtService.isTokenExpiringSoon(req.token),
        },
      });
    } catch (error) {
      console.error('Token info error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve token information',
        error: 'INTERNAL_ERROR',
      });
    }
  }

  // Validate token endpoint
  async validateToken(req, res) {
    try {
      // If we reach here, the token is valid (authenticate middleware passed)
      res.status(200).json({
        success: true,
        message: 'Token is valid',
        data: {
          user: req.user.toSafeObject(),
          tokenExpiry: new Date(req.tokenPayload.exp * 1000),
          issuedAt: new Date(req.tokenPayload.iat * 1000),
        },
      });
    } catch (error) {
      console.error('Token validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Token validation failed',
        error: 'INTERNAL_ERROR',
      });
    }
  }
}

module.exports = new AuthController();
