/**
 * Partner Email Service
 * GAP-PARTNER-008: Email notifications for partners
 *
 * Sends notifications for:
 * - New referral attribution (partner-new-referral)
 * - Commission earned (partner-commission-earned)
 * - Discount expiring (admin-discount-expiring)
 */

import logger from '../utils/Logger.js';
import * as EmailService from './emailService.js';

// ==========================================
// TYPES
// ==========================================

interface PartnerEmailData {
  partnerEmail: string;
  partnerName: string;
}

interface NewReferralEmailData extends PartnerEmailData {
  organizationName: string;
  referralCode: string;
  attributionDate: string;
}

interface CommissionEarnedEmailData extends PartnerEmailData {
  organizationName: string;
  grossAmount: number;
  commissionAmount: number;
  commissionRate: number;
  currency: string;
  transactionDate: string;
}

interface DiscountExpiringEmailData {
  adminEmail: string;
  adminName: string;
  organizationName: string;
  partnerName: string;
  discountPercent: number;
  expiryDate: string;
  daysRemaining: number;
}

// ==========================================
// EMAIL TEMPLATES
// ==========================================

function getNewReferralTemplate(data: NewReferralEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #7c3aed, #6366f1); padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .highlight { background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 New Referral!</h1>
        </div>
        <div class="content">
            <p>Hi ${data.partnerName},</p>
            
            <p>Great news! A new organization has signed up using your referral code.</p>
            
            <div class="highlight">
                <strong>Organization:</strong> ${data.organizationName}<br>
                <strong>Referral Code:</strong> ${data.referralCode}<br>
                <strong>Date:</strong> ${new Date(data.attributionDate).toLocaleDateString('en-US', { dateStyle: 'long' })}
            </div>
            
            <p>This referral has been attributed to your partner account. You'll earn commissions on any payments they make during the attribution period.</p>
            
            <p>Log in to your Partner Portal to view your referral analytics and earnings.</p>
            
            <p>Best regards,<br>The Consultify Partner Team</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} Consultify. All rights reserved.</p>
            <p>You're receiving this email because you're a registered partner.</p>
        </div>
    </div>
</body>
</html>
    `;
}

function getCommissionEarnedTemplate(data: CommissionEarnedEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .amount-box { background: white; border: 2px solid #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .amount { font-size: 36px; font-weight: bold; color: #10b981; }
        .details { background: #f3f4f6; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💰 Commission Earned!</h1>
        </div>
        <div class="content">
            <p>Hi ${data.partnerName},</p>
            
            <p>You've earned a commission from a customer payment!</p>
            
            <div class="amount-box">
                <div class="amount">${data.currency} ${data.commissionAmount.toFixed(2)}</div>
                <div>Commission Earned</div>
            </div>
            
            <div class="details">
                <strong>Transaction Details:</strong><br>
                Customer: ${data.organizationName}<br>
                Gross Amount: ${data.currency} ${data.grossAmount.toFixed(2)}<br>
                Commission Rate: ${data.commissionRate}%<br>
                Date: ${new Date(data.transactionDate).toLocaleDateString('en-US', { dateStyle: 'long' })}
            </div>
            
            <p>This commission will be added to your pending earnings and included in your next payout.</p>
            
            <p>Best regards,<br>The Consultify Partner Team</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} Consultify. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
}

function getDiscountExpiringTemplate(data: DiscountExpiringEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .details { background: #f3f4f6; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Discount Expiring Soon</h1>
        </div>
        <div class="content">
            <p>Hi ${data.adminName},</p>
            
            <p>This is a reminder that your partner discount is expiring soon.</p>
            
            <div class="warning-box">
                <strong>Your ${data.discountPercent}% discount expires in ${data.daysRemaining} days!</strong>
            </div>
            
            <div class="details">
                <strong>Discount Details:</strong><br>
                Organization: ${data.organizationName}<br>
                Partner: ${data.partnerName}<br>
                Discount: ${data.discountPercent}% off<br>
                Expiry Date: ${new Date(data.expiryDate).toLocaleDateString('en-US', { dateStyle: 'long' })}
            </div>
            
            <p>After this date, your subscription will be billed at the regular rate. Contact your partner or our support team if you have questions about renewing your discount.</p>
            
            <p>Best regards,<br>The Consultify Team</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} Consultify. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
}

// ==========================================
// PUBLIC FUNCTIONS
// ==========================================

/**
 * Send notification when a new referral is attributed
 */
export async function sendNewReferralNotification(data: NewReferralEmailData): Promise<boolean> {
  try {
    const result = await EmailService.send({
      to: data.partnerEmail,
      subject: `🎉 New Referral: ${data.organizationName}`,
      html: getNewReferralTemplate(data),
    });

    if (result) {
      logger.info(`[PartnerEmailService] New referral notification sent to ${data.partnerEmail}`);
    }
    return result;
  } catch (err: any) {
    logger.error('[PartnerEmailService] Failed to send new referral notification:', err);
    return false;
  }
}

/**
 * Send notification when a commission is earned
 */
export async function sendCommissionEarnedNotification(
  data: CommissionEarnedEmailData
): Promise<boolean> {
  try {
    const result = await EmailService.send({
      to: data.partnerEmail,
      subject: `💰 Commission Earned: ${data.currency} ${data.commissionAmount.toFixed(2)}`,
      html: getCommissionEarnedTemplate(data),
    });

    if (result) {
      logger.info(`[PartnerEmailService] Commission notification sent to ${data.partnerEmail}`);
    }
    return result;
  } catch (err: any) {
    logger.error('[PartnerEmailService] Failed to send commission notification:', err);
    return false;
  }
}

/**
 * Send notification when a discount is expiring
 */
export async function sendDiscountExpiringNotification(
  data: DiscountExpiringEmailData
): Promise<boolean> {
  try {
    const result = await EmailService.send({
      to: data.adminEmail,
      subject: `⚠️ Your Partner Discount Expires in ${data.daysRemaining} Days`,
      html: getDiscountExpiringTemplate(data),
    });

    if (result) {
      logger.info(
        `[PartnerEmailService] Discount expiring notification sent to ${data.adminEmail}`
      );
    }
    return result;
  } catch (err: any) {
    logger.error('[PartnerEmailService] Failed to send discount expiring notification:', err);
    return false;
  }
}

// Export as default object for compatibility
const PartnerEmailService = {
  sendNewReferralNotification,
  sendCommissionEarnedNotification,
  sendDiscountExpiringNotification,
};

export default PartnerEmailService;
