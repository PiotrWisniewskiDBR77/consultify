/**
 * SuperAdmin Partner Outreach Routes (Bundle 28 / T098)
 */

import crypto from 'crypto';
import { Request, Response, Router } from 'express';

import { getDatabase } from '../database/Database.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import {
  requireSuperAdminCapability,
  verifySuperAdmin,
} from '../middleware/superAdmin.middleware.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
router.use(defaultRateLimiter);
router.use(verifyToken);
router.use(verifySuperAdmin);
router.use(requireSuperAdminCapability('platform_ops', 'support_ops'));

function parseCsvLeads(csv: string): Array<{
  email: string;
  company?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  region?: string;
  source?: string;
  lawfulBasis?: string;
}> {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1);

  const idx = (name: string) => header.indexOf(name);
  const get = (parts: string[], name: string) => {
    const i = idx(name);
    if (i < 0) return '';
    return (parts[i] || '').trim();
  };

  return rows
    .map((line) => line.split(','))
    .map((parts) => ({
      email: get(parts, 'email'),
      company: get(parts, 'company') || undefined,
      firstName: get(parts, 'first_name') || get(parts, 'firstname') || undefined,
      lastName: get(parts, 'last_name') || get(parts, 'lastname') || undefined,
      country: get(parts, 'country') || undefined,
      region: get(parts, 'region') || undefined,
      source: get(parts, 'source') || undefined,
      lawfulBasis: get(parts, 'lawful_basis') || get(parts, 'lawfulbasis') || undefined,
    }))
    .filter((r) => r.email);
}

/**
 * GET /api/superadmin/partner-outreach/leads
 */
router.get('/leads', async (req: Request, res: Response) => {
  const db = getDatabase();
  const q = String(req.query.q || '')
    .trim()
    .toLowerCase();
  const status = String(req.query.status || '').trim();

  const params: any[] = [];
  let where = `1=1`;
  if (status) {
    where += ` AND status = ?`;
    params.push(status);
  }
  if (q) {
    where += ` AND (LOWER(email) LIKE ? OR LOWER(company) LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }

  const leads = await DbPromise.all<any>(
    db,
    `SELECT id, email, company, first_name, last_name, country, region, source, lawful_basis, status, created_at
     FROM partner_outreach_leads
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT 200`,
    params
  );

  return res.json({ success: true, data: leads });
});

/**
 * POST /api/superadmin/partner-outreach/leads/import
 * Accepts { csv: string } or { leads: [...] }
 */
router.post('/leads/import', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const csv = typeof req.body?.csv === 'string' ? req.body.csv : null;
    const leadsInput = Array.isArray(req.body?.leads) ? req.body.leads : null;

    const leads = csv ? parseCsvLeads(csv) : leadsInput;
    if (!leads || leads.length === 0) {
      return res.status(400).json({ success: false, error: 'No leads provided' });
    }

    let inserted = 0;
    for (const lead of leads) {
      const email = String(lead.email || '')
        .trim()
        .toLowerCase();
      if (!email) continue;

      const result = await DbPromise.run(
        db,
        `INSERT INTO partner_outreach_leads
          (id, email, company, first_name, last_name, country, region, source, lawful_basis, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET
           company = COALESCE(EXCLUDED.company, partner_outreach_leads.company),
           first_name = COALESCE(EXCLUDED.first_name, partner_outreach_leads.first_name),
           last_name = COALESCE(EXCLUDED.last_name, partner_outreach_leads.last_name),
           country = COALESCE(EXCLUDED.country, partner_outreach_leads.country),
           region = COALESCE(EXCLUDED.region, partner_outreach_leads.region),
           source = COALESCE(EXCLUDED.source, partner_outreach_leads.source),
           lawful_basis = COALESCE(EXCLUDED.lawful_basis, partner_outreach_leads.lawful_basis),
           updated_at = NOW()`,
        [
          crypto.randomUUID(),
          email,
          lead.company || null,
          lead.firstName || null,
          lead.lastName || null,
          lead.country || null,
          lead.region || null,
          lead.source || null,
          lead.lawfulBasis || null,
        ]
      );
      if (result.success) inserted += 1;
    }

    return res.json({ success: true, data: { inserted, total: leads.length } });
  } catch (e: any) {
    logger.error('[PartnerOutreach] import failed', e);
    return res.status(500).json({ success: false, error: 'Import failed' });
  }
});

/**
 * GET /api/superadmin/partner-outreach/campaigns
 */
router.get('/campaigns', async (_req: Request, res: Response) => {
  const db = getDatabase();
  const campaigns = await DbPromise.all<any>(
    db,
    `SELECT c.*,
        (SELECT COUNT(*) FROM partner_outreach_enrollments e WHERE e.campaign_id = c.id) as enrollments_total,
        (SELECT COUNT(*) FROM partner_outreach_events ev WHERE ev.campaign_id = c.id AND ev.type='sent') as sent_count
     FROM partner_outreach_campaigns c
     ORDER BY c.created_at DESC
     LIMIT 100`,
    []
  );
  return res.json({ success: true, data: campaigns });
});

/**
 * POST /api/superadmin/partner-outreach/campaigns
 * Body: { name, fromName, fromEmail, replyTo, steps: [{delayDays,subject,bodyHtml,bodyText}] }
 */
router.post('/campaigns', async (req: Request, res: Response) => {
  const db = getDatabase();
  const userId = (req as any).user?.id || (req as any).userId;

  const { name, fromName, fromEmail, replyTo, steps } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: 'name is required' });
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ success: false, error: 'steps is required' });
  }

  const campaignId = crypto.randomUUID();
  await DbPromise.run(
    db,
    `INSERT INTO partner_outreach_campaigns (id, name, status, created_by, created_at, from_name, from_email, reply_to)
     VALUES (?, ?, 'draft', ?, NOW(), ?, ?, ?)`,
    [campaignId, name, userId || null, fromName || null, fromEmail || null, replyTo || null]
  );

  let order = 1;
  for (const step of steps) {
    const subject = String(step.subject || '').trim();
    if (!subject) continue;
    const bodyHtml = step.bodyHtml ? String(step.bodyHtml) : null;
    const bodyText = step.bodyText ? String(step.bodyText) : null;
    const delayDays = Math.max(0, Number(step.delayDays || 0));
    const hash = crypto
      .createHash('sha256')
      .update([subject, bodyHtml || '', bodyText || '', delayDays].join('|'))
      .digest('hex');

    await DbPromise.run(
      db,
      `INSERT INTO partner_outreach_steps
        (id, campaign_id, step_order, delay_days, subject, body_html, body_text, template_version_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [crypto.randomUUID(), campaignId, order, delayDays, subject, bodyHtml, bodyText, hash]
    );
    order += 1;
  }

  return res.status(201).json({ success: true, data: { id: campaignId } });
});

/**
 * POST /api/superadmin/partner-outreach/campaigns/:campaignId/start
 * Enrolls all active leads not unsubscribed.
 */
router.post('/campaigns/:campaignId/start', async (req: Request, res: Response) => {
  const db = getDatabase();
  const { campaignId } = req.params;

  await DbPromise.run(
    db,
    `UPDATE partner_outreach_campaigns SET status = 'running', started_at = COALESCE(started_at, NOW())
     WHERE id = ?`,
    [campaignId]
  );

  const result = await DbPromise.run(
    db,
    `INSERT INTO partner_outreach_enrollments (id, campaign_id, lead_id, enrolled_at, status, current_step, next_send_at)
     SELECT gen_random_uuid(), ?, l.id, NOW(), 'active', 0, NOW()
     FROM partner_outreach_leads l
     WHERE l.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM partner_outreach_unsubscribes u WHERE u.email = l.email)
     ON CONFLICT (campaign_id, lead_id) DO NOTHING`,
    [campaignId]
  );

  return res.json({ success: true, data: { enrolled: result.changes || 0 } });
});

router.post('/campaigns/:campaignId/pause', async (req: Request, res: Response) => {
  const db = getDatabase();
  const { campaignId } = req.params;
  await DbPromise.run(db, `UPDATE partner_outreach_campaigns SET status = 'paused' WHERE id = ?`, [
    campaignId,
  ]);
  return res.json({ success: true });
});

router.post('/campaigns/:campaignId/resume', async (req: Request, res: Response) => {
  const db = getDatabase();
  const { campaignId } = req.params;
  await DbPromise.run(db, `UPDATE partner_outreach_campaigns SET status = 'running' WHERE id = ?`, [
    campaignId,
  ]);
  return res.json({ success: true });
});

export default router;
