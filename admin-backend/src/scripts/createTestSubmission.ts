import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../utils/database';
import Submission from '../models/Submission';
import logger from '../utils/logger';

const createTestSubmission = async () => {
  try {
    await connectDB();

    const testSubmission = new Submission({
      businessName: 'Zeus Labs Test',
      walletAddress: '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
      subscriptionId: '1',
      organizationTier: 2,
      requestedProductClass: 1,
      collectionName: 'Zeus Premium Collection',
      description: 'A premium NFT collection showcasing the best of Zeus Labs',
      royaltyPercent: 5,
      uploadedImageCIDs: ['QmTest123', 'QmTest456'],
      finalImageCID: null,
      metadataCID: null,
      status: 'PENDING',
      assignedDesigner: null,
      txHash: null,
      errorMessage: null,
    });

    await testSubmission.save();
    logger.info(`Test submission created: ${testSubmission._id}`);
    
    // Create a few more with different statuses
    const approvedSubmission = new Submission({
      businessName: 'Approved Business',
      walletAddress: '0xcd5801a7d398351b8be11c439e05c5b3259aec9c',
      subscriptionId: '2',
      organizationTier: 3,
      requestedProductClass: 2,
      collectionName: 'Approved Collection',
      description: 'This submission has been approved',
      royaltyPercent: 7,
      uploadedImageCIDs: ['QmApproved1'],
      finalImageCID: null,
      metadataCID: null,
      status: 'APPROVED',
      assignedDesigner: 'designer@nftfactory.com',
      txHash: null,
      errorMessage: null,
    });
    await approvedSubmission.save();

    const readyForMint = new Submission({
      businessName: 'Ready For Mint Co',
      walletAddress: '0xef5801a7d398351b8be11c439e05c5b3259aec9d',
      subscriptionId: '3',
      organizationTier: 1,
      requestedProductClass: 0,
      collectionName: 'Ready Collection',
      description: 'This is ready for minting',
      royaltyPercent: 3,
      uploadedImageCIDs: ['QmReady1'],
      finalImageCID: 'QmFinalArt123',
      metadataCID: 'QmMetadata456',
      status: 'READY_FOR_MINT',
      assignedDesigner: 'designer@nftfactory.com',
      txHash: null,
      errorMessage: null,
    });
    await readyForMint.save();

    logger.info('Test submissions created successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error creating test submission:', error);
    process.exit(1);
  }
};

createTestSubmission();
