import mongoose from "mongoose";

/**
 * NFT Sale Model
 * Tracks all NFT sales for analytics and revenue calculations
 * Listens to Transfer and Sale events from blockchain
 */

const NFTSaleSchema = new mongoose.Schema({
    // Sale Identification
    saleId: {
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
        required: true,
        index: true
    },
    
    // Transaction Details
    txHash: {
        type: String,
        required: true,
        unique: true
    },
    blockNumber: Number,
    blockTimestamp: Date,
    
    // Sale Details
    price: {
        type: String, // Store as string to handle large numbers
        required: true
    },
    priceInWei: String,
    currency: {
        type: String,
        default: 'ETH'
    },
    
    // Parties
    seller: {
        type: String,
        required: true,
        index: true
    },
    buyer: {
        type: String,
        required: true,
        index: true
    },
    
    // Marketplace Info
    marketplace: {
        type: String,
        default: 'NFTFactory'
    },
    marketplaceFee: String,
    marketplaceFeeBps: Number,
    
    // Royalty Info
    royaltyAmount: String,
    royaltyReceiver: String,
    royaltyBps: Number,
    
    // Seller Proceeds
    sellerProceeds: String,
    
    // Business Context (if applicable)
    submissionId: String,
    collectionId: String,
    businessWallet: String,
    
    // Sale Type
    saleType: {
        type: String,
        enum: ['PRIMARY', 'SECONDARY'],
        default: 'PRIMARY'
    },
    
    // Token Metadata at time of sale
    tokenMetadata: {
        name: String,
        image: String,
        organizationTier: String,
        productClass: String,
        verificationStatus: String
    },
    
    // Event Source
    eventSource: {
        type: String,
        enum: ['TRANSFER', 'SALE_EVENT', 'MARKETPLACE_EVENT'],
        default: 'TRANSFER'
    },
    
    // Processing Status
    processed: {
        type: Boolean,
        default: false
    },
    processedAt: Date,
    
    // Analytics
    analytics: {
        dayOfWeek: Number,
        hourOfDay: Number,
        weekOfYear: Number,
        month: Number,
        year: Number
    }
    
}, { timestamps: true });

// Indexes for analytics queries
NFTSaleSchema.index({ seller: 1, blockTimestamp: -1 });
NFTSaleSchema.index({ buyer: 1, blockTimestamp: -1 });
NFTSaleSchema.index({ businessWallet: 1, blockTimestamp: -1 });
NFTSaleSchema.index({ contractAddress: 1, blockTimestamp: -1 });
NFTSaleSchema.index({ blockTimestamp: -1 });
NFTSaleSchema.index({ saleType: 1, blockTimestamp: -1 });

// Methods
NFTSaleSchema.methods.getPriceInEth = function() {
    return parseFloat(this.price);
};

NFTSaleSchema.methods.calculateRevenueShare = function() {
    const price = parseFloat(this.price);
    const marketplaceFee = parseFloat(this.marketplaceFee || 0);
    const royalty = parseFloat(this.royaltyAmount || 0);
    const sellerProceeds = parseFloat(this.sellerProceeds || 0);
    
    return {
        price,
        marketplaceFee,
        royalty,
        sellerProceeds,
        platformShare: (marketplaceFee / price) * 100,
        creatorShare: (royalty / price) * 100,
        sellerShare: (sellerProceeds / price) * 100
    };
};

// Statics
NFTSaleSchema.statics.getRevenueStats = async function(wallet, options = {}) {
    const { startDate, endDate, saleType } = options;
    
    const matchStage = {
        $or: [{ seller: wallet }, { buyer: wallet }]
    };
    
    if (startDate || endDate) {
        matchStage.blockTimestamp = {};
        if (startDate) matchStage.blockTimestamp.$gte = new Date(startDate);
        if (endDate) matchStage.blockTimestamp.$lte = new Date(endDate);
    }
    
    if (saleType) {
        matchStage.saleType = saleType;
    }
    
    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalSales: { $sum: 1 },
                totalVolume: { $sum: { $toDouble: '$price' } },
                totalRoyalties: { $sum: { $toDouble: { $ifNull: ['$royaltyAmount', '0'] } } },
                totalMarketplaceFees: { $sum: { $toDouble: { $ifNull: ['$marketplaceFee', '0'] } } },
                avgPrice: { $avg: { $toDouble: '$price' } },
                minPrice: { $min: { $toDouble: '$price' } },
                maxPrice: { $max: { $toDouble: '$price' } }
            }
        }
    ]);
    
    return stats[0] || {
        totalSales: 0,
        totalVolume: 0,
        totalRoyalties: 0,
        totalMarketplaceFees: 0,
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0
    };
};

NFTSaleSchema.statics.getSalesByPeriod = async function(wallet, period = 'daily') {
    const groupFormat = {
        daily: { $dateToString: { format: '%Y-%m-%d', date: '$blockTimestamp' } },
        weekly: { $dateToString: { format: '%Y-W%U', date: '$blockTimestamp' } },
        monthly: { $dateToString: { format: '%Y-%m', date: '$blockTimestamp' } }
    };
    
    return this.aggregate([
        {
            $match: {
                $or: [{ seller: wallet }, { buyer: wallet }]
            }
        },
        {
            $group: {
                _id: groupFormat[period] || groupFormat.daily,
                sales: { $sum: 1 },
                volume: { $sum: { $toDouble: '$price' } },
                avgPrice: { $avg: { $toDouble: '$price' } }
            }
        },
        { $sort: { _id: 1 } }
    ]);
};

NFTSaleSchema.statics.getTopSellingNFTs = async function(contractAddress, limit = 10) {
    return this.aggregate([
        { $match: { contractAddress } },
        {
            $group: {
                _id: '$tokenId',
                totalSales: { $sum: 1 },
                totalVolume: { $sum: { $toDouble: '$price' } },
                avgPrice: { $avg: { $toDouble: '$price' } },
                lastSaleDate: { $max: '$blockTimestamp' }
            }
        },
        { $sort: { totalVolume: -1 } },
        { $limit: limit }
    ]);
};

NFTSaleSchema.statics.getBusinessRevenue = async function(businessWallet) {
    const [primary, secondary] = await Promise.all([
        // Primary sales (as seller)
        this.aggregate([
            {
                $match: {
                    seller: businessWallet,
                    saleType: 'PRIMARY'
                }
            },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: 1 },
                    totalRevenue: { $sum: { $toDouble: '$sellerProceeds' } },
                    totalVolume: { $sum: { $toDouble: '$price' } }
                }
            }
        ]),
        // Secondary royalties
        this.aggregate([
            {
                $match: {
                    royaltyReceiver: businessWallet,
                    saleType: 'SECONDARY'
                }
            },
            {
                $group: {
                    _id: null,
                    totalRoyalties: { $sum: { $sum: { $toDouble: '$royaltyAmount' } } },
                    royaltyTransactions: { $sum: 1 }
                }
            }
        ])
    ]);
    
    return {
        primary: primary[0] || { totalSales: 0, totalRevenue: 0, totalVolume: 0 },
        secondary: secondary[0] || { totalRoyalties: 0, royaltyTransactions: 0 },
        totalRevenue: (primary[0]?.totalRevenue || 0) + (secondary[0]?.totalRoyalties || 0)
    };
};

const NFTSaleModel = mongoose.model("NFTSale", NFTSaleSchema);
export default NFTSaleModel;
