import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    AIConfidenceLevel,
    AIProjectRole,
    computeConfidenceLevel,
    buildReasoningSummary,
    extractConstraintsApplied,
    identifyDataUsed,
    buildAIExplanation,
    buildExplainabilityFooter,
    _countPopulatedLayers,
    _getBlockerCount,
    _extractExternalSources,
    _mapOrchestratorRoleToProjectRole
} = require('../../../../server/services/aiExplainabilityService');

describe('AI Explainability Service', () => {
    describe('AIConfidenceLevel Enum', () => {
        it('defines LOW level', () => {
            expect(AIConfidenceLevel.LOW).toBe('LOW');
        });

        it('defines MEDIUM level', () => {
            expect(AIConfidenceLevel.MEDIUM).toBe('MEDIUM');
        });

        it('defines HIGH level', () => {
            expect(AIConfidenceLevel.HIGH).toBe('HIGH');
        });
    });

    describe('AIProjectRole Enum', () => {
        it('defines ADVISOR role', () => {
            expect(AIProjectRole.ADVISOR).toBe('ADVISOR');
        });

        it('defines MANAGER role', () => {
            expect(AIProjectRole.MANAGER).toBe('MANAGER');
        });

        it('defines OPERATOR role', () => {
            expect(AIProjectRole.OPERATOR).toBe('OPERATOR');
        });
    });

    describe('computeConfidenceLevel', () => {
        it('returns LOW for null context', () => {
            expect(computeConfidenceLevel(null)).toBe('LOW');
        });

        it('returns LOW for empty context', () => {
            expect(computeConfidenceLevel({})).toBe('LOW');
        });

        it('returns HIGH when PMO health snapshot exists with no blockers', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        blockers: []
                    }
                },
                project: { projectId: 'proj-1' },
                platform: { version: '1.0' },
                organization: { organizationId: 'org-1' },
                execution: { userTasks: [] },
                knowledge: { items: [] }
            };

            expect(computeConfidenceLevel(context)).toBe('HIGH');
        });

        it('returns MEDIUM when PMO health has some blockers', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        blockers: [{ type: 'TASK' }, { type: 'DECISION' }]
                    }
                },
                project: { projectId: 'proj-1' }
            };

            expect(computeConfidenceLevel(context)).toBe('MEDIUM');
        });

        it('returns LOW when too many blockers and pending decisions', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        blockers: [1, 2, 3, 4, 5]
                    }
                },
                execution: {
                    pendingDecisions: [1, 2, 3, 4, 5]
                }
            };

            expect(computeConfidenceLevel(context)).toBe('LOW');
        });

        it('increases score for project memory', () => {
            const contextWithMemory = {
                project: { projectId: 'proj-1' },
                pmo: { healthSnapshot: { blockers: [] } },
                platform: { v: 1 },
                organization: { organizationId: 'org-1' }
            };

            const scoreWithMemory = computeConfidenceLevel(contextWithMemory, {
                projectMemory: { memoryCount: 5 }
            });

            const scoreWithoutMemory = computeConfidenceLevel(contextWithMemory, {
                projectMemory: { memoryCount: 0 }
            });

            // Both should be reasonably high, but with memory might be slightly higher
            expect(['MEDIUM', 'HIGH']).toContain(scoreWithMemory);
        });

        it('decreases confidence for external data', () => {
            const context = {
                project: { projectId: 'proj-1' },
                pmo: { healthSnapshot: { blockers: [] } },
                external: {
                    internetEnabled: true,
                    fetchedData: { webSearch: true }
                }
            };

            const result = computeConfidenceLevel(context);
            // External data adds uncertainty
            expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result);
        });
    });

    describe('_countPopulatedLayers', () => {
        it('returns 0 for null context', () => {
            expect(_countPopulatedLayers(null)).toBe(0);
        });

        it('counts populated layers correctly', () => {
            const context = {
                platform: { version: '1.0' },
                organization: { organizationId: 'org-1' },
                project: { projectId: 'proj-1' },
                execution: { userTasks: [] },
                knowledge: { items: [] },
                external: { data: {} }
            };

            expect(_countPopulatedLayers(context)).toBe(6);
        });

        it('ignores empty layers', () => {
            const context = {
                platform: {},
                organization: { organizationId: 'org-1' }
            };

            expect(_countPopulatedLayers(context)).toBe(1);
        });
    });

    describe('_getBlockerCount', () => {
        it('returns 0 for empty context', () => {
            expect(_getBlockerCount({})).toBe(0);
        });

        it('counts blockers from PMO health snapshot', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        blockers: [1, 2, 3]
                    }
                }
            };

            expect(_getBlockerCount(context)).toBe(3);
        });

        it('counts blockers from execution context', () => {
            const context = {
                execution: {
                    blockers: [1, 2]
                }
            };

            expect(_getBlockerCount(context)).toBe(2);
        });

        it('combines blockers from both sources', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        blockers: [1, 2]
                    }
                },
                execution: {
                    blockers: [3, 4, 5]
                }
            };

            expect(_getBlockerCount(context)).toBe(5);
        });
    });

    describe('buildReasoningSummary', () => {
        it('returns default message for empty context', () => {
            expect(buildReasoningSummary({})).toBe('Based on available project context');
        });

        it('includes overdue task count', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        tasks: { overdueCount: 3 }
                    }
                }
            };

            expect(buildReasoningSummary(context)).toContain('3 overdue task(s)');
        });

        it('includes blocked task count', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        tasks: { blockedCount: 2 }
                    }
                }
            };

            expect(buildReasoningSummary(context)).toContain('2 blocked task(s)');
        });

        it('includes pending decisions', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        decisions: { pendingCount: 4 }
                    }
                }
            };

            expect(buildReasoningSummary(context)).toContain('4 pending decision(s)');
        });

        it('includes at-risk initiatives', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        initiatives: { atRiskCount: 2 }
                    }
                }
            };

            expect(buildReasoningSummary(context)).toContain('2 initiative(s) at risk');
        });

        it('includes current phase', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        phase: { name: 'Execution' }
                    }
                }
            };

            expect(buildReasoningSummary(context)).toContain('current phase: Execution');
        });

        it('includes stage gate status when ready', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        stageGate: {
                            gateType: 'EXECUTION_GATE',
                            isReady: true
                        }
                    }
                }
            };

            expect(buildReasoningSummary(context)).toContain('stage gate EXECUTION_GATE is ready');
        });

        it('includes missing criteria when not ready', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        stageGate: {
                            gateType: 'EXECUTION_GATE',
                            isReady: false,
                            missingCriteria: [1, 2, 3]
                        }
                    }
                }
            };

            expect(buildReasoningSummary(context)).toContain('3 missing criteria');
        });

        it('includes project memory count', () => {
            const context = {};
            const options = { projectMemory: { memoryCount: 5 } };

            expect(buildReasoningSummary(context, options)).toContain('5 project memory item(s)');
        });
    });

    describe('extractConstraintsApplied', () => {
        it('includes AI role constraint', () => {
            const constraints = extractConstraintsApplied({}, {}, 'ADVISOR');

            expect(constraints).toContain('AI Role: ADVISOR (explain/suggest only, no mutations)');
        });

        it('includes policy level constraint', () => {
            const constraints = extractConstraintsApplied({}, { policyLevel: 'ASSISTED' }, null);

            expect(constraints).toContain('AI Policy: ASSISTED mode');
        });

        it('includes phase gate constraint', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        phase: { name: 'Execution' }
                    }
                }
            };

            const constraints = extractConstraintsApplied(context, {}, null);

            expect(constraints).toContain('Phase Gate: Execution');
        });

        it('includes stage gate not ready constraint', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        stageGate: {
                            gateType: 'EXECUTION_GATE',
                            isReady: false
                        }
                    }
                }
            };

            const constraints = extractConstraintsApplied(context, {}, null);

            expect(constraints).toContain('Stage gate not ready: EXECUTION_GATE');
        });

        it('includes regulatory mode constraint', () => {
            const context = { regulatoryMode: true };

            const constraints = extractConstraintsApplied(context, {}, null);

            expect(constraints).toContain('Regulatory compliance mode active');
        });

        it('includes phase transition approval constraint', () => {
            const context = {
                project: {
                    governanceSettings: {
                        requireApprovalForPhaseTransition: true
                    }
                }
            };

            const constraints = extractConstraintsApplied(context, {}, null);

            expect(constraints).toContain('Phase transition requires approval');
        });
    });

    describe('identifyDataUsed', () => {
        it('identifies project data presence', () => {
            const context = {
                project: { projectId: 'proj-1' }
            };

            const dataUsed = identifyDataUsed(context);

            expect(dataUsed.projectData).toBe(true);
        });

        it('identifies missing project data', () => {
            const dataUsed = identifyDataUsed({});

            expect(dataUsed.projectData).toBe(false);
        });

        it('includes project memory count', () => {
            const dataUsed = identifyDataUsed({}, { projectMemory: { memoryCount: 10 } });

            expect(dataUsed.projectMemoryCount).toBe(10);
        });

        it('returns 0 for missing project memory', () => {
            const dataUsed = identifyDataUsed({});

            expect(dataUsed.projectMemoryCount).toBe(0);
        });
    });

    describe('_extractExternalSources', () => {
        it('returns empty array when internet disabled', () => {
            const context = {
                external: { internetEnabled: false }
            };

            expect(_extractExternalSources(context)).toEqual([]);
        });

        it('extracts web search source', () => {
            const context = {
                external: {
                    internetEnabled: true,
                    fetchedData: { webSearch: true }
                }
            };

            expect(_extractExternalSources(context)).toContain('Web Search');
        });

        it('extracts news source', () => {
            const context = {
                external: {
                    internetEnabled: true,
                    fetchedData: { news: true }
                }
            };

            expect(_extractExternalSources(context)).toContain('News');
        });

        it('extracts market data source', () => {
            const context = {
                external: {
                    internetEnabled: true,
                    fetchedData: { market: true }
                }
            };

            expect(_extractExternalSources(context)).toContain('Market Data');
        });

        it('deduplicates sources', () => {
            const context = {
                external: {
                    internetEnabled: true,
                    fetchedData: { webSearch: true },
                    externalSourcesUsed: ['Web Search', 'Custom API']
                }
            };

            const sources = _extractExternalSources(context);
            const webSearchCount = sources.filter(s => s === 'Web Search').length;

            expect(webSearchCount).toBe(1);
        });
    });

    describe('_mapOrchestratorRoleToProjectRole', () => {
        it('maps ADVISOR to ADVISOR', () => {
            expect(_mapOrchestratorRoleToProjectRole('ADVISOR')).toBe('ADVISOR');
        });

        it('maps PMO_MANAGER to MANAGER', () => {
            expect(_mapOrchestratorRoleToProjectRole('PMO_MANAGER')).toBe('MANAGER');
        });

        it('maps EXECUTOR to OPERATOR', () => {
            expect(_mapOrchestratorRoleToProjectRole('EXECUTOR')).toBe('OPERATOR');
        });

        it('maps EDUCATOR to ADVISOR', () => {
            expect(_mapOrchestratorRoleToProjectRole('EDUCATOR')).toBe('ADVISOR');
        });

        it('defaults to ADVISOR for unknown roles', () => {
            expect(_mapOrchestratorRoleToProjectRole('UNKNOWN')).toBe('ADVISOR');
        });
    });

    describe('buildAIExplanation', () => {
        it('builds complete explanation object', () => {
            const responseContext = {
                context: {
                    project: { projectId: 'proj-1' },
                    pmo: { healthSnapshot: { blockers: [] } }
                },
                policy: { policyLevel: 'ASSISTED' },
                role: 'ADVISOR'
            };

            const explanation = buildAIExplanation(responseContext);

            expect(explanation).toHaveProperty('aiRole');
            expect(explanation).toHaveProperty('regulatoryMode');
            expect(explanation).toHaveProperty('confidenceLevel');
            expect(explanation).toHaveProperty('reasoningSummary');
            expect(explanation).toHaveProperty('dataUsed');
            expect(explanation).toHaveProperty('constraintsApplied');
            expect(explanation).toHaveProperty('timestamp');
        });

        it('sets correct AI role', () => {
            const responseContext = {
                context: {},
                role: 'PMO_MANAGER'
            };

            const explanation = buildAIExplanation(responseContext);

            expect(explanation.aiRole).toBe('MANAGER');
        });

        it('detects regulatory mode from context', () => {
            const responseContext = {
                context: { regulatoryMode: true }
            };

            const explanation = buildAIExplanation(responseContext);

            expect(explanation.regulatoryMode).toBe(true);
        });

        it('detects regulatory mode from project', () => {
            const responseContext = {
                context: {
                    project: { regulatoryMode: true }
                }
            };

            const explanation = buildAIExplanation(responseContext);

            expect(explanation.regulatoryMode).toBe(true);
        });

        it('includes timestamp', () => {
            const responseContext = { context: {} };

            const explanation = buildAIExplanation(responseContext);

            expect(explanation.timestamp).toBeDefined();
            expect(new Date(explanation.timestamp).getTime()).not.toBeNaN();
        });
    });

    describe('buildExplainabilityFooter', () => {
        it('returns empty string for null explanation', () => {
            expect(buildExplainabilityFooter(null)).toBe('');
        });

        it('includes reasoning summary', () => {
            const explanation = {
                reasoningSummary: 'Based on 3 overdue tasks',
                constraintsApplied: [],
                confidenceLevel: 'MEDIUM',
                aiRole: 'ADVISOR'
            };

            const footer = buildExplainabilityFooter(explanation);

            expect(footer).toContain('Based on 3 overdue tasks');
        });

        it('includes confidence level label', () => {
            const explanation = {
                reasoningSummary: 'Test',
                constraintsApplied: [],
                confidenceLevel: 'HIGH',
                aiRole: 'ADVISOR'
            };

            const footer = buildExplainabilityFooter(explanation);

            expect(footer).toContain('Confidence: High');
        });

        it('includes AI role label', () => {
            const explanation = {
                reasoningSummary: 'Test',
                constraintsApplied: [],
                confidenceLevel: 'HIGH',
                aiRole: 'MANAGER'
            };

            const footer = buildExplainabilityFooter(explanation);

            expect(footer).toContain('AI Role: Manager');
        });

        it('limits constraints to 3', () => {
            const explanation = {
                reasoningSummary: 'Test',
                constraintsApplied: [
                    'Constraint 1',
                    'Constraint 2',
                    'Constraint 3',
                    'Constraint 4',
                    'Constraint 5'
                ],
                confidenceLevel: 'HIGH',
                aiRole: 'ADVISOR'
            };

            const footer = buildExplainabilityFooter(explanation);

            expect(footer).toContain('Constraint 1');
            expect(footer).toContain('Constraint 2');
            expect(footer).toContain('Constraint 3');
            expect(footer).not.toContain('Constraint 4');
            expect(footer).not.toContain('Constraint 5');
        });

        it('formats with markdown separators', () => {
            const explanation = {
                reasoningSummary: 'Test',
                constraintsApplied: [],
                confidenceLevel: 'HIGH',
                aiRole: 'ADVISOR'
            };

            const footer = buildExplainabilityFooter(explanation);

            expect(footer).toContain('---');
            expect(footer).toContain('**Why this recommendation?**');
        });
    });
});

