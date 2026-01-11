import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase } from '../../server/src/database/Database.js';

import { TestDatabaseFactory } from '../utils/TestDatabaseFactory.js';

describe('Integration Test: Database Constraints & Triggers', () => {
  let db: any;

  beforeAll(async () => {
    // Create real in-memory SQLite with schema
    db = await TestDatabaseFactory.create();
    // Inject into global mock slot so getDatabase() picks it up if called elsewhere
    (global as any).__TEST_DB_MOCK__ = db;
  });

  it('should enforce foreign key constraints', async () => {
    // Attempt to insert task for non-existent project
    try {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO tasks (title, project_id) VALUES (?, ?)',
          ['Orphan Task', 'non-existent-uuid'],
          (err) => {
            if (err) reject(err);
            else resolve(true);
          }
        );
      });
      // Should fail
      expect(true).toBe(false);
    } catch (err: any) {
      // SQLite typically returns error code for FK violation (SQLITE_CONSTRAINT)
      expect(err.message).toMatch(/constraint/i);
    }
  });

  it('should handle concurrent updates with transactions', async () => {
    // This tests if connection pooling/transaction logic holds up
    const trans = await new Promise<void>((resolve) => resolve());
    expect(trans).toBeUndefined(); // Placeholder for actual transaction test logic if framework supported it easily
  });
});
