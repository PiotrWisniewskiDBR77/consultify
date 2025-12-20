/**
 * Unit tests for AI Response Post-Processor
 * Step B: Verify deterministic labeling works correctly
 */

const {
    aiResponsePostProcessor,
    getMemoryCount,
    getExternalSources,
    hasMemoryPrefix,
    hasExternalPrefix,
    stripPrefixes,
    MEMORY_PREFIX,
    EXTERNAL_PREFIX
} = require('../../server/services/aiResponsePostProcessor');

describe('aiResponsePostProcessor', () => {
    describe('Memory Prefix', () => {
        it('should add memory prefix when memory count > 0', () => {
            const response = 'Here is my analysis...';
            const context = {
                knowledge: { previousDecisions: [{ id: '1' }, { id: '2' }] }
            };

            const result = aiResponsePostProcessor(response, context);

            expect(result).toContain('📚 [Using project memory: 2 items]');
            expect(result).toContain('Here is my analysis...');
        });

        it('should NOT add memory prefix when memory count is 0', () => {
            const response = 'Here is my analysis...';
            const context = {
                knowledge: { previousDecisions: [] }
            };

            const result = aiResponsePostProcessor(response, context);

            expect(result).not.toContain('📚');
            expect(result).toBe('Here is my analysis...');
        });

        it('should NOT duplicate memory prefix if already present', () => {
            const response = '📚 [Using project memory: 2 items]\n\nHere is my analysis...';
            const context = {
                knowledge: { previousDecisions: [{ id: '1' }, { id: '2' }] }
            };

            const result = aiResponsePostProcessor(response, context);

            // Count occurrences of the prefix
            const matches = result.match(/📚 \[Using project memory:/g);
            expect(matches?.length || 0).toBe(1);
        });
    });

    describe('External Sources Prefix', () => {
        it('should add external prefix when external sources are used', () => {
            const response = 'Based on current market data...';
            const context = {
                external: {
                    externalSourcesUsed: ['Wikipedia', 'Market Watch']
                }
            };

            const result = aiResponsePostProcessor(response, context);

            expect(result).toContain('🌐 [External sources: Wikipedia, Market Watch]');
            expect(result).toContain('Based on current market data...');
        });

        it('should NOT add external prefix when no external sources', () => {
            const response = 'Based on internal data...';
            const context = {
                external: {
                    externalSourcesUsed: []
                }
            };

            const result = aiResponsePostProcessor(response, context);

            expect(result).not.toContain('🌐');
            expect(result).toBe('Based on internal data...');
        });

        it('should NOT duplicate external prefix if already present', () => {
            const response = '🌐 [External sources: Wikipedia]\n\nBased on current market data...';
            const context = {
                external: {
                    externalSourcesUsed: ['Wikipedia']
                }
            };

            const result = aiResponsePostProcessor(response, context);

            const matches = result.match(/🌐 \[External sources:/g);
            expect(matches?.length || 0).toBe(1);
        });
    });

    describe('Combined Prefixes', () => {
        it('should add both prefixes when both memory and external sources exist', () => {
            const response = 'Analysis result...';
            const context = {
                knowledge: { previousDecisions: [{ id: '1' }] },
                external: { externalSourcesUsed: ['Reuters'] }
            };

            const result = aiResponsePostProcessor(response, context);

            expect(result).toContain('📚 [Using project memory: 1 items]');
            expect(result).toContain('🌐 [External sources: Reuters]');
            expect(result).toContain('Analysis result...');
        });

        it('should maintain correct order: memory first, then external', () => {
            const response = 'Analysis result...';
            const context = {
                knowledge: { previousDecisions: [{ id: '1' }] },
                external: { externalSourcesUsed: ['Reuters'] }
            };

            const result = aiResponsePostProcessor(response, context);

            const memoryIndex = result.indexOf('📚');
            const externalIndex = result.indexOf('🌐');

            expect(memoryIndex).toBeLessThan(externalIndex);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty response safely', () => {
            const result = aiResponsePostProcessor('', {});
            expect(result).toBe('');
        });

        it('should handle null response safely', () => {
            const result = aiResponsePostProcessor(null, {});
            expect(result).toBe('');
        });

        it('should handle undefined context safely', () => {
            const result = aiResponsePostProcessor('Hello', undefined);
            expect(result).toBe('Hello');
        });

        it('should handle null context safely', () => {
            const result = aiResponsePostProcessor('Hello', null);
            expect(result).toBe('Hello');
        });

        it('should trim whitespace from response', () => {
            const result = aiResponsePostProcessor('  Hello  ', {});
            expect(result).toBe('Hello');
        });
    });

    describe('Helper Functions', () => {
        describe('getMemoryCount', () => {
            it('should count previous decisions', () => {
                const context = {
                    knowledge: { previousDecisions: [{ id: '1' }, { id: '2' }, { id: '3' }] }
                };
                expect(getMemoryCount(context)).toBe(3);
            });

            it('should return memoryCount from projectMemory', () => {
                const context = {
                    projectMemory: { memoryCount: 5 }
                };
                expect(getMemoryCount(context)).toBe(5);
            });

            it('should return 1 when PMO health snapshot exists', () => {
                const context = {
                    pmo: { healthSnapshot: { projectId: '123' } }
                };
                expect(getMemoryCount(context)).toBe(1);
            });
        });

        describe('getExternalSources', () => {
            it('should return externalSourcesUsed array', () => {
                const context = {
                    external: { externalSourcesUsed: ['Google', 'Bing'] }
                };
                expect(getExternalSources(context)).toEqual(['Google', 'Bing']);
            });

            it('should derive sources from fetchedData', () => {
                const context = {
                    external: {
                        internetEnabled: true,
                        fetchedData: { webSearch: true, news: true }
                    }
                };
                expect(getExternalSources(context)).toContain('Web Search');
                expect(getExternalSources(context)).toContain('News');
            });
        });

        describe('stripPrefixes', () => {
            it('should remove memory and external prefixes', () => {
                const text = '📚 [Using project memory: 3 items]\n🌐 [External sources: Google]\n\nActual content';
                const result = stripPrefixes(text);
                expect(result).toBe('Actual content');
            });

            it('should handle text without prefixes', () => {
                const text = 'Just plain text';
                expect(stripPrefixes(text)).toBe('Just plain text');
            });
        });
    });
});
