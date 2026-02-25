import { ethers } from 'ethers';
import logger from '../utils/logger';

// SubscriptionNFT ABI (minimal for validation)
const SUBSCRIPTION_NFT_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'wallet', type: 'address' }],
    name: 'hasActiveSubscription',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'wallet', type: 'address' }],
    name: 'getSubscriptionId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'subscriptionId', type: 'uint256' }],
    name: 'getSubscriptionDetails',
    outputs: [
      { internalType: 'enum SubscriptionNFT.Tier', name: 'organizationTier', type: 'uint8' },
      { internalType: 'uint256', name: 'totalQuota', type: 'uint256' },
      { internalType: 'uint256', name: 'remainingQuota', type: 'uint256' },
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'enum SubscriptionNFT.VerificationStatus', name: 'status', type: 'uint8' },
      { internalType: 'uint256', name: 'purchasePrice', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// FactoryV2 ABI (minimal for minting)
const FACTORY_V2_ABI = [
  {
    inputs: [
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'symbol', type: 'string' },
      { internalType: 'string[]', name: '_URIs', type: 'string[]' },
      { internalType: 'uint256[]', name: '_mintFees', type: 'uint256[]' },
      { internalType: 'uint8', name: 'productClass', type: 'uint8' },
    ],
    name: 'deployWithSubscription',
    outputs: [{ internalType: 'address', name: 'collectionAddress', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

class BlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private subscriptionNFT: ethers.Contract | null = null;
  private factoryV2: ethers.Contract | null = null;
  private signer: ethers.Wallet | null = null;
  private initialized = false;

  private initialize() {
    if (this.initialized) return;

    const rpcUrl = process.env.RPC_URL || 'https://sepolia.base.org';
    const subscriptionNFTAddress = process.env.SUBSCRIPTION_NFT_ADDRESS;
    const factoryV2Address = process.env.FACTORY_V2_ADDRESS;
    const privateKey = process.env.PRIVATE_KEY;

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    if (!subscriptionNFTAddress || !factoryV2Address) {
      logger.warn('Contract addresses not configured - blockchain features disabled');
      return;
    }

    this.subscriptionNFT = new ethers.Contract(
      subscriptionNFTAddress,
      SUBSCRIPTION_NFT_ABI,
      this.provider
    );

    this.factoryV2 = new ethers.Contract(
      factoryV2Address,
      FACTORY_V2_ABI,
      this.provider
    );

    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
    }

    this.initialized = true;
  }

  async validateSubscription(walletAddress: string): Promise<{
    isValid: boolean;
    subscriptionId: string | null;
    organizationTier: number | null;
    remainingQuota: number | null;
    error?: string;
  }> {
    this.initialize();
    
    if (!this.subscriptionNFT) {
      return {
        isValid: false,
        subscriptionId: null,
        organizationTier: null,
        remainingQuota: null,
        error: 'Blockchain service not configured',
      };
    }

    try {
      // Check if wallet has active subscription
      const hasActive = await this.subscriptionNFT.hasActiveSubscription(walletAddress);
      
      if (!hasActive) {
        return {
          isValid: false,
          subscriptionId: null,
          organizationTier: null,
          remainingQuota: null,
          error: 'No active subscription found',
        };
      }

      // Get subscription ID
      const subId = await this.subscriptionNFT.getSubscriptionId(walletAddress);
      
      // Get subscription details
      const details = await this.subscriptionNFT.getSubscriptionDetails(subId);
      
      const organizationTier = Number(details.organizationTier);
      const remainingQuota = Number(details.remainingQuota);
      const status = Number(details.status);

      // Check if subscription is suspended
      if (status === 2) { // SUSPENDED
        return {
          isValid: false,
          subscriptionId: subId.toString(),
          organizationTier,
          remainingQuota,
          error: 'Subscription is suspended',
        };
      }

      // Check if quota is available
      if (remainingQuota <= 0) {
        return {
          isValid: false,
          subscriptionId: subId.toString(),
          organizationTier,
          remainingQuota,
          error: 'No remaining mint quota',
        };
      }

      return {
        isValid: true,
        subscriptionId: subId.toString(),
        organizationTier,
        remainingQuota,
      };
    } catch (error) {
      logger.error('Error validating subscription:', error);
      return {
        isValid: false,
        subscriptionId: null,
        organizationTier: null,
        remainingQuota: null,
        error: 'Blockchain validation failed',
      };
    }
  }

  async validateProductClass(
    walletAddress: string,
    requestedProductClass: number
  ): Promise<{ isValid: boolean; error?: string }> {
    this.initialize();
    
    if (!this.subscriptionNFT) {
      return { isValid: false, error: 'Blockchain service not configured' };
    }

    try {
      const subId = await this.subscriptionNFT.getSubscriptionId(walletAddress);
      const details = await this.subscriptionNFT.getSubscriptionDetails(subId);
      
      const organizationTier = Number(details.organizationTier);

      if (requestedProductClass > organizationTier) {
        return {
          isValid: false,
          error: `Requested product class (${requestedProductClass}) exceeds organization tier (${organizationTier})`,
        };
      }

      return { isValid: true };
    } catch (error) {
      logger.error('Error validating product class:', error);
      return { isValid: false, error: 'Validation failed' };
    }
  }

  async mintCollection(
    name: string,
    symbol: string,
    uris: string[],
    mintFees: string[],
    productClass: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    this.initialize();

    if (!this.signer || !this.factoryV2) {
      return { success: false, error: 'Signer or factory not configured' };
    }

    try {
      const factoryWithSigner = this.factoryV2.connect(this.signer) as ethers.Contract;
      
      const tx = await (factoryWithSigner as any).deployWithSubscription(
        name,
        symbol,
        uris,
        mintFees.map(fee => ethers.parseEther(fee)),
        productClass
      );

      logger.info(`Mint transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt?.hash || tx.hash,
      };
    } catch (error: any) {
      logger.error('Error minting collection:', error);
      return {
        success: false,
        error: error.message || 'Minting failed',
      };
    }
  }
}

export default new BlockchainService();
