import AdminLog, { AdminActionTypes } from '../models/admin_log_model.js';
import Submission, { SubmissionStatus, ValidTransitions, SLADeadlines } from '../models/submission_model.js';
import SubmissionVersion from '../models/submission_version_model.js';
import BusinessProfile from '../models/business_profile_model.js';
import Redemption from '../models/redemption_model.js';
import EmailService from '../services/email_service.js';

/**
 * Admin Dashboard Controller
 * Handles administrative operations and dashboard functionality
 */

class AdminController {
    
    static initialize(app) {
        // Add admin routes here when needed
    }
    
    /**
     * Get admin dashboard overview
     */
    async getDashboard(req, res) {
        try {
            // Get counts by status
            const submissionStats = await Submission.aggregate([
                { $match: { isDeleted: false } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);
            
            // Get SLA violations
            const slaViolations = await Submission.getSLAViolations();
            
            // Get pending redemptions
            const pendingRedemptions = await Redemption.countDocuments({
                status: 'PENDING'
            });
            
            // Get recent admin activity
            const recentActivity = await AdminLog.find()
                .sort({ timestamp: -1 })
                .limit(20)
                .lean();
            
            // Get business stats
            const businessStats = await BusinessProfile.aggregate([
                { $match: { status: 'ACTIVE' } },
                {
                    $group: {
                        _id: '$verificationBadge.level',
                        count: { $sum: 1 }
                    }
                }
            ]);
            
            res.json({
                success: true,
                data: {
                    submissions: {
                        byStatus: submissionStats,
                        slaViolations: slaViolations.length
                    },
                    redemptions: {
                        pending: pendingRedemptions
                    },
                    businesses: {
                        byBadge: businessStats
                    },
                    recentActivity
                }
            });
        } catch (error) {
            console.error('Get admin dashboard error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Get submissions for admin review
     */
    async getSubmissions(req, res) {
        try {
            const { 
                status, 
                page = 1, 
                limit = 20, 
                sortBy = 'submittedAt',
                sortOrder = 'desc',
                slaViolated 
            } = req.query;
            
            const query = { isDeleted: false };
            
            if (status) {
                query.status = status;
            }
            
            if (slaViolated === 'true') {
                query.slaDeadline = { $lt: new Date() };
                query.slaViolated = false;
            }
            
            const skip = (parseInt(page) - 1) * parseInt(limit);
            const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
            
            const submissions = await Submission.find(query)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean();
            
            // Enhance with business profile info
            const enhancedSubmissions = await Promise.all(
                submissions.map(async (sub) => {
                    const profile = await BusinessProfile.findOne({
                        walletAddress: sub.businessWallet
                    }).select('businessName trustScore.current verificationBadge.level');
                    
                    return {
                        ...sub,
                        business: profile || null,
                        isSLAViolated: sub.slaDeadline && new Date() > sub.slaDeadline
                    };
                })
            );
            
            const total = await Submission.countDocuments(query);
            
            res.json({
                success: true,
                data: enhancedSubmissions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (error) {
            console.error('Get admin submissions error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Review submission (approve/reject/needs_update)
     */
    async reviewSubmission(req, res) {
        try {
            const { submissionId } = req.params;
            const { action, message, rejectionReason, rejectionCategory } = req.body;
            const { adminId, adminWallet } = req.user;
            
            const submission = await Submission.findOne({ submissionId });
            if (!submission) {
                return res.status(404).json({ error: 'Submission not found' });
            }
            
            // Validate status transition
            const newStatus = this.getStatusFromAction(action);
            if (!submission.isValidTransition(newStatus)) {
                return res.status(400).json({ 
                    error: 'Invalid status transition',
                    currentStatus: submission.status,
                    attemptedStatus: newStatus
                });
            }
            
            const previousStatus = submission.status;
            submission.status = newStatus;
            submission.reviewedAt = new Date();
            
            if (message) {
                submission.adminComments.push({
                    adminId,
                    message,
                    createdAt: new Date()
                });
            }
            
            if (action === 'reject') {
                submission.rejectionReason = rejectionReason;
                submission.rejectionCategory = rejectionCategory;
            }
            
            if (action === 'needs_update') {
                submission.slaDeadline = submission.calculateSLADeadline();
            }
            
            await submission.save();
            
            // Create admin log
            const actionType = this.getActionTypeFromStatus(newStatus);
            await AdminLog.createLog({
                adminId,
                adminWallet,
                actionType,
                actionCategory: 'SUBMISSION',
                targetId: submissionId,
                targetType: 'SUBMISSION',
                targetWallet: submission.businessWallet,
                message: message || `Submission ${action}`,
                statusTransition: {
                    previousStatus,
                    newStatus,
                    isValidTransition: true
                },
                metadata: {
                    rejectionReason,
                    rejectionCategory
                }
            });
            
            // Send email notification
            const profile = await BusinessProfile.findOne({
                walletAddress: submission.businessWallet
            });
            
            if (profile && profile.email) {
                const emailData = {
                    submissionId,
                    title: submission.title,
                    adminComments: message
                };
                
                switch(action) {
                    case 'approve':
                        await EmailService.sendSubmissionApproved(profile.email, emailData);
                        break;
                    case 'reject':
                        await EmailService.sendSubmissionRejected(profile.email, {
                            ...emailData,
                            rejectionReason,
                            rejectionCategory
                        });
                        break;
                    case 'needs_update':
                        await EmailService.sendSubmissionNeedsUpdate(profile.email, {
                            ...emailData,
                            requestedChanges: req.body.requestedChanges
                        });
                        break;
                }
            }
            
            res.json({ success: true, data: submission });
        } catch (error) {
            console.error('Review submission error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Get admin logs with filters
     */
    async getLogs(req, res) {
        try {
            const {
                adminId,
                actionType,
                actionCategory,
                targetId,
                startDate,
                endDate,
                page = 1,
                limit = 50,
                search
            } = req.query;
            
            let logs;
            
            if (search) {
                logs = await AdminLog.searchLogs(search, { limit, skip: (page - 1) * limit });
            } else {
                logs = await AdminLog.getLogsByAdmin(adminId || '.*', {
                    startDate,
                    endDate,
                    actionType,
                    limit: parseInt(limit),
                    skip: (parseInt(page) - 1) * parseInt(limit)
                });
            }
            
            res.json({
                success: true,
                data: logs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.error('Get logs error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Get admin activity report
     */
    async getAdminActivity(req, res) {
        try {
            const { adminId } = req.params;
            const { period = '7d' } = req.query;
            
            const report = await AdminLog.getAdminActivityReport(adminId, period);
            
            res.json({ success: true, data: report });
        } catch (error) {
            console.error('Get admin activity error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Get action statistics
     */
    async getActionStats(req, res) {
        try {
            const { startDate, endDate, groupBy = 'actionType' } = req.query;
            
            const stats = await AdminLog.getActionStats({
                startDate,
                endDate,
                groupBy
            });
            
            res.json({ success: true, data: stats });
        } catch (error) {
            console.error('Get action stats error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Suspend business
     */
    async suspendBusiness(req, res) {
        try {
            const { walletAddress } = req.params;
            const { reason } = req.body;
            const { adminId, adminWallet } = req.user;
            
            const profile = await BusinessProfile.findOne({ walletAddress });
            if (!profile) {
                return res.status(404).json({ error: 'Business not found' });
            }
            
            profile.status = 'SUSPENDED';
            profile.suspensionHistory.push({
                suspendedAt: new Date(),
                reason,
                suspendedBy: adminId
            });
            
            await profile.save();
            
            // Create admin log
            await AdminLog.createLog({
                adminId,
                adminWallet,
                actionType: AdminActionTypes.USER_SUSPENDED,
                actionCategory: 'USER',
                targetId: walletAddress,
                targetType: 'USER',
                targetWallet: walletAddress,
                message: `Business suspended: ${reason}`,
                metadata: { reason }
            });
            
            res.json({ success: true, data: profile });
        } catch (error) {
            console.error('Suspend business error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Reinstate business
     */
    async reinstateBusiness(req, res) {
        try {
            const { walletAddress } = req.params;
            const { reason } = req.body;
            const { adminId, adminWallet } = req.user;
            
            const profile = await BusinessProfile.findOne({ walletAddress });
            if (!profile) {
                return res.status(404).json({ error: 'Business not found' });
            }
            
            profile.status = 'ACTIVE';
            
            // Update last suspension record
            const lastSuspension = profile.suspensionHistory[profile.suspensionHistory.length - 1];
            if (lastSuspension && !lastSuspension.reinstatedAt) {
                lastSuspension.reinstatedAt = new Date();
                lastSuspension.reinstatementReason = reason;
            }
            
            await profile.save();
            
            // Create admin log
            await AdminLog.createLog({
                adminId,
                adminWallet,
                actionType: AdminActionTypes.USER_REINSTATED,
                actionCategory: 'USER',
                targetId: walletAddress,
                targetType: 'USER',
                targetWallet: walletAddress,
                message: `Business reinstated: ${reason}`,
                metadata: { reason }
            });
            
            res.json({ success: true, data: profile });
        } catch (error) {
            console.error('Reinstate business error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Grant self-mint privilege
     */
    async grantSelfMint(req, res) {
        try {
            const { walletAddress } = req.params;
            const { reason } = req.body;
            const { adminId, adminWallet } = req.user;
            
            const profile = await BusinessProfile.findOne({ walletAddress });
            if (!profile) {
                return res.status(404).json({ error: 'Business not found' });
            }
            
            profile.selfMint.eligible = true;
            profile.selfMint.manualOverride = {
                enabled: true,
                enabledBy: adminId,
                enabledAt: new Date(),
                reason
            };
            
            await profile.save();
            
            // Send email
            if (profile.email) {
                await EmailService.sendSelfMintUnlocked(profile.email, {
                    businessName: profile.businessName
                });
            }
            
            // Create admin log
            await AdminLog.createLog({
                adminId,
                adminWallet,
                actionType: AdminActionTypes.USER_SELF_MINT_APPROVED,
                actionCategory: 'USER',
                targetId: walletAddress,
                targetType: 'USER',
                targetWallet: walletAddress,
                message: `Self-mint granted: ${reason}`,
                metadata: { reason }
            });
            
            res.json({ success: true, data: profile });
        } catch (error) {
            console.error('Grant self-mint error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Revoke self-mint privilege
     */
    async revokeSelfMint(req, res) {
        try {
            const { walletAddress } = req.params;
            const { reason } = req.body;
            const { adminId, adminWallet } = req.user;
            
            const profile = await BusinessProfile.findOne({ walletAddress });
            if (!profile) {
                return res.status(404).json({ error: 'Business not found' });
            }
            
            profile.selfMint.eligible = false;
            
            await profile.save();
            
            // Create admin log
            await AdminLog.createLog({
                adminId,
                adminWallet,
                actionType: AdminActionTypes.USER_SELF_MINT_REVOKED,
                actionCategory: 'USER',
                targetId: walletAddress,
                targetType: 'USER',
                targetWallet: walletAddress,
                message: `Self-mint revoked: ${reason}`,
                metadata: { reason }
            });
            
            res.json({ success: true, data: profile });
        } catch (error) {
            console.error('Revoke self-mint error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Get SLA violations
     */
    async getSLAViolations(req, res) {
        try {
            const violations = await Submission.getSLAViolations();
            
            // Enhance with business info
            const enhanced = await Promise.all(
                violations.map(async (v) => {
                    const profile = await BusinessProfile.findOne({
                        walletAddress: v.businessWallet
                    }).select('businessName email');
                    
                    return {
                        ...v.toObject(),
                        business: profile,
                        hoursOverdue: Math.floor((new Date() - v.slaDeadline) / (1000 * 60 * 60))
                    };
                })
            );
            
            res.json({ success: true, data: enhanced });
        } catch (error) {
            console.error('Get SLA violations error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    // Helper methods
    getStatusFromAction(action) {
        const map = {
            'approve': SubmissionStatus.APPROVED,
            'reject': SubmissionStatus.REJECTED,
            'needs_update': SubmissionStatus.NEEDS_UPDATE
        };
        return map[action];
    }
    
    getActionTypeFromStatus(status) {
        const map = {
            [SubmissionStatus.APPROVED]: AdminActionTypes.SUBMISSION_APPROVED,
            [SubmissionStatus.REJECTED]: AdminActionTypes.SUBMISSION_REJECTED,
            [SubmissionStatus.NEEDS_UPDATE]: AdminActionTypes.SUBMISSION_NEEDS_UPDATE
        };
        return map[status];
    }
}

export default AdminController;

