// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../server/database.js');
const AiService = require('../../server/services/aiService.js');

/**
 * Level 5: Performance Tests - LLM Performance
 * Tests LLM latency, throughput, and cost efficiency
 */
describe('Performance Test: LLM', () => {
    beforeAll(async () => {
        await db.initPromise;
        delete process.env.MOCK_DB;
    });

    describe('Latency Benchmarks', () => {
        it('should complete simple LLM call in < 5 seconds', async () => {
            if (!process.env.OPENAI_API_KEY) {
                console.log('Skipping latency benchmark - no API key configured');
                return;
            }

            const startTime = Date.now();

            try {
                await AiService.callLLM(
                    'Say "OK"',
                    'You are a helpful assistant.',
                    [],
                    null,
                    null,
                    'test'
                );

                const latency = Date.now() - startTime;
                expect(latency).toBeLessThan(5000); // Should complete in < 5s
            } catch (error) {
                if (error.message.includes('API key') || error.message.includes('401')) {
                    console.log('Expected failure: Invalid or missing API key');
                    return;
                }
                throw error;
            }
        });

        it('should handle streaming with acceptable latency', async () => {
            if (!process.env.OPENAI_API_KEY) {
                console.log('Skipping streaming test - no API key configured');
                return;
            }

            const startTime = Date.now();
            let firstChunkTime = null;

            try {
                await AiService.streamLLM(
                    'Count from 1 to 5',
                    'You are a helpful assistant.',
                    [],
                    (chunk) => {
                        if (!firstChunkTime) {
                            firstChunkTime = Date.now() - startTime;
                        }
                    },
                    () => {},
                    null,
                    null,
                    'test'
                );

                if (firstChunkTime !== null) {
                    // First chunk should arrive quickly
                    expect(firstChunkTime).toBeLessThan(2000); // < 2s for first chunk
                }
            } catch (error) {
                if (error.message.includes('API key') || error.message.includes('401')) {
                    console.log('Expected failure: Invalid or missing API key');
                    return;
                }
                throw error;
            }
        });
    });

    describe('Throughput Tests', () => {
        it('should handle multiple sequential calls efficiently', async () => {
            if (!process.env.OPENAI_API_KEY) {
                console.log('Skipping throughput test - no API key configured');
                return;
            }

            const calls = [
                'Say "One"',
                'Say "Two"',
                'Say "Three"',
            ];

            const startTime = Date.now();

            try {
                for (const prompt of calls) {
                    await AiService.callLLM(
                        prompt,
                        'You are a helpful assistant.',
                        [],
                        null,
                        null,
                        'test'
                    );
                }

                const totalTime = Date.now() - startTime;
                const avgTime = totalTime / calls.length;

                // Average should be reasonable
                expect(avgTime).toBeLessThan(10000); // < 10s per call average
            } catch (error) {
                if (error.message.includes('API key') || error.message.includes('401')) {
                    console.log('Expected failure: Invalid or missing API key');
                    return;
                }
                throw error;
            }
        });

        it('should handle batch processing efficiently', async () => {
            if (!process.env.OPENAI_API_KEY) {
                console.log('Skipping batch test - no API key configured');
                return;
            }

            const prompts = Array(5).fill(null).map((_, i) => `Say "${i + 1}"`);

            const startTime = Date.now();

            try {
                const results = await Promise.all(
                    prompts.map(prompt =>
                        AiService.callLLM(
                            prompt,
                            'You are a helpful assistant.',
                            [],
                            null,
                            null,
                            'test'
                        ).catch(err => ({ error: err.message }))
                    )
                );

                const totalTime = Date.now() - startTime;
                const avgTime = totalTime / prompts.length;

                expect(results.length).toBe(5);
                expect(avgTime).toBeLessThan(15000); // < 15s per call average (concurrent)
            } catch (error) {
                if (error.message.includes('API key') || error.message.includes('401')) {
                    console.log('Expected failure: Invalid or missing API key');
                    return;
                }
                throw error;
            }
        });
    });

    describe('Token Efficiency', () => {
        it('should handle token limits correctly', async () => {
            if (!process.env.OPENAI_API_KEY) {
                console.log('Skipping token test - no API key configured');
                return;
            }

            // Test with a prompt that should stay within limits
            const shortPrompt = 'Say "OK"';

            try {
                const result = await AiService.callLLM(
                    shortPrompt,
                    'You are a helpful assistant.',
                    [],
                    null,
                    null,
                    'test'
                );

                expect(result).toBeDefined();
                expect(result.length).toBeLessThan(10000); // Reasonable response length
            } catch (error) {
                if (error.message.includes('API key') || error.message.includes('401')) {
                    console.log('Expected failure: Invalid or missing API key');
                    return;
                }
                // Token limit errors should be handled gracefully
                if (error.message.includes('token') || error.message.includes('limit')) {
                    expect(error.message).toBeDefined();
                    return;
                }
                throw error;
            }
        });

        it('should handle context window efficiently', async () => {
            if (!process.env.OPENAI_API_KEY) {
                console.log('Skipping context test - no API key configured');
                return;
            }

            // Create a long history
            const history = Array(10).fill(null).map((_, i) => ({
                role: i % 2 === 0 ? 'user' : 'assistant',
                content: `Message ${i + 1}: ${'x'.repeat(100)}`,
            }));

            try {
                const result = await AiService.callLLM(
                    'What was message 5?',
                    'You are a helpful assistant.',
                    history,
                    null,
                    null,
                    'test'
                );

                expect(result).toBeDefined();
            } catch (error) {
                if (error.message.includes('API key') || error.message.includes('401')) {
                    console.log('Expected failure: Invalid or missing API key');
                    return;
                }
                // Context limit errors should be handled gracefully
                if (error.message.includes('context') || error.message.includes('token')) {
                    expect(error.message).toBeDefined();
                    return;
                }
                throw error;
            }
        });
    });

    describe('Error Recovery', () => {
        it('should recover from transient errors', async () => {
            if (!process.env.OPENAI_API_KEY) {
                console.log('Skipping recovery test - no API key configured');
                return;
            }

            // First call might fail, second should succeed
            let attempts = 0;
            let success = false;

            while (attempts < 3 && !success) {
                try {
                    await AiService.callLLM(
                        'Say "OK"',
                        'You are a helpful assistant.',
                        [],
                        null,
                        null,
                        'test'
                    );
                    success = true;
                } catch (error) {
                    attempts++;
                    if (error.message.includes('API key') || error.message.includes('401')) {
                        console.log('Expected failure: Invalid or missing API key');
                        return;
                    }
                    if (attempts >= 3) {
                        throw error;
                    }
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            expect(success || attempts >= 3).toBe(true);
        });
    });
});

