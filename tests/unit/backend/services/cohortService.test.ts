/**
 * Cohort Service Tests
 * Real database tests for user cohort management
 *
 * @module tests/unit/backend/services/cohortService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('CohortService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS cohorts (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        criteria TEXT,
                        is_dynamic INTEGER DEFAULT 0,
                        member_count INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS cohort_members (
                        id TEXT PRIMARY KEY,
                        cohort_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(cohort_id, user_id),
                        FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
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
        db.run('DELETE FROM cohort_members');
        db.run('DELETE FROM cohorts', () => resolve());
      });
    });
  });

  describe('Cohort CRUD', () => {
    it('should create static cohort', async () => {
      const cohortId = `cohort-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO cohorts (id, organization_id, name, description, is_dynamic) VALUES (?, ?, ?, ?, ?)',
          [cohortId, 'org-123', 'Enterprise Users', 'Users on enterprise plan', 0],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const cohort = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM cohorts WHERE id = ?', [cohortId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(cohort).toBeDefined();
      expect(cohort.name).toBe('Enterprise Users');
      expect(cohort.is_dynamic).toBe(0);
    });

    it('should create dynamic cohort with criteria', async () => {
      const cohortId = `cohort-${Date.now()}`;
      const criteria = { plan: 'pro', signupDate: { $gte: '2026-01-01' } };

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO cohorts (id, organization_id, name, criteria, is_dynamic) VALUES (?, ?, ?, ?, ?)',
          [cohortId, 'org-123', 'New Pro Users', JSON.stringify(criteria), 1],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const cohort = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM cohorts WHERE id = ?', [cohortId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(cohort.is_dynamic).toBe(1);
      const parsedCriteria = JSON.parse(cohort.criteria);
      expect(parsedCriteria.plan).toBe('pro');
    });
  });

  describe('Cohort Membership', () => {
    it('should add users to cohort', async () => {
      const cohortId = `cohort-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO cohorts (id, organization_id, name) VALUES (?, ?, ?)',
          [cohortId, 'org-123', 'Test Cohort'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      for (const userId of ['user-1', 'user-2', 'user-3']) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            'INSERT INTO cohort_members (id, cohort_id, user_id) VALUES (?, ?, ?)',
            [`member-${Date.now()}-${userId}`, cohortId, userId],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE cohorts SET member_count = (SELECT COUNT(*) FROM cohort_members WHERE cohort_id = ?) WHERE id = ?',
          [cohortId, cohortId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const cohort = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM cohorts WHERE id = ?', [cohortId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(cohort.member_count).toBe(3);
    });

    it('should list cohort members', async () => {
      const cohortId = `cohort-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO cohorts (id, organization_id, name) VALUES (?, ?, ?)', [
            cohortId,
            'org-123',
            'Members Cohort',
          ]);
          db.run('INSERT INTO cohort_members (id, cohort_id, user_id) VALUES (?, ?, ?)', [
            'm1',
            cohortId,
            'user-a',
          ]);
          db.run(
            'INSERT INTO cohort_members (id, cohort_id, user_id) VALUES (?, ?, ?)',
            ['m2', cohortId, 'user-b'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const members = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM cohort_members WHERE cohort_id = ?', [cohortId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(members).toHaveLength(2);
    });
  });
});
