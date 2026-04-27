/**
 * OverviewModule - Super Admin Overview
 *
 * Tabs: Dashboard | Metrics | Signals | Updates
 */

import { BarChart3, Bell, LayoutDashboard, Radio } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { useHelpSidePanel } from '../../contexts/HelpContext';
import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { FeatureUpdatesAdminView } from './FeatureUpdatesAdminView';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { SuperAdminMetricsView } from './SuperAdminMetricsView';
import { SuperAdminSignalsView } from './SuperAdminSignalsView';

interface OverviewModuleProps {
  onNavigateToSection?: (section: string) => void;
}

interface OrganizationRow {
  user_count?: number;
}

interface ActivityRow {
  id?: string;
  user_name?: string;
  user_email?: string;
  action?: string;
  entity_type?: string;
  entity_name?: string;
  entity_id?: string;
  created_at?: string;
}

interface OverviewStats {
  totalOrgs: number;
  totalUsers: number;
  revenue: number;
  aiCalls: number;
  tokens: number;
  activeUsers7d: number;
  liveUsers: number;
  pendingRequests: number;
}

const DEFAULT_STATS: OverviewStats = {
  totalOrgs: 0,
  totalUsers: 0,
  revenue: 0,
  aiCalls: 0,
  tokens: 0,
  activeUsers7d: 0,
  liveUsers: 0,
  pendingRequests: 0,
};

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const numberOr = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;

  return (
    Array.isArray(value.data) ||
    keys.some((key) => Array.isArray(value[key])) ||
    Boolean(
      data &&
      (Array.isArray(data.data) ||
        keys.some((key) => Array.isArray(data[key])) ||
        Boolean(nestedData && keys.some((key) => Array.isArray(nestedData[key]))))
    )
  );
};

export const OverviewModule: React.FC<OverviewModuleProps> = ({ onNavigateToSection }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { setHelpDocumentIdOverride } = useHelpSidePanel();
  const [stats, setStats] = useState<OverviewStats>(DEFAULT_STATS);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [orgs, dashboardData] = await Promise.all([
        Api.getOrganizations(),
        Api.getSuperAdminDashboard(),
      ]);

      if (!hasListShape(orgs, ['organizations', 'items'])) {
        throw new Error('Organizations response was not a list');
      }
      const organizations = getListPayload<OrganizationRow>(orgs, ['organizations', 'items']);
      const dashboardPayload = getObjectPayload(dashboardData);
      if (!isRecord(dashboardPayload)) {
        throw new Error('Superadmin dashboard response was not an object');
      }

      const dashboardRecord = dashboardPayload as Record<string, unknown>;
      const counts = isRecord(dashboardRecord.counts) ? dashboardRecord.counts : {};
      const ai = isRecord(dashboardRecord.ai) ? dashboardRecord.ai : {};
      const live = isRecord(dashboardRecord.live) ? dashboardRecord.live : {};
      const activity = isRecord(dashboardRecord.activity) ? dashboardRecord.activity : {};
      const totalUsersFromOrgs = organizations.reduce(
        (acc, org) => acc + numberOr(org.user_count),
        0
      );

      setStats({
        totalOrgs: numberOr(counts.total_orgs, organizations.length),
        totalUsers: numberOr(counts.total_users, totalUsersFromOrgs),
        revenue: 0,
        aiCalls: numberOr(ai.total_ai_calls),
        tokens: numberOr(ai.total_tokens),
        activeUsers7d: numberOr(counts.active_users_7d),
        liveUsers: numberOr(live.total_active_connections),
        pendingRequests: numberOr(activity.total),
      });
      setActivities(Array.isArray(dashboardRecord.activities) ? dashboardRecord.activities : []);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load dashboard data');
      setStats(DEFAULT_STATS);
      setActivities([]);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const mapping: Record<string, string> = {
      dashboard: 'superadmin_overview_dashboard',
      metrics: 'superadmin_overview_metrics',
      signals: 'superadmin_overview_signals',
      updates: 'superadmin_overview',
    };
    setHelpDocumentIdOverride(mapping[activeTab] || 'superadmin_overview');
    return () => setHelpDocumentIdOverride(null);
  }, [activeTab, setHelpDocumentIdOverride]);

  const tabs: Tab[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'metrics', label: 'Metrics', icon: <BarChart3 size={16} /> },
    { id: 'signals', label: 'Signals', icon: <Radio size={16} /> },
    { id: 'updates', label: 'Updates', icon: <Bell size={16} /> },
  ];

  const handleNavigateToOrganizations = () => onNavigateToSection?.('customers');
  const handleNavigateToUsers = () => onNavigateToSection?.('customers');
  const handleNavigateToBilling = () => onNavigateToSection?.('revenue');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        if (loadError) {
          return (
            <DegradedState
              title="Superadmin overview unavailable"
              description={loadError}
              action={
                <button
                  type="button"
                  onClick={() => void fetchData()}
                  className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
                >
                  Retry
                </button>
              }
            />
          );
        }
        return (
          <SuperAdminDashboard
            stats={stats}
            activities={activities}
            loading={loading}
            onRefresh={fetchData}
            onNavigateToOrganizations={handleNavigateToOrganizations}
            onNavigateToUsers={handleNavigateToUsers}
            onNavigateToBilling={handleNavigateToBilling}
          />
        );
      case 'metrics':
        return <SuperAdminMetricsView />;
      case 'signals':
        return <SuperAdminSignalsView />;
      case 'updates':
        return <FeatureUpdatesAdminView />;
      default:
        return null;
    }
  };

  const getHelpCardId = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'superadmin-dashboard';
      case 'metrics':
        return 'superadmin-metrics';
      case 'signals':
        return 'superadmin-signals';
      case 'updates':
        return 'superadmin-dashboard';
      default:
        return 'superadmin-dashboard';
    }
  };

  return (
    <TabLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="Overview"
      subtitle="System dashboard and real-time insights"
      actions={<InfoButton cardId={getHelpCardId()} />}
    >
      {renderContent()}
    </TabLayout>
  );
};

export default OverviewModule;
