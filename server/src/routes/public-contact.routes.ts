import { type Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { send as sendEmail } from '../services/emailService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
router.use(defaultRateLimiter);

const TEAM_RECIPIENTS = [
  'piotr.wisniewski@dbr77.com',
  'justyna.laskowska@dbr77.com',
  'Tomasz.jankowski@dbr77.com',
];

const TYPE_LABELS: Record<string, string> = {
  general: 'General Inquiry',
  sales: 'Sales / Demo Request',
  support: 'Technical Support',
  partnership: 'Partnership',
  security: 'Security & Compliance',
  press: 'Press & Media',
};

const PublicContactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  company: z.string().max(160).optional().default(''),
  type: z.enum(['general', 'sales', 'support', 'partnership', 'security', 'press']),
  message: z.string().min(1).max(4000),
  locale: z.string().max(20).optional(),
  annaCta: z
    .object({
      session_id: z.string().min(1).max(120),
      cta_type: z.enum(['contact']),
      language: z.enum(['pl', 'en', 'es', 'de', 'ja', 'ar']),
      channel: z.enum(['text', 'voice']),
      turn_id: z.string().min(1).max(120),
      source_intent: z.enum([
        'learn',
        'evaluate_fit',
        'pricing',
        'security_compliance',
        'get_started',
        'talk_to_human',
        'unknown',
      ]),
    })
    .nullable()
    .optional(),
});

let _schemaEnsured = false;
async function ensureSchema(): Promise<void> {
  if (_schemaEnsured) return;
  try {
    await dbRun(
      `
      CREATE TABLE IF NOT EXISTS public_contact_requests (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT,
        inquiry_type TEXT NOT NULL,
        message TEXT NOT NULL,
        locale TEXT,
        anna_session_id TEXT,
        anna_turn_id TEXT,
        anna_source_intent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      [],
      { fallback: true }
    );
    _schemaEnsured = true;
  } catch (err) {
    logger.warn('[PublicContact] Failed to ensure schema (will rely on migrations):', err);
  }
}

function buildNotificationHtml(payload: {
  name: string;
  email: string;
  company?: string;
  type: string;
  message: string;
  locale?: string;
  id: string;
}): string {
  const typeLabel = TYPE_LABELS[payload.type] || payload.type;
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c026d3 100%); padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; font-size: 20px; margin: 0;">New Contact Request</h1>
        <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 4px 0 0;">Consultify Website</p>
      </div>
      <div style="background: #f8f9fa; padding: 24px 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 120px; vertical-align: top;">Name</td>
            <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${escapeHtml(payload.name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; vertical-align: top;">Email</td>
            <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(payload.email)}" style="color: #7c3aed;">${escapeHtml(payload.email)}</a></td>
          </tr>
          ${payload.company ? `<tr><td style="padding: 8px 0; color: #64748b; vertical-align: top;">Company</td><td style="padding: 8px 0; color: #1e293b;">${escapeHtml(payload.company)}</td></tr>` : ''}
          <tr>
            <td style="padding: 8px 0; color: #64748b; vertical-align: top;">Type</td>
            <td style="padding: 8px 0;"><span style="background: #ede9fe; color: #6d28d9; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${escapeHtml(typeLabel)}</span></td>
          </tr>
          ${payload.locale ? `<tr><td style="padding: 8px 0; color: #64748b; vertical-align: top;">Locale</td><td style="padding: 8px 0; color: #1e293b;">${escapeHtml(payload.locale)}</td></tr>` : ''}
        </table>
        <div style="margin-top: 16px; padding: 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px;">
          <p style="color: #64748b; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">Message</p>
          <p style="color: #1e293b; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${escapeHtml(payload.message)}</p>
        </div>
        <p style="color: #94a3b8; font-size: 11px; margin: 16px 0 0;">Request ID: ${payload.id}</p>
      </div>
    </div>
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function notifyTeam(payload: {
  name: string;
  email: string;
  company?: string;
  type: string;
  message: string;
  locale?: string;
  id: string;
}): Promise<void> {
  const typeLabel = TYPE_LABELS[payload.type] || payload.type;
  const subject = `[Consultify Contact] ${typeLabel} from ${payload.name}${payload.company ? ` (${payload.company})` : ''}`;
  const html = buildNotificationHtml(payload);

  const sends = TEAM_RECIPIENTS.map((to) =>
    sendEmail({ to, subject, html }).catch((err) => {
      logger.error(`[PublicContact] Failed to email ${to}:`, err);
    })
  );
  await Promise.allSettled(sends);
}

router.post(
  '/',
  asyncHandler(async (req, res: Response) => {
    const parsed = PublicContactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'Invalid contact request', details: parsed.error.flatten() });
    }

    await ensureSchema();

    const payload = parsed.data;
    const id = uuidv4();

    try {
      await dbRun(
        `INSERT INTO public_contact_requests
          (id, name, email, company, inquiry_type, message, locale, anna_session_id, anna_turn_id, anna_source_intent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          id,
          payload.name.trim(),
          payload.email.trim(),
          payload.company?.trim() || null,
          payload.type,
          payload.message.trim(),
          payload.locale ? String(payload.locale).trim() : null,
          payload.annaCta?.session_id ? String(payload.annaCta.session_id).trim() : null,
          payload.annaCta?.turn_id ? String(payload.annaCta.turn_id).trim() : null,
          payload.annaCta?.source_intent ? String(payload.annaCta.source_intent).trim() : null,
        ],
        { fallback: true }
      );
    } catch (err: any) {
      logger.error('[PublicContact] Failed to record contact request', err?.message || err);
      return res.status(500).json({ error: 'Failed to record contact request' });
    }

    notifyTeam({
      name: payload.name.trim(),
      email: payload.email.trim(),
      company: payload.company?.trim() || undefined,
      type: payload.type,
      message: payload.message.trim(),
      locale: payload.locale?.trim(),
      id,
    }).catch((err) => {
      logger.error('[PublicContact] Team notification failed:', err);
    });

    return res.status(201).json({ success: true, id });
  })
);

export default router;
