import mongoose from "mongoose";

/**
 * Redemption Status Enum
 * Lifecycle: PENDING → ACCEPTED/DECLINED → USER_CONFIRMED → COMPLETED
 */
export const RedemptionStatus = {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    DECLINED: 'DECLINED',
    USER_CONFIRMED: 'USER_CONFIRMED',
    COMPLETED: 'COMPLETED',
    EXPIRED: 'EXPIRED'
};

/**
 * Valid redemption status transitions
 */
export const ValidRedemptionTransitions = {
    [RedemptionStatus.PENDING]: [RedemptionStatus.ACCEPTED, RedemptionStatus.DECLINED],
    [RedemptionStatus.ACCEPTED]: [RedemptionStatus.USER_CONFIRMED],
    [RedemptionStatus.USER_CONFIRMED]: [RedemptionStatus.COMPLETED],
    [RedemptionStatus.DECLINED]: [],
    [RedemptionStatus.COMPLETED]: [],
    [RedemptionStatus.EXPIRED]: []
};

const RedemptionSchema = new mongoose.Schema({
    // Core Identification
    redemptionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Token Information
    tokenId: {
        type: String,
        required: true,
        index: true
    },
    contractAddress: {
        type: String,
        required: true
    },
    tokenURI: String,
    
    // Parties
    buyerWallet: {
        type: String,
        required: true,
        index: true
    },
    sellerWallet: {
        type: String,
        required: true,
        index: true
    },
    
    // Submission Reference (for business context)
    submissionId: {
        type: String,
        index: true
    },
    collectionId: String,
    
    // Status Lifecycle
    status: {
        type: String,
        enum: Object.values(RedemptionStatus),
        default: RedemptionStatus.PENDING,
        index: true
    },
    
    // Timeline
    requestDate: {
        type: Date,
        default: Date.now
    },
    sellerResponseDate: Date,
    userConfirmationDate: Date,
    completionDate: Date,
    expiryDate: Date, // Auto-expire if not responded within 7 days
    
    // Seller Response
    sellerResponse: {
        accepted: Boolean,
        declineReason: String,
        declineCategory: {
            type: String,
            enum: ['OUT_OF_STOCK', 'SHIPPING_ISSUE', 'QUALITY_ISSUE', 'BUYER_REQUEST', 'OTHER']
        },
        responseMessage: String,
        estimatedFulfillmentDate: Date
    },
    
    // Fulfillment Details
    fulfillment: {
        method: {
            type: String,
            enum: ['PHYSICAL_SHIPMENT', 'DIGITAL_DELIVERY', 'IN_PERSON', 'SERVICE']
        },
        trackingNumber: String,
        carrier: String,
        shippedDate: Date,
        deliveredDate: Date,
        deliveryAddress: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            country: String
        },
        notes: String
    },
    
    // User Confirmation
    userConfirmation: {
        confirmed: Boolean,
        confirmationMessage: String,
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        feedback: String,
        confirmedAt: Date
    },
    
    // On-chain Burn
    burnTxHash: String,
    burnBlockNumber: Number,
    burnTimestamp: Date,
    
    // Dispute Resolution
    dispute: {
        isDisputed: {
            type: Boolean,
            default: false
        },
        disputeReason: String,
        disputedAt: Date,
        resolvedAt: Date,
        resolution: String,
        resolutionOutcome: {
            type: String,
            enum: ['BUYER_FAVOR', 'SELLER_FAVOR', 'COMPROMISE', 'PENDING']
        }
    },
    
    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Soft Delete
    isDeleted: {
        type: Boolean,
        default: false
    }
    
}, { timestamps: true });

// Indexes
RedemptionSchema.index({ buyerWallet: 1, status: 1 });
RedemptionSchema.index({ sellerWallet: 1, status: 1 });
RedemptionSchema.index({ status: 1, requestDate: -1 });
RedemptionSchema.index({ tokenId: 1, contractAddress: 1 });

// Methods
RedemptionSchema.methods.isValidTransition = function(newStatus) {
    return ValidRedemptionTransitions[this.status]?.includes(newStatus) || false;
};

RedemptionSchema.methods.getResponseTimeHours = function() {
    if (!this.sellerResponseDate || !this.requestDate) return null;
    const diffMs = this.sellerResponseDate - this.requestDate;
    return Math.round(diffMs / (1000 * 60 * 60) * 100) / 100;
};

RedemptionSchema.methods.getFulfillmentTimeHours = function() {
    if (!this.completionDate || !this.userConfirmationDate) return null;
    const diffMs = this.completionDate - this.userConfirmationDate;
    return Math.round(diffMs / (1000 * 60 * 60) * 100) / 100;
};

// Statics
RedemptionSchema.statics.getPendingForSeller = async function(sellerWallet) {
    return this.find({
        sellerWallet,
        status: RedemptionStatus.PENDING,
        isDeleted: false
    }).sort({ requestDate: -1 });
};

RedemptionSchema.statics.getStatsForBusiness = async function(businessWallet) {
    const stats = await this.aggregate([
        {
            $match: {
                $or: [{ sellerWallet: businessWallet }, { buyerWallet: businessWallet }],
                isDeleted: false
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgResponseTime: {
                    $avg: {
                        $cond: [
                            { $and: ['$sellerResponseDate', '$requestDate'] },
                            { $divide: [{ $subtract: ['$sellerResponseDate', '$requestDate'] }, 3600000] },
                            null
                        ]
                    }
                }
            }
        }
    ]);
    
    // Calculate completion rate
    const completed = stats.find(s => s._id === RedemptionStatus.COMPLETED)?.count || 0;
    const total = stats.reduce((acc, s) => acc + s.count, 0);
    
    return {
        byStatus: stats,
        total,
        completed,
        completionRate: total > 0 ? (completed / total) * 100 : 0,
        pendingCount: stats.find(s => s._id === RedemptionStatus.PENDING)?.count || 0
    };
};

RedemptionSchema.statics.getCompletionRate = async function(wallet, asSeller = true) {
    const matchField = asSeller ? 'sellerWallet' : 'buyerWallet';
    const result = await this.aggregate([
        {
            $match: {
                [matchField]: wallet,
                status: { $in: [RedemptionStatus.COMPLETED, RedemptionStatus.DECLINED] },
                isDeleted: false
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                completed: {
                    $sum: { $cond: [{ $eq: ['$status', RedemptionStatus.COMPLETED] }, 1, 0] }
                }
            }
        }
    ]);
    
    if (!result.length) return 0;
    return (result[0].completed / result[0].total) * 100;
};

const RedemptionModel = mongoose.model("Redemption", RedemptionSchema);
export default RedemptionModel;

