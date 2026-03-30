import { Router, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
router.use(defaultRateLimiter);

const PublicContactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  company: z.string().max(160).optional().default(''),
  type: z.enum(['general', 'sales', 'support', 'partnership']),
  message: z.string().min(1).max(4000),
  locale: z.string().max(20).optional(),
  annaCta: z
    .object({
      session_id: z.string().min(1).max(120),
      cta_type: z.enum(['contact']),
      language: z.enum(['pl', 'en', 'es', 'de', 'jp', 'ar']),
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

router.post(
  '/',
  asyncHandler(async (req, res: Response) => {
    const parsed = PublicContactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid contact request', details: parsed.error.flatten() });
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

    return res.status(201).json({ success: true, id });
  })
);

export default router;

