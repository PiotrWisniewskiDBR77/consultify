/**
 * Unit tests for Dashboard Builder Service
 * Tests custom dashboard CRUD operations, widget management, and sharing functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Define mockDb using vi.hoisted to ensure it's available globally and initialized before imports
const { mockDb, mockUuid } = vi.hoisted(() => {
    return {
        mockDb: {
            all: vi.fn(),
            get: vi.fn(),
            run: vi.fn()
        },
        mockUuid: vi.fn(() => 'mock-uuid')
    };
});

// Mock the database dependencies
vi.mock('../../../../server/src/database/Database.ts', () => ({
    getDatabase: () => mockDb,
    default: mockDb
}));

// Mock uuid
vi.mock('uuid', () => ({
    v4: mockUuid
}));

// Import the service under test
import dashboardBuilderService from '../../../../server/services/dashboardBuilderService.js';

describe('DashboardBuilderService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Ensure dependnecies are injected
        if (dashboardBuilderService.setDependencies) {
            dashboardBuilderService.setDependencies({
                db: mockDb,
                uuidv4: mockUuid
            });
        }
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
                    updated_at: '2024-01-01T00:00:00.000Z',
                    first_name: 'User',
                    last_name: 'One',
                    email: 'user1@test.com'
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
                    updated_at: '2024-01-02T00:00:00.000Z',
                    first_name: 'User',
                    last_name: 'Two',
                    email: 'user2@test.com'
                }
            ];

            mockDb.all.mockResolvedValue(mockDashboards);

            const result = await dashboardBuilderService.getDashboards('user-1');

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Revenue Dashboard');
            expect(result[1].isShared).toBe(true);
        });

        it('should handle database errors', async () => {
            mockDb.all.mockRejectedValue(new Error('Database error'));

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

            mockDb.get.mockResolvedValue(mockDashboard);

            const result = await dashboardBuilderService.getDashboardById('dash-1');

            expect(result).not.toBeNull();
            expect(result.id).toBe('dash-1');
            expect(result.name).toBe('Revenue Dashboard');
        });

        it('should return null for non-existent dashboard', async () => {
            mockDb.get.mockResolvedValue(null);

            const result = await dashboardBuilderService.getDashboardById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('createDashboard', () => {
        it('should create a new dashboard', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });
            mockDb.get.mockResolvedValue({
                id: 'mock-uuid',
                name: 'New Dashboard',
                description: 'Test description',
                layout_json: '{"columns":4}',
                widgets_json: '[]',
                is_shared: 0,
                created_by: 'user-1',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            const result = await dashboardBuilderService.createDashboard({
                name: 'New Dashboard',
                description: 'Test description',
                layout: { columns: 4 },
                widgets: []
            }, 'user-1');

            expect(result).not.toBeNull();
            expect(result.name).toBe('New Dashboard');
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should throw error for missing name', async () => {
            mockDb.run.mockRejectedValue(new Error('NOT NULL constraint failed'));

            await expect(dashboardBuilderService.createDashboard({
                description: 'No name'
            }, 'user-1')).rejects.toThrow();
        });
    });

    describe('updateDashboard', () => {
        it('should update an existing dashboard', async () => {
            // Force return value
            mockDb.run.mockReturnValue(Promise.resolve({ changes: 1 }));

            const result = await dashboardBuilderService.updateDashboard('dash-1', {
                name: 'Updated Dashboard',
                layout: { columns: 6 }
            });

            expect(result).toBe(true);
        });
    });

    describe('deleteDashboard', () => {
        it('should delete a dashboard', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await dashboardBuilderService.deleteDashboard('dash-1');

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE'),
                expect.arrayContaining(['dash-1'])
            );
        });

        it('should return false if dashboard not found', async () => {
            mockDb.run.mockResolvedValue({ changes: 0 });

            const result = await dashboardBuilderService.deleteDashboard('non-existent');

            expect(result).toBe(false);
        });
    });

    describe('toggleShare', () => {
        it('should mark dashboard as shared', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await dashboardBuilderService.toggleShare('dash-1', true);

            expect(result).toBe(true);
        });
    });

    describe('getWidgetData', () => {
        it('should return aggregated data for dashboard widgets', async () => {
            const widget = { id: 'w1', type: 'metric', dataSource: 'users', config: {} };
            mockDb.get.mockResolvedValue({ total: 100 });

            const result = await dashboardBuilderService.getWidgetData(widget);

            expect(result).toBeDefined();
        });
    });
});
