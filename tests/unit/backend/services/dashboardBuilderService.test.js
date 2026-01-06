/**
 * Unit tests for Dashboard Builder Service
 * Tests custom dashboard CRUD operations, widget management, and sharing functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Define mockDb using vi.hoisted to ensure it's available globally and initialized before imports
const { mockDb, mockUuid, mockLogger } = vi.hoisted(() => {
    return {
        mockDb: {
            all: vi.fn(),
            get: vi.fn(),
            run: vi.fn()
        },
        mockUuid: vi.fn(() => 'mock-uuid'),
        mockLogger: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        }
    };
});

// Mock the database dependencies
vi.mock('../../../../server/src/database/Database.js', () => ({
    getDatabase: () => mockDb,
    default: mockDb
}));

// Mock uuid
vi.mock('uuid', () => ({
    v4: mockUuid
}));

// Mock Logger
vi.mock('../../../../server/src/utils/Logger.js', () => ({
    default: mockLogger
}));

let dashboardBuilderService;

describe('DashboardBuilderService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Import the service under test
        const module = await import('../../../../server/src/services/dashboardBuilderService.js');
        dashboardBuilderService = module.default || module;

        // Ensure dependencies are injected
        if (dashboardBuilderService.setDependencies) {
            dashboardBuilderService.setDependencies({
                db: mockDb,
                uuidv4: mockUuid,
                logger: mockLogger
            });
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getDashboards', () => {
        it('should return all dashboards for a user', async () => {
            const userId = 'user-123';
            const mockDashboards = [
                {
                    id: 'dash-1',
                    name: 'Sales Dashboard',
                    user_id: userId,
                    layout_type: 'grid'
                }
            ];

            mockDb.all.mockResolvedValueOnce(mockDashboards);

            const result = await dashboardBuilderService.getDashboards(userId);

            expect(mockDb.all).toHaveBeenCalled();
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Sales Dashboard');
        });

        it('should handle database errors', async () => {
            mockDb.all.mockRejectedValueOnce(new Error('Database error'));

            await expect(dashboardBuilderService.getDashboards('user-123'))
                .rejects.toThrow('Database error');
        });
    });

    describe('getDashboardById', () => {
        it('should return a specific dashboard', async () => {
            const dashboardId = 'dash-123';
            const mockDashboard = {
                id: dashboardId,
                name: 'Financial Overview',
                widgets: '[]'
            };

            mockDb.get.mockResolvedValueOnce(mockDashboard);

            const result = await dashboardBuilderService.getDashboardById(dashboardId);

            expect(mockDb.get).toHaveBeenCalled();
            expect(result.id).toBe(dashboardId);
            expect(result.name).toBe('Financial Overview');
        });

        it('should return null for non-existent dashboard', async () => {
            mockDb.get.mockResolvedValueOnce(null);

            const result = await dashboardBuilderService.getDashboardById('missing');
            expect(result).toBeNull();
        });
    });

    describe('createDashboard', () => {
        it('should create a new dashboard', async () => {
            const dashboardData = {
                userId: 'user-123',
                name: 'New Dashboard',
                layoutType: 'canvas',
                widgets: []
            };

            mockDb.run.mockResolvedValueOnce({ lastID: 1, changes: 1 });
            mockDb.get.mockResolvedValueOnce({
                id: 'mock-uuid',
                ...dashboardData,
                widgets: '[]'
            });

            const result = await dashboardBuilderService.createDashboard(dashboardData);

            expect(mockDb.run).toHaveBeenCalled();
            expect(result.name).toBe('New Dashboard');
            expect(result.id).toBe('mock-uuid');
        });

        it('should throw error for missing name', async () => {
            const invalidData = { userId: 'user-123', widgets: [] };

            await expect(dashboardBuilderService.createDashboard(invalidData))
                .rejects.toThrow();
        });
    });

    describe('updateDashboard', () => {
        it('should update an existing dashboard', async () => {
            const dashboardId = 'dash-123';
            const updates = { name: 'Updated Name' };

            mockDb.run.mockResolvedValueOnce({ changes: 1 });
            mockDb.get.mockResolvedValueOnce({
                id: dashboardId,
                name: 'Updated Name',
                widgets: '[]'
            });

            const result = await dashboardBuilderService.updateDashboard(dashboardId, updates);

            expect(mockDb.run).toHaveBeenCalled();
            expect(result.name).toBe('Updated Name');
        });
    });

    describe('deleteDashboard', () => {
        it('should delete a dashboard', async () => {
            const dashboardId = 'dash-123';
            mockDb.run.mockResolvedValueOnce({ changes: 1 });

            const result = await dashboardBuilderService.deleteDashboard(dashboardId);

            expect(mockDb.run).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('should return false if dashboard not found', async () => {
            mockDb.run.mockResolvedValueOnce({ changes: 0 });

            const result = await dashboardBuilderService.deleteDashboard('missing');
            expect(result).toBe(false);
        });
    });

    describe('toggleShare', () => {
        it('should mark dashboard as shared', async () => {
            const dashboardId = 'dash-123';
            mockDb.run.mockResolvedValueOnce({ changes: 1 });

            await dashboardBuilderService.toggleShare(dashboardId, true);

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('is_shared = ?'),
                [1, dashboardId]
            );
        });
    });

    describe('getWidgetData', () => {
        it('should return aggregated data for dashboard widgets', async () => {
            const dashboardId = 'dash-123';
            mockDb.all.mockResolvedValueOnce([
                { type: 'kpi', value: 100 },
                { type: 'chart', value: [1, 2, 3] }
            ]);

            const result = await dashboardBuilderService.getWidgetData(dashboardId);

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });
    });
});
