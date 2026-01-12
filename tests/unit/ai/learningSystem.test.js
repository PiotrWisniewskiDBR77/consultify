import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { initTestDb, cleanTables, dbRun, db } = require('../../helpers/dbHelper.cjs');
const { LearningSystem } = require('../../../server/services/ai/learningSystem');
const crypto = require('crypto');

describe('LearningSystem', () => {
    let service;
    const testOrgId = 'test-org-123';
    const testUserId = 'test-user-456';
    const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    };

    beforeAll(async () => {
        await initTestDb();
        LearningSystem.setDependencies({
            db,
            aiLogger: mockLogger,
            crypto
        });
    });

    beforeEach(async () => {
        await cleanTables([
            'ai_learning_interactions',
            'ai_learned_patterns',
            'ai_learning_jobs',
            'ai_global_strategies'
        ]);
        service = new LearningSystem();
        // Lower thresholds for testing
        service.config.minSamplesForPatterns = 1;
        service.config.minConfidenceForInjection = 0.01;
        service.config.minConfidenceForConsolidation = 0.01;
        vi.clearAllMocks();
    });

    describe('recordWithAutoFeedback', () => {
        it('should record interaction and return auto-feedback', async () => {
            const interaction = {
                userId: testUserId,
                organizationId: testOrgId,
                requestType: 'chat',
                prompt: 'Test prompt',
                response: 'Test response',
                qualityResult: { overallScore: 0.9, warnings: [] },
                latency: 500,
                tokenCount: 50
            };

            const result = await service.recordWithAutoFeedback(interaction);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.autoFeedback.score).toBeGreaterThan(0.8);

            // Verify DB record
            const row = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM ai_learning_interactions WHERE id = ?', [result.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(row).toBeDefined();
            expect(row.organization_id).toBe(testOrgId);
            expect(row.prompt_hash).toBeDefined();
        });

        it('should handle missing quality data with neutral score', async () => {
            const result = await service.recordWithAutoFeedback({
                userId: testUserId,
                prompt: 'Short prompt',
                response: 'Short response'
            });

            expect(result.autoFeedback.score).toBeDefined();
            expect(result.autoFeedback.reason).toContain('NO_QUALITY_DATA');
        });
    });

    describe('extractPatternsForCapability', () => {
        it('should extract patterns when enough data is present', async () => {
            // Seed 5 high-quality interactions to meet minSamplesForPatterns
            for (let i = 0; i < 6; i++) {
                await service.recordWithAutoFeedback({
                    userId: testUserId,
                    organizationId: testOrgId,
                    requestType: 'analysis',
                    prompt: 'How to analyze project risk?',
                    response: 'Risk analysis involves identifying potential issues...',
                    qualityResult: { overallScore: 0.9, warnings: [] }
                });
            }

            const patterns = await service.extractPatternsForCapability(testOrgId, 'analysis');

            expect(patterns).toBeDefined();
            expect(patterns.successful.length).toBeGreaterThan(0);
            expect(patterns.confidence).toBeGreaterThan(0);
        });

        it('should return null if not enough data', async () => {
            const patterns = await service.extractPatternsForCapability(testOrgId, 'sparse_type');
            expect(patterns).toBeNull();
        });
    });

    describe('getPatterns', () => {
        it('should retrieve stored patterns', async () => {
            // Manually store a pattern
            const data = {
                successful: [{ prompt_signature: 'sig1', avg_score: 0.9 }],
                failed: [],
                sampleCount: 10,
                confidence: 0.8
            };
            await service.storePatterns(testOrgId, 'chat', data);

            const patterns = await service.getPatterns(testOrgId, 'chat');

            expect(patterns.successful.length).toBe(1);
            expect(patterns.confidence).toBe(0.8);
            expect(patterns.sampleCount).toBe(10);
        });
    });

    describe('getLearningContextForPrompt', () => {
        it('should return context when confidence threshold is met', async () => {
            // Seed data and extract
            for (let i = 0; i < 6; i++) {
                await service.recordWithAutoFeedback({
                    userId: testUserId,
                    organizationId: testOrgId,
                    requestType: 'chat',
                    prompt: 'Hello',
                    response: 'Hi there, how can I help?',
                    qualityResult: { overallScore: 0.9, warnings: [] }
                });
            }
            await service.extractPatternsForCapability(testOrgId, 'chat');

            const context = await service.getLearningContextForPrompt(testOrgId, 'chat');

            expect(context).toBeDefined();
            expect(context.content).toContain('EFFECTIVE RESPONSE PATTERNS');
        });

        it('should return null if confidence is low', async () => {
            const context = await service.getLearningContextForPrompt(testOrgId, 'new_cap');
            expect(context).toBeNull();
        });
    });

    describe('consolidateLearnings', () => {
        it('should create global strategies from high-confidence patterns', async () => {
            // Seed multiple orgs with high confidence patterns
            const orgs = ['org-a', 'org-b', 'org-c'];
            for (const org of orgs) {
                for (let i = 0; i < 10; i++) {
                    await service.recordWithAutoFeedback({
                        userId: testUserId,
                        organizationId: org,
                        requestType: 'global_test',
                        prompt: 'Global prompt',
                        response: 'Global response',
                        qualityResult: { overallScore: 0.9, warnings: [] }
                    });
                }
                await service.extractPatternsForCapability(org, 'global_test');
            }

            const result = await service.consolidateLearnings();

            expect(result.strategiesCreated).toBeGreaterThan(0);

            // Verify global strategy record
            const strategy = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM ai_global_strategies WHERE capability = ?', ['global_test'], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            expect(strategy).toBeDefined();
            expect(strategy.strategy_type).toBe('SUCCESS_PATTERN');
        });
    });
});
