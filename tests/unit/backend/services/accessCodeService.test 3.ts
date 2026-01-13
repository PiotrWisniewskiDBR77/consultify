/**
 * Access Code Service Tests
 * Real database integration tests for trial/demo access codes
 * 
 * @module tests/unit/backend/services/accessCodeService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('AccessCodeService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS access_codes (
                        id TEXT PRIMARY KEY,
                        code TEXT UNIQUE NOT NULL,
                        type TEXT NOT NULL,
                        max_uses INTEGER DEFAULT 1,
                        current_uses INTEGER DEFAULT 0,
                        expires_at DATETIME,
                        created_by TEXT,
                        metadata TEXT,
                        is_active INTEGER DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                db.run(`
                    CREATE TABLE IF NOT EXISTS access_code_redemptions (
                        id TEXT PRIMARY KEY,
                        code_id TEXT NOT NULL,
                        user_id TEXT,
                        organization_id TEXT,
                        redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        ip_address TEXT,
                        FOREIGN KEY (code_id) REFERENCES access_codes(id)
                    )
                `, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    });

    afterAll(() => {
        db.close();
    });

    beforeEach(async () => {
        await new Promise<void>((resolve) => {
            db.serialize(() => {
                db.run('DELETE FROM access_code_redemptions');
                db.run('DELETE FROM access_codes', () => resolve());
            });
        });
    });

    describe('Access Code Generation', () => {
        it('should create trial access code', async () => {
            const codeId = `code-${Date.now()}`;
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO access_codes (id, code, type, max_uses, expires_at) VALUES (?, ?, ?, ?, ?)',
                    [codeId, 'TRIAL2026', 'trial', 100, expiresAt],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const code = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM access_codes WHERE id = ?', [codeId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(code).toBeDefined();
            expect(code.code).toBe('TRIAL2026');
            expect(code.type).toBe('trial');
            expect(code.max_uses).toBe(100);
            expect(code.current_uses).toBe(0);
        });

        it('should create single-use demo code', async () => {
            const codeId = `code-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO access_codes (id, code, type, max_uses, metadata) VALUES (?, ?, ?, ?, ?)',
                    [codeId, 'DEMO-XYZ123', 'demo', 1, JSON.stringify({ clientName: 'Acme Corp' })],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const code = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM access_codes WHERE id = ?', [codeId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(code.max_uses).toBe(1);
            const metadata = JSON.parse(code.metadata);
            expect(metadata.clientName).toBe('Acme Corp');
        });
    });

    describe('Code Redemption', () => {
        it('should redeem valid code', async () => {
            const codeId = `code-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO access_codes (id, code, type, max_uses) VALUES (?, ?, ?, ?)',
                    [codeId, 'VALID-CODE', 'trial', 10],
                    (err) => err ? reject(err) : resolve()
                );
            });

            // Redeem the code
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run(
                        'INSERT INTO access_code_redemptions (id, code_id, user_id, organization_id) VALUES (?, ?, ?, ?)',
                        [`redemption-${Date.now()}`, codeId, 'user-abc', 'org-xyz']
                    );
                    db.run(
                        'UPDATE access_codes SET current_uses = current_uses + 1 WHERE id = ?',
                        [codeId],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            });

            const code = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM access_codes WHERE id = ?', [codeId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(code.current_uses).toBe(1);
        });

        it('should track redemption history', async () => {
            const codeId = `code-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO access_codes (id, code, type, max_uses) VALUES (?, ?, ?, ?)',
                    [codeId, 'MULTI-USE', 'trial', 5],
                    (err) => err ? reject(err) : resolve()
                );
            });

            // Multiple redemptions
            for (const userId of ['user-1', 'user-2', 'user-3']) {
                await new Promise<void>((resolve, reject) => {
                    db.run(
                        'INSERT INTO access_code_redemptions (id, code_id, user_id) VALUES (?, ?, ?)',
                        [`redemption-${Date.now()}-${userId}`, codeId, userId],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            }

            const redemptions = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM access_code_redemptions WHERE code_id = ?', [codeId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(redemptions).toHaveLength(3);
        });
    });

    describe('Code Validation', () => {
        it('should identify expired code', async () => {
            const codeId = `code-${Date.now()}`;
            const expiredAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Yesterday

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO access_codes (id, code, type, expires_at) VALUES (?, ?, ?, ?)',
                    [codeId, 'EXPIRED-CODE', 'trial', expiredAt],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const validCode = await new Promise<any>((resolve, reject) => {
                db.get(
                    'SELECT * FROM access_codes WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime("now"))',
                    ['EXPIRED-CODE'],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            expect(validCode).toBeUndefined(); // Should not find expired code
        });

        it('should identify exhausted code', async () => {
            const codeId = `code-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO access_codes (id, code, type, max_uses, current_uses) VALUES (?, ?, ?, ?, ?)',
                    [codeId, 'USED-UP', 'trial', 5, 5],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const validCode = await new Promise<any>((resolve, reject) => {
                db.get(
                    'SELECT * FROM access_codes WHERE code = ? AND is_active = 1 AND current_uses < max_uses',
                    ['USED-UP'],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            expect(validCode).toBeUndefined(); // Should not find exhausted code
        });
    });
});
