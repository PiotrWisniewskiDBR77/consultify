import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TestDatabaseFactory } from '../../../../../../tests/utils/TestDatabaseFactory.js';
import type { IDatabase } from '../../../../../src/database/IDatabase.js';
import { ContentSearchService } from '../../../../../src/services/content/ContentSearchService.js';

describe('ContentSearchService', () => {
  let service: ContentSearchService;
  let db: any;

  beforeEach(async () => {
    const testDb = await TestDatabaseFactory.create();

    // Initialize schema
    await testDb.exec(`
            CREATE TABLE IF NOT EXISTS ai_playbook_templates (
                id TEXT PRIMARY KEY,
                key TEXT,
                title TEXT,
                description TEXT,
                status TEXT,
                version INTEGER,
                category_id TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS email_templates (
                id TEXT PRIMARY KEY,
                name TEXT,
                subject TEXT,
                status TEXT,
                version INTEGER,
                category_id TEXT,
                created_at TEXT,
                updated_at TEXT
            );
            
            INSERT INTO ai_playbook_templates (id, title, status) VALUES ('p1', 'Strategic Playbook', 'PUBLISHED');
            INSERT INTO ai_playbook_templates (id, title, status) VALUES ('p2', 'Draft Playbook', 'DRAFT');
            
            INSERT INTO email_templates (id, name, status) VALUES ('e1', 'Welcome Email', 'PUBLISHED');
        `);

    db = {
      ...testDb,
      run: testDb.runAsync.bind(testDb),
      get: testDb.getAsync.bind(testDb),
      all: testDb.allAsync.bind(testDb),
      exec: (sql: string, cb?: any) => testDb.exec(sql, cb),
      close: () => testDb.close(),
    };

    service = new ContentSearchService({ db: db as IDatabase });
  });

  afterEach(async () => {
    if (db) await db.close();
  });

  describe('searchContent', () => {
    it('should return all content if no query', async () => {
      const results = await service.searchContent();
      expect(results.total).toBe(3);
      expect(results.items).toHaveLength(3);
      // Verify types
      const playbooks = results.items.filter((i) => i.contentType === 'PLAYBOOK_TEMPLATE');
      const emails = results.items.filter((i) => i.contentType === 'EMAIL_TEMPLATE');
      expect(playbooks).toHaveLength(2);
      expect(emails).toHaveLength(1);
    });

    it('should filter by query', async () => {
      const results = await service.searchContent({ query: 'Strategic' });
      expect(results.total).toBe(1);
      expect(results.items[0].title).toBe('Strategic Playbook');
    });

    it('should filter by status', async () => {
      const results = await service.searchContent({ statuses: ['PUBLISHED'] });
      expect(results.total).toBe(2); // p1 and e1
    });

    it('should paginate results', async () => {
      const results = await service.searchContent({ limit: 1, page: 1 });
      expect(results.items).toHaveLength(1);
      expect(results.total).toBe(3);
      expect(results.hasMore).toBe(true);

      const page2 = await service.searchContent({ limit: 1, page: 2 });
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0].id).not.toBe(results.items[0].id);
    });
  });
});
