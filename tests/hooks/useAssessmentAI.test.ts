/**
 * Hook Tests: useAssessmentAI
 * Complete test coverage for the AI assessment assistance hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssessmentAI } from '../../hooks/useAssessmentAI';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
    getItem: vi.fn(() => 'mock-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage
});

describe('useAssessmentAI', () => {
    const projectId = 'project-123';

    const mockSuggestion = {
        suggestion: 'Organizacja posiada zintegrowane systemy...',
        mode: 'AI_GENERATED' as const
    };

    const mockValidation = {
        isValid: true,
        errors: [],
        warnings: ['Consider reviewing AI maturity score'],
        suggestions: []
    };

    const mockGapAnalysis = {
        axisId: 'processes',
        axisName: 'Digital Processes',
        currentScore: 3,
        targetScore: 5,
        gap: 2,
        gapSeverity: 'MEDIUM' as const,
        pathway: [
            { level: 4, description: 'Integrated workflows', estimatedMonths: 6, keyActivities: [] },
            { level: 5, description: 'End-to-end digital', estimatedMonths: 9, keyActivities: [] }
        ],
        estimatedTotalMonths: 15,
        aiRecommendations: []
    };

    const mockInsights = [
        { type: 'STRENGTH', priority: 'INFO', title: 'Strong in processes', description: 'Test', axis: 'processes' }
    ];

    const mockExecutiveSummary = {
        summary: 'Executive summary text...',
        metrics: { averageMaturity: '3.5', averageTarget: '5.0', overallGap: '1.5', axesAssessed: 7 },
        topStrengths: ['processes'],
        priorityGaps: ['culture'],
        mode: 'AI_GENERATED' as const
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockFetch.mockImplementation((url: string) => {
            if (url.includes('/ai/suggest-justification')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockSuggestion)
                });
            }
            if (url.includes('/ai/suggest-evidence')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ evidence: ['Evidence 1', 'Evidence 2'], mode: 'AI_GENERATED' })
                });
            }
            if (url.includes('/ai/suggest-target')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ suggestedTarget: 5, reasoning: 'Balanced approach', mode: 'AI_GENERATED' })
                });
            }
            if (url.includes('/ai/validate')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockValidation)
                });
            }
            if (url.includes('/ai/gap/')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockGapAnalysis)
                });
            }
            if (url.includes('/ai/insights')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ insights: mockInsights })
                });
            }
            if (url.includes('/ai/executive-summary')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockExecutiveSummary)
                });
            }
            if (url.includes('/ai/generate-initiatives')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ initiatives: [] })
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({})
            });
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // INITIALIZATION TESTS
    // =========================================================================

    describe('Initialization', () => {
        it('should initialize with default state', () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            expect(result.current.isLoading).toBe(false);
            expect(result.current.error).toBeNull();
            expect(result.current.lastSuggestion).toBeNull();
            expect(result.current.lastValidation).toBeNull();
            expect(result.current.insights).toEqual([]);
            expect(result.current.gapAnalysis).toBeNull();
            expect(result.current.executiveSummary).toBeNull();
            expect(result.current.initiatives).toEqual([]);
        });
    });

    // =========================================================================
    // SUGGESTION METHODS TESTS
    // =========================================================================

    describe('suggestJustification', () => {
        it('should call suggest-justification endpoint', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            let suggestion;
            await act(async () => {
                suggestion = await result.current.suggestJustification('processes', 4);
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/suggest-justification'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('processes')
                })
            );
            expect(suggestion).toMatchObject(mockSuggestion);
        });

        it('should include existing text when provided', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.suggestJustification('processes', 4, 'Existing text');
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: expect.stringContaining('Existing text')
                })
            );
        });

        it('should update lastSuggestion state', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.suggestJustification('processes', 4);
            });

            expect(result.current.lastSuggestion).toMatchObject(mockSuggestion);
        });
    });

    describe('suggestEvidence', () => {
        it('should call suggest-evidence endpoint', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.suggestEvidence('dataManagement', 5);
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/suggest-evidence'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should return evidence array', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            let evidence;
            await act(async () => {
                evidence = await result.current.suggestEvidence('dataManagement', 5);
            });

            expect(evidence.evidence).toContain('Evidence 1');
        });
    });

    describe('suggestTarget', () => {
        it('should call suggest-target endpoint', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.suggestTarget('processes', 3, 'balanced');
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/suggest-target'),
                expect.objectContaining({
                    body: expect.stringContaining('balanced')
                })
            );
        });

        it('should return suggested target', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            let suggestion;
            await act(async () => {
                suggestion = await result.current.suggestTarget('processes', 3);
            });

            expect(suggestion.suggestedTarget).toBe(5);
        });
    });

    describe('correctText', () => {
        it('should call correct-text endpoint', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ correctedText: 'Corrected text', mode: 'AI_CORRECTED' })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.correctText('Original text', 'pl');
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/correct-text'),
                expect.any(Object)
            );
        });
    });

    describe('autocomplete', () => {
        it('should call autocomplete endpoint', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ completion: 'completed text', mode: 'AI_COMPLETED' })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.autocomplete('Partial text', 'processes', 4);
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/autocomplete'),
                expect.any(Object)
            );
        });
    });

    // =========================================================================
    // VALIDATION METHODS TESTS
    // =========================================================================

    describe('validateField', () => {
        it('should call validate-field endpoint', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ isValid: true, errors: [], warnings: [], suggestions: [] })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.validateField('score', 4, { axisId: 'processes' });
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/validate-field'),
                expect.any(Object)
            );
        });

        it('should update lastValidation state', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ isValid: false, errors: ['Invalid score'] })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.validateField('score', 99);
            });

            expect(result.current.lastValidation?.isValid).toBe(false);
        });
    });

    describe('validateConsistency', () => {
        it('should call validate endpoint', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.validateConsistency();
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/validate'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should return validation result', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            let validation;
            await act(async () => {
                validation = await result.current.validateConsistency();
            });

            expect(validation.isValid).toBe(true);
            expect(validation.warnings).toContain('Consider reviewing AI maturity score');
        });
    });

    // =========================================================================
    // ANALYSIS METHODS TESTS
    // =========================================================================

    describe('getGuidance', () => {
        it('should call guidance endpoint', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ guidance: 'Test guidance' })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.getGuidance('processes', 3, 5);
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/guidance'),
                expect.any(Object)
            );
        });
    });

    describe('generateGapAnalysis', () => {
        it('should call gap analysis endpoint', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.generateGapAnalysis('processes', 3, 5);
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/gap/processes'),
                expect.any(Object)
            );
        });

        it('should update gapAnalysis state', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.generateGapAnalysis('processes', 3, 5);
            });

            expect(result.current.gapAnalysis).toMatchObject({
                axisId: 'processes',
                gap: 2,
                gapSeverity: 'MEDIUM'
            });
        });

        it('should include pathway in response', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            let gapAnalysis;
            await act(async () => {
                gapAnalysis = await result.current.generateGapAnalysis('processes', 3, 5);
            });

            expect(gapAnalysis.pathway).toHaveLength(2);
            expect(gapAnalysis.estimatedTotalMonths).toBe(15);
        });
    });

    describe('getInsights', () => {
        it('should call insights endpoint', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.getInsights();
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/insights'),
                expect.objectContaining({ method: 'GET' })
            );
        });

        it('should update insights state', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.getInsights();
            });

            expect(result.current.insights).toHaveLength(1);
            expect(result.current.insights[0].type).toBe('STRENGTH');
        });
    });

    describe('getClarifyingQuestion', () => {
        it('should call clarify endpoint', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ question: 'Can you provide more details?' })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            let response;
            await act(async () => {
                response = await result.current.getClarifyingQuestion('processes', 4);
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/clarify'),
                expect.any(Object)
            );
            expect(response.question).toBeDefined();
        });
    });

    // =========================================================================
    // REPORT METHODS TESTS
    // =========================================================================

    describe('generateExecutiveSummary', () => {
        it('should call executive-summary endpoint', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.generateExecutiveSummary();
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/executive-summary'),
                expect.any(Object)
            );
        });

        it('should update executiveSummary state', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.generateExecutiveSummary();
            });

            expect(result.current.executiveSummary).toMatchObject({
                summary: expect.any(String),
                metrics: expect.any(Object),
                mode: 'AI_GENERATED'
            });
        });

        it('should pass options to endpoint', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.generateExecutiveSummary({ language: 'pl' });
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: expect.stringContaining('language')
                })
            );
        });
    });

    describe('generateStakeholderView', () => {
        it('should call stakeholder-view endpoint', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ view: 'CTO view content', stakeholderRole: 'CTO' })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.generateStakeholderView('CTO');
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/stakeholder-view'),
                expect.objectContaining({
                    body: expect.stringContaining('CTO')
                })
            );
        });
    });

    // =========================================================================
    // INITIATIVE METHODS TESTS
    // =========================================================================

    describe('generateInitiatives', () => {
        it('should call generate-initiatives endpoint', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.generateInitiatives({ budget: '100k' });
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/generate-initiatives'),
                expect.any(Object)
            );
        });

        it('should update initiatives state', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    initiatives: [
                        { name: 'Initiative 1', priority: 'HIGH' }
                    ]
                })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.generateInitiatives();
            });

            expect(result.current.initiatives).toHaveLength(1);
        });
    });

    describe('prioritizeInitiatives', () => {
        it('should call prioritize-initiatives endpoint', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ prioritizedList: [] })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            const initiatives = [{ name: 'Init 1' }];
            await act(async () => {
                await result.current.prioritizeInitiatives(initiatives as any);
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/prioritize-initiatives'),
                expect.any(Object)
            );
        });
    });

    describe('estimateROI', () => {
        it('should call estimate-roi endpoint', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ estimate: {} })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            const initiative = { name: 'Test Initiative' };
            await act(async () => {
                await result.current.estimateROI(initiative as any);
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/estimate-roi'),
                expect.any(Object)
            );
        });
    });

    // =========================================================================
    // FORM HELPER METHODS TESTS
    // =========================================================================

    describe('getQuickActions', () => {
        it('should call quick-actions endpoint', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ actions: [] })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.getQuickActions({ currentAxis: 'processes' });
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ai/quick-actions'),
                expect.any(Object)
            );
        });

        it('should update quickActions state', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    actions: [{ id: '1', label: 'Action 1', action: 'test' }]
                })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.getQuickActions({});
            });

            expect(result.current.quickActions).toHaveLength(1);
        });
    });

    // =========================================================================
    // UTILITY METHODS TESTS
    // =========================================================================

    describe('Utility Methods', () => {
        it('should clear error', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: false,
                json: () => Promise.resolve({ error: 'Test error' })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                try {
                    await result.current.suggestJustification('processes', 4);
                } catch (e) {
                    // Expected error
                }
            });

            expect(result.current.error).toBeTruthy();

            act(() => {
                result.current.clearError();
            });

            expect(result.current.error).toBeNull();
        });

        it('should clear suggestion', async () => {
            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                await result.current.suggestJustification('processes', 4);
            });

            expect(result.current.lastSuggestion).not.toBeNull();

            act(() => {
                result.current.clearSuggestion();
            });

            expect(result.current.lastSuggestion).toBeNull();
        });
    });

    // =========================================================================
    // ERROR HANDLING TESTS
    // =========================================================================

    describe('Error Handling', () => {
        it('should set error on API failure', async () => {
            mockFetch.mockImplementation(() => Promise.resolve({
                ok: false,
                json: () => Promise.resolve({ error: 'API Error' })
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                try {
                    await result.current.suggestJustification('processes', 4);
                } catch (e) {
                    // Expected
                }
            });

            expect(result.current.error).toBe('API Error');
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            await act(async () => {
                try {
                    await result.current.suggestJustification('processes', 4);
                } catch (e) {
                    // Expected
                }
            });

            expect(result.current.error).toBe('Network error');
        });

        it('should set isLoading during request', async () => {
            let resolvePromise: Function;
            mockFetch.mockImplementation(() => new Promise(resolve => {
                resolvePromise = () => resolve({
                    ok: true,
                    json: () => Promise.resolve(mockSuggestion)
                });
            }));

            const { result } = renderHook(() => useAssessmentAI(projectId));

            const suggestPromise = act(async () => {
                result.current.suggestJustification('processes', 4);
            });

            // Initially loading
            expect(result.current.isLoading).toBe(true);

            // Resolve
            act(() => {
                resolvePromise!();
            });

            await suggestPromise;

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });
        });
    });

    // =========================================================================
    // REQUEST CANCELLATION TESTS
    // =========================================================================

    describe('Request Cancellation', () => {
        it('should abort previous request on new request', async () => {
            let callCount = 0;
            mockFetch.mockImplementation(() => {
                callCount++;
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            json: () => Promise.resolve(mockSuggestion)
                        });
                    }, 100);
                });
            });

            const { result } = renderHook(() => useAssessmentAI(projectId));

            // Start first request
            act(() => {
                result.current.suggestJustification('processes', 4);
            });

            // Start second request immediately
            act(() => {
                result.current.suggestJustification('culture', 3);
            });

            // Both fetch calls should have been made
            expect(callCount).toBe(2);
        });
    });
});

