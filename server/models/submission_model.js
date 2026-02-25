import mongoose from "mongoose";

/**
 * Submission Status Enum
 * Strict governance: PENDING → APPROVED/REJECTED/NEEDS_UPDATE
 * NEEDS_UPDATE → PENDING
 * APPROVED → READY_FOR_MINT → MINTED/FAILED
 */
export const SubmissionStatus = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    NEEDS_UPDATE: 'NEEDS_UPDATE',
    READY_FOR_MINT: 'READY_FOR_MINT',
    MINTED: 'MINTED',
    FAILED: 'FAILED'
};

/**
 * Valid status transitions for strict governance
 */
export const ValidTransitions = {
    [SubmissionStatus.PENDING]: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED, SubmissionStatus.NEEDS_UPDATE],
    [SubmissionStatus.NEEDS_UPDATE]: [SubmissionStatus.PENDING],
    [SubmissionStatus.APPROVED]: [SubmissionStatus.READY_FOR_MINT],
    [SubmissionStatus.READY_FOR_MINT]: [SubmissionStatus.MINTED, SubmissionStatus.FAILED],
    [SubmissionStatus.FAILED]: [SubmissionStatus.READY_FOR_MINT],
    [SubmissionStatus.REJECTED]: [],
    [SubmissionStatus.MINTED]: []
};

/**
 * SLA Deadlines in hours
 */
export const SLADeadlines = {
    [SubmissionStatus.PENDING]: 48,
    [SubmissionStatus.NEEDS_UPDATE]: 24,
    [SubmissionStatus.READY_FOR_MINT]: 12
};

const SubmissionSchema = new mongoose.Schema({
    // Core Identification
    submissionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    businessWallet: {
        type: String,
        required: true,
        index: true
    },
    subscriptionId: {
        type: String,
        required: true,
        index: true
    },
    
    // Content
    title: {
        type: String,
        required: true
    },
    description: String,
    category: String,
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Media (IPFS CIDs)
    images: [{
        cid: String,
        url: String,
        filename: String,
        uploadedAt: Date
    }],
    
    // Status Governance
    status: {
        type: String,
        enum: Object.values(SubmissionStatus),
        default: SubmissionStatus.PENDING,
        index: true
    },
    
    // SLA Tracking
    slaDeadline: Date,
    slaViolated: {
        type: Boolean,
        default: false
    },
    submittedAt: {
        type: Date,
        default: Date.now
    },
    reviewedAt: Date,
    mintedAt: Date,
    
    // Admin Review
    adminComments: [{
        adminId: String,
        message: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Rejection Details
    rejectionReason: String,
    rejectionCategory: {
        type: String,
        enum: ['CONTENT', 'QUALITY', 'COMPLIANCE', 'TECHNICAL', 'OTHER']
    },
    
    // Mint Information
    mintTxHash: String,
    tokenId: String,
    contractAddress: String,
    tokenURI: String,
    
    // Version Control
    currentVersion: {
        type: Number,
        default: 1
    },
    
    // Self-Mint Eligibility Check
    selfMintApproved: {
        type: Boolean,
        default: false
    },
    selfMintApprovedAt: Date,
    selfMintApprovedBy: String,
    
    // Compliance Flags
    complianceFlags: [{
        flag: String,
        severity: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH']
        },
        resolved: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Soft Delete
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: Date,
    deletedBy: String
    
}, { timestamps: true });

// Indexes for performance
SubmissionSchema.index({ businessWallet: 1, status: 1 });
SubmissionSchema.index({ status: 1, slaDeadline: 1 });
SubmissionSchema.index({ submittedAt: -1 });

// Methods
SubmissionSchema.methods.isValidTransition = function(newStatus) {
    const currentStatus = this.status;
    return ValidTransitions[currentStatus]?.includes(newStatus) || false;
};

SubmissionSchema.methods.calculateSLADeadline = function() {
    const hours = SLADeadlines[this.status] || 48;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
};

SubmissionSchema.methods.checkSLAViolation = function() {
    if (!this.slaDeadline) return false;
    return new Date() > this.slaDeadline;
};

// Statics
SubmissionSchema.statics.getStatusCounts = async function(businessWallet) {
    return this.aggregate([
        { $match: { businessWallet, isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
};

SubmissionSchema.statics.getSLAViolations = async function() {
    return this.find({
        slaDeadline: { $lt: new Date() },
        slaViolated: false,
        status: { $in: [SubmissionStatus.PENDING, SubmissionStatus.NEEDS_UPDATE, SubmissionStatus.READY_FOR_MINT] }
    });
};

const SubmissionModel = mongoose.model("Submission", SubmissionSchema);
export default SubmissionModel;

