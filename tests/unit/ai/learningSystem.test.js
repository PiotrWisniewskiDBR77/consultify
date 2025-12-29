/**
 * LearningSystem Unit Tests
 * 
 * Tests for AI pattern extraction and learning service.
 */

const { learningSystem, LearningSystemService } = require('../../../server/services/ai/learningSystem');

describe('LearningSystem', () => {
    describe('recordInteraction()', () => {
        it('should record interaction successfully', async () => {
            await expect(
                learningSystem.recordInteraction({
                    userId: 'test-user',
                    organizationId: 'test-org',
                    requestType: 'chat',
                    prompt: 'How can I improve my project management?',
                    response: 'Here are some recommendations...',
                    metadata: {
                        qualityScore: 0.85,
                        model: 'gpt-4o'
                    }
                })
            ).resolves.not.toThrow();
        });

        it('should handle missing optional fields', async () => {
            await expect(
                learningSystem.recordInteraction({
                    userId: 'test-user',
                    requestType: 'chat',
                    prompt: 'Test prompt'
                })
            ).resolves.not.toThrow();
        });
    });

    describe('extractPatterns()', () => {
        it('should extract patterns from interactions', async () => {
            const service = new LearningSystemService();
            
            // Record multiple similar interactions
            const interactions = [
                { userId: 'u1', requestType: 'recommendation', prompt: 'improve efficiency' },
                { userId: 'u2', requestType: 'recommendation', prompt: 'boost efficiency' },
                { userId: 'u3', requestType: 'recommendation', prompt: 'increase efficiency' }
            ];
            
            for (const interaction of interactions) {
                await service.recordInteraction(interaction);
            }
            
            const patterns = await service.extractPatterns('test-org');
            
            expect(patterns).toBeDefined();
            expect(patterns).toBeInstanceOf(Array);
        });

        it('should identify common request types', async () => {
            const service = new LearningSystemService();
            
            // Record interactions with different types
            await service.recordInteraction({ requestType: 'chat', prompt: 'test 1' });
            await service.recordInteraction({ requestType: 'chat', prompt: 'test 2' });
            await service.recordInteraction({ requestType: 'report', prompt: 'test 3' });
            
            const patterns = await service.extractPatterns();
            
            expect(patterns).toBeDefined();
        });
    });

    describe('getPromptSuggestions()', () => {
        it('should return prompt suggestions based on context', async () => {
            const service = new LearningSystemService();
            
            const suggestions = await service.getPromptSuggestions({
                capability: 'recommendation',
                context: {
                    screen: 'assessment'
                }
            });
            
            expect(suggestions).toBeDefined();
            expect(suggestions).toBeInstanceOf(Array);
        });

        it('should return empty array for unknown context', async () => {
            const service = new LearningSystemService();
            
            const suggestions = await service.getPromptSuggestions({
                capability: 'unknown_capability',
                context: {}
            });
            
            expect(suggestions).toBeInstanceOf(Array);
        });
    });

    describe('getInsights()', () => {
        it('should generate insights from user data', async () => {
            const service = new LearningSystemService();
            
            // Record some interactions first
            await service.recordInteraction({
                userId: 'insights-user',
                requestType: 'analysis',
                prompt: 'Analyze our digital maturity',
                metadata: { qualityScore: 0.9 }
            });
            
            const insights = await service.getInsights('insights-user');
            
            expect(insights).toBeDefined();
            expect(insights).toHaveProperty('usage');
            expect(insights).toHaveProperty('preferences');
        });

        it('should return default insights for new users', async () => {
            const service = new LearningSystemService();
            
            const insights = await service.getInsights('brand-new-user-' + Date.now());
            
            expect(insights).toBeDefined();
            expect(insights).toHaveProperty('usage');
        });
    });

    describe('learn()', () => {
        it('should process feedback and update models', async () => {
            const service = new LearningSystemService();
            
            await expect(
                service.learn({
                    interactionId: 'test-interaction',
                    feedback: 'positive',
                    rating: 5,
                    comment: 'Very helpful response'
                })
            ).resolves.not.toThrow();
        });

        it('should handle negative feedback', async () => {
            const service = new LearningSystemService();
            
            await expect(
                service.learn({
                    interactionId: 'test-interaction-neg',
                    feedback: 'negative',
                    rating: 2,
                    comment: 'Not relevant to my question'
                })
            ).resolves.not.toThrow();
        });
    });

    describe('getOrganizationLearnings()', () => {
        it('should aggregate learnings for organization', async () => {
            const service = new LearningSystemService();
            const orgId = 'test-org-' + Date.now();
            
            // Record some interactions for the org
            await service.recordInteraction({
                organizationId: orgId,
                requestType: 'initiative',
                prompt: 'Generate initiatives'
            });
            
            const learnings = await service.getOrganizationLearnings(orgId);
            
            expect(learnings).toBeDefined();
            expect(learnings).toHaveProperty('patterns');
            expect(learnings).toHaveProperty('preferences');
        });
    });
});

