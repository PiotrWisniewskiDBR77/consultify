/**
 * Test Fixtures
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Reusable test data fixtures
 */

/**
 * Database fixtures
 */
export const databaseFixtures = {
    users: [
        {
            id: 'user-1',
            email: 'user1@example.com',
            role: 'user',
            organization_id: 'org-1',
        },
        {
            id: 'user-2',
            email: 'user2@example.com',
            role: 'admin',
            organization_id: 'org-1',
        },
    ],
    organizations: [
        {
            id: 'org-1',
            name: 'Test Organization 1',
            status: 'active',
        },
        {
            id: 'org-2',
            name: 'Test Organization 2',
            status: 'trial',
        },
    ],
    projects: [
        {
            id: 'project-1',
            name: 'Test Project 1',
            organization_id: 'org-1',
            status: 'active',
        },
    ],
};

/**
 * Service response fixtures
 */
export const serviceFixtures = {
    demoService: {
        cleanupExpiredDemos: { count: 3 },
    },
    trialService: {
        sendTrialWarnings: { count: 2 },
        processExpiredTrials: { count: 1 },
    },
    billingService: {
        resetMonthlyBudgets: {},
        checkAndTriggerAlerts: { triggeredCount: 5 },
    },
};


