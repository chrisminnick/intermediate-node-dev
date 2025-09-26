const userRepository = require('../repositories/userRepository');
const User = require('../models/user');

class UserController {
  // Get all users (admin only)
  async getAllUsers(req, res) {
    try {
      const {
        includeInactive = false,
        role,
        permission,
        page = 1,
        limit = 10,
        search,
      } = req.query;

      let users = userRepository.getAll(includeInactive === 'true');

      // Filter by role if specified
      if (role) {
        users = users.filter((user) => user.hasRole(role));
      }

      // Filter by permission if specified
      if (permission) {
        users = users.filter((user) => user.hasPermission(permission));
      }

      // Search functionality
      if (search) {
        const searchTerm = search.toLowerCase();
        users = users.filter(
          (user) =>
            user.username.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm)
        );
      }

      // Pagination
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const endIndex = startIndex + parseInt(limit);
      const paginatedUsers = users.slice(startIndex, endIndex);

      const safeUsers = paginatedUsers.map((user) => user.toSafeObject());

      res.status(200).json({
        success: true,
        message: 'Users retrieved successfully',
        data: {
          users: safeUsers,
          pagination: {
            current: parseInt(page),
            limit: parseInt(limit),
            total: users.length,
            pages: Math.ceil(users.length / parseInt(limit)),
          },
          filters: {
            role,
            permission,
            includeInactive: includeInactive === 'true',
            search,
          },
        },
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users',
        error: 'INTERNAL_ERROR',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // Get user by ID (admin or own profile)
  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const requestedUserId = parseInt(id);

      if (isNaN(requestedUserId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID',
          error: 'INVALID_USER_ID',
        });
      }

      const requestedUser = userRepository.findById(requestedUserId);

      if (!requestedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND',
        });
      }

      // Users can only view their own profile unless they're admin
      if (req.user.id !== requestedUser.id && !req.user.hasRole('admin')) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own profile.',
          error: 'ACCESS_DENIED',
        });
      }

      res.status(200).json({
        success: true,
        message: 'User retrieved successfully',
        data: {
          user: requestedUser.toSafeObject(),
          isOwnProfile: req.user.id === requestedUser.id,
        },
      });
    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user',
        error: 'INTERNAL_ERROR',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // Update user (admin only, or users updating their own basic info)
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const userId = parseInt(id);
      const { roles, permissions, isActive, username, email } = req.body;

      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID',
          error: 'INVALID_USER_ID',
        });
      }

      const targetUser = userRepository.findById(userId);

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND',
        });
      }

      const isOwnProfile = req.user.id === userId;
      const isAdmin = req.user.hasRole('admin');

      // Prepare updates object
      const updates = {};

      // Only admin can update roles, permissions, and isActive
      if (
        roles !== undefined ||
        permissions !== undefined ||
        isActive !== undefined
      ) {
        if (!isAdmin) {
          return res.status(403).json({
            success: false,
            message:
              'Only administrators can update roles, permissions, or account status',
            error: 'INSUFFICIENT_PRIVILEGES',
          });
        }

        if (roles !== undefined) {
          if (!Array.isArray(roles)) {
            return res.status(400).json({
              success: false,
              message: 'Roles must be an array',
              error: 'INVALID_ROLES_FORMAT',
            });
          }
          updates.roles = roles;
        }

        if (permissions !== undefined) {
          if (!Array.isArray(permissions)) {
            return res.status(400).json({
              success: false,
              message: 'Permissions must be an array',
              error: 'INVALID_PERMISSIONS_FORMAT',
            });
          }
          updates.permissions = permissions;
        }

        if (isActive !== undefined) {
          updates.isActive = Boolean(isActive);
        }
      }

      // Users can update their own username/email, admin can update anyone's
      if (username !== undefined || email !== undefined) {
        if (!isOwnProfile && !isAdmin) {
          return res.status(403).json({
            success: false,
            message: 'You can only update your own profile information',
            error: 'ACCESS_DENIED',
          });
        }

        if (username !== undefined) {
          if (username.length < 3) {
            return res.status(400).json({
              success: false,
              message: 'Username must be at least 3 characters long',
              error: 'INVALID_USERNAME',
            });
          }

          // Check if username is taken
          const existingUser = userRepository.findByUsername(username);
          if (existingUser && existingUser.id !== userId) {
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

          // Check if email is taken
          const existingUser = userRepository.findByEmail(email);
          if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({
              success: false,
              message: 'Email is already taken',
              error: 'EMAIL_TAKEN',
            });
          }

          updates.email = email;
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid updates provided',
          error: 'NO_UPDATES',
        });
      }

      const updatedUser = userRepository.update(userId, updates);

      console.log(
        `✅ User ${targetUser.username} updated by ${req.user.username}`
      );

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: {
          user: updatedUser.toSafeObject(),
          updatedFields: Object.keys(updates),
        },
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user',
        error: 'INTERNAL_ERROR',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // Delete user (admin only)
  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID',
          error: 'INVALID_USER_ID',
        });
      }

      // Prevent self-deletion
      if (req.user.id === userId) {
        return res.status(400).json({
          success: false,
          message: 'You cannot delete your own account',
          error: 'SELF_DELETE_FORBIDDEN',
        });
      }

      const targetUser = userRepository.findById(userId);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND',
        });
      }

      const deleted = userRepository.delete(userId);

      if (!deleted) {
        return res.status(500).json({
          success: false,
          message: 'Failed to delete user',
          error: 'DELETE_FAILED',
        });
      }

      console.log(
        `✅ User ${targetUser.username} deleted by ${req.user.username}`
      );

      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
        data: {
          deletedUser: {
            id: targetUser.id,
            username: targetUser.username,
            email: targetUser.email,
          },
        },
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user',
        error: 'INTERNAL_ERROR',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // Deactivate user (admin only)
  async deactivateUser(req, res) {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID',
          error: 'INVALID_USER_ID',
        });
      }

      if (req.user.id === userId) {
        return res.status(400).json({
          success: false,
          message: 'You cannot deactivate your own account',
          error: 'SELF_DEACTIVATE_FORBIDDEN',
        });
      }

      const deactivatedUser = userRepository.deactivate(userId);

      res.status(200).json({
        success: true,
        message: 'User deactivated successfully',
        data: {
          user: deactivatedUser.toSafeObject(),
        },
      });
    } catch (error) {
      console.error('Deactivate user error:', error);

      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to deactivate user',
        error: 'INTERNAL_ERROR',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // Activate user (admin only)
  async activateUser(req, res) {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID',
          error: 'INVALID_USER_ID',
        });
      }

      const activatedUser = userRepository.activate(userId);

      res.status(200).json({
        success: true,
        message: 'User activated successfully',
        data: {
          user: activatedUser.toSafeObject(),
        },
      });
    } catch (error) {
      console.error('Activate user error:', error);

      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to activate user',
        error: 'INTERNAL_ERROR',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // Get user statistics (admin only)
  async getUserStats(req, res) {
    try {
      const stats = userRepository.getStats();

      res.status(200).json({
        success: true,
        message: 'User statistics retrieved successfully',
        data: stats,
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user statistics',
        error: 'INTERNAL_ERROR',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // Search users (admin only)
  async searchUsers(req, res) {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters long',
          error: 'INVALID_SEARCH_QUERY',
        });
      }

      const users = userRepository.search(query.trim());
      const limitedUsers = users.slice(0, parseInt(limit));
      const safeUsers = limitedUsers.map((user) => user.toPublicObject());

      res.status(200).json({
        success: true,
        message: 'Search completed successfully',
        data: {
          users: safeUsers,
          query: query.trim(),
          total: users.length,
          shown: safeUsers.length,
        },
      });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed',
        error: 'INTERNAL_ERROR',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
}

module.exports = new UserController();
