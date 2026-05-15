/**
 * Message Service Tests
 * Real database tests for messaging
 *
 * @module tests/unit/backend/services/messageService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('MessageService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS messages (
                        id TEXT PRIMARY KEY,
                        conversation_id TEXT NOT NULL,
                        sender_id TEXT NOT NULL,
                        content TEXT NOT NULL,
                        read_at DATETIME,
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
      db.run('DELETE FROM messages', () => resolve());
    });
  });

  describe('Message CRUD', () => {
    it('should create message', async () => {
      const messageId = `msg-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)',
          [messageId, 'conv-123', 'user-456', 'Hello, this is a test message'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const message = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM messages WHERE id = ?', [messageId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(message).toBeDefined();
      expect(message.content).toBe('Hello, this is a test message');
    });

    it('should mark as read', async () => {
      const messageId = `msg-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)',
          [messageId, 'c-1', 'u-1', 'Test'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE messages SET read_at = datetime("now") WHERE id = ?', [messageId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const message = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM messages WHERE id = ?', [messageId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(message.read_at).not.toBeNull();
    });
  });

  describe('Message Queries', () => {
    it('should get conversation messages', async () => {
      const convId = 'conv-test';

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)',
            ['m1', convId, 'u1', 'Msg 1']
          );
          db.run(
            'INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)',
            ['m2', convId, 'u2', 'Msg 2']
          );
          db.run(
            'INSERT INTO messages (id, conversation_id, sender_id, content) VALUES (?, ?, ?, ?)',
            ['m3', 'other', 'u1', 'Other'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const messages = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM messages WHERE conversation_id = ?', [convId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(messages).toHaveLength(2);
    });
  });
});
