import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getPendingStatus } from '../utils/api'

// Simple SVG Icons
const CheckCircleIcon = () => (
  <svg className="h-16 w-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ClockIcon = () => (
  <svg className="h-16 w-16 text-yellow-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const XCircleIcon = () => (
  <svg className="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export default function PendingApproval() {
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | null>(null)
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const checkStatus = async () => {
    setChecking(true)
    try {
      const response = await getPendingStatus()
      const data = response.data.data
      setStatus(data.status)
      setRejectionReason(data.rejectionReason || null)
    } catch (error) {
      console.error('Error checking status:', error)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    checkStatus()
    // Check status every 30 seconds
    const interval = setInterval(checkStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="card w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">NFT Factory</h1>
          <p className="text-gray-500 mt-2">Account Status</p>
        </div>

        <div className="space-y-6">
          {status === 'PENDING' && (
            <div className="text-center p-8 bg-yellow-50 rounded-lg border border-yellow-200">
              <ClockIcon />
              <h2 className="text-xl font-semibold text-yellow-800 mb-2">Account Pending Approval</h2>
              <p className="text-yellow-700 mb-4">
                Your account is currently pending approval from a Super Admin. Please check back later.
              </p>
              <div className="animate-pulse">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                  <ClockIcon />
                  <span className="ml-1.5">Pending Review</span>
                </span>
              </div>
            </div>
          )}

          {status === 'APPROVED' && (
            <div className="text-center p-8 bg-green-50 rounded-lg border border-green-200">
              <CheckCircleIcon />
              <h2 className="text-xl font-semibold text-green-800 mb-2">Account Approved!</h2>
              <p className="text-green-700 mb-6">
                Your account has been approved. You can now access the admin dashboard.
              </p>
              <Link
                to="/"
                className="inline-block w-full btn-primary py-3 text-center"
              >
                Go to Dashboard
              </Link>
            </div>
          )}

          {status === 'REJECTED' && (
            <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
              <XCircleIcon />
              <h2 className="text-xl font-semibold text-red-800 mb-2">Account Rejected</h2>
              {rejectionReason && (
                <div className="bg-red-100 p-4 rounded-lg mb-4">
                  <p className="text-red-700 font-medium">Reason:</p>
                  <p className="text-red-700">{rejectionReason}</p>
                </div>
              )}
              <p className="text-red-700 mb-6">
                Your account application was rejected. Please contact support for more information.
              </p>
              <Link
                to="/login"
                className="inline-block w-full btn-secondary py-3 text-center"
              >
                Back to Login
              </Link>
            </div>
          )}

          {status === null && (
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading account status...</p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={checkStatus}
              disabled={checking}
              className="w-full btn-secondary py-2 text-center disabled:opacity-50"
            >
              {checking ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>Need help? Contact support@nftfactory.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}
