import express from 'express';
import AdminController from '../controller/admin_controller.js';

const router = express.Router();

// Admin Dashboard
router.get('/dashboard', AdminController.getDashboard.bind(AdminController));

// Submissions Management
router.get('/submissions', AdminController.getSubmissions.bind(AdminController));
router.post('/submissions/:submissionId/review', AdminController.reviewSubmission.bind(AdminController));

// Business Management
router.post('/businesses/:walletAddress/suspend', AdminController.suspendBusiness.bind(AdminController));
router.post('/businesses/:walletAddress/reinstate', AdminController.reinstateBusiness.bind(AdminController));
router.post('/businesses/:walletAddress/grant-self-mint', AdminController.grantSelfMint.bind(AdminController));
router.post('/businesses/:walletAddress/revoke-self-mint', AdminController.revokeSelfMint.bind(AdminController));

// Admin Logs
router.get('/logs', AdminController.getLogs.bind(AdminController));
router.get('/logs/stats', AdminController.getActionStats.bind(AdminController));
router.get('/logs/admin/:adminId/activity', AdminController.getAdminActivity.bind(AdminController));

// SLA Management
router.get('/sla-violations', AdminController.getSLAViolations.bind(AdminController));

export default router;
