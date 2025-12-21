import db from './server/database.js';
import OrganizationService from './server/services/organizationService.js';
import assert from 'assert';

console.log('Starting Organization Service Verification...');

async function run() {
    try {
        // Initialize DB
        if (db.initPromise) {
            await db.initPromise;
        }
        console.log('DB Initialized.');

        const testUserId = 'user-standalone-1';

        // 1. Create User
        await new Promise((resolve, reject) => {
            db.run(`INSERT OR IGNORE INTO users (id, email, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)`,
                [testUserId, 'standalone@example.com', 'Standalone', 'User', 'USER'],
                (err) => err ? reject(err) : resolve(null)
            );
        });
        console.log('Test User Created.');

        // 2. Test createOrganization
        console.log('Testing createOrganization...');
        const orgName = 'Standalone Corp';
        const org = await OrganizationService.createOrganization({
            userId: testUserId,
            name: orgName
        });

        assert.ok(org.id, 'Org ID should exist');
        assert.strictEqual(org.name, orgName, 'Org name match');
        assert.strictEqual(org.role, 'OWNER', 'Creator role should be OWNER');
        console.log('createOrganization PASSED.');

        // 3. Test addMember
        console.log('Testing addMember...');
        const memberId = 'user-standalone-2';
        await new Promise((resolve, reject) => {
            db.run(`INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)`,
                [memberId, 'member2@example.com'],
                (err) => err ? reject(err) : resolve(null)
            );
        });

        const member = await OrganizationService.addMember({
            organizationId: org.id,
            userId: memberId,
            role: 'ADMIN'
        });

        assert.strictEqual(member.userId, memberId);
        assert.strictEqual(member.role, 'ADMIN');
        console.log('addMember PASSED.');

        // 4. Test activateBilling
        console.log('Testing activateBilling...');
        const billing = await OrganizationService.activateBilling(org.id);
        assert.strictEqual(billing.success, true);
        assert.strictEqual(billing.billingStatus, 'ACTIVE');

        // Check token balance
        const updatedOrg = await OrganizationService.getOrganization(org.id);
        assert.strictEqual(updatedOrg.billing_status, 'ACTIVE');
        // Check balance (default 100k or as defined)
        // OrganizationService.activateBilling sets 100000.
        // But getOrganization might return default if column is null? 
        // Migration added defaults.
        console.log('Token Balance:', updatedOrg.token_balance);
        assert.ok(updatedOrg.token_balance >= 100000, 'Token balance should be added');

        console.log('activateBilling PASSED.');

        console.log('ALL TESTS PASSED.');
        process.exit(0);
    } catch (err) {
        console.error('VERIFICATION FAILED:', err);
        process.exit(1);
    }
}

run();
