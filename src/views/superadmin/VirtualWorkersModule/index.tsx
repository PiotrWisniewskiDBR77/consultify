import {
  BarChart3,
  Brain,
  Eye,
  FlaskConical,
  MessageSquare,
  Rocket,
  Sparkles,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';

import TeresaMark from '../../../components/shared/TeresaMark';
import { Tab, TabLayout } from '../../../components/SuperAdmin/TabLayout';
import { WorkerDetail } from './WorkerDetail';
import { WorkersList } from './WorkersList';
export interface VirtualWorkersModuleProps {
  initialTab?: string;
}

export const VirtualWorkersModule: React.FC<VirtualWorkersModuleProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'workers');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  const tabs: Tab[] = [
    { id: 'workers', label: 'Workers', icon: <Users size={16} /> },
    ...(selectedWorkerId
      ? [
          { id: 'profile', label: 'Profile', icon: <TeresaMark size={16} /> },
          { id: 'knowledge', label: 'Knowledge', icon: <Brain size={16} /> },
          { id: 'preview', label: 'Preview', icon: <Eye size={16} /> },
          { id: 'conversations', label: 'Conversations', icon: <MessageSquare size={16} /> },
          { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
          { id: 'insights', label: 'AI Insights', icon: <Sparkles size={16} /> },
          { id: 'evaluations', label: 'Evaluations', icon: <FlaskConical size={16} /> },
          { id: 'release', label: 'Release', icon: <Rocket size={16} /> },
        ]
      : []),
  ];

  const handleSelectWorker = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setActiveTab('profile');
  };

  const handleBackToList = () => {
    setSelectedWorkerId(null);
    setActiveTab('workers');
  };

  const renderContent = () => {
    if (activeTab === 'workers' || !selectedWorkerId) {
      return <WorkersList onSelectWorker={handleSelectWorker} />;
    }
    return (
      <WorkerDetail workerId={selectedWorkerId} activeTab={activeTab} onBack={handleBackToList} />
    );
  };

  return (
    <TabLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="Virtual Workers"
      subtitle="Manage AI virtual employees — knowledge, instructions, conversations, and performance"
    >
      {renderContent()}
    </TabLayout>
  );
};

export default VirtualWorkersModule;
