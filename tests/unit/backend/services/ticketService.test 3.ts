/**
 * Tickets Service Tests
 * Real database tests for support tickets
 * 
 * @module tests/unit/backend/services/ticketService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('TicketService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS tickets (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        subject TEXT NOT NULL,
                        description TEXT,
                        status TEXT DEFAULT 'open',
                        priority TEXT DEFAULT 'medium',
                        category TEXT,
                        assigned_to TEXT,
                        resolved_at DATETIME,
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
            db.run('DELETE FROM tickets', () => resolve());
        });
    });

    describe('Ticket CRUD', () => {
        it('should create ticket', async () => {
            const ticketId = `ticket-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO tickets (id, organization_id, user_id, subject, priority) VALUES (?, ?, ?, ?, ?)',
                    [ticketId, 'org-123', 'user-456', 'Login issue', 'high'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const ticket = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(ticket).toBeDefined();
            expect(ticket.subject).toBe('Login issue');
            expect(ticket.priority).toBe('high');
        });

        it('should resolve ticket', async () => {
            const ticketId = `ticket-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO tickets (id, organization_id, user_id, subject) VALUES (?, ?, ?, ?)', [ticketId, 'org-1', 'u-1', 'Help'], (err) => err ? reject(err) : resolve());
            });

            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE tickets SET status = ?, resolved_at = datetime("now") WHERE id = ?', ['resolved', ticketId], (err) => err ? reject(err) : resolve());
            });

            const ticket = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(ticket.status).toBe('resolved');
            expect(ticket.resolved_at).not.toBeNull();
        });
    });

    describe('Ticket Queries', () => {
        it('should get open tickets', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO tickets (id, organization_id, user_id, subject, status) VALUES (?, ?, ?, ?, ?)', ['t1', 'o1', 'u1', 'T1', 'open']);
                    db.run('INSERT INTO tickets (id, organization_id, user_id, subject, status) VALUES (?, ?, ?, ?, ?)', ['t2', 'o1', 'u2', 'T2', 'resolved']);
                    db.run('INSERT INTO tickets (id, organization_id, user_id, subject, status) VALUES (?, ?, ?, ?, ?)', ['t3', 'o1', 'u3', 'T3', 'open'], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            const openTickets = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM tickets WHERE status = ?', ['open'], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(openTickets).toHaveLength(2);
        });
    });
});
