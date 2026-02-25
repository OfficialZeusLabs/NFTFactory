import nodemailer from 'nodemailer';

/**
 * Email Notification Service
 * Handles all email notifications for the NFT Factory platform
 */

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
        
        this.fromAddress = process.env.FROM_EMAIL || 'notifications@nftfactory.io';
        this.fromName = process.env.FROM_NAME || 'NFT Factory';
    }

    /**
     * Send email wrapper
     */
    async sendEmail(to, subject, html, text = null) {
        try {
            const info = await this.transporter.sendMail({
                from: `"${this.fromName}" <${this.fromAddress}>`,
                to,
                subject,
                html,
                text: text || this.htmlToText(html)
            });
            
            console.log(`Email sent: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Email send failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Convert HTML to plain text
     */
    htmlToText(html) {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();
    }

    // ==================== SUBMISSION EMAILS ====================

    /**
     * Submission received notification
     */
    async sendSubmissionReceived(email, data) {
        const { submissionId, title, businessName } = data;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #F59E0B;">Submission Received</h2>
                <p>Hello ${businessName},</p>
                <p>Your submission "<strong>${title}</strong>" has been received and is now under review.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Submission ID:</strong> ${submissionId}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Pending Review</p>
                    <p style="margin: 5px 0;"><strong>Expected Review Time:</strong> 48 hours</p>
                </div>
                <p>You will be notified once the review is complete.</p>
                <p>Best regards,<br>NFT Factory Team</p>
            </div>
        `;
        
        return this.sendEmail(email, `Submission Received - ${submissionId}`, html);
    }

    /**
     * Submission approved notification
     */
    async sendSubmissionApproved(email, data) {
        const { submissionId, title, adminComments } = data;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #22c55e;">Submission Approved!</h2>
                <p>Great news! Your submission "<strong>${title}</strong>" has been approved.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Submission ID:</strong> ${submissionId}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Approved</p>
                    <p style="margin: 5px 0;"><strong>Next Step:</strong> Ready for Minting</p>
                </div>
                ${adminComments ? `<p><strong>Admin Comments:</strong> ${adminComments}</p>` : ''}
                <p>Your NFT will be minted within 12 hours.</p>
                <p>Best regards,<br>NFT Factory Team</p>
            </div>
        `;
        
        return this.sendEmail(email, `Submission Approved - ${submissionId}`, html);
    }

    /**
     * Submission rejected notification
     */
    async sendSubmissionRejected(email, data) {
        const { submissionId, title, rejectionReason, rejectionCategory } = data;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ef4444;">Submission Not Approved</h2>
                <p>We regret to inform you that your submission "<strong>${title}</strong>" was not approved.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Submission ID:</strong> ${submissionId}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Rejected</p>
                    <p style="margin: 5px 0;"><strong>Category:</strong> ${rejectionCategory}</p>
                </div>
                <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                    <p style="margin: 0;"><strong>Reason:</strong> ${rejectionReason}</p>
                </div>
                <p>You may submit a new submission addressing these concerns.</p>
                <p>Best regards,<br>NFT Factory Team</p>
            </div>
        `;
        
        return this.sendEmail(email, `Submission Update - ${submissionId}`, html);
    }

    /**
     * Submission needs update notification
     */
    async sendSubmissionNeedsUpdate(email, data) {
        const { submissionId, title, adminComments, requestedChanges } = data;
        
        const changesList = requestedChanges?.map(change => 
            `<li>${change.field}: ${change.requestedChange}</li>`
        ).join('') || '';
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">Updates Required</h2>
                <p>Your submission "<strong>${title}</strong>" requires some updates before approval.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Submission ID:</strong> ${submissionId}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Needs Update</p>
                </div>
                ${adminComments ? `<p><strong>Admin Comments:</strong> ${adminComments}</p>` : ''}
                ${changesList ? `
                    <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0 0 10px 0;"><strong>Requested Changes:</strong></p>
                        <ul style="margin: 0;">${changesList}</ul>
                    </div>
                ` : ''}
                <p>Please resubmit within 24 hours with the requested changes.</p>
                <p>Best regards,<br>NFT Factory Team</p>
            </div>
        `;
        
        return this.sendEmail(email, `Updates Required - ${submissionId}`, html);
    }

    /**
     * NFT minted notification
     */
    async sendNFTMinted(email, data) {
        const { submissionId, title, tokenId, contractAddress, txHash, tokenURI } = data;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #22c55e;">NFT Minted Successfully!</h2>
                <p>Congratulations! Your NFT "<strong>${title}</strong>" has been minted.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Token ID:</strong> ${tokenId}</p>
                    <p style="margin: 5px 0;"><strong>Contract:</strong> ${contractAddress}</p>
                    <p style="margin: 5px 0;"><strong>Transaction:</strong> <a href="https://sepolia.basescan.org/tx/${txHash}" target="_blank">View on BaseScan</a></p>
                </div>
                <p>Your NFT is now live on the marketplace!</p>
                <p>Best regards,<br>NFT Factory Team</p>
            </div>
        `;
        
        return this.sendEmail(email, `NFT Minted - ${title}`, html);
    }

    // ==================== REDEMPTION EMAILS ====================

    /**
     * Redemption requested notification (to seller)
     */
    async sendRedemptionRequested(email, data) {
        const { redemptionId, tokenId, title, buyerWallet, requestDate } = data;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #F59E0B;">New Redemption Request</h2>
                <p>You have received a redemption request for your NFT.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>NFT:</strong> ${title}</p>
                    <p style="margin: 5px 0;"><strong>Token ID:</strong> ${tokenId}</p>
                    <p style="margin: 5px 0;"><strong>Buyer:</strong> ${buyerWallet}</p>
                    <p style="margin: 5px 0;"><strong>Request Date:</strong> ${new Date(requestDate).toLocaleString()}</p>
                </div>
                <p>Please respond to this request within 7 days.</p>
                <p><a href="${process.env.APP_URL}/dashboard/redemptions" style="background: #F59E0B; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Redemption</a></p>
                <p>Best regards,<br>NFT Factory Team</p>
            </div>
        `;
        
        return this.sendEmail(email, `Redemption Request - ${title}`, html);
    }

    /**
     * Redemption accepted notification (to buyer)
     */
    async sendRedemptionAccepted(email, data) {
        const { redemptionId, tokenId, title, sellerMessage, estimatedDate } = data;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #22c55e;">Redemption Accepted!</h2>
                <p>Great news! Your redemption request for "<strong>${title}</strong>" has been accepted.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Token ID:</strong> ${tokenId}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Accepted</p>
                    ${estimatedDate ? `<p style="margin: 5px 0;"><strong>Estimated Fulfillment:</strong> ${new Date(estimatedDate).toLocaleDateString()}</p>` : ''}
                </div>
                ${sellerMessage ? `<p><strong>Message from Seller:</strong> ${sellerMessage}</p>` : ''}
                <p>You will receive tracking information once your item ships.</p>
                <p>Best regards,<br>NFT Factory Team</p>
            </div>
        `;
        
        return this.sendEmail(email, `Redemption Accepted - ${title}`, html);
    }

    /**
     * Redemption declined notification (to buyer)
     */
    async sendRedemptionDeclined(email, data) {
        const { redemptionId, tokenId, title, declineReason, declineCategory } = data;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ef4444;">Redemption Declined</h2>
                <p>We regret to inform you that your redemption request for "<strong>${title}</strong>" was declined.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Token ID:</strong> ${tokenId}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Declined</p>
                    <p style="margin: 5px 0;"><strong>Category:</strong> ${declineCategory}</p>
                </div>
                <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                    <p style="margin: 0;"><strong>Reason:</strong> ${declineReason}</p>
                </div>
                <p>Your NFT remains in your wallet. If you believe this was an error, please contact support.</p>
                <p>Best regards,<br>NFT Factory Team</p>
            </div>
        `;
        
        return this.sendEmail(email, `Redemption Update - ${title}`, html);
    }

    /**
     * Redemption completed notification
     */
    async sendRedemptionCompleted(email, data) {
        const { redemptionId, tokenId, title, burnTxHash } = data;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #22c55e;">Redemption Completed!</h2>
                <p>Your redemption for "<strong>${title}</strong>" has been completed successfully.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Token ID:</strong> ${tokenId}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Completed</p>
                    <p style="margin: 5px 0;"><strong>Burn Transaction:</strong> <a href="https://sepolia.basescan.org/tx/${burnTxHash}" target="_blank">View on BaseScan</a></p>
                </div>
                <p>Thank you for using NFT Factory. We hope you enjoy your redeemed item!</p>
                <p>Best regards,<br>NFT Factory Team</p>
            </div>
        `;
        
        return this.sendEmail(email, `Redemption Completed - ${title}`, html);
    }

    // ==================== SYSTEM EMAILS ====================

    /**
     * Trust score update notification
     */
    async sendTrustScoreUpdate(email, data) {
        const { businessName, oldScore, newScore, badgeLevel, badgeAchieved } = data;
        
        const scoreChange = newScore - oldScore;
        const changeText = scoreChange > 0 ? `+${scoreChange}` : `${scoreChange}`;
        const changeColor = scoreChange > 0 ? '#22c55e' : (scoreChange < 0 ? '#ef4444' : '#6b7280');
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #F59E0B;">Trust Score Update</h2>
                <p>Hello ${businessName},</p>
                <p>Your trust score has been updated.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <p style="margin: 5px 0; font-size: 14px; color: #6b7280;">Previous Score</p>
                    <p style="margin: 5px 0; font-size: 24px; font-weight: bold;">${oldScore}</p>
                    <p style="margin: 10px 0; font-size: 20px; color: ${changeColor};">${changeText}</p>
                    <p style="margin: 5px 0; font-size: 14px; color: #6b7280;">New Score</p>
                    <p style="margin: 5px 0; font-size: 36px; font-weight: bold; color: #F59E0B;">${newScore}</p>
                </div>
                ${badgeAchieved ? `
                    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #22c55e;">
                        <p style="margin: 0; font-size: 18px; color: #22c55e;">🎉 New Badge Achieved: ${badgeLevel}!</p>
                    </div>
                ` : `<p style="text-align: center;">Current Badge Level: <strong>${badgeLevel}</strong></p>`}
                <p>Best regards,<br>NFT Factory Team</p>
            </div>
        `;
        
        return this.sendEmail(email, 'Trust Score Update', html);
    }

    /**
     * Self-mint eligibility notification
     */
    async sendSelfMintUnlocked(email, data) {
        const { businessName } = data;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #22c55e;">Self-Mint Unlocked! 🎉</h2>
                <p>Congratulations ${businessName}!</p>
                <p>You have unlocked <strong>Self-Minting</strong> privileges on NFT Factory.</p>
                <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #22c55e;">
                    <p style="margin: 0; font-size: 16px;">What this means:</p>
                    <ul style="margin: 10px 0;">
                        <li>Mint NFTs without admin approval</li>
                        <li>Faster time to market</li>
                        <li>Still subject to automated compliance checks</li>
                    </ul>
                </div>
                <p>This privilege was earned through your excellent track record and high trust score.</p>
                <p><a href="${process.env.APP_URL}/dashboard" style="background: #22c55e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a></p>
                <p>Best regards,<br>NFT Factory Team</p>
            </div>
        `;
        
        return this.sendEmail(email, 'Self-Mint Unlocked!', html);
    }

    /**
     * SLA violation warning
     */
    async sendSLAViolationWarning(email, data) {
        const { businessName, submissionId, title, hoursOverdue } = data;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ef4444;">Action Required: SLA Violation</h2>
                <p>Hello ${businessName},</p>
                <p>A submission requires your attention.</p>
                <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                    <p style="margin: 5px 0;"><strong>Submission:</strong> ${title}</p>
                    <p style="margin: 5px 0;"><strong>ID:</strong> ${submissionId}</p>
                    <p style="margin: 5px 0;"><strong>Overdue by:</strong> ${hoursOverdue} hours</p>
                </div>
                <p>Please take action immediately to avoid impact on your trust score.</p>
                <p><a href="${process.env.APP_URL}/dashboard/submissions" style="background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Submission</a></p>
                <p>Best regards,<br>NFT Factory Team</p>
            </div>
        `;
        
        return this.sendEmail(email, `Action Required: ${submissionId}`, html);
    }
}

export default new EmailService();
