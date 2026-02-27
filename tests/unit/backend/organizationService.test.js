/**
 * Organization Service Unit Tests
 * Tests organization CRUD, member management, billing, and AI settings
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';
const describeIfDb = RUN_DB_TESTS ? describe : describe.skip;

vi.hoisted(() => {
  if (process.env.RUN_DB_TESTS !== '1') return;
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-org-service-${workerId}.db`;
});

// Dynamic import for ESM
let OrganizationService;

describeIfDb('OrganizationService', () => {
  const db = getDatabase();
  let testUserId;
  let testUserEmail;
  let createdOrgIds = [];

  beforeAll(async () => {
    await initializeDatabase();

    // Import service
    OrganizationService = (await import('../../../server/src/services/organizationService.js'))
      .default;

    // Create test user
    testUserId = uuidv4();
    testUserEmail = `orgtest-${Date.now()}@test.com`;
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
        [testUserId, testUserEmail, 'hashed-password', 'ADMIN', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  afterAll(async () => {
    // Cleanup created orgs
    for (const orgId of createdOrgIds) {
      await new Promise((r) =>
        db.run(`DELETE FROM organization_members WHERE organization_id = ?`, [orgId], () => r())
      );
      await new Promise((r) =>
        db.run(`DELETE FROM organizations WHERE id = ?`, [orgId], () => r())
      );
    }
    await new Promise((r) => db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => r()));
  });

  describe('createOrganization', () => {
    it('should create a new organization', async () => {
      const result = await OrganizationService.createOrganization({
        userId: testUserId,
        name: 'Test Organization',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Organization');
      expect(result.role).toBe('OWNER');

      createdOrgIds.push(result.id);
    });

    it('should store organization in database', async () => {
      const result = await OrganizationService.createOrganization({
        userId: testUserId,
        name: 'DB Test Org',
      });
      createdOrgIds.push(result.id);

      const dbOrg = await new Promise((resolve) => {
        db.get(`SELECT * FROM organizations WHERE id = ?`, [result.id], (_, row) => resolve(row));
      });

      expect(dbOrg).toBeDefined();
      expect(dbOrg.name).toBe('DB Test Org');
      expect(dbOrg.billing_status).toBe('TRIAL');
      expect(String(dbOrg.organization_type || 'TRIAL')).toBe('TRIAL');
      expect(dbOrg.trial_started_at).toBeTruthy();
      expect(dbOrg.trial_expires_at).toBeTruthy();
    });

    it('should add creator as OWNER member', async () => {
      const result = await OrganizationService.createOrganization({
        userId: testUserId,
        name: 'Owner Test Org',
      });
      createdOrgIds.push(result.id);

      const member = await new Promise((resolve) => {
        db.get(
          `SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ?`,
          [result.id, testUserId],
          (_, row) => resolve(row)
        );
      });

      expect(member).toBeDefined();
      expect(member.role).toBe('OWNER');
    });
  });

  describe('getOrganization', () => {
    it('should return organization by ID', async () => {
      const created = await OrganizationService.createOrganization({
        userId: testUserId,
        name: 'Get Test Org',
      });
      createdOrgIds.push(created.id);

      const org = await OrganizationService.getOrganization(created.id);

      expect(org).toBeDefined();
      expect(org.id).toBe(created.id);
      expect(org.name).toBe('Get Test Org');
    });

    it('should throw for non-existent ID', async () => {
      await expect(OrganizationService.getOrganization('non-existent-id')).rejects.toThrow(
        'Organization not found'
      );
    });
  });

  describe('addMember', () => {
    it('should add a member to organization', async () => {
      const org = await OrganizationService.createOrganization({
        userId: testUserId,
        name: 'Add Member Org',
      });
      createdOrgIds.push(org.id);

      // Create another user
      const newUserId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO users (id, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
          [newUserId, `member-${Date.now()}@test.com`, 'hash', 'USER', 'active'],
          () => resolve()
        );
      });

      const result = await OrganizationService.addMember({
        organizationId: org.id,
        userId: newUserId,
        role: 'MEMBER',
      });

      expect(result).toBeDefined();
      expect(result.role).toBe('MEMBER');
      expect(result.userId).toBe(newUserId);

      // Cleanup
      await new Promise((r) => db.run(`DELETE FROM users WHERE id = ?`, [newUserId], () => r()));
    });

    it('should reject invalid roles', async () => {
      const org = await OrganizationService.createOrganization({
        userId: testUserId,
        name: 'Invalid Role Org',
      });
      createdOrgIds.push(org.id);

      await expect(
        OrganizationService.addMember({
          organizationId: org.id,
          userId: uuidv4(),
          role: 'INVALID_ROLE',
        })
      ).rejects.toThrow('Invalid role');
    });
  });

  describe('getMembers', () => {
    it('should return organization members', async () => {
      const org = await OrganizationService.createOrganization({
        userId: testUserId,
        name: 'Get Members Org',
      });
      createdOrgIds.push(org.id);

      const members = await OrganizationService.getMembers(org.id);

      expect(members).toBeDefined();
      expect(members.length).toBeGreaterThanOrEqual(1);
      expect(members.some((m) => m.role === 'OWNER')).toBe(true);
    });
  });

  describe('getUserOrganizations', () => {
    it('should return user organizations', async () => {
      const org = await OrganizationService.createOrganization({
        userId: testUserId,
        name: 'User Orgs Test',
      });
      createdOrgIds.push(org.id);

      const orgs = await OrganizationService.getUserOrganizations(testUserId);

      expect(orgs).toBeDefined();
      expect(orgs.length).toBeGreaterThanOrEqual(1);
      expect(orgs.some((o) => o.id === org.id)).toBe(true);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const org = await OrganizationService.createOrganization({
        userId: testUserId,
        name: 'Role Update Org',
      });
      createdOrgIds.push(org.id);

      // Create another user
      const newUserId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO users (id, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
          [newUserId, `roletest-${Date.now()}@test.com`, 'hash', 'USER', 'active'],
          () => resolve()
        );
      });

      await OrganizationService.addMember({
        organizationId: org.id,
        userId: newUserId,
        role: 'MEMBER',
      });

      const result = await OrganizationService.updateMemberRole({
        organizationId: org.id,
        userId: newUserId,
        role: 'ADMIN',
      });

      expect(result.role).toBe('ADMIN');

      // Cleanup
      await new Promise((r) => db.run(`DELETE FROM users WHERE id = ?`, [newUserId], () => r()));
    });
  });

  describe('removeMember', () => {
    it('should remove member from organization', async () => {
      const org = await OrganizationService.createOrganization({
        userId: testUserId,
        name: 'Remove Member Org',
      });
      createdOrgIds.push(org.id);

      // Create another user
      const newUserId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO users (id, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
          [newUserId, `remove-${Date.now()}@test.com`, 'hash', 'USER', 'active'],
          () => resolve()
        );
      });

      await OrganizationService.addMember({
        organizationId: org.id,
        userId: newUserId,
        role: 'MEMBER',
      });

      await OrganizationService.removeMember({
        organizationId: org.id,
        userId: newUserId,
      });

      const role = await OrganizationService.getMemberRole(org.id, newUserId);
      expect(role).toBeNull();

      // Cleanup
      await new Promise((r) => db.run(`DELETE FROM users WHERE id = ?`, [newUserId], () => r()));
    });
  });

  describe('AI Settings', () => {
    it('should get default AI settings', async () => {
      const org = await OrganizationService.createOrganization({
        userId: testUserId,
        name: 'AI Settings Org',
      });
      createdOrgIds.push(org.id);

      const settings = await OrganizationService.getAISettings(org.id);

      expect(settings).toBeDefined();
      expect(settings.ai_assertiveness_level).toBeDefined();
      expect(settings.ai_autonomy_level).toBeDefined();
    });

    it('should update AI settings', async () => {
      const org = await OrganizationService.createOrganization({
        userId: testUserId,
        name: 'Update AI Org',
      });
      createdOrgIds.push(org.id);

      await OrganizationService.updateAISettings(org.id, {
        ai_assertiveness_level: 'HIGH',
        ai_autonomy_level: 'AUTO_EXECUTE',
      });

      const settings = await OrganizationService.getAISettings(org.id);
      expect(settings.ai_assertiveness_level).toBe('HIGH');
      expect(settings.ai_autonomy_level).toBe('AUTO_EXECUTE');
    });
  });

  describe('Roles Validation', () => {
    it('should have valid role constants', () => {
      expect(OrganizationService.ROLES.OWNER).toBe('OWNER');
      expect(OrganizationService.ROLES.ADMIN).toBe('ADMIN');
      expect(OrganizationService.ROLES.MEMBER).toBe('MEMBER');
      expect(OrganizationService.ROLES.CONSULTANT).toBe('CONSULTANT');
    });
  });
});
