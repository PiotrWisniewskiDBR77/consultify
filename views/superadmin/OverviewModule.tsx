/**
 * OverviewModule - Super Admin Overview
 * 
 * Tabs: Dashboard | Metrics | Signals
 */

import React, { useState, useCallback, useEffect } from 'react';
import { LayoutDashboard, BarChart3, Radio } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { SuperAdminMetricsView } from './SuperAdminMetricsView';
import { SuperAdminSignalCenter } from '../../components/SuperAdmin/SuperAdminSignalCenter';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';

interface OverviewModuleProps {
    onNavigateToSection?: (section: string) => void;
}

export const OverviewModule: React.FC<OverviewModuleProps> = ({ onNavigateToSection }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState({
        totalOrgs: 0,
        totalUsers: 0,
        revenue: 0,
        aiCalls: 0,
        tokens: 0,
        activeUsers7d: 0,
        liveUsers: 0,
        pendingRequests: 0
    });
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const orgs = await Api.getOrganizations();
            const totalUsers = orgs.reduce((acc: number, org: any) => acc + (org.user_count || 0), 0);
            
            setStats(prev => ({
                ...prev,
                totalOrgs: orgs.length,
                totalUsers: totalUsers
            }));

            try {
                const dashboardData = await Api.getSuperAdminDashboard();
                setStats(prev => ({
                    ...prev,
                    totalOrgs: dashboardData?.counts?.total_orgs || prev.totalOrgs,
                    totalUsers: dashboardData?.counts?.total_users || prev.totalUsers,
                    aiCalls: dashboardData?.ai?.total_ai_calls || 0,
                    tokens: dashboardData?.ai?.total_tokens || 0,
                    activeUsers7d: dashboardData?.counts?.active_users_7d || 0,
                    liveUsers: dashboardData?.live?.total_active_connections || 0
                }));
                setActivities(dashboardData?.activities || []);
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

    const tabs: Tab[] = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
        { id: 'metrics', label: 'Metrics', icon: <BarChart3 size={16} /> },
        { id: 'signals', label: 'Signals', icon: <Radio size={16} /> },
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
                return (
                    <div className="p-6">
                        <SuperAdminSignalCenter />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title="Overview"
            subtitle="System dashboard and real-time insights"
        >
            {renderContent()}
        </TabLayout>
    );
};

export default OverviewModule;

