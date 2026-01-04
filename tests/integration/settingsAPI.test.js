/**
 * Integration tests for Settings API routes
 */

const request = require('supertest');
const express = require('express');

// Mock database
jest.mock('../../server/database', () => {
    const mockData = {
        users: [{
            id: 'user-123',
            email: 'test@example.com',
            extended_preferences: JSON.stringify({
                work: { defaultProjectView: 'kanban' },
                regional: { timezone: 'UTC' }
            })
        }],
        user_api_keys: [],
        user_connected_accounts: [],
        data_export_requests: [],
        account_deletion_requests: []
    };

    return {
        get: jest.fn((sql, params, callback) => {
            if (sql.includes('SELECT extended_preferences FROM users')) {
                const user = mockData.users.find(u => u.id === params[0]);
                callback(null, user ? { extended_preferences: user.extended_preferences } : null);
            } else {
                callback(null, null);
            }
        }),
        run: jest.fn((sql, params, callback) => {
            if (typeof callback === 'function') {
                callback.call({ changes: 1 }, null);
            }
        }),
        all: jest.fn((sql, params, callback) => {
            if (sql.includes('user_api_keys')) {
                callback(null, mockData.user_api_keys);
            } else if (sql.includes('user_connected_accounts')) {
                callback(null, mockData.user_connected_accounts);
            } else {
                callback(null, []);
            }
        })
    };
});

// Mock auth middleware
jest.mock('../../server/middleware/authMiddleware', () => {
    return (req, res, next) => {
        req.user = {
            id: 'user-123',
            email: 'test@example.com',
            organizationId: 'org-123'
        };
        next();
    };
});

// Mock notification services
jest.mock('../../server/services/notificationOutboxService', () => ({
    getUserPreferences: jest.fn().mockResolvedValue(null),
    updateUserPreferences: jest.fn().mockResolvedValue({})
}));

jest.mock('../../server/services/userNotificationPreferencesService', () => ({
    getPreferences: jest.fn().mockResolvedValue({}),
    updatePreferences: jest.fn().mockResolvedValue({}),
    NOTIFICATION_CATEGORIES: [],
    updateDigestSettings: jest.fn().mockResolvedValue({}),
    isInQuietHours: jest.fn().mockResolvedValue(false),
    getWatchedObjects: jest.fn().mockResolvedValue([]),
    getWatchedByType: jest.fn().mockResolvedValue([]),
    addWatcher: jest.fn().mockResolvedValue({}),
    removeWatcher: jest.fn().mockResolvedValue({ removed: true }),
    isWatching: jest.fn().mockResolvedValue(false)
}));

// Create test app
const settingsRoutes = require('../../server/routes/settings');
const app = express();
app.use(express.json());
app.use('/api/settings', settingsRoutes);

describe('Settings API', () => {
    describe('GET /api/settings/preferences/:category', () => {
        it('returns regional preferences', async () => {
            const response = await request(app)
                .get('/api/settings/preferences/regional')
                .expect(200);
            
            expect(response.body).toHaveProperty('preferences');
        });

        it('returns work preferences', async () => {
            const response = await request(app)
                .get('/api/settings/preferences/work')
                .expect(200);
            
            expect(response.body).toHaveProperty('preferences');
        });

        it('returns privacy preferences', async () => {
            const response = await request(app)
                .get('/api/settings/preferences/privacy')
                .expect(200);
            
            expect(response.body).toHaveProperty('preferences');
        });

        it('returns sound preferences', async () => {
            const response = await request(app)
                .get('/api/settings/preferences/sound')
                .expect(200);
            
            expect(response.body).toHaveProperty('preferences');
        });

        it('returns advanced preferences', async () => {
            const response = await request(app)
                .get('/api/settings/preferences/advanced')
                .expect(200);
            
            expect(response.body).toHaveProperty('preferences');
        });

        it('rejects invalid category', async () => {
            const response = await request(app)
                .get('/api/settings/preferences/invalid')
                .expect(400);
            
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toBe('Invalid preference category');
        });
    });

    describe('PUT /api/settings/preferences/:category', () => {
        it('updates regional preferences', async () => {
            const response = await request(app)
                .put('/api/settings/preferences/regional')
                .send({
                    preferences: {
                        timezone: 'Europe/Warsaw',
                        currency: 'PLN'
                    }
                })
                .expect(200);
            
            expect(response.body).toHaveProperty('success', true);
        });

        it('updates work preferences', async () => {
            const response = await request(app)
                .put('/api/settings/preferences/work')
                .send({
                    preferences: {
                        defaultProjectView: 'list',
                        defaultTaskPriority: 'high'
                    }
                })
                .expect(200);
            
            expect(response.body).toHaveProperty('success', true);
        });

        it('updates privacy preferences', async () => {
            const response = await request(app)
                .put('/api/settings/preferences/privacy')
                .send({
                    preferences: {
                        profileVisibility: 'private',
                        showOnlineStatus: false
                    }
                })
                .expect(200);
            
            expect(response.body).toHaveProperty('success', true);
        });

        it('rejects invalid category', async () => {
            const response = await request(app)
                .put('/api/settings/preferences/invalid')
                .send({ preferences: {} })
                .expect(400);
            
            expect(response.body.error).toBe('Invalid preference category');
        });
    });

    describe('API Keys', () => {
        describe('GET /api/settings/api-keys', () => {
            it('returns list of API keys', async () => {
                const response = await request(app)
                    .get('/api/settings/api-keys')
                    .expect(200);
                
                expect(response.body).toHaveProperty('keys');
                expect(Array.isArray(response.body.keys)).toBe(true);
            });
        });

        describe('POST /api/settings/api-keys', () => {
            it('creates a new API key', async () => {
                const response = await request(app)
                    .post('/api/settings/api-keys')
                    .send({
                        name: 'Test Key',
                        permissions: ['read', 'write']
                    })
                    .expect(200);
                
                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('key');
                expect(response.body).toHaveProperty('apiKey');
                expect(response.body.key).toMatch(/^pk_/);
            });

            it('rejects empty key name', async () => {
                const response = await request(app)
                    .post('/api/settings/api-keys')
                    .send({
                        name: '',
                        permissions: ['read']
                    })
                    .expect(400);
                
                expect(response.body.error).toBe('Key name is required');
            });
        });

        describe('DELETE /api/settings/api-keys/:id', () => {
            it('deletes an API key', async () => {
                const response = await request(app)
                    .delete('/api/settings/api-keys/key-123')
                    .expect(200);
                
                expect(response.body).toHaveProperty('success', true);
            });
        });
    });

    describe('Connected Accounts', () => {
        describe('GET /api/settings/connected-accounts', () => {
            it('returns connected accounts', async () => {
                const response = await request(app)
                    .get('/api/settings/connected-accounts')
                    .expect(200);
                
                expect(response.body).toHaveProperty('accounts');
                expect(Array.isArray(response.body.accounts)).toBe(true);
            });
        });

        describe('DELETE /api/settings/connected-accounts/:provider', () => {
            it('disconnects an account', async () => {
                const response = await request(app)
                    .delete('/api/settings/connected-accounts/google')
                    .expect(200);
                
                expect(response.body).toHaveProperty('success', true);
            });
        });
    });

    describe('GDPR Data Management', () => {
        describe('POST /api/settings/export-data', () => {
            it('requests data export', async () => {
                const response = await request(app)
                    .post('/api/settings/export-data')
                    .send({})
                    .expect(200);
                
                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('message');
            });
        });

        describe('POST /api/settings/request-deletion', () => {
            it('requests account deletion with correct email', async () => {
                const response = await request(app)
                    .post('/api/settings/request-deletion')
                    .send({
                        email: 'test@example.com',
                        reason: 'user_requested'
                    })
                    .expect(200);
                
                expect(response.body).toHaveProperty('success', true);
            });

            it('rejects deletion with incorrect email', async () => {
                const response = await request(app)
                    .post('/api/settings/request-deletion')
                    .send({
                        email: 'wrong@example.com',
                        reason: 'user_requested'
                    })
                    .expect(400);
                
                expect(response.body.error).toBe('Email does not match your account');
            });
        });
    });

    describe('Workflow Notifications', () => {
        describe('GET /api/settings/workflow-notifications', () => {
            it('returns workflow notification preferences', async () => {
                const response = await request(app)
                    .get('/api/settings/workflow-notifications')
                    .expect(200);
                
                expect(response.body).toHaveProperty('channel_email');
                expect(response.body).toHaveProperty('event_approval_due');
            });
        });

        describe('PUT /api/settings/workflow-notifications', () => {
            it('updates workflow notification preferences', async () => {
                const response = await request(app)
                    .put('/api/settings/workflow-notifications')
                    .send({
                        channel_email: true,
                        channel_slack: true
                    })
                    .expect(200);
                
                expect(response.body).toHaveProperty('success', true);
            });
        });
    });
});










