import { readContract as readContractData, writeContract, prepareWriteContract } from "@wagmi/core";
import Factory from "../../constants/Factory.json";
import SimpleCollectible from "../../constants/SimpleCollectible.json";
import SubscriptionNFT from "../../constants/SubscriptionNFT.json";
import Marketplace from "../../constants/Marketplace.json";

// Base Sepolia Chain ID
const BASE_SEPOLIA_CHAIN_ID = 84532;

// Tier enum mapping
export enum SubscriptionTier {
  COAL = 0,
  BRONZE = 1,
  SILVER = 2,
  GOLD = 3,
  PLATINUM = 4,
}

// Factory Contract Read Functions
export const readFactoryContract = async (
  functionName: string,
  args: any[] = []
) => {
  if (!Factory.address) {
    throw new Error("Factory address not configured. Please deploy contracts first.");
  }
  
  const data = await readContractData({
    address: Factory.address as `0x${string}`,
    abi: Factory.abi,
    functionName,
    args,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  return data;
};

// Factory Contract Write Functions - Legacy deploy (without subscription)
export const deployCollection = async (
  name: string,
  symbol: string,
  uris: string[],
  mintFees: bigint[]
) => {
  if (!Factory.address) {
    throw new Error("Factory address not configured. Please deploy contracts first.");
  }

  const { request } = await prepareWriteContract({
    address: Factory.address as `0x${string}`,
    abi: Factory.abi,
    functionName: "deploy",
    args: [name, symbol, uris, mintFees],
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  const hash = await writeContract(request);
  return hash;
};

// FactoryV2 Contract Write Functions - Deploy with subscription
export const deployCollectionWithSubscription = async (
  name: string,
  symbol: string,
  uris: string[],
  mintFees: bigint[],
  productClass: SubscriptionTier
) => {
  if (!Factory.address) {
    throw new Error("Factory address not configured. Please deploy contracts first.");
  }

  const { request } = await prepareWriteContract({
    address: Factory.address as `0x${string}`,
    abi: Factory.abi,
    functionName: "deployWithSubscription",
    args: [name, symbol, uris, mintFees, productClass],
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  const hash = await writeContract(request);
  return hash;
};

// SimpleCollectible Contract Read Functions
export const readSimpleCollectibleContract = async (
  address: `0x${string}`,
  functionName: string,
  args: any[] = []
) => {
  try {
    const data = await readContractData({
      address,
      abi: SimpleCollectible.abi,
      functionName,
      args,
      chainId: BASE_SEPOLIA_CHAIN_ID,
    });

    return functionName === "name" ? String(data).split(",")[0] : data;
  } catch (err) {
    console.error("Error reading contract:", err);
    return null;
  }
};

// SimpleCollectible Contract Write Functions
export const mintNFT = async (
  collectionAddress: `0x${string}`,
  uriIndex: number,
  value: bigint
) => {
  const { request } = await prepareWriteContract({
    address: collectionAddress,
    abi: SimpleCollectible.abi,
    functionName: "createCollectible",
    args: [collectionAddress, uriIndex],
    value,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  const hash = await writeContract(request);
  return hash;
};

// Helper Functions
export const getAllCollections = async () => {
  try {
    const collections = await readFactoryContract("getMarketPlaces");
    return collections as `0x${string}`[];
  } catch (err) {
    console.error("Error fetching collections:", err);
    return [];
  }
};

export const getCollectionDetails = async (collectionAddress: `0x${string}`) => {
  try {
    const [name, symbol, totalSupply] = await Promise.all([
      readSimpleCollectibleContract(collectionAddress, "name"),
      readSimpleCollectibleContract(collectionAddress, "symbol"),
      readSimpleCollectibleContract(collectionAddress, "totalSupply"),
    ]);

    return { name, symbol, totalSupply, address: collectionAddress };
  } catch (err) {
    console.error("Error fetching collection details:", err);
    return null;
  }
};

export const getUserNFTs = async (
  collectionAddress: `0x${string}`,
  userAddress: `0x${string}`
) => {
  try {
    const tokenIds = await readSimpleCollectibleContract(
      collectionAddress,
      "getTokenData",
      [userAddress]
    );
    return tokenIds as bigint[];
  } catch (err) {
    console.error("Error fetching user NFTs:", err);
    return [];
  }
};

export const getNFTMetadata = async (
  collectionAddress: `0x${string}`,
  tokenId: bigint
) => {
  try {
    const tokenURI = await readSimpleCollectibleContract(
      collectionAddress,
      "tokenURI",
      [tokenId]
    );
    return tokenURI as string;
  } catch (err) {
    console.error("Error fetching NFT metadata:", err);
    return null;
  }
};

// ============ SubscriptionNFT Contract Functions ============

export const readSubscriptionNFTContract = async (
  functionName: string,
  args: any[] = []
) => {
  if (!SubscriptionNFT.address) {
    throw new Error("SubscriptionNFT address not configured.");
  }

  const data = await readContractData({
    address: SubscriptionNFT.address as `0x${string}`,
    abi: SubscriptionNFT.abi,
    functionName,
    args,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  return data;
};

export const mintSubscription = async (tier: SubscriptionTier) => {
  if (!SubscriptionNFT.address) {
    throw new Error("SubscriptionNFT address not configured.");
  }

  const { request } = await prepareWriteContract({
    address: SubscriptionNFT.address as `0x${string}`,
    abi: SubscriptionNFT.abi,
    functionName: "mintSubscription",
    args: [tier],
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  const hash = await writeContract(request);
  return hash;
};

export const getUserSubscription = async (walletAddress: `0x${string}`) => {
  try {
    const result = await readSubscriptionNFTContract("getSubscriptionId", [walletAddress]);
    const subscriptionId = (result as unknown[])[0];
    return BigInt(subscriptionId as string);
  } catch (err) {
    console.error("Error fetching user subscription:", err);
    return null;
  }
};

export const hasActiveSubscription = async (walletAddress: `0x${string}`) => {
  try {
    const result = await readSubscriptionNFTContract("hasActiveSubscription", [walletAddress]);
    // Handle both array and direct boolean return
    if (Array.isArray(result)) {
      return Boolean(result[0]);
    }
    return Boolean(result);
  } catch (err) {
    console.error("Error checking subscription status:", err);
    return false;
  }
};

export const getSubscriptionDetails = async (walletAddress: `0x${string}`) => {
  try {
    // Get subscription ID
    const subIdResult = await readSubscriptionNFTContract("getSubscriptionId", [walletAddress]);
    const subscriptionId = Array.isArray(subIdResult) ? subIdResult[0] : subIdResult;
    
    if (!subscriptionId || subscriptionId === "0") {
      return null;
    }

    // Get subscription info
    const infoResult = await readSubscriptionNFTContract("getSubscriptionInfo", [subscriptionId]);
    const info = Array.isArray(infoResult) ? infoResult[0] : infoResult;

    // Get tier name
    const tierNames = ["COAL", "BRONZE", "SILVER", "GOLD", "PLATINUM"];
    const tier = Number(info.tier || 0);
    const tierName = tierNames[tier] || "UNKNOWN";

    // Get verification status
    const statusNames = ["VERIFIED", "UNDER_REVIEW", "SUSPENDED"];
    const verificationStatus = Number(info.verificationStatus || 0);
    const statusName = statusNames[verificationStatus] || "UNKNOWN";

    return {
      subscriptionId: String(subscriptionId),
      tier,
      tierName,
      totalMintQuota: Number(info.totalMintQuota || 0),
      remainingMintQuota: Number(info.remainingMintQuota || 0),
      verificationStatus: statusName,
      isActive: Boolean(info.isActive || false),
      createdAt: info.createdAt ? new Date(Number(info.createdAt) * 1000).toISOString() : null,
    };
  } catch (err) {
    console.error("Error fetching subscription details:", err);
    return null;
  }
};

export const getTierPricing = async (tier: SubscriptionTier) => {
  try {
    const result = await readSubscriptionNFTContract("tierPrices", [tier]);
    // Handle both array and direct return
    const price = Array.isArray(result) ? result[0] : result;
    return price ? BigInt(price as string) : null;
  } catch (err) {
    console.error("Error fetching tier pricing:", err);
    return null;
  }
};

// Get USDC token address from SubscriptionNFT contract
export const getUSDCAddress = async () => {
  try {
    const result = await readSubscriptionNFTContract("usdcToken");
    return Array.isArray(result) ? result[0] : result;
  } catch (err) {
    console.error("Error fetching USDC address:", err);
    // Base Sepolia USDC address (default)
    return "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  }
};

// Check USDC allowance
export const getUSDCAllowance = async (
  owner: `0x${string}`,
  spender: `0x${string}`
) => {
  try {
    const usdcAddress = await getUSDCAddress();
    const result = await readContractData({
      address: usdcAddress as `0x${string}`,
      abi: [
        {
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
          ],
          name: "allowance",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "allowance",
      args: [owner, spender],
      chainId: BASE_SEPOLIA_CHAIN_ID,
    });
    return BigInt((result as unknown[])[0] as string);
  } catch (err) {
    console.error("Error fetching USDC allowance:", err);
    return BigInt(0);
  }
};

// Get NFTs owned by a user across all collections
export const getAllUserNFTs = async (userAddress: `0x${string}`) => {
  try {
    // Get all collections from factory
    const result = await readFactoryContract("getMarketPlaces");
    const collections = Array.isArray(result) ? result : [];
    const userNFTs: any[] = [];
    
    for (const collectionAddress of collections) {
      try {
        const addr = collectionAddress as `0x${string}`;
        // Get collection name
        const nameResult = await readSimpleCollectibleContract(addr, "name");
        const collectionName = Array.isArray(nameResult) ? nameResult[0] : nameResult;
        
        // Get balance of user in this collection
        const balanceResult = await readSimpleCollectibleContract(addr, "balanceOf", [userAddress]);
        const balance = Array.isArray(balanceResult) ? Number(balanceResult[0]) : Number(balanceResult);
        
        if (balance > 0) {
          // Get token IDs owned by user
          for (let i = 0; i < balance; i++) {
            try {
              const tokenIdResult = await readSimpleCollectibleContract(
                addr, 
                "tokenOfOwnerByIndex", 
                [userAddress, i]
              );
              const tokenId = Array.isArray(tokenIdResult) ? tokenIdResult[0] : tokenIdResult;
              
              // Get token URI
              const tokenURIResult = await readSimpleCollectibleContract(
                addr,
                "tokenURI",
                [tokenId]
              );
              const tokenURI = Array.isArray(tokenURIResult) ? tokenURIResult[0] : tokenURIResult;
              
              userNFTs.push({
                collectionAddress: addr,
                collectionName,
                tokenId: String(tokenId),
                tokenURI,
              });
            } catch (e) {
              console.error(`Error fetching token ${i} from ${collectionAddress}:`, e);
            }
          }
        }
      } catch (e) {
        console.error(`Error reading collection ${collectionAddress}:`, e);
      }
    }
    
    return userNFTs;
  } catch (err) {
    console.error("Error fetching user NFTs:", err);
    return [];
  }
};

// Approve USDC spending
export const approveUSDC = async (
  spender: `0x${string}`,
  amount: bigint
) => {
  try {
    const usdcAddress = await getUSDCAddress();
    const { request } = await prepareWriteContract({
      address: usdcAddress as `0x${string}`,
      abi: [
        {
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          name: "approve",
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      functionName: "approve",
      args: [spender, amount],
      chainId: BASE_SEPOLIA_CHAIN_ID,
    });

    const hash = await writeContract(request);
    return hash;
  } catch (err) {
    console.error("Error approving USDC:", err);
    throw err;
  }
};

// ============ Marketplace Contract Functions ============

export const readMarketplaceContract = async (
  functionName: string,
  args: any[] = []
) => {
  if (!Marketplace.address) {
    throw new Error("Marketplace address not configured.");
  }

  const data = await readContractData({
    address: Marketplace.address as `0x${string}`,
    abi: Marketplace.abi,
    functionName,
    args,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  return data;
};

export const listNFT = async (
  tokenContract: `0x${string}`,
  tokenId: bigint,
  price: bigint
) => {
  if (!Marketplace.address) {
    throw new Error("Marketplace address not configured.");
  }

  const { request } = await prepareWriteContract({
    address: Marketplace.address as `0x${string}`,
    abi: Marketplace.abi,
    functionName: "list",
    args: [tokenContract, tokenId, price],
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  const hash = await writeContract(request);
  return hash;
};

export const buyNFT = async (
  tokenContract: `0x${string}`,
  tokenId: bigint,
  value: bigint
) => {
  if (!Marketplace.address) {
    throw new Error("Marketplace address not configured.");
  }

  const { request } = await prepareWriteContract({
    address: Marketplace.address as `0x${string}`,
    abi: Marketplace.abi,
    functionName: "buy",
    args: [tokenContract, tokenId],
    value,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  });

  const hash = await writeContract(request);
  return hash;
};
