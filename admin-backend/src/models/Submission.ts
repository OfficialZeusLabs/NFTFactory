import mongoose, { Schema, Document } from 'mongoose';

export type SubmissionStatus = 
  | 'PENDING' 
  | 'APPROVED' 
  | 'REJECTED' 
  | 'READY_FOR_MINT' 
  | 'MINTED' 
  | 'FAILED';

export interface ISubmission extends Document {
  businessName: string;
  walletAddress: string;
  subscriptionId: string;
  organizationTier: number;
  requestedProductClass: number;
  collectionName: string;
  description: string;
  royaltyPercent: number;
  uploadedImageCIDs: string[];
  finalImageCID: string | null;
  metadataCID: string | null;
  status: SubmissionStatus;
  assignedDesigner: string | null;
  txHash: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema: Schema = new Schema(
  {
    businessName: { type: String, required: true },
    walletAddress: { type: String, required: true, index: true },
    subscriptionId: { type: String, required: true },
    organizationTier: { type: Number, required: true },
    requestedProductClass: { type: Number, required: true },
    collectionName: { type: String, required: true },
    description: { type: String, required: true },
    royaltyPercent: { type: Number, required: true, min: 0, max: 100 },
    uploadedImageCIDs: [{ type: String }],
    finalImageCID: { type: String, default: null },
    metadataCID: { type: String, default: null },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'READY_FOR_MINT', 'MINTED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    assignedDesigner: { type: String, default: null },
    txHash: { type: String, default: null },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

// Compound indexes for common queries
SubmissionSchema.index({ status: 1, organizationTier: 1 });
SubmissionSchema.index({ walletAddress: 1, status: 1 });

export default mongoose.model<ISubmission>('Submission', SubmissionSchema);
