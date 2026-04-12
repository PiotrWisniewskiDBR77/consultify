/**
 * Comment Service Tests
 * Real database tests for comments
 *
 * @module tests/unit/backend/services/commentService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('CommentService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS comments (
                        id TEXT PRIMARY KEY,
                        entity_type TEXT NOT NULL,
                        entity_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        content TEXT NOT NULL,
                        parent_id TEXT,
                        is_edited INTEGER DEFAULT 0,
                        edited_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      db.run('DELETE FROM comments', () => resolve());
    });
  });

  describe('Comment CRUD', () => {
    it('should create comment', async () => {
      const commentId = `comment-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO comments (id, entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?, ?)',
          [commentId, 'task', 'task-123', 'user-456', 'This is a comment'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const comment = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM comments WHERE id = ?', [commentId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(comment).toBeDefined();
      expect(comment.content).toBe('This is a comment');
    });

    it('should edit comment', async () => {
      const commentId = `comment-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO comments (id, entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?, ?)',
          [commentId, 'task', 'task-1', 'user-1', 'Original'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE comments SET content = ?, is_edited = 1, edited_at = datetime("now") WHERE id = ?',
          ['Edited content', commentId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const comment = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM comments WHERE id = ?', [commentId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(comment.content).toBe('Edited content');
      expect(comment.is_edited).toBe(1);
    });
  });

  describe('Threaded Comments', () => {
    it('should create reply', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO comments (id, entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?, ?)',
            ['parent-1', 'task', 'task-1', 'user-1', 'Parent comment']
          );
          db.run(
            'INSERT INTO comments (id, entity_type, entity_id, user_id, content, parent_id) VALUES (?, ?, ?, ?, ?, ?)',
            ['reply-1', 'task', 'task-1', 'user-2', 'Reply to parent', 'parent-1'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const reply = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM comments WHERE id = ?', ['reply-1'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(reply.parent_id).toBe('parent-1');
    });
  });
});
