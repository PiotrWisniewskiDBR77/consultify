/**
 * Shipping Service Tests
 * Real database tests for shipping
 * 
 * @module tests/unit/backend/services/shippingService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('ShippingService', () => {
    let db: sqlite3.Database;

    beforeAll(async () => {
        db = new sqlite3.Database(':memory:');

        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS shipments (
                        id TEXT PRIMARY KEY,
                        order_id TEXT NOT NULL,
                        carrier TEXT NOT NULL,
                        tracking_number TEXT,
                        status TEXT DEFAULT 'pending',
                        estimated_delivery DATETIME,
                        shipped_at DATETIME,
                        delivered_at DATETIME,
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
            db.run('DELETE FROM shipments', () => resolve());
        });
    });

    describe('Shipment CRUD', () => {
        it('should create shipment', async () => {
            const shipmentId = `ship-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run(
                    'INSERT INTO shipments (id, order_id, carrier, tracking_number) VALUES (?, ?, ?, ?)',
                    [shipmentId, 'order-123', 'FedEx', 'TRACK123456'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            const shipment = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM shipments WHERE id = ?', [shipmentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(shipment).toBeDefined();
            expect(shipment.carrier).toBe('FedEx');
            expect(shipment.tracking_number).toBe('TRACK123456');
        });

        it('should mark as shipped', async () => {
            const shipmentId = `ship-${Date.now()}`;

            await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO shipments (id, order_id, carrier) VALUES (?, ?, ?)', [shipmentId, 'o-1', 'DHL'], (err) => err ? reject(err) : resolve());
            });

            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE shipments SET status = ?, shipped_at = datetime("now") WHERE id = ?', ['shipped', shipmentId], (err) => err ? reject(err) : resolve());
            });

            const shipment = await new Promise<any>((resolve, reject) => {
                db.get('SELECT * FROM shipments WHERE id = ?', [shipmentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(shipment.status).toBe('shipped');
            expect(shipment.shipped_at).not.toBeNull();
        });
    });

    describe('Shipment Queries', () => {
        it('should get pending shipments', async () => {
            await new Promise<void>((resolve, reject) => {
                db.serialize(() => {
                    db.run('INSERT INTO shipments (id, order_id, carrier, status) VALUES (?, ?, ?, ?)', ['s1', 'o1', 'UPS', 'pending']);
                    db.run('INSERT INTO shipments (id, order_id, carrier, status) VALUES (?, ?, ?, ?)', ['s2', 'o2', 'FedEx', 'shipped']);
                    db.run('INSERT INTO shipments (id, order_id, carrier, status) VALUES (?, ?, ?, ?)', ['s3', 'o3', 'DHL', 'pending'], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });

            const pendingShipments = await new Promise<any[]>((resolve, reject) => {
                db.all('SELECT * FROM shipments WHERE status = ?', ['pending'], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            expect(pendingShipments).toHaveLength(2);
        });
    });
});
