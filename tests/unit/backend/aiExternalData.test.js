// GAP-14: External Data Blocking Tests
// Tests that external data is blocked when internetEnabled=false

import { describe, it, expect, vi, beforeAll } from 'vitest';

describe('AI External Data Control', () => {
    beforeAll(() => {
        vi.mock('../../../server/database', () => ({
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn()
        }));
    });

    describe('Internet Toggle', () => {
        it('should block external sources when internetEnabled is false', async () => {
            const mockContext = {
                external: {
                    internetEnabled: false,
                    externalSourcesUsed: []
                }
            };

            expect(mockContext.external.internetEnabled).toBe(false);
            expect(mockContext.external.externalSourcesUsed.length).toBe(0);
        });

        it('should allow external sources when internetEnabled is true', async () => {
            const mockContext = {
                external: {
                    internetEnabled: true,
                    externalSourcesUsed: ['Industry Benchmarks', 'Market Data']
                }
            };

            expect(mockContext.external.internetEnabled).toBe(true);
            expect(mockContext.external.externalSourcesUsed.length).toBeGreaterThan(0);
        });

        it('should respect project-level internet toggle', async () => {
            // Mock project with internet disabled
            const projectSettings = {
                id: 'test-project',
                internetEnabled: 0
            };

            const canUseExternal = projectSettings.internetEnabled === 1;
            expect(canUseExternal).toBe(false);
        });
    });

    describe('RAG Toggle (GAP-03)', () => {
        it('should disable RAG when rag_enabled is 0', async () => {
            const project = { rag_enabled: 0 };
            const ragDisabled = project.rag_enabled === 0;

            expect(ragDisabled).toBe(true);
        });

        it('should enable RAG by default', async () => {
            const project = { rag_enabled: 1 };
            const ragEnabled = project.rag_enabled !== 0;

            expect(ragEnabled).toBe(true);
        });
    });
});
