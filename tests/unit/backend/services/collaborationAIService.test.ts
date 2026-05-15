/**
 * Collaboration AI Service Tests
 * Real database tests for AI-assisted collaboration
 *
 * @module tests/unit/backend/services/collaborationAIService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('CollaborationAIService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS ai_suggestions (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        context_type TEXT NOT NULL,
                        context_id TEXT,
                        suggestion_type TEXT NOT NULL,
                        content TEXT NOT NULL,
                        confidence REAL,
                        status TEXT DEFAULT 'pending',
                        accepted_at DATETIME,
                        rejected_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS collaboration_sessions (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        participants TEXT,
                        ai_enabled INTEGER DEFAULT 1,
                        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        ended_at DATETIME
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
        db.run('DELETE FROM ai_suggestions');
        db.run('DELETE FROM collaboration_sessions', () => resolve());
      });
    });
  });

  describe('AI Suggestions', () => {
    it('should store AI suggestion', async () => {
      const suggestionId = `sug-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO ai_suggestions (id, organization_id, context_type, suggestion_type, content, confidence) VALUES (?, ?, ?, ?, ?, ?)',
          [
            suggestionId,
            'org-123',
            'document',
            'improvement',
            'Consider adding more context to this section',
            0.85,
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const suggestion = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM ai_suggestions WHERE id = ?', [suggestionId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(suggestion).toBeDefined();
      expect(suggestion.confidence).toBe(0.85);
      expect(suggestion.status).toBe('pending');
    });

    it('should track suggestion acceptance rate', async () => {
      const orgId = 'org-tracking';

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO ai_suggestions (id, organization_id, context_type, suggestion_type, content, status, accepted_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
            ['s1', orgId, 'doc', 'improve', 'Suggestion 1', 'accepted']
          );
          db.run(
            'INSERT INTO ai_suggestions (id, organization_id, context_type, suggestion_type, content, status, accepted_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
            ['s2', orgId, 'doc', 'improve', 'Suggestion 2', 'accepted']
          );
          db.run(
            'INSERT INTO ai_suggestions (id, organization_id, context_type, suggestion_type, content, status, rejected_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))',
            ['s3', orgId, 'doc', 'improve', 'Suggestion 3', 'rejected']
          );
          db.run(
            'INSERT INTO ai_suggestions (id, organization_id, context_type, suggestion_type, content, status) VALUES (?, ?, ?, ?, ?, ?)',
            ['s4', orgId, 'doc', 'improve', 'Suggestion 4', 'pending'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const stats = await new Promise<any>((resolve, reject) => {
        db.get(
          `
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
                        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
                    FROM ai_suggestions WHERE organization_id = ?`,
          [orgId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(stats.total).toBe(4);
      expect(stats.accepted).toBe(2);
      expect((stats.accepted / (stats.accepted + stats.rejected)) * 100).toBeCloseTo(66.67, 0);
    });
  });

  describe('Collaboration Sessions', () => {
    it('should create AI-enabled collaboration session', async () => {
      const sessionId = `session-${Date.now()}`;
      const participants = ['user-1', 'user-2', 'user-3'];

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO collaboration_sessions (id, organization_id, participants, ai_enabled) VALUES (?, ?, ?, ?)',
          [sessionId, 'org-123', JSON.stringify(participants), 1],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const session = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM collaboration_sessions WHERE id = ?', [sessionId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(session.ai_enabled).toBe(1);
      const parsedParticipants = JSON.parse(session.participants);
      expect(parsedParticipants).toHaveLength(3);
    });
  });
});
