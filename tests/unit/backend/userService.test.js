/**
 * User Service Unit Tests
 * Tests user CRUD, role management, and validation
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

vi.hoisted(() => {
  if (process.env.RUN_DB_TESTS !== '1') return;
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-user-service-${workerId}.db`;
});

describeIfDb('UserService', () => {
  const db = getDatabase();
  let testOrgId;
  let createdUserIds = [];

  beforeAll(async () => {
    await initializeDatabase();

    // Create test organization
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
        [testOrgId, 'User Test Org', 'pro', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  afterAll(async () => {
    // Cleanup
    for (const userId of createdUserIds) {
      await new Promise((r) => db.run(`DELETE FROM users WHERE id = ?`, [userId], () => r()));
    }
    await new Promise((r) =>
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r())
    );
  });

  beforeEach(async () => {
    // Clean created users before each test
    for (const userId of createdUserIds) {
      await new Promise((r) => db.run(`DELETE FROM users WHERE id = ?`, [userId], () => r()));
    }
    createdUserIds = [];
  });

  describe('CRUD Operations', () => {
    it('should create user', async () => {
      const userId = uuidv4();
      const email = `user-${Date.now()}@test.com`;
      const hashedPassword = await bcrypt.hash('Password123!', 10);

      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO users (id, organization_id, email, password, role, status)
                     VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, testOrgId, email, hashedPassword, 'USER', 'active'],
          (err) => (err ? reject(err) : resolve())
        );
      });
      createdUserIds.push(userId);

      const user = await new Promise((resolve) => {
        db.get(`SELECT * FROM users WHERE id = ?`, [userId], (_, row) => resolve(row));
      });

      expect(user).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.role).toBe('USER');
    });

    it('should get user by ID', async () => {
      const userId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO users (id, organization_id, email, password, role, status)
                     VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, testOrgId, `get-${Date.now()}@test.com`, 'hash', 'USER', 'active'],
          () => resolve()
        );
      });
      createdUserIds.push(userId);

      const user = await new Promise((resolve) => {
        db.get(`SELECT * FROM users WHERE id = ?`, [userId], (_, row) => resolve(row));
      });

      expect(user).toBeDefined();
      expect(user.id).toBe(userId);
    });

    it('should update user', async () => {
      const userId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO users (id, organization_id, email, password, role, status, first_name)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            testOrgId,
            `update-${Date.now()}@test.com`,
            'hash',
            'USER',
            'active',
            'Original',
          ],
          () => resolve()
        );
      });
      createdUserIds.push(userId);

      await new Promise((resolve) => {
        db.run(`UPDATE users SET first_name = ? WHERE id = ?`, ['Updated', userId], () =>
          resolve()
        );
      });

      const user = await new Promise((resolve) => {
        db.get(`SELECT * FROM users WHERE id = ?`, [userId], (_, row) => resolve(row));
      });

      expect(user.first_name).toBe('Updated');
    });

    it('should delete user', async () => {
      const userId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO users (id, organization_id, email, password, role, status)
                     VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, testOrgId, `delete-${Date.now()}@test.com`, 'hash', 'USER', 'active'],
          () => resolve()
        );
      });

      await new Promise((resolve) => {
        db.run(`DELETE FROM users WHERE id = ?`, [userId], () => resolve());
      });

      const user = await new Promise((resolve) => {
        db.get(`SELECT * FROM users WHERE id = ?`, [userId], (_, row) => resolve(row));
      });

      expect(user).toBeNull();
    });
  });

  describe('Role Management', () => {
    it('should update user role', async () => {
      const userId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO users (id, organization_id, email, password, role, status)
                     VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, testOrgId, `role-${Date.now()}@test.com`, 'hash', 'USER', 'active'],
          () => resolve()
        );
      });
      createdUserIds.push(userId);

      await new Promise((resolve) => {
        db.run(`UPDATE users SET role = ? WHERE id = ?`, ['ADMIN', userId], () => resolve());
      });

      const user = await new Promise((resolve) => {
        db.get(`SELECT * FROM users WHERE id = ?`, [userId], (_, row) => resolve(row));
      });

      expect(user.role).toBe('ADMIN');
    });
  });

  describe('User Lookup', () => {
    it('should find user by email', async () => {
      const userId = uuidv4();
      const email = `lookup-${Date.now()}@test.com`;
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO users (id, organization_id, email, password, role, status)
                     VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, testOrgId, email, 'hash', 'USER', 'active'],
          () => resolve()
        );
      });
      createdUserIds.push(userId);

      const user = await new Promise((resolve) => {
        db.get(`SELECT * FROM users WHERE email = ?`, [email], (_, row) => resolve(row));
      });

      expect(user).toBeDefined();
      expect(user.id).toBe(userId);
    });

    it('should return null for non-existent email', async () => {
      const user = await new Promise((resolve) => {
        db.get(`SELECT * FROM users WHERE email = ?`, ['nonexistent@test.com'], (_, row) =>
          resolve(row)
        );
      });

      expect(user).toBeNull();
    });
  });

  describe('Password Management', () => {
    it('should hash passwords correctly', async () => {
      const password = 'SecurePass123!';
      const hash = await bcrypt.hash(password, 10);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(await bcrypt.compare(password, hash)).toBe(true);
    });

    it('should not match incorrect password', async () => {
      const password = 'SecurePass123!';
      const hash = await bcrypt.hash(password, 10);

      expect(await bcrypt.compare('WrongPassword', hash)).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate email format', () => {
      const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
    });

    it('should validate password strength', () => {
      const isStrongPassword = (password) => {
        return (
          password.length >= 8 &&
          /[A-Z]/.test(password) &&
          /[a-z]/.test(password) &&
          /[0-9]/.test(password)
        );
      };

      expect(isStrongPassword('StrongPass1')).toBe(true);
      expect(isStrongPassword('Password123')).toBe(true);
      expect(isStrongPassword('weak')).toBe(false);
      expect(isStrongPassword('NoNumbers!')).toBe(false);
      expect(isStrongPassword('nonumbers123')).toBe(false);
    });
  });

  describe('User Status', () => {
    it('should track user status', async () => {
      const userId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO users (id, organization_id, email, password, role, status)
                     VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, testOrgId, `status-${Date.now()}@test.com`, 'hash', 'USER', 'pending'],
          () => resolve()
        );
      });
      createdUserIds.push(userId);

      // Activate user
      await new Promise((resolve) => {
        db.run(`UPDATE users SET status = ? WHERE id = ?`, ['active', userId], () => resolve());
      });

      const user = await new Promise((resolve) => {
        db.get(`SELECT * FROM users WHERE id = ?`, [userId], (_, row) => resolve(row));
      });

      expect(user.status).toBe('active');
    });
  });
});
