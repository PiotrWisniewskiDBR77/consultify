/**
 * Health Check Cron Job Tests
 * ETAP 6: Testy dla health check cron job (80%+ coverage)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Removed createRequire

describe('HealthCheckJob', () => {
    let HealthCheckJob;
    let mockDb;
    let mockEmailService;
    let mockCron;

    beforeEach(async () => { // Async beforeEach
        vi.resetModules();

        mockDb = {
            get: vi.fn()
        };

        mockEmailService = {
            sendEmail: vi.fn().mockResolvedValue(undefined)
        };

        mockCron = {
            schedule: vi.fn().mockReturnValue({
                stop: vi.fn()
            })
        };

        vi.doMock('../../../../server/src/database/Database.js', () => ({
            default: {}, // Mock default export if needed
            getDatabase: () => mockDb
        }));

        vi.doMock('../../../../server/services/emailService.js', () => ({
            default: mockEmailService
        }));

        vi.doMock('node-cron', () => ({
            default: mockCron
        }));

        const module = await import('../../../../server/cron/healthCheckJob.ts');
        HealthCheckJob = module.default;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../../server/src/database/Database.js');
        vi.doUnmock('../../../../server/services/emailService.js');
        vi.doUnmock('node-cron');
    });

    describe('startHealthCheck', () => {
        it('should schedule health check job', () => {
            HealthCheckJob.startHealthCheck();

            expect(mockCron.schedule).toHaveBeenCalledWith(
                '* * * * *',
                expect.any(Function)
            );
        });

        it('should send alert when database check fails', async () => {
            HealthCheckJob.startHealthCheck();

            const scheduledCallback = mockCron.schedule.mock.calls[0][1];

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(new Error('Connection failed'), null);
            });

            await scheduledCallback();

            expect(mockEmailService.sendEmail).toHaveBeenCalled();
        });

        it('should not send alert when database check succeeds', async () => {
            HealthCheckJob.startHealthCheck();

            const scheduledCallback = mockCron.schedule.mock.calls[0][1];

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { '1': 1 });
            });

            await scheduledCallback();

            // Should not send email on success
            expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
        });

        it('should send recovery email when system recovers', async () => {
            HealthCheckJob.startHealthCheck();

            const scheduledCallback = mockCron.schedule.mock.calls[0][1];

            // First call - failure
            mockDb.get.mockImplementationOnce((query, params, callback) => {
                callback(new Error('Connection failed'), null);
            });

            await scheduledCallback();
            vi.clearAllMocks();

            // Second call - success (recovery)
            mockDb.get.mockImplementationOnce((query, params, callback) => {
                callback(null, { '1': 1 });
            });

            await scheduledCallback();

            // Wait for async callback to execute
            await vi.waitUntil(() => mockEmailService.sendEmail.mock.calls.length > 0);

            expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
                expect.any(String),
                'RESOLVED: System Database Recovered',
                expect.any(String)
            );
        });
    });
});










