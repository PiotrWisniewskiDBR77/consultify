/**
 * Feedback Service Unit Tests
 * Tests feedback submission, retrieval, and analytics
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Feedback Service implementation
const createFeedbackService = () => {
    const feedbacks = new Map();
    let counter = 0;

    return {
        submit: (userId, data) => {
            const id = `fb-${Date.now()}-${++counter}`;
            const feedback = {
                id,
                userId,
                rating: data.rating,
                comment: data.comment,
                category: data.category || 'general',
                context: data.context || {},
                status: 'pending',
                createdAt: new Date()
            };
            feedbacks.set(id, feedback);
            return feedback;
        },

        get: (id) => feedbacks.get(id) || null,

        list: (filters = {}) => {
            let result = Array.from(feedbacks.values());
            if (filters.userId) result = result.filter(f => f.userId === filters.userId);
            if (filters.category) result = result.filter(f => f.category === filters.category);
            if (filters.status) result = result.filter(f => f.status === filters.status);
            if (filters.minRating) result = result.filter(f => f.rating >= filters.minRating);
            return result.sort((a, b) => b.createdAt - a.createdAt);
        },

        updateStatus: (id, status) => {
            const feedback = feedbacks.get(id);
            if (!feedback) throw new Error('Feedback not found');
            feedback.status = status;
            feedback.updatedAt = new Date();
            return feedback;
        },

        getStats: () => {
            const all = Array.from(feedbacks.values());
            const ratings = all.map(f => f.rating).filter(r => r !== undefined);
            const avgRating = ratings.length > 0
                ? ratings.reduce((a, b) => a + b, 0) / ratings.length
                : 0;

            const byCategory = all.reduce((acc, f) => {
                acc[f.category] = (acc[f.category] || 0) + 1;
                return acc;
            }, {});

            return {
                total: all.length,
                averageRating: Math.round(avgRating * 10) / 10,
                byCategory,
                pending: all.filter(f => f.status === 'pending').length,
                resolved: all.filter(f => f.status === 'resolved').length
            };
        },

        getNPS: () => {
            const all = Array.from(feedbacks.values());
            const withRating = all.filter(f => f.rating !== undefined);
            if (withRating.length === 0) return 0;

            const promoters = withRating.filter(f => f.rating >= 9).length;
            const detractors = withRating.filter(f => f.rating <= 6).length;

            return Math.round(((promoters - detractors) / withRating.length) * 100);
        },

        delete: (id) => feedbacks.delete(id)
    };
};

describe('FeedbackService', () => {
    let feedbackService;

    beforeEach(() => {
        feedbackService = createFeedbackService();
    });

    describe('Feedback Submission', () => {
        it('should submit feedback', () => {
            const feedback = feedbackService.submit('user-1', {
                rating: 5,
                comment: 'Great service!'
            });

            expect(feedback.id).toBeDefined();
            expect(feedback.rating).toBe(5);
        });

        it('should set default category', () => {
            const feedback = feedbackService.submit('user-1', { rating: 4 });
            expect(feedback.category).toBe('general');
        });

        it('should support different categories', () => {
            const feature = feedbackService.submit('user-1', { rating: 5, category: 'feature' });
            const bug = feedbackService.submit('user-1', { rating: 2, category: 'bug' });

            expect(feature.category).toBe('feature');
            expect(bug.category).toBe('bug');
        });
    });

    describe('Feedback Retrieval', () => {
        it('should list all feedback', () => {
            feedbackService.submit('user-1', { rating: 5 });
            feedbackService.submit('user-2', { rating: 4 });

            const list = feedbackService.list();
            expect(list).toHaveLength(2);
        });

        it('should filter by user', () => {
            feedbackService.submit('user-1', { rating: 5 });
            feedbackService.submit('user-2', { rating: 4 });

            const userFeedback = feedbackService.list({ userId: 'user-1' });
            expect(userFeedback).toHaveLength(1);
        });

        it('should filter by category', () => {
            feedbackService.submit('user-1', { rating: 5, category: 'feature' });
            feedbackService.submit('user-1', { rating: 3, category: 'bug' });

            const bugs = feedbackService.list({ category: 'bug' });
            expect(bugs).toHaveLength(1);
        });
    });

    describe('Status Updates', () => {
        it('should update feedback status', () => {
            const feedback = feedbackService.submit('user-1', { rating: 5 });
            feedbackService.updateStatus(feedback.id, 'resolved');

            expect(feedbackService.get(feedback.id).status).toBe('resolved');
        });
    });

    describe('Statistics', () => {
        it('should calculate stats', () => {
            feedbackService.submit('user-1', { rating: 5 });
            feedbackService.submit('user-2', { rating: 4 });
            feedbackService.submit('user-3', { rating: 3 });

            const stats = feedbackService.getStats();

            expect(stats.total).toBe(3);
            expect(stats.averageRating).toBe(4);
        });

        it('should calculate NPS', () => {
            feedbackService.submit('user-1', { rating: 10 }); // Promoter
            feedbackService.submit('user-2', { rating: 9 });  // Promoter
            feedbackService.submit('user-3', { rating: 5 });  // Detractor

            const nps = feedbackService.getNPS();
            expect(nps).toBe(33); // (2-1)/3 * 100 = 33
        });
    });
});
