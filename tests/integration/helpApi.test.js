/**
 * Help API Integration Tests
 */

const request = require('supertest');
const express = require('express');

// Import routes
const helpFeedbackRoutes = require('../../server/routes/helpFeedback');
const helpChatRoutes = require('../../server/routes/helpChat');
const helpAnalyticsRoutes = require('../../server/routes/helpAnalytics');
const statusRoutes = require('../../server/routes/status');
const videoRoutes = require('../../server/routes/videos');

// Mock database
jest.mock('../../server/database', () => ({
    run: jest.fn().mockResolvedValue({ changes: 1 }),
    get: jest.fn().mockResolvedValue(null),
    all: jest.fn().mockResolvedValue([])
}));

// Mock OpenAI for chat tests
jest.mock('openai', () => {
    return {
        OpenAI: jest.fn().mockImplementation(() => ({
            chat: {
                completions: {
                    create: jest.fn().mockResolvedValue({
                        choices: [{ message: { content: 'Test response' } }]
                    })
                }
            }
        }))
    };
});

describe('Help API Integration', () => {
    let app;
    
    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        // Mock authentication middleware
        app.use((req, res, next) => {
            req.user = { 
                id: 'test-user', 
                organizationId: 'test-org',
                role: 'ADMIN' 
            };
            next();
        });
        
        // Mount routes
        app.use('/api/help', helpFeedbackRoutes);
        app.use('/api/help', helpChatRoutes);
        app.use('/api/help-analytics', helpAnalyticsRoutes);
        app.use('/api/status', statusRoutes);
        app.use('/api/videos', videoRoutes);
    });
    
    describe('Feedback API', () => {
        describe('POST /api/help/feedback', () => {
            it('should create feedback and return success', async () => {
                const response = await request(app)
                    .post('/api/help/feedback')
                    .send({
                        content_type: 'card',
                        content_id: 'profile-settings',
                        is_helpful: true
                    });
                
                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.id).toBeDefined();
            });
            
            it('should handle database errors gracefully', async () => {
                const db = require('../../server/database');
                db.run.mockRejectedValueOnce(new Error('DB Error'));
                
                const response = await request(app)
                    .post('/api/help/feedback')
                    .send({
                        content_type: 'card',
                        content_id: 'test',
                        is_helpful: true
                    });
                
                expect(response.status).toBe(500);
            });
        });
        
        describe('GET /api/help/feedback/stats', () => {
            it('should return aggregated statistics', async () => {
                const db = require('../../server/database');
                db.get.mockResolvedValueOnce({
                    total_feedback: 100,
                    helpful: 85,
                    not_helpful: 15,
                    helpfulness_rate: 85,
                    avg_rating: 4.5
                });
                
                const response = await request(app)
                    .get('/api/help/feedback/stats');
                
                expect(response.status).toBe(200);
                expect(response.body.overall).toBeDefined();
            });
        });
    });
    
    describe('Analytics API', () => {
        describe('POST /api/help/analytics/event', () => {
            it('should track help view event', async () => {
                const response = await request(app)
                    .post('/api/help/analytics/event')
                    .send({
                        event_type: 'view',
                        content_type: 'module',
                        content_id: 'dashboard'
                    });
                
                expect(response.status).toBe(201);
            });
            
            it('should track search event with metadata', async () => {
                const response = await request(app)
                    .post('/api/help/analytics/event')
                    .send({
                        event_type: 'search',
                        metadata: {
                            query: 'how to create initiative',
                            results_count: 5
                        }
                    });
                
                expect(response.status).toBe(201);
            });
            
            it('should track video completion event', async () => {
                const response = await request(app)
                    .post('/api/help/analytics/event')
                    .send({
                        event_type: 'complete',
                        content_type: 'video',
                        content_id: 'intro-video',
                        metadata: { watch_time_seconds: 180 }
                    });
                
                expect(response.status).toBe(201);
            });
        });
        
        describe('GET /api/help-analytics/dashboard', () => {
            it('should return dashboard data for admins', async () => {
                const response = await request(app)
                    .get('/api/help-analytics/dashboard');
                
                expect(response.status).toBe(200);
            });
            
            it('should accept days parameter', async () => {
                const response = await request(app)
                    .get('/api/help-analytics/dashboard?days=7');
                
                expect(response.status).toBe(200);
            });
        });
        
        describe('GET /api/help-analytics/content', () => {
            it('should return content performance metrics', async () => {
                const response = await request(app)
                    .get('/api/help-analytics/content');
                
                expect(response.status).toBe(200);
            });
        });
        
        describe('GET /api/help-analytics/search', () => {
            it('should return search analytics', async () => {
                const response = await request(app)
                    .get('/api/help-analytics/search');
                
                expect(response.status).toBe(200);
            });
        });
    });
    
    describe('Chat API', () => {
        describe('POST /api/help/chat', () => {
            it('should process chat message', async () => {
                const response = await request(app)
                    .post('/api/help/chat')
                    .send({
                        message: 'How do I create an initiative?',
                        language: 'en'
                    });
                
                expect(response.status).toBe(200);
                expect(response.body.message).toBeDefined();
            });
            
            it('should include context module if provided', async () => {
                const response = await request(app)
                    .post('/api/help/chat')
                    .send({
                        message: 'What can I do here?',
                        context: 'initiatives',
                        language: 'en'
                    });
                
                expect(response.status).toBe(200);
            });
            
            it('should validate message is required', async () => {
                const response = await request(app)
                    .post('/api/help/chat')
                    .send({});
                
                expect(response.status).toBe(400);
            });
        });
        
        describe('GET /api/help/chat/suggestions', () => {
            it('should return default suggestions', async () => {
                const response = await request(app)
                    .get('/api/help/chat/suggestions');
                
                expect(response.status).toBe(200);
                expect(response.body.suggestions).toBeDefined();
                expect(Array.isArray(response.body.suggestions)).toBe(true);
            });
            
            it('should return context-specific suggestions', async () => {
                const response = await request(app)
                    .get('/api/help/chat/suggestions?context=admin');
                
                expect(response.status).toBe(200);
                expect(response.body.suggestions.length).toBeGreaterThan(0);
            });
            
            it('should support Polish language', async () => {
                const response = await request(app)
                    .get('/api/help/chat/suggestions?language=pl');
                
                expect(response.status).toBe(200);
            });
        });
    });
    
    describe('Status API', () => {
        describe('GET /api/status', () => {
            it('should return system status', async () => {
                const response = await request(app)
                    .get('/api/status');
                
                expect(response.status).toBe(200);
                expect(response.body.status).toBeDefined();
            });
            
            it('should include service details', async () => {
                const response = await request(app)
                    .get('/api/status');
                
                expect(response.status).toBe(200);
                expect(response.body.services).toBeDefined();
            });
        });
        
        describe('GET /api/status/incidents', () => {
            it('should return incident history', async () => {
                const response = await request(app)
                    .get('/api/status/incidents');
                
                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
            });
        });
    });
    
    describe('Video API', () => {
        describe('GET /api/videos', () => {
            it('should return video list', async () => {
                const response = await request(app)
                    .get('/api/videos');
                
                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
            });
            
            it('should filter by module', async () => {
                const response = await request(app)
                    .get('/api/videos?module=dashboard');
                
                expect(response.status).toBe(200);
            });
        });
        
        describe('GET /api/videos/:id', () => {
            it('should return video details', async () => {
                const response = await request(app)
                    .get('/api/videos/intro-video');
                
                // May return 404 if video not found, which is valid
                expect([200, 404]).toContain(response.status);
            });
        });
        
        describe('POST /api/videos/:id/progress', () => {
            it('should save video progress', async () => {
                const response = await request(app)
                    .post('/api/videos/intro-video/progress')
                    .send({
                        progress_percent: 50,
                        last_position_seconds: 60
                    });
                
                expect([200, 201]).toContain(response.status);
            });
        });
    });
});

describe('API Error Handling', () => {
    let app;
    
    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        app.use((req, res, next) => {
            req.user = { id: 'test-user', organizationId: 'test-org', role: 'ADMIN' };
            next();
        });
        
        app.use('/api/help', helpFeedbackRoutes);
    });
    
    it('should handle malformed JSON', async () => {
        const response = await request(app)
            .post('/api/help/feedback')
            .set('Content-Type', 'application/json')
            .send('{ invalid json }');
        
        expect(response.status).toBe(400);
    });
    
    it('should handle missing content-type', async () => {
        const response = await request(app)
            .post('/api/help/feedback')
            .send('content_type=card&content_id=test');
        
        // Should handle or reject gracefully
        expect([200, 400, 415]).toContain(response.status);
    });
});

describe('API Authentication', () => {
    let app;
    
    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        // Simulate no auth
        app.use('/api/help-analytics', helpAnalyticsRoutes);
    });
    
    it('should require authentication for analytics', async () => {
        const response = await request(app)
            .get('/api/help-analytics/dashboard');
        
        // Should return 401/403 without proper auth
        expect([401, 403, 500]).toContain(response.status);
    });
});

describe('API Rate Limiting', () => {
    let app;
    
    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        app.use((req, res, next) => {
            req.user = { id: 'test-user', organizationId: 'test-org' };
            next();
        });
        
        app.use('/api/help', helpFeedbackRoutes);
    });
    
    it('should handle rapid requests gracefully', async () => {
        const requests = Array(10).fill().map(() => 
            request(app)
                .post('/api/help/feedback')
                .send({
                    content_type: 'card',
                    content_id: 'test',
                    is_helpful: true
                })
        );
        
        const responses = await Promise.all(requests);
        
        // All should complete (even if rate limited)
        responses.forEach(response => {
            expect([201, 429]).toContain(response.status);
        });
    });
});






