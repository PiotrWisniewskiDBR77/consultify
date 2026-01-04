import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TestDatabaseFactory } from '../../../../../../tests/utils/TestDatabaseFactory.js';
import type { IDatabase } from '../../../../../src/database/IDatabase.js';
import { Category, CategoryService } from '../../../../../src/services/content/CategoryService.js';

describe('CategoryService', () => {
    let service: CategoryService;
    let db: any;

    beforeEach(async () => {
        // Create in-memory test database using the factory
        const testDb = await TestDatabaseFactory.create();

        // Initialize missing schema for content_categories
        await testDb.exec(`
            CREATE TABLE IF NOT EXISTS content_categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT NOT NULL,
                description TEXT,
                content_type TEXT NOT NULL DEFAULT 'ALL',
                parent_id TEXT,
                sort_order INTEGER DEFAULT 0,
                color TEXT DEFAULT '#6366F1',
                icon TEXT DEFAULT 'folder',
                organization_id TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                created_by TEXT,
                FOREIGN KEY (parent_id) REFERENCES content_categories(id) ON DELETE SET NULL,
                FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_content_categories_slug_global ON content_categories(slug) WHERE organization_id IS NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_content_categories_slug_org ON content_categories(slug, organization_id) WHERE organization_id IS NOT NULL;
        `);

        // Create a proxy that maps IDatabase interface to the async methods provided by TestDatabaseFactory
        // We cannot simply overwrite db.run because TestDatabaseFactory.runAsync calls this.run internally,
        // leading to infinite recursion.
        db = {
            ...testDb,
            run: testDb.runAsync.bind(testDb),
            get: testDb.getAsync.bind(testDb),
            all: testDb.allAsync.bind(testDb),
            exec: (sql: string, cb?: any) => testDb.exec(sql, cb), // Pass/wrap as needed
            close: () => testDb.close(),
        };

        // Mock uuidv4 to return predictable IDs for testing?
        // Or just let it run. Let's start with real IDs but we might need to mock if we assert specific IDs.
        // For now, we will verify properties of created objects.

        service = new CategoryService({ db: db as IDatabase });
    });

    afterEach(async () => {
        if (db) {
            await db.destroy();
        }
    });

    describe('createCategory', () => {
        it('should create a category successfully', async () => {
            const data = {
                name: 'Test Category',
                description: 'A test category',
                contentType: 'PLAYBOOK',
                createdBy: 'user-1',
            };

            const category = await service.createCategory(data);

            expect(category).toBeDefined();
            expect(category.id).toMatch(/^cat-/);
            expect(category.name).toBe(data.name);
            expect(category.slug).toBe('test-category');
            expect(category.description).toBe(data.description);
            expect(category.contentType).toBe(data.contentType);
            expect(category.isActive).toBe(true);
            expect(category.createdBy).toBe(data.createdBy);

            // Verify persistence
            const saved = await service.getCategoryById(category.id);
            expect(saved).toEqual(category);
        });

        it('should generate a slug from name if not provided', async () => {
            const category = await service.createCategory({
                name: 'My Cool Category!',
            });
            expect(category.slug).toBe('my-cool-category-');
        });

        it('should fail if name is missing', async () => {
            await expect(service.createCategory({} as any)).rejects.toThrow('name is required');
        });

        it('should fail on duplicate slug', async () => {
            await service.createCategory({ name: 'Duplicate', slug: 'duplicate' });

            await expect(
                service.createCategory({
                    name: 'Duplicate 2',
                    slug: 'duplicate',
                }),
            ).rejects.toThrow("Category with slug 'duplicate' already exists");
        });
    });

    describe('getCategoryById', () => {
        it('should return null for non-existent category', async () => {
            const result = await service.getCategoryById('non-existent');
            expect(result).toBeNull();
        });

        it('should return the category if it exists', async () => {
            const created = await service.createCategory({ name: 'Get Me' });
            const result = await service.getCategoryById(created.id);
            expect(result).toEqual(created);
        });
    });

    describe('listCategories', () => {
        it('should list all categories', async () => {
            await service.createCategory({ name: 'Cat 1', sortOrder: 2 });
            await service.createCategory({ name: 'Cat 2', sortOrder: 1 });

            const list = await service.listCategories();
            expect(list).toHaveLength(2);
            // Verify default valid sort order (sortOrder ASC, name ASC)
            expect(list[0].name).toBe('Cat 2'); // sortOrder 1
            expect(list[1].name).toBe('Cat 1'); // sortOrder 2
        });

        it('should filter by contentType', async () => {
            await service.createCategory({ name: 'Playbook Cat', contentType: 'PLAYBOOK' });
            await service.createCategory({ name: 'Email Cat', contentType: 'EMAIL' });
            // 'ALL' content type matches everything? Logic: (content_type = ? OR content_type = 'ALL')
            // If I search for 'PLAYBOOK', I get categories with type matches.
            // Wait, the SQL is: context_type = ? OR content_type = 'ALL'
            // If the category in DB is 'ALL', it should be returned for any query?
            // If filtering by PLAYBOOK, we want categories that are PLAYBOOK or ALL.
            await service.createCategory({ name: 'General Cat', contentType: 'ALL' });

            const results = await service.listCategories({ contentType: 'PLAYBOOK' });
            expect(results.map((c) => c.name)).toContain('Playbook Cat');
            expect(results.map((c) => c.name)).toContain('General Cat');
            expect(results.map((c) => c.name)).not.toContain('Email Cat');
        });

        it('should filter by parentId', async () => {
            const parent = await service.createCategory({ name: 'Parent' });
            const child = await service.createCategory({ name: 'Child', parentId: parent.id });
            const orphan = await service.createCategory({ name: 'Orphan' });

            const roots = await service.listCategories({ parentId: null });
            expect(roots.map((c) => c.id)).toContain(parent.id);
            expect(roots.map((c) => c.id)).toContain(orphan.id);
            expect(roots.map((c) => c.id)).not.toContain(child.id);

            const children = await service.listCategories({ parentId: parent.id });
            expect(children).toHaveLength(1);
            expect(children[0].id).toBe(child.id);
        });
    });

    describe('updateCategory', () => {
        it('should update allowed fields', async () => {
            const category = await service.createCategory({ name: 'Original', color: '#000' });

            const updated = await service.updateCategory(category.id, {
                name: 'Updated',
                color: '#FFF',
            });

            expect(updated.name).toBe('Updated');
            expect(updated.color).toBe('#FFF');
            expect(updated.slug).toBe(category.slug); // Should not change unless requested

            const fetched = await service.getCategoryById(category.id);
            expect(fetched?.name).toBe('Updated');
        });

        it('should throw if category not found', async () => {
            await expect(service.updateCategory('fake', { name: 'New' })).rejects.toThrow('Category not found');
        });
    });

    describe('deleteCategory', () => {
        it('should delete existing category', async () => {
            const category = await service.createCategory({ name: 'Delete Me' });
            const result = await service.deleteCategory(category.id);
            expect(result).toBe(true);

            const fetched = await service.getCategoryById(category.id);
            expect(fetched).toBeNull();
        });

        it('should return false if category not found', async () => {
            const result = await service.deleteCategory('fake');
            expect(result).toBe(false);
        });
    });
});
