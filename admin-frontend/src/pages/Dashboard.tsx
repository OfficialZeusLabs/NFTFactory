import { useQuery } from 'react-query'
import { getAnalytics } from '../utils/api'
import { Submission } from '../types'
import { format } from 'date-fns'

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  READY_FOR_MINT: 'bg-purple-100 text-purple-800',
  MINTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  FAILED: 'bg-gray-100 text-gray-800',
}

export default function Dashboard() {
  const { data, isLoading } = useQuery('analytics', () => getAnalytics().then(r => r.data.data))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const stats = [
    { label: 'Total Submissions', value: data?.counts.total || 0, color: 'bg-blue-500' },
    { label: 'Pending', value: data?.counts.pending || 0, color: 'bg-yellow-500' },
    { label: 'Approved', value: data?.counts.approved || 0, color: 'bg-blue-500' },
    { label: 'Ready for Mint', value: data?.counts.readyForMint || 0, color: 'bg-purple-500' },
    { label: 'Minted', value: data?.counts.minted || 0, color: 'bg-green-500' },
    { label: 'Rejected', value: data?.counts.rejected || 0, color: 'bg-red-500' },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center text-white font-bold text-xl`}>
                {stat.value}
              </div>
              <div>
                <p className="text-gray-500 text-sm">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Submissions */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Recent Submissions</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Business</th>
                <th className="text-left py-3 px-4">Collection</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {data?.recent?.map((submission: Submission) => (
                <tr key={submission._id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{submission.businessName}</td>
                  <td className="py-3 px-4">{submission.collectionName}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[submission.status]}`}>
                      {submission.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {format(new Date(submission.createdAt), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
              {(!data?.recent || data.recent.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    No submissions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
