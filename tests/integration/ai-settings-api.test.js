/**
 * AI Settings API Integration Tests
 * 
 * Tests the AI settings REST API endpoints.
 */

const request = require('supertest');
const express = require('express');

// Mock the services
jest.mock('../../server/services/aiSettingsService', () => ({
    getSuperAdminSettings: jest.fn(),
    updateSuperAdminSettings: jest.fn(),
    getOrgSettings: jest.fn(),
    updateOrgSettings: jest.fn(),
    getUserSettings: jest.fn(),
    updateUserSettings: jest.fn(),
    getEffectiveSettings: jest.fn(),
    getAuditLog: jest.fn(),
    getAvailableModels: jest.fn()
}));

jest.mock('../../server/services/aiProactivityEngine', () => ({
    getEffectiveProactivity: jest.fn(),
    getAllModes: jest.fn()
}));

// Mock auth middleware
jest.mock('../../server/middleware/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = {
            id: 'user-test',
            role: 'admin',
            organizationId: 'org-test'
        };
        next();
    },
    requireRole: (role) => (req, res, next) => {
        if (role === 'superadmin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    },
    requireOrgRole: () => (req, res, next) => next()
}));

const AISettingsService = require('../../server/services/aiSettingsService');
const AIProactivityEngine = require('../../server/services/aiProactivityEngine');
const aiSettingsRoutes = require('../../server/routes/ai-settings');

describe('AI Settings API', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/ai-settings', aiSettingsRoutes);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/ai-settings/user', () => {
        it('should return user settings', async () => {
            const mockSettings = {
                userId: 'user-test',
                responseStyle: 'balanced',
                proactivityMode: 'BALANCED',
                modelTemperature: 0.7
            };

            AISettingsService.getUserSettings.mockResolvedValue(mockSettings);

            const res = await request(app)
                .get('/api/ai-settings/user')
                .expect(200);

            expect(res.body).toEqual(mockSettings);
            expect(AISettingsService.getUserSettings).toHaveBeenCalledWith('user-test');
        });
    });

    describe('PUT /api/ai-settings/user', () => {
        it('should update user settings', async () => {
            const updatedSettings = {
                userId: 'user-test',
                proactivityMode: 'REACTIVE'
            };

            AISettingsService.getOrgSettings.mockResolvedValue({
                defaultProactivityMode: 'PROACTIVE'
            });
            AISettingsService.updateUserSettings.mockResolvedValue(updatedSettings);

            const res = await request(app)
                .put('/api/ai-settings/user')
                .send({ proactivityMode: 'REACTIVE' })
                .expect(200);

            expect(res.body.proactivityMode).toBe('REACTIVE');
        });

        it('should reject proactivity above org limit', async () => {
            AISettingsService.getOrgSettings.mockResolvedValue({
                defaultProactivityMode: 'BALANCED'
            });

            const res = await request(app)
                .put('/api/ai-settings/user')
                .send({ proactivityMode: 'PROACTIVE' })
                .expect(400);

            expect(res.body.error).toBe('Invalid proactivity mode');
        });
    });

    describe('GET /api/ai-settings/effective', () => {
        it('should return merged effective settings', async () => {
            const mockEffective = {
                policyLevel: 'ASSISTED',
                proactivityMode: 'BALANCED',
                responseStyle: 'balanced',
                webSearchEnabled: true,
                artifactsEnabled: true
            };

            AISettingsService.getEffectiveSettings.mockResolvedValue(mockEffective);

            const res = await request(app)
                .get('/api/ai-settings/effective')
                .expect(200);

            expect(res.body).toEqual(mockEffective);
            expect(AISettingsService.getEffectiveSettings).toHaveBeenCalledWith('user-test', 'org-test');
        });
    });

    describe('GET /api/ai-settings/org/:orgId', () => {
        it('should return organization settings', async () => {
            const mockOrgSettings = {
                organizationId: 'org-test',
                policyLevel: 'ASSISTED',
                defaultProactivityMode: 'BALANCED',
                activeRoles: ['ADVISOR', 'PMO_MANAGER']
            };

            AISettingsService.getOrgSettings.mockResolvedValue(mockOrgSettings);

            const res = await request(app)
                .get('/api/ai-settings/org/org-test')
                .expect(200);

            expect(res.body).toEqual(mockOrgSettings);
        });

        it('should reject access to other organization', async () => {
            const res = await request(app)
                .get('/api/ai-settings/org/other-org')
                .expect(403);

            expect(res.body.error).toBe('Access denied to this organization');
        });
    });

    describe('GET /api/ai-settings/proactivity/modes', () => {
        it('should return all proactivity modes', async () => {
            const mockModes = [
                { id: 'REACTIVE', title: 'Reactive' },
                { id: 'BALANCED', title: 'Balanced' },
                { id: 'PROACTIVE', title: 'Proactive' }
            ];

            AIProactivityEngine.getAllModes.mockReturnValue(mockModes);

            const res = await request(app)
                .get('/api/ai-settings/proactivity/modes')
                .expect(200);

            expect(res.body).toEqual(mockModes);
        });
    });

    describe('GET /api/ai-settings/available-models', () => {
        it('should return available models for user', async () => {
            const mockModels = [
                { id: 'model-1', name: 'GPT-4', provider: 'openai' },
                { id: 'model-2', name: 'Claude', provider: 'anthropic' }
            ];

            AISettingsService.getAvailableModels.mockResolvedValue(mockModels);

            const res = await request(app)
                .get('/api/ai-settings/available-models')
                .expect(200);

            expect(res.body).toEqual(mockModels);
            expect(AISettingsService.getAvailableModels).toHaveBeenCalledWith('user-test', 'org-test');
        });
    });

    describe('GET /api/ai-settings/audit', () => {
        it('should return audit log for admin', async () => {
            const mockAudit = [
                {
                    id: 'audit-1',
                    level: 'admin',
                    settingKey: 'policyLevel',
                    oldValue: 'ADVISORY',
                    newValue: 'ASSISTED'
                }
            ];

            AISettingsService.getAuditLog.mockResolvedValue(mockAudit);

            const res = await request(app)
                .get('/api/ai-settings/audit')
                .expect(200);

            expect(res.body).toEqual(mockAudit);
        });
    });
});

