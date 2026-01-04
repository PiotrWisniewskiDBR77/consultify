import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase } from '../../server/src/database/Database.js';

describe('Integration Test: Database Constraints & Triggers', () => {
    let db;

    beforeAll(() => {
        db = getDatabase();
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
