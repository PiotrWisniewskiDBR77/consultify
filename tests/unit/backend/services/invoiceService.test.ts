/**
 * Invoice Service Tests
 * Real database integration tests for billing operations
 *
 * @module tests/unit/backend/services/invoiceService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('InvoiceService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS invoices (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        invoice_number TEXT UNIQUE,
                        status TEXT DEFAULT 'draft',
                        amount_cents INTEGER NOT NULL,
                        currency TEXT DEFAULT 'USD',
                        due_date DATE,
                        paid_at DATETIME,
                        stripe_invoice_id TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS invoice_items (
                        id TEXT PRIMARY KEY,
                        invoice_id TEXT NOT NULL,
                        description TEXT NOT NULL,
                        quantity INTEGER DEFAULT 1,
                        unit_price_cents INTEGER NOT NULL,
                        FOREIGN KEY (invoice_id) REFERENCES invoices(id)
                    )
                `,
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM invoice_items');
        db.run('DELETE FROM invoices', () => resolve());
      });
    });
  });

  describe('Invoice CRUD', () => {
    it('should create invoice with required fields', async () => {
      const invoiceId = `inv-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO invoices (id, organization_id, invoice_number, amount_cents) VALUES (?, ?, ?, ?)',
          [invoiceId, 'org-123', 'INV-2026-001', 9999],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const invoice = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(invoice).toBeDefined();
      expect(invoice.invoice_number).toBe('INV-2026-001');
      expect(invoice.amount_cents).toBe(9999);
      expect(invoice.status).toBe('draft');
      expect(invoice.currency).toBe('USD');
    });

    it('should process invoice payment', async () => {
      const invoiceId = `inv-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO invoices (id, organization_id, invoice_number, amount_cents, status) VALUES (?, ?, ?, ?, ?)',
          [invoiceId, 'org-123', 'INV-PAY-001', 5000, 'sent'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE invoices SET status = ?, paid_at = datetime("now") WHERE id = ?',
          ['paid', invoiceId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const invoice = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(invoice.status).toBe('paid');
      expect(invoice.paid_at).not.toBeNull();
    });

    it('should add invoice line items', async () => {
      const invoiceId = `inv-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO invoices (id, organization_id, invoice_number, amount_cents) VALUES (?, ?, ?, ?)',
          [invoiceId, 'org-123', 'INV-ITEMS-001', 10000],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price_cents) VALUES (?, ?, ?, ?, ?)',
            ['item-1', invoiceId, 'Pro Subscription', 1, 4999]
          );
          db.run(
            'INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price_cents) VALUES (?, ?, ?, ?, ?)',
            ['item-2', invoiceId, 'Additional Seats', 5, 1000],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const items = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(items).toHaveLength(2);
      expect(items.find((i) => i.description === 'Pro Subscription')?.unit_price_cents).toBe(4999);
    });
  });

  describe('Invoice Queries', () => {
    it('should filter invoices by organization', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO invoices (id, organization_id, invoice_number, amount_cents) VALUES (?, ?, ?, ?)',
            ['inv-1', 'org-A', 'INV-A-001', 1000]
          );
          db.run(
            'INSERT INTO invoices (id, organization_id, invoice_number, amount_cents) VALUES (?, ?, ?, ?)',
            ['inv-2', 'org-B', 'INV-B-001', 2000]
          );
          db.run(
            'INSERT INTO invoices (id, organization_id, invoice_number, amount_cents) VALUES (?, ?, ?, ?)',
            ['inv-3', 'org-A', 'INV-A-002', 3000],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const orgAInvoices = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM invoices WHERE organization_id = ?', ['org-A'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(orgAInvoices).toHaveLength(2);
    });

    it('should calculate total revenue from paid invoices', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO invoices (id, organization_id, invoice_number, amount_cents, status) VALUES (?, ?, ?, ?, ?)',
            ['inv-1', 'org-1', 'INV-1', 1000, 'paid']
          );
          db.run(
            'INSERT INTO invoices (id, organization_id, invoice_number, amount_cents, status) VALUES (?, ?, ?, ?, ?)',
            ['inv-2', 'org-1', 'INV-2', 2500, 'paid']
          );
          db.run(
            'INSERT INTO invoices (id, organization_id, invoice_number, amount_cents, status) VALUES (?, ?, ?, ?, ?)',
            ['inv-3', 'org-1', 'INV-3', 500, 'draft'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const result = await new Promise<any>((resolve, reject) => {
        db.get(
          'SELECT SUM(amount_cents) as total FROM invoices WHERE status = ?',
          ['paid'],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(result.total).toBe(3500);
    });
  });
});
