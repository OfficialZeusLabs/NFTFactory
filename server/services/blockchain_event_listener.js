import { ethers } from 'ethers';
import NFTSale from '../models/nft_sale_model.js';
import Redemption from '../models/redemption_model.js';
import BusinessProfile from '../models/business_profile_model.js';
import AdminLog from '../models/admin_log_model.js';
import EmailService from './email_service.js';

/**
 * Blockchain Event Listener Service
 * Listens to blockchain events and updates database accordingly
 */
class BlockchainEventListener {
    constructor() {
        this.provider = null;
        this.contracts = {};
        this.isRunning = false;
        this.eventFilters = [];
    }

    /**
     * Initialize the listener with provider and contract addresses
     */
    async initialize(config) {
        // Initialize provider (Alchemy/Infura for Base Sepolia)
        this.provider = new ethers.providers.JsonRpcProvider(
            config.rpcUrl || process.env.ALCHEMY_BASE_SEPOLIA_RPC
        );

        // Initialize contract instances
        this.contracts = {
            factory: new ethers.Contract(
                config.factoryAddress,
                config.factoryAbi,
                this.provider
            ),
            marketplace: new ethers.Contract(
                config.marketplaceAddress,
                config.marketplaceAbi,
                this.provider
            ),
            subscriptionNFT: new ethers.Contract(
                config.subscriptionNFTAddress,
                config.subscriptionNFTAbi,
                this.provider
            )
        };

        console.log('Blockchain Event Listener initialized');
    }

    /**
     * Start listening to events
     */
    async start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log('Starting blockchain event listener...');

        // Listen to Factory events
        this.setupFactoryListeners();
        
        // Listen to Marketplace events
        this.setupMarketplaceListeners();
        
        // Listen to SubscriptionNFT events
        this.setupSubscriptionListeners();

        // Process past events (catch up)
        await this.processPastEvents();
    }

    /**
     * Stop listening to events
     */
    stop() {
        this.isRunning = false;
        // Remove all listeners
        Object.values(this.contracts).forEach(contract => {
            contract.removeAllListeners();
        });
        console.log('Blockchain event listener stopped');
    }

    /**
     * Setup Factory contract event listeners
     */
    setupFactoryListeners() {
        const factory = this.contracts.factory;

        // CollectionDeployed event
        factory.on('CollectionDeployed', async (collectionAddress, owner, name, symbol, organizationTier, productClass, event) => {
            console.log('CollectionDeployed:', { collectionAddress, owner, name });
            
            // Update business profile
            await BusinessProfile.updateOne(
                { walletAddress: owner.toLowerCase() },
                { 
                    $inc: { 'stats.totalMints': 1 },
                    $set: { updatedAt: new Date() }
                }
            );

            // Log admin action
            await AdminLog.create({
                logId: `deploy_${event.transactionHash}`,
                adminId: 'system',
                actionType: 'SYSTEM_MINT_TRIGGERED',
                message: `Collection deployed: ${name} at ${collectionAddress}`,
                metadata: {
                    collectionAddress,
                    owner,
                    organizationTier: organizationTier.toString(),
                    productClass: productClass.toString()
                },
                timestamp: new Date()
            });
        });

        // QuotaConsumed event
        factory.on('QuotaConsumed', async (subscriptionId, amount, remaining, event) => {
            console.log('QuotaConsumed:', { subscriptionId: subscriptionId.toString(), amount: amount.toString() });
        });
    }

    /**
     * Setup Marketplace contract event listeners
     */
    setupMarketplaceListeners() {
        const marketplace = this.contracts.marketplace;

        // ItemListed event
        marketplace.on('ItemListed', async (listingId, tokenContract, tokenId, seller, price, event) => {
            console.log('ItemListed:', { listingId: listingId.toString(), seller, price: price.toString() });
        });

        // ItemSold event - Primary sales tracking
        marketplace.on('ItemSold', async (listingId, tokenContract, tokenId, seller, buyer, price, event) => {
            console.log('ItemSold:', { listingId: listingId.toString(), seller, buyer, price: price.toString() });
            
            try {
                // Record the sale
                const sale = new NFTSale({
                    saleId: `sale_${event.transactionHash}_${listingId}`,
                    tokenId: tokenId.toString(),
                    contractAddress: tokenContract.toLowerCase(),
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    blockTimestamp: new Date(),
                    price: ethers.utils.formatEther(price),
                    priceInWei: price.toString(),
                    currency: 'ETH',
                    seller: seller.toLowerCase(),
                    buyer: buyer.toLowerCase(),
                    saleType: 'PRIMARY',
                    marketplaceFee: '0', // Calculate if needed
                    royaltyFee: '0',
                    sellerProceeds: ethers.utils.formatEther(price),
                    isVerified: false
                });

                await sale.save();

                // Update business profile stats
                await BusinessProfile.updateOne(
                    { walletAddress: seller.toLowerCase() },
                    {
                        $inc: {
                            'stats.totalSales': 1,
                            'stats.totalRevenue': parseFloat(ethers.utils.formatEther(price))
                        }
                    }
                );

                // Send email notification
                const sellerProfile = await BusinessProfile.findOne({ walletAddress: seller.toLowerCase() });
                if (sellerProfile?.email) {
                    await EmailService.sendNFTSoldEmail(sellerProfile.email, {
                        tokenId: tokenId.toString(),
                        price: ethers.utils.formatEther(price),
                        currency: 'ETH'
                    });
                }

            } catch (error) {
                console.error('Error processing ItemSold event:', error);
            }
        });

        // ItemCancelled event
        marketplace.on('ItemCancelled', async (listingId, event) => {
            console.log('ItemCancelled:', { listingId: listingId.toString() });
        });

        // RedemptionRequested event
        marketplace.on('RedemptionRequested', async (redemptionId, tokenContract, tokenId, buyer, event) => {
            console.log('RedemptionRequested:', { redemptionId: redemptionId.toString(), buyer });
            
            try {
                // Get token owner (seller)
                const tokenContractInstance = new ethers.Contract(
                    tokenContract,
                    ['function ownerOf(uint256) view returns (address)'],
                    this.provider
                );
                const seller = await tokenContractInstance.ownerOf(tokenId);

                // Create redemption record
                const redemption = new Redemption({
                    redemptionId: redemptionId.toString(),
                    tokenId: tokenId.toString(),
                    contractAddress: tokenContract.toLowerCase(),
                    buyerWallet: buyer.toLowerCase(),
                    sellerWallet: seller.toLowerCase(),
                    status: 'PENDING',
                    requestDate: new Date(),
                    responseDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                    events: [{
                        eventType: 'REQUESTED',
                        timestamp: new Date(),
                        data: { txHash: event.transactionHash }
                    }]
                });

                await redemption.save();

                // Send email to seller
                const sellerProfile = await BusinessProfile.findOne({ walletAddress: seller.toLowerCase() });
                if (sellerProfile?.email) {
                    await EmailService.sendRedemptionRequestedEmail(sellerProfile.email, {
                        redemptionId: redemptionId.toString(),
                        tokenId: tokenId.toString()
                    });
                }

            } catch (error) {
                console.error('Error processing RedemptionRequested event:', error);
            }
        });

        // RedemptionResponded event
        marketplace.on('RedemptionResponded', async (redemptionId, accepted, event) => {
            console.log('RedemptionResponded:', { redemptionId: redemptionId.toString(), accepted });
            
            try {
                const status = accepted ? 'ACCEPTED' : 'DECLINED';
                
                await Redemption.updateOne(
                    { redemptionId: redemptionId.toString() },
                    {
                        $set: { 
                            status,
                            sellerResponseDate: new Date()
                        },
                        $push: {
                            events: {
                                eventType: accepted ? 'ACCEPTED' : 'DECLINED',
                                timestamp: new Date(),
                                data: { txHash: event.transactionHash }
                            }
                        }
                    }
                );

                // Send email to buyer
                const redemption = await Redemption.findOne({ redemptionId: redemptionId.toString() });
                if (redemption) {
                    // Get buyer email from profile or use notification service
                }

            } catch (error) {
                console.error('Error processing RedemptionResponded event:', error);
            }
        });

        // RedemptionCompleted event
        marketplace.on('RedemptionCompleted', async (redemptionId, event) => {
            console.log('RedemptionCompleted:', { redemptionId: redemptionId.toString() });
            
            try {
                await Redemption.updateOne(
                    { redemptionId: redemptionId.toString() },
                    {
                        $set: { 
                            status: 'COMPLETED',
                            completionDate: new Date()
                        },
                        $push: {
                            events: {
                                eventType: 'COMPLETED',
                                timestamp: new Date(),
                                data: { txHash: event.transactionHash }
                            }
                        }
                    }
                );

                // Update business redemption stats
                const redemption = await Redemption.findOne({ redemptionId: redemptionId.toString() });
                if (redemption) {
                    await BusinessProfile.updateOne(
                        { walletAddress: redemption.sellerWallet },
                        { $inc: { 'stats.completedRedemptions': 1 } }
                    );
                }

            } catch (error) {
                console.error('Error processing RedemptionCompleted event:', error);
            }
        });
    }

    /**
     * Setup SubscriptionNFT event listeners
     */
    setupSubscriptionListeners() {
        const subscriptionNFT = this.contracts.subscriptionNFT;

        // SubscriptionMinted event
        subscriptionNFT.on('SubscriptionMinted', async (tokenId, owner, tier, event) => {
            console.log('SubscriptionMinted:', { tokenId: tokenId.toString(), owner, tier: tier.toString() });
            
            // Update or create business profile
            await BusinessProfile.updateOne(
                { walletAddress: owner.toLowerCase() },
                {
                    $set: {
                        subscriptionId: tokenId.toString(),
                        organizationTier: this.getTierName(tier),
                        subscriptionStatus: 'ACTIVE',
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
        });

        // VerificationStatusUpdated event
        subscriptionNFT.on('VerificationStatusUpdated', async (tokenId, newStatus, event) => {
            console.log('VerificationStatusUpdated:', { tokenId: tokenId.toString(), newStatus: newStatus.toString() });
        });

        // SubscriptionSuspended event
        subscriptionNFT.on('SubscriptionSuspended', async (tokenId, event) => {
            console.log('SubscriptionSuspended:', { tokenId: tokenId.toString() });
        });
    }

    /**
     * Process past events to catch up
     */
    async processPastEvents() {
        const currentBlock = await this.provider.getBlockNumber();
        const fromBlock = currentBlock - 10000; // Look back ~10k blocks

        console.log(`Processing past events from block ${fromBlock} to ${currentBlock}`);

        // Process Factory events
        const factoryEvents = await this.contracts.factory.queryFilter('*', fromBlock, currentBlock);
        console.log(`Found ${factoryEvents.length} Factory events to process`);

        // Process Marketplace events
        const marketplaceEvents = await this.contracts.marketplace.queryFilter('*', fromBlock, currentBlock);
        console.log(`Found ${marketplaceEvents.length} Marketplace events to process`);

        // Note: In production, you'd process these events in batches
        // For now, we just log them
    }

    /**
     * Get tier name from enum value
     */
    getTierName(tierValue) {
        const tiers = ['COAL', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
        return tiers[tierValue] || 'UNKNOWN';
    }

    /**
     * Get health status of the listener
     */
    getHealth() {
        return {
            isRunning: this.isRunning,
            providerConnected: this.provider ? true : false,
            contractsInitialized: Object.keys(this.contracts).length,
            lastChecked: new Date()
        };
    }
}

// Export singleton instance
export default new BlockchainEventListener();
