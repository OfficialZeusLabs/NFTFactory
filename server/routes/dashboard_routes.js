import express from 'express';
import DashboardController from '../controller/dashboard_controller.js';

const router = express.Router();
const controller = new DashboardController();

// Dashboard Overview
router.get('/:walletAddress/overview', controller.getOverview.bind(controller));

// Submission Manager
router.get('/:walletAddress/submissions', controller.getSubmissions.bind(controller));
router.get('/submissions/:submissionId/versions', controller.getSubmissionVersions.bind(controller));
router.post('/submissions/:submissionId/resubmit', controller.resubmit.bind(controller));

// Live Collections
router.get('/:walletAddress/collections', controller.getCollections.bind(controller));

// Redemption Management
router.get('/:walletAddress/redemptions', controller.getRedemptions.bind(controller));
router.post('/redemptions/:redemptionId/respond', controller.respondToRedemption.bind(controller));
router.post('/redemptions/:redemptionId/confirm', controller.confirmRedemption.bind(controller));

// Sales & Analytics
router.get('/:walletAddress/analytics', controller.getAnalytics.bind(controller));

// Trust Score
router.get('/:walletAddress/trust-score', controller.getTrustScore.bind(controller));

// Self-Mint Eligibility
router.get('/:walletAddress/self-mint-eligibility', controller.checkSelfMintEligibility.bind(controller));

export default router;
