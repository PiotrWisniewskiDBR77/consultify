/**
 * Health Check Cron Job Tests
 * ETAP 6: Testy dla health check cron job (80%+ coverage)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('HealthCheckJob', () => {
    let HealthCheckJob;
    let mockDb;
    let mockEmailService;
    let mockCron;

    beforeEach(() => {
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

        vi.doMock('../../../server/database', () => ({
            default: mockDb
        }));

        vi.doMock('../../../server/services/emailService', () => ({
            default: mockEmailService
        }));

        vi.doMock('node-cron', () => mockCron);

        HealthCheckJob = require('../../../server/cron/healthCheckJob.js');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
        vi.doUnmock('../../../server/services/emailService');
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

            expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
                expect.any(String),
                'RESOLVED: System Database Recovered',
                expect.any(String)
            );
        });
    });
});

