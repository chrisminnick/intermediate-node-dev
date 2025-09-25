# Day 2: Authentication, Security & Database Integration

## Session 1: Authentication Strategies (JWT, OAuth2, Sessions)

**Duration**: 90 minutes  
**Objective**: Implement secure authentication systems with multiple strategies

### Learning Outcomes

- Understand different authentication patterns and their use cases
- Implement JWT-based authentication with proper security
- Configure OAuth2 flows for third-party authentication
- Design session-based authentication for web applications
- Apply security best practices for token management

### Lecture Content

#### 1. Authentication Fundamentals (25 minutes)

**Authentication vs Authorization**

- Authentication: "Who are you?" - Identity verification
- Authorization: "What can you do?" - Permission verification
- Multi-factor authentication considerations

**Session-Based Authentication**

```
Client → Server: Login credentials
Server → Client: Set session cookie
Client → Server: Requests with cookie
Server: Validates session in store
```

**Token-Based Authentication**

```
Client → Server: Login credentials
Server → Client: JWT token
Client → Server: Requests with Bearer token
Server: Validates token signature
```

#### 2. JWT Implementation (35 minutes)

**JWT Structure**

```
Header.Payload.Signature
```

**Header Example:**

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload (Claims):**

```json
{
  "sub": "user123",
  "name": "John Doe",
  "iat": 1516239022,
  "exp": 1516325422,
  "aud": "myapp.com",
  "iss": "auth.myapp.com"
}
```

**Security Considerations:**

- Use strong signing algorithms (RS256 preferred over HS256)
- Implement token rotation for long-lived applications
- Store sensitive data server-side, not in JWT payload
- Implement proper token expiration and refresh strategies

#### 3. OAuth2 Flow Implementation (30 minutes)

**Authorization Code Flow (Most Secure)**

```
1. Client redirects to Authorization Server
2. User authenticates and consents
3. Authorization Server redirects back with code
4. Client exchanges code for access token
5. Client uses access token for API requests
```

**OAuth2 Providers Integration:**

- Google OAuth2
- GitHub OAuth2
- Auth0 implementation
- Custom OAuth2 server setup

### Code Examples

#### JWT Authentication Middleware

```javascript
const jwt = require('jsonwebtoken');
const { promisify } = require('util');

class JWTAuth {
  constructor(secret, options = {}) {
    this.secret = secret;
    this.options = {
      algorithm: 'HS256',
      expiresIn: '1h',
      issuer: 'myapp.com',
      ...options,
    };
  }

  generateTokens(payload) {
    const accessToken = jwt.sign(payload, this.secret, {
      ...this.options,
      expiresIn: '15m',
    });

    const refreshToken = jwt.sign(payload, this.secret, {
      ...this.options,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  middleware() {
    return async (req, res, next) => {
      try {
        const token = this.extractToken(req);
        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = await promisify(jwt.verify)(token, this.secret);
        req.user = decoded;
        next();
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
      }
    };
  }

  extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }
}
```

#### OAuth2 Integration

```javascript
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

class OAuth2Handler {
  constructor(app) {
    this.app = app;
    this.setupPassport();
    this.setupRoutes();
  }

  setupPassport() {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: '/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Find or create user in database
            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
              user = await User.create({
                googleId: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                avatar: profile.photos[0].value,
              });
            }

            return done(null, user);
          } catch (error) {
            return done(error, null);
          }
        }
      )
    );

    passport.serializeUser((user, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
      try {
        const user = await User.findById(id);
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
  }

  setupRoutes() {
    this.app.get(
      '/auth/google',
      passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    this.app.get(
      '/auth/google/callback',
      passport.authenticate('google', { failureRedirect: '/login' }),
      (req, res) => {
        // Generate JWT for the authenticated user
        const jwtAuth = new JWTAuth(process.env.JWT_SECRET);
        const tokens = jwtAuth.generateTokens({
          sub: req.user.id,
          email: req.user.email,
          name: req.user.name,
        });

        // Redirect with token or set secure cookie
        res.redirect(`/dashboard?token=${tokens.accessToken}`);
      }
    );
  }
}
```

---

## Session 2: Security Best Practices & Database Integration

**Duration**: 75 minutes  
**Objective**: Secure applications and implement robust database patterns

### Learning Outcomes

- Implement role-based access control (RBAC)
- Secure environment variables and secrets management
- Protect against common web vulnerabilities
- Design secure database schemas and queries
- Implement database transactions and connection pooling

### Lecture Content

#### 1. Role-Based Access Control (25 minutes)

**RBAC Components:**

- Users: Individual entities
- Roles: Collections of permissions
- Permissions: Specific actions on resources
- Resources: Protected entities or endpoints

**Implementation Pattern:**

```
User → has → Roles → contain → Permissions → apply to → Resources
```

#### 2. Security Vulnerabilities & Protection (25 minutes)

**Common Attacks & Prevention:**

1. **SQL Injection**

   - Use parameterized queries
   - Input validation and sanitization
   - Principle of least privilege for database users

2. **XSS (Cross-Site Scripting)**

   - Output encoding/escaping
   - Content Security Policy (CSP) headers
   - Input validation

3. **CSRF (Cross-Site Request Forgery)**

   - CSRF tokens
   - SameSite cookie attributes
   - Origin/Referer header validation

4. **Security Headers**
   - Helmet.js implementation
   - HTTPS enforcement
   - HSTS headers

#### 3. Database Security & Patterns (25 minutes)

**Connection Security:**

- SSL/TLS connections
- Connection pooling with limits
- Database user permissions
- Environment-based configuration

**Transaction Patterns:**

- ACID properties in MongoDB and SQL
- Two-phase commits
- Saga pattern for distributed transactions
- Optimistic vs pessimistic locking

### Code Examples

#### RBAC Implementation

```javascript
class RBACManager {
  constructor() {
    this.roles = new Map();
    this.userRoles = new Map();
  }

  defineRole(roleName, permissions) {
    this.roles.set(roleName, new Set(permissions));
  }

  assignRole(userId, roleName) {
    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, new Set());
    }
    this.userRoles.get(userId).add(roleName);
  }

  hasPermission(userId, permission) {
    const userRoles = this.userRoles.get(userId) || new Set();

    for (const roleName of userRoles) {
      const rolePermissions = this.roles.get(roleName);
      if (rolePermissions && rolePermissions.has(permission)) {
        return true;
      }
    }
    return false;
  }

  middleware(requiredPermission) {
    return (req, res, next) => {
      const userId = req.user?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!this.hasPermission(userId, requiredPermission)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  }
}

// Usage
const rbac = new RBACManager();

// Define roles
rbac.defineRole('admin', ['read', 'write', 'delete', 'manage_users']);
rbac.defineRole('editor', ['read', 'write']);
rbac.defineRole('viewer', ['read']);

// Assign roles
rbac.assignRole('user123', 'editor');

// Use in routes
app.get(
  '/admin/users',
  jwtAuth.middleware(),
  rbac.middleware('manage_users'),
  (req, res) => {
    // Admin-only endpoint
  }
);
```

#### Security Middleware Stack

```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

class SecurityManager {
  static setupSecurity(app) {
    // Basic security headers
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://fonts.googleapis.com',
            ],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      })
    );

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use('/api/', limiter);

    // More strict rate limiting for auth endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      message: 'Too many authentication attempts',
      skipSuccessfulRequests: true,
    });
    app.use('/api/auth/', authLimiter);

    // Sanitize input data
    app.use(mongoSanitize());

    // Input validation middleware
    app.use(this.inputValidation());
  }

  static inputValidation() {
    return (req, res, next) => {
      // Remove potential XSS patterns
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }
      next();
    };
  }

  static sanitizeObject(obj) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Basic XSS prevention
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
```

#### Secure Database Connection

```javascript
const mongoose = require('mongoose');

class DatabaseManager {
  constructor() {
    this.connection = null;
    this.retryCount = 0;
    this.maxRetries = 5;
  }

  async connect() {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maximum number of connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      // SSL/TLS options
      ssl: process.env.NODE_ENV === 'production',
      sslValidate: process.env.NODE_ENV === 'production',
      // Authentication
      authSource: 'admin',
    };

    try {
      this.connection = await mongoose.connect(
        process.env.MONGODB_URI,
        options
      );

      // Connection event handlers
      mongoose.connection.on('connected', () => {
        console.log('MongoDB connected successfully');
        this.retryCount = 0;
      });

      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
        this.handleConnectionError();
      });

      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
        this.handleReconnection();
      });

      return this.connection;
    } catch (error) {
      console.error('Initial MongoDB connection failed:', error);
      throw error;
    }
  }

  async handleConnectionError() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(
        `Retrying MongoDB connection (${this.retryCount}/${this.maxRetries})...`
      );

      setTimeout(() => {
        this.connect().catch(console.error);
      }, 5000 * this.retryCount); // Exponential backoff
    } else {
      console.error('Max MongoDB connection retries exceeded');
      process.exit(1);
    }
  }

  async handleReconnection() {
    if (process.env.NODE_ENV === 'production') {
      this.retryCount = 0;
      this.handleConnectionError();
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      console.log('MongoDB disconnected gracefully');
    }
  }
}
```

### Discussion Topics

1. When would you choose JWT over sessions and vice versa?
2. How do you handle token refresh in a secure way?
3. What are the trade-offs between different OAuth2 flows?
4. How do you implement proper session invalidation?
5. What database security measures are critical for production?

### Hands-on Exercise

Students will implement a complete authentication system with:

- JWT and refresh token handling
- Role-based access control
- OAuth2 Google integration
- Security middleware stack
- Secure database connections
