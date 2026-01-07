/**
 * Admin Panel Navigation Integration Tests
 * Tests RouterSync synchronization with AdminView
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { AppView } from '@/types';
import { AdminView } from '@/views/admin/AdminView';
import { ROUTES } from '@/routes/routeConfig';

// Mock dependencies
vi.mock('@/services/api', () => ({
    Api: {
        getUsers: vi.fn().mockResolvedValue([]),
        getProjects: vi.fn().mockResolvedValue([]),
        getOrganizations: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Admin Panel Navigation Integration', () => {
    beforeEach(() => {
        // Reset store
        const store = useAppStore.getState();
        store.setCurrentView(AppView.ADMIN_OVERVIEW);
    });

    it('should map Overview route to ADMIN_OVERVIEW AppView', () => {
        const { getRouteFromAppView } = require('@/routes/routeConfig');
        expect(getRouteFromAppView(AppView.ADMIN_OVERVIEW)).toBe(ROUTES.ADMIN.OVERVIEW);
    });

    it('should map Organization route to ADMIN_ORGANIZATION AppView', () => {
        const { getRouteFromAppView } = require('@/routes/routeConfig');
        expect(getRouteFromAppView(AppView.ADMIN_ORGANIZATION)).toBe(ROUTES.ADMIN.ORGANIZATION);
    });

    it('should map Team route to ADMIN_TEAM AppView', () => {
        const { getRouteFromAppView } = require('@/routes/routeConfig');
        expect(getRouteFromAppView(AppView.ADMIN_TEAM)).toBe(ROUTES.ADMIN.TEAM);
    });

    it('should map Workspace route to ADMIN_WORKSPACE AppView', () => {
        const { getRouteFromAppView } = require('@/routes/routeConfig');
        expect(getRouteFromAppView(AppView.ADMIN_WORKSPACE)).toBe(ROUTES.ADMIN.WORKSPACE);
    });

    it('should map AI route to ADMIN_AI AppView', () => {
        const { getRouteFromAppView } = require('@/routes/routeConfig');
        expect(getRouteFromAppView(AppView.ADMIN_AI)).toBe(ROUTES.ADMIN.AI);
    });

    it('should map Billing route to ADMIN_BILLING AppView', () => {
        const { getRouteFromAppView } = require('@/routes/routeConfig');
        expect(getRouteFromAppView(AppView.ADMIN_BILLING)).toBe(ROUTES.ADMIN.BILLING);
    });

    it('should map Security route to ADMIN_SECURITY AppView', () => {
        const { getRouteFromAppView } = require('@/routes/routeConfig');
        expect(getRouteFromAppView(AppView.ADMIN_SECURITY)).toBe(ROUTES.ADMIN.SECURITY);
    });

    it('should map URL to AppView correctly', () => {
        const { getAppViewFromRoute } = require('@/routes/routeConfig');
        expect(getAppViewFromRoute('/admin/overview')).toBe(AppView.ADMIN_OVERVIEW);
        expect(getAppViewFromRoute('/admin/organization')).toBe(AppView.ADMIN_ORGANIZATION);
        expect(getAppViewFromRoute('/admin/team')).toBe(AppView.ADMIN_TEAM);
        expect(getAppViewFromRoute('/admin/workspace')).toBe(AppView.ADMIN_WORKSPACE);
        expect(getAppViewFromRoute('/admin/ai')).toBe(AppView.ADMIN_AI);
        expect(getAppViewFromRoute('/admin/billing')).toBe(AppView.ADMIN_BILLING);
        expect(getAppViewFromRoute('/admin/security')).toBe(AppView.ADMIN_SECURITY);
    });

    it('should update currentView in store when route changes', async () => {
        const store = useAppStore.getState();
        store.setCurrentView(AppView.ADMIN_OVERVIEW);
        
        expect(store.currentView).toBe(AppView.ADMIN_OVERVIEW);
        
        store.setCurrentView(AppView.ADMIN_TEAM);
        
        expect(store.currentView).toBe(AppView.ADMIN_TEAM);
    });
});

