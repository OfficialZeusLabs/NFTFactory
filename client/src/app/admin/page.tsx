"use client";

import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import TopNavigation from "@/common/navs/top/TopNavigation";
import Footer from "@/components/Footer";

interface AdminStats {
  submissions: {
    total: number;
    pending: number;
    needsUpdate: number;
    approved: number;
    readyForMint: number;
    minted: number;
    rejected: number;
  };
  slaViolations: number;
  businesses: {
    total: number;
    verified: number;
    suspended: number;
    selfMintEnabled: number;
  };
  redemptions: {
    total: number;
    pending: number;
    completed: number;
  };
}

interface AdminLog {
  logId: string;
  adminId: string;
  actionType: string;
  submissionId?: string;
  previousStatus?: string;
  newStatus?: string;
  message?: string;
  timestamp: string;
}

interface Submission {
  submissionId: string;
  projectName: string;
  walletAddress: string;
  status: string;
  slaDeadline: string;
  slaViolated: boolean;
  createdAt: string;
}

const AdminDashboard = () => {
  const { address, isConnected } = useAccount();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [logFilters, setLogFilters] = useState({
    actionType: "",
    startDate: "",
    endDate: "",
  });
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT" | "NEEDS_UPDATE" | null>(null);

  const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET || "0xc318466b329385d08a63894ceA20ee285D7e0840";

  useEffect(() => {
    if (isConnected && address) {
      fetchDashboard();
    }
  }, [isConnected, address]);

  const fetchDashboard = async () => {
    try {
      const [statsRes, logsRes, submissionsRes] = await Promise.all([
        fetch("/api/admin/dashboard"),
        fetch("/api/admin/logs"),
        fetch("/api/admin/submissions?status=PENDING"),
      ]);

      const statsData = await statsRes.json();
      const logsData = await logsRes.json();
      const submissionsData = await submissionsRes.json();

      if (statsData.success) setStats(statsData.data);
      if (logsData.success) setLogs(logsData.data);
      if (submissionsData.success) setSubmissions(submissionsData.data);
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!selectedSubmission || !reviewAction) return;

    try {
      const response = await fetch(`/api/admin/submissions/${selectedSubmission.submissionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reviewAction,
          message: reviewMessage,
        }),
      });

      if (response.ok) {
        setShowReviewModal(false);
        setReviewMessage("");
        setSelectedSubmission(null);
        setReviewAction(null);
        fetchDashboard();
      }
    } catch (error) {
      console.error("Error reviewing submission:", error);
    }
  };

  const filterLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (logFilters.actionType) params.append("actionType", logFilters.actionType);
      if (logFilters.startDate) params.append("startDate", logFilters.startDate);
      if (logFilters.endDate) params.append("endDate", logFilters.endDate);

      const response = await fetch(`/api/admin/logs?${params}`);
      const data = await response.json();
      if (data.success) setLogs(data.data);
    } catch (error) {
      console.error("Error filtering logs:", error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
      NEEDS_UPDATE: "bg-orange-100 text-orange-800",
      READY_FOR_MINT: "bg-blue-100 text-blue-800",
      MINTED: "bg-purple-100 text-purple-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US");
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavigation />
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
          <p className="text-gray-600">Please connect your wallet</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (address?.toLowerCase() !== ADMIN_WALLET.toLowerCase()) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavigation />
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600">You do not have admin privileges</p>
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
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage submissions, businesses, and platform operations</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="flex border-b">
            {["overview", "submissions", "logs"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-medium capitalize ${
                  activeTab === tab
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && stats && (
              <div className="space-y-8">
                {/* Submission Stats */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">Submission Overview</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {Object.entries(stats.submissions).map(([key, value]) => (
                      <div key={key} className="bg-white rounded-lg shadow p-4">
                        <p className="text-sm text-gray-600 capitalize">{key.replace(/_/g, " ")}</p>
                        <p className="text-2xl font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SLA Violations */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-red-800 mb-2">SLA Violations</h2>
                  <p className="text-3xl font-bold text-red-600">{stats.slaViolations}</p>
                  <p className="text-red-600 mt-1">Submissions exceeding review deadlines</p>
                </div>

                {/* Business Stats */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">Business Overview</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(stats.businesses).map(([key, value]) => (
                      <div key={key} className="bg-white rounded-lg shadow p-4">
                        <p className="text-sm text-gray-600 capitalize">{key.replace(/_/g, " ")}</p>
                        <p className="text-2xl font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Redemption Stats */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">Redemption Overview</h2>
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(stats.redemptions).map(([key, value]) => (
                      <div key={key} className="bg-white rounded-lg shadow p-4">
                        <p className="text-sm text-gray-600 capitalize">{key.replace(/_/g, " ")}</p>
                        <p className="text-2xl font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Submissions Tab */}
            {activeTab === "submissions" && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold">Pending Submissions</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Project</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Wallet</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">SLA Deadline</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {submissions.map((submission) => (
                        <tr key={submission.submissionId} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">{submission.projectName}</p>
                            <p className="text-sm text-gray-500">ID: {submission.submissionId}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600">
                              {submission.walletAddress.slice(0, 6)}...{submission.walletAddress.slice(-4)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                              {submission.status.replace(/_/g, " ")}
                            </span>
                            {submission.slaViolated && (
                              <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                                SLA Violated
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDate(submission.slaDeadline)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedSubmission(submission);
                                  setReviewAction("APPROVE");
                                  setShowReviewModal(true);
                                }}
                                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedSubmission(submission);
                                  setReviewAction("NEEDS_UPDATE");
                                  setShowReviewModal(true);
                                }}
                                className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                              >
                                Update
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedSubmission(submission);
                                  setReviewAction("REJECT");
                                  setShowReviewModal(true);
                                }}
                                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Logs Tab */}
            {activeTab === "logs" && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-4">Filter Logs</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
                      <select
                        value={logFilters.actionType}
                        onChange={(e) => setLogFilters({ ...logFilters, actionType: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">All Actions</option>
                        <option value="SUBMISSION_APPROVED">Submission Approved</option>
                        <option value="SUBMISSION_REJECTED">Submission Rejected</option>
                        <option value="SUBMISSION_NEEDS_UPDATE">Needs Update</option>
                        <option value="USER_SUSPENDED">User Suspended</option>
                        <option value="USER_SELF_MINT_APPROVED">Self-Mint Approved</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={logFilters.startDate}
                        onChange={(e) => setLogFilters({ ...logFilters, startDate: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={logFilters.endDate}
                        onChange={(e) => setLogFilters({ ...logFilters, endDate: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                  <button
                    onClick={filterLogs}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Apply Filters
                  </button>
                </div>

                {/* Logs Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Timestamp</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Action</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Admin</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {logs.map((log) => (
                          <tr key={log.logId} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {formatDate(log.timestamp)}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                                {log.actionType.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {log.adminId.slice(0, 6)}...{log.adminId.slice(-4)}
                            </td>
                            <td className="px-6 py-4">
                              {log.previousStatus && log.newStatus && (
                                <p className="text-sm text-gray-600">
                                  {log.previousStatus} → {log.newStatus}
                                </p>
                              )}
                              {log.message && (
                                <p className="text-sm text-gray-500 mt-1">{log.message}</p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Review Modal */}
        {showReviewModal && selectedSubmission && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold">
                  {reviewAction === "APPROVE" && "Approve Submission"}
                  {reviewAction === "REJECT" && "Reject Submission"}
                  {reviewAction === "NEEDS_UPDATE" && "Request Update"}
                </h2>
                <p className="text-gray-600 mt-1">{selectedSubmission.projectName}</p>
              </div>
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message/Reason
                </label>
                <textarea
                  value={reviewMessage}
                  onChange={(e) => setReviewMessage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  placeholder={
                    reviewAction === "APPROVE"
                      ? "Optional approval message..."
                      : reviewAction === "REJECT"
                      ? "Reason for rejection (required)..."
                      : "What needs to be updated (required)..."
                  }
                  required={reviewAction !== "APPROVE"}
                />
              </div>
              <div className="p-6 border-t flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setReviewMessage("");
                    setSelectedSubmission(null);
                    setReviewAction(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReview}
                  disabled={reviewAction !== "APPROVE" && !reviewMessage.trim()}
                  className={`px-4 py-2 rounded-lg font-medium text-white ${
                    reviewAction === "APPROVE"
                      ? "bg-green-600 hover:bg-green-700"
                      : reviewAction === "REJECT"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-yellow-600 hover:bg-yellow-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {reviewAction === "APPROVE" && "Approve"}
                  {reviewAction === "REJECT" && "Reject"}
                  {reviewAction === "NEEDS_UPDATE" && "Request Update"}
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

export default AdminDashboard;
