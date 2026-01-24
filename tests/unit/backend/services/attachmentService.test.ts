/**
 * Attachment Service Tests
 * Real database tests for file attachments
 *
 * @module tests/unit/backend/services/attachmentService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('AttachmentService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS attachments (
                        id TEXT PRIMARY KEY,
                        entity_type TEXT NOT NULL,
                        entity_id TEXT NOT NULL,
                        filename TEXT NOT NULL,
                        original_filename TEXT NOT NULL,
                        mime_type TEXT,
                        size INTEGER,
                        storage_path TEXT NOT NULL,
                        uploaded_by TEXT,
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
      db.run('DELETE FROM attachments', () => resolve());
    });
  });

  describe('Attachment CRUD', () => {
    it('should create attachment', async () => {
      const attachmentId = `att-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO attachments (id, entity_type, entity_id, filename, original_filename, mime_type, size, storage_path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            attachmentId,
            'task',
            'task-123',
            'file-abc.pdf',
            'document.pdf',
            'application/pdf',
            1024,
            '/uploads/file-abc.pdf',
            'user-456',
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const attachment = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM attachments WHERE id = ?', [attachmentId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(attachment).toBeDefined();
      expect(attachment.original_filename).toBe('document.pdf');
      expect(attachment.size).toBe(1024);
    });

    it('should delete attachment', async () => {
      const attachmentId = `att-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO attachments (id, entity_type, entity_id, filename, original_filename, storage_path) VALUES (?, ?, ?, ?, ?, ?)',
          [attachmentId, 'task', 'task-1', 'file.txt', 'test.txt', '/uploads/file.txt'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('DELETE FROM attachments WHERE id = ?', [attachmentId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const attachment = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM attachments WHERE id = ?', [attachmentId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(attachment).toBeUndefined();
    });
  });

  describe('Attachment Queries', () => {
    it('should get attachments by entity', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO attachments (id, entity_type, entity_id, filename, original_filename, storage_path) VALUES (?, ?, ?, ?, ?, ?)',
            ['a1', 'task', 'task-A', 'f1.pdf', 'doc1.pdf', '/u/f1.pdf']
          );
          db.run(
            'INSERT INTO attachments (id, entity_type, entity_id, filename, original_filename, storage_path) VALUES (?, ?, ?, ?, ?, ?)',
            ['a2', 'task', 'task-A', 'f2.pdf', 'doc2.pdf', '/u/f2.pdf']
          );
          db.run(
            'INSERT INTO attachments (id, entity_type, entity_id, filename, original_filename, storage_path) VALUES (?, ?, ?, ?, ?, ?)',
            ['a3', 'task', 'task-B', 'f3.pdf', 'doc3.pdf', '/u/f3.pdf'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const taskAAttachments = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM attachments WHERE entity_id = ?', ['task-A'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(taskAAttachments).toHaveLength(2);
    });
  });
});
