export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'DESIGNER' | 'OPS'
}

export type SubmissionStatus = 
  | 'PENDING' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'READY_FOR_MINT' 
  | 'MINTED' 
  | 'FAILED'

export interface Submission {
  _id: string
  businessName: string
  walletAddress: string
  subscriptionId: string
  organizationTier: number
  requestedProductClass: number
  collectionName: string
  description: string
  royaltyPercent: number
  uploadedImageCIDs: string[]
  finalImageCID: string | null
  metadataCID: string | null
  status: SubmissionStatus
  assignedDesigner: string | null
  txHash: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface AnalyticsData {
  counts: {
    total: number
    pending: number
    approved: number
    readyForMint: number
    minted: number
    rejected: number
  }
  byTier: Array<{ _id: number; count: number }>
  recent: Array<{
    _id: string
    businessName: string
    collectionName: string
    status: SubmissionStatus
    createdAt: string
  }>
}
