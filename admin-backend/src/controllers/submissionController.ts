import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import Submission from '../models/Submission';
import blockchainService from '../services/blockchainService';
import ipfsService from '../services/ipfsService';
import logger from '../utils/logger';

export const createSubmission = async (req: Request, res: Response) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      businessName,
      walletAddress,
      subscriptionId,
      requestedProductClass,
      collectionName,
      description,
      royaltyPercent,
      uploadedImages,
      contactEmail,
    } = req.body;

    // 1. Validate wallet owns subscription NFT (on-chain)
    const subscriptionValidation = await blockchainService.validateSubscription(walletAddress);
    
    if (!subscriptionValidation.isValid) {
      return res.status(403).json({
        success: false,
        message: subscriptionValidation.error || 'Invalid subscription',
      });
    }

    // 2. Validate subscription ID matches
    if (subscriptionValidation.subscriptionId !== subscriptionId) {
      return res.status(403).json({
        success: false,
        message: 'Subscription ID mismatch',
      });
    }

    // 3. Validate requestedProductClass <= organizationTier
    const productClassValidation = await blockchainService.validateProductClass(
      walletAddress,
      requestedProductClass
    );

    if (!productClassValidation.isValid) {
      return res.status(403).json({
        success: false,
        message: productClassValidation.error,
      });
    }

    // 4. Upload raw images to IPFS if provided
    const uploadedImageCIDs: string[] = [];
    
    if (uploadedImages && Array.isArray(uploadedImages) && uploadedImages.length > 0) {
      // Handle base64 images or file uploads
      for (const image of uploadedImages) {
        if (typeof image === 'string' && image.startsWith('data:')) {
          // Base64 image
          const base64Data = image.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          const cid = await ipfsService.uploadImage(buffer, `submission-${Date.now()}.png`);
          if (cid) {
            uploadedImageCIDs.push(cid);
          }
        } else if (typeof image === 'string') {
          // Already a CID
          uploadedImageCIDs.push(image);
        }
      }
    }

    // 5. Create submission in MongoDB
    const submission = new Submission({
      businessName,
      walletAddress: walletAddress.toLowerCase(),
      subscriptionId,
      organizationTier: subscriptionValidation.organizationTier,
      requestedProductClass,
      collectionName,
      description,
      royaltyPercent,
      uploadedImageCIDs,
      finalImageCID: null,
      metadataCID: null,
      status: 'PENDING',
      assignedDesigner: null,
      txHash: null,
      errorMessage: null,
    });

    await submission.save();

    logger.info(`New submission created: ${submission._id} by ${walletAddress}`);

    return res.status(201).json({
      success: true,
      message: 'Submission created successfully',
      data: {
        submissionId: submission._id,
        status: submission.status,
        organizationTier: submission.organizationTier,
        remainingQuota: subscriptionValidation.remainingQuota,
      },
    });
  } catch (error) {
    logger.error('Error creating submission:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getBusinessSubmissions = async (req: Request, res: Response) => {
  try {
    const { wallet } = req.query;

    if (!wallet || typeof wallet !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required',
      });
    }

    // TODO: Add signature verification for authentication
    // For now, we return submissions for the wallet

    const submissions = await Submission.find({
      walletAddress: wallet.toLowerCase(),
    })
      .select('_id collectionName requestedProductClass organizationTier status txHash createdAt updatedAt')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    logger.error('Error fetching business submissions:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getSubmissionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { wallet } = req.query;

    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    // Verify wallet ownership
    if (wallet && submission.walletAddress !== (wallet as string).toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    return res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    logger.error('Error fetching submission:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
