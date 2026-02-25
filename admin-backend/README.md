# NFT Factory Curated Minting Backend

A comprehensive backend system for NFT Factory's curated minting workflow, including admin dashboard, designer workflow, and automated minting.

## Architecture

```
Frontend Form → Backend API → MongoDB Atlas → Admin Dashboard → Designer Upload → IPFS → Mint Worker → On-chain
```

## Features

### 1. Submission API
- **POST /api/submissions** - Create new submission with on-chain validation
- Validates subscription ownership, tier limits, and mint quotas
- Uploads images to IPFS

### 2. Business Dashboard API
- **GET /api/business/submissions?wallet=<address>** - Get submissions for a wallet
- Signature-based authentication
- Status tracking: PENDING → APPROVED → READY_FOR_MINT → MINTED

### 3. Admin Dashboard API
- JWT-based authentication with role-based access control
- Full submission management (approve, reject, assign designer)
- Analytics dashboard

### 4. Designer Workflow
- Upload finalized artwork to IPFS
- Generate metadata JSON and upload to IPFS
- Mark submissions as READY_FOR_MINT

### 5. Mint Automation Worker
- Background worker polling for READY_FOR_MINT submissions
- Automated on-chain minting via FactoryV2 contract
- Transaction tracking and error handling

## Quick Start

### 1. Install Dependencies
```bash
cd admin-backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Start Mint Worker (separate terminal)
```bash
npm run worker
```

## Environment Variables

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://...

# JWT
JWT_SECRET=your-secret
JWT_EXPIRES_IN=7d

# IPFS (Pinata)
PINATA_API_KEY=...
PINATA_SECRET_KEY=...
PINATA_JWT=...

# Blockchain
RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your-private-key
FACTORY_V2_ADDRESS=0x...
SUBSCRIPTION_NFT_ADDRESS=0x...

# Server
PORT=3001
NODE_ENV=development
```

## API Endpoints

### Public
- `POST /api/submissions` - Create submission
- `GET /api/business/submissions?wallet=` - Get business submissions
- `GET /api/submissions/:id` - Get submission details

### Admin (requires JWT)
- `POST /api/admin/login` - Admin login
- `GET /api/admin/submissions` - List all submissions
- `GET /api/admin/submissions/:id` - Get submission details
- `POST /api/admin/submissions/:id/approve` - Approve submission
- `POST /api/admin/submissions/:id/reject` - Reject submission
- `POST /api/admin/submissions/:id/assign-designer` - Assign designer
- `POST /api/admin/submissions/:id/upload-artwork` - Upload final artwork
- `POST /api/admin/submissions/:id/generate-metadata` - Generate metadata
- `GET /api/admin/analytics` - Get analytics

## Database Schema

### Submissions
```typescript
{
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'READY_FOR_MINT' | 'MINTED' | 'FAILED'
  assignedDesigner: string | null
  txHash: string | null
  errorMessage: string | null
}
```

### Admin Users
```typescript
{
  email: string
  passwordHash: string
  role: 'ADMIN' | 'DESIGNER' | 'OPS'
  name: string
  isActive: boolean
}
```

## Deployment

### Vercel
```bash
npm run build
vercel --prod
```

### Railway/Render
1. Connect GitHub repository
2. Set environment variables
3. Deploy

## Security Considerations

- All admin endpoints require JWT authentication
- Role-based access control (ADMIN, DESIGNER, OPS)
- Rate limiting on all endpoints
- On-chain validation before accepting submissions
- Password hashing with bcrypt
- Helmet.js for security headers
