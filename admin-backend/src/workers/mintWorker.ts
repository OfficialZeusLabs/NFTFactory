import cron from 'node-cron';
import Submission from '../models/Submission';
import blockchainService from '../services/blockchainService';
import logger from '../utils/logger';

// Poll every 5 minutes for submissions ready to mint
const MINT_POLL_INTERVAL = '*/5 * * * *';

export const startMintWorker = () => {
  logger.info('Starting mint automation worker...');

  cron.schedule(MINT_POLL_INTERVAL, async () => {
    logger.info('Mint worker: Checking for submissions ready to mint...');

    try {
      // Find all submissions ready for mint
      const submissions = await Submission.find({
        status: 'READY_FOR_MINT',
        metadataCID: { $ne: null },
      }).limit(10);

      logger.info(`Found ${submissions.length} submissions ready for mint`);

      for (const submission of submissions) {
        try {
          // Update status to indicate minting in progress
          submission.status = 'MINTED';
          await submission.save();

          // Call blockchain service to mint
          const mintResult = await blockchainService.mintCollection(
            submission.collectionName,
            submission.collectionName.substring(0, 3).toUpperCase(), // Simple symbol
            [`ipfs://${submission.metadataCID}`], // URI
            ['0'], // Free mint for curated submissions
            submission.requestedProductClass
          );

          if (mintResult.success) {
            submission.txHash = mintResult.txHash || null;
            submission.status = 'MINTED';
            await submission.save();
            logger.info(`Successfully minted submission ${submission._id}: ${mintResult.txHash}`);
          } else {
            submission.status = 'FAILED';
            submission.errorMessage = mintResult.error || 'Minting failed';
            await submission.save();
            logger.error(`Failed to mint submission ${submission._id}: ${mintResult.error}`);
          }
        } catch (error: any) {
          submission.status = 'FAILED';
          submission.errorMessage = error.message || 'Unknown error';
          await submission.save();
          logger.error(`Error minting submission ${submission._id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in mint worker:', error);
    }
  });
};

// Manual mint function for testing or admin use
export const mintSubmission = async (submissionId: string) => {
  const submission = await Submission.findById(submissionId);

  if (!submission) {
    throw new Error('Submission not found');
  }

  if (submission.status !== 'READY_FOR_MINT') {
    throw new Error(`Submission status is ${submission.status}, expected READY_FOR_MINT`);
  }

  const mintResult = await blockchainService.mintCollection(
    submission.collectionName,
    submission.collectionName.substring(0, 3).toUpperCase(),
    [`ipfs://${submission.metadataCID}`],
    ['0'],
    submission.requestedProductClass
  );

  if (mintResult.success) {
    submission.txHash = mintResult.txHash || null;
    submission.status = 'MINTED';
    await submission.save();
    return { success: true, txHash: mintResult.txHash };
  } else {
    submission.status = 'FAILED';
    submission.errorMessage = mintResult.error || 'Minting failed';
    await submission.save();
    return { success: false, error: mintResult.error };
  }
};

// If running directly
if (require.main === module) {
  startMintWorker();
}
