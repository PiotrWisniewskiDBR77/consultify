/**
 * AI Explainability Service Unit Tests
 * Tests AI decision explanations, reasoning traces, and transparency
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// AI Explainability implementation
const createAIExplainabilityService = () => {
    const explanations = [];
    let counter = 0;

    return {
        explain: (decision) => {
            const explanation = {
                id: `exp-${Date.now()}-${++counter}`,
                decisionId: decision.id,
                confidence: decision.confidence || 0,
                factors: decision.factors || [],
                reasoning: decision.reasoning || [],
                model: decision.model || 'gpt-4',
                timestamp: new Date()
            };
            explanations.push(explanation);
            return explanation;
        },

        getFactorBreakdown: (decisionId) => {
            const explanation = explanations.find(e => e.decisionId === decisionId);
            if (!explanation) return null;

            return explanation.factors.map(factor => ({
                name: factor.name,
                weight: factor.weight,
                contribution: factor.contribution,
                description: factor.description
            }));
        },

        getReasoningTrace: (decisionId) => {
            const explanation = explanations.find(e => e.decisionId === decisionId);
            if (!explanation) return [];

            return explanation.reasoning.map((step, index) => ({
                step: index + 1,
                action: step.action,
                input: step.input,
                output: step.output,
                confidence: step.confidence
            }));
        },

        generateHumanReadable: (decisionId) => {
            const explanation = explanations.find(e => e.decisionId === decisionId);
            if (!explanation) return null;

            const topFactors = explanation.factors
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 3)
                .map(f => f.name)
                .join(', ');

            return {
                summary: `Decision made with ${Math.round(explanation.confidence * 100)}% confidence`,
                topFactors,
                stepsCount: explanation.reasoning.length
            };
        },

        getConfidenceLevel: (confidence) => {
            if (confidence >= 0.9) return 'very_high';
            if (confidence >= 0.7) return 'high';
            if (confidence >= 0.5) return 'medium';
            if (confidence >= 0.3) return 'low';
            return 'very_low';
        },

        compareDecisions: (decisionId1, decisionId2) => {
            const exp1 = explanations.find(e => e.decisionId === decisionId1);
            const exp2 = explanations.find(e => e.decisionId === decisionId2);

            if (!exp1 || !exp2) return null;

            return {
                confidenceDiff: exp1.confidence - exp2.confidence,
                factorsOverlap: exp1.factors.filter(f1 =>
                    exp2.factors.some(f2 => f2.name === f1.name)
                ).length,
                sameModel: exp1.model === exp2.model
            };
        }
    };
};

describe('AIExplainabilityService', () => {
    let explainService;

    beforeEach(() => {
        explainService = createAIExplainabilityService();
    });

    describe('Decision Explanation', () => {
        it('should explain decision', () => {
            const explanation = explainService.explain({
                id: 'decision-1',
                confidence: 0.95,
                factors: [
                    { name: 'user_history', weight: 0.4, contribution: 0.38 },
                    { name: 'context', weight: 0.3, contribution: 0.28 }
                ]
            });

            expect(explanation.id).toBeDefined();
            expect(explanation.confidence).toBe(0.95);
            expect(explanation.factors).toHaveLength(2);
        });

        it('should track reasoning steps', () => {
            const explanation = explainService.explain({
                id: 'decision-2',
                reasoning: [
                    { action: 'analyze', input: 'query', output: 'parsed', confidence: 0.9 },
                    { action: 'retrieve', input: 'context', output: 'data', confidence: 0.85 },
                    { action: 'generate', input: 'prompt', output: 'response', confidence: 0.92 }
                ]
            });

            expect(explanation.reasoning).toHaveLength(3);
        });
    });

    describe('Factor Breakdown', () => {
        it('should get factor breakdown', () => {
            explainService.explain({
                id: 'decision-1',
                factors: [
                    { name: 'relevance', weight: 0.5, contribution: 0.45, description: 'Query relevance' },
                    { name: 'recency', weight: 0.3, contribution: 0.25, description: 'Data freshness' }
                ]
            });

            const breakdown = explainService.getFactorBreakdown('decision-1');
            expect(breakdown).toHaveLength(2);
            expect(breakdown[0].name).toBe('relevance');
        });
    });

    describe('Reasoning Trace', () => {
        it('should get reasoning trace', () => {
            explainService.explain({
                id: 'decision-1',
                reasoning: [
                    { action: 'step1', input: 'a', output: 'b', confidence: 0.9 },
                    { action: 'step2', input: 'b', output: 'c', confidence: 0.95 }
                ]
            });

            const trace = explainService.getReasoningTrace('decision-1');
            expect(trace).toHaveLength(2);
            expect(trace[0].step).toBe(1);
            expect(trace[1].step).toBe(2);
        });
    });

    describe('Human Readable', () => {
        it('should generate human readable summary', () => {
            explainService.explain({
                id: 'decision-1',
                confidence: 0.87,
                factors: [
                    { name: 'factor1', weight: 0.5 },
                    { name: 'factor2', weight: 0.3 }
                ],
                reasoning: [{}, {}, {}]
            });

            const summary = explainService.generateHumanReadable('decision-1');
            expect(summary.summary).toContain('87%');
            expect(summary.stepsCount).toBe(3);
        });
    });

    describe('Confidence Levels', () => {
        it('should categorize confidence levels', () => {
            expect(explainService.getConfidenceLevel(0.95)).toBe('very_high');
            expect(explainService.getConfidenceLevel(0.75)).toBe('high');
            expect(explainService.getConfidenceLevel(0.55)).toBe('medium');
            expect(explainService.getConfidenceLevel(0.35)).toBe('low');
            expect(explainService.getConfidenceLevel(0.15)).toBe('very_low');
        });
    });

    describe('Decision Comparison', () => {
        it('should compare two decisions', () => {
            explainService.explain({
                id: 'd1',
                confidence: 0.9,
                factors: [{ name: 'f1' }, { name: 'f2' }],
                model: 'gpt-4'
            });
            explainService.explain({
                id: 'd2',
                confidence: 0.8,
                factors: [{ name: 'f1' }, { name: 'f3' }],
                model: 'gpt-4'
            });

            const comparison = explainService.compareDecisions('d1', 'd2');
            expect(comparison.confidenceDiff).toBeCloseTo(0.1, 1);
            expect(comparison.factorsOverlap).toBe(1);
            expect(comparison.sameModel).toBe(true);
        });
    });
});
