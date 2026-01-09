/**
 * Dashboard Builder Service Tests - Mock-Based Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const createDashboardBuilderService = () => {
    const dashboards = new Map();
    const widgets = new Map();

    return {
        createDashboard: async (data) => {
            if (!data.name) return { success: false, error: 'Name required', status: 400 };
            const id = `dash-${Date.now()}`;
            dashboards.set(id, { id, ...data, widgets: [], createdAt: new Date() });
            return { success: true, data: { id }, status: 201 };
        },

        addWidget: async (dashboardId, widgetData) => {
            const dashboard = dashboards.get(dashboardId);
            if (!dashboard) return { success: false, error: 'Dashboard not found', status: 404 };
            const widgetId = `widget-${Date.now()}`;
            dashboard.widgets.push({ id: widgetId, ...widgetData });
            return { success: true, data: { widgetId }, status: 201 };
        },

        getDashboard: async (dashboardId) => {
            const dashboard = dashboards.get(dashboardId);
            if (!dashboard) return { success: false, error: 'Not found', status: 404 };
            return { success: true, data: dashboard, status: 200 };
        },

        deleteDashboard: async (dashboardId) => {
            if (!dashboards.has(dashboardId)) return { success: false, error: 'Not found', status: 404 };
            dashboards.delete(dashboardId);
            return { success: true, status: 200 };
        }
    };
};

describe('DashboardBuilderService', () => {
    let dashboardService;

    beforeEach(() => {
        vi.clearAllMocks();
        dashboardService = createDashboardBuilderService();
    });

    it('should create dashboard', async () => {
        const result = await dashboardService.createDashboard({ name: 'My Dashboard' });
        expect(result.success).toBe(true);
        expect(result.status).toBe(201);
    });

    it('should add widget to dashboard', async () => {
        const created = await dashboardService.createDashboard({ name: 'Test' });
        const result = await dashboardService.addWidget(created.data.id, { type: 'chart', title: 'Sales' });
        expect(result.success).toBe(true);
    });

    it('should get dashboard with widgets', async () => {
        const created = await dashboardService.createDashboard({ name: 'Test' });
        await dashboardService.addWidget(created.data.id, { type: 'chart' });
        const result = await dashboardService.getDashboard(created.data.id);
        expect(result.success).toBe(true);
        expect(result.data.widgets).toHaveLength(1);
    });

    it('should delete dashboard', async () => {
        const created = await dashboardService.createDashboard({ name: 'To Delete' });
        const result = await dashboardService.deleteDashboard(created.data.id);
        expect(result.success).toBe(true);
    });
});
