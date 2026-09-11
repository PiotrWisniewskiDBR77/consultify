/**
 * Welcome Email Service
 * GAP-AUTH-003: Send welcome email to new users
 *
 * DEC-461 (2026-09-10 evening): English is the default language for this
 * email; Polish is a translation selected per recipient (see
 * `onboardingEmailLocale.ts`). Was hardcoded Polish only
 * (commit 0bfffeac4e) — that predates DEC-461 and did not offer English.
 */

import logger from '../utils/Logger.js';
import { t } from './email/onboardingEmailCopy.js';
import {
  getOnboardingEmailLangForUser,
  type OnboardingEmailLang,
} from './email/onboardingEmailLocale.js';

interface WelcomeEmailData {
  email: string;
  firstName: string;
  companyName: string;
  isDemo?: boolean;
  /** Explicit language override — skips the DB lookup when already known. */
  lang?: OnboardingEmailLang;
  /** Used to resolve `lang` from the account's preference when `lang` is omitted. */
  userId?: string;
}

/**
 * Send welcome email to new user
 */
async function sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
  try {
    const EmailService = (await import('./emailService.js')).default;
    const lang = data.lang ?? (await getOnboardingEmailLangForUser(data.userId));

    await EmailService.send({
      to: data.email,
      subject: `${t(lang, 'welcome.subject.base')}${
        data.isDemo ? t(lang, 'welcome.subject.demoSuffix') : ''
      } 🎉`,
      html: generateWelcomeEmailHtml(data, lang),
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
function generateWelcomeEmailHtml(data: WelcomeEmailData, lang: OnboardingEmailLang): string {
  const appUrl = process.env.FRONTEND_URL || 'https://app.consultify.com';
  const tr = (key: string, params: Record<string, string> = {}) => t(lang, key, params);

  return `
<!DOCTYPE html>
<html lang="${lang}">
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
            <h1>${tr('welcome.header.title')}</h1>
            <p>${tr('welcome.header.subtitle')}</p>
            ${data.isDemo ? `<span class="demo-badge">${tr('welcome.demoBadge')}</span>` : ''}
        </div>

        <div class="content">
            <p>${tr('welcome.greeting', { firstName: data.firstName })}</p>

            <p>${tr('welcome.intro', { companyName: `<strong>${data.companyName}</strong>` })}</p>

            ${
              data.isDemo
                ? `
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>${tr('welcome.demoNote.title')}</strong><br>
                <p style="margin: 10px 0 0; font-size: 14px;">${tr('welcome.demoNote.body')}</p>
            </div>
            `
                : ''
            }

            <h2 style="color: #1f2937;">${tr('welcome.whatYouCanDo')}</h2>

            <div class="feature-grid">
                <div class="feature">
                    <div class="feature-icon">📊</div>
                    <h3>${tr('welcome.feature.assessments.title')}</h3>
                    <p>${tr('welcome.feature.assessments.body')}</p>
                </div>
                <div class="feature">
                    <div class="feature-icon">🤖</div>
                    <h3>${tr('welcome.feature.ai.title')}</h3>
                    <p>${tr('welcome.feature.ai.body')}</p>
                </div>
                <div class="feature">
                    <div class="feature-icon">📈</div>
                    <h3>${tr('welcome.feature.dashboard.title')}</h3>
                    <p>${tr('welcome.feature.dashboard.body')}</p>
                </div>
                <div class="feature">
                    <div class="feature-icon">👥</div>
                    <h3>${tr('welcome.feature.team.title')}</h3>
                    <p>${tr('welcome.feature.team.body')}</p>
                </div>
            </div>

            <div style="text-align: center;">
                <a href="${appUrl}/dashboard" class="cta-button">${tr('welcome.cta.dashboard')}</a>
            </div>

            <h2 style="color: #1f2937; margin-top: 40px;">${tr('welcome.help.title')}</h2>
            <ul style="padding-left: 20px;">
                <li><a href="${appUrl}/help">${tr('welcome.help.center')}</a></li>
                <li><a href="${appUrl}/settings/team">${tr('welcome.help.inviteTeam')}</a></li>
                <li><a href="mailto:support@consultify.com">${tr('welcome.help.contact')}</a></li>
            </ul>

            <p style="margin-top: 30px;">${tr('welcome.signoff.line')}</p>

            <p>${tr('welcome.signoff.closing')}<br>
            <strong>${tr('welcome.team')}</strong></p>
        </div>

        <div class="footer">
            <p>© ${new Date().getFullYear()} Consultify. ${tr('welcome.footer.rights')}</p>
            <p>
                <a href="${appUrl}/settings">${tr('welcome.footer.settings')}</a> •
                <a href="${appUrl}/help">${tr('welcome.footer.help')}</a> •
                <a href="mailto:support@consultify.com">${tr('welcome.footer.contact')}</a>
            </p>
            <p style="font-size: 12px; color: #9ca3af;">
                ${tr('welcome.footer.address')}
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
