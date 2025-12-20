/**
 * Metrics Collector Tests
 * 
 * Step 7: Metrics & Conversion Intelligence
 * 
 * Tests for the append-only event recording service
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Use the real database (it will be in-memory because NODE_ENV=test)
const db = require('../../../server/database');
const MetricsCollector = require('../../../server/services/metricsCollector');

describe('MetricsCollector', () => {
    beforeAll(async () => {
        // Wait for database schema to be initialized
        await db.initPromise;
    });

    describe('EVENT_TYPES', () => {
        it('should define all required event types', () => {
            expect(MetricsCollector.EVENT_TYPES).toBeDefined();
            expect(MetricsCollector.EVENT_TYPES.TRIAL_STARTED).toBe('trial_started');
            expect(MetricsCollector.EVENT_TYPES.TRIAL_EXTENDED).toBe('trial_extended');
            expect(MetricsCollector.EVENT_TYPES.TRIAL_EXPIRED).toBe('trial_expired');
            expect(MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID).toBe('upgraded_to_paid');
            expect(MetricsCollector.EVENT_TYPES.DEMO_STARTED).toBe('demo_started');
            expect(MetricsCollector.EVENT_TYPES.INVITE_SENT).toBe('invite_sent');
            expect(MetricsCollector.EVENT_TYPES.INVITE_ACCEPTED).toBe('invite_accepted');
            expect(MetricsCollector.EVENT_TYPES.HELP_STARTED).toBe('help_started');
            expect(MetricsCollector.EVENT_TYPES.HELP_COMPLETED).toBe('help_completed');
            expect(MetricsCollector.EVENT_TYPES.SETTLEMENT_GENERATED).toBe('settlement_generated');
        });
    });

    describe('SOURCE_TYPES', () => {
        it('should define all required source types', () => {
            expect(MetricsCollector.SOURCE_TYPES).toBeDefined();
            expect(MetricsCollector.SOURCE_TYPES.DEMO).toBe('DEMO');
            expect(MetricsCollector.SOURCE_TYPES.TRIAL).toBe('TRIAL');
            expect(MetricsCollector.SOURCE_TYPES.INVITATION).toBe('INVITATION');
            expect(MetricsCollector.SOURCE_TYPES.PROMO).toBe('PROMO');
            expect(MetricsCollector.SOURCE_TYPES.PARTNER).toBe('PARTNER');
            expect(MetricsCollector.SOURCE_TYPES.SELF_SERVE).toBe('SELF_SERVE');
        });
    });

    describe('recordEvent', () => {
        it('should record an event successfully', async () => {
            const result = await MetricsCollector.recordEvent(
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                {
                    userId: 'user-123',
                    organizationId: 'org-456',
                    source: MetricsCollector.SOURCE_TYPES.TRIAL,
                    context: { durationDays: 14 }
                }
            );

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.eventId).toBeDefined();
        });

        it('should accept minimal payload', async () => {
            const result = await MetricsCollector.recordEvent(
                MetricsCollector.EVENT_TYPES.DEMO_STARTED,
                {}
            );

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should warn on unknown event type but still record', async () => {
            const consoleSpy = vi.spyOn(console, 'warn');

            await MetricsCollector.recordEvent('unknown_event_type', {});

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[MetricsCollector] Unknown event type')
            );

            consoleSpy.mockRestore();
        });
    });

    describe('getEvents', () => {
        it('should query events by type', async () => {
            // First record some events
            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.TRIAL_STARTED, { userId: 'u1' });
            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.TRIAL_STARTED, { userId: 'u2' });

            const events = await MetricsCollector.getEvents(
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                { limit: 10 }
            );

            expect(Array.isArray(events)).toBe(true);
            expect(events.length).toBeGreaterThanOrEqual(2);
        });

        it('should apply date filters', async () => {
            const events = await MetricsCollector.getEvents(
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                {
                    startDate: '2020-01-01',
                    endDate: '2099-12-31'
                }
            );

            expect(Array.isArray(events)).toBe(true);
        });
    });

    describe('getEventCount', () => {
        it('should return event count', async () => {
            const count = await MetricsCollector.getEventCount(
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED
            );

            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThan(0);
        });
    });

    describe('getUniqueOrgCount', () => {
        it('should return unique org count', async () => {
            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.TRIAL_STARTED, { organizationId: 'unique-org-1' });
            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.TRIAL_STARTED, { organizationId: 'unique-org-1' });
            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.TRIAL_STARTED, { organizationId: 'unique-org-2' });

            const count = await MetricsCollector.getUniqueOrgCount(
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED
            );

            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(2);
        });
    });
});

describe('MetricsCollector Integration Contracts', () => {
    describe('trialService integration', () => {
        it('should have TRIAL_STARTED event type', () => {
            expect(MetricsCollector.EVENT_TYPES.TRIAL_STARTED).toBe('trial_started');
        });

        it('should have TRIAL_EXTENDED event type', () => {
            expect(MetricsCollector.EVENT_TYPES.TRIAL_EXTENDED).toBe('trial_extended');
        });

        it('should have TRIAL_EXPIRED event type', () => {
            expect(MetricsCollector.EVENT_TYPES.TRIAL_EXPIRED).toBe('trial_expired');
        });

        it('should have UPGRADED_TO_PAID event type', () => {
            expect(MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID).toBe('upgraded_to_paid');
        });
    });

    describe('invitationService integration', () => {
        it('should have INVITE_SENT event type', () => {
            expect(MetricsCollector.EVENT_TYPES.INVITE_SENT).toBe('invite_sent');
        });

        it('should have INVITE_ACCEPTED event type', () => {
            expect(MetricsCollector.EVENT_TYPES.INVITE_ACCEPTED).toBe('invite_accepted');
        });
    });

    describe('helpService integration', () => {
        it('should have HELP_STARTED event type', () => {
            expect(MetricsCollector.EVENT_TYPES.HELP_STARTED).toBe('help_started');
        });

        it('should have HELP_COMPLETED event type', () => {
            expect(MetricsCollector.EVENT_TYPES.HELP_COMPLETED).toBe('help_completed');
        });
    });

    describe('settlementService integration', () => {
        it('should have SETTLEMENT_GENERATED event type', () => {
            expect(MetricsCollector.EVENT_TYPES.SETTLEMENT_GENERATED).toBe('settlement_generated');
        });
    });
});
