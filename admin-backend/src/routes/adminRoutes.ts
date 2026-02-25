import { Router } from 'express';
import { body } from 'express-validator';
import {
  adminLogin,
  adminSignup,
  createAdminUser,
  getPendingUsers,
  approveUser,
  rejectUser,
  getAllSubmissions,
  getSubmissionDetails,
  approveSubmission,
  rejectSubmission,
  assignDesigner,
  uploadFinalArtwork,
  generateMetadata,
  getAnalytics,
} from '../controllers/adminController';
import { authenticate, authorize } from '../middleware/auth';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public routes
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  adminLogin
);

router.post(
  '/signup',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('role').optional().isIn(['ADMIN', 'DESIGNER', 'OPS']).withMessage('Valid role is required'),
  ],
  adminSignup
);

// Protected routes
router.use(authenticate);

// User management routes (Super Admin and Admin only)
router.get('/users/pending', authorize('SUPER_ADMIN', 'ADMIN'), getPendingUsers);
router.post('/users/:userId/approve', authorize('SUPER_ADMIN', 'ADMIN'), approveUser);
router.post('/users/:userId/reject', authorize('SUPER_ADMIN', 'ADMIN'), rejectUser);

// Admin only routes
router.post(
  '/users',
  authorize('SUPER_ADMIN', 'ADMIN'),
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('role').isIn(['SUPER_ADMIN', 'ADMIN', 'DESIGNER', 'OPS']).withMessage('Valid role is required'),
  ],
  createAdminUser
);

// Submissions
router.get('/submissions', getAllSubmissions);
router.get('/submissions/:id', getSubmissionDetails);

// Actions
router.post('/submissions/:id/approve', authorize('ADMIN', 'OPS'), approveSubmission);
router.post('/submissions/:id/reject', authorize('ADMIN', 'OPS'), rejectSubmission);
router.post('/submissions/:id/assign-designer', authorize('ADMIN', 'OPS'), assignDesigner);

// Designer actions
router.post(
  '/submissions/:id/upload-artwork',
  authorize('ADMIN', 'DESIGNER', 'OPS'),
  upload.single('artwork'),
  uploadFinalArtwork
);

router.post(
  '/submissions/:id/generate-metadata',
  authorize('ADMIN', 'DESIGNER', 'OPS'),
  generateMetadata
);

// Analytics
router.get('/analytics', authorize('ADMIN'), getAnalytics);

export default router;
