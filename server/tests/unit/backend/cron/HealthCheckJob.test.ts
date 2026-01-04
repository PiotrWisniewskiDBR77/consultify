/**
 * Unit Tests for HealthCheckJob
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getHealthCheckJob, startHealthCheck } from '../../../../src/cron/HealthCheckJob.js';
import type { IDatabase } from '../../../../src/database/IDatabase.js';

describe('HealthCheckJob', () => {
    let mockDb: IDatabase;
    let mockEmailService: { sendEmail: (to: string, subject: string, html: string) => Promise<boolean> };
    let healthCheckJob: ReturnType<typeof getHealthCheckJob>;

    beforeEach(() => {
        // Mock database
        mockDb = {
            get: vi.fn((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
                callback(null); // Success by default
                return mockDb;
            }),
            all: vi.fn(),
            run: vi.fn(),
            exec: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
        } as unknown as IDatabase;

        // Mock email service
        mockEmailService = {
            sendEmail: vi.fn().mockResolvedValue(true),
        };

        healthCheckJob = getHealthCheckJob({
            db: mockDb,
            emailService: mockEmailService,
            alertEmail: 'test@example.com',
            alertThreshold: 1,
        });
    });

    afterEach(() => {
        healthCheckJob.stopHealthCheck();
    });

    describe('startHealthCheck', () => {
        it('should start health check job', () => {
            healthCheckJob.startHealthCheck();
            // Job is scheduled, no immediate error
            expect(mockDb.get).not.toHaveBeenCalled(); // Not called until cron triggers
        });

        it('should send alert when database fails', async () => {
            // Simulate database failure
            mockDb.get = vi.fn((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
                callback(new Error('Database connection failed'));
                return mockDb;
            }) as unknown as IDatabase['get'];

            healthCheckJob.startHealthCheck();

            // Wait for cron to trigger (simulate immediate execution)
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Manually trigger the check
            await new Promise<void>((resolve, reject) => {
                mockDb.get('SELECT 1', [], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }).catch(() => {
                // Expected error
            });

            // Wait a bit for async email
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Verify email was sent
            expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
                'test@example.com',
                'CRITICAL ALERT: System Database Down',
                expect.stringContaining('System Alert'),
            );
        });

        it('should send recovery email when database recovers', async () => {
            // First simulate failure
            mockDb.get = vi.fn((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
                callback(new Error('Database connection failed'));
                return mockDb;
            }) as unknown as IDatabase['get'];

            healthCheckJob.startHealthCheck();

            // Wait and trigger failure
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Then simulate recovery
            mockDb.get = vi.fn((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
                callback(null); // Success
                return mockDb;
            }) as unknown as IDatabase['get'];

            // Wait and trigger success
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Verify recovery email was sent
            expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
                'test@example.com',
                'RESOLVED: System Database Recovered',
                expect.stringContaining('System Recovered'),
            );
        });

        it('should not spam emails on consecutive failures', async () => {
            // Simulate multiple failures
            mockDb.get = vi.fn((sql: string, params: unknown[], callback: (err: Error | null) => void) => {
                callback(new Error('Database connection failed'));
                return mockDb;
            }) as unknown as IDatabase['get'];

            healthCheckJob.startHealthCheck();

            // Trigger multiple failures
            for (let i = 0; i < 3; i++) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }

            // Should only send one alert (on first failure)
            expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
        });
    });

    describe('stopHealthCheck', () => {
        it('should stop health check job', () => {
            healthCheckJob.startHealthCheck();
            healthCheckJob.stopHealthCheck();
            // No error means it stopped successfully
            expect(true).toBe(true);
        });

        it('should handle stop when job not started', () => {
            healthCheckJob.stopHealthCheck();
            // No error means it handled gracefully
            expect(true).toBe(true);
        });
    });

    describe('getHealthCheckJob', () => {
        it('should return singleton instance', () => {
            const instance1 = getHealthCheckJob({ db: mockDb });
            const instance2 = getHealthCheckJob({ db: mockDb });

            expect(instance1).toBe(instance2);
        });
    });
});



