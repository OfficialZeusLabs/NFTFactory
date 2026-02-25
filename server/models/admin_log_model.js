import mongoose from "mongoose";

/**
 * Admin Log Model
 * Comprehensive audit trail for all administrative actions
 */

export const AdminActionTypes = {
    // Submission Actions
    SUBMISSION_APPROVED: 'SUBMISSION_APPROVED',
    SUBMISSION_REJECTED: 'SUBMISSION_REJECTED',
    SUBMISSION_NEEDS_UPDATE: 'SUBMISSION_NEEDS_UPDATE',
    SUBMISSION_RESUBMITTED: 'SUBMISSION_RESUBMITTED',
    SUBMISSION_MINTED: 'SUBMISSION_MINTED',
    SUBMISSION_MINT_FAILED: 'SUBMISSION_MINT_FAILED',
    
    // Metadata Actions
    METADATA_GENERATED: 'METADATA_GENERATED',
    METADATA_UPDATED: 'METADATA_UPDATED',
    
    // User Actions
    USER_SUSPENDED: 'USER_SUSPENDED',
    USER_REINSTATED: 'USER_REINSTATED',
    USER_SELF_MINT_APPROVED: 'USER_SELF_MINT_APPROVED',
    USER_SELF_MINT_REVOKED: 'USER_SELF_MINT_REVOKED',
    USER_ENTERPRISE_GRANTED: 'USER_ENTERPRISE_GRANTED',
    
    // System Actions
    SYSTEM_MINT_TRIGGERED: 'SYSTEM_MINT_TRIGGERED',
    SLA_VIOLATION_FLAGGED: 'SLA_VIOLATION_FLAGGED',
    TRUST_SCORE_RECALCULATED: 'TRUST_SCORE_RECALCULATED',
    
    // Redemption Actions
    REDEMPTION_ACCEPTED: 'REDEMPTION_ACCEPTED',
    REDEMPTION_DECLINED: 'REDEMPTION_DECLINED',
    REDEMPTION_COMPLETED: 'REDEMPTION_COMPLETED',
    
    // Contract Actions
    CONTRACT_DEPLOYED: 'CONTRACT_DEPLOYED',
    CONTRACT_UPGRADED: 'CONTRACT_UPGRADED',
    CONTRACT_PAUSED: 'CONTRACT_PAUSED',
    CONTRACT_UNPAUSED: 'CONTRACT_UNPAUSED'
};

const AdminLogSchema = new mongoose.Schema({
    // Log Identification
    logId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Admin Information
    adminId: {
        type: String,
        required: true,
        index: true
    },
    adminWallet: String,
    adminEmail: String,
    adminRole: {
        type: String,
        enum: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'REVIEWER'],
        default: 'ADMIN'
    },
    
    // Action Details
    actionType: {
        type: String,
        enum: Object.values(AdminActionTypes),
        required: true,
        index: true
    },
    actionCategory: {
        type: String,
        enum: ['SUBMISSION', 'USER', 'SYSTEM', 'REDEMPTION', 'CONTRACT'],
        required: true
    },
    
    // Target Reference (what was acted upon)
    targetId: String, // submissionId, userId, etc.
    targetType: {
        type: String,
        enum: ['SUBMISSION', 'USER', 'REDEMPTION', 'CONTRACT', 'SYSTEM']
    },
    targetWallet: String, // If applicable
    
    // Status Transition (for submission actions)
    statusTransition: {
        previousStatus: String,
        newStatus: String,
        isValidTransition: Boolean
    },
    
    // Detailed Message
    message: {
        type: String,
        required: true
    },
    
    // Additional Context
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Changes Made (diff tracking)
    changes: [{
        field: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed
    }],
    
    // IP and Location (for security)
    ipAddress: String,
    userAgent: String,
    
    // Timestamps
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    // Related Logs (for chained actions)
    relatedLogIds: [{
        type: String,
        ref: 'AdminLog'
    }],
    
    // Batch Operations
    batchId: String, // If part of a batch operation
    batchSize: Number,
    batchIndex: Number,
    
    // Automation Flag
    isAutomated: {
        type: Boolean,
        default: false
    },
    automationTrigger: String // e.g., 'SLA_VIOLATION', 'SCHEDULED_TASK'
    
}, { timestamps: true });

// Indexes for efficient querying
AdminLogSchema.index({ adminId: 1, timestamp: -1 });
AdminLogSchema.index({ actionType: 1, timestamp: -1 });
AdminLogSchema.index({ targetId: 1, timestamp: -1 });
AdminLogSchema.index({ actionCategory: 1, timestamp: -1 });
AdminLogSchema.index({ timestamp: -1 });
AdminLogSchema.index({ batchId: 1 });

// Methods
AdminLogSchema.methods.getRelatedLogs = async function() {
    if (!this.relatedLogIds || this.relatedLogIds.length === 0) {
        return [];
    }
    return this.model('AdminLog').find({
        logId: { $in: this.relatedLogIds }
    }).sort({ timestamp: 1 });
};

AdminLogSchema.methods.getBatchLogs = async function() {
    if (!this.batchId) return [];
    return this.model('AdminLog').find({
        batchId: this.batchId
    }).sort({ batchIndex: 1 });
};

// Statics
AdminLogSchema.statics.createLog = async function(logData) {
    const log = new this({
        logId: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...logData,
        timestamp: new Date()
    });
    await log.save();
    return log;
};

AdminLogSchema.statics.getLogsByAdmin = async function(adminId, options = {}) {
    const { startDate, endDate, actionType, limit = 50, skip = 0 } = options;
    
    const query = { adminId };
    
    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    if (actionType) {
        query.actionType = actionType;
    }
    
    return this.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
};

AdminLogSchema.statics.getLogsByTarget = async function(targetId, options = {}) {
    const { limit = 50, skip = 0 } = options;
    
    return this.find({ targetId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
};

AdminLogSchema.statics.getActionStats = async function(options = {}) {
    const { startDate, endDate, groupBy = 'actionType' } = options;
    
    const matchStage = {};
    if (startDate || endDate) {
        matchStage.timestamp = {};
        if (startDate) matchStage.timestamp.$gte = new Date(startDate);
        if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }
    
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: `$${groupBy}`,
                count: { $sum: 1 },
                uniqueAdmins: { $addToSet: '$adminId' },
                lastAction: { $max: '$timestamp' }
            }
        },
        {
            $project: {
                _id: 1,
                count: 1,
                uniqueAdminCount: { $size: '$uniqueAdmins' },
                lastAction: 1
            }
        },
        { $sort: { count: -1 } }
    ]);
};

AdminLogSchema.statics.getAdminActivityReport = async function(adminId, period = '7d') {
    const periodMap = {
        '24h': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90
    };
    
    const days = periodMap[period] || 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const [actionsByType, actionsByDay, targetBreakdown] = await Promise.all([
        // Actions by type
        this.aggregate([
            {
                $match: {
                    adminId,
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$actionType',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]),
        
        // Actions by day
        this.aggregate([
            {
                $match: {
                    adminId,
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]),
        
        // Target breakdown
        this.aggregate([
            {
                $match: {
                    adminId,
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$targetType',
                    count: { $sum: 1 }
                }
            }
        ])
    ]);
    
    return {
        period,
        totalActions: actionsByType.reduce((sum, a) => sum + a.count, 0),
        actionsByType,
        actionsByDay,
        targetBreakdown
    };
};

AdminLogSchema.statics.searchLogs = async function(searchQuery, options = {}) {
    const { limit = 50, skip = 0 } = options;
    
    return this.find({
        $or: [
            { message: { $regex: searchQuery, $options: 'i' } },
            { adminId: { $regex: searchQuery, $options: 'i' } },
            { targetId: { $regex: searchQuery, $options: 'i' } },
            { targetWallet: { $regex: searchQuery, $options: 'i' } }
        ]
    })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

const AdminLogModel = mongoose.model("AdminLog", AdminLogSchema);
export default AdminLogModel;
