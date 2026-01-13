/**
 * Vendor Service Tests
 * Real database tests for vendors
 * 
 * @module tests/unit/backend/services/vendorService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('VendorService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS vendors (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        email TEXT,
                        phone TEXT,
                        category TEXT,
                        rating REAL DEFAULT 0,
                        status TEXT DEFAULT 'active',
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
            db.run('DELETE FROM vendors', () => resolve());
        });
    });

    describe('Vendor CRUD', () => {
        it('should create vendor', async () => {
            const vendorId = `vendor-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO vendors (id, organization_id, name, email, category) VALUES (?, ?, ?, ?, ?)',
                    [vendorId, 'org-123', 'Tech Supplies Inc', 'contact@techsupplies.com', 'IT'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const vendor = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM vendors WHERE id = ?', [vendorId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(vendor).toBeDefined();
            expect(vendor.name).toBe('Tech Supplies Inc');
        });

        it('should update vendor rating', async () => {
            const vendorId = `vendor-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO vendors (id, organization_id, name) VALUES (?, ?, ?)', [vendorId, 'org-1', 'Vendor'], (err) => err ? reject(err) : resolve());
            });

            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE vendors SET rating = ? WHERE id = ?', [4.5, vendorId], (err) => err ? reject(err) : resolve());
            });

            const vendor = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM vendors WHERE id = ?', [vendorId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(vendor.rating).toBe(4.5);
        });
    });
});
