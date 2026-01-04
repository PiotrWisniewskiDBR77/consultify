/**
 * OverviewModule - Admin Overview & Analytics
 *
 * Tabs: Dashboard | Metrics | Analytics
 */

import { BarChart3, LayoutDashboard, TrendingUp } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { Project, User } from '../../types';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminDashboard } from './AdminDashboard';
import { AdminMetricsDashboardView } from './AdminMetricsDashboardView';

interface OverviewModuleProps {
    initialTab?: string;
    users: User[];
    projects: Project[];
}

export const OverviewModule: React.FC<OverviewModuleProps> = ({ initialTab, users, projects }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(initialTab || 'dashboard');

    const tabs: Tab[] = [
        {
            id: 'dashboard',
            label: t('admin.tabs.dashboard', 'Dashboard'),
            icon: <LayoutDashboard size={16} />,
        },
        {
            id: 'metrics',
            label: t('admin.tabs.metrics', 'Metrics'),
            icon: <TrendingUp size={16} />,
        },
        {
            id: 'analytics',
            label: t('admin.tabs.analytics', 'Analytics'),
            icon: <BarChart3 size={16} />,
        },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <AdminDashboard users={users} projects={projects} />;
            case 'metrics':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AdminMetricsDashboardView />
                    </div>
                );
            case 'analytics':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AdminAnalyticsView />
                    </div>
                );
            default:
                return <AdminDashboard users={users} projects={projects} />;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title={t('admin.modules.overview', 'Overview')}
            subtitle={t('admin.modules.overviewDesc', 'Dashboard, metrics, and analytics for your organization')}
        >
            {renderContent()}
        </TabLayout>
    );
};

export default OverviewModule;
