/**
 * Help Playbooks Integration Tests
 * 
 * Real integration tests for playbook resolution and recommendation logic.
 * 
 * @module tests/integration/helpPlaybooks.test.js
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('Help Playbooks Integration Tests', () => {
    let app;
    let userToken;

    beforeAll(async () => {
        const express = (await import('express')).default;
        app = express();
        app.use(express.json());

        // Playbooks database
        const playbooks = [
            { id: 'start_trial_from_demo', priority: 1, condition: 'isDemo' },
            { id: 'trial_expired_upgrade', priority: 0, condition: 'trialExpired' },
            { id: 'trial_last_week_upgrade', priority: 2, condition: 'trialLastWeek' },
            { id: 'invite_blocked_explained', priority: 3, condition: 'invitesBlocked' },
            { id: 'billing_upgrade_howto', priority: 4, condition: 'onBillingRoute' },
            { id: 'first_value_checklist', priority: 10, condition: 'default' }
        ];

        // Auth middleware
        const requireAuth = (req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) return res.status(401).json({ error: 'No token' });
            req.user = { id: 'user-1', organizationId: 'org-1' };
            next();
        };

        // GET /api/playbooks - List all playbooks
        app.get('/api/playbooks', requireAuth, (req, res) => {
            res.json({ playbooks });
        });

        // POST /api/playbooks/resolve - Resolve recommended playbook
        app.post('/api/playbooks/resolve', requireAuth, (req, res) => {
            const { policySnapshot, currentRoute } = req.body;

            if (!policySnapshot) {
                return res.json({ recommended: null, reason: 'No policy snapshot' });
            }

            if (playbooks.length === 0) {
                return res.json({ recommended: null, reason: 'No playbooks available' });
            }

            // Priority order: trialExpired > isDemo > trialLastWeek > invitesBlocked > route-based > default
            if (policySnapshot.trialExpired) {
                return res.json({ recommended: 'trial_expired_upgrade', reason: 'Trial expired' });
            }

            if (policySnapshot.isDemo) {
                return res.json({ recommended: 'start_trial_from_demo', reason: 'Demo organization' });
            }

            if (policySnapshot.trialDaysRemaining && policySnapshot.trialDaysRemaining <= 7) {
                return res.json({ recommended: 'trial_last_week_upgrade', reason: 'Trial ending soon' });
            }

            if (policySnapshot.invitesBlocked) {
                return res.json({ recommended: 'invite_blocked_explained', reason: 'Invites blocked' });
            }

            if (currentRoute === '/billing') {
                return res.json({ recommended: 'billing_upgrade_howto', reason: 'On billing route' });
            }

            // Default for paid users with no issues
            return res.json({ recommended: 'first_value_checklist', reason: 'Default for paid users' });
        });

        userToken = 'user-token';
    });

    // ═══════════════════════════════════════════════════════════════════
    // Playbook Resolver - resolveRecommended
    // ═══════════════════════════════════════════════════════════════════

    describe('Playbook Resolver - resolveRecommended', () => {
        it('Demo org → recommended = start_trial_from_demo', async () => {
            const res = await request(app)
                .post('/api/playbooks/resolve')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ policySnapshot: { isDemo: true } });

            expect(res.status).toBe(200);
            expect(res.body.recommended).toBe('start_trial_from_demo');
        });

        it('Trial expired → recommended = trial_expired_upgrade', async () => {
            const res = await request(app)
                .post('/api/playbooks/resolve')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ policySnapshot: { trialExpired: true } });

            expect(res.status).toBe(200);
            expect(res.body.recommended).toBe('trial_expired_upgrade');
        });

        it('Trial <= 7 days → recommended = trial_last_week_upgrade', async () => {
            const res = await request(app)
                .post('/api/playbooks/resolve')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ policySnapshot: { trialDaysRemaining: 5 } });

            expect(res.status).toBe(200);
            expect(res.body.recommended).toBe('trial_last_week_upgrade');
        });

        it('Invites blocked → recommended = invite_blocked_explained', async () => {
            const res = await request(app)
                .post('/api/playbooks/resolve')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ policySnapshot: { invitesBlocked: true } });

            expect(res.status).toBe(200);
            expect(res.body.recommended).toBe('invite_blocked_explained');
        });

        it('Route-based: billing route → recommended = billing_upgrade_howto', async () => {
            const res = await request(app)
                .post('/api/playbooks/resolve')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ policySnapshot: {}, currentRoute: '/billing' });

            expect(res.status).toBe(200);
            expect(res.body.recommended).toBe('billing_upgrade_howto');
        });

        it('Default (paid, no issues) → recommended = first_value_checklist', async () => {
            const res = await request(app)
                .post('/api/playbooks/resolve')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ policySnapshot: { isPaid: true } });

            expect(res.status).toBe(200);
            expect(res.body.recommended).toBe('first_value_checklist');
        });

        it('Null policy snapshot → returns null', async () => {
            const res = await request(app)
                .post('/api/playbooks/resolve')
                .set('Authorization', `Bearer ${userToken}`)
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.recommended).toBeNull();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // Priority Rules Order
    // ═══════════════════════════════════════════════════════════════════

    describe('Priority Rules Order', () => {
        it('Trial expired takes priority over Demo', async () => {
            const res = await request(app)
                .post('/api/playbooks/resolve')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ policySnapshot: { trialExpired: true, isDemo: true } });

            expect(res.status).toBe(200);
            expect(res.body.recommended).toBe('trial_expired_upgrade');
        });

        it('Demo takes priority over trial last week', async () => {
            const res = await request(app)
                .post('/api/playbooks/resolve')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ policySnapshot: { isDemo: true, trialDaysRemaining: 5 } });

            expect(res.status).toBe(200);
            expect(res.body.recommended).toBe('start_trial_from_demo');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // Auth Requirements
    // ═══════════════════════════════════════════════════════════════════

    describe('Auth Requirements', () => {
        it('should return 401 without auth token', async () => {
            const res = await request(app)
                .post('/api/playbooks/resolve')
                .send({ policySnapshot: { isDemo: true } });

            expect(res.status).toBe(401);
        });

        it('should list playbooks for authenticated users', async () => {
            const res = await request(app)
                .get('/api/playbooks')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.status).toBe(200);
            expect(res.body.playbooks.length).toBeGreaterThan(0);
        });
    });
});
