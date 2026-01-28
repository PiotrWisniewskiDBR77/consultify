/**
 * Welcome Email Service
 * GAP-AUTH-003: Send welcome email to new users
 */

import logger from '../utils/Logger.js';

interface WelcomeEmailData {
  email: string;
  firstName: string;
  companyName: string;
  isDemo?: boolean;
}

/**
 * Send welcome email to new user
 */
async function sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
  try {
    const EmailService = (await import('./emailService.js')).default;

    await EmailService.send({
      to: data.email,
      subject: `Welcome to Consultinity${data.isDemo ? ' (Demo Account)' : ''} 🎉`,
      html: generateWelcomeEmailHtml(data),
    });

    logger.info(`[WelcomeEmail] Welcome email sent to ${data.email}`);
  } catch (err) {
    logger.error('[WelcomeEmail] Failed to send welcome email:', err);
    throw err;
  }
}

/**
 * Generate welcome email HTML
 */
function generateWelcomeEmailHtml(data: WelcomeEmailData): string {
  const appUrl = process.env.FRONTEND_URL || 'https://app.consultinity.com';

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0; }
        .content { padding: 40px 30px; background: #fff; }
        .feature-grid { display: flex; flex-wrap: wrap; gap: 20px; margin: 30px 0; }
        .feature { flex: 1 1 45%; background: #f8fafc; border-radius: 8px; padding: 20px; }
        .feature-icon { font-size: 24px; margin-bottom: 10px; }
        .feature h3 { margin: 0 0 8px; font-size: 16px; color: #1f2937; }
        .feature p { margin: 0; font-size: 14px; color: #6b7280; }
        .cta-button { display: inline-block; background: #667eea; color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0; }
        .footer { background: #f8fafc; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
        .footer a { color: #667eea; }
        .demo-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-left: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Consultinity! 🎉</h1>
            <p>Your AI-powered consulting platform is ready</p>
            ${data.isDemo ? '<span class="demo-badge">Demo Account</span>' : ''}
        </div>
        
        <div class="content">
            <p>Hi ${data.firstName},</p>
            
            <p>Thank you for joining Consultinity! We're excited to have <strong>${data.companyName}</strong> on board.</p>
            
            ${
              data.isDemo
                ? `
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>🧪 Demo Account</strong><br>
                <p style="margin: 10px 0 0; font-size: 14px;">You're using a demo account with sample data. Explore freely - all features are available!</p>
            </div>
            `
                : ''
            }
            
            <h2 style="color: #1f2937;">Here's what you can do:</h2>
            
            <div class="feature-grid">
                <div class="feature">
                    <div class="feature-icon">📊</div>
                    <h3>Run Assessments</h3>
                    <p>Evaluate projects, teams, and processes with AI-powered analysis</p>
                </div>
                <div class="feature">
                    <div class="feature-icon">🤖</div>
                    <h3>AI Assistant</h3>
                    <p>Get instant insights and recommendations from your AI consultant</p>
                </div>
                <div class="feature">
                    <div class="feature-icon">📈</div>
                    <h3>Analytics Dashboard</h3>
                    <p>Track progress and measure impact across your organization</p>
                </div>
                <div class="feature">
                    <div class="feature-icon">👥</div>
                    <h3>Team Collaboration</h3>
                    <p>Work together with your team on initiatives and decisions</p>
                </div>
            </div>
            
            <div style="text-align: center;">
                <a href="${appUrl}/dashboard" class="cta-button">Go to Dashboard →</a>
            </div>
            
            <h2 style="color: #1f2937; margin-top: 40px;">Need help getting started?</h2>
            <ul style="padding-left: 20px;">
                <li><a href="${appUrl}/help">Visit our Help Center</a></li>
                <li><a href="${appUrl}/settings/team">Invite your team members</a></li>
                <li><a href="mailto:support@consultinity.com">Contact our support team</a></li>
            </ul>
            
            <p style="margin-top: 30px;">We're here to help you succeed!</p>
            
            <p>Best regards,<br>
            <strong>The Consultinity Team</strong></p>
        </div>
        
        <div class="footer">
            <p>© ${new Date().getFullYear()} Consultinity. All rights reserved.</p>
            <p>
                <a href="${appUrl}/settings">Settings</a> • 
                <a href="${appUrl}/help">Help</a> • 
                <a href="mailto:support@consultinity.com">Contact Us</a>
            </p>
            <p style="font-size: 12px; color: #9ca3af;">
                DBR77 Consultinity Sp. z o.o. | Warsaw, Poland
            </p>
        </div>
    </div>
</body>
</html>
    `;
}

export default {
  sendWelcomeEmail,
};

export { sendWelcomeEmail };
