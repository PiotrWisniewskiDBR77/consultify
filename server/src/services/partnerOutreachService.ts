import crypto from 'crypto';

import config from '../config/Config.js';
import { getDatabase } from '../database/Database.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import EmailService from './emailService.js';

function serverOrigin(): string {
  try {
    const url = new URL(
      (config as any).GOOGLE_CALLBACK_URL || `http://localhost:${(config as any).PORT || 3005}/`
    );
    return url.origin;
  } catch {
    return `http://localhost:${(config as any).PORT || 3005}`;
  }
}

function renderTemplate(input: string, vars: Record<string, string>): string {
  let out = input;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v);
  }
  return out;
}

export async function processPartnerOutreachDueMessages(params: { limit?: number } = {}): Promise<{
  processed: number;
  sent: number;
  skipped: number;
}> {
  const limit = params.limit ?? 50;
  const db = getDatabase();
  const origin = serverOrigin();

  const due = await DbPromise.all<any>(
    db,
    `SELECT
        e.id as enrollment_id,
        e.campaign_id,
        e.lead_id,
        e.current_step,
        l.email as lead_email,
        l.first_name,
        l.company,
        l.status as lead_status,
        c.status as campaign_status,
        c.from_name,
        c.from_email,
        c.reply_to,
        s.id as step_id,
        s.step_order,
        s.delay_days,
        s.subject,
        s.body_html,
        s.body_text
     FROM partner_outreach_enrollments e
     JOIN partner_outreach_campaigns c ON c.id = e.campaign_id
     JOIN partner_outreach_leads l ON l.id = e.lead_id
     JOIN partner_outreach_steps s ON s.campaign_id = e.campaign_id AND s.step_order = e.current_step + 1
     WHERE e.status = 'active'
       AND c.status = 'running'
       AND (e.next_send_at IS NULL OR e.next_send_at <= NOW())
     ORDER BY e.next_send_at NULLS FIRST, e.enrolled_at ASC
     LIMIT ?`,
    [limit]
  );

  let processed = 0;
  let sent = 0;
  let skipped = 0;

  for (const row of due) {
    processed += 1;

    const email = String(row.lead_email || '').trim();
    if (!email) {
      skipped += 1;
      continue;
    }

    if (row.lead_status !== 'active') {
      skipped += 1;
      continue;
    }

    const unsub = await DbPromise.get<{ email: string }>(
      db,
      `SELECT email FROM partner_outreach_unsubscribes WHERE email = ? LIMIT 1`,
      [email]
    );
    if (unsub) {
      await DbPromise.run(
        db,
        `UPDATE partner_outreach_enrollments SET status = 'unsubscribed' WHERE id = ?`,
        [row.enrollment_id]
      );
      await DbPromise.run(
        db,
        `INSERT INTO partner_outreach_events (id, campaign_id, lead_id, type, meta)
         VALUES (?, ?, ?, 'unsubscribed', ?::jsonb)`,
        [
          crypto.randomUUID(),
          row.campaign_id,
          row.lead_id,
          JSON.stringify({ source: 'suppression_list' }),
        ]
      );
      skipped += 1;
      continue;
    }

    const trackingToken = crypto.randomBytes(18).toString('hex');
    const unsubscribeToken = crypto.randomBytes(18).toString('hex');
    const messageInstanceId = crypto.randomUUID();

    const vars: Record<string, string> = {
      FirstName: row.first_name || '',
      Company: row.company || '',
    };

    const subject = renderTemplate(String(row.subject || ''), vars);
    const bodyText = renderTemplate(String(row.body_text || ''), vars);
    const bodyHtml = renderTemplate(String(row.body_html || ''), vars);

    const unsubscribeUrl = `${origin}/api/public/outreach/unsubscribe?token=${encodeURIComponent(
      unsubscribeToken
    )}`;
    const openPixelUrl = `${origin}/api/public/outreach/track/open?token=${encodeURIComponent(
      trackingToken
    )}`;

    const html =
      (bodyHtml && bodyHtml.trim().length > 0
        ? bodyHtml
        : `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">${bodyText
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')}</pre>`) +
      `<hr/><p style="color:#64748b;font-size:12px">Unsubscribe: <a href="${unsubscribeUrl}">${unsubscribeUrl}</a></p>` +
      `<img src="${openPixelUrl}" width="1" height="1" style="display:none" alt="" />`;

    const created = await DbPromise.run(
      db,
      `INSERT INTO partner_outreach_message_instances
        (id, campaign_id, step_id, enrollment_id, lead_id, to_email, tracking_token, unsubscribe_token, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)`,
      [
        messageInstanceId,
        row.campaign_id,
        row.step_id,
        row.enrollment_id,
        row.lead_id,
        email,
        trackingToken,
        unsubscribeToken,
        JSON.stringify({ stepOrder: row.step_order }),
      ]
    );
    if (!created.success) {
      skipped += 1;
      continue;
    }

    await EmailService.send({
      to: email,
      subject,
      html,
    });

    await DbPromise.run(
      db,
      `UPDATE partner_outreach_message_instances SET sent_at = NOW() WHERE id = ?`,
      [messageInstanceId]
    );
    await DbPromise.run(
      db,
      `INSERT INTO partner_outreach_events (id, campaign_id, lead_id, message_instance_id, type, meta)
       VALUES (?, ?, ?, ?, 'sent', ?::jsonb)`,
      [
        crypto.randomUUID(),
        row.campaign_id,
        row.lead_id,
        messageInstanceId,
        JSON.stringify({ stepOrder: row.step_order }),
      ]
    );

    // Advance enrollment
    const nextStep = await DbPromise.get<{ delay_days: number }>(
      db,
      `SELECT delay_days
       FROM partner_outreach_steps
       WHERE campaign_id = ? AND step_order = ?`,
      [row.campaign_id, Number(row.step_order) + 1]
    );

    if (!nextStep) {
      await DbPromise.run(
        db,
        `UPDATE partner_outreach_enrollments
         SET current_step = ?, status = 'completed'
         WHERE id = ?`,
        [row.step_order, row.enrollment_id]
      );
      await DbPromise.run(
        db,
        `UPDATE partner_outreach_campaigns
         SET completed_at = COALESCE(completed_at, NOW())
         WHERE id = ? AND status = 'running'`,
        [row.campaign_id]
      );
    } else {
      const delayDays = Math.max(0, Number(nextStep.delay_days || 0));
      await DbPromise.run(
        db,
        `UPDATE partner_outreach_enrollments
         SET current_step = ?, next_send_at = NOW() + (? * INTERVAL '1 day')
         WHERE id = ?`,
        [row.step_order, delayDays, row.enrollment_id]
      );
    }

    sent += 1;
  }

  if (processed > 0) {
    logger.info('[PartnerOutreach] processed', { processed, sent, skipped });
  }

  return { processed, sent, skipped };
}
