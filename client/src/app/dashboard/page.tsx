"use client";

import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import TopNavigation from "@/common/navs/top/TopNavigation";
import Footer from "@/components/Footer";
import { getSubscriptionDetails, hasActiveSubscription } from "@/utils";
import Link from "next/link";

interface DashboardStats {
  organization: {
    tier: string;
    status: string;
    subscriptionId: string;
  };
  trust: {
    score: number;
    badge: string;
    selfMintEligible: boolean;
  };
  quota: {
    total: number;
    remaining: number;
    used: number;
  };
  submissions: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    minted: number;
  };
  redemptions: {
    total: number;
    completed: number;
    pending: number;
    completionRate: number;
  };
  sales: {
    totalRevenue: string;
    totalVolume: string;
  };
}

const Dashboard = () => {
  const { address, isConnected } = useAccount();
  const [stats, setStats] = useState<DashboardStats | null>(null);
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
        await fetchDashboardStats();
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch(`/api/dashboard/${address}/overview`);
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
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

  const getBadgeColor = (badge: string) => {
    const colors: Record<string, string> = {
      STARTER: "text-gray-500",
      VERIFIED: "text-blue-500",
      PREMIUM: "text-purple-500",
      ENTERPRISE: "text-amber-500",
    };
    return colors[badge] || "text-gray-500";
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavigation />
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Business Dashboard</h1>
          <p className="text-gray-600 mb-8">Please connect your wallet to access the dashboard</p>
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
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
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
            <h1 className="text-4xl font-bold mb-6">Business Dashboard</h1>
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="text-6xl mb-4">🔒</div>
              <h2 className="text-2xl font-semibold mb-4">Subscription Required</h2>
              <p className="text-gray-600 mb-8">
                You need an active Subscription NFT to access the business dashboard and mint collections.
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
    <div className="min-h-screen bg-gray-50">
      <TopNavigation />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Business Dashboard</h1>
          <p className="text-gray-600">Manage your NFT collections and track performance</p>
        </div>

        {stats && (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Organization Tier */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-500">Organization Tier</h3>
                  <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${getTierColor(stats.organization.tier)}`}>
                    {stats.organization.tier}
                  </span>
                </div>
                <p className="text-2xl font-bold">{stats.organization.status}</p>
                <p className="text-sm text-gray-500 mt-1">ID: {stats.organization.subscriptionId}</p>
              </div>

              {/* Trust Score */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-500">Trust Score</h3>
                  <span className={`text-sm font-semibold ${getBadgeColor(stats.trust.badge)}`}>
                    {stats.trust.badge}
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-4xl font-bold">{stats.trust.score}</p>
                  <span className="text-gray-500 mb-1">/ 100</span>
                </div>
                {stats.trust.selfMintEligible && (
                  <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                    Self-Mint Enabled
                  </span>
                )}
              </div>

              {/* Mint Quota */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Mint Quota</h3>
                <div className="flex items-end gap-2">
                  <p className="text-4xl font-bold">{stats.quota.remaining}</p>
                  <span className="text-gray-500 mb-1">/ {stats.quota.total}</span>
                </div>
                <div className="mt-3 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${(stats.quota.used / stats.quota.total) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Total Revenue */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Total Revenue</h3>
                <p className="text-3xl font-bold">{parseFloat(stats.sales.totalRevenue).toFixed(4)} ETH</p>
                <p className="text-sm text-gray-500 mt-1">
                  Volume: {parseFloat(stats.sales.totalVolume).toFixed(4)} ETH
                </p>
              </div>
            </div>

            {/* Submissions & Redemptions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Submissions */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold">Submissions</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-3xl font-bold text-blue-600">{stats.submissions.total}</p>
                      <p className="text-sm text-gray-600">Total</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <p className="text-3xl font-bold text-yellow-600">{stats.submissions.pending}</p>
                      <p className="text-sm text-gray-600">Pending</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-3xl font-bold text-green-600">{stats.submissions.approved}</p>
                      <p className="text-sm text-gray-600">Approved</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-3xl font-bold text-purple-600">{stats.submissions.minted}</p>
                      <p className="text-sm text-gray-600">Minted</p>
                    </div>
                  </div>
                  <Link
                    href="/dashboard/submissions"
                    className="block mt-6 text-center text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View All Submissions →
                  </Link>
                </div>
              </div>

              {/* Redemptions */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold">Redemptions</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{stats.redemptions.total}</p>
                      <p className="text-sm text-gray-600">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{stats.redemptions.completed}</p>
                      <p className="text-sm text-gray-600">Completed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">{stats.redemptions.pending}</p>
                      <p className="text-sm text-gray-600">Pending</p>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Completion Rate</span>
                      <span className="text-lg font-semibold">{stats.redemptions.completionRate.toFixed(1)}%</span>
                    </div>
                    <div className="mt-2 bg-gray-300 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${stats.redemptions.completionRate}%` }}
                      ></div>
                    </div>
                  </div>
                  <Link
                    href="/dashboard/redemptions"
                    className="block mt-6 text-center text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Manage Redemptions →
                  </Link>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/dashboard/submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  + New Submission
                </Link>
                <Link
                  href="/dashboard/collections"
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  View Collections
                </Link>
                <Link
                  href="/dashboard/analytics"
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Analytics
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
