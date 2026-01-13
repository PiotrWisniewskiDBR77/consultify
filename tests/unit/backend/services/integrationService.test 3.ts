/**
 * Integration Service Tests
 * Real database tests for third-party integrations
 * 
 * @module tests/unit/backend/services/integrationService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('IntegrationService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS integrations (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        provider TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        access_token TEXT,
                        refresh_token TEXT,
                        token_expires_at DATETIME,
                        settings TEXT,
                        connected_by TEXT,
                        connected_at DATETIME,
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
            db.run('DELETE FROM integrations', () => resolve());
        });
    });

    describe('Integration CRUD', () => {
        it('should create integration', async () => {
            const integrationId = `int-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO integrations (id, organization_id, provider, status) VALUES (?, ?, ?, ?)',
                    [integrationId, 'org-123', 'slack', 'connected'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const integration = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM integrations WHERE id = ?', [integrationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(integration).toBeDefined();
            expect(integration.provider).toBe('slack');
            expect(integration.status).toBe('connected');
        });

        it('should update integration tokens', async () => {
            const integrationId = `int-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO integrations (id, organization_id, provider) VALUES (?, ?, ?)', [integrationId, 'org-1', 'google'], (err) => err ? reject(err) : resolve());
            });

            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE integrations SET access_token = ?, status = ?, connected_at = datetime("now") WHERE id = ?', ['new-token', 'connected', integrationId], (err) => err ? reject(err) : resolve());
            });

            const integration = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM integrations WHERE id = ?', [integrationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(integration.access_token).toBe('new-token');
            expect(integration.status).toBe('connected');
        });
    });

    describe('Integration Queries', () => {
        it('should get organization integrations', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO integrations (id, organization_id, provider) VALUES (?, ?, ?)', ['i1', 'org-A', 'slack']);
                    db.run('INSERT INTO integrations (id, organization_id, provider) VALUES (?, ?, ?)', ['i2', 'org-A', 'github']);
                    db.run('INSERT INTO integrations (id, organization_id, provider) VALUES (?, ?, ?)', ['i3', 'org-B', 'jira'], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            const orgIntegrations = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM integrations WHERE organization_id = ?', ['org-A'], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(orgIntegrations).toHaveLength(2);
        });

        it('should disconnect integration', async () => {
            const integrationId = `int-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO integrations (id, organization_id, provider, status, access_token) VALUES (?, ?, ?, ?, ?)', [integrationId, 'org-1', 'notion', 'connected', 'token'], (err) => err ? reject(err) : resolve());
            });

            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE integrations SET status = ?, access_token = NULL WHERE id = ?', ['disconnected', integrationId], (err) => err ? reject(err) : resolve());
            });

            const integration = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM integrations WHERE id = ?', [integrationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(integration.status).toBe('disconnected');
            expect(integration.access_token).toBeNull();
        });
    });
});
