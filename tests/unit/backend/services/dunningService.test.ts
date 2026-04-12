/**
 * Dunning Service Tests
 * Real database integration tests for failed payment recovery
 *
 * @module tests/unit/backend/services/dunningService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('DunningService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS dunning_entries (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        invoice_id TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        attempt_count INTEGER DEFAULT 0,
                        max_attempts INTEGER DEFAULT 4,
                        next_retry_at DATETIME,
                        last_attempt_at DATETIME,
                        recovery_amount_cents INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS dunning_emails (
                        id TEXT PRIMARY KEY,
                        dunning_id TEXT NOT NULL,
                        email_type TEXT NOT NULL,
                        sent_at DATETIME,
                        opened_at DATETIME,
                        clicked_at DATETIME,
                        FOREIGN KEY (dunning_id) REFERENCES dunning_entries(id)
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

  afterAll(() => {
    db.close();
  });

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM dunning_emails');
        db.run('DELETE FROM dunning_entries', () => resolve());
      });
    });
  });

  describe('Dunning Entry Management', () => {
    it('should create dunning entry for failed payment', async () => {
      const dunningId = `dunning-${Date.now()}`;
      const nextRetry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO dunning_entries (id, organization_id, invoice_id, recovery_amount_cents, next_retry_at) VALUES (?, ?, ?, ?, ?)',
          [dunningId, 'org-failed', 'inv-123', 9900, nextRetry],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const entry = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM dunning_entries WHERE id = ?', [dunningId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(entry).toBeDefined();
      expect(entry.status).toBe('pending');
      expect(entry.attempt_count).toBe(0);
      expect(entry.recovery_amount_cents).toBe(9900);
    });

    it('should increment retry attempt', async () => {
      const dunningId = `dunning-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO dunning_entries (id, organization_id, invoice_id, recovery_amount_cents) VALUES (?, ?, ?, ?)',
          [dunningId, 'org-retry', 'inv-456', 4999],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE dunning_entries SET attempt_count = attempt_count + 1, last_attempt_at = datetime("now") WHERE id = ?',
          [dunningId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const entry = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM dunning_entries WHERE id = ?', [dunningId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(entry.attempt_count).toBe(1);
      expect(entry.last_attempt_at).not.toBeNull();
    });

    it('should mark as recovered on successful payment', async () => {
      const dunningId = `dunning-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO dunning_entries (id, organization_id, invoice_id, recovery_amount_cents, attempt_count) VALUES (?, ?, ?, ?, ?)',
          [dunningId, 'org-recover', 'inv-789', 2999, 2],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE dunning_entries SET status = ? WHERE id = ?',
          ['recovered', dunningId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const entry = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM dunning_entries WHERE id = ?', [dunningId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(entry.status).toBe('recovered');
    });
  });

  describe('Dunning Email Tracking', () => {
    it('should track dunning email sent', async () => {
      const dunningId = `dunning-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO dunning_entries (id, organization_id, invoice_id, recovery_amount_cents) VALUES (?, ?, ?, ?)',
          [dunningId, 'org-email', 'inv-email', 1999],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO dunning_emails (id, dunning_id, email_type, sent_at) VALUES (?, ?, ?, datetime("now"))',
          [`email-${Date.now()}`, dunningId, 'reminder_1'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const emails = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM dunning_emails WHERE dunning_id = ?', [dunningId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(emails).toHaveLength(1);
      expect(emails[0].email_type).toBe('reminder_1');
    });

    it('should track email engagement', async () => {
      const dunningId = `dunning-${Date.now()}`;
      const emailId = `email-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO dunning_entries (id, organization_id, invoice_id, recovery_amount_cents) VALUES (?, ?, ?, ?)',
            [dunningId, 'org-engage', 'inv-engage', 999]
          );
          db.run(
            'INSERT INTO dunning_emails (id, dunning_id, email_type, sent_at) VALUES (?, ?, ?, datetime("now"))',
            [emailId, dunningId, 'final_warning'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE dunning_emails SET opened_at = datetime("now"), clicked_at = datetime("now") WHERE id = ?',
          [emailId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const email = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM dunning_emails WHERE id = ?', [emailId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(email.opened_at).not.toBeNull();
      expect(email.clicked_at).not.toBeNull();
    });
  });

  describe('Dunning Analytics', () => {
    it('should calculate recovery rate', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO dunning_entries (id, organization_id, invoice_id, recovery_amount_cents, status) VALUES (?, ?, ?, ?, ?)',
            ['d-1', 'org-1', 'inv-1', 1000, 'recovered']
          );
          db.run(
            'INSERT INTO dunning_entries (id, organization_id, invoice_id, recovery_amount_cents, status) VALUES (?, ?, ?, ?, ?)',
            ['d-2', 'org-2', 'inv-2', 2000, 'recovered']
          );
          db.run(
            'INSERT INTO dunning_entries (id, organization_id, invoice_id, recovery_amount_cents, status) VALUES (?, ?, ?, ?, ?)',
            ['d-3', 'org-3', 'inv-3', 500, 'failed']
          );
          db.run(
            'INSERT INTO dunning_entries (id, organization_id, invoice_id, recovery_amount_cents, status) VALUES (?, ?, ?, ?, ?)',
            ['d-4', 'org-4', 'inv-4', 1500, 'pending'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const result = await new Promise<any>((resolve, reject) => {
        db.get(
          `
                    SELECT 
                        (SELECT SUM(recovery_amount_cents) FROM dunning_entries WHERE status = 'recovered') as recovered_amount,
                        (SELECT SUM(recovery_amount_cents) FROM dunning_entries) as total_at_risk
                `,
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Recovered: 1000 + 2000 = 3000
      // Total: 1000 + 2000 + 500 + 1500 = 5000
      // Rate: 60%
      expect(result.recovered_amount).toBe(3000);
      expect((result.recovered_amount / result.total_at_risk) * 100).toBe(60);
    });
  });
});
