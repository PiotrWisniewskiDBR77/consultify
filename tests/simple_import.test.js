import { describe, it, expect } from 'vitest';
import { getDatabase } from '../server/src/database/Database.js';

describe('Simple Import Test', () => {
    it('should import database', () => {
        const db = getDatabase();
        expect(db).toBeDefined();
    });
});
