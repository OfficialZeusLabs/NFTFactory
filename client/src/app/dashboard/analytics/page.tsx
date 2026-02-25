"use client";

import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import TopNavigation from "@/common/navs/top/TopNavigation";
import Footer from "@/components/Footer";
import { orbitron } from "@/fonts/fonts";
import { poppins } from "@/fonts/fonts";
import Image from "next/image";
import Link from "next/link";
import { hasActiveSubscription } from "@/utils";

interface AnalyticsData {
  overview: {
    totalSales: string;
    totalSalesChange: number;
    totalCreatedNFTs: number;
    totalCreatedChange: number;
    totalDeployedNFTs: number;
    totalDeployedChange: number;
    totalRevenue: string;
    totalRevenueChange: number;
  };
  salesHistory: {
    labels: string[];
    data: number[];
  };
  recentActivity: {
    type: string;
    description: string;
    timestamp: string;
    value?: string;
  }[];
}

const AnalyticsDashboard = () => {
  const { address, isConnected } = useAccount();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      checkSubscription();
    }
  }, [address, isConnected]);

  const checkSubscription = async () => {
    try {
      const hasSub = await hasActiveSubscription(address as `0x${string}`);
      setHasSubscription(hasSub);
      
      if (hasSub) {
        await fetchAnalytics();
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/dashboard/${address}/analytics`);
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  const formatChange = (value: number) => {
    const isPositive = value >= 0;
    return (
      <span className={`text-[12px] tracking-wider ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{value}%
      </span>
    );
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavigation />
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Analytics Dashboard</h1>
          <p className="text-gray-600 mb-8">Please connect your wallet to access analytics</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavigation />
        <main className="container mx-auto px-4 py-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!hasSubscription) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavigation />
        <main className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-6">Analytics Dashboard</h1>
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="text-6xl mb-4">📊</div>
              <h2 className="text-2xl font-semibold mb-4">Subscription Required</h2>
              <p className="text-gray-600 mb-8">
                You need an active Subscription NFT to access analytics and track your NFT performance.
              </p>
              <Link
                href="/subscribe"
                className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Get Subscription
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <TopNavigation />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className={`${orbitron.className} text-3xl font-bold text-white mb-2`}>Analytics</h1>
            <p className="text-gray-400">Track your NFT sales and performance metrics</p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {analytics ? (
          <>
            {/* Overview Cards */}
            <div className={`${poppins.className} grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8`}>
              <div className="bg-[#130712] rounded-lg border border-opacity-25 border-yellow-400 shadow-lg p-6">
                <p className="text-[#989898] tracking-wider text-[14px]">Total Sales</p>
                <p className="text-[#FFC72C] text-2xl font-semibold my-1">
                  ${analytics.overview.totalSales}
                </p>
                {formatChange(analytics.overview.totalSalesChange)}
              </div>
              
              <div className="bg-[#130712] rounded-lg border border-opacity-25 border-yellow-400 shadow-lg p-6">
                <p className="text-[#989898] tracking-wider text-[14px]">Total Created NFTs</p>
                <p className="text-[#FFC72C] text-2xl font-semibold my-1">
                  {analytics.overview.totalCreatedNFTs}
                </p>
                {formatChange(analytics.overview.totalCreatedChange)}
              </div>
              
              <div className="bg-[#130712] rounded-lg border border-opacity-25 border-yellow-400 shadow-lg p-6">
                <p className="text-[#989898] tracking-wider text-[14px]">Total Deployed NFTs</p>
                <p className="text-[#FFC72C] text-2xl font-semibold my-1">
                  {analytics.overview.totalDeployedNFTs}
                </p>
                {formatChange(analytics.overview.totalDeployedChange)}
              </div>
              
              <div className="bg-[#130712] rounded-lg border border-opacity-25 border-yellow-400 shadow-lg p-6">
                <p className="text-[#989898] tracking-wider text-[14px]">Total Revenue</p>
                <p className="text-[#FFC72C] text-2xl font-semibold my-1">
                  ${analytics.overview.totalRevenue}
                </p>
                {formatChange(analytics.overview.totalRevenueChange)}
              </div>
            </div>

            {/* Sales Chart */}
            <div className="bg-[#130712] rounded-lg border border-opacity-25 border-yellow-400 shadow-lg p-6 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className={`${orbitron.className} text-xl text-white`}>Sales History</h2>
                <button
                  className={`${orbitron.className} text-[#FFC72C] px-4 py-2`}
                  style={{
                    border: "2px solid transparent",
                    borderRadius: "10px",
                    borderImage: "linear-gradient(to right, #702D6C, #FFC72C) 1",
                  }}
                >
                  Export Data
                </button>
              </div>
              <div className="mt-4">
                <Image
                  src="/images/graph.png"
                  alt="Sales Chart"
                  height={400}
                  width={800}
                  className="w-full rounded-lg"
                />
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-[#130712] rounded-lg border border-opacity-25 border-yellow-400 shadow-lg p-6">
              <h2 className={`${orbitron.className} text-xl text-white mb-6`}>Recent Activity</h2>
              <div className="space-y-4">
                {analytics.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-[#1a0f1a] rounded-lg">
                    <div>
                      <p className="text-white font-medium">{activity.description}</p>
                      <p className="text-gray-400 text-sm">{new Date(activity.timestamp).toLocaleString()}</p>
                    </div>
                    {activity.value && (
                      <span className="text-[#FFC72C] font-semibold">{activity.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400">No analytics data available yet.</p>
            <p className="text-gray-500 text-sm mt-2">Start creating and selling NFTs to see your analytics.</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default AnalyticsDashboard;
