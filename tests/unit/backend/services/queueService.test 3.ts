/**
 * Queue Service Tests
 * Real database tests for job queue
 * 
 * @module tests/unit/backend/services/queueService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('QueueService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS job_queue (
                        id TEXT PRIMARY KEY,
                        type TEXT NOT NULL,
                        payload TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        priority INTEGER DEFAULT 0,
                        attempts INTEGER DEFAULT 0,
                        max_attempts INTEGER DEFAULT 3,
                        scheduled_at DATETIME,
                        started_at DATETIME,
                        completed_at DATETIME,
                        error TEXT,
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
            db.run('DELETE FROM job_queue', () => resolve());
        });
    });

    describe('Job CRUD', () => {
        it('should create job', async () => {
            const jobId = `job-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO job_queue (id, type, payload, priority) VALUES (?, ?, ?, ?)',
                    [jobId, 'email.send', JSON.stringify({ to: 'user@test.com' }), 10],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const job = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM job_queue WHERE id = ?', [jobId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(job).toBeDefined();
            expect(job.type).toBe('email.send');
            expect(job.priority).toBe(10);
        });

        it('should update job status', async () => {
            const jobId = `job-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO job_queue (id, type, payload) VALUES (?, ?, ?)', [jobId, 'report.generate', '{}'], (err) => err ? reject(err) : resolve());
            });

            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE job_queue SET status = ?, started_at = datetime("now") WHERE id = ?', ['processing', jobId], (err) => err ? reject(err) : resolve());
            });

            const job = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM job_queue WHERE id = ?', [jobId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(job.status).toBe('processing');
        });
    });

    describe('Job Processing', () => {
        it('should get next pending job by priority', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO job_queue (id, type, payload, priority, status) VALUES (?, ?, ?, ?, ?)', ['j1', 'low', '{}', 1, 'pending']);
                    db.run('INSERT INTO job_queue (id, type, payload, priority, status) VALUES (?, ?, ?, ?, ?)', ['j2', 'high', '{}', 10, 'pending']);
                    db.run('INSERT INTO job_queue (id, type, payload, priority, status) VALUES (?, ?, ?, ?, ?)', ['j3', 'medium', '{}', 5, 'pending'], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            const nextJob = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM job_queue WHERE status = ? ORDER BY priority DESC LIMIT 1', ['pending'], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(nextJob.id).toBe('j2');
            expect(nextJob.priority).toBe(10);
        });

        it('should mark job as failed', async () => {
            const jobId = `job-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO job_queue (id, type, payload) VALUES (?, ?, ?)', [jobId, 'failing-job', '{}'], (err) => err ? reject(err) : resolve());
            });

            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE job_queue SET status = ?, error = ?, attempts = attempts + 1 WHERE id = ?', ['failed', 'Connection timeout', jobId], (err) => err ? reject(err) : resolve());
            });

            const job = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM job_queue WHERE id = ?', [jobId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(job.status).toBe('failed');
            expect(job.error).toBe('Connection timeout');
        });
    });
});
