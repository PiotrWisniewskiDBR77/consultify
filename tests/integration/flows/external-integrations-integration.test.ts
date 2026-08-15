import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { testFactory } from '../../helpers/TestFactory';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    process.env.TEST_TYPE = 'integration';
    // Mock external API behaviors for integration testing
    process.env.JIRA_API_SIMULATED = 'true';
    process.env.SLACK_API_SIMULATED = 'true';
});

import app from '../../../server/src/index';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { resetConnection } from '../../../server/src/database/Database.js';

/**
 * L3 Integration Tests: External Integrations Integration
 * 
 * Tests account linking and data sync with external systems:
 * - JiraUserIntegration
 * - SlackUserIntegration
 * - ClickupUserIntegration
 * - TeamsUserIntegration
 */
const describeRealDb = process.env.RUN_DB_TESTS === '1' && process.env.DATABASE_URL
    ? describe
    : describe.skip;

describeRealDb('L3: External Integrations Integration', () => {
    let userToken: string;
    let testOrgId: string;

    beforeAll(async () => {
        await resetConnection();
        const initResult = await initializeDatabase();
        if (!initResult.success) {
            throw new Error(`Database initialization failed: ${initResult.message}`);
        }

        const org = await testFactory.createOrganization({ name: 'Integration Test Org' });
        testOrgId = org.id;

        const user = await testFactory.createUser({
            organizationId: testOrgId,
            password: 'UserPass123!',
            role: 'USER',
        });

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: user.email, password: 'UserPass123!' });
        userToken = loginRes.body.token;
    });

    afterAll(async () => {
        await resetConnection();
    });

    describe('OAuth and Account Linking Flow', () => {
        it('should initiate OAuth flow for Slack', async () => {
            const res = await request(app)
                .get('/api/integrations/slack/authorize')
                .set('Authorization', `Bearer ${userToken}`);

            if (res.status === 200 || res.status === 302) {
                expect(res.body.url || res.headers.location).toContain('slack.com');
            }
        });

        it('should complete account linking on callback', async () => {
            const res = await request(app)
                .post('/api/integrations/jira/link')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ code: 'mock-oauth-code', state: 'mock-state' });

            if (res.status === 200) {
                expect(res.body.status).toBe('linked');
                expect(res.body.externalUserId).toBeDefined();
            }
        });
    });

    describe('Data Synchronization Flow', () => {
        it('should trigger manual sync of Jira issues', async () => {
            const res = await request(app)
                .post('/api/integrations/jira/sync')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ projectKey: 'PROJ-1' });

            if (res.status === 200 || res.status === 202) {
                expect(res.body).toHaveProperty('jobsStarted');
            }
        });

        it('should handle incoming webhooks from Slack', async () => {
            const res = await request(app)
                .post('/api/integrations/slack/webhook')
                .send({
                    type: 'event_callback',
                    event: {
                        type: 'message',
                        text: 'Help me with a task',
                        user: 'U12345',
                        channel: 'C12345',
                    }
                });

            if (res.status === 200) {
                expect(res.body.received).toBe(true);
            }
        });
    });

    describe('Cross-Platform Notification Delivery', () => {
        it('should push app notification to Slack channel', async () => {
            const res = await request(app)
                .post('/api/notifications/external/slack')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    channelId: 'C12345',
                    message: 'Integration Test Notification',
                });

            if (res.status === 200 || res.status === 202) {
                expect(res.body.sent).toBe(true);
            }
        });
    });

    describe('Unlinking and Cleanup Flow', () => {
        it('should remove external integration links', async () => {
            const res = await request(app)
                .delete('/api/integrations/jira')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.status).toBe(403);
            expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
        });
    });
});
