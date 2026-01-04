/**
 * AI Explainability Service Unit Tests
 */

import { describe, it, expect } from 'vitest';
import AIExplainabilityService from '../../../server/src/services/aiExplainabilityService.js';

describe('AIExplainabilityService', () => {
    describe('computeConfidenceLevel', () => {
        it('returns LOW when context is null', () => {
            const result = AIExplainabilityService.computeConfidenceLevel(null);
            expect(result).toBe('LOW');
        });

        it('returns LOW when context is empty', () => {
            const result = AIExplainabilityService.computeConfidenceLevel({});
            expect(result).toBe('LOW');
        });

        it('returns LOW when PMOHealthSnapshot is missing and no project data', () => {
            const context = {
                platform: { role: 'ADMIN' },
                organization: { organizationId: 'org1' }
            };
            const result = AIExplainabilityService.computeConfidenceLevel(context);
            expect(result).toBe('LOW');
        });

        it('returns MEDIUM when PMOHealthSnapshot exists with blockers', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        blockers: [{ type: 'TASK', message: 'Overdue' }]
                    }
                },
                project: { projectId: 'proj1' },
                platform: {},
                organization: { organizationId: 'org1' }
            };
            const result = AIExplainabilityService.computeConfidenceLevel(context);
            expect(result).toBe('MEDIUM');
        });

        it('returns HIGH when full context with no blockers', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        blockers: [],
                        tasks: { overdueCount: 0 },
                        decisions: { pendingCount: 0 }
                    }
                },
                project: { projectId: 'proj1' },
                platform: { role: 'ADMIN' },
                organization: { organizationId: 'org1' },
                execution: { userTasks: [], pendingDecisions: [] },
                knowledge: { previousDecisions: [] },
                external: {}
            };
            const options = { projectMemory: { memoryCount: 5 } };
            const result = AIExplainabilityService.computeConfidenceLevel(context, options);
            expect(result).toBe('HIGH');
        });
    });

    describe('buildReasoningSummary', () => {
        it('returns default message when no health data', () => {
            const result = AIExplainabilityService.buildReasoningSummary({});
            expect(result).toBe('Based on available project context');
        });

        it('includes overdue tasks in reasoning', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        tasks: { overdueCount: 3 }
                    }
                }
            };
            const result = AIExplainabilityService.buildReasoningSummary(context);
            expect(result).toContain('3 overdue task(s)');
        });
    });

    describe('extractConstraintsApplied', () => {
        it('includes AI role constraint', () => {
            const result = AIExplainabilityService.extractConstraintsApplied({}, {}, 'ADVISOR');
            expect(result).toContain('AI Role: ADVISOR (explain/suggest only, no mutations)');
        });

        it('includes policy level constraint', () => {
            const policy = { policyLevel: 'ADVISORY' };
            const result = AIExplainabilityService.extractConstraintsApplied({}, policy, 'ADVISOR');
            expect(result.some(c => c.includes('AI Policy: ADVISORY'))).toBe(true);
        });
    });

    describe('identifyDataUsed', () => {
        it('returns projectData false when no project context', () => {
            const result = AIExplainabilityService.identifyDataUsed({});
            expect(result.projectData).toBe(false);
        });

        it('returns projectData true when project context exists', () => {
            const context = { project: { projectId: 'proj1' } };
            const result = AIExplainabilityService.identifyDataUsed(context);
            expect(result.projectData).toBe(true);
        });
    });

    describe('buildAIExplanation', () => {
        it('generates valid AIExplanation object', () => {
            const responseContext = {
                role: 'ADVISOR',
                context: {
                    platform: { role: 'ADMIN' },
                    organization: { organizationId: 'org1' },
                    project: { projectId: 'proj1' }
                },
                policy: { policyLevel: 'ADVISORY' },
                projectMemory: { memoryCount: 3 }
            };

            const result = AIExplainabilityService.buildAIExplanation(responseContext);

            expect(result).toHaveProperty('aiRole');
            expect(result).toHaveProperty('confidenceLevel');
            expect(result).toHaveProperty('timestamp');
        });
    });

    describe('buildExplainabilityFooter', () => {
        it('returns empty string when explanation is null', () => {
            const result = AIExplainabilityService.buildExplainabilityFooter(null);
            expect(result).toBe('');
        });

        it('formats human-readable footer', () => {
            const explanation = {
                aiRole: 'ADVISOR',
                regulatoryMode: false,
                confidenceLevel: 'MEDIUM',
                reasoningSummary: 'Based on 3 overdue tasks',
                constraintsApplied: ['Phase Gate: Execution', 'AI Role: ADVISOR'],
                dataUsed: {
                    projectData: true,
                    projectMemoryCount: 2,
                    externalSources: []
                }
            };

            const result = AIExplainabilityService.buildExplainabilityFooter(explanation);

            expect(result).toContain('---');
            expect(result).toContain('**Why this recommendation?**');
            expect(result).toContain('Based on 3 overdue tasks');
            expect(result).toContain('Confidence: Medium');
            expect(result).toContain('AI Role: Advisor');
        });
    });
});
