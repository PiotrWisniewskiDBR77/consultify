/**
 * AI Settings API Integration Tests
 * 
 * Tests for all AI Settings API endpoints:
 * - SuperAdmin settings
 * - Organization settings  
 * - User settings
 * - Effective settings
 * - Cost tracking
 * - Tier management
 * - Compliance reports
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../server/database');
jest.mock('../../server/middleware/authMiddleware', () => (req, res, next) => {
    req.user = {
        id: 'test-user-id',
        role: 'admin',
        organizationId: 'test-org-id'
    };
    next();
});
jest.mock('../../server/middleware/rbac', () => ({
    requireRole: () => (req, res, next) => next(),
    requireOrgRole: () => (req, res, next) => next()
}));

// Mock AISettingsService
const mockAISettingsService = {
    getSuperAdminSettings: jest.fn(),
    updateSuperAdminSettings: jest.fn(),
    getOrgSettings: jest.fn(),
    updateOrgSettings: jest.fn(),
    getUserSettings: jest.fn(),
    updateUserSettings: jest.fn(),
    getEffectiveSettings: jest.fn(),
    getAvailableModels: jest.fn(),
    getAuditLog: jest.fn(),
    getUserCostHistory: jest.fn(),
    getOrgUserTiers: jest.fn(),
    assignUserTier: jest.fn(),
    getOrgCostAttribution: jest.fn(),
    generateComplianceReport: jest.fn()
};

jest.mock('../../server/services/aiSettingsService', () => mockAISettingsService);

// Mock AIProactivityEngine
jest.mock('../../server/services/aiProactivityEngine', () => ({
    getEffectiveProactivity: jest.fn().mockResolvedValue({
        mode: 'BALANCED',
        behaviors: { autoSuggest: true, nudges: true }
    }),
    getAllModes: jest.fn().mockReturnValue([
        { id: 'REACTIVE', name: 'Reactive' },
        { id: 'BALANCED', name: 'Balanced' },
        { id: 'PROACTIVE', name: 'Proactive' }
    ])
}));

// Setup express app with routes
const aiSettingsRoutes = require('../../server/routes/ai-settings');
const app = express();
app.use(express.json());
app.use('/api/ai-settings', aiSettingsRoutes);

describe('AI Settings API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==========================================
    // SUPERADMIN ENDPOINTS
    // ==========================================

    describe('GET /api/ai-settings/superadmin', () => {
        it('should return superadmin settings', async () => {
            mockAISettingsService.getSuperAdminSettings.mockResolvedValue({
                id: 'global',
                defaultProvider: 'openai',
                globalTokenLimit: 10000000,
                piiDetectionSensitivity: 'medium'
            });

            const response = await request(app)
                .get('/api/ai-settings/superadmin')
                .expect(200);

            expect(response.body.id).toBe('global');
            expect(response.body.defaultProvider).toBe('openai');
            expect(mockAISettingsService.getSuperAdminSettings).toHaveBeenCalled();
        });
    });

    describe('PUT /api/ai-settings/superadmin', () => {
        it('should update superadmin settings', async () => {
            const updateData = {
                defaultProvider: 'anthropic',
                globalTokenLimit: 20000000
            };

            mockAISettingsService.updateSuperAdminSettings.mockResolvedValue({
                ...updateData,
                id: 'global'
            });

            const response = await request(app)
                .put('/api/ai-settings/superadmin')
                .send(updateData)
                .expect(200);

            expect(response.body.defaultProvider).toBe('anthropic');
            expect(mockAISettingsService.updateSuperAdminSettings).toHaveBeenCalled();
        });
    });

    // ==========================================
    // ORGANIZATION ENDPOINTS
    // ==========================================

    describe('GET /api/ai-settings/org/:orgId', () => {
        it('should return organization settings', async () => {
            mockAISettingsService.getOrgSettings.mockResolvedValue({
                organizationId: 'test-org-id',
                policyLevel: 'ASSISTED',
                defaultProactivityMode: 'BALANCED'
            });

            const response = await request(app)
                .get('/api/ai-settings/org/test-org-id')
                .expect(200);

            expect(response.body.organizationId).toBe('test-org-id');
            expect(response.body.policyLevel).toBe('ASSISTED');
        });
    });

    describe('PUT /api/ai-settings/org/:orgId', () => {
        it('should update organization settings', async () => {
            const updateData = {
                policyLevel: 'PROACTIVE',
                maxAICallsPerDay: 200
            };

            mockAISettingsService.updateOrgSettings.mockResolvedValue({
                organizationId: 'test-org-id',
                ...updateData
            });

            const response = await request(app)
                .put('/api/ai-settings/org/test-org-id')
                .send(updateData)
                .expect(200);

            expect(response.body.policyLevel).toBe('PROACTIVE');
        });
    });

    // ==========================================
    // USER ENDPOINTS
    // ==========================================

    describe('GET /api/ai-settings/user', () => {
        it('should return current user settings', async () => {
            mockAISettingsService.getUserSettings.mockResolvedValue({
                userId: 'test-user-id',
                responseStyle: 'balanced',
                proactivityMode: 'BALANCED'
            });

            const response = await request(app)
                .get('/api/ai-settings/user')
                .expect(200);

            expect(response.body.userId).toBe('test-user-id');
            expect(response.body.responseStyle).toBe('balanced');
        });
    });

    describe('PUT /api/ai-settings/user', () => {
        it('should update user settings', async () => {
            mockAISettingsService.getOrgSettings.mockResolvedValue({
                defaultProactivityMode: 'PROACTIVE'
            });

            mockAISettingsService.updateUserSettings.mockResolvedValue({
                userId: 'test-user-id',
                responseStyle: 'detailed',
                proactivityMode: 'BALANCED'
            });

            const response = await request(app)
                .put('/api/ai-settings/user')
                .send({ responseStyle: 'detailed', proactivityMode: 'BALANCED' })
                .expect(200);

            expect(response.body.responseStyle).toBe('detailed');
        });

        it('should reject proactivity mode exceeding org limit', async () => {
            mockAISettingsService.getOrgSettings.mockResolvedValue({
                defaultProactivityMode: 'BALANCED'
            });

            const response = await request(app)
                .put('/api/ai-settings/user')
                .send({ proactivityMode: 'PROACTIVE' })
                .expect(400);

            expect(response.body.error).toBe('Invalid proactivity mode');
        });
    });

    // ==========================================
    // USER COST TRACKING
    // ==========================================

    describe('GET /api/ai-settings/user/costs', () => {
        it('should return user cost history', async () => {
            mockAISettingsService.getUserCostHistory.mockResolvedValue({
                period: '30d',
                totalCost: 15.50,
                totalRequests: 150,
                totalTokens: 50000,
                byTier: [
                    { tier: 'BUDGET', cost: 5.00, requests: 100 },
                    { tier: 'STANDARD', cost: 10.50, requests: 50 }
                ]
            });

            const response = await request(app)
                .get('/api/ai-settings/user/costs?period=30d')
                .expect(200);

            expect(response.body.period).toBe('30d');
            expect(response.body.totalCost).toBe(15.50);
            expect(response.body.byTier).toHaveLength(2);
        });
    });

    // ==========================================
    // USER TIER MANAGEMENT
    // ==========================================

    describe('GET /api/ai-settings/org/:orgId/users/tiers', () => {
        it('should return user tier assignments', async () => {
            mockAISettingsService.getOrgUserTiers.mockResolvedValue([
                { userId: 'user-1', userName: 'John', currentTier: 'STANDARD', cost: 5.00 },
                { userId: 'user-2', userName: 'Jane', currentTier: 'PREMIUM', cost: 12.00 }
            ]);

            const response = await request(app)
                .get('/api/ai-settings/org/test-org-id/users/tiers')
                .expect(200);

            expect(response.body).toHaveLength(2);
            expect(response.body[0].currentTier).toBe('STANDARD');
        });
    });

    describe('PUT /api/ai-settings/org/:orgId/users/:userId/tier', () => {
        it('should assign tier to user', async () => {
            mockAISettingsService.assignUserTier.mockResolvedValue({
                userId: 'user-1',
                tier: 'PREMIUM',
                success: true
            });

            const response = await request(app)
                .put('/api/ai-settings/org/test-org-id/users/user-1/tier')
                .send({ tier: 'PREMIUM' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.tier).toBe('PREMIUM');
        });

        it('should reject invalid tier', async () => {
            const response = await request(app)
                .put('/api/ai-settings/org/test-org-id/users/user-1/tier')
                .send({ tier: 'INVALID_TIER' })
                .expect(400);

            expect(response.body.error).toBe('Invalid tier');
        });
    });

    // ==========================================
    // COST ATTRIBUTION
    // ==========================================

    describe('GET /api/ai-settings/org/:orgId/costs', () => {
        it('should return cost attribution', async () => {
            mockAISettingsService.getOrgCostAttribution.mockResolvedValue({
                period: '7d',
                totalCost: 50.00,
                attribution: [
                    { entityType: 'user', entityName: 'John', cost: 30.00, percentage: 60 },
                    { entityType: 'project', entityName: 'Project A', cost: 20.00, percentage: 40 }
                ]
            });

            const response = await request(app)
                .get('/api/ai-settings/org/test-org-id/costs?period=7d')
                .expect(200);

            expect(response.body.totalCost).toBe(50.00);
            expect(response.body.attribution).toHaveLength(2);
        });
    });

    // ==========================================
    // COMPLIANCE REPORTS
    // ==========================================

    describe('GET /api/ai-settings/compliance/export/:format', () => {
        it('should generate JSON compliance report', async () => {
            mockAISettingsService.generateComplianceReport.mockResolvedValue({
                id: 'report-1',
                standard: 'ISO21500',
                status: 'compliant',
                summary: { total: 5, compliant: 4, partial: 1, nonCompliant: 0, score: 90 },
                checks: []
            });

            const response = await request(app)
                .get('/api/ai-settings/compliance/export/json?standard=ISO21500')
                .expect(200);

            expect(response.body.standard).toBe('ISO21500');
            expect(response.body.status).toBe('compliant');
        });

        it('should reject invalid format', async () => {
            const response = await request(app)
                .get('/api/ai-settings/compliance/export/xml')
                .expect(400);

            expect(response.body.error).toBe('Invalid format');
        });

        it('should reject invalid standard', async () => {
            const response = await request(app)
                .get('/api/ai-settings/compliance/export/json?standard=INVALID')
                .expect(400);

            expect(response.body.error).toBe('Invalid standard');
        });
    });

    describe('POST /api/ai-settings/compliance/generate', () => {
        it('should generate new compliance report', async () => {
            mockAISettingsService.generateComplianceReport.mockResolvedValue({
                id: 'report-new',
                standard: 'PMBOK7',
                status: 'partial',
                generatedAt: new Date().toISOString()
            });

            const response = await request(app)
                .post('/api/ai-settings/compliance/generate')
                .send({ standard: 'PMBOK7' })
                .expect(200);

            expect(response.body.standard).toBe('PMBOK7');
            expect(response.body.generatedAt).toBeDefined();
        });
    });

    // ==========================================
    // EFFECTIVE SETTINGS
    // ==========================================

    describe('GET /api/ai-settings/effective', () => {
        it('should return merged effective settings', async () => {
            mockAISettingsService.getEffectiveSettings.mockResolvedValue({
                policyLevel: 'ASSISTED',
                proactivityMode: 'BALANCED',
                responseStyle: 'detailed',
                maxTokens: 4096,
                webSearchEnabled: true
            });

            const response = await request(app)
                .get('/api/ai-settings/effective')
                .expect(200);

            expect(response.body.policyLevel).toBe('ASSISTED');
            expect(response.body.proactivityMode).toBe('BALANCED');
        });
    });

    // ==========================================
    // AUDIT LOG
    // ==========================================

    describe('GET /api/ai-settings/audit', () => {
        it('should return audit log', async () => {
            mockAISettingsService.getAuditLog.mockResolvedValue([
                {
                    id: 'audit-1',
                    timestamp: '2024-01-01T00:00:00Z',
                    level: 'admin',
                    settingKey: 'policyLevel',
                    oldValue: 'ADVISORY',
                    newValue: 'ASSISTED'
                }
            ]);

            const response = await request(app)
                .get('/api/ai-settings/audit?level=admin&limit=50')
                .expect(200);

            expect(response.body).toHaveLength(1);
            expect(response.body[0].settingKey).toBe('policyLevel');
        });
    });

    // ==========================================
    // PROACTIVITY
    // ==========================================

    describe('GET /api/ai-settings/proactivity', () => {
        it('should return effective proactivity', async () => {
            const response = await request(app)
                .get('/api/ai-settings/proactivity')
                .expect(200);

            expect(response.body.mode).toBe('BALANCED');
            expect(response.body.behaviors).toBeDefined();
        });
    });

    describe('GET /api/ai-settings/proactivity/modes', () => {
        it('should return all proactivity modes', async () => {
            const response = await request(app)
                .get('/api/ai-settings/proactivity/modes')
                .expect(200);

            expect(response.body).toHaveLength(3);
            expect(response.body.map(m => m.id)).toContain('BALANCED');
        });
    });
});








