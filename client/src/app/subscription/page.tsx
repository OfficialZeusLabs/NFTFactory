"use client";
import TopNavigation from "@/common/navs/top/TopNavigation";
import React, { useState, useEffect } from "react";
import Footer from "@/components/Footer";
import Button from "@/common/Button";
import { useAccount } from "wagmi";
import { toast } from "react-toastify";
import { ClipLoader } from "react-spinners";
import {
  SubscriptionTier,
  hasActiveSubscription,
  getTierPricing,
  mintSubscription,
  getUserSubscription,
  getUSDCAllowance,
  approveUSDC,
} from "@/utils";
import { SubscriptionNFT } from "../../../constants";
import { parseEther } from "viem";

interface TierInfo {
  tier: SubscriptionTier;
  name: string;
  description: string;
  quota: number;
  fee: string;
  color: string;
}

const tierData: TierInfo[] = [
  {
    tier: SubscriptionTier.COAL,
    name: "COAL",
    description: "Entry-level tier for small creators",
    quota: 10,
    fee: "5%",
    color: "#36454F",
  },
  {
    tier: SubscriptionTier.BRONZE,
    name: "BRONZE",
    description: "Perfect for growing NFT projects",
    quota: 50,
    fee: "4.5%",
    color: "#CD7F32",
  },
  {
    tier: SubscriptionTier.SILVER,
    name: "SILVER",
    description: "For established creators",
    quota: 120,
    fee: "4%",
    color: "#C0C0C0",
  },
  {
    tier: SubscriptionTier.GOLD,
    name: "GOLD",
    description: "Premium tier for serious artists",
    quota: 300,
    fee: "3.5%",
    color: "#FFD700",
  },
  {
    tier: SubscriptionTier.PLATINUM,
    name: "PLATINUM",
    description: "Enterprise-level for large collections",
    quota: 1000,
    fee: "3%",
    color: "#E5E4E2",
  },
];

const SubscriptionPage: React.FC = () => {
  const { address: walletAddress } = useAccount();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<bigint | null>(null);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(
    SubscriptionTier.COAL
  );
  const [tierPrices, setTierPrices] = useState<Record<number, bigint>>({});
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    checkSubscriptionStatus();
    loadTierPrices();
  }, [walletAddress]);

  useEffect(() => {
    checkAllowance();
  }, [walletAddress, selectedTier, tierPrices]);

  const checkSubscriptionStatus = async () => {
    if (!walletAddress) {
      setChecking(false);
      return;
    }
    try {
      const hasActive = await hasActiveSubscription(
        walletAddress as `0x${string}`
      );
      setHasSubscription(hasActive);
      if (hasActive) {
        const subId = await getUserSubscription(walletAddress as `0x${string}`);
        setSubscriptionId(subId);
      }
    } catch (err) {
      console.error("Error checking subscription:", err);
    }
    setChecking(false);
  };

  const loadTierPrices = async () => {
    const prices: Record<number, bigint> = {};
    for (let i = 0; i < 5; i++) {
      try {
        const price = await getTierPricing(i as SubscriptionTier);
        if (price) {
          prices[i] = price;
        }
      } catch (err) {
        console.error(`Error loading tier ${i} price:`, err);
      }
    }
    setTierPrices(prices);
  };

  const checkAllowance = async () => {
    if (!walletAddress || !tierPrices[selectedTier]) {
      setNeedsApproval(false);
      return;
    }
    try {
      const allowance = await getUSDCAllowance(
        walletAddress as `0x${string}`,
        SubscriptionNFT.address as `0x${string}`
      );
      const price = tierPrices[selectedTier];
      setNeedsApproval(allowance < price);
    } catch (err) {
      console.error("Error checking allowance:", err);
      setNeedsApproval(true);
    }
  };

  const handleApproveUSDC = async () => {
    if (!walletAddress || !tierPrices[selectedTier]) return;
    
    setApproving(true);
    try {
      const price = tierPrices[selectedTier];
      // Approve a large amount so user doesn't have to approve again
      const approveAmount = price * BigInt(10);
      const hash = await approveUSDC(
        SubscriptionNFT.address as `0x${string}`,
        approveAmount
      );
      toast.success(`USDC approved! Transaction: ${hash}`, {
        theme: "colored",
      });
      setNeedsApproval(false);
    } catch (err: any) {
      console.error("Error approving USDC:", err);
      toast.error(err?.message || "Failed to approve USDC", {
        theme: "colored",
      });
    }
    setApproving(false);
  };

  const handleMintSubscription = async () => {
    if (!walletAddress) {
      toast.error("Please connect your wallet first", { theme: "colored" });
      return;
    }

    setLoading(true);
    try {
      // Note: User needs to approve USDC spending first
      // This is a simplified version - in production, you'd check USDC allowance first
      const hash = await mintSubscription(selectedTier);
      toast.success(`Subscription minted! Transaction: ${hash}`, {
        theme: "colored",
      });
      await checkSubscriptionStatus();
    } catch (err: any) {
      console.error("Error minting subscription:", err);
      toast.error(
        err?.message || "Failed to mint subscription. Make sure you have enough USDC and have approved the spending.",
        { theme: "colored" }
      );
    }
    setLoading(false);
  };

  const formatUSDC = (amount: bigint | undefined) => {
    if (!amount) return "Loading...";
    return `${(Number(amount) / 1_000_000).toFixed(2)} USDC`;
  };

  if (checking) {
    return (
      <>
        <TopNavigation />
        <div className="flex flex-col justify-center items-center min-h-screen text-white bg-[#0d0d0d]">
          <ClipLoader color="#fff" size={50} />
          <p className="mt-4">Checking subscription status...</p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <TopNavigation />
      <div className="min-h-screen bg-[#0d0d0d] text-white py-10">
        <div className="mx-auto w-[97%] tablet_l:w-[94%] laptop_l:w-[89%] max-w-[1280px]">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              NFT Factory Subscriptions
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Get a subscription NFT to unlock collection creation on the
              launchpad. Each tier offers different minting quotas and
              marketplace fees.
            </p>
          </div>

          {/* Current Subscription Status */}
          {hasSubscription && (
            <div className="bg-gradient-to-r from-green-900/50 to-green-700/50 border border-green-500 rounded-xl p-6 mb-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-green-400">
                    ✅ Active Subscription Detected
                  </h2>
                  <p className="text-gray-300 mt-1">
                    Subscription ID: {subscriptionId?.toString()}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    You can now create NFT collections on the launchpad!
                  </p>
                </div>
                <Button
                  handleClick={() => (window.location.href = "/launchpad/apply")}
                  className="bg-gradient-linear px-8 py-3"
                >
                  Go to Launchpad
                </Button>
              </div>
            </div>
          )}

          {/* Subscription Tiers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {tierData.map((tier) => (
              <div
                key={tier.tier}
                onClick={() => setSelectedTier(tier.tier)}
                className={`relative rounded-xl p-6 cursor-pointer transition-all duration-300 ${
                  selectedTier === tier.tier
                    ? "ring-4 ring-blue-500 scale-105"
                    : "hover:scale-102"
                }`}
                style={{
                  background: `linear-gradient(135deg, ${tier.color}20 0%, #1a1a1a 100%)`,
                  border: `2px solid ${
                    selectedTier === tier.tier ? tier.color : "#333"
                  }`,
                }}
              >
                {/* Tier Badge */}
                <div
                  className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full text-sm font-bold"
                  style={{ backgroundColor: tier.color, color: "#000" }}
                >
                  {tier.name}
                </div>

                <div className="mt-4 text-center">
                  {/* Price */}
                  <div className="text-3xl font-bold mb-2">
                    {formatUSDC(tierPrices[tier.tier])}
                  </div>

                  {/* Description */}
                  <p className="text-gray-400 text-sm mb-4">
                    {tier.description}
                  </p>

                  {/* Features */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mint Quota:</span>
                      <span className="font-semibold">{tier.quota} NFTs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Marketplace Fee:</span>
                      <span className="font-semibold">{tier.fee}</span>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  {selectedTier === tier.tier && (
                    <div className="mt-4 text-blue-400 text-sm font-semibold">
                      Selected ✓
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Mint Button */}
          {!hasSubscription && (
            <div className="mt-12 text-center">
              <div className="bg-gray-900/50 rounded-xl p-6 max-w-2xl mx-auto mb-6">
                <h3 className="text-xl font-semibold mb-2">
                  Selected: {tierData[selectedTier].name} Tier
                </h3>
                <p className="text-gray-400">
                  Price: {formatUSDC(tierPrices[selectedTier])}
                </p>
                {needsApproval ? (
                  <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400 text-sm">
                      ⚠️ USDC approval required before minting
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-green-400 mt-2">
                    ✓ USDC approved and ready to mint
                  </p>
                )}
              </div>

              {/* Show Approve button if needed, otherwise show Mint button */}
              {needsApproval ? (
                <Button
                  handleClick={handleApproveUSDC}
                  className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 px-12 py-4 text-lg"
                >
                  {approving ? (
                    <ClipLoader color="#fff" size={20} />
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Approve USDC Spending
                    </span>
                  )}
                </Button>
              ) : (
                <Button
                  handleClick={handleMintSubscription}
                  className="bg-gradient-linear px-12 py-4 text-lg"
                >
                  {loading ? (
                    <ClipLoader color="#fff" size={20} />
                  ) : (
                    "Mint Subscription NFT"
                  )}
                </Button>
              )}

              <p className="text-gray-500 text-sm mt-4 max-w-xl mx-auto">
                Note: Make sure you have enough USDC (Base Sepolia) in your
                wallet. The subscription NFT is soulbound and cannot be
                transferred.
              </p>
            </div>
          )}

          {/* How it Works */}
          <div className="mt-16 border-t border-gray-800 pt-10">
            <h2 className="text-2xl font-bold text-center mb-8">
              How Subscriptions Work
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  1
                </div>
                <h3 className="font-semibold mb-2">Choose a Tier</h3>
                <p className="text-gray-400 text-sm">
                  Select a subscription tier based on how many NFTs you plan to
                  mint
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  2
                </div>
                <h3 className="font-semibold mb-2">Mint with USDC</h3>
                <p className="text-gray-400 text-sm">
                  Pay with USDC on Base Sepolia to mint your subscription NFT
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  3
                </div>
                <h3 className="font-semibold mb-2">Create Collections</h3>
                <p className="text-gray-400 text-sm">
                  Use your subscription to deploy NFT collections on the
                  launchpad
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default SubscriptionPage;
