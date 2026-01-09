/**
 * Recommendation Engine Unit Tests
 * 
 * Tests for AI-powered recommendation engine.
 * 
 * @module tests/unit/backend/recommendationEngine.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create recommendation engine implementation
const createRecommendationEngine = () => {
    const userPreferences = new Map();
    const userHistory = new Map();
    const items = new Map();

    return {
        // Register item for recommendations
        registerItem: async (data) => {
            const item = {
                id: data.id,
                type: data.type,
                title: data.title,
                tags: data.tags || [],
                category: data.category,
                metadata: data.metadata || {},
                popularity: data.popularity || 0,
                createdAt: new Date().toISOString()
            };
            items.set(data.id, item);
            return item;
        },

        // Track user interaction
        trackInteraction: async (userId, itemId, interactionType) => {
            const history = userHistory.get(userId) || [];
            history.push({
                itemId,
                type: interactionType, // view, click, like, complete
                timestamp: new Date().toISOString()
            });
            userHistory.set(userId, history);

            // Update item popularity
            const item = items.get(itemId);
            if (item && interactionType === 'complete') {
                item.popularity++;
                items.set(itemId, item);
            }

            return true;
        },

        // Set user preferences
        setPreferences: async (userId, preferences) => {
            userPreferences.set(userId, {
                ...userPreferences.get(userId),
                ...preferences
            });
            return userPreferences.get(userId);
        },

        // Get personalized recommendations
        getRecommendations: async (userId, options = {}) => {
            const { limit = 5, type, excludeViewed = true } = options;
            const prefs = userPreferences.get(userId) || {};
            const history = userHistory.get(userId) || [];
            const viewedIds = new Set(history.filter(h => h.type === 'view').map(h => h.itemId));

            // Score each item
            const scoredItems = [];
            for (const item of items.values()) {
                if (type && item.type !== type) continue;
                if (excludeViewed && viewedIds.has(item.id)) continue;

                let score = 0;

                // Category preference match
                if (prefs.preferredCategories?.includes(item.category)) {
                    score += 30;
                }

                // Tag preference match
                if (prefs.preferredTags) {
                    const tagMatches = item.tags.filter(t => prefs.preferredTags.includes(t)).length;
                    score += tagMatches * 10;
                }

                // Popularity boost
                score += Math.min(item.popularity * 2, 20);

                // Recency boost (items created recently)
                const ageHours = (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
                if (ageHours < 24) score += 10;
                else if (ageHours < 168) score += 5;

                scoredItems.push({ ...item, score });
            }

            return scoredItems
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        },

        // Get similar items
        getSimilar: async (itemId, limit = 5) => {
            const sourceItem = items.get(itemId);
            if (!sourceItem) throw new Error('Item not found');

            const scoredItems = [];
            for (const item of items.values()) {
                if (item.id === itemId) continue;

                let score = 0;

                // Same category
                if (item.category === sourceItem.category) score += 30;

                // Tag overlap
                const tagOverlap = item.tags.filter(t => sourceItem.tags.includes(t)).length;
                score += tagOverlap * 15;

                // Same type
                if (item.type === sourceItem.type) score += 10;

                if (score > 0) {
                    scoredItems.push({ ...item, similarityScore: score });
                }
            }

            return scoredItems
                .sort((a, b) => b.similarityScore - a.similarityScore)
                .slice(0, limit);
        },

        // Get trending items
        getTrending: async (options = {}) => {
            const { limit = 10, type, timeWindow = 24 } = options; // hours

            const cutoff = Date.now() - timeWindow * 60 * 60 * 1000;
            const interactionCounts = new Map();

            // Count recent interactions per item
            for (const history of userHistory.values()) {
                for (const interaction of history) {
                    if (new Date(interaction.timestamp).getTime() > cutoff) {
                        const count = interactionCounts.get(interaction.itemId) || 0;
                        interactionCounts.set(interaction.itemId, count + 1);
                    }
                }
            }

            const trending = [];
            for (const [itemId, count] of interactionCounts.entries()) {
                const item = items.get(itemId);
                if (item && (!type || item.type === type)) {
                    trending.push({ ...item, trendingScore: count });
                }
            }

            return trending
                .sort((a, b) => b.trendingScore - a.trendingScore)
                .slice(0, limit);
        },

        // Get user's viewing history
        getUserHistory: async (userId, limit = 20) => {
            const history = userHistory.get(userId) || [];
            return history.slice(-limit).reverse();
        },

        // Clear for testing
        clear: () => {
            userPreferences.clear();
            userHistory.clear();
            items.clear();
        }
    };
};

describe('RecommendationEngine', () => {
    let engine;

    beforeEach(() => {
        engine = createRecommendationEngine();
    });

    describe('Item Registration', () => {
        it('should register items', async () => {
            const item = await engine.registerItem({
                id: 'article-1',
                type: 'article',
                title: 'Getting Started with React',
                tags: ['react', 'frontend', 'tutorial'],
                category: 'programming'
            });

            expect(item.id).toBe('article-1');
            expect(item.tags).toContain('react');
        });
    });

    describe('Personalized Recommendations', () => {
        beforeEach(async () => {
            await engine.registerItem({ id: 'a1', type: 'article', title: 'React', tags: ['react'], category: 'frontend' });
            await engine.registerItem({ id: 'a2', type: 'article', title: 'Vue', tags: ['vue'], category: 'frontend' });
            await engine.registerItem({ id: 'a3', type: 'article', title: 'Node', tags: ['node'], category: 'backend' });
            await engine.registerItem({ id: 'a4', type: 'video', title: 'CSS', tags: ['css'], category: 'frontend' });
        });

        it('should recommend based on user preferences', async () => {
            await engine.setPreferences('user-1', {
                preferredCategories: ['frontend'],
                preferredTags: ['react']
            });

            const recommendations = await engine.getRecommendations('user-1');

            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations[0].id).toBe('a1'); // React article should rank highest
        });

        it('should exclude viewed items', async () => {
            await engine.trackInteraction('user-1', 'a1', 'view');

            const recommendations = await engine.getRecommendations('user-1');

            expect(recommendations.some(r => r.id === 'a1')).toBe(false);
        });

        it('should filter by type', async () => {
            const recommendations = await engine.getRecommendations('user-1', { type: 'video' });

            expect(recommendations.every(r => r.type === 'video')).toBe(true);
        });
    });

    describe('Similar Items', () => {
        beforeEach(async () => {
            await engine.registerItem({ id: 'a1', type: 'article', title: 'React Hooks', tags: ['react', 'hooks'], category: 'frontend' });
            await engine.registerItem({ id: 'a2', type: 'article', title: 'React Context', tags: ['react', 'context'], category: 'frontend' });
            await engine.registerItem({ id: 'a3', type: 'article', title: 'Node Express', tags: ['node', 'express'], category: 'backend' });
        });

        it('should find similar items', async () => {
            const similar = await engine.getSimilar('a1');

            expect(similar.length).toBeGreaterThan(0);
            expect(similar[0].id).toBe('a2'); // Same category and shares 'react' tag
        });

        it('should rank by similarity score', async () => {
            const similar = await engine.getSimilar('a1');

            for (let i = 1; i < similar.length; i++) {
                expect(similar[i - 1].similarityScore).toBeGreaterThanOrEqual(similar[i].similarityScore);
            }
        });
    });

    describe('Trending Items', () => {
        beforeEach(async () => {
            await engine.registerItem({ id: 'a1', type: 'article', title: 'Hot Topic', category: 'news' });
            await engine.registerItem({ id: 'a2', type: 'article', title: 'Regular Topic', category: 'news' });
        });

        it('should return trending items based on interactions', async () => {
            // Simulate many users viewing a1
            for (let i = 0; i < 10; i++) {
                await engine.trackInteraction(`user-${i}`, 'a1', 'view');
            }

            // Only 2 users view a2
            await engine.trackInteraction('user-1', 'a2', 'view');
            await engine.trackInteraction('user-2', 'a2', 'view');

            const trending = await engine.getTrending();

            expect(trending[0].id).toBe('a1');
            expect(trending[0].trendingScore).toBe(10);
        });
    });

    describe('User History', () => {
        it('should track and retrieve user history', async () => {
            await engine.registerItem({ id: 'a1', type: 'article', title: 'Article 1', category: 'tech' });

            await engine.trackInteraction('user-1', 'a1', 'view');
            await engine.trackInteraction('user-1', 'a1', 'like');
            await engine.trackInteraction('user-1', 'a1', 'complete');

            const history = await engine.getUserHistory('user-1');

            expect(history).toHaveLength(3);
            expect(history[0].type).toBe('complete'); // Most recent first
        });
    });

    describe('Popularity Tracking', () => {
        it('should increase popularity on completion', async () => {
            await engine.registerItem({ id: 'a1', type: 'article', title: 'Test', category: 'tech' });

            await engine.trackInteraction('user-1', 'a1', 'complete');
            await engine.trackInteraction('user-2', 'a1', 'complete');

            const recommendations = await engine.getRecommendations('user-3', { limit: 10, excludeViewed: false });
            const item = recommendations.find(r => r.id === 'a1');

            expect(item.popularity).toBe(2);
        });
    });
});
