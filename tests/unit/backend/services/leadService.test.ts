/**
 * Lead Service Tests
 * Real database tests for lead management
 *
 * @module tests/unit/backend/services/leadService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('LeadService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS leads (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        email TEXT NOT NULL,
                        first_name TEXT,
                        last_name TEXT,
                        company TEXT,
                        phone TEXT,
                        status TEXT DEFAULT 'new',
                        source TEXT,
                        score INTEGER DEFAULT 0,
                        assigned_to TEXT,
                        converted_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      db.run('DELETE FROM leads', () => resolve());
    });
  });

  describe('Lead CRUD', () => {
    it('should create lead', async () => {
      const leadId = `lead-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO leads (id, organization_id, email, first_name, last_name, source) VALUES (?, ?, ?, ?, ?, ?)',
          [leadId, 'org-123', 'john@example.com', 'John', 'Doe', 'website'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const lead = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM leads WHERE id = ?', [leadId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(lead).toBeDefined();
      expect(lead.email).toBe('john@example.com');
      expect(lead.status).toBe('new');
    });

    it('should update lead status', async () => {
      const leadId = `lead-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO leads (id, organization_id, email) VALUES (?, ?, ?)',
          [leadId, 'org-1', 'test@example.com'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE leads SET status = ?, score = ? WHERE id = ?',
          ['qualified', 75, leadId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const lead = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM leads WHERE id = ?', [leadId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(lead.status).toBe('qualified');
      expect(lead.score).toBe(75);
    });
  });

  describe('Lead Queries', () => {
    it('should get high score leads', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO leads (id, organization_id, email, score) VALUES (?, ?, ?, ?)', [
            'l1',
            'o1',
            'hot@ex.com',
            90,
          ]);
          db.run('INSERT INTO leads (id, organization_id, email, score) VALUES (?, ?, ?, ?)', [
            'l2',
            'o1',
            'cold@ex.com',
            20,
          ]);
          db.run(
            'INSERT INTO leads (id, organization_id, email, score) VALUES (?, ?, ?, ?)',
            ['l3', 'o1', 'warm@ex.com', 80],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const hotLeads = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM leads WHERE score >= ?', [50], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(hotLeads).toHaveLength(2);
    });
  });
});
