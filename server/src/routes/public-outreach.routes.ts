/**
 * Public Partner Outreach Routes (Bundle 28 / T098)
 *
 * Mounted at /api/public/outreach
 */

import crypto from 'crypto';
import { Request, Response, Router } from 'express';

import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
);

/**
 * GET /api/public/outreach/unsubscribe?token=...
 */
router.get('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) return res.status(400).send('Missing token');

    const db = getDatabase();
    const mi = await DbPromise.get<any>(
      db,
      `SELECT mi.id as message_instance_id, mi.campaign_id, mi.lead_id, mi.unsubscribe_token,
              l.email
       FROM partner_outreach_message_instances mi
       JOIN partner_outreach_leads l ON l.id = mi.lead_id
       WHERE mi.unsubscribe_token = ?
       LIMIT 1`,
      [token]
    );
    if (!mi) return res.status(404).send('Not found');

    await DbPromise.run(
      db,
      `INSERT INTO partner_outreach_unsubscribes (email, created_at)
       VALUES (?, NOW())
       ON CONFLICT (email) DO NOTHING`,
      [mi.email]
    );
    await DbPromise.run(
      db,
      `UPDATE partner_outreach_leads SET status = 'suppressed', updated_at = NOW() WHERE id = ?`,
      [mi.lead_id]
    );
    await DbPromise.run(
      db,
      `UPDATE partner_outreach_enrollments SET status = 'unsubscribed' WHERE lead_id = ?`,
      [mi.lead_id]
    );
    await DbPromise.run(
      db,
      `INSERT INTO partner_outreach_events (id, campaign_id, lead_id, message_instance_id, type, meta)
       VALUES (?, ?, ?, ?, 'unsubscribed', ?::jsonb)`,
      [
        crypto.randomUUID(),
        mi.campaign_id,
        mi.lead_id,
        mi.message_instance_id,
        JSON.stringify({ via: 'one_click' }),
      ]
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(
      `<html><body style="font-family: ui-sans-serif, system-ui; padding: 24px;">
        <h2>Unsubscribed</h2>
        <p>You have been unsubscribed and will not receive further outreach emails.</p>
      </body></html>`
    );
  } catch (e: any) {
    logger.error('[PublicOutreach] unsubscribe failed', e);
    return res
      .status(500)
      .json({ error: 'Unsubscribe failed', code: 'OUTREACH_UNSUBSCRIBE_FAILED' });
  }
});

/**
 * GET /api/public/outreach/track/open?token=...
 */
router.get('/track/open', async (req: Request, res: Response) => {
  try {
    const token = String(req.query.token || '').trim();
    if (token) {
      const db = getDatabase();
      const mi = await DbPromise.get<any>(
        db,
        `SELECT id, campaign_id, lead_id FROM partner_outreach_message_instances WHERE tracking_token = ? LIMIT 1`,
        [token]
      );
      if (mi) {
        await DbPromise.run(
          db,
          `INSERT INTO partner_outreach_events (id, campaign_id, lead_id, message_instance_id, type)
           VALUES (?, ?, ?, ?, 'opened')`,
          [crypto.randomUUID(), mi.campaign_id, mi.lead_id, mi.id]
        );
      }
    }
  } catch {
    // best-effort
  }
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(TRANSPARENT_GIF);
});

/**
 * GET /api/public/outreach/track/click?token=...&url=...
 */
router.get('/track/click', async (req: Request, res: Response) => {
  try {
    const token = String(req.query.token || '').trim();
    const url = String(req.query.url || '').trim();
    if (!token || !url) return res.status(400).send('Missing token or url');

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).send('Invalid url');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).send('Invalid protocol');
    }

    const db = getDatabase();
    const mi = await DbPromise.get<any>(
      db,
      `SELECT id, campaign_id, lead_id FROM partner_outreach_message_instances WHERE tracking_token = ? LIMIT 1`,
      [token]
    );
    if (mi) {
      await DbPromise.run(
        db,
        `INSERT INTO partner_outreach_events (id, campaign_id, lead_id, message_instance_id, type, meta)
         VALUES (?, ?, ?, ?, 'clicked', ?::jsonb)`,
        [crypto.randomUUID(), mi.campaign_id, mi.lead_id, mi.id, JSON.stringify({ url })]
      );
    }

    return res.redirect(url);
  } catch (e: any) {
    logger.error('[PublicOutreach] click tracking failed', e);
    return res
      .status(500)
      .json({ error: 'Click tracking failed', code: 'OUTREACH_CLICK_TRACKING_FAILED' });
  }
});

export default router;
