"use client";

import React, { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import TopNavigation from "@/common/navs/top/TopNavigation";
import Footer from "@/components/Footer";
import { deployCollection } from "@/utils";

const CreateCollection = () => {
  const { isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    uri1: "",
    uri2: "",
    fee1: "0.01",
    fee2: "0.02",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setLoading(true);
    try {
      const uris = [formData.uri1, formData.uri2].filter((uri) => uri.trim() !== "");
      const fees = [
        parseEther(formData.fee1 || "0"),
        parseEther(formData.fee2 || "0"),
      ].slice(0, uris.length);

      const result = await deployCollection(
        formData.name,
        formData.symbol,
        uris,
        fees
      );
      setTxHash(String(result));
    } catch (error) {
      console.error("Error deploying collection:", error);
      alert("Failed to deploy collection. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNavigation />
      
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-8 text-center">Create NFT Collection</h1>

        {!isConnected && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-6">
            Please connect your wallet to create a collection
          </div>
        )}

        {txHash && (
          <div className="bg-green-100 border border-green-400 text-green-800 px-4 py-3 rounded mb-6">
            <p>Collection deployed successfully!</p>
            <a
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-sm"
            >
              View on BaseScan
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Collection Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., My Awesome Collection"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Symbol
            </label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., MAC"
              required
            />
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">NFT Type 1</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metadata URI
                </label>
                <input
                  type="text"
                  value={formData.uri1}
                  onChange={(e) => setFormData({ ...formData, uri1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ipfs://... or https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mint Fee (ETH)
                </label>
                <input
                  type="text"
                  value={formData.fee1}
                  onChange={(e) => setFormData({ ...formData, fee1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.01"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">NFT Type 2 (Optional)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Metadata URI
                </label>
                <input
                  type="text"
                  value={formData.uri2}
                  onChange={(e) => setFormData({ ...formData, uri2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ipfs://... or https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mint Fee (ETH)
                </label>
                <input
                  type="text"
                  value={formData.fee2}
                  onChange={(e) => setFormData({ ...formData, fee2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.02"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isConnected}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Deploying..." : "Create Collection"}
          </button>
        </form>
      </main>

      <Footer />
    </div>
  );
};

export default CreateCollection;
