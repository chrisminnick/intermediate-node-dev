const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JWTService {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    this.refreshSecret = process.env.REFRESH_TOKEN_SECRET;
    this.expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    this.issuer = 'jwt-auth-lab';
    this.audience = 'jwt-auth-users';

    // Validate required secrets
    if (!this.secret || !this.refreshSecret) {
      throw new Error('JWT secrets must be defined in environment variables');
    }

    if (this.secret.length < 32 || this.refreshSecret.length < 32) {
      console.warn(
        '⚠️  JWT secrets should be at least 32 characters long for security'
      );
    }

    // Store for blacklisted tokens (in production, use Redis or database)
    this.blacklistedTokens = new Set();
  }

  // Generate access token
  generateAccessToken(payload) {
    try {
      const tokenPayload = {
        ...payload,
        type: 'access',
        jti: crypto.randomUUID(), // JWT ID for token tracking
        iat: Math.floor(Date.now() / 1000),
      };

      return jwt.sign(tokenPayload, this.secret, {
        expiresIn: this.expiresIn,
        issuer: this.issuer,
        audience: this.audience,
        algorithm: 'HS256',
      });
    } catch (error) {
      throw new Error(`Failed to generate access token: ${error.message}`);
    }
  }

  // Generate refresh token
  generateRefreshToken(payload) {
    try {
      const tokenPayload = {
        ...payload,
        type: 'refresh',
        jti: crypto.randomUUID(),
        iat: Math.floor(Date.now() / 1000),
      };

      return jwt.sign(tokenPayload, this.refreshSecret, {
        expiresIn: this.refreshExpiresIn,
        issuer: this.issuer,
        audience: this.audience,
        algorithm: 'HS256',
      });
    } catch (error) {
      throw new Error(`Failed to generate refresh token: ${error.message}`);
    }
  }

  // Verify access token
  verifyAccessToken(token) {
    try {
      // Check if token is blacklisted
      if (this.isTokenBlacklisted(token)) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256'],
      });

      // Verify token type
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token format');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Access token not active yet');
      }
      throw new Error(`Invalid access token: ${error.message}`);
    }
  }

  // Verify refresh token
  verifyRefreshToken(token) {
    try {
      // Check if token is blacklisted
      if (this.isTokenBlacklisted(token)) {
        throw new Error('Refresh token has been revoked');
      }

      const decoded = jwt.verify(token, this.refreshSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256'],
      });

      // Verify token type
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token format');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Refresh token not active yet');
      }
      throw new Error(`Invalid refresh token: ${error.message}`);
    }
  }

  // Generate token pair (access + refresh)
  generateTokenPair(user) {
    try {
      const payload = {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
      };

      const accessToken = this.generateAccessToken(payload);
      const refreshToken = this.generateRefreshToken({ id: user.id });

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.expiresIn,
        issuedAt: new Date().toISOString(),
        user: user.toSafeObject(),
      };
    } catch (error) {
      throw new Error(`Failed to generate token pair: ${error.message}`);
    }
  }

  // Decode token without verification (for expired token info)
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      throw new Error(`Failed to decode token: ${error.message}`);
    }
  }

  // Get token info without verification
  getTokenInfo(token) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded) return null;

      return {
        header: decoded.header,
        payload: {
          ...decoded.payload,
          isExpired: decoded.payload.exp < Math.floor(Date.now() / 1000),
        },
      };
    } catch (error) {
      return null;
    }
  }

  // Blacklist a token (logout functionality)
  blacklistToken(token) {
    try {
      const decoded = this.decodeToken(token);
      if (decoded && decoded.payload.jti) {
        this.blacklistedTokens.add(decoded.payload.jti);
        console.log(`🔒 Token blacklisted: ${decoded.payload.jti}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to blacklist token:', error.message);
      return false;
    }
  }

  // Check if token is blacklisted
  isTokenBlacklisted(token) {
    try {
      const decoded = this.decodeToken(token);
      return (
        decoded &&
        decoded.payload.jti &&
        this.blacklistedTokens.has(decoded.payload.jti)
      );
    } catch (error) {
      return false;
    }
  }

  // Clear expired blacklisted tokens (cleanup)
  cleanupBlacklistedTokens() {
    const currentTime = Math.floor(Date.now() / 1000);
    const tokensToRemove = [];

    for (const jti of this.blacklistedTokens) {
      // In a real implementation, you'd store the expiration time with the JTI
      // For now, we'll just keep a reasonable number of tokens
      if (this.blacklistedTokens.size > 1000) {
        tokensToRemove.push(jti);
      }
    }

    tokensToRemove.forEach((jti) => {
      this.blacklistedTokens.delete(jti);
    });

    if (tokensToRemove.length > 0) {
      console.log(
        `🧹 Cleaned up ${tokensToRemove.length} expired blacklisted tokens`
      );
    }
  }

  // Validate token structure
  static validateTokenStructure(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    return parts.length === 3;
  }

  // Get token expiration time
  getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token);
      if (decoded && decoded.payload.exp) {
        return new Date(decoded.payload.exp * 1000);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Check if token will expire soon (within specified minutes)
  isTokenExpiringSoon(token, withinMinutes = 15) {
    try {
      const expiration = this.getTokenExpiration(token);
      if (!expiration) return false;

      const now = new Date();
      const timeDiff = expiration.getTime() - now.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      return minutesDiff <= withinMinutes && minutesDiff > 0;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
module.exports = new JWTService();
