/**
 * AIPlatformModule - AI Platform Management
 * 
 * Tabs: LLM Config | Intelligence | Prompts Admin | Experiments | Mission Control | Knowledge | Costs | Health
 */

import React, { useState } from 'react';
import { Cpu, Sparkles, BookOpen, DollarSign, HeartPulse, FlaskConical, FileText, Radar, Activity } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { LLMManagementView } from './LLMManagementView';
import { AIIntelligenceView } from './AIIntelligenceView';
import { AdminKnowledgeView } from '../admin/AdminKnowledgeView';
import { AICostDashboard } from '../../components/Admin/AICostDashboard';
import { LLMHealthPanel } from '../../components/Admin/LLMHealthPanel';
import { ABTestingDashboard } from '../../components/Admin/ABTestingDashboard';
import { PromptManagementUI } from '../../components/Admin/PromptManagementUI';
import { AIMissionControl } from '../../components/Admin/AIMissionControl';
import { AIPerformanceDashboard } from '../../components/Admin/AIPerformanceDashboard';

interface AIPlatformModuleProps {
    initialTab?: string;
}

export const AIPlatformModule: React.FC<AIPlatformModuleProps> = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'llm-config');

    const tabs: Tab[] = [
        { id: 'llm-config', label: 'LLM Config', icon: <Cpu size={16} /> },
        { id: 'intelligence', label: 'Intelligence', icon: <Sparkles size={16} /> },
        { id: 'prompts-admin', label: 'Prompts Admin', icon: <FileText size={16} /> },
        { id: 'experiments', label: 'Experiments', icon: <FlaskConical size={16} /> },
        { id: 'mission-control', label: 'Mission Control', icon: <Radar size={16} /> },
        { id: 'performance', label: 'Performance', icon: <Activity size={16} /> },
        { id: 'knowledge', label: 'Knowledge', icon: <BookOpen size={16} /> },
        { id: 'costs', label: 'Costs', icon: <DollarSign size={16} /> },
        { id: 'health', label: 'Health', icon: <HeartPulse size={16} /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'llm-config':
                return <LLMManagementView />;
            case 'intelligence':
                return <AIIntelligenceView />;
            case 'prompts-admin':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <PromptManagementUI />
                    </div>
                );
            case 'experiments':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <ABTestingDashboard />
                    </div>
                );
            case 'mission-control':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AIMissionControl />
                    </div>
                );
            case 'performance':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AIPerformanceDashboard />
                    </div>
                );
            case 'knowledge':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AdminKnowledgeView />
                    </div>
                );
            case 'costs':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AICostDashboard />
                    </div>
                );
            case 'health':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <LLMHealthPanel />
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
            title="AI Platform"
            subtitle="LLM configuration, prompts, experiments, intelligence, and monitoring"
        >
            {renderContent()}
        </TabLayout>
    );
};

export default AIPlatformModule;

