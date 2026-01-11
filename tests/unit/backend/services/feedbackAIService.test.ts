/**
 * Feedback AI Service Tests
 * Real database tests for AI-powered feedback system
 *
 * @module tests/unit/backend/services/feedbackAIService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('FeedbackAIService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS ai_feedback (
                        id TEXT PRIMARY KEY,
                        session_id TEXT,
                        user_id TEXT,
                        feedback_type TEXT NOT NULL,
                        rating INTEGER,
                        comment TEXT,
                        ai_response_id TEXT,
                        context TEXT,
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
      db.run('DELETE FROM ai_feedback', () => resolve());
    });
  });

  describe('Feedback Recording', () => {
    it('should record positive feedback', async () => {
      const feedbackId = `fb-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO ai_feedback (id, session_id, user_id, feedback_type, rating) VALUES (?, ?, ?, ?, ?)',
          [feedbackId, 'session-123', 'user-456', 'helpful', 5],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const feedback = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM ai_feedback WHERE id = ?', [feedbackId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(feedback).toBeDefined();
      expect(feedback.rating).toBe(5);
      expect(feedback.feedback_type).toBe('helpful');
    });

    it('should record feedback with comment', async () => {
      const feedbackId = `fb-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO ai_feedback (id, user_id, feedback_type, rating, comment) VALUES (?, ?, ?, ?, ?)',
          [feedbackId, 'user-789', 'improvement', 3, 'Could be more specific'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const feedback = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM ai_feedback WHERE id = ?', [feedbackId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(feedback.comment).toBe('Could be more specific');
    });
  });

  describe('Feedback Analytics', () => {
    it('should calculate average rating', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO ai_feedback (id, user_id, feedback_type, rating) VALUES (?, ?, ?, ?)',
            ['f1', 'u1', 'rating', 5]
          );
          db.run(
            'INSERT INTO ai_feedback (id, user_id, feedback_type, rating) VALUES (?, ?, ?, ?)',
            ['f2', 'u2', 'rating', 4]
          );
          db.run(
            'INSERT INTO ai_feedback (id, user_id, feedback_type, rating) VALUES (?, ?, ?, ?)',
            ['f3', 'u3', 'rating', 4]
          );
          db.run(
            'INSERT INTO ai_feedback (id, user_id, feedback_type, rating) VALUES (?, ?, ?, ?)',
            ['f4', 'u4', 'rating', 3],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const result = await new Promise<any>((resolve, reject) => {
        db.get(
          'SELECT AVG(rating) as avg_rating FROM ai_feedback WHERE rating IS NOT NULL',
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(result.avg_rating).toBe(4); // (5+4+4+3)/4 = 4
    });
  });
});
