/**
 * OverviewModule - Super Admin Overview
 *
 * Tabs: Dashboard | Metrics | Signals
 */

import { BarChart3, Bell, LayoutDashboard, Radio } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { InfoButton } from '../../components/shared/InfoButton';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { useHelpSidePanel } from '../../contexts/HelpContext';
import { Api } from '../../services/api';
import { FeatureUpdatesAdminView } from './FeatureUpdatesAdminView';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { SuperAdminMetricsView } from './SuperAdminMetricsView';
import { SuperAdminSignalsView } from './SuperAdminSignalsView';

interface OverviewModuleProps {
  onNavigateToSection?: (section: string) => void;
}

export const OverviewModule: React.FC<OverviewModuleProps> = ({ onNavigateToSection }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { setHelpDocumentIdOverride } = useHelpSidePanel();
  const [stats, setStats] = useState({
    totalOrgs: 0,
    totalUsers: 0,
    revenue: 0,
    aiCalls: 0,
    tokens: 0,
    activeUsers7d: 0,
    liveUsers: 0,
    pendingRequests: 0,
  });
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const orgs = await Api.getOrganizations();
      const totalUsers = orgs.reduce((acc: number, org: any) => acc + (org.user_count || 0), 0);

      setStats((prev) => ({
        ...prev,
        totalOrgs: orgs.length,
        totalUsers: totalUsers,
      }));

      try {
        const dashboardData = await Api.getSuperAdminDashboard();
        setStats((prev) => ({
          ...prev,
          totalOrgs: dashboardData?.counts?.total_orgs || prev.totalOrgs,
          totalUsers: dashboardData?.counts?.total_users || prev.totalUsers,
          aiCalls: dashboardData?.ai?.total_ai_calls || 0,
          tokens: dashboardData?.ai?.total_tokens || 0,
          activeUsers7d: dashboardData?.counts?.active_users_7d || 0,
          liveUsers: dashboardData?.live?.total_active_connections || 0,
          pendingRequests: dashboardData?.activity?.total || 0,
        }));
        setActivities((dashboardData as any)?.activities || []);
      } catch (err) {
        console.warn('Could not fetch dashboard stats', err);
      }
    } catch (err) {
      console.error('Failed to load data', err);
      toast.error('Failed to load dashboard data');
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

  // Map activeTab to help card id
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
