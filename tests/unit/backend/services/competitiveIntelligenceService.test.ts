/**
 * Competitive Intelligence Service Tests
 * Real database tests for market analysis
 *
 * @module tests/unit/backend/services/competitiveIntelligenceService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('CompetitiveIntelligenceService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS competitors (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        industry TEXT,
                        website TEXT,
                        strengths TEXT,
                        weaknesses TEXT,
                        market_share REAL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS competitor_updates (
                        id TEXT PRIMARY KEY,
                        competitor_id TEXT NOT NULL,
                        update_type TEXT NOT NULL,
                        content TEXT,
                        source TEXT,
                        relevance_score REAL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (competitor_id) REFERENCES competitors(id)
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
        db.run('DELETE FROM competitor_updates');
        db.run('DELETE FROM competitors', () => resolve());
      });
    });
  });

  describe('Competitor Tracking', () => {
    it('should add competitor to tracking', async () => {
      const competitorId = `comp-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO competitors (id, organization_id, name, industry, website, market_share) VALUES (?, ?, ?, ?, ?, ?)',
          [competitorId, 'org-123', 'Acme Corp', 'technology', 'https://acme.com', 15.5],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const competitor = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM competitors WHERE id = ?', [competitorId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(competitor).toBeDefined();
      expect(competitor.name).toBe('Acme Corp');
      expect(competitor.market_share).toBe(15.5);
    });

    it('should store SWOT analysis', async () => {
      const competitorId = `comp-${Date.now()}`;
      const strengths = JSON.stringify(['Strong brand', 'Large customer base']);
      const weaknesses = JSON.stringify(['High prices', 'Slow innovation']);

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO competitors (id, organization_id, name, strengths, weaknesses) VALUES (?, ?, ?, ?, ?)',
          [competitorId, 'org-123', 'Competitor X', strengths, weaknesses],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const competitor = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM competitors WHERE id = ?', [competitorId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const parsedStrengths = JSON.parse(competitor.strengths);
      expect(parsedStrengths).toContain('Strong brand');
    });
  });

  describe('Market Updates', () => {
    it('should track competitor updates', async () => {
      const competitorId = `comp-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO competitors (id, organization_id, name) VALUES (?, ?, ?)',
          [competitorId, 'org-123', 'Tracked Competitor'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO competitor_updates (id, competitor_id, update_type, content, relevance_score) VALUES (?, ?, ?, ?, ?)',
            ['u1', competitorId, 'product_launch', 'New AI feature released', 0.9]
          );
          db.run(
            'INSERT INTO competitor_updates (id, competitor_id, update_type, content, relevance_score) VALUES (?, ?, ?, ?, ?)',
            ['u2', competitorId, 'pricing_change', 'Reduced enterprise tier by 20%', 0.85],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const updates = await new Promise<any[]>((resolve, reject) => {
        db.all(
          'SELECT * FROM competitor_updates WHERE competitor_id = ? ORDER BY relevance_score DESC',
          [competitorId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(updates).toHaveLength(2);
      expect(updates[0].update_type).toBe('product_launch');
    });
  });
});
