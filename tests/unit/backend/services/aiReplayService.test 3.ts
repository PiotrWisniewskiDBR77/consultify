/**
 * AI Replay Service Tests
 * Real database tests for AI conversation replay
 * 
 * @module tests/unit/backend/services/aiReplayService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('AIReplayService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS ai_replays (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        replay_data TEXT NOT NULL,
                        replay_type TEXT,
                        duration_ms INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    });

    afterAll(() => db.close());

    beforeEach(async () => {
        await new Promise<void>((resolve) => {
            db.run('DELETE FROM ai_replays', () => resolve());
        });
    });

    describe('Replay Recording', () => {
        it('should record AI session replay', async () => {
            const replayId = `replay-${Date.now()}`;
            const replayData = {
                messages: [
                    { role: 'user', content: 'Hello AI' },
                    { role: 'assistant', content: 'Hello! How can I help?' }
                ],
                context: { mode: 'assistant' }
            };

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO ai_replays (id, session_id, user_id, replay_data, replay_type, duration_ms) VALUES (?, ?, ?, ?, ?, ?)',
                    [replayId, 'session-123', 'user-456', JSON.stringify(replayData), 'conversation', 5000],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const replay = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM ai_replays WHERE id = ?', [replayId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(replay).toBeDefined();
            expect(replay.duration_ms).toBe(5000);
            const data = JSON.parse(replay.replay_data);
            expect(data.messages).toHaveLength(2);
        });
    });

    describe('Replay Queries', () => {
        it('should list replays by user', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO ai_replays (id, session_id, user_id, replay_data) VALUES (?, ?, ?, ?)',
                        ['r1', 's1', 'user-A', '{}']);
                    db.run('INSERT INTO ai_replays (id, session_id, user_id, replay_data) VALUES (?, ?, ?, ?)',
                        ['r2', 's2', 'user-A', '{}']);
                    db.run('INSERT INTO ai_replays (id, session_id, user_id, replay_data) VALUES (?, ?, ?, ?)',
                        ['r3', 's3', 'user-B', '{}'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const userAReplays = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM ai_replays WHERE user_id = ?', ['user-A'], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(userAReplays).toHaveLength(2);
        });
    });
});
