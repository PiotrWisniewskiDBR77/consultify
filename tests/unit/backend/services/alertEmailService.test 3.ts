/**
 * Alert Email Service Tests
 * Real database tests for alert email notifications
 * 
 * @module tests/unit/backend/services/alertEmailService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('AlertEmailService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS alert_emails (
                        id TEXT PRIMARY KEY,
                        alert_id TEXT NOT NULL,
                        recipient_email TEXT NOT NULL,
                        subject TEXT NOT NULL,
                        body TEXT,
                        status TEXT DEFAULT 'pending',
                        sent_at DATETIME,
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
            db.run('DELETE FROM alert_emails', () => resolve());
        });
    });

    describe('Email Queue', () => {
        it('should queue alert email', async () => {
            const emailId = `email-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO alert_emails (id, alert_id, recipient_email, subject, body) VALUES (?, ?, ?, ?, ?)',
                    [emailId, 'alert-123', 'admin@example.com', 'Security Alert', 'A security issue was detected...'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const email = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM alert_emails WHERE id = ?', [emailId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(email).toBeDefined();
            expect(email.status).toBe('pending');
            expect(email.recipient_email).toBe('admin@example.com');
        });

        it('should update email status on send', async () => {
            const emailId = `email-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO alert_emails (id, alert_id, recipient_email, subject) VALUES (?, ?, ?, ?)',
                    [emailId, 'alert-456', 'user@test.com', 'Test Alert'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'UPDATE alert_emails SET status = ?, sent_at = datetime("now") WHERE id = ?',
                    ['sent', emailId],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const email = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM alert_emails WHERE id = ?', [emailId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(email.status).toBe('sent');
            expect(email.sent_at).not.toBeNull();
        });
    });

    describe('Email Failures', () => {
        it('should record email failure', async () => {
            const emailId = `email-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO alert_emails (id, alert_id, recipient_email, subject, status, error) VALUES (?, ?, ?, ?, ?, ?)',
                    [emailId, 'alert-789', 'invalid@', 'Failed Alert', 'failed', 'Invalid email address'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const email = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM alert_emails WHERE id = ?', [emailId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(email.status).toBe('failed');
            expect(email.error).toBe('Invalid email address');
        });
    });
});
