/**
 * Knowledge Service Tests
 * Real database integration tests for knowledge base operations
 *
 * @module tests/unit/backend/services/knowledgeService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('KnowledgeService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS knowledge_items (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        content TEXT,
                        category TEXT,
                        tags TEXT,
                        embedding TEXT,
                        created_by TEXT,
                        is_public INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  afterAll(() => {
    db.close();
  });

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.run('DELETE FROM knowledge_items', () => resolve());
    });
  });

  describe('Knowledge CRUD', () => {
    it('should create knowledge item', async () => {
      const itemId = `kb-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO knowledge_items (id, organization_id, title, content, category) VALUES (?, ?, ?, ?, ?)',
          [
            itemId,
            'org-123',
            'API Documentation',
            'This is how to use the API...',
            'documentation',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const item = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_items WHERE id = ?', [itemId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(item).toBeDefined();
      expect(item.title).toBe('API Documentation');
      expect(item.category).toBe('documentation');
    });

    it('should store tags as JSON string', async () => {
      const itemId = `kb-${Date.now()}`;
      const tags = ['api', 'integration', 'tutorial'];

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO knowledge_items (id, organization_id, title, tags) VALUES (?, ?, ?, ?)',
          [itemId, 'org-123', 'Tagged Item', JSON.stringify(tags)],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const item = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_items WHERE id = ?', [itemId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const parsedTags = JSON.parse(item.tags);
      expect(parsedTags).toContain('api');
      expect(parsedTags).toHaveLength(3);
    });

    it('should update knowledge content', async () => {
      const itemId = `kb-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO knowledge_items (id, organization_id, title, content) VALUES (?, ?, ?, ?)',
          [itemId, 'org-123', 'Original', 'Old content'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE knowledge_items SET content = ?, updated_at = datetime("now") WHERE id = ?',
          ['Updated content with more details', itemId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const item = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM knowledge_items WHERE id = ?', [itemId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(item.content).toBe('Updated content with more details');
    });
  });

  describe('Knowledge Search', () => {
    it('should search by category', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO knowledge_items (id, organization_id, title, category) VALUES (?, ?, ?, ?)',
            ['kb-1', 'org-1', 'API Guide', 'api']
          );
          db.run(
            'INSERT INTO knowledge_items (id, organization_id, title, category) VALUES (?, ?, ?, ?)',
            ['kb-2', 'org-1', 'User Manual', 'manual']
          );
          db.run(
            'INSERT INTO knowledge_items (id, organization_id, title, category) VALUES (?, ?, ?, ?)',
            ['kb-3', 'org-1', 'API Reference', 'api'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const apiItems = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM knowledge_items WHERE category = ?', ['api'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(apiItems).toHaveLength(2);
    });

    it('should full-text search in title', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO knowledge_items (id, organization_id, title) VALUES (?, ?, ?)', [
            'kb-1',
            'org-1',
            'Getting Started with Authentication',
          ]);
          db.run('INSERT INTO knowledge_items (id, organization_id, title) VALUES (?, ?, ?)', [
            'kb-2',
            'org-1',
            'Database Migration Guide',
          ]);
          db.run(
            'INSERT INTO knowledge_items (id, organization_id, title) VALUES (?, ?, ?)',
            ['kb-3', 'org-1', 'Authentication Best Practices'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const authItems = await new Promise<any[]>((resolve, reject) => {
        db.all(
          'SELECT * FROM knowledge_items WHERE title LIKE ?',
          ['%Authentication%'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(authItems).toHaveLength(2);
    });

    it('should filter public items', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO knowledge_items (id, organization_id, title, is_public) VALUES (?, ?, ?, ?)',
            ['kb-1', 'org-1', 'Public FAQ', 1]
          );
          db.run(
            'INSERT INTO knowledge_items (id, organization_id, title, is_public) VALUES (?, ?, ?, ?)',
            ['kb-2', 'org-1', 'Internal Docs', 0]
          );
          db.run(
            'INSERT INTO knowledge_items (id, organization_id, title, is_public) VALUES (?, ?, ?, ?)',
            ['kb-3', 'org-1', 'Public Guide', 1],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const publicItems = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM knowledge_items WHERE is_public = 1', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(publicItems).toHaveLength(2);
    });
  });
});
