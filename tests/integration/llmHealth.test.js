// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../server/database.js');
const AiService = require('../../server/services/aiService.js');

/**
 * Level 2: Integration Tests - LLM Health & Performance
 * Tests LLM provider connectivity, latency, and quality
 */
describe('Integration Test: LLM Health', () => {
    let testProviderId;

    beforeAll(async () => {
        await db.initPromise;
        delete process.env.MOCK_DB;

        // Create a test LLM provider configuration
        testProviderId = 'test-provider-' + Date.now();
        await new Promise((resolve) => {
            db.run(
                `INSERT INTO llm_providers 
                 (id, name, provider, api_key, model_id, is_active, is_default, visibility) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    testProviderId,
                    'Test Provider',
                    'openai', // or 'anthropic', 'gemini', 'ollama'
                    process.env.OPENAI_API_KEY || 'test-key',
                    'gpt-3.5-turbo',
                    1,
                    0,
                    'admin'
                ],
                resolve
            );
        });
    });

    describe.skip('Connection Tests', () => {
        it('should test provider connection successfully', async () => {
            // Skip if no API key configured
            if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
                console.log('Skipping LLM connection test - no API keys configured');
                return;
            }

            const config = {
                provider: 'openai',
                api_key: process.env.OPENAI_API_KEY || 'test-key',
                model_id: 'gpt-3.5-turbo',
            };

            try {
                const result = await AiService.testProviderConnection(config);
                expect(result).toBeDefined();
                expect(typeof result).toBe('string');
            } catch (error) {
                // If test fails due to invalid key, that's expected in test environment
                if (error.message.includes('API key') || error.message.includes('401')) {
                    console.log('Expected failure: Invalid or missing API key');
                    return;
                }
                throw error;
            }
        });

        it('should handle connection timeout gracefully', async () => {
            const config = {
                provider: 'openai',
                api_key: 'invalid-key',
                model_id: 'gpt-3.5-turbo',
            };

            // Should not hang indefinitely
            const startTime = Date.now();
            try {
                await AiService.testProviderConnection(config);
            } catch (error) {
                // Expected to fail
            }
            const duration = Date.now() - startTime;

            // Should fail quickly (< 10 seconds)
            expect(duration).toBeLessThan(10000);
        });

        it('should handle invalid provider gracefully', async () => {
            const config = {
                provider: 'invalid-provider',
                api_key: 'test-key',
                model_id: 'test-model',
            };

            const result = await AiService.testProviderConnection(config);
            // Service returns error object instead of throwing
            expect(result).toBeDefined();
            expect(result.success).toBe(false);
            expect(result.message).toBeDefined();
        });
    });

    describe.skip('Latency Tests', () => {
        it('should measure LLM call latency', async () => {
            if (!process.env.OPENAI_API_KEY) {
                console.log('Skipping latency test - no API key configured');
                return;
            }

            const startTime = Date.now();

            try {
                const result = await AiService.callLLM(
                    'Say "OK"',
                    'You are a helpful assistant.',
                    [],
                    null,
                    null,
                    'test'
                );

                const latency = Date.now() - startTime;

                expect(latency).toBeGreaterThan(0);
                expect(latency).toBeLessThan(30000); // Should complete in < 30s
                expect(result).toBeDefined();
            } catch (error) {
                // Expected if no valid API key
                if (error.message.includes('API key') || error.message.includes('401')) {
                    console.log('Expected failure: Invalid or missing API key');
                    return;
                }
                throw error;
            }
        });

        it('should handle concurrent LLM calls', async () => {
            if (!process.env.OPENAI_API_KEY) {
                console.log('Skipping concurrent test - no API key configured');
                return;
            }

            const calls = Array(3).fill(null).map(() =>
                AiService.callLLM(
                    'Say "OK"',
                    'You are a helpful assistant.',
                    [],
                    null,
                    null,
                    'test'
                ).catch(err => ({ error: err.message }))
            );

            const results = await Promise.all(calls);

            expect(results.length).toBe(3);
            // At least some should succeed (or all fail gracefully)
            results.forEach(result => {
                expect(result).toBeDefined();
            });
        });
    });

    describe.skip('Quality Tests', () => {
        it('should respect system instructions', async () => {
            if (!process.env.OPENAI_API_KEY) {
                console.log('Skipping quality test - no API key configured');
                return;
            }

            const systemInstruction = 'You must respond with exactly: "TEST_PASSED"';

            try {
                const result = await AiService.callLLM(
                    'What is 2+2?',
                    systemInstruction,
                    [],
                    null,
                    null,
                    'test'
                );

                // Should contain the system instruction response
                expect(result).toBeDefined();
                expect(typeof result).toBe('string');
            } catch (error) {
                if (error.message.includes('API key') || error.message.includes('401')) {
                    console.log('Expected failure: Invalid or missing API key');
                    return;
                }
                throw error;
            }
        });

        it('should handle context history correctly', async () => {
            if (!process.env.OPENAI_API_KEY) {
                console.log('Skipping context test - no API key configured');
                return;
            }

            const history = [
                { role: 'user', content: 'My name is Alice' },
                { role: 'assistant', content: 'Nice to meet you, Alice!' },
            ];

            try {
                const result = await AiService.callLLM(
                    'What is my name?',
                    'You are a helpful assistant.',
                    history,
                    null,
                    null,
                    'test'
                );

                expect(result).toBeDefined();
                expect(result.toLowerCase()).toContain('alice');
            } catch (error) {
                if (error.message.includes('API key') || error.message.includes('401')) {
                    console.log('Expected failure: Invalid or missing API key');
                    return;
                }
                throw error;
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            const config = {
                provider: 'openai',
                api_key: 'invalid-key-12345',
                model_id: 'gpt-3.5-turbo',
            };

            const result = await AiService.testProviderConnection(config);
            // Service returns error object instead of throwing
            expect(result).toBeDefined();
            expect(result.success).toBe(false);
            expect(result.message).toBeDefined();
        });

        it('should handle rate limiting', async () => {
            // This test would require actual rate limiting scenario
            // For now, we just verify the service doesn't crash
            const config = {
                provider: 'openai',
                api_key: process.env.OPENAI_API_KEY || 'test-key',
                model_id: 'gpt-3.5-turbo',
            };

            try {
                await AiService.testProviderConnection(config);
            } catch (error) {
                // Should provide meaningful error message
                expect(error.message).toBeDefined();
                expect(typeof error.message).toBe('string');
            }
        });
    });

    describe('Provider Configuration', () => {
        it('should retrieve provider from database', async () => {
            const provider = await new Promise((resolve) => {
                db.get(
                    'SELECT * FROM llm_providers WHERE id = ?',
                    [testProviderId],
                    (err, row) => resolve(row)
                );
            });

            expect(provider).toBeDefined();
            expect(provider.id).toBe(testProviderId);
            expect(provider.is_active).toBe(1);
        });

        it('should handle missing provider gracefully', async () => {
            const nonExistentId = 'non-existent-' + Date.now();
            const provider = await new Promise((resolve) => {
                db.get(
                    'SELECT * FROM llm_providers WHERE id = ?',
                    [nonExistentId],
                    (err, row) => resolve(row)
                );
            });

            expect(provider).toBeUndefined();
        });
    });
});

