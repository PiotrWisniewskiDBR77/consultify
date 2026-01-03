/**
 * AIDevelopmentModule - AI Development & Testing
 * 
 * Module 2 of 3: Development and testing tools
 * Tabs: Prompt Library | AI Intelligence | Experiments | Knowledge Base
 * 
 * Responsibilities:
 * - Prompt management and versioning
 * - AI intelligence configuration
 * - A/B testing experiments
 * - Knowledge base administration
 */

import React, { useState } from 'react';
import { FileText, Sparkles, FlaskConical, BookOpen } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { PromptManagementUI } from '../../components/Admin/PromptManagementUI';
import { AIIntelligenceView } from './AIIntelligenceView';
import { ABTestingDashboard } from '../../components/Admin/ABTestingDashboard';
import { AdminKnowledgeView } from '../admin/AdminKnowledgeView';

interface AIDevelopmentModuleProps {
    initialTab?: string;
}

export const AIDevelopmentModule: React.FC<AIDevelopmentModuleProps> = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'prompts');

    const tabs: Tab[] = [
        { 
            id: 'prompts', 
            label: 'Prompt Library', 
            icon: <FileText size={16} />,
            description: 'Manage and version control prompts'
        },
        { 
            id: 'intelligence', 
            label: 'AI Intelligence', 
            icon: <Sparkles size={16} />,
            description: 'Configure AI intelligence systems'
        },
        { 
            id: 'experiments', 
            label: 'Experiments', 
            icon: <FlaskConical size={16} />,
            description: 'A/B testing and experiments'
        },
        { 
            id: 'knowledge', 
            label: 'Knowledge Base', 
            icon: <BookOpen size={16} />,
            description: 'Manage AI knowledge sources'
        },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'prompts':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <PromptManagementUI />
                    </div>
                );
            case 'intelligence':
                return <AIIntelligenceView />;
            case 'experiments':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <ABTestingDashboard />
                    </div>
                );
            case 'knowledge':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AdminKnowledgeView />
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
            title="AI Development"
            subtitle="Prompt library, intelligence configuration, experiments, and knowledge base"
        >
            {renderContent()}
        </TabLayout>
    );
};

export default AIDevelopmentModule;
