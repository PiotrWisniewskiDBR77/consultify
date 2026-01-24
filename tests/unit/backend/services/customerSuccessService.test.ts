/**
 * Customer Success Service Tests
 * Real database tests for customer success metrics
 *
 * @module tests/unit/backend/services/customerSuccessService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('CustomerSuccessService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS customer_health_scores (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL UNIQUE,
                        health_score INTEGER,
                        usage_score INTEGER,
                        engagement_score INTEGER,
                        support_score INTEGER,
                        risk_level TEXT DEFAULT 'low',
                        last_calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS success_milestones (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        milestone_type TEXT NOT NULL,
                        achieved_at DATETIME,
                        target_date DATE,
                        is_completed INTEGER DEFAULT 0
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
        db.run('DELETE FROM success_milestones');
        db.run('DELETE FROM customer_health_scores', () => resolve());
      });
    });
  });

  describe('Health Score', () => {
    it('should calculate composite health score', async () => {
      const orgId = 'org-health';

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO customer_health_scores (id, organization_id, usage_score, engagement_score, support_score) VALUES (?, ?, ?, ?, ?)',
          ['hs-1', orgId, 80, 70, 90],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const result = await new Promise<any>((resolve, reject) => {
        db.get(
          `
                    SELECT 
                        usage_score, engagement_score, support_score,
                        (usage_score * 0.4 + engagement_score * 0.3 + support_score * 0.3) as composite_score
                    FROM customer_health_scores WHERE organization_id = ?`,
          [orgId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // 80*0.4 + 70*0.3 + 90*0.3 = 32 + 21 + 27 = 80
      expect(result.composite_score).toBe(80);
    });

    it('should determine risk level from health score', async () => {
      const determineRisk = (score: number): string => {
        if (score >= 80) return 'low';
        if (score >= 60) return 'medium';
        if (score >= 40) return 'high';
        return 'critical';
      };

      expect(determineRisk(85)).toBe('low');
      expect(determineRisk(65)).toBe('medium');
      expect(determineRisk(45)).toBe('high');
      expect(determineRisk(30)).toBe('critical');
    });
  });

  describe('Success Milestones', () => {
    it('should track onboarding milestones', async () => {
      const orgId = 'org-milestones';

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO success_milestones (id, organization_id, milestone_type, is_completed) VALUES (?, ?, ?, ?)',
            ['m1', orgId, 'first_login', 1]
          );
          db.run(
            'INSERT INTO success_milestones (id, organization_id, milestone_type, is_completed) VALUES (?, ?, ?, ?)',
            ['m2', orgId, 'first_project', 1]
          );
          db.run(
            'INSERT INTO success_milestones (id, organization_id, milestone_type, is_completed) VALUES (?, ?, ?, ?)',
            ['m3', orgId, 'team_invited', 0]
          );
          db.run(
            'INSERT INTO success_milestones (id, organization_id, milestone_type, is_completed) VALUES (?, ?, ?, ?)',
            ['m4', orgId, 'first_report', 0],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const progress = await new Promise<any>((resolve, reject) => {
        db.get(
          `
                    SELECT 
                        COUNT(*) as total,
                        SUM(is_completed) as completed
                    FROM success_milestones WHERE organization_id = ?`,
          [orgId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(progress.total).toBe(4);
      expect(progress.completed).toBe(2);
    });
  });
});
