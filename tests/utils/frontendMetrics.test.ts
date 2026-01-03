/**
 * Frontend Metrics Utility Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { frontendMetrics } from '../../utils/frontendMetrics';

describe('Frontend Metrics Utility', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;
    let fetchSpy: ReturnType<typeof vi.spyOn>;
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response());
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.env.NODE_ENV = originalNodeEnv;
    });

    describe('track', () => {
        describe('in development', () => {
            beforeEach(() => {
                process.env.NODE_ENV = 'development';
            });

            it('logs metric to console', () => {
                frontendMetrics.track('test_metric', 100);

                expect(consoleSpy).toHaveBeenCalledWith(
                    '[Metrics] test_metric:',
                    100,
                    undefined
                );
            });

            it('logs metric with context', () => {
                frontendMetrics.track('test_metric', 100, { page: 'home' });

                expect(consoleSpy).toHaveBeenCalledWith(
                    '[Metrics] test_metric:',
                    100,
                    { page: 'home' }
                );
            });

            it('does not send to backend', () => {
                frontendMetrics.track('test_metric', 100);

                expect(fetchSpy).not.toHaveBeenCalled();
            });
        });

        describe('in production', () => {
            beforeEach(() => {
                process.env.NODE_ENV = 'production';
            });

            it('sends metric to backend', () => {
                frontendMetrics.track('test_metric', 100);

                expect(fetchSpy).toHaveBeenCalledWith(
                    '/api/metrics/frontend',
                    expect.objectContaining({
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: expect.any(String)
                    })
                );
            });

            it('includes metric data in request body', () => {
                const beforeTime = Date.now();
                frontendMetrics.track('test_metric', 100, { page: 'home' });
                const afterTime = Date.now();

                const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);

                expect(body.name).toBe('test_metric');
                expect(body.value).toBe(100);
                expect(body.timestamp).toBeGreaterThanOrEqual(beforeTime);
                expect(body.timestamp).toBeLessThanOrEqual(afterTime);
                expect(body.context).toEqual({ page: 'home' });
            });

            it('handles fetch error silently', async () => {
                fetchSpy.mockRejectedValue(new Error('Network error'));

                // Should not throw
                frontendMetrics.track('test_metric', 100);

                // Wait for async operation
                await new Promise(resolve => setTimeout(resolve, 10));

                expect(console.error).toHaveBeenCalledWith(
                    '[Metrics] Failed to send metric:',
                    expect.any(Error)
                );
            });
        });
    });

    describe('trackPageLoad', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        it('tracks page load with correct metric name', () => {
            frontendMetrics.trackPageLoad('dashboard', 1500);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Metrics] page_load:',
                1500,
                { page: 'dashboard' }
            );
        });

        it('includes page name in context', () => {
            frontendMetrics.trackPageLoad('settings', 800);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Metrics] page_load:',
                800,
                { page: 'settings' }
            );
        });
    });

    describe('trackApiCall', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        it('tracks API call with correct metric name', () => {
            frontendMetrics.trackApiCall('/api/users', 'GET', 200, 200);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Metrics] api_call:',
                200,
                expect.objectContaining({
                    endpoint: '/api/users',
                    method: 'GET',
                    status: 200
                })
            );
        });

        it('includes success flag for successful responses', () => {
            frontendMetrics.trackApiCall('/api/users', 'GET', 150, 200);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Metrics] api_call:',
                150,
                expect.objectContaining({
                    success: true
                })
            );
        });

        it('includes success flag as false for error responses', () => {
            frontendMetrics.trackApiCall('/api/users', 'POST', 100, 500);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Metrics] api_call:',
                100,
                expect.objectContaining({
                    success: false,
                    status: 500
                })
            );
        });

        it('considers 201 as success', () => {
            frontendMetrics.trackApiCall('/api/users', 'POST', 100, 201);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Metrics] api_call:',
                100,
                expect.objectContaining({
                    success: true
                })
            );
        });

        it('considers 299 as success', () => {
            frontendMetrics.trackApiCall('/api/users', 'GET', 100, 299);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Metrics] api_call:',
                100,
                expect.objectContaining({
                    success: true
                })
            );
        });

        it('considers 300 as failure', () => {
            frontendMetrics.trackApiCall('/api/users', 'GET', 100, 300);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Metrics] api_call:',
                100,
                expect.objectContaining({
                    success: false
                })
            );
        });
    });

    describe('trackError', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        it('tracks error with value of 1', () => {
            const error = new Error('Test error');
            frontendMetrics.trackError(error);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Metrics] error:',
                1,
                expect.objectContaining({
                    message: 'Test error'
                })
            );
        });

        it('includes error message', () => {
            const error = new Error('Something went wrong');
            frontendMetrics.trackError(error);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Metrics] error:',
                1,
                expect.objectContaining({
                    message: 'Something went wrong'
                })
            );
        });

        it('includes error stack', () => {
            const error = new Error('Test error');
            frontendMetrics.trackError(error);

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Metrics] error:',
                1,
                expect.objectContaining({
                    stack: expect.any(String)
                })
            );
        });

        it('includes additional context', () => {
            const error = new Error('Test error');
            frontendMetrics.trackError(error, { component: 'Header', userId: '123' });

            expect(consoleSpy).toHaveBeenCalledWith(
                '[Metrics] error:',
                1,
                expect.objectContaining({
                    message: 'Test error',
                    component: 'Header',
                    userId: '123'
                })
            );
        });

        it('merges context with error info', () => {
            const error = new Error('Test');
            frontendMetrics.trackError(error, { extra: 'data' });

            const call = consoleSpy.mock.calls[0];
            const context = call[2];

            expect(context).toHaveProperty('message');
            expect(context).toHaveProperty('stack');
            expect(context).toHaveProperty('extra', 'data');
        });
    });

    describe('Metric Data Structure', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('creates valid metric data object', () => {
            frontendMetrics.track('custom_metric', 42, { custom: 'context' });

            const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);

            expect(body).toEqual({
                name: 'custom_metric',
                value: 42,
                timestamp: expect.any(Number),
                context: { custom: 'context' }
            });
        });

        it('handles undefined context', () => {
            frontendMetrics.track('simple_metric', 10);

            const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);

            expect(body.context).toBeUndefined();
        });
    });
});








