import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TestDatabaseFactory } from '../../../../../tests/utils/TestDatabaseFactory.js';
import { contentServiceInstance } from '../../../../src/services/contentService.js';

describe('ContentService Facade Smoke Test', () => {
    let db: any;

    beforeEach(async () => {
        const testDb = await TestDatabaseFactory.create();

        // We need to inject this DB into the singleton or create a new instance if possible.
        // The singleton `contentServiceInstance` is created at module load time with default DB (which strictly follows process.env).
        // To test it with TestDatabase, we might need to re-instantiate ContentService or inspect its constructor.
        // But ContentService constructor uses `getDatabase()` by default.
        // We can't easily swap the DB of the exported singleton unless we use `deps`.
        // BUT `ContentService` class is exported.
        // So we can instantiate a NEW ContentService with test DB.
    });

    it('should delegate createCategory to CategoryService', async () => {
        // Create a fresh instance with Test DB
        const testDb = await TestDatabaseFactory.create();

        // Initialize minimal schema for Category
        await testDb.exec(`
            CREATE TABLE IF NOT EXISTS content_categories (
                id TEXT PRIMARY KEY,
                name TEXT,
                slug TEXT,
                description TEXT,
                content_type TEXT,
                parent_id TEXT,
                is_active INTEGER,
                meta_title TEXT,
                meta_description TEXT,
                sort_order INTEGER DEFAULT 0,
                color TEXT DEFAULT '#6366F1',
                icon TEXT DEFAULT 'folder',
                organization_id TEXT,
                created_by TEXT,
                created_at TEXT,
                updated_at TEXT,
                UNIQUE(slug)
            );
        `);

        // We need to import the Class, not just the instance.
        // My Facade file exports `export class ContentService`.
        // So I can use it.
        const { ContentService } = await import('../../../../src/services/contentService.js');

        const dbWrapper = {
            ...testDb,
            run: testDb.runAsync.bind(testDb),
            get: testDb.getAsync.bind(testDb),
            all: testDb.allAsync.bind(testDb),
            exec: (sql: string, cb?: any) => testDb.exec(sql, cb),
            close: () => testDb.close(),
        };

        const service = new ContentService({ db: dbWrapper as any });

        const cat = await service.createCategory({
            name: 'Facade Test',
            slug: 'facade-test',
            description: 'Testing facade',
            contentType: 'TEST',
        });

        expect(cat).toBeDefined();
        expect(cat.name).toBe('Facade Test');

        // Verify it was persisted (via getCategoryById delegation)
        const fetched = await service.getCategoryById(cat.id);
        expect(fetched?.id).toBe(cat.id);

        await testDb.close();
    });
});
