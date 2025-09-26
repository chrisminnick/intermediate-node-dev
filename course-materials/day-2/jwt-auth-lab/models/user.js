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
    this.loginAttempts = 0;
    this.lockUntil = null;
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

  // Check if user has any of the specified roles
  hasAnyRole(roles) {
    return roles.some((role) => this.hasRole(role));
  }

  // Check if user has specific permission
  hasPermission(permission) {
    return this.permissions.includes(permission);
  }

  // Check if user has any of the specified permissions
  hasAnyPermission(permissions) {
    return permissions.some((permission) => this.hasPermission(permission));
  }

  // Check if account is locked
  isLocked() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
  }

  // Increment login attempts
  incrementLoginAttempts() {
    this.loginAttempts += 1;

    // Lock account after 5 failed attempts for 30 minutes
    if (this.loginAttempts >= 5) {
      this.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
    }
  }

  // Reset login attempts on successful login
  resetLoginAttempts() {
    this.loginAttempts = 0;
    this.lockUntil = null;
  }

  // Get safe user data (without password and sensitive info)
  toSafeObject() {
    const { password, loginAttempts, lockUntil, ...safeUser } = this;
    return safeUser;
  }

  // Get public user data (minimal info for public display)
  toPublicObject() {
    return {
      id: this.id,
      username: this.username,
      roles: this.roles,
      isActive: this.isActive,
      createdAt: this.createdAt,
    };
  }

  // Update last login timestamp
  updateLastLogin() {
    this.lastLogin = new Date();
  }

  // Validate user data
  static validate(userData) {
    const errors = [];

    if (!userData.username || userData.username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }

    if (!userData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.push('Valid email address is required');
    }

    if (!userData.password || userData.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

module.exports = User;
