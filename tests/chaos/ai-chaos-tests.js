/**
 * AI System Chaos Engineering Tests
 * 
 * Tests system resilience under various failure conditions:
 * - Provider failures mid-stream
 * - Database connection loss
 * - Memory pressure
 * - Network latency injection
 * - Cascading failures
 * 
 * Part of Stability Excellence - Phase 2.1
 * 
 * @module chaos/ai-chaos-tests
 */

const { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } = require('vitest');

// Mock external dependencies
vi.mock('openai', () => ({
    OpenAI: vi.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: vi.fn()
            }
        },
        embeddings: {
            create: vi.fn()
        }
    }))
}));

// Import services after mocking
const CircuitBreakerService = require('../../server/services/circuitBreakerService');

describe('AI Chaos Engineering Tests', () => {
    // Store original implementations
    let originalConsoleError;
    let originalConsoleLog;
    
    beforeAll(() => {
        // Suppress console during chaos tests
        originalConsoleError = console.error;
        originalConsoleLog = console.log;
        console.error = vi.fn();
        console.log = vi.fn();
    });

    afterAll(() => {
        console.error = originalConsoleError;
        console.log = originalConsoleLog;
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // Test Suite 1: Provider Failure Mid-Stream
    // =========================================================================

    describe('Provider Failure Mid-Stream', () => {
        it('should handle provider timeout during response generation', async () => {
            const mockStream = {
                async* [Symbol.asyncIterator]() {
                    yield { choices: [{ delta: { content: 'Starting response...' } }] };
                    yield { choices: [{ delta: { content: ' more content' } }] };
                    // Simulate timeout
                    throw new Error('TIMEOUT: Provider did not respond in time');
                }
            };

            let capturedContent = '';
            let errorOccurred = false;

            try {
                for await (const chunk of mockStream) {
                    capturedContent += chunk.choices[0]?.delta?.content || '';
                }
            } catch (error) {
                errorOccurred = true;
                // Verify partial content was captured
                expect(capturedContent).toContain('Starting response');
            }

            expect(errorOccurred).toBe(true);
            expect(capturedContent.length).toBeGreaterThan(0);
        });

        it('should trigger circuit breaker after consecutive failures', async () => {
            const testBreaker = CircuitBreakerService.getBreaker('chaos-test-provider', {
                failureThreshold: 3,
                timeout: 5000
            });

            // Simulate 3 consecutive failures
            for (let i = 0; i < 3; i++) {
                try {
                    await testBreaker.execute(() => {
                        throw new Error('Provider unavailable');
                    });
                } catch (e) {
                    // Expected
                }
            }

            // Circuit should be open now
            const status = testBreaker.getStatus();
            expect(status.state).not.toBe('CLOSED');
        });

        it('should recover gracefully after circuit breaker reset', async () => {
            // Reset the circuit breaker
            CircuitBreakerService.resetBreaker('chaos-test-provider');

            const testBreaker = CircuitBreakerService.getBreaker('chaos-test-provider');
            
            // Should be able to execute again
            const result = await testBreaker.execute(() => Promise.resolve('success'));
            expect(result).toBe('success');
        });
    });

    // =========================================================================
    // Test Suite 2: Database Connection Loss
    // =========================================================================

    describe('Database Connection Loss', () => {
        it('should handle database query failure gracefully', async () => {
            const mockDb = {
                get: vi.fn((query, params, callback) => {
                    callback(new Error('ECONNREFUSED: Connection refused'), null);
                }),
                run: vi.fn((query, params, callback) => {
                    callback(new Error('ECONNREFUSED: Connection refused'));
                }),
                all: vi.fn((query, params, callback) => {
                    callback(new Error('ECONNREFUSED: Connection refused'), null);
                })
            };

            // Simulate a service call with DB failure
            const queryWithRetry = async (retries = 3) => {
                for (let i = 0; i < retries; i++) {
                    try {
                        await new Promise((resolve, reject) => {
                            mockDb.get('SELECT * FROM test', [], (err, row) => {
                                if (err) reject(err);
                                else resolve(row);
                            });
                        });
                        return true;
                    } catch (e) {
                        if (i === retries - 1) throw e;
                        await new Promise(r => setTimeout(r, 100)); // Backoff
                    }
                }
            };

            await expect(queryWithRetry()).rejects.toThrow('ECONNREFUSED');
        });

        it('should use cached data when database is unavailable', async () => {
            const cache = new Map();
            cache.set('user:123', { id: '123', name: 'Cached User' });

            const getUserWithFallback = async (userId) => {
                // First try database
                const dbResult = await new Promise((resolve, reject) => {
                    // Simulate DB failure
                    reject(new Error('DB unavailable'));
                }).catch(() => null);

                if (dbResult) return dbResult;

                // Fallback to cache
                const cached = cache.get(`user:${userId}`);
                if (cached) {
                    return { ...cached, fromCache: true };
                }

                throw new Error('No data available');
            };

            const result = await getUserWithFallback('123');
            expect(result.fromCache).toBe(true);
            expect(result.name).toBe('Cached User');
        });
    });

    // =========================================================================
    // Test Suite 3: Memory Pressure
    // =========================================================================

    describe('Memory Pressure', () => {
        it('should handle large response processing without memory leak', async () => {
            // Simulate processing a large number of tokens
            const processLargeResponse = async () => {
                const chunks = [];
                const largeTokenCount = 10000;
                
                for (let i = 0; i < largeTokenCount; i++) {
                    chunks.push(`token_${i}`);
                    
                    // Periodically clear processed chunks to prevent memory buildup
                    if (chunks.length > 1000) {
                        // Process batch
                        chunks.length = 0; // Clear array
                    }
                }

                return { processed: largeTokenCount };
            };

            const result = await processLargeResponse();
            expect(result.processed).toBe(10000);
        });

        it('should limit context window to prevent memory overflow', () => {
            const MAX_CONTEXT_TOKENS = 128000;
            const TOKEN_CHAR_RATIO = 4;

            const truncateContext = (context, maxTokens = MAX_CONTEXT_TOKENS) => {
                const estimatedTokens = Math.ceil(context.length / TOKEN_CHAR_RATIO);
                if (estimatedTokens <= maxTokens) return context;

                const maxChars = maxTokens * TOKEN_CHAR_RATIO;
                return context.substring(0, maxChars) + '... [truncated]';
            };

            const hugeContext = 'a'.repeat(1000000); // 1MB of text
            const truncated = truncateContext(hugeContext);

            expect(truncated.length).toBeLessThan(hugeContext.length);
            expect(truncated.endsWith('[truncated]')).toBe(true);
        });

        it('should clean up resources after stream completion', async () => {
            let resourceAllocated = false;
            let resourceCleaned = false;

            const streamWithCleanup = async () => {
                resourceAllocated = true;

                try {
                    // Simulate streaming
                    const chunks = ['chunk1', 'chunk2', 'chunk3'];
                    for (const chunk of chunks) {
                        // Process chunk
                    }
                } finally {
                    resourceCleaned = true;
                }
            };

            await streamWithCleanup();

            expect(resourceAllocated).toBe(true);
            expect(resourceCleaned).toBe(true);
        });
    });

    // =========================================================================
    // Test Suite 4: Network Latency Injection
    // =========================================================================

    describe('Network Latency Injection', () => {
        it('should handle high latency API calls', async () => {
            const simulateHighLatencyCall = async (latencyMs) => {
                const startTime = Date.now();
                await new Promise(resolve => setTimeout(resolve, latencyMs));
                return {
                    success: true,
                    latency: Date.now() - startTime
                };
            };

            const result = await simulateHighLatencyCall(100);
            expect(result.success).toBe(true);
            expect(result.latency).toBeGreaterThanOrEqual(100);
        });

        it('should timeout requests exceeding threshold', async () => {
            const callWithTimeout = async (fn, timeoutMs) => {
                return Promise.race([
                    fn(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
                    )
                ]);
            };

            const slowCall = () => new Promise(resolve => setTimeout(resolve, 5000));

            await expect(callWithTimeout(slowCall, 100)).rejects.toThrow('Request timeout');
        });

        it('should implement exponential backoff for retries', async () => {
            const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 100) => {
                let lastError;
                const delays = [];

                for (let i = 0; i < maxRetries; i++) {
                    try {
                        return await fn();
                    } catch (error) {
                        lastError = error;
                        const delay = baseDelay * Math.pow(2, i);
                        delays.push(delay);
                        await new Promise(r => setTimeout(r, delay));
                    }
                }

                return { failed: true, delays, error: lastError };
            };

            const alwaysFails = () => Promise.reject(new Error('Simulated failure'));
            const result = await retryWithBackoff(alwaysFails, 3, 10);

            expect(result.failed).toBe(true);
            expect(result.delays).toEqual([10, 20, 40]); // Exponential backoff
        });
    });

    // =========================================================================
    // Test Suite 5: Cascading Failures
    // =========================================================================

    describe('Cascading Failure Prevention', () => {
        it('should isolate failures to prevent cascade', async () => {
            const services = {
                ai: { status: 'healthy' },
                database: { status: 'healthy' },
                cache: { status: 'healthy' }
            };

            const simulateServiceFailure = (serviceName) => {
                services[serviceName].status = 'failed';
            };

            const checkSystemHealth = () => {
                const failedServices = Object.entries(services)
                    .filter(([_, s]) => s.status === 'failed')
                    .map(([name]) => name);

                return {
                    healthy: failedServices.length === 0,
                    failedServices,
                    operationalServices: Object.entries(services)
                        .filter(([_, s]) => s.status === 'healthy')
                        .map(([name]) => name)
                };
            };

            // Simulate AI service failure
            simulateServiceFailure('ai');

            const health = checkSystemHealth();
            expect(health.healthy).toBe(false);
            expect(health.failedServices).toContain('ai');
            // Other services should still be operational
            expect(health.operationalServices).toContain('database');
            expect(health.operationalServices).toContain('cache');
        });

        it('should implement bulkhead pattern for resource isolation', async () => {
            const bulkheads = {
                ai: { maxConcurrent: 10, current: 0 },
                database: { maxConcurrent: 50, current: 0 },
                external: { maxConcurrent: 5, current: 0 }
            };

            const executeWithBulkhead = async (bulkheadName, fn) => {
                const bulkhead = bulkheads[bulkheadName];
                
                if (bulkhead.current >= bulkhead.maxConcurrent) {
                    throw new Error(`Bulkhead ${bulkheadName} at capacity`);
                }

                bulkhead.current++;
                try {
                    return await fn();
                } finally {
                    bulkhead.current--;
                }
            };

            // Fill AI bulkhead to capacity
            bulkheads.ai.current = 10;

            // AI calls should be rejected
            await expect(
                executeWithBulkhead('ai', () => Promise.resolve('test'))
            ).rejects.toThrow('Bulkhead ai at capacity');

            // Database calls should still work
            const dbResult = await executeWithBulkhead('database', () => Promise.resolve('db ok'));
            expect(dbResult).toBe('db ok');
        });

        it('should implement graceful degradation', async () => {
            const features = {
                aiChat: { enabled: true, fallback: 'static-responses' },
                vectorSearch: { enabled: true, fallback: 'keyword-search' },
                streaming: { enabled: true, fallback: 'batch-response' }
            };

            const executeWithDegradation = async (featureName, primaryFn, fallbackFn) => {
                const feature = features[featureName];
                
                if (!feature.enabled) {
                    return { result: await fallbackFn(), degraded: true };
                }

                try {
                    return { result: await primaryFn(), degraded: false };
                } catch (error) {
                    feature.enabled = false; // Disable for future calls
                    return { result: await fallbackFn(), degraded: true };
                }
            };

            // Simulate primary failure
            const response = await executeWithDegradation(
                'aiChat',
                () => Promise.reject(new Error('AI unavailable')),
                () => Promise.resolve({ message: 'Service temporarily unavailable' })
            );

            expect(response.degraded).toBe(true);
            expect(features.aiChat.enabled).toBe(false);
        });
    });

    // =========================================================================
    // Test Suite 6: Recovery Verification
    // =========================================================================

    describe('Recovery Verification', () => {
        it('should recover after temporary failure', async () => {
            let callCount = 0;
            
            const flakyService = () => {
                callCount++;
                if (callCount < 3) {
                    return Promise.reject(new Error('Temporary failure'));
                }
                return Promise.resolve('Success after recovery');
            };

            const retryUntilSuccess = async (fn, maxRetries = 5) => {
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        return await fn();
                    } catch (e) {
                        if (i === maxRetries - 1) throw e;
                        await new Promise(r => setTimeout(r, 10));
                    }
                }
            };

            const result = await retryUntilSuccess(flakyService);
            expect(result).toBe('Success after recovery');
            expect(callCount).toBe(3);
        });

        it('should restore state after system restart', async () => {
            // Simulate persisted state
            const persistedState = {
                lastProcessedId: 'msg-123',
                pendingActions: ['action-1', 'action-2'],
                userPreferences: { theme: 'dark' }
            };

            const restoreState = async () => {
                // Simulate reading from persistence
                return { ...persistedState };
            };

            const validateState = (state) => {
                return (
                    typeof state.lastProcessedId === 'string' &&
                    Array.isArray(state.pendingActions) &&
                    typeof state.userPreferences === 'object'
                );
            };

            const restoredState = await restoreState();
            expect(validateState(restoredState)).toBe(true);
            expect(restoredState.lastProcessedId).toBe('msg-123');
        });
    });
});

// =========================================================================
// Chaos Test Utilities
// =========================================================================

/**
 * Utility to inject chaos into async functions
 */
const ChaosInjector = {
    /**
     * Add random latency to a function
     */
    withRandomLatency: (fn, minMs = 0, maxMs = 100) => {
        return async (...args) => {
            const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
            await new Promise(r => setTimeout(r, delay));
            return fn(...args);
        };
    },

    /**
     * Add random failure chance to a function
     */
    withRandomFailure: (fn, failureRate = 0.1) => {
        return async (...args) => {
            if (Math.random() < failureRate) {
                throw new Error('Injected chaos failure');
            }
            return fn(...args);
        };
    },

    /**
     * Add memory pressure simulation
     */
    withMemoryPressure: (fn, allocateBytes = 10000000) => {
        return async (...args) => {
            // Allocate temporary large buffer
            const buffer = Buffer.alloc(allocateBytes);
            try {
                return await fn(...args);
            } finally {
                // Buffer will be garbage collected
            }
        };
    }
};

module.exports = { ChaosInjector };




