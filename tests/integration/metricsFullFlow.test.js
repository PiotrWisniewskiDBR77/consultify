import { describe, it, expect, beforeAll } from 'vitest';
// Set test mode before any services are required
process.env.NODE_ENV = 'test';

const db = require('../../server/database');
const TrialService = require('../../server/services/trialService');
const MetricsCollector = require('../../server/services/metricsCollector');
const MetricsAggregator = require('../../server/services/metricsAggregator');
const AccessPolicyService = require('../../server/services/accessPolicyService');

describe('Metrics & Conversion Full Flow Integration', () => {
    let testOrgId;
    let testUserId;

    beforeAll(async () => {
        await db.initPromise;
        testUserId = 'metrics-user-' + Date.now();
    });

    it('should record full conversion funnel and show consistent data in aggregator', async () => {
        // 1. Start Trial via TrialService
        // This implicitly records MetricsCollector.EVENT_TYPES.TRIAL_STARTED
        const trial = await TrialService.createTrialOrganization(testUserId, 'Metrics Integration Org');
        testOrgId = trial.organizationId;
        expect(testOrgId).toBeDefined();

        // 2. Simulate User Behavior (Manual Events for granular control)

        // A. Help Interaction (contextual help)
        await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.HELP_STARTED, {
            organizationId: testOrgId,
            userId: testUserId,
            context: { playbookKey: 'onboarding-playbook' }
        });
        await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.HELP_COMPLETED, {
            organizationId: testOrgId,
            userId: testUserId,
            context: { playbookKey: 'onboarding-playbook' }
        });

        // B. Team Onboarding (invitations)
        await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.INVITE_SENT, {
            organizationId: testOrgId,
            userId: testUserId,
            context: { inviteeEmail: 'colleague@example.com' }
        });
        // Team member accepts
        await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.INVITE_ACCEPTED, {
            organizationId: testOrgId,
            userId: 'new-user-id',
            context: { inviteeEmail: 'colleague@example.com' }
        });

        // C. Record another invite that remains pending
        await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.INVITE_SENT, {
            organizationId: testOrgId,
            userId: testUserId,
            context: { inviteeEmail: 'pending@example.com' }
        });

        // 3. Upgrade to Paid via TrialService
        // This implicitly records MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID
        await TrialService.upgradeToPaid(testOrgId, 'ENTERPRISE', testUserId);

        // 4. Verify Aggregated Metrics
        const orgMetrics = await MetricsAggregator.getOrganizationMetrics(testOrgId);

        // Funnels & Conversion
        expect(orgMetrics.organization.plan).toBe('enterprise');

        // Team Funnel
        expect(orgMetrics.teamAdoption.invitesSent).toBe(2);
        expect(orgMetrics.teamAdoption.invitesAccepted).toBe(1);
        expect(orgMetrics.teamAdoption.acceptanceRate).toBe(50);

        // Help ROI
        expect(orgMetrics.helpUsage.playbooksStarted).toBe(1);
        expect(orgMetrics.helpUsage.playbooksCompleted).toBe(1);
        expect(orgMetrics.helpUsage.completionRate).toBe(100);

        // 5. Verify Timeline/Events
        const events = await MetricsCollector.getOrganizationEvents(testOrgId);
        expect(events.length).toBeGreaterThanOrEqual(6);

        const eventTypes = events.map(e => e.event_type);
        expect(eventTypes).toContain(MetricsCollector.EVENT_TYPES.TRIAL_STARTED);
        expect(eventTypes).toContain(MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID);
    });

    it('should generate early warnings correctly', async () => {
        const warningOrgId = 'warning-org-' + Date.now();

        // 1. Create a trial that is about to expire
        // We'll manually insert this to control trial_expires_at
        const now = new Date();
        const expiresSoon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organizations (id, name, organization_type, plan, trial_started_at, trial_expires_at, is_active, status, valid_until)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [warningOrgId, 'Warning Org', 'TRIAL', 'trial', now.toISOString(), expiresSoon.toISOString(), 1, 'active', expiresSoon.toISOString()],
                (err) => err ? reject(err) : resolve()
            );
        });

        // 2. Start help but don't finish it
        await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.HELP_STARTED, {
            organizationId: warningOrgId,
            userId: 'user-1',
            context: { playbookKey: 'test' }
        });

        // 3. Check for early warnings
        const warnings = await MetricsAggregator.checkOrganizationWarnings(warningOrgId);

        // Should have "Trial expiring soon with no conversion" or similar
        const trialWarning = warnings.find(w => w.type === 'trial_at_risk');
        expect(trialWarning).toBeDefined();
        expect(trialWarning.severity).toBe('HIGH'); // HIGH because it's expiring soon with no engagement
    });
});
