"use client";

import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import TopNavigation from "@/common/navs/top/TopNavigation";
import Footer from "@/components/Footer";
import Link from "next/link";

interface NFTCollection {
  contractAddress: string;
  name: string;
  symbol: string;
  totalSupply: number;
  organizationTier: string;
  productClass: string;
  verificationStatus: string;
  createdAt: string;
  metadata: {
    image: string;
    description: string;
  };
}

interface NFTItem {
  tokenId: string;
  tokenURI: string;
  metadata: {
    name: string;
    image: string;
    attributes: Array<{ trait_type: string; value: string }>;
  };
  mintDate: string;
  salePrice?: string;
  redemptionStatus?: string;
  isBurned: boolean;
}

const CollectionsDashboard = () => {
  const { address, isConnected } = useAccount();
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<NFTCollection | null>(null);
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCollections: 0,
    totalNFTs: 0,
    totalRevenue: "0",
    totalRedemptions: 0,
  });

  useEffect(() => {
    if (isConnected && address) {
      fetchCollections();
    }
  }, [address, isConnected]);

  const fetchCollections = async () => {
    try {
      const response = await fetch(`/api/dashboard/${address}/collections`);
      const data = await response.json();
      if (data.success) {
        setCollections(data.data.collections);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error("Error fetching collections:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollectionNFTs = async (contractAddress: string) => {
    try {
      const response = await fetch(`/api/dashboard/collections/${contractAddress}/nfts?owner=${address}`);
      const data = await response.json();
      if (data.success) {
        setNfts(data.data);
      }
    } catch (error) {
      console.error("Error fetching NFTs:", error);
    }
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      COAL: "bg-gray-600",
      BRONZE: "bg-amber-600",
      SILVER: "bg-slate-400",
      GOLD: "bg-yellow-500",
      PLATINUM: "bg-indigo-400",
    };
    return colors[tier] || "bg-gray-500";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      VERIFIED: "bg-green-100 text-green-800",
      UNDER_REVIEW: "bg-yellow-100 text-yellow-800",
      SUSPENDED: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavigation />
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">My Collections</h1>
          <p className="text-gray-600">Please connect your wallet to view your collections</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Collections</h1>
            <p className="text-gray-600">View and manage your minted NFT collections</p>
          </div>
          <Link
            href="/dashboard/submit"
            className="mt-4 md:mt-0 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            + Mint New Collection
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Collections</p>
            <p className="text-2xl font-bold">{stats.totalCollections}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total NFTs</p>
            <p className="text-2xl font-bold">{stats.totalNFTs}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold">{parseFloat(stats.totalRevenue).toFixed(4)} ETH</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Redemptions</p>
            <p className="text-2xl font-bold">{stats.totalRedemptions}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading collections...</p>
          </div>
        ) : (
          <>
            {!selectedCollection ? (
              /* Collections Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {collections.length === 0 ? (
                  <div className="col-span-full bg-white rounded-lg shadow p-12 text-center">
                    <p className="text-gray-500 mb-4">No collections found</p>
                    <Link
                      href="/dashboard/submit"
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Create your first collection →
                    </Link>
                  </div>
                ) : (
                  collections.map((collection) => (
                    <div
                      key={collection.contractAddress}
                      className="bg-white rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => {
                        setSelectedCollection(collection);
                        fetchCollectionNFTs(collection.contractAddress);
                      }}
                    >
                      <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        {collection.metadata?.image ? (
                          <img
                            src={collection.metadata.image}
                            alt={collection.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-6xl">🎨</span>
                        )}
                      </div>
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-semibold">{collection.name}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${getTierColor(collection.organizationTier)}`}>
                            {collection.organizationTier}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">{collection.symbol}</p>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Supply: {collection.totalSupply}</span>
                          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(collection.verificationStatus)}`}>
                            {collection.verificationStatus.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="mt-4 pt-4 border-t">
                          <span className="text-xs text-gray-500">
                            Class: {collection.productClass}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Collection Detail View */
              <div>
                <button
                  onClick={() => {
                    setSelectedCollection(null);
                    setNfts([]);
                  }}
                  className="mb-6 text-blue-600 hover:text-blue-800 font-medium"
                >
                  ← Back to Collections
                </button>

                <div className="bg-white rounded-lg shadow p-6 mb-8">
                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <span className="text-4xl">🎨</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold">{selectedCollection.name}</h2>
                        <span className={`px-3 py-1 rounded text-sm font-semibold text-white ${getTierColor(selectedCollection.organizationTier)}`}>
                          {selectedCollection.organizationTier}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-2">{selectedCollection.symbol}</p>
                      <p className="text-sm text-gray-500">
                        Contract: {selectedCollection.contractAddress}
                      </p>
                    </div>
                  </div>
                </div>

                {/* NFTs Grid */}
                <h3 className="text-xl font-semibold mb-4">NFTs in Collection</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {nfts.map((nft) => (
                    <div key={nft.tokenId} className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="aspect-square bg-gray-100 flex items-center justify-center">
                        {nft.metadata?.image ? (
                          <img
                            src={nft.metadata.image}
                            alt={nft.metadata.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-4xl">🖼️</span>
                        )}
                      </div>
                      <div className="p-4">
                        <h4 className="font-medium mb-1">{nft.metadata?.name || `Token #${nft.tokenId}`}</h4>
                        <p className="text-sm text-gray-500">ID: {nft.tokenId}</p>
                        {nft.salePrice && (
                          <p className="text-sm text-green-600 mt-1">
                            Sold for {nft.salePrice} ETH
                          </p>
                        )}
                        {nft.isBurned && (
                          <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                            Redeemed & Burned
                          </span>
                        )}
                        {nft.redemptionStatus && !nft.isBurned && (
                          <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                            {nft.redemptionStatus.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default CollectionsDashboard;
