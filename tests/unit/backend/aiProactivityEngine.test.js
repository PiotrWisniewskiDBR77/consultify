/**
 * AI Proactivity Engine Unit Tests
 * Tests proactive suggestions, learning, and personalization
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// AI Proactivity Engine implementation
const createAIProactivityEngine = () => {
    const suggestions = [];
    const feedback = [];
    const userPatterns = new Map();
    let counter = 0;

    return {
        suggest: (context) => {
            const suggestion = {
                id: `sugg-${Date.now()}-${++counter}`,
                action: context.suggestedAction || 'remind',
                priority: context.priority || 'medium',
                reason: context.reason || 'Pattern detected',
                confidence: context.confidence || 0.8,
                userId: context.userId,
                createdAt: new Date()
            };
            suggestions.push(suggestion);
            return suggestion;
        },

        getSuggestions: (userId, filters = {}) => {
            let userSuggestions = suggestions.filter(s => s.userId === userId);
            if (filters.priority) {
                userSuggestions = userSuggestions.filter(s => s.priority === filters.priority);
            }
            if (filters.minConfidence) {
                userSuggestions = userSuggestions.filter(s => s.confidence >= filters.minConfidence);
            }
            return userSuggestions.sort((a, b) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });
        },

        recordFeedback: (suggestionId, accepted, reason = null) => {
            const fb = {
                suggestionId,
                accepted,
                reason,
                timestamp: new Date()
            };
            feedback.push(fb);

            // Update user patterns based on feedback
            const suggestion = suggestions.find(s => s.id === suggestionId);
            if (suggestion && suggestion.userId) {
                const patterns = userPatterns.get(suggestion.userId) || { accepted: 0, rejected: 0 };
                if (accepted) {
                    patterns.accepted++;
                } else {
                    patterns.rejected++;
                }
                userPatterns.set(suggestion.userId, patterns);
            }

            return fb;
        },

        getAcceptanceRate: (userId) => {
            const patterns = userPatterns.get(userId);
            if (!patterns || (patterns.accepted + patterns.rejected === 0)) return 0;
            return patterns.accepted / (patterns.accepted + patterns.rejected);
        },

        analyzePatterns: (userId) => {
            const userFeedback = feedback.filter(f => {
                const sugg = suggestions.find(s => s.id === f.suggestionId);
                return sugg && sugg.userId === userId;
            });

            const acceptedActions = userFeedback
                .filter(f => f.accepted)
                .map(f => suggestions.find(s => s.id === f.suggestionId)?.action)
                .filter(Boolean);

            const actionCounts = acceptedActions.reduce((acc, action) => {
                acc[action] = (acc[action] || 0) + 1;
                return acc;
            }, {});

            return {
                totalSuggestions: suggestions.filter(s => s.userId === userId).length,
                totalFeedback: userFeedback.length,
                preferredActions: Object.entries(actionCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([action]) => action)
            };
        },

        adjustConfidence: (userId, baseConfidence) => {
            const acceptanceRate = this.getAcceptanceRate?.(userId) || 0.5;
            // Adjust based on user's historical acceptance
            return baseConfidence * (0.5 + acceptanceRate * 0.5);
        }
    };
};

describe('AIProactivityEngine', () => {
    let engine;

    beforeEach(() => {
        engine = createAIProactivityEngine();
    });

    describe('Suggestion Generation', () => {
        it('should generate suggestion', () => {
            const suggestion = engine.suggest({
                userId: 'user-1',
                suggestedAction: 'remind',
                priority: 'high',
                reason: 'Task deadline approaching'
            });

            expect(suggestion.id).toBeDefined();
            expect(suggestion.action).toBe('remind');
            expect(suggestion.priority).toBe('high');
        });

        it('should use default values', () => {
            const suggestion = engine.suggest({ userId: 'user-1' });

            expect(suggestion.priority).toBe('medium');
            expect(suggestion.confidence).toBe(0.8);
        });
    });

    describe('Suggestion Retrieval', () => {
        it('should get user suggestions', () => {
            engine.suggest({ userId: 'user-1', priority: 'high' });
            engine.suggest({ userId: 'user-1', priority: 'low' });
            engine.suggest({ userId: 'user-2', priority: 'high' });

            const suggestions = engine.getSuggestions('user-1');
            expect(suggestions).toHaveLength(2);
        });

        it('should filter by priority', () => {
            engine.suggest({ userId: 'user-1', priority: 'high' });
            engine.suggest({ userId: 'user-1', priority: 'low' });

            const highPriority = engine.getSuggestions('user-1', { priority: 'high' });
            expect(highPriority).toHaveLength(1);
        });

        it('should sort by priority', () => {
            engine.suggest({ userId: 'user-1', priority: 'low' });
            engine.suggest({ userId: 'user-1', priority: 'high' });
            engine.suggest({ userId: 'user-1', priority: 'medium' });

            const sorted = engine.getSuggestions('user-1');
            expect(sorted[0].priority).toBe('high');
            expect(sorted[1].priority).toBe('medium');
        });
    });

    describe('Feedback Learning', () => {
        it('should record feedback', () => {
            const suggestion = engine.suggest({ userId: 'user-1' });
            const fb = engine.recordFeedback(suggestion.id, true, 'Helpful');

            expect(fb.accepted).toBe(true);
            expect(fb.reason).toBe('Helpful');
        });

        it('should track acceptance rate', () => {
            const s1 = engine.suggest({ userId: 'user-1' });
            const s2 = engine.suggest({ userId: 'user-1' });
            const s3 = engine.suggest({ userId: 'user-1' });
            const s4 = engine.suggest({ userId: 'user-1' });

            engine.recordFeedback(s1.id, true);
            engine.recordFeedback(s2.id, true);
            engine.recordFeedback(s3.id, true);
            engine.recordFeedback(s4.id, false);

            const rate = engine.getAcceptanceRate('user-1');
            expect(rate).toBe(0.75);
        });
    });

    describe('Pattern Analysis', () => {
        it('should analyze user patterns', () => {
            const s1 = engine.suggest({ userId: 'user-1', suggestedAction: 'remind' });
            const s2 = engine.suggest({ userId: 'user-1', suggestedAction: 'remind' });
            const s3 = engine.suggest({ userId: 'user-1', suggestedAction: 'summarize' });

            engine.recordFeedback(s1.id, true);
            engine.recordFeedback(s2.id, true);
            engine.recordFeedback(s3.id, false);

            const patterns = engine.analyzePatterns('user-1');
            expect(patterns.preferredActions).toContain('remind');
        });
    });
});
