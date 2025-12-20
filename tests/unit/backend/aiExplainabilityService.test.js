/**
 * AI Explainability Service Unit Tests
 * 
 * Tests for the AI Trust & Explainability Layer
 */

const AIExplainabilityService = require('../../../server/services/aiExplainabilityService');

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

        it('penalizes conflicting signals (many blockers AND many pending decisions)', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        blockers: [1, 2, 3, 4, 5] // 5 blockers
                    }
                },
                execution: {
                    pendingDecisions: [1, 2, 3, 4, 5] // 5 pending decisions
                },
                project: { projectId: 'proj1' }
            };
            // Even with project data, conflicting signals should lower confidence
            const result = AIExplainabilityService.computeConfidenceLevel(context);
            expect(['LOW', 'MEDIUM']).toContain(result);
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

        it('includes pending decisions in reasoning', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        decisions: { pendingCount: 2 }
                    }
                }
            };
            const result = AIExplainabilityService.buildReasoningSummary(context);
            expect(result).toContain('2 pending decision(s)');
        });

        it('includes phase information', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        phase: { name: 'Execution' }
                    }
                }
            };
            const result = AIExplainabilityService.buildReasoningSummary(context);
            expect(result).toContain('current phase: Execution');
        });

        it('includes project memory count when provided', () => {
            const context = {};
            const options = { projectMemory: { memoryCount: 5 } };
            const result = AIExplainabilityService.buildReasoningSummary(context, options);
            expect(result).toContain('5 project memory item(s) consulted');
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

        it('includes phase gate constraint', () => {
            const context = {
                pmo: {
                    healthSnapshot: {
                        phase: { name: 'Execution' }
                    }
                }
            };
            const result = AIExplainabilityService.extractConstraintsApplied(context, {}, 'ADVISOR');
            expect(result).toContain('Phase Gate: Execution');
        });

        it('includes regulatory mode constraint', () => {
            const context = { regulatoryMode: true };
            const result = AIExplainabilityService.extractConstraintsApplied(context, {}, 'ADVISOR');
            expect(result).toContain('Regulatory compliance mode active');
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

        it('returns projectMemoryCount from options', () => {
            const options = { projectMemory: { memoryCount: 7 } };
            const result = AIExplainabilityService.identifyDataUsed({}, options);
            expect(result.projectMemoryCount).toBe(7);
        });

        it('returns empty externalSources when internet disabled', () => {
            const result = AIExplainabilityService.identifyDataUsed({});
            expect(result.externalSources).toEqual([]);
        });

        it('returns external sources when internet enabled', () => {
            const context = {
                external: {
                    internetEnabled: true,
                    fetchedData: { webSearch: true, news: true }
                }
            };
            const result = AIExplainabilityService.identifyDataUsed(context);
            expect(result.externalSources).toContain('Web Search');
            expect(result.externalSources).toContain('News');
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
            expect(result).toHaveProperty('regulatoryMode');
            expect(result).toHaveProperty('confidenceLevel');
            expect(result).toHaveProperty('reasoningSummary');
            expect(result).toHaveProperty('dataUsed');
            expect(result).toHaveProperty('constraintsApplied');
            expect(result).toHaveProperty('timestamp');
        });

        it('includes all required fields in correct format', () => {
            const result = AIExplainabilityService.buildAIExplanation({});

            expect(['ADVISOR', 'MANAGER', 'OPERATOR']).toContain(result.aiRole);
            expect(typeof result.regulatoryMode).toBe('boolean');
            expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.confidenceLevel);
            expect(typeof result.reasoningSummary).toBe('string');
            expect(result.dataUsed).toHaveProperty('projectData');
            expect(result.dataUsed).toHaveProperty('projectMemoryCount');
            expect(result.dataUsed).toHaveProperty('externalSources');
            expect(Array.isArray(result.constraintsApplied)).toBe(true);
        });

        it('timestamp is ISO 8601 format', () => {
            const result = AIExplainabilityService.buildAIExplanation({});
            const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
            expect(result.timestamp).toMatch(isoRegex);
        });

        it('maps orchestrator roles to project roles correctly', () => {
            expect(AIExplainabilityService._mapOrchestratorRoleToProjectRole('ADVISOR')).toBe('ADVISOR');
            expect(AIExplainabilityService._mapOrchestratorRoleToProjectRole('PMO_MANAGER')).toBe('MANAGER');
            expect(AIExplainabilityService._mapOrchestratorRoleToProjectRole('EXECUTOR')).toBe('OPERATOR');
            expect(AIExplainabilityService._mapOrchestratorRoleToProjectRole('EDUCATOR')).toBe('ADVISOR');
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

        it('shows max 3 constraints', () => {
            const explanation = {
                aiRole: 'ADVISOR',
                confidenceLevel: 'HIGH',
                reasoningSummary: 'Test',
                constraintsApplied: [
                    'Constraint 1',
                    'Constraint 2',
                    'Constraint 3',
                    'Constraint 4',
                    'Constraint 5'
                ]
            };

            const result = AIExplainabilityService.buildExplainabilityFooter(explanation);

            // Should show only first 3 constraints
            expect(result).toContain('Constraint 1');
            expect(result).toContain('Constraint 2');
            expect(result).toContain('Constraint 3');
            expect(result).not.toContain('Constraint 4');
        });

        it('does not expose raw internals', () => {
            const explanation = {
                aiRole: 'MANAGER',
                confidenceLevel: 'HIGH',
                reasoningSummary: 'Based on project data',
                constraintsApplied: [],
                dataUsed: {
                    projectData: true,
                    projectMemoryCount: 5,
                    externalSources: ['API']
                }
            };

            const result = AIExplainabilityService.buildExplainabilityFooter(explanation);

            // Should not contain raw object notation
            expect(result).not.toContain('projectData');
            expect(result).not.toContain('projectMemoryCount');
            expect(result).not.toContain('externalSources');
        });
    });

    describe('Internal Helpers', () => {
        describe('_countPopulatedLayers', () => {
            it('returns 0 for null context', () => {
                const result = AIExplainabilityService._countPopulatedLayers(null);
                expect(result).toBe(0);
            });

            it('counts populated layers correctly', () => {
                const context = {
                    platform: { role: 'ADMIN' },
                    organization: { organizationId: 'org1' },
                    project: { projectId: 'proj1' },
                    execution: { userTasks: [] },
                    knowledge: { data: 'test' },
                    external: { enabled: true }
                };
                const result = AIExplainabilityService._countPopulatedLayers(context);
                expect(result).toBe(6); // All 6 layers
            });
        });

        describe('_getBlockerCount', () => {
            it('returns 0 when no blockers', () => {
                const result = AIExplainabilityService._getBlockerCount({});
                expect(result).toBe(0);
            });

            it('counts blockers from PMO health snapshot', () => {
                const context = {
                    pmo: {
                        healthSnapshot: {
                            blockers: [1, 2, 3]
                        }
                    }
                };
                const result = AIExplainabilityService._getBlockerCount(context);
                expect(result).toBe(3);
            });

            it('counts blockers from execution context', () => {
                const context = {
                    execution: {
                        blockers: [1, 2]
                    }
                };
                const result = AIExplainabilityService._getBlockerCount(context);
                expect(result).toBe(2);
            });

            it('sums blockers from both sources', () => {
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
                const result = AIExplainabilityService._getBlockerCount(context);
                expect(result).toBe(5);
            });
        });
    });
});

// Sample AIExplanation JSON output for documentation
describe('Sample Output', () => {
    it('generates sample AIExplanation matching the spec', () => {
        const responseContext = {
            role: 'ADVISOR',
            context: {
                pmo: {
                    healthSnapshot: {
                        phase: { name: 'Execution' },
                        tasks: { overdueCount: 3 },
                        decisions: { pendingCount: 1 },
                        blockers: []
                    }
                },
                project: { projectId: 'sample-project' },
                platform: { role: 'PROJECT_MANAGER' },
                organization: { organizationId: 'sample-org' },
                execution: { userTasks: [], pendingDecisions: [] },
                knowledge: { previousDecisions: [] },
                external: {}
            },
            policy: { policyLevel: 'ADVISORY' },
            projectMemory: { memoryCount: 5 }
        };

        const explanation = AIExplainabilityService.buildAIExplanation(responseContext);

        // Log sample for documentation
        console.log('\n========== SAMPLE AIExplanation JSON ==========');
        console.log(JSON.stringify(explanation, null, 2));
        console.log('================================================\n');

        // Verify structure matches spec
        expect(explanation.aiRole).toBe('ADVISOR');
        expect(explanation.regulatoryMode).toBe(false);
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(explanation.confidenceLevel);
        expect(explanation.reasoningSummary).toContain('overdue');
        expect(explanation.dataUsed.projectData).toBe(true);
        expect(explanation.dataUsed.projectMemoryCount).toBe(5);
        expect(Array.isArray(explanation.constraintsApplied)).toBe(true);
        expect(typeof explanation.timestamp).toBe('string');
    });
});
