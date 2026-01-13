/**
 * Benchmarking Service Tests
 * Real database tests for performance benchmarking
 * 
 * @module tests/unit/backend/services/benchmarkingService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('BenchmarkingService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS benchmarks (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        category TEXT,
                        score REAL,
                        industry_avg REAL,
                        percentile INTEGER,
                        measured_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            db.run('DELETE FROM benchmarks', () => resolve());
        });
    });

    describe('Benchmark Recording', () => {
        it('should record benchmark score', async () => {
            const benchmarkId = `bench-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO benchmarks (id, organization_id, name, category, score, industry_avg, percentile) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [benchmarkId, 'org-123', 'Digital Maturity', 'technology', 78.5, 65.0, 85],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const benchmark = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM benchmarks WHERE id = ?', [benchmarkId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(benchmark).toBeDefined();
            expect(benchmark.score).toBe(78.5);
            expect(benchmark.percentile).toBe(85);
        });

        it('should calculate performance vs industry average', async () => {
            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO benchmarks (id, organization_id, name, score, industry_avg) VALUES (?, ?, ?, ?, ?)',
                    ['b1', 'org-123', 'Efficiency', 85, 70],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const result = await new Promise<any>((resolve, reject) => {
                db.get('SELECT score, industry_avg, (score - industry_avg) as delta FROM benchmarks WHERE id = ?', ['b1'], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(result.delta).toBe(15); // 15 points above average
        });
    });

    describe('Benchmark Analytics', () => {
        it('should get organization benchmark summary', async () => {
            const orgId = 'org-analytics';

            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO benchmarks (id, organization_id, name, category, score) VALUES (?, ?, ?, ?, ?)',
                        ['b1', orgId, 'Innovation', 'strategy', 80]);
                    db.run('INSERT INTO benchmarks (id, organization_id, name, category, score) VALUES (?, ?, ?, ?, ?)',
                        ['b2', orgId, 'Efficiency', 'operations', 75]);
                    db.run('INSERT INTO benchmarks (id, organization_id, name, category, score) VALUES (?, ?, ?, ?, ?)',
                        ['b3', orgId, 'Culture', 'people', 90], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const summary = await new Promise<any>((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(*) as total_benchmarks,
                        AVG(score) as avg_score,
                        MIN(score) as min_score,
                        MAX(score) as max_score
                    FROM benchmarks WHERE organization_id = ?`,
                    [orgId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
            });

            expect(summary.total_benchmarks).toBe(3);
            expect(summary.avg_score).toBeCloseTo(81.67, 1);
        });
    });
});
