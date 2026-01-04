import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockInitiativeGeneratorService = {
    generateInitiativesFromAssessments: vi.fn(),
    saveInitiatives: vi.fn(),
    generateWithAI: vi.fn()
};

const mockAICharterGeneratorService = {
    generateCharter: vi.fn()
};

const mockInitiativeTemplateService = {
    getTemplates: vi.fn()
};

vi.mock('../../../server/services/initiativeGeneratorService', () => ({
    default: mockInitiativeGeneratorService
}));

vi.mock('../../../server/services/aiCharterGeneratorService', () => ({
    default: mockAICharterGeneratorService
}));

vi.mock('../../../server/services/initiativeTemplateService', () => ({
    default: mockInitiativeTemplateService
}));

vi.mock('../../../server/middleware/authMiddleware', () => ({
    default: (req, res, next) => {
        req.user = { id: 'user-1', organizationId: 'org-1' };
        next();
    }
}));

describe('Initiative Generator Routes', () => {
    let app;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = express();
        app.use(express.json());
        const initiativeGeneratorRouter = (await import('../../../server/routes/initiative-generator.js')).default;
        app.use('/api/initiatives', initiativeGeneratorRouter);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('POST /api/initiatives/generate-from-assessments', () => {
        it('should generate initiatives from assessments', async () => {
            mockInitiativeGeneratorService.generateInitiativesFromAssessments.mockResolvedValue([
                { name: 'Initiative 1', description: 'Test' }
            ]);
            mockInitiativeGeneratorService.saveInitiatives.mockResolvedValue(['id-1']);

            const response = await request(app)
                .post('/api/initiatives/generate-from-assessments')
                .send({
                    projectId: 'project-123',
                    drdAssessmentId: 'drd-123'
                })
                .expect(200);

            expect(response.body.initiatives).toBeDefined();
            expect(response.body.count).toBeGreaterThan(0);
        });
    });

    describe('POST /api/initiatives/generate/ai', () => {
        it('should generate initiatives with AI', async () => {
            mockInitiativeGeneratorService.generateWithAI.mockResolvedValue([
                { name: 'AI Initiative', description: 'Generated' }
            ]);

            const response = await request(app)
                .post('/api/initiatives/generate/ai')
                .send({
                    gaps: [{ id: 'gap-1', description: 'Test gap' }]
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.initiatives).toBeDefined();
        });

        it('should validate gaps array', async () => {
            await request(app)
                .post('/api/initiatives/generate/ai')
                .send({})
                .expect(400);
        });
    });
});














