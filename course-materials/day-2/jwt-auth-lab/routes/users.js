const express = require('express');
const {
  authenticate,
  requireRole,
  requirePermission,
} = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// User search (admin only)
router.get('/search', requireRole('admin'), userController.searchUsers);

// User statistics (admin only)
router.get('/stats', requireRole('admin'), userController.getUserStats);

// Get all users (admin only)
router.get('/', requireRole('admin'), userController.getAllUsers);

// Get user by ID (admin or own profile)
router.get('/:id', userController.getUserById);

// Update user (admin for all fields, users for own basic info)
router.put('/:id', userController.updateUser);

// Delete user (admin only)
router.delete('/:id', requireRole('admin'), userController.deleteUser);

// Deactivate user (admin only)
router.post(
  '/:id/deactivate',
  requireRole('admin'),
  userController.deactivateUser
);

// Activate user (admin only)
router.post('/:id/activate', requireRole('admin'), userController.activateUser);

module.exports = router;
