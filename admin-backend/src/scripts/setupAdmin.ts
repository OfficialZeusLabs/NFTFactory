import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import connectDB from '../utils/database';
import AdminUser from '../models/AdminUser';
import logger from '../utils/logger';

const setupAdmin = async () => {
  try {
    await connectDB();

    const email = process.env.ADMIN_EMAIL || 'admin@nftfactory.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const name = 'Admin User';

    // Check if admin already exists
    const existingAdmin = await AdminUser.findOne({ email });
    if (existingAdmin) {
      logger.info(`Admin user ${email} already exists`);
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create admin
    const admin = new AdminUser({
      email,
      passwordHash,
      name,
      role: 'ADMIN',
      isActive: true,
    });

    await admin.save();
    logger.info(`Admin user created: ${email}`);
    process.exit(0);
  } catch (error) {
    logger.error('Error setting up admin:', error);
    process.exit(1);
  }
};

setupAdmin();
