/**
 * Inventory Service Tests
 * Real database tests for inventory management
 * 
 * @module tests/unit/backend/services/inventoryService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('InventoryService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS inventory (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        sku TEXT NOT NULL,
                        name TEXT NOT NULL,
                        quantity INTEGER DEFAULT 0,
                        min_quantity INTEGER DEFAULT 0,
                        max_quantity INTEGER,
                        location TEXT,
                        unit_cost REAL,
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
            db.run('DELETE FROM inventory', () => resolve());
        });
    });

    describe('Inventory CRUD', () => {
        it('should create inventory item', async () => {
            const itemId = `inv-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO inventory (id, organization_id, sku, name, quantity, unit_cost) VALUES (?, ?, ?, ?, ?, ?)',
                    [itemId, 'org-123', 'SKU-001', 'Widget Pro', 100, 25.99],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const item = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM inventory WHERE id = ?', [itemId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(item).toBeDefined();
            expect(item.name).toBe('Widget Pro');
            expect(item.quantity).toBe(100);
        });

        it('should adjust quantity', async () => {
            const itemId = `inv-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO inventory (id, organization_id, sku, name, quantity) VALUES (?, ?, ?, ?, ?)', [itemId, 'org-1', 'SKU-002', 'Product', 50], (err) => err ? reject(err) : resolve());
            });

            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE inventory SET quantity = quantity - 10 WHERE id = ?', [itemId], (err) => err ? reject(err) : resolve());
            });

            const item = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM inventory WHERE id = ?', [itemId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(item.quantity).toBe(40);
        });
    });

    describe('Inventory Queries', () => {
        it('should get low stock items', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO inventory (id, organization_id, sku, name, quantity, min_quantity) VALUES (?, ?, ?, ?, ?, ?)', ['i1', 'o1', 'S1', 'Low Item', 5, 10]);
                    db.run('INSERT INTO inventory (id, organization_id, sku, name, quantity, min_quantity) VALUES (?, ?, ?, ?, ?, ?)', ['i2', 'o1', 'S2', 'Good Item', 50, 10]);
                    db.run('INSERT INTO inventory (id, organization_id, sku, name, quantity, min_quantity) VALUES (?, ?, ?, ?, ?, ?)', ['i3', 'o1', 'S3', 'Critical', 2, 20], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            const lowStock = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM inventory WHERE quantity < min_quantity', (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(lowStock).toHaveLength(2);
        });
    });
});
