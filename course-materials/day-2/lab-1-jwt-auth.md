# Lab 1: Implementing JWT Authentication with Role-Based Access

## Objective
Secure an Express.js API using JWTs and restrict access to endpoints based on user roles.

## Instructions

### Part 1: User Management
1. Create a Node.js project and install:
   - `express`, `jsonwebtoken`, `bcryptjs`
2. Set up sample users with hashed passwords and roles (admin, user).

### Part 2: JWT Authentication Middleware
1. Implement login, token generation, and role-based access control.
2. Add middleware to protect routes and restrict by role.

### Part 3: API Endpoints
1. Create endpoints for login, protected resources, and admin-only routes.
2. Test with Postman or curl.

### Part 4: Extension (Optional)
- Add password reset and user registration
- Integrate with a database for persistent users
- Implement token refresh and revocation

## Deliverables
- Express server and authentication middleware code
- Example JWT usage and protected endpoints
- Brief explanation of JWT and RBAC benefits

## Resources
- [JWT.io](https://jwt.io/)
- [Express.js Documentation](https://expressjs.com/)

---

**Tip:** Focus on secure authentication and role-based access. Add extensions if time allows.
