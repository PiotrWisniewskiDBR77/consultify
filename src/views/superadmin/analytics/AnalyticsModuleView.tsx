import { BarChart3, Brain, FileText, FlaskConical, LayoutDashboard } from 'lucide-react';
import React, { useState } from 'react';

import { InfoButton } from '../../../components/shared/InfoButton';
import { Tab, TabLayout } from '../../../components/SuperAdmin/TabLayout';
import BusinessMetricsView from './BusinessMetricsView';
import DashboardBuilderView from './DashboardBuilderView';
import DemoTrialAnalyticsView from './DemoTrialAnalyticsView';
import PredictiveAnalyticsView from './PredictiveAnalyticsView';
import SavedReportsView from './SavedReportsView';

const tabs: Tab[] = [
  { id: 'dashboards', label: 'Dashboard Builder', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'demo-trial', label: 'Demo & Trial', icon: <FlaskConical className="w-4 h-4" /> },
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
      case 'demo-trial':
        return <DemoTrialAnalyticsView />;
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
    <div className="h-full flex flex-col relative">
      <InfoButton cardId="superadmin-analytics" position="top-right" />
      <TabLayout
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        title="Analytics"
        subtitle="Dashboards, reports, business metrics, and predictive analytics"
      >
        <div className="flex-1 overflow-auto p-6">{renderContent()}</div>
      </TabLayout>
    </div>
  );
};

export default AnalyticsModuleView;
