import { useQuery } from 'react-query'
import { getAnalytics } from '../utils/api'

const tierNames = ['COAL', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM']

export default function Analytics() {
  const { data, isLoading } = useQuery('analytics', () => getAnalytics().then(r => r.data.data))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const counts = data?.counts

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Analytics</h1>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="card text-center">
          <p className="text-3xl font-bold text-primary-600">{counts?.total || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Total</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-yellow-600">{counts?.pending || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Pending</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-blue-600">{counts?.approved || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Approved</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-purple-600">{counts?.readyForMint || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Ready</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">{counts?.minted || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Minted</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-600">{counts?.rejected || 0}</p>
          <p className="text-sm text-gray-500 mt-1">Rejected</p>
        </div>
      </div>

      {/* By Tier */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-6">Submissions by Tier</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {data?.byTier?.map((tier: { _id: number; count: number }) => (
            <div key={tier._id} className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold">{tier.count}</p>
              <p className="text-sm text-gray-500">{tierNames[tier._id]}</p>
            </div>
          ))}
          {(!data?.byTier || data.byTier.length === 0) && (
            <p className="text-gray-500 col-span-full text-center py-8">
              No tier data available
            </p>
          )}
        </div>
      </div>

      {/* Conversion Rate */}
      <div className="card">
        <h2 className="text-xl font-bold mb-6">Conversion Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Approval Rate</p>
            <p className="text-2xl font-bold">
              {counts?.total > 0
                ? Math.round(((counts?.approved + counts?.readyForMint + counts?.minted) / counts?.total) * 100)
                : 0}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Mint Success Rate</p>
            <p className="text-2xl font-bold">
              {counts?.minted + counts?.failed > 0
                ? Math.round((counts?.minted / (counts?.minted + counts?.failed)) * 100)
                : 0}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Pending Ratio</p>
            <p className="text-2xl font-bold">
              {counts?.total > 0
                ? Math.round((counts?.pending / counts?.total) * 100)
                : 0}%
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
