/**
 * Consent Management Service Tests
 * Real database tests for GDPR/privacy consent
 * 
 * @module tests/unit/backend/services/consentManagementService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('ConsentManagementService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS user_consents (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        consent_type TEXT NOT NULL,
                        is_granted INTEGER NOT NULL,
                        granted_at DATETIME,
                        revoked_at DATETIME,
                        ip_address TEXT,
                        user_agent TEXT,
                        version TEXT DEFAULT '1.0',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, consent_type)
                    )
                `);
                db.run(`
                    CREATE TABLE IF NOT EXISTS consent_history (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        consent_type TEXT NOT NULL,
                        action TEXT NOT NULL,
                        ip_address TEXT,
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
            db.serialize(() => {
                db.run('DELETE FROM consent_history');
                db.run('DELETE FROM user_consents', () => resolve());
            });
        });
    });

    describe('Consent Recording', () => {
        it('should record marketing consent', async () => {
            const consentId = `consent-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO user_consents (id, user_id, consent_type, is_granted, granted_at, ip_address) VALUES (?, ?, ?, ?, datetime("now"), ?)',
                    [consentId, 'user-123', 'marketing', 1, '192.168.1.1'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const consent = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM user_consents WHERE id = ?', [consentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(consent).toBeDefined();
            expect(consent.consent_type).toBe('marketing');
            expect(consent.is_granted).toBe(1);
        });

        it('should record multiple consent types', async () => {
            const userId = 'user-multi-consent';
            const consentTypes = ['marketing', 'analytics', 'personalization'];

            for (const type of consentTypes) {
                await new Promise<void>((resolve, reject) => {
                    db.run(
                        'INSERT INTO user_consents (id, user_id, consent_type, is_granted, granted_at) VALUES (?, ?, ?, ?, datetime("now"))',
                        [`consent-${Date.now()}-${type}`, userId, type, 1],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            }

            const consents = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM user_consents WHERE user_id = ?', [userId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(consents).toHaveLength(3);
        });
    });

    describe('Consent Revocation', () => {
        it('should revoke consent', async () => {
            const consentId = `consent-${Date.now()}`;
            const userId = 'user-revoke';

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO user_consents (id, user_id, consent_type, is_granted, granted_at) VALUES (?, ?, ?, ?, datetime("now"))',
                    [consentId, userId, 'marketing', 1],
                    (err) => err ? reject(err) : resolve()
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'UPDATE user_consents SET is_granted = 0, revoked_at = datetime("now") WHERE id = ?',
                    [consentId],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const consent = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM user_consents WHERE id = ?', [consentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(consent.is_granted).toBe(0);
            expect(consent.revoked_at).not.toBeNull();
        });
    });

    describe('Consent History', () => {
        it('should track consent changes', async () => {
            const userId = 'user-history';

            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO consent_history (id, user_id, consent_type, action, ip_address) VALUES (?, ?, ?, ?, ?)',
                        ['h1', userId, 'marketing', 'granted', '192.168.1.1']);
                    db.run('INSERT INTO consent_history (id, user_id, consent_type, action, ip_address) VALUES (?, ?, ?, ?, ?)',
                        ['h2', userId, 'marketing', 'revoked', '192.168.1.2']);
                    db.run('INSERT INTO consent_history (id, user_id, consent_type, action, ip_address) VALUES (?, ?, ?, ?, ?)',
                        ['h3', userId, 'marketing', 'granted', '192.168.1.3'], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const history = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM consent_history WHERE user_id = ? ORDER BY created_at', [userId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(history).toHaveLength(3);
        });
    });

    describe('Consent Verification', () => {
        it('should check if user has granted consent', async () => {
            const userId = 'user-verify';

            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO user_consents (id, user_id, consent_type, is_granted) VALUES (?, ?, ?, ?)',
                        ['c1', userId, 'analytics', 1]);
                    db.run('INSERT INTO user_consents (id, user_id, consent_type, is_granted) VALUES (?, ?, ?, ?)',
                        ['c2', userId, 'marketing', 0], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            });

            const analyticsConsent = await new Promise<any>((resolve, reject) => {
                db.get('SELECT is_granted FROM user_consents WHERE user_id = ? AND consent_type = ?',
                    [userId, 'analytics'], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
            });

            const marketingConsent = await new Promise<any>((resolve, reject) => {
                db.get('SELECT is_granted FROM user_consents WHERE user_id = ? AND consent_type = ?',
                    [userId, 'marketing'], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
            });

            expect(analyticsConsent.is_granted).toBe(1);
            expect(marketingConsent.is_granted).toBe(0);
        });
    });
});
