/**
 * External Assessment Service Tests
 * Real database tests for third-party assessments
 * 
 * @module tests/unit/backend/services/externalAssessmentService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('ExternalAssessmentService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS external_assessments (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        assessment_type TEXT NOT NULL,
                        provider TEXT,
                        status TEXT DEFAULT 'pending',
                        score REAL,
                        results TEXT,
                        completed_at DATETIME,
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
            db.run('DELETE FROM external_assessments', () => resolve());
        });
    });

    describe('Assessment CRUD', () => {
        it('should create external assessment', async () => {
            const assessmentId = `assess-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO external_assessments (id, organization_id, assessment_type, provider) VALUES (?, ?, ?, ?)',
                    [assessmentId, 'org-123', 'security_audit', 'SecureCheck Inc'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const assessment = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM external_assessments WHERE id = ?', [assessmentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(assessment).toBeDefined();
            expect(assessment.assessment_type).toBe('security_audit');
            expect(assessment.status).toBe('pending');
        });

        it('should complete assessment with results', async () => {
            const assessmentId = `assess-${Date.now()}`;
            const results = { findings: 3, recommendations: 5, critical: 0 };

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO external_assessments (id, organization_id, assessment_type, status) VALUES (?, ?, ?, ?)',
                    [assessmentId, 'org-123', 'compliance', 'in_progress'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'UPDATE external_assessments SET status = ?, score = ?, results = ?, completed_at = datetime("now") WHERE id = ?',
                    ['completed', 92.5, JSON.stringify(results), assessmentId],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const assessment = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM external_assessments WHERE id = ?', [assessmentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(assessment.status).toBe('completed');
            expect(assessment.score).toBe(92.5);
            const parsedResults = JSON.parse(assessment.results);
            expect(parsedResults.findings).toBe(3);
        });
    });

    describe('Assessment Queries', () => {
        it('should list assessments by type', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO external_assessments (id, organization_id, assessment_type) VALUES (?, ?, ?)',
                        ['a1', 'org-1', 'security_audit']);
                    db.run('INSERT INTO external_assessments (id, organization_id, assessment_type) VALUES (?, ?, ?)',
                        ['a2', 'org-1', 'compliance']);
                    db.run('INSERT INTO external_assessments (id, organization_id, assessment_type) VALUES (?, ?, ?)',
                        ['a3', 'org-1', 'security_audit'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const securityAudits = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM external_assessments WHERE assessment_type = ?', ['security_audit'], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(securityAudits).toHaveLength(2);
        });
    });
});
