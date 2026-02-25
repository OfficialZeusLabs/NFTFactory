import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'DESIGNER' | 'OPS';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface IAdminUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  isActive: boolean;
  status: UserStatus;
  approvedBy: mongoose.Types.ObjectId | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AdminUserSchema: Schema = new Schema(
  {
    email: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'DESIGNER', 'OPS'],
      default: 'OPS',
      required: true,
    },
    name: { type: String, required: true },
    isActive: { type: Boolean, default: false }, // Inactive until approved
    status: { 
      type: String, 
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
      default: 'PENDING',
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);
