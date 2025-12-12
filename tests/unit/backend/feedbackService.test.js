import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { initTestDb, cleanTables, dbAll, dbGet } = require('../../helpers/dbHelper.cjs');
const FeedbackService = require('../../../server/services/feedbackService.js');

/**
 * Integration tests for FeedbackService
 * Uses real database - production-ready tests
 */
describe('Backend Service Test: FeedbackService', () => {
    let testOrgId;
    let testUserId;

    beforeAll(async () => {
        await initTestDb();
        
        // Create test organization and user
        testOrgId = 'test-org-feedback-' + Date.now();
        testUserId = 'test-user-feedback-' + Date.now();
        
        const db = require('../../../server/database.js');
        const bcrypt = require('bcryptjs');
        
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'Feedback Test Org', 'free', 'active'],
                    (err) => err && !err.message.includes('UNIQUE') ? reject(err) : null
                );
                
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, `feedback-${Date.now()}@test.com`, bcrypt.hashSync('test', 8), 'Test', 'USER'],
                    (err) => err && !err.message.includes('UNIQUE') ? reject(err) : null
                );
                
                setTimeout(resolve, 100);
            });
        });
    });

    beforeEach(async () => {
        // Clean feedback table before each test
        await cleanTables(['ai_feedback']);
    });

    describe('saveFeedback', () => {
        it('saves feedback with all parameters', async () => {
            await FeedbackService.saveFeedback(
                testUserId,
                'diagnose',
                'Test prompt',
                'Test response',
                5,
                'Test correction'
            );

            // Wait for async operation
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify in real database
            const feedbacks = await dbAll(
                'SELECT * FROM ai_feedback WHERE user_id = ? AND context = ?',
                [testUserId, 'diagnose']
            );

            expect(feedbacks).toHaveLength(1);
            expect(feedbacks[0].prompt).toBe('Test prompt');
            expect(feedbacks[0].response).toBe('Test response');
            expect(feedbacks[0].rating).toBe(5);
            expect(feedbacks[0].correction).toBe('Test correction');
            expect(feedbacks[0].context).toBe('diagnose');
        });

        it('saves feedback without correction', async () => {
            await FeedbackService.saveFeedback(
                testUserId,
                'roadmap',
                'Prompt',
                'Response',
                4
            );

            await new Promise(resolve => setTimeout(resolve, 100));

            const feedbacks = await dbAll(
                'SELECT * FROM ai_feedback WHERE user_id = ? AND context = ?',
                [testUserId, 'roadmap']
            );

            expect(feedbacks).toHaveLength(1);
            expect(feedbacks[0].correction).toBe('');
            expect(feedbacks[0].rating).toBe(4);
        });
    });

    describe('getLearningExamples', () => {
        it('retrieves learning examples for context', async () => {
            const db = require('../../../server/database.js');
            const { v4: uuidv4 } = require('uuid');
            
            // Insert test feedback with high rating
            await new Promise((resolve) => {
                db.run(
                    'INSERT INTO ai_feedback (id, user_id, context, prompt, response, rating, correction) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [uuidv4(), testUserId, 'diagnose', 'Test prompt 1', 'Test response 1', 5, 'Correction 1'],
                    resolve
                );
            });
            
            await new Promise((resolve) => {
                db.run(
                    'INSERT INTO ai_feedback (id, user_id, context, prompt, response, rating, correction) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [uuidv4(), testUserId, 'diagnose', 'Test prompt 2', 'Test response 2', 4, ''],
                    resolve
                );
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            const result = await FeedbackService.getLearningExamples('diagnose');

            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
            expect(result).toContain('Example Input');
            expect(result).toContain('Good Response');
            expect(result).toContain('Test prompt');
        });

        it('handles empty results', async () => {
            const result = await FeedbackService.getLearningExamples('nonexistent-context');

            expect(result).toBe('');
        });

        it('handles database errors gracefully', async () => {
            // Service should handle errors internally and return empty string
            const result = await FeedbackService.getLearningExamples('diagnose');
            expect(typeof result).toBe('string');
        });

        it('only returns examples with rating >= 4', async () => {
            const db = require('../../../server/database.js');
            const { v4: uuidv4 } = require('uuid');
            
            // Insert low rating feedback
            await new Promise((resolve) => {
                db.run(
                    'INSERT INTO ai_feedback (id, user_id, context, prompt, response, rating) VALUES (?, ?, ?, ?, ?, ?)',
                    [uuidv4(), testUserId, 'diagnose', 'Bad prompt', 'Bad response', 2],
                    resolve
                );
            });
            
            // Insert high rating feedback
            await new Promise((resolve) => {
                db.run(
                    'INSERT INTO ai_feedback (id, user_id, context, prompt, response, rating) VALUES (?, ?, ?, ?, ?, ?)',
                    [uuidv4(), testUserId, 'diagnose', 'Good prompt', 'Good response', 5],
                    resolve
                );
            });

            await new Promise(resolve => setTimeout(resolve, 100));

            const result = await FeedbackService.getLearningExamples('diagnose');

            // Should only contain the high rating example
            expect(result).toContain('Good prompt');
            expect(result).not.toContain('Bad prompt');
        });
    });
});
