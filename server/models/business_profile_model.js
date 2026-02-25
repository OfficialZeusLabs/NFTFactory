import mongoose from "mongoose";

/**
 * Business Profile Model
 * Extended profile with trust score, verification, and enterprise features
 */

// Trust Score Calculation Weights
export const TrustScoreWeights = {
    SUBSCRIPTION_LONGEVITY: 15,
    SUCCESSFUL_MINTS: 20,
    REDEMPTION_RATE: 20,
    SLA_COMPLIANCE: 10,
    LOW_REJECTION_RATIO: 10,
    SALES_VOLUME: 15,
    LOW_DISPUTE_RATE: 10
};

// Verification Badge Levels
export const VerificationBadgeLevels = {
    STARTER: { min: 0, max: 39, label: 'Starter' },
    VERIFIED: { min: 40, max: 59, label: 'Verified' },
    PREMIUM: { min: 60, max: 79, label: 'Premium Verified' },
    ENTERPRISE: { min: 80, max: 100, label: 'Enterprise Trusted' }
};

const BusinessProfileSchema = new mongoose.Schema({
    // Core Identity
    walletAddress: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Basic Profile
    username: String,
    email: {
        type: String,
        required: true
    },
    businessName: String,
    businessType: String,
    registrationNumber: String,
    website: String,
    location: String,
    bio: String,
    
    // Social Links
    social: {
        twitter: String,
        discord: String,
        linkedin: String,
        instagram: String
    },
    
    // Subscription Info
    subscription: {
        subscriptionId: String,
        tier: {
            type: String,
            enum: ['COAL', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM']
        },
        purchasedAt: Date,
        expiresAt: Date,
        totalQuota: Number,
        remainingQuota: Number,
        isActive: {
            type: Boolean,
            default: false
        }
    },
    
    // Trust Score System
    trustScore: {
        current: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        history: [{
            score: Number,
            calculatedAt: Date,
            factors: {
                subscriptionLongevity: Number,
                successfulMints: Number,
                redemptionRate: Number,
                slaCompliance: Number,
                lowRejectionRatio: Number,
                salesVolume: Number,
                lowDisputeRate: Number
            }
        }],
        lastCalculated: Date
    },
    
    // Verification Badge
    verificationBadge: {
        level: {
            type: String,
            enum: ['STARTER', 'VERIFIED', 'PREMIUM', 'ENTERPRISE'],
            default: 'STARTER'
        },
        achievedAt: Date,
        previousLevel: String
    },
    
    // Statistics
    stats: {
        totalSubmissions: {
            type: Number,
            default: 0
        },
        approvedSubmissions: {
            type: Number,
            default: 0
        },
        rejectedSubmissions: {
            type: Number,
            default: 0
        },
        needsUpdateSubmissions: {
            type: Number,
            default: 0
        },
        totalMinted: {
            type: Number,
            default: 0
        },
        totalSalesVolume: {
            type: String,
            default: '0'
        },
        totalRevenue: {
            type: String,
            default: '0'
        },
        totalRedemptions: {
            type: Number,
            default: 0
        },
        completedRedemptions: {
            type: Number,
            default: 0
        },
        declinedRedemptions: {
            type: Number,
            default: 0
        },
        pendingRedemptions: {
            type: Number,
            default: 0
        },
        slaViolations: {
            type: Number,
            default: 0
        },
        disputes: {
            type: Number,
            default: 0
        }
    },
    
    // Self-Mint Eligibility
    selfMint: {
        eligible: {
            type: Boolean,
            default: false
        },
        unlockedAt: Date,
        unlockedBy: String, // 'SYSTEM' or admin ID
        manualOverride: {
            enabled: Boolean,
            enabledBy: String,
            enabledAt: Date,
            reason: String
        },
        eligibilityChecks: {
            trustScoreMin75: Boolean,
            subscription6Months: Boolean,
            min50Mints: Boolean,
            redemptionRate95: Boolean,
            rejectionRatio5: Boolean,
            noSuspension90Days: Boolean,
            tierQuantity: Boolean
        }
    },
    
    // Suspension History
    suspensionHistory: [{
        suspendedAt: Date,
        reason: String,
        suspendedBy: String,
        reinstatedAt: Date,
        reinstatementReason: String
    }],
    
    // Enterprise Status
    enterprise: {
        isEnterprise: {
            type: Boolean,
            default: false
        },
        approvedAt: Date,
        approvedBy: String,
        volumeThreshold: String,
        revenueThreshold: String
    },
    
    // Notification Preferences
    notifications: {
        email: {
            submissionReceived: { type: Boolean, default: true },
            approved: { type: Boolean, default: true },
            rejected: { type: Boolean, default: true },
            needsUpdate: { type: Boolean, default: true },
            minted: { type: Boolean, default: true },
            redemptionRequested: { type: Boolean, default: true },
            redemptionAccepted: { type: Boolean, default: true },
            redemptionDeclined: { type: Boolean, default: true },
            redemptionCompleted: { type: Boolean, default: true }
        }
    },
    
    // Profile Status
    status: {
        type: String,
        enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
        default: 'ACTIVE'
    },
    
    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
    
}, { timestamps: true });

// Indexes
BusinessProfileSchema.index({ walletAddress: 1 });
BusinessProfileSchema.index({ 'trustScore.current': -1 });
BusinessProfileSchema.index({ 'verificationBadge.level': 1 });
BusinessProfileSchema.index({ 'selfMint.eligible': 1 });
BusinessProfileSchema.index({ 'subscription.tier': 1 });

// Methods
BusinessProfileSchema.methods.calculateTrustScore = async function() {
    const Submission = mongoose.model('Submission');
    const Redemption = mongoose.model('Redemption');
    const NFTSale = mongoose.model('NFTSale');
    
    const wallet = this.walletAddress;
    const now = new Date();
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
    
    // 1. Subscription Longevity (max 15 points)
    let subscriptionLongevity = 0;
    if (this.subscription.purchasedAt) {
        const monthsActive = (now - this.subscription.purchasedAt) / (30 * 24 * 60 * 60 * 1000);
        subscriptionLongevity = Math.min(15, (monthsActive / 12) * 15);
    }
    
    // 2. Successful Mints (max 20 points)
    const successfulMints = await Submission.countDocuments({
        businessWallet: wallet,
        status: 'MINTED'
    });
    const successfulMintsScore = Math.min(20, (successfulMints / 100) * 20);
    
    // 3. Redemption Rate (max 20 points)
    const redemptionStats = await Redemption.getStatsForBusiness(wallet);
    const redemptionRate = redemptionStats.completionRate || 0;
    const redemptionRateScore = (redemptionRate / 100) * 20;
    
    // 4. SLA Compliance (max 10 points)
    const totalSubmissions = this.stats.totalSubmissions || 1;
    const slaViolations = this.stats.slaViolations || 0;
    const slaCompliance = Math.max(0, 10 - (slaViolations / totalSubmissions) * 10);
    
    // 5. Low Rejection Ratio (max 10 points)
    const rejections = this.stats.rejectedSubmissions || 0;
    const rejectionRatio = totalSubmissions > 0 ? (rejections / totalSubmissions) * 100 : 0;
    const rejectionScore = Math.max(0, 10 - (rejectionRatio / 5) * 10);
    
    // 6. Sales Volume (max 15 points)
    const salesStats = await NFTSale.getRevenueStats(wallet);
    const totalVolume = parseFloat(salesStats.totalVolume || 0);
    const salesVolumeScore = Math.min(15, (totalVolume / 10) * 15); // 10 ETH = max score
    
    // 7. Low Dispute Rate (max 10 points)
    const disputes = this.stats.disputes || 0;
    const totalRedemptions = this.stats.totalRedemptions || 1;
    const disputeRate = (disputes / totalRedemptions) * 100;
    const disputeScore = Math.max(0, 10 - (disputeRate / 10) * 10);
    
    // Calculate total
    const totalScore = Math.round(
        subscriptionLongevity +
        successfulMintsScore +
        redemptionRateScore +
        slaCompliance +
        rejectionScore +
        salesVolumeScore +
        disputeScore
    );
    
    // Update trust score
    this.trustScore.current = Math.min(100, Math.max(0, totalScore));
    this.trustScore.lastCalculated = now;
    this.trustScore.history.push({
        score: this.trustScore.current,
        calculatedAt: now,
        factors: {
            subscriptionLongevity: Math.round(subscriptionLongevity),
            successfulMints: Math.round(successfulMintsScore),
            redemptionRate: Math.round(redemptionRateScore),
            slaCompliance: Math.round(slaCompliance),
            lowRejectionRatio: Math.round(rejectionScore),
            salesVolume: Math.round(salesVolumeScore),
            lowDisputeRate: Math.round(disputeScore)
        }
    });
    
    // Update verification badge
    this.updateVerificationBadge();
    
    await this.save();
    return this.trustScore.current;
};

BusinessProfileSchema.methods.updateVerificationBadge = function() {
    const score = this.trustScore.current;
    let newLevel = 'STARTER';
    
    if (score >= 80) newLevel = 'ENTERPRISE';
    else if (score >= 60) newLevel = 'PREMIUM';
    else if (score >= 40) newLevel = 'VERIFIED';
    
    if (newLevel !== this.verificationBadge.level) {
        this.verificationBadge.previousLevel = this.verificationBadge.level;
        this.verificationBadge.level = newLevel;
        this.verificationBadge.achievedAt = new Date();
    }
};

BusinessProfileSchema.methods.checkSelfMintEligibility = async function() {
    const Submission = mongoose.model('Submission');
    const Redemption = mongoose.model('Redemption');
    
    const now = new Date();
    const sixMonthsAgo = new Date(now - 180 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
    
    // Check all conditions
    const checks = {
        trustScoreMin75: this.trustScore.current >= 75,
        subscription6Months: this.subscription.purchasedAt && this.subscription.purchasedAt <= sixMonthsAgo,
        min50Mints: this.stats.totalMinted >= 50,
        redemptionRate95: this.stats.redemptionRate >= 95,
        rejectionRatio5: (this.stats.rejectedSubmissions / Math.max(1, this.stats.totalSubmissions)) <= 0.05,
        noSuspension90Days: !this.suspensionHistory.some(s => s.suspendedAt > ninetyDaysAgo && !s.reinstatedAt),
        tierQuantity: await this.checkTierQuantity()
    };
    
    this.selfMint.eligibilityChecks = checks;
    
    // All checks must pass
    const allPassed = Object.values(checks).every(check => check === true);
    
    // Enterprise override
    const enterpriseOverride = this.enterprise.isEnterprise && 
                               this.trustScore.current >= 85 &&
                               this.stats.totalMinted >= 500;
    
    if ((allPassed || enterpriseOverride) && !this.selfMint.eligible) {
        this.selfMint.eligible = true;
        this.selfMint.unlockedAt = now;
        this.selfMint.unlockedBy = enterpriseOverride ? 'ENTERPRISE_OVERRIDE' : 'SYSTEM';
    }
    
    return this.selfMint.eligible;
};

BusinessProfileSchema.methods.checkTierQuantity = async function() {
    const tier = this.subscription.tier;
    const mintedCount = this.stats.totalMinted;
    
    switch(tier) {
        case 'GOLD':
            return mintedCount >= 3;
        case 'PLATINUM':
            return mintedCount >= 5;
        default:
            return false;
    }
};

BusinessProfileSchema.methods.getDashboardStats = async function() {
    const Submission = mongoose.model('Submission');
    const Redemption = mongoose.model('Redemption');
    
    const [submissionStats, redemptionStats] = await Promise.all([
        Submission.getStatusCounts(this.walletAddress),
        Redemption.getStatsForBusiness(this.walletAddress)
    ]);
    
    return {
        overview: {
            organizationTier: this.subscription.tier,
            subscriptionStatus: this.subscription.isActive ? 'Active' : 'Inactive',
            trustScore: this.trustScore.current,
            verificationBadge: this.verificationBadge.level,
            selfMintEligible: this.selfMint.eligible
        },
        submissions: submissionStats,
        redemptions: redemptionStats,
        sales: {
            totalRevenue: this.stats.totalRevenue,
            totalSalesVolume: this.stats.totalSalesVolume
        },
        quota: {
            total: this.subscription.totalQuota,
            remaining: this.subscription.remainingQuota,
            used: this.subscription.totalQuota - this.subscription.remainingQuota
        }
    };
};

// Statics
BusinessProfileSchema.statics.getLeaderboard = async function(limit = 100) {
    return this.find({ status: 'ACTIVE' })
        .sort({ 'trustScore.current': -1 })
        .limit(limit)
        .select('walletAddress businessName trustScore.current verificationBadge.level stats')
        .lean();
};

BusinessProfileSchema.statics.getByVerificationLevel = async function(level) {
    return this.find({
        'verificationBadge.level': level,
        status: 'ACTIVE'
    }).lean();
};

const BusinessProfileModel = mongoose.model("BusinessProfile", BusinessProfileSchema);
export default BusinessProfileModel;
