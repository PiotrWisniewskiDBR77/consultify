import twilio from 'twilio';

import logger from '../utils/Logger.js';

export type NewFeedbackAlert = {
  userId?: string | null;
  userEmail?: string | null;
  type: string;
  message: string;
};

function isConfigured() {
  return Boolean(
    process.env.WHATSAPP_SID &&
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_FROM &&
    process.env.WHATSAPP_TO
  );
}

async function sendNewFeedbackAlert(feedback: NewFeedbackAlert): Promise<void> {
  if (!isConfigured()) {
    logger.info('[WhatsAppService] Skipping alert (not configured)');
    return;
  }

  const sid = String(process.env.WHATSAPP_SID);
  const token = String(process.env.WHATSAPP_TOKEN);
  const from = String(process.env.WHATSAPP_FROM);
  const to = String(process.env.WHATSAPP_TO);

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
