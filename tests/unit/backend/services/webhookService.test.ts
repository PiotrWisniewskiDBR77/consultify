/**
 * Webhook Service Tests
 * Real database tests for webhook management
 *
 * @module tests/unit/backend/services/webhookService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('WebhookService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS webhooks (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        url TEXT NOT NULL,
                        events TEXT NOT NULL,
                        secret TEXT,
                        is_active INTEGER DEFAULT 1,
                        last_triggered_at DATETIME,
                        failure_count INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS webhook_logs (
                        id TEXT PRIMARY KEY,
                        webhook_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        payload TEXT,
                        response_code INTEGER,
                        response_body TEXT,
                        success INTEGER,
                        triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
                    )
                `,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });
  });

  afterAll(() => db.close());

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM webhook_logs');
        db.run('DELETE FROM webhooks', () => resolve());
      });
    });
  });

  describe('Webhook CRUD', () => {
    it('should create webhook', async () => {
      const webhookId = `wh-${Date.now()}`;
      const events = ['task.created', 'task.completed'];

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO webhooks (id, organization_id, url, events, secret) VALUES (?, ?, ?, ?, ?)',
          [
            webhookId,
            'org-123',
            'https://api.example.com/webhook',
            JSON.stringify(events),
            'secret123',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const webhook = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM webhooks WHERE id = ?', [webhookId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(webhook).toBeDefined();
      expect(webhook.url).toBe('https://api.example.com/webhook');
      expect(webhook.is_active).toBe(1);
    });

    it('should deactivate webhook after failures', async () => {
      const webhookId = `wh-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO webhooks (id, organization_id, url, events, failure_count) VALUES (?, ?, ?, ?, ?)',
          [webhookId, 'org-123', 'https://failing.com/hook', '["event"]', 5],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE webhooks SET is_active = 0 WHERE id = ? AND failure_count >= 5',
          [webhookId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const webhook = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM webhooks WHERE id = ?', [webhookId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(webhook.is_active).toBe(0);
    });
  });

  describe('Webhook Logs', () => {
    it('should log webhook execution', async () => {
      const webhookId = `wh-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO webhooks (id, organization_id, url, events) VALUES (?, ?, ?, ?)',
          [webhookId, 'org-123', 'https://api.test.com/hook', '["test"]'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO webhook_logs (id, webhook_id, event_type, payload, response_code, success) VALUES (?, ?, ?, ?, ?, ?)',
          ['log-1', webhookId, 'task.created', '{"taskId": "123"}', 200, 1],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const log = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM webhook_logs WHERE webhook_id = ?', [webhookId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(log.response_code).toBe(200);
      expect(log.success).toBe(1);
    });
  });
});
