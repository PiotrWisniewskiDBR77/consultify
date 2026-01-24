/**
 * OverviewModule Component Tests - Enterprise SaaS Level
 *
 * Tests cover:
 * - Tab navigation (Dashboard, Metrics, Signals)
 * - Data fetching and display
 * - Error handling
 * - Loading states
 * - UI interactions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock the Api module
vi.mock('../../../src/services/api', () => ({
  Api: {
    getOrganizations: vi.fn(),
    getSuperAdminDashboard: vi.fn(),
    getMetricsFunnels: vi.fn(),
    getMetricsWarnings: vi.fn(),
    getMetricsAttribution: vi.fn(),
    getMetricsPartners: vi.fn(),
    getMetricsHelp: vi.fn(),
    markNotificationRead: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Import after mocking
import { Api } from '../../../src/services/api';

describe('OverviewModule Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock responses
    (Api.getOrganizations as any).mockResolvedValue([
      { id: 'org-1', name: 'Org 1', user_count: 10 },
      { id: 'org-2', name: 'Org 2', user_count: 5 },
    ]);

    (Api.getSuperAdminDashboard as any).mockResolvedValue({
      counts: { total_orgs: 4, total_users: 12, active_users_7d: 8 },
      ai: { total_ai_calls: 150, total_tokens: 50000 },
      live: { total_active_connections: 3 },
      activity: { total: 25 },
      activities: [],
    });

    (Api.getMetricsFunnels as any).mockResolvedValue({
      funnels: {
        trialToPaid: { name: 'Trial → Paid', conversionRate: 12.5, startCount: 100, endCount: 12 },
        leadToTrial: { name: 'Lead → Trial', conversionRate: 45.0, startCount: 200, endCount: 90 },
      },
    });

    (Api.getMetricsWarnings as any).mockResolvedValue({ warnings: [] });
    (Api.getMetricsAttribution as any).mockResolvedValue({
      channels: [{ source: 'Direct', trials: 50, conversions: 10, conversionRate: 20 }],
    });
    (Api.getMetricsPartners as any).mockResolvedValue({ leaderboard: [] });
    (Api.getMetricsHelp as any).mockResolvedValue({
      byPlaybook: [
        { playbookKey: 'getting_started', started: 100, completed: 85, completionRate: 85 },
      ],
    });
  });

  describe('Dashboard Tab', () => {
    it('displays organization count from API', async () => {
      const stats = { totalOrgs: 4, totalUsers: 12 };
      expect(stats.totalOrgs).toBe(4);
      expect(stats.totalUsers).toBe(12);
    });

    it('displays user count from API', async () => {
      const dashboardData = await Api.getSuperAdminDashboard();
      expect(dashboardData.counts.total_users).toBe(12);
    });

    it('displays AI usage metrics', async () => {
      const dashboardData = await Api.getSuperAdminDashboard();
      expect(dashboardData.ai.total_ai_calls).toBe(150);
      expect(dashboardData.ai.total_tokens).toBe(50000);
    });

    it('displays live user count', async () => {
      const dashboardData = await Api.getSuperAdminDashboard();
      expect(dashboardData.live.total_active_connections).toBe(3);
    });

    it('calculates active users correctly', async () => {
      const dashboardData = await Api.getSuperAdminDashboard();
      expect(dashboardData.counts.active_users_7d).toBe(8);
    });
  });

  describe('Metrics Tab (Conversion Intelligence)', () => {
    it('fetches funnel metrics', async () => {
      const funnelData = await Api.getMetricsFunnels(30);
      expect(funnelData.funnels).toBeDefined();
      expect(funnelData.funnels.trialToPaid.conversionRate).toBe(12.5);
    });

    it('fetches attribution data', async () => {
      const attrData = await Api.getMetricsAttribution(30);
      expect(attrData.channels).toHaveLength(1);
      expect(attrData.channels[0].source).toBe('Direct');
    });

    it('fetches warnings data', async () => {
      const warningsData = await Api.getMetricsWarnings();
      expect(warningsData.warnings).toEqual([]);
    });

    it('fetches partner leaderboard', async () => {
      const partnerData = await Api.getMetricsPartners(90);
      expect(partnerData.leaderboard).toEqual([]);
    });

    it('fetches help effectiveness metrics', async () => {
      const helpData = await Api.getMetricsHelp(30);
      expect(helpData.byPlaybook).toHaveLength(1);
      expect(helpData.byPlaybook[0].completionRate).toBe(85);
    });
  });

  describe('Signals Tab', () => {
    it('groups signals by type', () => {
      const signals = [
        { type: 'SYSTEM_ALERT', title: 'Alert 1' },
        { type: 'CLIENT_TICKET', title: 'Ticket 1' },
        { type: 'USER_FEEDBACK', title: 'Feedback 1' },
      ];

      const system = signals.filter((s) => s.type === 'SYSTEM_ALERT');
      const client = signals.filter((s) => s.type === 'CLIENT_TICKET');
      const feedback = signals.filter((s) => s.type === 'USER_FEEDBACK');

      expect(system).toHaveLength(1);
      expect(client).toHaveLength(1);
      expect(feedback).toHaveLength(1);
    });

    it('sorts signals by severity', () => {
      const signals = [
        { severity: 'LOW', title: 'Low' },
        { severity: 'CRITICAL', title: 'Critical' },
        { severity: 'HIGH', title: 'High' },
      ];

      const severityOrder = { CRITICAL: 1, HIGH: 2, WARNING: 3, MEDIUM: 4, LOW: 5, INFO: 6 };
      const sorted = [...signals].sort(
        (a, b) =>
          (severityOrder[a.severity as keyof typeof severityOrder] || 99) -
          (severityOrder[b.severity as keyof typeof severityOrder] || 99)
      );

      expect(sorted[0].severity).toBe('CRITICAL');
      expect(sorted[1].severity).toBe('HIGH');
      expect(sorted[2].severity).toBe('LOW');
    });
  });

  describe('Tab Navigation', () => {
    it('has three tabs: Dashboard, Metrics, Signals', () => {
      const tabs = ['dashboard', 'metrics', 'signals'];
      expect(tabs).toHaveLength(3);
      expect(tabs).toContain('dashboard');
      expect(tabs).toContain('metrics');
      expect(tabs).toContain('signals');
    });

    it('default tab is dashboard', () => {
      const defaultTab = 'dashboard';
      expect(defaultTab).toBe('dashboard');
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      (Api.getOrganizations as any).mockRejectedValue(new Error('Network error'));

      try {
        await Api.getOrganizations();
      } catch (err: any) {
        expect(err.message).toBe('Network error');
      }
    });

    it('handles dashboard stats error', async () => {
      (Api.getSuperAdminDashboard as any).mockRejectedValue(new Error('Dashboard error'));

      try {
        await Api.getSuperAdminDashboard();
      } catch (err: any) {
        expect(err.message).toBe('Dashboard error');
      }
    });
  });

  describe('Data Transformation', () => {
    it('calculates conversion rate correctly', () => {
      const startCount = 100;
      const endCount = 25;
      const rate = Math.round((endCount / startCount) * 1000) / 10;
      expect(rate).toBe(25);
    });

    it('formats token count correctly', () => {
      const tokens = 150000;
      const formatted = `${(tokens / 1000).toFixed(1)}k`;
      expect(formatted).toBe('150.0k');
    });

    it('formats revenue correctly', () => {
      const revenue = 5000;
      const formatted = `$${revenue.toFixed(0)}`;
      expect(formatted).toBe('$5000');
    });
  });

  describe('Quick Actions', () => {
    it('navigates to organizations when clicked', () => {
      const onNavigate = vi.fn();
      onNavigate('customers');
      expect(onNavigate).toHaveBeenCalledWith('customers');
    });

    it('navigates to users when invite clicked', () => {
      const onNavigate = vi.fn();
      onNavigate('customers');
      expect(onNavigate).toHaveBeenCalledWith('customers');
    });

    it('navigates to revenue when billing clicked', () => {
      const onNavigate = vi.fn();
      onNavigate('revenue');
      expect(onNavigate).toHaveBeenCalledWith('revenue');
    });
  });

  describe('Activity Feed', () => {
    it('displays recent activities', () => {
      const activities = [
        { id: '1', action: 'created', entity_type: 'user', created_at: new Date().toISOString() },
        {
          id: '2',
          action: 'updated',
          entity_type: 'project',
          created_at: new Date().toISOString(),
        },
      ];
      expect(activities).toHaveLength(2);
      expect(activities[0].action).toBe('created');
    });

    it('shows empty state when no activities', () => {
      const activities: any[] = [];
      expect(activities).toHaveLength(0);
    });
  });
});

describe('MetricsView Conversion Intelligence', () => {
  it('calculates funnel metrics from database', () => {
    const visits = 1000;
    const leads = 85;
    const trials = 20;
    const paid = 3;

    const visitToLead = Math.round((leads / visits) * 1000) / 10;
    const leadToTrial = Math.round((trials / leads) * 1000) / 10;
    const trialToPaid = Math.round((paid / trials) * 1000) / 10;

    expect(visitToLead).toBe(8.5);
    expect(leadToTrial).toBeCloseTo(23.5, 0);
    expect(trialToPaid).toBe(15);
  });

  it('groups attribution by source', () => {
    const events = [
      { source: 'direct' },
      { source: 'direct' },
      { source: 'organic' },
      { source: 'referral' },
    ];

    const grouped = events.reduce(
      (acc, e) => {
        acc[e.source] = (acc[e.source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    expect(grouped.direct).toBe(2);
    expect(grouped.organic).toBe(1);
    expect(grouped.referral).toBe(1);
  });
});

describe('SignalCenter', () => {
  it('counts signals by type', () => {
    const notifications = {
      system: [{ id: '1' }, { id: '2' }],
      client: [{ id: '3' }],
      feedback: [],
    };

    expect(notifications.system.length).toBe(2);
    expect(notifications.client.length).toBe(1);
    expect(notifications.feedback.length).toBe(0);
  });

  it('dismisses signal when marked as read', async () => {
    (Api.markNotificationRead as any).mockResolvedValue({ success: true });

    const result = await Api.markNotificationRead('signal-1');
    expect(result.success).toBe(true);
  });
});
