import { useParams } from 'react-router-dom'
import { useQuery } from 'react-query'
import { getSubmission } from '../utils/api'
import { format } from 'date-fns'

const tierNames = ['COAL', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM']

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  READY_FOR_MINT: 'bg-purple-100 text-purple-800',
  MINTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  FAILED: 'bg-gray-100 text-gray-800',
}

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useQuery(
    ['submission', id],
    () => getSubmission(id!).then(r => r.data.data)
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const submission = data

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Submission Details</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Main Info */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">{submission.collectionName}</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[submission.status]}`}>
              {submission.status}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Business Name</p>
              <p className="font-medium">{submission.businessName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Description</p>
              <p className="font-medium">{submission.description}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Wallet Address</p>
              <p className="font-mono text-sm">{submission.walletAddress}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Subscription ID</p>
              <p className="font-medium">{submission.subscriptionId}</p>
            </div>
          </div>
        </div>

        {/* Tier Info */}
        <div className="card">
          <h2 className="text-xl font-bold mb-6">Tier Information</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Organization Tier</span>
              <span className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">
                {tierNames[submission.organizationTier]}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Requested Product Class</span>
              <span className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">
                {tierNames[submission.requestedProductClass]}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Royalty Percentage</span>
              <span className="font-medium">{submission.royaltyPercent}%</span>
            </div>
          </div>

          <hr className="my-6" />

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="font-medium">
                {format(new Date(submission.createdAt), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="font-medium">
                {format(new Date(submission.updatedAt), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="card lg:col-span-2">
          <h2 className="text-xl font-bold mb-6">Uploaded Images</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {submission.uploadedImageCIDs?.map((cid: string, index: number) => (
              <div key={index} className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-xs text-gray-500 text-center px-2">
                  {cid.substring(0, 20)}...
                </span>
              </div>
            ))}
            {(!submission.uploadedImageCIDs || submission.uploadedImageCIDs.length === 0) && (
              <p className="text-gray-500 col-span-full">No images uploaded</p>
            )}
          </div>
        </div>

        {/* Final Artwork */}
        {submission.finalImageCID && (
          <div className="card lg:col-span-2">
            <h2 className="text-xl font-bold mb-6">Final Artwork</h2>
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-sm text-gray-500">{submission.finalImageCID}</span>
            </div>
          </div>
        )}

        {/* Metadata */}
        {submission.metadataCID && (
          <div className="card lg:col-span-2">
            <h2 className="text-xl font-bold mb-6">Metadata</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-mono text-sm break-all">{submission.metadataCID}</p>
            </div>
          </div>
        )}

        {/* Transaction */}
        {submission.txHash && (
          <div className="card lg:col-span-2">
            <h2 className="text-xl font-bold mb-6">Transaction</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-mono text-sm break-all">{submission.txHash}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {submission.errorMessage && (
          <div className="card lg:col-span-2 border-red-200 bg-red-50">
            <h2 className="text-xl font-bold mb-6 text-red-600">Error</h2>
            <p className="text-red-600">{submission.errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  )
}
