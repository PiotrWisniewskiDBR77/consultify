/**
 * Unit tests for Dashboard Builder Service
 * Tests custom dashboard CRUD operations, widget management, and sharing functionality
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');

// Mock the database
vi.mock('../../../../server/database.sqlite.active', () => ({
    db: {
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn()
    }
}));

const { db } = require('../../../../server/database.sqlite.active');

describe('DashboardBuilderService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getDashboards', () => {
        it('should return all dashboards for a user', async () => {
            const mockDashboards = [
                {
                    id: 'dash-1',
                    name: 'Revenue Dashboard',
                    description: 'Track revenue metrics',
                    layout_json: '{"columns":4}',
                    widgets_json: '[{"id":"w1","type":"metric"}]',
                    is_shared: 0,
                    created_by: 'user-1',
                    created_at: '2024-01-01T00:00:00.000Z',
                    updated_at: '2024-01-01T00:00:00.000Z'
                },
                {
                    id: 'dash-2',
                    name: 'User Analytics',
                    description: null,
                    layout_json: '{}',
                    widgets_json: '[]',
                    is_shared: 1,
                    created_by: 'user-2',
                    created_at: '2024-01-02T00:00:00.000Z',
                    updated_at: '2024-01-02T00:00:00.000Z'
                }
            ];

            db.all.mockImplementation((query, params, callback) => {
                callback(null, mockDashboards);
            });

            // Import after mocking
            const dashboardBuilderService = require('../../../../server/services/dashboardBuilderService');
            const result = await dashboardBuilderService.getDashboards('user-1');

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Revenue Dashboard');
            expect(result[1].is_shared).toBe(1);
        });

        it('should handle database errors', async () => {
            db.all.mockImplementation((query, params, callback) => {
                callback(new Error('Database error'), null);
            });

            const dashboardBuilderService = require('../../../../server/services/dashboardBuilderService');
            
            await expect(dashboardBuilderService.getDashboards('user-1'))
                .rejects.toThrow('Database error');
        });
    });

    describe('getDashboardById', () => {
        it('should return a specific dashboard', async () => {
            const mockDashboard = {
                id: 'dash-1',
                name: 'Revenue Dashboard',
                description: 'Track revenue metrics',
                layout_json: '{"columns":4}',
                widgets_json: '[{"id":"w1","type":"metric"}]',
                is_shared: 0,
                created_by: 'user-1',
                created_at: '2024-01-01T00:00:00.000Z',
                updated_at: '2024-01-01T00:00:00.000Z'
            };

            db.get.mockImplementation((query, params, callback) => {
                callback(null, mockDashboard);
            });

            const dashboardBuilderService = require('../../../../server/services/dashboardBuilderService');
            const result = await dashboardBuilderService.getDashboardById('dash-1');

            expect(result).not.toBeNull();
            expect(result.id).toBe('dash-1');
            expect(result.name).toBe('Revenue Dashboard');
        });

        it('should return null for non-existent dashboard', async () => {
            db.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const dashboardBuilderService = require('../../../../server/services/dashboardBuilderService');
            const result = await dashboardBuilderService.getDashboardById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('createDashboard', () => {
        it('should create a new dashboard', async () => {
            db.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            db.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: params[0],
                    name: 'New Dashboard',
                    description: 'Test description',
                    layout_json: '{"columns":4}',
                    widgets_json: '[]',
                    is_shared: 0,
                    created_by: 'user-1',
                    created_at: expect.any(String),
                    updated_at: expect.any(String)
                });
            });

            const dashboardBuilderService = require('../../../../server/services/dashboardBuilderService');
            const result = await dashboardBuilderService.createDashboard({
                name: 'New Dashboard',
                description: 'Test description',
                layout: { columns: 4 },
                widgets: []
            }, 'user-1');

            expect(result).not.toBeNull();
            expect(result.name).toBe('New Dashboard');
            expect(db.run).toHaveBeenCalled();
        });

        it('should throw error for missing name', async () => {
            const dashboardBuilderService = require('../../../../server/services/dashboardBuilderService');
            
            await expect(dashboardBuilderService.createDashboard({
                description: 'No name'
            }, 'user-1')).rejects.toThrow();
        });
    });

    describe('updateDashboard', () => {
        it('should update an existing dashboard', async () => {
            db.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            db.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: 'dash-1',
                    name: 'Updated Dashboard',
                    description: 'Updated description',
                    layout_json: '{"columns":6}',
                    widgets_json: '[{"id":"w1"}]',
                    is_shared: 0,
                    created_by: 'user-1',
                    created_at: '2024-01-01T00:00:00.000Z',
                    updated_at: expect.any(String)
                });
            });

            const dashboardBuilderService = require('../../../../server/services/dashboardBuilderService');
            const result = await dashboardBuilderService.updateDashboard('dash-1', {
                name: 'Updated Dashboard',
                description: 'Updated description',
                layout: { columns: 6 },
                widgets: [{ id: 'w1' }]
            });

            expect(result).not.toBeNull();
            expect(result.name).toBe('Updated Dashboard');
        });
    });

    describe('deleteDashboard', () => {
        it('should delete a dashboard', async () => {
            db.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const dashboardBuilderService = require('../../../../server/services/dashboardBuilderService');
            const result = await dashboardBuilderService.deleteDashboard('dash-1');

            expect(result).toBe(true);
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE'),
                ['dash-1'],
                expect.any(Function)
            );
        });

        it('should return false if dashboard not found', async () => {
            db.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, null);
            });

            const dashboardBuilderService = require('../../../../server/services/dashboardBuilderService');
            const result = await dashboardBuilderService.deleteDashboard('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('shareDashboard', () => {
        it('should mark dashboard as shared', async () => {
            db.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            db.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: 'dash-1',
                    name: 'Shared Dashboard',
                    is_shared: 1
                });
            });

            const dashboardBuilderService = require('../../../../server/services/dashboardBuilderService');
            const result = await dashboardBuilderService.shareDashboard('dash-1', ['user-2', 'user-3']);

            expect(result).not.toBeNull();
            expect(result.is_shared).toBe(1);
        });
    });

    describe('getDashboardData', () => {
        it('should return aggregated data for dashboard widgets', async () => {
            const mockDashboard = {
                id: 'dash-1',
                name: 'Test Dashboard',
                widgets_json: JSON.stringify([
                    { id: 'w1', type: 'metric', dataSource: 'users' },
                    { id: 'w2', type: 'chart', dataSource: 'revenue' }
                ])
            };

            db.get.mockImplementation((query, params, callback) => {
                if (query.includes('admin_dashboards')) {
                    callback(null, mockDashboard);
                } else if (query.includes('COUNT')) {
                    callback(null, { total: 150 });
                } else {
                    callback(null, { value: 50000 });
                }
            });

            const dashboardBuilderService = require('../../../../server/services/dashboardBuilderService');
            const result = await dashboardBuilderService.getDashboardData('dash-1');

            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
        });

        it('should return empty object for dashboard without widgets', async () => {
            const mockDashboard = {
                id: 'dash-1',
                name: 'Empty Dashboard',
                widgets_json: '[]'
            };

            db.get.mockImplementation((query, params, callback) => {
                callback(null, mockDashboard);
            });

            const dashboardBuilderService = require('../../../../server/services/dashboardBuilderService');
            const result = await dashboardBuilderService.getDashboardData('dash-1');

            expect(result).toEqual({});
        });
    });
});

