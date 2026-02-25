import { Router } from 'express';
import { body } from 'express-validator';
import {
  createSubmission,
  getBusinessSubmissions,
  getSubmissionById,
} from '../controllers/submissionController';

const router = Router();

// POST /api/submissions - Create new submission
router.post(
  '/',
  [
    body('businessName').notEmpty().trim().withMessage('Business name is required'),
    body('walletAddress').isEthereumAddress().withMessage('Valid wallet address is required'),
    body('subscriptionId').notEmpty().withMessage('Subscription ID is required'),
    body('requestedProductClass').isInt({ min: 0, max: 4 }).withMessage('Product class must be 0-4'),
    body('collectionName').notEmpty().trim().withMessage('Collection name is required'),
    body('description').notEmpty().trim().withMessage('Description is required'),
    body('royaltyPercent').isInt({ min: 0, max: 100 }).withMessage('Royalty must be 0-100'),
    body('contactEmail').isEmail().withMessage('Valid email is required'),
  ],
  createSubmission
);

// GET /api/business/submissions - Get submissions for a wallet
router.get('/business/submissions', getBusinessSubmissions);

// GET /api/submissions/:id - Get submission by ID
router.get('/submissions/:id', getSubmissionById);

export default router;
