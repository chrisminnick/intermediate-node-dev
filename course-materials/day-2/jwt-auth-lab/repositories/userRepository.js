const User = require('../models/user');

class UserRepository {
  constructor() {
    this.users = new Map();
    this.nextId = 1;
    this.initializeDefaultUsers();
  }

  async initializeDefaultUsers() {
    // Create sample users with different roles and permissions
    const users = [
      {
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        roles: ['admin', 'manager', 'user'],
        permissions: [
          'read',
          'write',
          'delete',
          'manage_users',
          'manage_system',
        ],
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
      {
        username: 'editor',
        email: 'editor@example.com',
        password: 'editor123',
        roles: ['editor', 'user'],
        permissions: ['read', 'write', 'edit_content'],
      },
    ];

    for (const userData of users) {
      try {
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
        console.log(
          `✅ Created user: ${
            userData.username
          } with roles: ${userData.roles.join(', ')}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to create user ${userData.username}:`,
          error.message
        );
      }
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

  // Find user by username
  findByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  // Find user by email
  findByEmail(email) {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }

  // Create new user
  async create(userData) {
    // Validate user data
    const validation = User.validate(userData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check if user already exists
    const existingUser =
      this.findByCredentials(userData.username) ||
      this.findByCredentials(userData.email);

    if (existingUser) {
      throw new Error('User with this username or email already exists');
    }

    try {
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
      console.log(`✅ Created new user: ${user.username}`);
      return user;
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  // Update user
  update(id, updates) {
    const user = this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent updating sensitive fields directly
    const allowedUpdates = [
      'username',
      'email',
      'roles',
      'permissions',
      'isActive',
      'password',
    ];
    const filteredUpdates = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    Object.assign(user, filteredUpdates);
    console.log(`✅ Updated user: ${user.username}`);
    return user;
  }

  // Delete user
  delete(id) {
    const user = this.findById(id);
    if (!user) {
      return false;
    }

    const deleted = this.users.delete(parseInt(id));
    if (deleted) {
      console.log(`✅ Deleted user: ${user.username}`);
    }
    return deleted;
  }

  // Soft delete user (deactivate)
  deactivate(id) {
    const user = this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    user.isActive = false;
    console.log(`✅ Deactivated user: ${user.username}`);
    return user;
  }

  // Activate user
  activate(id) {
    const user = this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    user.isActive = true;
    user.resetLoginAttempts(); // Reset any login locks
    console.log(`✅ Activated user: ${user.username}`);
    return user;
  }

  // Get all users (admin only)
  getAll(includeInactive = false) {
    const users = Array.from(this.users.values());
    return includeInactive ? users : users.filter((user) => user.isActive);
  }

  // Get users by role
  getByRole(role) {
    return Array.from(this.users.values()).filter(
      (user) => user.hasRole(role) && user.isActive
    );
  }

  // Get users by permission
  getByPermission(permission) {
    return Array.from(this.users.values()).filter(
      (user) => user.hasPermission(permission) && user.isActive
    );
  }

  // Search users
  search(query) {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.users.values()).filter(
      (user) =>
        user.username.toLowerCase().includes(lowercaseQuery) ||
        user.email.toLowerCase().includes(lowercaseQuery)
    );
  }

  // Get statistics
  getStats() {
    const users = Array.from(this.users.values());
    const activeUsers = users.filter((user) => user.isActive);
    const roleStats = {};

    users.forEach((user) => {
      user.roles.forEach((role) => {
        roleStats[role] = (roleStats[role] || 0) + 1;
      });
    });

    return {
      total: users.length,
      active: activeUsers.length,
      inactive: users.length - activeUsers.length,
      roleDistribution: roleStats,
      recentLogins: users
        .filter((user) => user.lastLogin)
        .sort((a, b) => b.lastLogin - a.lastLogin)
        .slice(0, 5)
        .map((user) => ({
          username: user.username,
          lastLogin: user.lastLogin,
        })),
    };
  }
}

// Export singleton instance
module.exports = new UserRepository();
