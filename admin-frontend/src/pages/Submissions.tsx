import { useState } from 'react'
import { useQuery } from 'react-query'
import { Link } from 'react-router-dom'
import { getSubmissions } from '../utils/api'
import { Submission } from '../types'
import { format } from 'date-fns'
import { Eye, Filter } from 'lucide-react'

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  READY_FOR_MINT: 'bg-purple-100 text-purple-800',
  MINTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  FAILED: 'bg-gray-100 text-gray-800',
}

const tierNames = ['COAL', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM']

export default function Submissions() {
  const [filters, setFilters] = useState({
    status: '',
    organizationTier: '',
  })

  const { data, isLoading } = useQuery(
    ['submissions', filters],
    () => getSubmissions({
      status: filters.status || undefined,
      organizationTier: filters.organizationTier ? parseInt(filters.organizationTier) : undefined,
    }).then(r => r.data.data),
    { keepPreviousData: true }
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Submissions</h1>
        
        {/* Filters */}
        <div className="flex items-center gap-4">
          <Filter size={20} className="text-gray-400" />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input w-40"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="READY_FOR_MINT">Ready for Mint</option>
            <option value="MINTED">Minted</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select
            value={filters.organizationTier}
            onChange={(e) => setFilters({ ...filters, organizationTier: e.target.value })}
            className="input w-40"
          >
            <option value="">All Tiers</option>
            <option value="0">COAL</option>
            <option value="1">BRONZE</option>
            <option value="2">SILVER</option>
            <option value="3">GOLD</option>
            <option value="4">PLATINUM</option>
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4">Business</th>
              <th className="text-left py-3 px-4">Collection</th>
              <th className="text-left py-3 px-4">Tier</th>
              <th className="text-left py-3 px-4">Product Class</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.submissions?.map((submission: Submission) => (
              <tr key={submission._id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">{submission.businessName}</td>
                <td className="py-3 px-4">{submission.collectionName}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                    {tierNames[submission.organizationTier]}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                    {tierNames[submission.requestedProductClass]}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[submission.status]}`}>
                    {submission.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500">
                  {format(new Date(submission.createdAt), 'MMM d, yyyy')}
                </td>
                <td className="py-3 px-4">
                  <Link
                    to={`/submissions/${submission._id}`}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Eye size={18} />
                  </Link>
                </td>
              </tr>
            ))}
            {(!data?.submissions || data.submissions.length === 0) && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  No submissions found
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data?.pagination && data.pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500">
              Page {data.pagination.page} of {data.pagination.pages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={data.pagination.page === 1}
                className="px-4 py-2 border rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={data.pagination.page === data.pagination.pages}
                className="px-4 py-2 border rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
