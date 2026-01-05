import { BarChart3, Brain, FileText, LayoutDashboard, TrendingUp } from 'lucide-react';
import React, { useState } from 'react';

import { Tab, TabLayout } from '../../../components/SuperAdmin/TabLayout';
import BusinessMetricsView from './BusinessMetricsView';
import DashboardBuilderView from './DashboardBuilderView';
import PredictiveAnalyticsView from './PredictiveAnalyticsView';
import SavedReportsView from './SavedReportsView';

const tabs: Tab[] = [
    { id: 'dashboards', label: 'Dashboard Builder', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
    { id: 'metrics', label: 'Business Metrics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'predictive', label: 'Predictive Analytics', icon: <Brain className="w-4 h-4" /> },
];

const AnalyticsModuleView: React.FC = () => {
    const [activeTab, setActiveTab] = useState('dashboards');

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboards':
                return <DashboardBuilderView />;
            case 'reports':
                return <SavedReportsView />;
            case 'metrics':
                return <BusinessMetricsView />;
            case 'predictive':
                return <PredictiveAnalyticsView />;
            default:
                return <DashboardBuilderView />;
        }
    };

    return (
        <div className="h-full flex flex-col">
            <TabLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
                <div className="flex-1 overflow-auto p-6">{renderContent()}</div>
            </TabLayout>
        </div>
    );
};

export default AnalyticsModuleView;
