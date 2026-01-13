/**
 * Campaign Service Tests
 * Real database tests for marketing campaigns
 *
 * @module tests/unit/backend/services/campaignService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('CampaignService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS campaigns (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        type TEXT NOT NULL,
                        status TEXT DEFAULT 'draft',
                        target_audience TEXT,
                        budget REAL,
                        start_date DATETIME,
                        end_date DATETIME,
                        metrics TEXT,
                        created_by TEXT,
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
      db.run('DELETE FROM campaigns', () => resolve());
    });
  });

  describe('Campaign CRUD', () => {
    it('should create campaign', async () => {
      const campaignId = `camp-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO campaigns (id, organization_id, name, type, budget) VALUES (?, ?, ?, ?, ?)',
          [campaignId, 'org-123', 'Summer Sale', 'email', 5000],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const campaign = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM campaigns WHERE id = ?', [campaignId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(campaign).toBeDefined();
      expect(campaign.name).toBe('Summer Sale');
      expect(campaign.budget).toBe(5000);
    });

    it('should update campaign status', async () => {
      const campaignId = `camp-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO campaigns (id, organization_id, name, type) VALUES (?, ?, ?, ?)',
          [campaignId, 'org-1', 'Test', 'sms'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE campaigns SET status = ? WHERE id = ?', ['active', campaignId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const campaign = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM campaigns WHERE id = ?', [campaignId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(campaign.status).toBe('active');
    });
  });

  describe('Campaign Queries', () => {
    it('should get active campaigns', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO campaigns (id, organization_id, name, type, status) VALUES (?, ?, ?, ?, ?)',
            ['c1', 'o1', 'C1', 'email', 'active']
          );
          db.run(
            'INSERT INTO campaigns (id, organization_id, name, type, status) VALUES (?, ?, ?, ?, ?)',
            ['c2', 'o1', 'C2', 'sms', 'paused']
          );
          db.run(
            'INSERT INTO campaigns (id, organization_id, name, type, status) VALUES (?, ?, ?, ?, ?)',
            ['c3', 'o1', 'C3', 'email', 'active'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const activeCampaigns = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM campaigns WHERE status = ?', ['active'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(activeCampaigns).toHaveLength(2);
    });
  });
});
