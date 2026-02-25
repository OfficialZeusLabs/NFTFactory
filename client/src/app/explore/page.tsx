"use client";

import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import TopNavigation from "@/common/navs/top/TopNavigation";
import Footer from "@/components/Footer";
import { getAllCollections, getCollectionDetails } from "@/utils";
import Link from "next/link";

interface Collection {
  address: `0x${string}`;
  name: string;
  symbol: string;
  totalSupply: string | number | bigint | null;
}

const Explore = () => {
  const { address } = useAccount();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const collectionAddresses = await getAllCollections();
      
      const details = await Promise.all(
        collectionAddresses.map(async (addr) => {
          const info = await getCollectionDetails(addr);
          return info;
        })
      );

      const validCollections: Collection[] = details
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => ({
          address: c.address,
          name: String(c.name || ""),
          symbol: String(c.symbol || ""),
          totalSupply: c.totalSupply ? String(c.totalSupply) : "0",
        }));
      setCollections(validCollections);
    } catch (error) {
      console.error("Error fetching collections:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation />

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Explore Collections</h1>
          <Link
            href="/create"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Create Collection
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading collections...</p>
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600 mb-4">No collections found</p>
            <p className="text-sm text-gray-500">
              Be the first to create a collection!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <div
                key={collection.address}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-2">{collection.name}</h2>
                  <p className="text-gray-600 mb-4">Symbol: {collection.symbol}</p>
                  <p className="text-sm text-gray-500 mb-4">
                    Total Minted: {collection.totalSupply?.toString() || "0"}
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/collections/mint?address=${collection.address}`}
                      className="flex-1 bg-blue-600 text-white text-center py-2 rounded-md hover:bg-blue-700"
                    >
                      Mint
                    </Link>
                    <Link
                      href={`/my-nfts?collection=${collection.address}`}
                      className="flex-1 bg-gray-200 text-gray-800 text-center py-2 rounded-md hover:bg-gray-300"
                    >
                      My NFTs
                    </Link>
                  </div>
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

export default Explore;
