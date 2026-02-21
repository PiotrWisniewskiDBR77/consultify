import crypto from 'crypto';

import { run as dbRun } from '../utils/DbPromise.js';

type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED';

const ensureTable = async () => {
  await dbRun(
    `
    CREATE TABLE IF NOT EXISTS notification_outbox (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      dedupe_key TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL
    )
  `,
    []
  );
};

const NotificationOutboxService = {
  async enqueue(
    userId: string,
    organizationId: string,
    type: string,
    payload: Record<string, unknown>,
    opts: { dedupeKey?: string | null; status?: OutboxStatus } = {}
  ): Promise<{ id: string; success: true }> {
    await ensureTable();

    const seed = `${userId}:${organizationId}:${type}:${opts.dedupeKey || ''}:${Date.now()}:${
      Math.random() * 1e9
    }`;
    const id = `outbox-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24)}`;

    await dbRun(
      `INSERT INTO notification_outbox
        (id, user_id, organization_id, type, payload_json, status, dedupe_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        userId,
        organizationId,
        type,
        JSON.stringify(payload ?? {}),
        opts.status || 'PENDING',
        opts.dedupeKey || null,
      ]
    );

    return { id, success: true };
  },
};

export default NotificationOutboxService;
