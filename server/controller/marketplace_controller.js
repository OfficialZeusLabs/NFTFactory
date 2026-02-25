import NFTSale from '../models/nft_sale_model.js';
import Routes from '../routes/index_routes.js';

/**
 * Marketplace Analytics Controller
 * Handles marketplace analytics data for floor prices, volumes, and trending collections
 */

class MarketplaceController {
    static initialize(app) {
        const controller = new MarketplaceController();
        
        // Add marketplace routes to the app
        app.use(`/${Routes.API_VERSION}/marketplace`, this.getRouter());
    }
    
    static getRouter() {
        const express = require('express');
        const router = express.Router();
        const controller = new MarketplaceController();
        
        // Marketplace Analytics Routes
        router.get('/collections/:contractAddress/stats', controller.getCollectionStats.bind(controller));
        router.get('/collections/stats', controller.getAllCollectionsStats.bind(controller));
        router.get('/trending', controller.getTrendingCollections.bind(controller));
        
        return router;
    }

    /**
     * Get statistics for a specific collection
     */
    async getCollectionStats(req, res) {
        try {
            const { contractAddress } = req.params;

            // Get sales data for this collection
            const sales = await NFTSale.find({ contractAddress }).sort({ blockTimestamp: -1 }).lean();

            if (sales.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        contractAddress,
                        totalVolume: 0,
                        floorPrice: 0,
                        totalSales: 0,
                        uniqueOwners: 0,
                        averagePrice: 0,
                        highestPrice: 0,
                        lowestPrice: 0,
                        lastSalePrice: 0,
                        salesHistory: []
                    }
                });
            }

            // Calculate metrics
            const prices = sales.map(sale => parseFloat(sale.price));
            const totalVolume = prices.reduce((sum, price) => sum + price, 0);

            // Calculate floor price (lowest price among recent sales)
            const sortedPrices = [...prices].sort((a, b) => a - b);
            const floorPrice = sortedPrices[0] || 0;

            // Calculate other metrics
            const averagePrice = totalVolume / sales.length;
            const highestPrice = Math.max(...prices);
            const lowestPrice = Math.min(...prices);
            const lastSalePrice = sales[0]?.price || 0;

            // Get unique owners (from both buyers and sellers)
            const owners = new Set();
            sales.forEach(sale => {
                owners.add(sale.buyer);
                owners.add(sale.seller);
            });

            res.json({
                success: true,
                data: {
                    contractAddress,
                    totalVolume,
                    floorPrice,
                    totalSales: sales.length,
                    uniqueOwners: owners.size,
                    averagePrice,
                    highestPrice,
                    lowestPrice,
                    lastSalePrice,
                    salesHistory: sales.slice(0, 10) // Last 10 sales
                }
            });
        } catch (error) {
            console.error('Get collection stats error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get statistics for all collections
     */
    async getAllCollectionsStats(req, res) {
        try {
            // Get all unique collection addresses from sales
            const collections = await NFTSale.distinct('contractAddress');

            // Get stats for each collection
            const collectionStats = await Promise.all(
                collections.map(async (contractAddress) => {
                    const sales = await NFTSale.find({ contractAddress }).sort({ blockTimestamp: -1 }).lean();
                    
                    if (sales.length === 0) {
                        return {
                            contractAddress,
                            totalVolume: 0,
                            floorPrice: 0,
                            totalSales: 0,
                            uniqueOwners: 0,
                            averagePrice: 0,
                            highestPrice: 0,
                            lowestPrice: 0,
                            lastSalePrice: 0
                        };
                    }

                    const prices = sales.map(sale => parseFloat(sale.price));
                    const totalVolume = prices.reduce((sum, price) => sum + price, 0);

                    // Calculate floor price (lowest price among recent sales)
                    const sortedPrices = [...prices].sort((a, b) => a - b);
                    const floorPrice = sortedPrices[0] || 0;

                    // Calculate other metrics
                    const averagePrice = totalVolume / sales.length;
                    const highestPrice = Math.max(...prices);
                    const lowestPrice = Math.min(...prices);
                    const lastSalePrice = sales[0]?.price || 0;

                    // Get unique owners
                    const owners = new Set();
                    sales.forEach(sale => {
                        owners.add(sale.buyer);
                        owners.add(sale.seller);
                    });

                    return {
                        contractAddress,
                        totalVolume,
                        floorPrice,
                        totalSales: sales.length,
                        uniqueOwners: owners.size,
                        averagePrice,
                        highestPrice,
                        lowestPrice,
                        lastSalePrice
                    };
                })
            );

            res.json({
                success: true,
                data: collectionStats
            });
        } catch (error) {
            console.error('Get all collections stats error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Get trending collections based on recent activity
     */
    async getTrendingCollections(req, res) {
        try {
            const { period = '7d', limit = 10 } = req.query;
            
            // Calculate date threshold based on period
            const now = new Date();
            let dateThreshold;
            
            switch(period) {
                case '24h':
                    dateThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }

            // Get recent sales
            const recentSales = await NFTSale.find({
                blockTimestamp: { $gte: dateThreshold }
            }).sort({ blockTimestamp: -1 }).lean();

            // Group by collection and calculate metrics
            const collectionMetrics = {};
            recentSales.forEach(sale => {
                const contractAddress = sale.contractAddress;
                
                if (!collectionMetrics[contractAddress]) {
                    collectionMetrics[contractAddress] = {
                        contractAddress,
                        totalVolume: 0,
                        totalSales: 0,
                        uniqueBuyers: new Set(),
                        floorPrice: Infinity,
                        highestPrice: 0,
                        sales: []
                    };
                }

                const metric = collectionMetrics[contractAddress];
                const price = parseFloat(sale.price);
                
                metric.totalVolume += price;
                metric.totalSales += 1;
                metric.uniqueBuyers.add(sale.buyer);
                metric.floorPrice = Math.min(metric.floorPrice, price);
                metric.highestPrice = Math.max(metric.highestPrice, price);
                metric.sales.push(sale);
            });

            // Convert to array and sort by various metrics
            const trendingCollections = Object.values(collectionMetrics)
                .map(collection => ({
                    ...collection,
                    floorPrice: collection.floorPrice === Infinity ? 0 : collection.floorPrice,
                    uniqueBuyers: collection.uniqueBuyers.size,
                    averagePrice: collection.totalVolume / collection.totalSales
                }))
                .sort((a, b) => b.totalVolume - a.totalVolume) // Sort by total volume
                .slice(0, parseInt(limit)); // Limit results

            res.json({
                success: true,
                data: trendingCollections
            });
        } catch (error) {
            console.error('Get trending collections error:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

export default MarketplaceController;