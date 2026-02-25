"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useAccount } from "wagmi";
import { useSearchParams } from "next/navigation";
import TopNavigation from "@/common/navs/top/TopNavigation";
import Footer from "@/components/Footer";
import { getUserNFTs, getNFTMetadata, getAllCollections } from "@/utils";

interface NFT {
  tokenId: bigint;
  tokenURI: string;
  collectionAddress: `0x${string}`;
}

const MyNFTsContent = () => {
  const { address, isConnected } = useAccount();
  const searchParams = useSearchParams();
  const collectionFilter = searchParams.get("collection");
  
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [collections, setCollections] = useState<`0x${string}`[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isConnected && address) {
      fetchUserNFTs();
    }
  }, [address, isConnected, collectionFilter]);

  const fetchUserNFTs = async () => {
    try {
      setLoading(true);
      
      // Get all collections or use filtered one
      let collectionAddresses: `0x${string}`[] = [];
      if (collectionFilter) {
        collectionAddresses = [collectionFilter as `0x${string}`];
      } else {
        collectionAddresses = await getAllCollections();
      }
      
      setCollections(collectionAddresses);

      // Fetch NFTs from each collection
      const allNfts: NFT[] = [];
      for (const collectionAddress of collectionAddresses) {
        const tokenIds = await getUserNFTs(collectionAddress, address as `0x${string}`);
        
        for (const tokenId of tokenIds) {
          const tokenURI = await getNFTMetadata(collectionAddress, tokenId);
          allNfts.push({
            tokenId,
            tokenURI: tokenURI || "",
            collectionAddress,
          });
        }
      }

      setNfts(allNfts);
    } catch (error) {
      console.error("Error fetching NFTs:", error);
    } finally {
      setLoading(false);
    }
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation />

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My NFTs</h1>

        {!isConnected && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-6">
            Please connect your wallet to view your NFTs
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your NFTs...</p>
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4">No NFTs found</p>
            <p className="text-sm text-gray-500">
              Start by exploring collections and minting your first NFT!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nfts.map((nft, index) => (
              <div
                key={`${nft.collectionAddress}-${nft.tokenId.toString()}`}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                <div className="h-48 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500">NFT #{nft.tokenId.toString()}</span>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Collection: {truncateAddress(nft.collectionAddress)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    Token ID: {nft.tokenId.toString()}
                  </p>
                  {nft.tokenURI && (
                    <a
                      href={nft.tokenURI}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-sm hover:underline mt-2 block"
                    >
                      View Metadata
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

const MyNFTs = () => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50"><TopNavigation /><main className="container mx-auto px-4 py-8 text-center">Loading...</main></div>}>
      <MyNFTsContent />
    </Suspense>
  );
};

export default MyNFTs;
