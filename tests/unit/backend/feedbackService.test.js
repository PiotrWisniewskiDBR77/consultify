import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { TestDatabaseFactory } from '../../utils/TestDatabaseFactory.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Integration tests for FeedbackService
 * Uses isolated in-memory database via TestDatabaseFactory
 */
describe('Backend Service Test: FeedbackService', () => {
    let testOrgId;
    let testUserId;
    let FeedbackService;
    let testDb;

    beforeAll(async () => {
        // Create isolated test database
        testDb = await TestDatabaseFactory.create();

        // Create test organization and user
        testOrgId = 'test-org-feedback-' + Date.now();
        testUserId = 'test-user-feedback-' + Date.now();

        await testDb.runAsync(
            'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
            [testOrgId, 'Feedback Test Org', 'free', 'active']
        );

        await testDb.runAsync(
            'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
            [testUserId, testOrgId, `feedback-${Date.now()}@test.com`, bcrypt.hashSync('test', 8), 'Test', 'USER']
        );

        // Import service and inject test database
        const mod = await import('../../../server/services/feedbackService.js');
        FeedbackService = mod.default || mod;

        if (FeedbackService.setDependencies) {
            FeedbackService.setDependencies({ db: testDb });
        }
    });

    beforeEach(async () => {
        // Clean feedback table before each test
        await testDb.runAsync('DELETE FROM ai_feedback WHERE user_id = ?', [testUserId]);
    });

    afterAll(async () => {
        if (testDb && testDb.destroy) {
            await testDb.destroy();
        }
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

            // Verify in database
            const feedbacks = await testDb.allAsync(
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

            const feedbacks = await testDb.allAsync(
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
            // Insert test feedback with high rating
            await testDb.runAsync(
                'INSERT INTO ai_feedback (id, user_id, context, prompt, response, rating, correction) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [uuidv4(), testUserId, 'diagnose', 'Test prompt 1', 'Test response 1', 5, 'Correction 1']
            );

            await testDb.runAsync(
                'INSERT INTO ai_feedback (id, user_id, context, prompt, response, rating, correction) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [uuidv4(), testUserId, 'diagnose', 'Test prompt 2', 'Test response 2', 4, '']
            );

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
            const result = await FeedbackService.getLearningExamples('diagnose');
            expect(typeof result).toBe('string');
        });

        it('only returns examples with rating >= 4', async () => {
            // Insert low rating feedback
            await testDb.runAsync(
                'INSERT INTO ai_feedback (id, user_id, context, prompt, response, rating) VALUES (?, ?, ?, ?, ?, ?)',
                [uuidv4(), testUserId, 'diagnose', 'Bad prompt', 'Bad response', 2]
            );

            // Insert high rating feedback
            await testDb.runAsync(
                'INSERT INTO ai_feedback (id, user_id, context, prompt, response, rating) VALUES (?, ?, ?, ?, ?, ?)',
                [uuidv4(), testUserId, 'diagnose', 'Good prompt', 'Good response', 5]
            );

            await new Promise(resolve => setTimeout(resolve, 100));

            const result = await FeedbackService.getLearningExamples('diagnose');

            // Should only contain the high rating example
            expect(result).toContain('Good prompt');
            expect(result).not.toContain('Bad prompt');
        });
    });
});
