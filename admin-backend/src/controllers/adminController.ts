import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Submission from '../models/Submission';
import AdminUser from '../models/AdminUser';
import ipfsService from '../services/ipfsService';
import logger from '../utils/logger';

// Admin Authentication
export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const admin = await AdminUser.findOne({ email: email.toLowerCase() });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user is approved
    if (admin.status === 'PENDING') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval. Please wait for an administrator to approve your account.',
        status: 'PENDING',
      });
    }

    if (admin.status === 'REJECTED') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been rejected. Please contact support for more information.',
        status: 'REJECTED',
        rejectionReason: admin.rejectionReason,
      });
    }

    if (admin.status === 'SUSPENDED' || !admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact support.',
        status: 'SUSPENDED',
      });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: admin._id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
    );

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: admin._id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          status: admin.status,
        },
      },
    });
  } catch (error) {
    logger.error('Error in admin login:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Public Signup - Creates a pending admin user
export const adminSignup = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role = 'OPS' } = req.body;

    // Check if user exists
    const existingUser = await AdminUser.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const admin = new AdminUser({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role,
      isActive: false, // Pending approval
      status: 'PENDING',
    });

    await admin.save();

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Waiting for admin approval.',
      data: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        status: admin.status,
      },
    });
  } catch (error) {
    logger.error('Error in admin signup:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Super Admin/Admin creates a new user (immediate approval)
export const createAdminUser = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;
    const createdBy = (req as any).user?.userId; // From auth middleware

    // Check if user exists
    const existingUser = await AdminUser.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const admin = new AdminUser({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role,
      isActive: true,
      status: 'APPROVED',
      approvedBy: createdBy,
      approvedAt: new Date(),
    });

    await admin.save();

    return res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        status: admin.status,
      },
    });
  } catch (error) {
    logger.error('Error creating admin user:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get all pending users (for Super Admin/Admin approval)
export const getPendingUsers = async (req: Request, res: Response) => {
  try {
    const pendingUsers = await AdminUser.find({ status: 'PENDING' })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: pendingUsers,
    });
  } catch (error) {
    logger.error('Error fetching pending users:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Approve a pending user
export const approveUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const approvedBy = (req as any).user?.userId;

    const user = await AdminUser.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve user with status: ${user.status}`,
      });
    }

    user.status = 'APPROVED';
    user.isActive = true;
    user.approvedBy = approvedBy;
    user.approvedAt = new Date();
    await user.save();

    logger.info(`User ${userId} approved by admin ${approvedBy}`);

    return res.status(200).json({
      success: true,
      message: 'User approved successfully',
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        status: user.status,
      },
    });
  } catch (error) {
    logger.error('Error approving user:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Reject a pending user
export const rejectUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await AdminUser.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject user with status: ${user.status}`,
      });
    }

    user.status = 'REJECTED';
    user.isActive = false;
    user.rejectionReason = reason;
    await user.save();

    logger.info(`User ${userId} rejected. Reason: ${reason}`);

    return res.status(200).json({
      success: true,
      message: 'User rejected',
      data: {
        id: user._id,
        email: user.email,
        status: user.status,
        rejectionReason: user.rejectionReason,
      },
    });
  } catch (error) {
    logger.error('Error rejecting user:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Admin Dashboard - Submissions
export const getAllSubmissions = async (req: Request, res: Response) => {
  try {
    const { status, organizationTier, requestedProductClass, page = 1, limit = 20 } = req.query;

    const query: any = {};

    if (status) query.status = status;
    if (organizationTier) query.organizationTier = Number(organizationTier);
    if (requestedProductClass) query.requestedProductClass = Number(requestedProductClass);

    const skip = (Number(page) - 1) * Number(limit);

    const submissions = await Submission.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Submission.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        submissions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching submissions:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getSubmissionDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    logger.error('Error fetching submission details:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Admin Actions
export const approveSubmission = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assignedDesigner } = req.body;

    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    if (submission.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve submission with status: ${submission.status}`,
      });
    }

    submission.status = 'APPROVED';
    submission.assignedDesigner = assignedDesigner || null;
    await submission.save();

    logger.info(`Submission ${id} approved by admin`);

    return res.status(200).json({
      success: true,
      message: 'Submission approved successfully',
      data: submission,
    });
  } catch (error) {
    logger.error('Error approving submission:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const rejectSubmission = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    if (submission.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject submission with status: ${submission.status}`,
      });
    }

    submission.status = 'REJECTED';
    submission.errorMessage = reason;
    await submission.save();

    logger.info(`Submission ${id} rejected by admin`);

    return res.status(200).json({
      success: true,
      message: 'Submission rejected successfully',
      data: submission,
    });
  } catch (error) {
    logger.error('Error rejecting submission:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const assignDesigner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { designerId } = req.body;

    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    submission.assignedDesigner = designerId;
    await submission.save();

    return res.status(200).json({
      success: true,
      message: 'Designer assigned successfully',
      data: submission,
    });
  } catch (error) {
    logger.error('Error assigning designer:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Designer Actions
export const uploadFinalArtwork = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    if (submission.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: `Cannot upload artwork for submission with status: ${submission.status}`,
      });
    }

    // Handle file upload (assuming multer middleware)
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided',
      });
    }

    // Upload to IPFS
    const cid = await ipfsService.uploadImage(req.file.buffer, req.file.originalname);

    if (!cid) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload image to IPFS',
      });
    }

    submission.finalImageCID = cid;
    await submission.save();

    logger.info(`Final artwork uploaded for submission ${id}: ${cid}`);

    return res.status(200).json({
      success: true,
      message: 'Artwork uploaded successfully',
      data: {
        cid,
        ipfsUrl: ipfsService.getIPFSUrl(cid),
      },
    });
  } catch (error) {
    logger.error('Error uploading final artwork:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const generateMetadata = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    if (!submission.finalImageCID) {
      return res.status(400).json({
        success: false,
        message: 'Final artwork not uploaded yet',
      });
    }

    // Generate metadata
    const metadata = ipfsService.generateMetadata(
      submission.collectionName,
      submission.description,
      submission.finalImageCID,
      submission.organizationTier,
      submission.requestedProductClass,
      submission.royaltyPercent
    );

    // Upload metadata to IPFS
    const metadataCID = await ipfsService.uploadMetadata(metadata);

    if (!metadataCID) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload metadata to IPFS',
      });
    }

    submission.metadataCID = metadataCID;
    submission.status = 'READY_FOR_MINT';
    await submission.save();

    logger.info(`Metadata generated for submission ${id}: ${metadataCID}`);

    return res.status(200).json({
      success: true,
      message: 'Metadata generated successfully',
      data: {
        metadataCID,
        ipfsUrl: ipfsService.getIPFSUrl(metadataCID),
        metadata,
      },
    });
  } catch (error) {
    logger.error('Error generating metadata:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Analytics
export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const totalSubmissions = await Submission.countDocuments();
    const pendingSubmissions = await Submission.countDocuments({ status: 'PENDING' });
    const approvedSubmissions = await Submission.countDocuments({ status: 'APPROVED' });
    const readyForMint = await Submission.countDocuments({ status: 'READY_FOR_MINT' });
    const mintedSubmissions = await Submission.countDocuments({ status: 'MINTED' });
    const rejectedSubmissions = await Submission.countDocuments({ status: 'REJECTED' });

    // Submissions by tier
    const submissionsByTier = await Submission.aggregate([
      { $group: { _id: '$organizationTier', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Recent submissions
    const recentSubmissions = await Submission.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('businessName collectionName status createdAt');

    return res.status(200).json({
      success: true,
      data: {
        counts: {
          total: totalSubmissions,
          pending: pendingSubmissions,
          approved: approvedSubmissions,
          readyForMint,
          minted: mintedSubmissions,
          rejected: rejectedSubmissions,
        },
        byTier: submissionsByTier,
        recent: recentSubmissions,
      },
    });
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
