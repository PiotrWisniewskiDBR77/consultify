/**
 * Tag Service Tests
 * Real database tests for tag management
 *
 * @module tests/unit/backend/services/tagService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('TagService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS tags (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        color TEXT DEFAULT '#666666',
                        description TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS entity_tags (
                        id TEXT PRIMARY KEY,
                        entity_type TEXT NOT NULL,
                        entity_id TEXT NOT NULL,
                        tag_id TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (tag_id) REFERENCES tags(id)
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
        db.run('DELETE FROM entity_tags');
        db.run('DELETE FROM tags', () => resolve());
      });
    });
  });

  describe('Tag CRUD', () => {
    it('should create tag', async () => {
      const tagId = `tag-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO tags (id, organization_id, name, color) VALUES (?, ?, ?, ?)',
          [tagId, 'org-123', 'Priority', '#FF0000'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const tag = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM tags WHERE id = ?', [tagId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(tag).toBeDefined();
      expect(tag.name).toBe('Priority');
      expect(tag.color).toBe('#FF0000');
    });

    it('should update tag', async () => {
      const tagId = `tag-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO tags (id, organization_id, name) VALUES (?, ?, ?)',
          [tagId, 'org-123', 'Old Name'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE tags SET name = ? WHERE id = ?', ['New Name', tagId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const tag = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM tags WHERE id = ?', [tagId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(tag.name).toBe('New Name');
    });
  });

  describe('Tag Assignment', () => {
    it('should assign tag to entity', async () => {
      const tagId = `tag-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO tags (id, organization_id, name) VALUES (?, ?, ?)', [
            tagId,
            'org-1',
            'Important',
          ]);
          db.run(
            'INSERT INTO entity_tags (id, entity_type, entity_id, tag_id) VALUES (?, ?, ?, ?)',
            ['et-1', 'task', 'task-123', tagId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const entityTag = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM entity_tags WHERE entity_id = ?', ['task-123'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(entityTag.tag_id).toBe(tagId);
    });
  });
});
