"use client";

import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import TopNavigation from "@/common/navs/top/TopNavigation";
import Footer from "@/components/Footer";
import Link from "next/link";

interface SubmissionVersion {
  versionNumber: number;
  changeType: string;
  updatedFields: Array<{ field: string; oldValue: any; newValue: any }>;
  createdAt: string;
  adminComments?: string;
}

interface Submission {
  submissionId: string;
  projectName: string;
  status: string;
  currentVersion: number;
  slaDeadline: string;
  slaViolated: boolean;
  adminComments?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

const SubmissionsManager = () => {
  const { address, isConnected } = useAccount();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [versions, setVersions] = useState<SubmissionVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    if (isConnected && address) {
      fetchSubmissions();
    }
  }, [address, isConnected]);

  const fetchSubmissions = async () => {
    try {
      const response = await fetch(`/api/dashboard/${address}/submissions`);
      const data = await response.json();
      if (data.success) {
        setSubmissions(data.data);
      }
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/dashboard/submissions/${submissionId}/versions`);
      const data = await response.json();
      if (data.success) {
        setVersions(data.data);
      }
    } catch (error) {
      console.error("Error fetching versions:", error);
    }
  };

  const handleResubmit = async (submissionId: string) => {
    // Navigate to resubmit page or open modal
    window.location.href = `/dashboard/submissions/${submissionId}/resubmit`;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
      NEEDS_UPDATE: "bg-orange-100 text-orange-800",
      READY_FOR_MINT: "bg-blue-100 text-blue-800",
      MINTED: "bg-purple-100 text-purple-800",
      FAILED: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const filteredSubmissions = filter === "ALL" 
    ? submissions 
    : submissions.filter(s => s.status === filter);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isSLAExpired = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNavigation />
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Submission Manager</h1>
          <p className="text-gray-600">Please connect your wallet to view submissions</p>
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
            <h1 className="text-3xl font-bold mb-2">Submission Manager</h1>
            <p className="text-gray-600">Track and manage all your NFT collection submissions</p>
          </div>
          <Link
            href="/dashboard/submit"
            className="mt-4 md:mt-0 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            + New Submission
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {["ALL", "PENDING", "NEEDS_UPDATE", "APPROVED", "READY_FOR_MINT", "MINTED", "REJECTED"].map((status) => (
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
            <p className="mt-4 text-gray-600">Loading submissions...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {filteredSubmissions.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">No submissions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Project</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Version</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">SLA Deadline</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredSubmissions.map((submission) => (
                      <tr key={submission.submissionId} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{submission.projectName}</p>
                            <p className="text-sm text-gray-500">ID: {submission.submissionId}</p>
                          </div>
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
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">v{submission.currentVersion}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-sm ${isSLAExpired(submission.slaDeadline) ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            {formatDate(submission.slaDeadline)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedSubmission(submission);
                                fetchVersions(submission.submissionId);
                              }}
                              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              History
                            </button>
                            {submission.status === "NEEDS_UPDATE" && (
                              <button
                                onClick={() => handleResubmit(submission.submissionId)}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Resubmit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Version History Modal */}
        {selectedSubmission && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Version History</h2>
                  <button
                    onClick={() => setSelectedSubmission(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-gray-600 mt-1">{selectedSubmission.projectName}</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {versions.map((version) => (
                    <div key={version.versionNumber} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium">Version {version.versionNumber}</span>
                          <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {version.changeType}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">{formatDate(version.createdAt)}</span>
                      </div>
                      {version.adminComments && (
                        <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <span className="font-medium">Admin Comments:</span> {version.adminComments}
                        </p>
                      )}
                      {version.updatedFields.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-600">Changes:</p>
                          <ul className="mt-1 text-sm text-gray-500">
                            {version.updatedFields.map((field, idx) => (
                              <li key={idx}>• {field.field}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default SubmissionsManager;
