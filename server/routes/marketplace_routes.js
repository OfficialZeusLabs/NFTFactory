import express from 'express';
import MarketplaceController from '../controller/marketplace_controller.js';

const router = express.Router();
const controller = new MarketplaceController();

// Marketplace Analytics Routes
router.get('/collections/:contractAddress/stats', controller.getCollectionStats.bind(controller));
router.get('/collections/stats', controller.getAllCollectionsStats.bind(controller));
router.get('/trending', controller.getTrendingCollections.bind(controller));

export default router;