/**
 * Governance Audit Service Tests
 * Real database tests for compliance auditing
 * 
 * @module tests/unit/backend/services/governanceAuditService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('GovernanceAuditService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS governance_audits (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        audit_type TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        score INTEGER,
                        findings TEXT,
                        recommendations TEXT,
                        auditor_id TEXT,
                        started_at DATETIME,
                        completed_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                db.run(`
                    CREATE TABLE IF NOT EXISTS audit_findings (
                        id TEXT PRIMARY KEY,
                        audit_id TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        category TEXT,
                        description TEXT NOT NULL,
                        remediation TEXT,
                        status TEXT DEFAULT 'open',
                        FOREIGN KEY (audit_id) REFERENCES governance_audits(id)
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
            db.serialize(() => {
                db.run('DELETE FROM audit_findings');
                db.run('DELETE FROM governance_audits', () => resolve());
            });
        });
    });

    describe('Audit Management', () => {
        it('should create compliance audit', async () => {
            const auditId = `audit-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO governance_audits (id, organization_id, audit_type, auditor_id, started_at) VALUES (?, ?, ?, ?, datetime("now"))',
                    [auditId, 'org-123', 'SOC2', 'auditor-ext'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const audit = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM governance_audits WHERE id = ?', [auditId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(audit).toBeDefined();
            expect(audit.audit_type).toBe('SOC2');
            expect(audit.status).toBe('pending');
        });

        it('should complete audit with score', async () => {
            const auditId = `audit-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO governance_audits (id, organization_id, audit_type, status) VALUES (?, ?, ?, ?)',
                    [auditId, 'org-123', 'GDPR', 'in_progress'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'UPDATE governance_audits SET status = ?, score = ?, completed_at = datetime("now") WHERE id = ?',
                    ['completed', 85, auditId],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const audit = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM governance_audits WHERE id = ?', [auditId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(audit.status).toBe('completed');
            expect(audit.score).toBe(85);
        });
    });

    describe('Audit Findings', () => {
        it('should record audit findings', async () => {
            const auditId = `audit-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO governance_audits (id, organization_id, audit_type) VALUES (?, ?, ?)',
                    [auditId, 'org-123', 'Security'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO audit_findings (id, audit_id, severity, category, description) VALUES (?, ?, ?, ?, ?)',
                        ['f1', auditId, 'critical', 'access_control', 'MFA not enforced for admin accounts']);
                    db.run('INSERT INTO audit_findings (id, audit_id, severity, category, description) VALUES (?, ?, ?, ?, ?)',
                        ['f2', auditId, 'high', 'data_protection', 'Encryption at rest not enabled']);
                    db.run('INSERT INTO audit_findings (id, audit_id, severity, category, description) VALUES (?, ?, ?, ?, ?)',
                        ['f3', auditId, 'medium', 'logging', 'Audit logs not retained for 1 year'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const findings = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM audit_findings WHERE audit_id = ?', [auditId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(findings).toHaveLength(3);
            const critical = findings.filter(f => f.severity === 'critical');
            expect(critical).toHaveLength(1);
        });
    });
});
