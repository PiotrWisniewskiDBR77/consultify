const PermissionService = require('./server/services/permissionService');
const GovernanceService = require('./server/services/governanceService');

// Mock Data
const MOCK_USERS = {
    ADMIN: { role: 'ADMIN', organizationId: 'ORG1' },
    PM: { role: 'PROJECT_MANAGER', organizationId: 'ORG1' },
    MEMBER: { role: 'TEAM_MEMBER', organizationId: 'ORG1' },
    VIEWER: { role: 'VIEWER', organizationId: 'ORG1' }
};

async function testRBAC() {
    console.log('--- Testing RBAC ---');

    // 1. Admin should be able to Manage Users
    const adminCanManage = PermissionService.can(MOCK_USERS.ADMIN, 'manage_users');
    console.log(`Admin can manage_users: ${adminCanManage} (Expected: true)`);
    if (!adminCanManage) throw new Error('RBAC Fail: Admin should manage users');

    // 2. PM should NOT be able to Manage Users
    const pmCanManage = PermissionService.can(MOCK_USERS.PM, 'manage_users');
    console.log(`PM can manage_users: ${pmCanManage} (Expected: false)`);
    if (pmCanManage) throw new Error('RBAC Fail: PM should not manage users');

    // 3. PM Should be able to Approve Changes
    const pmCanApprove = PermissionService.can(MOCK_USERS.PM, 'approve_changes');
    console.log(`PM can approve_changes: ${pmCanApprove} (Expected: true)`);
    if (!pmCanApprove) throw new Error('RBAC Fail: PM should approve changes');
}

async function testGovernance() {
    console.log('\n--- Testing Governance Service ---');
    try {
        const cr = await GovernanceService.createChangeRequest({
            projectId: 'PROJ1',
            title: 'Test CR',
            type: 'SCOPE',
            description: 'Increasing scope',
            riskAssessment: 'LOW',
            createdBy: 'USER1'
        });
        console.log('CR Created:', cr.id, cr.status);

        if (cr.status !== 'DRAFT') throw new Error('New CR must be DRAFT');

        const approved = await GovernanceService.decideChangeRequest(cr.id, 'APPROVED', 'ADMIN1', 'LGTM');
        console.log('CR Approved:', approved.status);
    } catch (e) {
        console.error("Governance Test Failed", e);
    }
}

async function run() {
    await testRBAC();
    // Governance tests need DB active, skipping for pure unit check unless we mock DB
    // await testGovernance(); // Uncomment if running with active DB context
}

run();
