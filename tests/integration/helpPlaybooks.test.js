/**
 * Help Playbooks Integration Tests
 * 
 * Step 6.1: Tests for playbook recommendation logic and event logging.
 * Uses Vitest.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Direct import of playbookResolver (doesn't need database)
const PlaybookResolver = require('../../server/services/playbookResolver');

describe('Help Playbooks Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Playbook Resolver - resolveRecommended', () => {
        const mockPlaybooks = [
            { key: 'start_trial_from_demo', priority: 1 },
            { key: 'trial_expired_upgrade', priority: 1 },
            { key: 'trial_last_week_upgrade', priority: 1 },
            { key: 'invite_blocked_explained', priority: 2 },
            { key: 'first_value_checklist', priority: 3 },
            { key: 'billing_upgrade_howto', priority: 2 }
        ];

        it('Demo org → recommended = start_trial_from_demo', () => {
            const policySnapshot = {
                isDemo: true,
                isTrial: false,
                isPaid: false,
                isTrialExpired: false,
                trialDaysLeft: 0,
                blockedActions: []
            };

            const recommended = PlaybookResolver.resolveRecommended(
                mockPlaybooks,
                policySnapshot,
                '/'
            );

            expect(recommended).toBe('start_trial_from_demo');
        });

        it('Trial expired → recommended = trial_expired_upgrade', () => {
            const policySnapshot = {
                isDemo: false,
                isTrial: true,
                isPaid: false,
                isTrialExpired: true,
                trialDaysLeft: 0,
                blockedActions: []
            };

            const recommended = PlaybookResolver.resolveRecommended(
                mockPlaybooks,
                policySnapshot,
                '/'
            );

            expect(recommended).toBe('trial_expired_upgrade');
        });

        it('Trial <= 7 days → recommended = trial_last_week_upgrade', () => {
            const policySnapshot = {
                isDemo: false,
                isTrial: true,
                isPaid: false,
                isTrialExpired: false,
                trialDaysLeft: 5,
                blockedActions: []
            };

            const recommended = PlaybookResolver.resolveRecommended(
                mockPlaybooks,
                policySnapshot,
                '/'
            );

            expect(recommended).toBe('trial_last_week_upgrade');
        });

        it('Invites blocked → recommended = invite_blocked_explained', () => {
            const policySnapshot = {
                isDemo: false,
                isTrial: false,
                isPaid: true,
                isTrialExpired: false,
                trialDaysLeft: 0,
                blockedActions: ['INVITES']
            };

            const recommended = PlaybookResolver.resolveRecommended(
                mockPlaybooks,
                policySnapshot,
                '/'
            );

            expect(recommended).toBe('invite_blocked_explained');
        });

        it('Route-based: billing route → recommended = billing_upgrade_howto', () => {
            const policySnapshot = {
                isDemo: false,
                isTrial: false,
                isPaid: true,
                isTrialExpired: false,
                trialDaysLeft: 0,
                blockedActions: []
            };

            const recommended = PlaybookResolver.resolveRecommended(
                mockPlaybooks,
                policySnapshot,
                '/settings?tab=billing'
            );

            expect(recommended).toBe('billing_upgrade_howto');
        });

        it('Default (paid, no issues) → recommended = first_value_checklist', () => {
            const policySnapshot = {
                isDemo: false,
                isTrial: false,
                isPaid: true,
                isTrialExpired: false,
                trialDaysLeft: 0,
                blockedActions: []
            };

            const recommended = PlaybookResolver.resolveRecommended(
                mockPlaybooks,
                policySnapshot,
                '/dashboard'
            );

            expect(recommended).toBe('first_value_checklist');
        });

        it('Empty playbooks → returns null', () => {
            const policySnapshot = {
                isDemo: true,
                isTrial: false,
                isPaid: false,
                isTrialExpired: false,
                trialDaysLeft: 0,
                blockedActions: []
            };

            const recommended = PlaybookResolver.resolveRecommended(
                [],
                policySnapshot,
                '/'
            );

            expect(recommended).toBeNull();
        });

        it('Null policy snapshot → returns null', () => {
            const recommended = PlaybookResolver.resolveRecommended(
                mockPlaybooks,
                null,
                '/'
            );

            expect(recommended).toBeNull();
        });
    });

    describe('Priority Rules Order', () => {
        const allPlaybooks = [
            { key: 'start_trial_from_demo', priority: 1 },
            { key: 'trial_expired_upgrade', priority: 1 },
            { key: 'trial_last_week_upgrade', priority: 1 },
            { key: 'invite_blocked_explained', priority: 2 },
            { key: 'first_value_checklist', priority: 3 }
        ];

        it('Trial expired takes priority over Demo', () => {
            // Edge case: shouldn't happen in reality, but testing priority logic
            const policySnapshot = {
                isDemo: true,
                isTrial: true,
                isPaid: false,
                isTrialExpired: true,
                trialDaysLeft: 0,
                blockedActions: []
            };

            const recommended = PlaybookResolver.resolveRecommended(
                allPlaybooks,
                policySnapshot,
                '/'
            );

            // Trial expired should take priority (Rule 1 before Rule 2)
            expect(recommended).toBe('trial_expired_upgrade');
        });

        it('Demo takes priority over trial last week', () => {
            const policySnapshot = {
                isDemo: true,
                isTrial: false,
                isPaid: false,
                isTrialExpired: false,
                trialDaysLeft: 5,
                blockedActions: []
            };

            const recommended = PlaybookResolver.resolveRecommended(
                allPlaybooks,
                policySnapshot,
                '/'
            );

            expect(recommended).toBe('start_trial_from_demo');
        });
    });
});
