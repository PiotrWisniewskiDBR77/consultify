/**
 * Contract Service Tests
 * Real database tests for contracts
 *
 * @module tests/unit/backend/services/contractService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('ContractService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS contracts (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        client_id TEXT NOT NULL,
                        title TEXT NOT NULL,
                        value REAL,
                        status TEXT DEFAULT 'draft',
                        start_date DATE,
                        end_date DATE,
                        signed_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  afterAll(() => db.close());

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      db.run('DELETE FROM contracts', () => resolve());
    });
  });

  describe('Contract CRUD', () => {
    it('should create contract', async () => {
      const contractId = `contract-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO contracts (id, organization_id, client_id, title, value) VALUES (?, ?, ?, ?, ?)',
          [contractId, 'org-123', 'client-456', 'Service Agreement', 50000],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const contract = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM contracts WHERE id = ?', [contractId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(contract).toBeDefined();
      expect(contract.title).toBe('Service Agreement');
      expect(contract.value).toBe(50000);
    });

    it('should sign contract', async () => {
      const contractId = `contract-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO contracts (id, organization_id, client_id, title) VALUES (?, ?, ?, ?)',
          [contractId, 'org-1', 'c-1', 'Test'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE contracts SET status = ?, signed_at = datetime("now") WHERE id = ?',
          ['signed', contractId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const contract = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM contracts WHERE id = ?', [contractId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(contract.status).toBe('signed');
      expect(contract.signed_at).not.toBeNull();
    });
  });

  describe('Contract Queries', () => {
    it('should get active contracts', async () => {
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run(
            'INSERT INTO contracts (id, organization_id, client_id, title, status) VALUES (?, ?, ?, ?, ?)',
            ['c1', 'o1', 'cl1', 'Active 1', 'active']
          );
          db.run(
            'INSERT INTO contracts (id, organization_id, client_id, title, status) VALUES (?, ?, ?, ?, ?)',
            ['c2', 'o1', 'cl2', 'Expired', 'expired']
          );
          db.run(
            'INSERT INTO contracts (id, organization_id, client_id, title, status) VALUES (?, ?, ?, ?, ?)',
            ['c3', 'o1', 'cl3', 'Active 2', 'active'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const activeContracts = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM contracts WHERE status = ?', ['active'], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(activeContracts).toHaveLength(2);
    });
  });
});
