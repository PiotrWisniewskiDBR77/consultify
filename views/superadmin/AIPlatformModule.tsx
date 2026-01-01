/**
 * AIPlatformModule - AI Platform Management
 * 
 * Tabs: LLM Config | Intelligence | Knowledge | Costs | Health
 */

import React, { useState } from 'react';
import { Cpu, Sparkles, BookOpen, DollarSign, HeartPulse } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { LLMManagementView } from './LLMManagementView';
import { AIIntelligenceView } from './AIIntelligenceView';
import { AdminKnowledgeView } from '../admin/AdminKnowledgeView';
import { AICostDashboard } from '../../components/Admin/AICostDashboard';
import { LLMHealthPanel } from '../../components/Admin/LLMHealthPanel';

interface AIPlatformModuleProps {
    initialTab?: string;
}

export const AIPlatformModule: React.FC<AIPlatformModuleProps> = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'llm-config');

    const tabs: Tab[] = [
        { id: 'llm-config', label: 'LLM Config', icon: <Cpu size={16} /> },
        { id: 'intelligence', label: 'Intelligence', icon: <Sparkles size={16} /> },
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
            subtitle="LLM configuration, intelligence engine, and monitoring"
        >
            {renderContent()}
        </TabLayout>
    );
};

export default AIPlatformModule;

