/**
 * WorkspaceModule - Projects & Content Management
 * 
 * Tabs: Projects | Knowledge | Playbook Runs | Bulk Operations
 */

import React, { useState } from 'react';
import { FolderOpen, BookOpen, Play, Upload, Layout, Settings } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { AdminProjectManagement } from './AdminProjectManagement';
import { AdminKnowledgeView } from './AdminKnowledgeView';
import { PlaybookRunsView } from './PlaybookRunsView';
import { BulkOperationsView } from './BulkOperationsView';
import { TemplatesManagementPanel } from '../../components/admin/TemplatesManagementPanel';
import { WorkspaceDefaultsPanel } from '../../components/admin/WorkspaceDefaultsPanel';
import { useTranslation } from 'react-i18next';
import { Project } from '../../types';

interface WorkspaceModuleProps {
    initialTab?: string;
    initialProjects?: Project[];
}

export const WorkspaceModule: React.FC<WorkspaceModuleProps> = ({ 
    initialTab,
    initialProjects = []
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(initialTab || 'projects');

    const tabs: Tab[] = [
        { 
            id: 'projects', 
            label: t('admin.tabs.projects', 'Projects'), 
            icon: <FolderOpen size={16} /> 
        },
        { 
            id: 'knowledge', 
            label: t('admin.tabs.knowledge', 'Knowledge'), 
            icon: <BookOpen size={16} /> 
        },
        { 
            id: 'templates', 
            label: t('admin.tabs.templates', 'Templates'), 
            icon: <Layout size={16} /> 
        },
        { 
            id: 'defaults', 
            label: t('admin.tabs.defaults', 'Defaults'), 
            icon: <Settings size={16} /> 
        },
        { 
            id: 'playbook-runs', 
            label: t('admin.tabs.playbookRuns', 'Playbook Runs'), 
            icon: <Play size={16} /> 
        },
        { 
            id: 'bulk-ops', 
            label: t('admin.tabs.bulkOps', 'Bulk Ops'), 
            icon: <Upload size={16} /> 
        },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'projects':
                return <AdminProjectManagement initialProjects={initialProjects} />;
            case 'knowledge':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AdminKnowledgeView />
                    </div>
                );
            case 'templates':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <TemplatesManagementPanel />
                    </div>
                );
            case 'defaults':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <WorkspaceDefaultsPanel />
                    </div>
                );
            case 'playbook-runs':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <PlaybookRunsView />
                    </div>
                );
            case 'bulk-ops':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <BulkOperationsView />
                    </div>
                );
            default:
                return <AdminProjectManagement initialProjects={initialProjects} />;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title={t('admin.modules.workspace', 'Workspace')}
            subtitle={t('admin.modules.workspaceDesc', 'Manage projects, knowledge base, playbooks, and bulk operations')}
        >
            {renderContent()}
        </TabLayout>
    );
};

export default WorkspaceModule;

