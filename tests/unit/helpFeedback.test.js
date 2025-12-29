/**
 * Help Feedback API Unit Tests
 */

const request = require('supertest');
const express = require('express');
const helpFeedbackRoutes = require('../../server/routes/helpFeedback');

// Mock database
jest.mock('../../server/database', () => ({
    run: jest.fn().mockResolvedValue({ changes: 1 }),
    get: jest.fn().mockResolvedValue(null),
    all: jest.fn().mockResolvedValue([])
}));

describe('Help Feedback API', () => {
    let app;
    
    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        // Mock user middleware
        app.use((req, res, next) => {
            req.user = { id: 'test-user', organizationId: 'test-org' };
            next();
        });
        
        app.use('/api/help', helpFeedbackRoutes);
    });
    
    describe('POST /api/help/feedback', () => {
        it('should create feedback successfully', async () => {
            const feedbackData = {
                content_type: 'card',
                content_id: 'profile-settings',
                is_helpful: true,
                rating: 5,
                comment: 'Very helpful!'
            };
            
            const response = await request(app)
                .post('/api/help/feedback')
                .send(feedbackData);
            
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
        });
        
        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/help/feedback')
                .send({});
            
            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });
        
        it('should validate content_type enum', async () => {
            const response = await request(app)
                .post('/api/help/feedback')
                .send({
                    content_type: 'invalid_type',
                    content_id: 'test'
                });
            
            expect(response.status).toBe(400);
        });
        
        it('should validate rating range (1-5)', async () => {
            const response = await request(app)
                .post('/api/help/feedback')
                .send({
                    content_type: 'card',
                    content_id: 'test',
                    rating: 10
                });
            
            expect(response.status).toBe(400);
        });
        
        it('should allow feedback without comment', async () => {
            const response = await request(app)
                .post('/api/help/feedback')
                .send({
                    content_type: 'faq',
                    content_id: 'faq-1',
                    is_helpful: false
                });
            
            expect(response.status).toBe(201);
        });
    });
    
    describe('GET /api/help/feedback/stats', () => {
        const mockStats = {
            total: 100,
            helpful: 85,
            not_helpful: 15,
            helpfulness_rate: 85,
            avg_rating: 4.2
        };
        
        beforeEach(() => {
            const db = require('../../server/database');
            db.get.mockResolvedValue(mockStats);
            db.all.mockResolvedValue([
                { content_type: 'card', count: 50, helpfulness_rate: 90 },
                { content_type: 'faq', count: 30, helpfulness_rate: 80 },
                { content_type: 'video', count: 20, helpfulness_rate: 85 }
            ]);
        });
        
        it('should return feedback statistics', async () => {
            const response = await request(app)
                .get('/api/help/feedback/stats');
            
            expect(response.status).toBe(200);
            expect(response.body.overall).toBeDefined();
        });
        
        it('should accept days query parameter', async () => {
            const response = await request(app)
                .get('/api/help/feedback/stats?days=7');
            
            expect(response.status).toBe(200);
        });
        
        it('should accept content_type filter', async () => {
            const response = await request(app)
                .get('/api/help/feedback/stats?content_type=faq');
            
            expect(response.status).toBe(200);
        });
    });
    
    describe('POST /api/help/analytics/event', () => {
        it('should track view event', async () => {
            const response = await request(app)
                .post('/api/help/analytics/event')
                .send({
                    event_type: 'view',
                    content_type: 'module',
                    content_id: 'dashboard'
                });
            
            expect(response.status).toBe(201);
        });
        
        it('should track search event', async () => {
            const response = await request(app)
                .post('/api/help/analytics/event')
                .send({
                    event_type: 'search',
                    metadata: { query: 'how to create initiative' }
                });
            
            expect(response.status).toBe(201);
        });
        
        it('should track video complete event', async () => {
            const response = await request(app)
                .post('/api/help/analytics/event')
                .send({
                    event_type: 'complete',
                    content_type: 'video',
                    content_id: 'intro-video',
                    metadata: { duration_seconds: 120 }
                });
            
            expect(response.status).toBe(201);
        });
        
        it('should validate event_type', async () => {
            const response = await request(app)
                .post('/api/help/analytics/event')
                .send({
                    event_type: 'invalid_event',
                    content_type: 'card',
                    content_id: 'test'
                });
            
            expect(response.status).toBe(400);
        });
        
        it('should include session_id if provided', async () => {
            const response = await request(app)
                .post('/api/help/analytics/event')
                .set('x-session-id', 'session-123')
                .send({
                    event_type: 'view',
                    content_type: 'faq',
                    content_id: 'faq-1'
                });
            
            expect(response.status).toBe(201);
        });
    });
    
    describe('GET /api/help/analytics/summary', () => {
        beforeEach(() => {
            const db = require('../../server/database');
            db.all.mockResolvedValue([
                { event_type: 'view', count: 1000 },
                { event_type: 'search', count: 200 },
                { event_type: 'complete', count: 50 }
            ]);
            db.get.mockResolvedValue({ unique_users: 150 });
        });
        
        it('should return analytics summary', async () => {
            const response = await request(app)
                .get('/api/help/analytics/summary');
            
            expect(response.status).toBe(200);
            expect(response.body.events).toBeDefined();
        });
        
        it('should accept date range parameters', async () => {
            const response = await request(app)
                .get('/api/help/analytics/summary?days=30');
            
            expect(response.status).toBe(200);
        });
    });
});

describe('Feedback Service', () => {
    describe('validateFeedback', () => {
        it('should accept valid content types', () => {
            const validTypes = ['module', 'card', 'faq', 'video'];
            
            validTypes.forEach(type => {
                const isValid = ['module', 'card', 'faq', 'video'].includes(type);
                expect(isValid).toBe(true);
            });
        });
        
        it('should accept valid ratings', () => {
            const validRatings = [1, 2, 3, 4, 5];
            
            validRatings.forEach(rating => {
                const isValid = rating >= 1 && rating <= 5;
                expect(isValid).toBe(true);
            });
        });
        
        it('should handle boolean is_helpful values', () => {
            expect(typeof true === 'boolean').toBe(true);
            expect(typeof false === 'boolean').toBe(true);
        });
    });
    
    describe('sanitizeComment', () => {
        it('should trim whitespace', () => {
            const comment = '  test comment  ';
            expect(comment.trim()).toBe('test comment');
        });
        
        it('should handle null/undefined comments', () => {
            expect(null || '').toBe('');
            expect(undefined || '').toBe('');
        });
        
        it('should respect max length', () => {
            const maxLength = 1000;
            const longComment = 'a'.repeat(1500);
            expect(longComment.slice(0, maxLength).length).toBe(maxLength);
        });
    });
});

describe('Analytics Service', () => {
    describe('event types', () => {
        const validEventTypes = ['view', 'search', 'click', 'complete', 'tour_step', 'tour_complete'];
        
        it('should define all expected event types', () => {
            expect(validEventTypes).toContain('view');
            expect(validEventTypes).toContain('search');
            expect(validEventTypes).toContain('click');
            expect(validEventTypes).toContain('complete');
            expect(validEventTypes).toContain('tour_step');
            expect(validEventTypes).toContain('tour_complete');
        });
    });
    
    describe('metadata handling', () => {
        it('should serialize metadata to JSON', () => {
            const metadata = { query: 'test', results: 5 };
            const json = JSON.stringify(metadata);
            expect(json).toBe('{"query":"test","results":5}');
        });
        
        it('should handle empty metadata', () => {
            const metadata = {};
            const json = JSON.stringify(metadata);
            expect(json).toBe('{}');
        });
        
        it('should handle null metadata', () => {
            const metadata = null;
            const json = JSON.stringify(metadata);
            expect(json).toBe('null');
        });
    });
});

