import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TestDatabaseFactory } from '../../../../../../tests/utils/TestDatabaseFactory.js';
import type { IDatabase } from '../../../../../src/database/IDatabase.js';
import { TagService } from '../../../../../src/services/content/TagService.js';

describe('TagService', () => {
  let service: TagService;
  let db: any;

  beforeEach(async () => {
    // Create in-memory test database using the factory
    const testDb = await TestDatabaseFactory.create();

    // Initialize schema for content_tags and content_tag_mappings
    // Using exec ensures all statements run (including indexes)
    await testDb.exec(`
            CREATE TABLE IF NOT EXISTS content_tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT NOT NULL,
                content_type TEXT NOT NULL DEFAULT 'ALL',
                color TEXT DEFAULT '#10B981',
                organization_id TEXT,
                usage_count INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                created_by TEXT,
                FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );
            
            CREATE UNIQUE INDEX IF NOT EXISTS idx_content_tags_slug_global ON content_tags(slug) WHERE organization_id IS NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_content_tags_slug_org ON content_tags(slug, organization_id) WHERE organization_id IS NOT NULL;
            
            CREATE TABLE IF NOT EXISTS content_tag_mappings (
                id TEXT PRIMARY KEY,
                content_id TEXT NOT NULL,
                content_type TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                created_by TEXT,
                FOREIGN KEY (tag_id) REFERENCES content_tags(id) ON DELETE CASCADE,
                UNIQUE(content_id, content_type, tag_id)
            );
        `);

    // Create a proxy that maps IDatabase interface to the async methods provided by TestDatabaseFactory
    db = {
      ...testDb,
      run: testDb.runAsync.bind(testDb),
      get: testDb.getAsync.bind(testDb),
      all: testDb.allAsync.bind(testDb),
      exec: (sql: string, cb?: any) => testDb.exec(sql, cb),
      close: () => testDb.close(),
    };

    service = new TagService({ db: db as IDatabase });
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('createTag', () => {
    it('should create a tag successfully', async () => {
      const data = {
        name: 'Test Tag',
        description: 'A test tag',
        contentType: 'PLAYBOOK',
        createdBy: 'user-1',
      };

      const tag = await service.createTag(data);

      expect(tag).toBeDefined();
      expect(tag.id).toMatch(/^tag-/);
      expect(tag.name).toBe(data.name);
      expect(tag.slug).toBe('test-tag');
      expect(tag.contentType).toBe(data.contentType);
      expect(tag.usageCount).toBe(0);
      expect(tag.organizationId).toBeNull();
      expect(tag.createdBy).toBe(data.createdBy);

      // Verify persistence
      const saved = await service.getTagById(tag.id);
      expect(saved).toEqual(tag);
    });

    it('should fail on duplicate slug', async () => {
      await service.createTag({
        name: 'Duplicate',
        slug: 'duplicate',
      });

      await expect(
        service.createTag({
          name: 'Duplicate 2',
          slug: 'duplicate',
        })
      ).rejects.toThrow("Tag with slug 'duplicate' already exists");
    });
  });

  describe('listTags', () => {
    it('should list all tags', async () => {
      await service.createTag({ name: 'Tag 1' });
      await service.createTag({ name: 'Tag 2' });

      const results = await service.listTags();
      expect(results).toHaveLength(2);
    });

    it('should filter by contentType', async () => {
      await service.createTag({ name: 'General Tag', contentType: 'ALL' });
      await service.createTag({ name: 'Playbook Tag', contentType: 'PLAYBOOK' });
      await service.createTag({ name: 'Email Tag', contentType: 'EMAIL' });

      const results = await service.listTags({ contentType: 'PLAYBOOK' });

      // Should include ALL and PLAYBOOK, but NOT EMAIL
      const names = results.map((t) => t.name);
      expect(names).toContain('General Tag');
      expect(names).toContain('Playbook Tag');
      expect(names).not.toContain('Email Tag');
    });

    it('should filter by search term', async () => {
      await service.createTag({ name: 'Apple' });
      await service.createTag({ name: 'Banana' });

      const results = await service.listTags({ search: 'ppl' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Apple');
    });
  });

  describe('updateTag', () => {
    it('should update allowed fields', async () => {
      const created = await service.createTag({ name: 'Original' });
      const updated = await service.updateTag(created.id, { name: 'Updated', color: '#000000' });

      expect(updated.name).toBe('Updated');
      expect(updated.color).toBe('#000000');
      expect(updated.slug).toBe('original'); // Should not change automatically
    });

    it('should throw if tag not found', async () => {
      await expect(service.updateTag('fake', { name: 'New' })).rejects.toThrow('Tag not found');
    });
  });

  describe('deleteTag', () => {
    it('should delete existing tag', async () => {
      const created = await service.createTag({ name: 'Delete Me' });
      const result = await service.deleteTag(created.id);
      expect(result).toBe(true);

      const fetched = await service.getTagById(created.id);
      expect(fetched).toBeNull();
    });
  });

  describe('content mappings', () => {
    it('should add tag to content and increment usage count', async () => {
      const tag = await service.createTag({ name: 'Usage Tag' });

      const added = await service.addTagToContent('playbook-1', 'PLAYBOOK', tag.id, 'user-1');
      expect(added).toBe(true);

      // Verify mapping exists via getContentTags
      const tags = await service.getContentTags('playbook-1', 'PLAYBOOK');
      expect(tags).toHaveLength(1);
      expect(tags[0].id).toBe(tag.id);

      // Verify usage count increment
      const updatedTag = await service.getTagById(tag.id);
      expect(updatedTag?.usageCount).toBe(1);
    });

    it('should remove tag from content and decrement usage count', async () => {
      const tag = await service.createTag({ name: 'Remove Tag' });
      await service.addTagToContent('playbook-1', 'PLAYBOOK', tag.id);

      const removed = await service.removeTagFromContent('playbook-1', 'PLAYBOOK', tag.id);
      expect(removed).toBe(true);

      // Verify mapping removal
      const tags = await service.getContentTags('playbook-1', 'PLAYBOOK');
      expect(tags).toHaveLength(0);

      // Verify usage count decrement
      const updatedTag = await service.getTagById(tag.id);
      expect(updatedTag?.usageCount).toBe(0);
    });
  });
});
