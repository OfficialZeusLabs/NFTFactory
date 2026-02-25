import BusinessProfile from '../models/business_profile_model.js';
import Submission, { SubmissionStatus } from '../models/submission_model.js';
import SubmissionVersion from '../models/submission_version_model.js';
import Redemption, { RedemptionStatus } from '../models/redemption_model.js';
import NFTSale from '../models/nft_sale_model.js';
import AdminLog from '../models/admin_log_model.js';
import EmailService from '../services/email_service.js';
import Routes from "../routes/index_routes.js";

/**
 * Business Dashboard Controller
 * Handles all dashboard-related operations for businesses
 */

class DashboardController {
    
    static initialize(app) {
        const controller = new DashboardController();
        app.get(Routes.DASHBOARD_OVERVIEW, controller.getOverview.bind(controller));
        app.get(Routes.DASHBOARD_SUBMISSIONS, controller.getSubmissions.bind(controller));
        app.get(Routes.DASHBOARD_SUBMISSION_VERSIONS, controller.getSubmissionVersions.bind(controller));
        app.get(Routes.DASHBOARD_COLLECTIONS, controller.getCollections.bind(controller));
        app.get(Routes.DASHBOARD_REDEMPTIONS, controller.getRedemptions.bind(controller));
        app.post(Routes.DASHBOARD_RESPOND_REDEMPTION, controller.respondToRedemption.bind(controller));
        app.post(Routes.DASHBOARD_CONFIRM_REDEMPTION, controller.confirmRedemption.bind(controller));
        app.get(Routes.DASHBOARD_ANALYTICS, controller.getAnalytics.bind(controller));
        app.get(Routes.DASHBOARD_TRUST_SCORE, controller.getTrustScore.bind(controller));
        app.get(Routes.DASHBOARD_SELF_MINT_ELIGIBILITY, controller.checkSelfMintEligibility.bind(controller));
        app.post(Routes.DASHBOARD_RESUBMIT, controller.resubmit.bind(controller));
    }
    
    /**
     * Get dashboard overview data
     */
    async getOverview(req, res) {
        try {
            const { walletAddress } = req.params;
            
            const profile = await BusinessProfile.findOne({ walletAddress });
            if (!profile) {
                return res.status(404).json({ error: 'Business profile not found' });
            }
            
            // Get submission counts
            const submissionCounts = await Submission.aggregate([
                { $match: { businessWallet: walletAddress, isDeleted: false } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);
            
            const counts = {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                needsUpdate: 0,
                minted: 0
            };
            
            submissionCounts.forEach(item => {
                counts.total += item.count;
                if (item._id === SubmissionStatus.PENDING) counts.pending = item.count;
                if (item._id === SubmissionStatus.APPROVED) counts.approved = item.count;
                if (item._id === SubmissionStatus.REJECTED) counts.rejected = item.count;
                if (item._id === SubmissionStatus.NEEDS_UPDATE) counts.needsUpdate = item.count;
                if (item._id === SubmissionStatus.MINTED) counts.minted = item.count;
            });
            
            // Get redemption stats
            const redemptionStats = await Redemption.getStatsForBusiness(walletAddress);
            
            // Get sales stats
            const salesStats = await NFTSale.getBusinessRevenue(walletAddress);
            
            const overview = {
                organization: {
                    tier: profile.subscription.tier,
                    status: profile.subscription.isActive ? 'Active' : 'Inactive',
                    subscriptionId: profile.subscription.subscriptionId,
                    purchasedAt: profile.subscription.purchasedAt
                },
                trust: {
                    score: profile.trustScore.current,
                    badge: profile.verificationBadge.level,
                    selfMintEligible: profile.selfMint.eligible
                },
                quota: {
                    total: profile.subscription.totalQuota,
                    remaining: profile.subscription.remainingQuota,
                    used: profile.subscription.totalQuota - profile.subscription.remainingQuota
                },
                submissions: counts,
                redemptions: {
                    total: redemptionStats.total,
                    completed: redemptionStats.completed,
                    pending: redemptionStats.pendingCount,
                    completionRate: redemptionStats.completionRate
                },
                sales: {
                    primaryRevenue: salesStats.primary.totalRevenue,
                    secondaryRoyalties: salesStats.secondary.totalRoyalties,
                    totalRevenue: salesStats.totalRevenue,
                    totalVolume: profile.stats.totalSalesVolume
                },
                stats: {
                    slaViolations: profile.stats.slaViolations,
                    disputes: profile.stats.disputes
                }
            };
            
            res.json({ success: true, data: overview });
        } catch (error) {
            console.error('Get overview error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Get submission manager data
     */
    async getSubmissions(req, res) {
        try {
            const { walletAddress } = req.params;
            const { status, page = 1, limit = 20 } = req.query;
            
            const query = { 
                businessWallet: walletAddress,
                isDeleted: false 
            };
            
            if (status) {
                query.status = status;
            }
            
            const skip = (parseInt(page) - 1) * parseInt(limit);
            
            const submissions = await Submission.find(query)
                .sort({ submittedAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean();
            
            // Enhance with version info and SLA status
            const enhancedSubmissions = await Promise.all(
                submissions.map(async (sub) => {
                    const latestVersion = await SubmissionVersion.getLatestVersion(sub.submissionId);
                    const isSLAViolated = sub.slaDeadline && new Date() > sub.slaDeadline;
                    
                    return {
                        ...sub,
                        version: latestVersion?.versionNumber || 1,
                        slaStatus: isSLAViolated ? 'VIOLATED' : (sub.slaDeadline ? 'ACTIVE' : 'N/A'),
                        slaDeadline: sub.slaDeadline,
                        canResubmit: sub.status === SubmissionStatus.NEEDS_UPDATE
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
            console.error('Get submissions error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Get submission version history
     */
    async getSubmissionVersions(req, res) {
        try {
            const { submissionId } = req.params;
            
            const versions = await SubmissionVersion.getVersionHistory(submissionId);
            
            res.json({ success: true, data: versions });
        } catch (error) {
            console.error('Get versions error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Get live NFT collections
     */
    async getCollections(req, res) {
        try {
            const { walletAddress } = req.params;
            
            // Get all minted submissions with token info
            const collections = await Submission.find({
                businessWallet: walletAddress,
                status: SubmissionStatus.MINTED,
                isDeleted: false
            })
            .sort({ mintedAt: -1 })
            .lean();
            
            // Enhance with sales data
            const enhancedCollections = await Promise.all(
                collections.map(async (col) => {
                    const sales = await NFTSale.find({
                        contractAddress: col.contractAddress,
                        tokenId: col.tokenId
                    }).lean();
                    
                    const totalRevenue = sales.reduce((sum, s) => 
                        sum + parseFloat(s.sellerProceeds || 0), 0
                    );
                    
                    return {
                        ...col,
                        sales: {
                            count: sales.length,
                            totalRevenue: totalRevenue.toString(),
                            lastSale: sales[0]?.blockTimestamp
                        }
                    };
                })
            );
            
            res.json({ success: true, data: enhancedCollections });
        } catch (error) {
            console.error('Get collections error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Get redemption management data
     */
    async getRedemptions(req, res) {
        try {
            const { walletAddress } = req.params;
            const { status, role = 'seller' } = req.query;
            
            const query = role === 'seller' 
                ? { sellerWallet: walletAddress }
                : { buyerWallet: walletAddress };
            
            if (status) {
                query.status = status;
            }
            
            query.isDeleted = false;
            
            const redemptions = await Redemption.find(query)
                .sort({ requestDate: -1 })
                .lean();
            
            res.json({ success: true, data: redemptions });
        } catch (error) {
            console.error('Get redemptions error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Respond to redemption request (accept/decline)
     */
    async respondToRedemption(req, res) {
        try {
            const { redemptionId } = req.params;
            const { action, declineReason, declineCategory, message, estimatedDate } = req.body;
            const { walletAddress } = req.user;
            
            const redemption = await Redemption.findOne({
                redemptionId,
                sellerWallet: walletAddress
            });
            
            if (!redemption) {
                return res.status(404).json({ error: 'Redemption not found' });
            }
            
            if (action === 'accept') {
                redemption.status = RedemptionStatus.ACCEPTED;
                redemption.sellerResponse = {
                    accepted: true,
                    responseMessage: message,
                    estimatedFulfillmentDate: estimatedDate
                };
                
                // Send email to buyer
                await EmailService.sendRedemptionAccepted(redemption.buyerWallet, {
                    redemptionId,
                    tokenId: redemption.tokenId,
                    title: redemption.tokenURI,
                    sellerMessage: message,
                    estimatedDate
                });
            } else if (action === 'decline') {
                redemption.status = RedemptionStatus.DECLINED;
                redemption.sellerResponse = {
                    accepted: false,
                    declineReason,
                    declineCategory,
                    responseMessage: message
                };
                
                // Send email to buyer
                await EmailService.sendRedemptionDeclined(redemption.buyerWallet, {
                    redemptionId,
                    tokenId: redemption.tokenId,
                    title: redemption.tokenURI,
                    declineReason,
                    declineCategory
                });
            }
            
            redemption.sellerResponseDate = new Date();
            await redemption.save();
            
            res.json({ success: true, data: redemption });
        } catch (error) {
            console.error('Respond to redemption error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Confirm redemption completion (buyer)
     */
    async confirmRedemption(req, res) {
        try {
            const { redemptionId } = req.params;
            const { rating, feedback } = req.body;
            const { walletAddress } = req.user;
            
            const redemption = await Redemption.findOne({
                redemptionId,
                buyerWallet: walletAddress,
                status: RedemptionStatus.ACCEPTED
            });
            
            if (!redemption) {
                return res.status(404).json({ error: 'Redemption not found or not in accepted state' });
            }
            
            redemption.status = RedemptionStatus.USER_CONFIRMED;
            redemption.userConfirmation = {
                confirmed: true,
                confirmationMessage: feedback,
                rating,
                confirmedAt: new Date()
            };
            redemption.userConfirmationDate = new Date();
            
            await redemption.save();
            
            // Trigger NFT burn (this would be handled by a worker)
            // await this.triggerNFTBurn(redemption);
            
            res.json({ success: true, data: redemption });
        } catch (error) {
            console.error('Confirm redemption error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Get sales and analytics
     */
    async getAnalytics(req, res) {
        try {
            const { walletAddress } = req.params;
            const { period = '30d' } = req.query;
            
            // Get revenue stats
            const revenueStats = await NFTSale.getBusinessRevenue(walletAddress);
            
            // Get sales by period
            const salesByPeriod = await NFTSale.getSalesByPeriod(walletAddress, period);
            
            // Get top selling NFTs
            const topSelling = await NFTSale.getTopSellingNFTs(walletAddress, 10);
            
            res.json({
                success: true,
                data: {
                    revenue: revenueStats,
                    salesByPeriod,
                    topSelling
                }
            });
        } catch (error) {
            console.error('Get analytics error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Get trust score details
     */
    async getTrustScore(req, res) {
        try {
            const { walletAddress } = req.params;
            
            const profile = await BusinessProfile.findOne({ walletAddress });
            if (!profile) {
                return res.status(404).json({ error: 'Profile not found' });
            }
            
            // Recalculate trust score
            await profile.calculateTrustScore();
            
            res.json({
                success: true,
                data: {
                    currentScore: profile.trustScore.current,
                    badge: profile.verificationBadge.level,
                    history: profile.trustScore.history.slice(-10),
                    factors: profile.trustScore.history[profile.trustScore.history.length - 1]?.factors || {}
                }
            });
        } catch (error) {
            console.error('Get trust score error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Check self-mint eligibility
     */
    async checkSelfMintEligibility(req, res) {
        try {
            const { walletAddress } = req.params;
            
            const profile = await BusinessProfile.findOne({ walletAddress });
            if (!profile) {
                return res.status(404).json({ error: 'Profile not found' });
            }
            
            const isEligible = await profile.checkSelfMintEligibility();
            
            res.json({
                success: true,
                data: {
                    eligible: isEligible,
                    checks: profile.selfMint.eligibilityChecks,
                    unlocked: profile.selfMint.eligible,
                    unlockedAt: profile.selfMint.unlockedAt
                }
            });
        } catch (error) {
            console.error('Check self-mint eligibility error:', error);
            res.status(500).json({ error: error.message });
        }
    }
    
    /**
     * Resubmit submission with updates
     */
    async resubmit(req, res) {
        try {
            const { submissionId } = req.params;
            const { updates, resubmissionReason } = req.body;
            const { walletAddress } = req.user;
            
            const submission = await Submission.findOne({
                submissionId,
                businessWallet: walletAddress
            });
            
            if (!submission) {
                return res.status(404).json({ error: 'Submission not found' });
            }
            
            if (submission.status !== SubmissionStatus.NEEDS_UPDATE) {
                return res.status(400).json({ error: 'Submission cannot be resubmitted' });
            }
            
            // Create new version
            const version = await SubmissionVersion.createNewVersion(
                submissionId,
                {
                    updatedFields: updates.updatedFields,
                    snapshot: updates.snapshot,
                    uploadedImageCIDs: updates.uploadedImageCIDs,
                    resubmissionReason
                },
                { id: req.user.id, wallet: walletAddress }
            );
            
            // Update submission
            submission.status = SubmissionStatus.PENDING;
            submission.slaDeadline = submission.calculateSLADeadline();
            submission.currentVersion = version.versionNumber;
            submission.adminComments = [];
            await submission.save();
            
            // Log admin action
            await AdminLog.createLog({
                adminId: req.user.id,
                adminWallet: walletAddress,
                actionType: 'SUBMISSION_RESUBMITTED',
                actionCategory: 'SUBMISSION',
                targetId: submissionId,
                targetType: 'SUBMISSION',
                message: `Submission resubmitted: ${resubmissionReason}`,
                statusTransition: {
                    previousStatus: SubmissionStatus.NEEDS_UPDATE,
                    newStatus: SubmissionStatus.PENDING,
                    isValidTransition: true
                }
            });
            
            res.json({ success: true, data: submission });
        } catch (error) {
            console.error('Resubmit error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

export default DashboardController;

