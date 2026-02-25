"use client";

import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import TopNavigation from "@/common/navs/top/TopNavigation";
import Footer from "@/components/Footer";

interface Redemption {
  redemptionId: string;
  tokenId: string;
  contractAddress: string;
  nftName: string;
  nftImage: string;
  buyerWallet: string;
  status: string;
  requestDate: string;
  sellerResponseDate?: string;
  userConfirmationDate?: string;
  declineReason?: string;
  responseDeadline: string;
}

const RedemptionsManager = () => {
  const { address, isConnected } = useAccount();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      fetchRedemptions();
    }
  }, [address, isConnected]);

  const fetchRedemptions = async () => {
    try {
      const response = await fetch(`/api/dashboard/${address}/redemptions`);
      const data = await response.json();
      if (data.success) {
        setRedemptions(data.data);
      }
    } catch (error) {
      console.error("Error fetching redemptions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (redemptionId: string) => {
    try {
      const response = await fetch(`/api/dashboard/redemptions/${redemptionId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ACCEPT" }),
      });
      
      if (response.ok) {
        fetchRedemptions();
      }
    } catch (error) {
      console.error("Error accepting redemption:", error);
    }
  };

  const handleDecline = async () => {
    if (!selectedRedemption || !declineReason) return;

    try {
      const response = await fetch(`/api/dashboard/redemptions/${selectedRedemption.redemptionId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DECLINE", reason: declineReason }),
      });
      
      if (response.ok) {
        setShowDeclineModal(false);
        setDeclineReason("");
        setSelectedRedemption(null);
        fetchRedemptions();
      }
    } catch (error) {
      console.error("Error declining redemption:", error);
    }
  };

  const handleConfirmCompletion = async (redemptionId: string) => {
    try {
      const response = await fetch(`/api/dashboard/redemptions/${redemptionId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (response.ok) {
        fetchRedemptions();
      }
    } catch (error) {
      console.error("Error confirming redemption:", error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      ACCEPTED: "bg-blue-100 text-blue-800",
      DECLINED: "bg-red-100 text-red-800",
      USER_CONFIRMED: "bg-purple-100 text-purple-800",
      COMPLETED: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const filteredRedemptions = filter === "ALL"
    ? redemptions
    : redemptions.filter((r) => r.status === filter);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isResponseDeadlineExpired = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavigation />
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Redemption Management</h1>
          <p className="text-gray-600">Please connect your wallet to manage redemptions</p>
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
          <h1 className="text-3xl font-bold mb-2">Redemption Management</h1>
          <p className="text-gray-600">Manage NFT redemption requests from buyers</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {["PENDING", "ACCEPTED", "COMPLETED", "DECLINED"].map((status) => {
            const count = redemptions.filter((r) => r.status === status).length;
            return (
              <div key={status} className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">{status.replace(/_/g, " ")}</p>
                <p className="text-2xl font-bold">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {["ALL", "PENDING", "ACCEPTED", "USER_CONFIRMED", "COMPLETED", "DECLINED"].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {status.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading redemptions...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRedemptions.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500">No redemption requests found</p>
              </div>
            ) : (
              filteredRedemptions.map((redemption) => (
                <div key={redemption.redemptionId} className="bg-white rounded-lg shadow p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    {/* NFT Info */}
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                      {redemption.nftImage && (
                        <img
                          src={redemption.nftImage}
                          alt={redemption.nftName}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900">{redemption.nftName}</h3>
                        <p className="text-sm text-gray-500">Token ID: {redemption.tokenId}</p>
                        <p className="text-xs text-gray-400">
                          Buyer: {redemption.buyerWallet.slice(0, 6)}...{redemption.buyerWallet.slice(-4)}
                        </p>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex flex-col items-start md:items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(redemption.status)}`}>
                        {redemption.status.replace(/_/g, " ")}
                      </span>
                      
                      {redemption.status === "PENDING" && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleAccept(redemption.redemptionId)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRedemption(redemption);
                              setShowDeclineModal(true);
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {redemption.status === "ACCEPTED" && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600 mb-2">Waiting for buyer confirmation...</p>
                          <p className="text-xs text-gray-500">
                            Accepted on {redemption.sellerResponseDate && formatDate(redemption.sellerResponseDate)}
                          </p>
                        </div>
                      )}

                      {redemption.status === "USER_CONFIRMED" && (
                        <div className="mt-2">
                          <p className="text-sm text-green-600 mb-2">Buyer confirmed receipt!</p>
                          <p className="text-xs text-gray-500">NFT will be burned automatically</p>
                        </div>
                      )}

                      {redemption.status === "DECLINED" && redemption.declineReason && (
                        <div className="mt-2 max-w-md">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Reason:</span> {redemption.declineReason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                    <div className="flex flex-wrap gap-4">
                      <span>Requested: {formatDate(redemption.requestDate)}</span>
                      {redemption.sellerResponseDate && (
                        <span>Responded: {formatDate(redemption.sellerResponseDate)}</span>
                      )}
                      {redemption.userConfirmationDate && (
                        <span>Confirmed: {formatDate(redemption.userConfirmationDate)}</span>
                      )}
                    </div>
                    {redemption.status === "PENDING" && (
                      <div className={`mt-2 ${isResponseDeadlineExpired(redemption.responseDeadline) ? 'text-red-600' : 'text-gray-400'}`}>
                        Response deadline: {formatDate(redemption.responseDeadline)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Decline Modal */}
        {showDeclineModal && selectedRedemption && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold">Decline Redemption</h2>
                <p className="text-gray-600 mt-1">{selectedRedemption.nftName}</p>
              </div>
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for declining (required)
                </label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder="Explain why you're declining this redemption request..."
                  required
                />
              </div>
              <div className="p-6 border-t flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeclineModal(false);
                    setDeclineReason("");
                    setSelectedRedemption(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecline}
                  disabled={!declineReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Decline Request
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default RedemptionsManager;
