const express = require('express');
const {
  authenticate,
  requireRole,
  requirePermission,
} = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);

// Token validation (public but requires token)
router.post('/validate-token', authController.validateToken);

// Protected routes (require authentication)
router.use(authenticate);

// User profile routes
router.get('/profile', authController.profile);
router.put('/profile', authController.updateProfile);
router.post('/change-password', authController.changePassword);

// Token info
router.get('/token-info', authController.tokenInfo);

// Logout
router.post('/logout', authController.logout);

module.exports = router;
