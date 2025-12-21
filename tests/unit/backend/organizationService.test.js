import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import OrganizationService from '../../../server/services/organizationService.js';
import db from '../../../server/database.js';

// No manual mock of database.js - using the one from setup.ts (in-memory)

describe('OrganizationService (Integration with In-Memory DB)', () => {
    let testUserId = 'user-test-1';

    beforeEach(async () => {
        // Clean up previous runs if any (though memory db should be clean if restarted, but setup.ts keeps it alive)
        // We just ensure our test user exists.
        await new Promise((resolve, reject) => {
            db.run(`INSERT OR IGNORE INTO users (id, email, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)`,
                [testUserId, 'test@example.com', 'Test', 'User', 'USER'],
                (err) => err ? reject(err) : resolve(null)
            );
        });
    });

    afterEach(async () => {
        // Cleanup created data
        // We delete orgs created by testUserId
        await new Promise((resolve) => {
            db.run(`DELETE FROM organizations WHERE created_by_user_id = ?`, [testUserId], () => resolve(null));
        });
        await new Promise((resolve) => {
            db.run(`DELETE FROM organization_members WHERE user_id = ?`, [testUserId], () => resolve(null));
        });
    });

    it('createOrganization should create an org and add creator as OWNER', async () => {
        const orgName = 'ACME Test Corp';
        const result = await OrganizationService.createOrganization({
            userId: testUserId,
            name: orgName
        });

        expect(result).toHaveProperty('id');
        expect(result.name).toBe(orgName);
        expect(result.role).toBe('OWNER');

        // Verify in DB
        const member = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ?`,
                [result.id, testUserId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });
        expect(member).not.toBeNull();
        expect(member.role).toBe('OWNER');
    });

    it('addMember should add a member successfully', async () => {
        // Setup: Create Org first
        const org = await OrganizationService.createOrganization({
            userId: testUserId,
            name: 'Member Test Org'
        });

        const newUserId = 'user-member-2';
        // Create user to add (FK might be needed if strictly enforced, usually users table constraint exists)
        await new Promise((resolve, reject) => {
            db.run(`INSERT OR IGNORE INTO users (id, email, first_name) VALUES (?, ?, ?)`,
                [newUserId, 'member@example.com', 'Member'],
                (err) => err ? reject(err) : resolve(null)
            );
        });

        const result = await OrganizationService.addMember({
            organizationId: org.id,
            userId: newUserId,
            role: 'MEMBER'
        });

        expect(result.userId).toBe(newUserId);
        expect(result.role).toBe('MEMBER');

        const member = await new Promise((resolve) => {
            db.get(`SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ?`,
                [org.id, newUserId], (err, row) => resolve(row));
        });
        expect(member).not.toBeNull();
        expect(member.role).toBe('MEMBER');
    });

    it('activateBilling should activate billing and add tokens', async () => {
        const org = await OrganizationService.createOrganization({
            userId: testUserId,
            name: 'Billing Test Org'
        });

        const result = await OrganizationService.activateBilling(org.id);

        expect(result.success).toBe(true);
        expect(result.billingStatus).toBe('ACTIVE');

        // Verify DB update
        const orgRow = await new Promise((resolve) => {
            db.get(`SELECT * FROM organizations WHERE id = ?`,
                [org.id], (err, row) => resolve(row));
        });
        expect(orgRow.billing_status).toBe('ACTIVE');
        expect(orgRow.token_balance).toBeGreaterThan(0);
    });
});
