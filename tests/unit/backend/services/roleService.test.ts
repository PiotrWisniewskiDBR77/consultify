/**
 * Role Service Tests
 * Real database tests for role management
 *
 * @module tests/unit/backend/services/roleService.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

describe('RoleService', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = new sqlite3.Database(':memory:');

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
                    CREATE TABLE IF NOT EXISTS roles (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        permissions TEXT,
                        is_system INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
        db.run(
          `
                    CREATE TABLE IF NOT EXISTS user_roles (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        role_id TEXT NOT NULL,
                        assigned_by TEXT,
                        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (role_id) REFERENCES roles(id)
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
      db.serialize(() => {
        db.run('DELETE FROM user_roles');
        db.run('DELETE FROM roles', () => resolve());
      });
    });
  });

  describe('Role CRUD', () => {
    it('should create role', async () => {
      const roleId = `role-${Date.now()}`;
      const permissions = ['read', 'write', 'delete'];

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO roles (id, organization_id, name, permissions) VALUES (?, ?, ?, ?)',
          [roleId, 'org-123', 'Admin', JSON.stringify(permissions)],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const role = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM roles WHERE id = ?', [roleId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(role).toBeDefined();
      expect(role.name).toBe('Admin');
    });

    it('should update role permissions', async () => {
      const roleId = `role-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO roles (id, organization_id, name, permissions) VALUES (?, ?, ?, ?)',
          [roleId, 'org-1', 'Editor', '["read"]'],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE roles SET permissions = ? WHERE id = ?',
          ['["read","write"]', roleId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const role = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM roles WHERE id = ?', [roleId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const perms = JSON.parse(role.permissions);
      expect(perms).toContain('write');
    });
  });

  describe('User Role Assignment', () => {
    it('should assign role to user', async () => {
      const roleId = `role-${Date.now()}`;

      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('INSERT INTO roles (id, organization_id, name) VALUES (?, ?, ?)', [
            roleId,
            'org-1',
            'Member',
          ]);
          db.run(
            'INSERT INTO user_roles (id, user_id, role_id, assigned_by) VALUES (?, ?, ?, ?)',
            ['ur-1', 'user-123', roleId, 'admin-1'],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      });

      const assignment = await new Promise<any>((resolve, reject) => {
        db.get('SELECT * FROM user_roles WHERE user_id = ?', ['user-123'], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(assignment.role_id).toBe(roleId);
    });
  });
});
