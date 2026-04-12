import twilio from 'twilio';

import logger from '../utils/Logger.js';

export type NewFeedbackAlert = {
  userId?: string | null;
  userEmail?: string | null;
  type: string;
  message: string;
};

function getEnvSuffix(): string {
  return String(process.env.APP_ENV || process.env.NODE_ENV || 'development')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
}

function getWhatsAppConfig() {
  const envSuffix = getEnvSuffix();
  return {
    sid: process.env.WHATSAPP_SID,
    token: process.env.WHATSAPP_TOKEN,
    from: process.env[`WHATSAPP_FROM_${envSuffix}`] || process.env.WHATSAPP_FROM,
    to: process.env[`WHATSAPP_TO_${envSuffix}`] || process.env.WHATSAPP_TO,
  };
}

function isConfigured() {
  const cfg = getWhatsAppConfig();
  return Boolean(
    cfg.sid &&
    cfg.token &&
    cfg.from &&
    cfg.to
  );
}

async function sendNewFeedbackAlert(feedback: NewFeedbackAlert): Promise<void> {
  if (!isConfigured()) {
    logger.info('[WhatsAppService] Skipping alert (not configured)');
    return;
  }

  const cfg = getWhatsAppConfig();
  const sid = String(cfg.sid);
  const token = String(cfg.token);
  const from = String(cfg.from);
  const to = String(cfg.to);

  const client = twilio(sid, token);
  const type = String(feedback.type || 'OTHER').toUpperCase();
  const prefix = type === 'BUG' ? '[BUG]' : type === 'FEATURE' ? '[FEATURE]' : '[FEEDBACK]';
  const body =
    `${prefix} New feedback\n\n` +
    `User: ${feedback.userEmail || feedback.userId || 'Anonymous'}\n` +
    `Message: ${String(feedback.message || '').slice(0, 1200)}\n` +
    `Time: ${new Date().toISOString()}`;

  await client.messages.create({ from, to, body });
}

export default {
  sendNewFeedbackAlert,
};
