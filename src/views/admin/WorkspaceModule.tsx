import { FileText, Globe, LayoutGrid, Settings } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BrandingSettingsPanel } from '../../components/Admin/BrandingSettingsPanel';
import { TemplatesManagementPanel } from '../../components/Admin/TemplatesManagementPanel';
import { WorkspaceDefaultsPanel } from '../../components/Admin/WorkspaceDefaultsPanel';
import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';

export const WorkspaceModule: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('defaults');

    const tabs: Tab[] = [
        {
            id: 'defaults',
            label: t('admin.tabs.defaults', 'Defaults'),
            icon: <Settings size={16} />,
        },
        {
            id: 'templates',
            label: t('admin.tabs.templates', 'Templates'),
            icon: <FileText size={16} />,
        },
        {
            id: 'branding',
            label: t('admin.tabs.branding', 'Branding'),
            icon: <Globe size={16} />,
        },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'defaults':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <WorkspaceDefaultsPanel />
                    </div>
                );
            case 'templates':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <TemplatesManagementPanel />
                    </div>
                );
            case 'branding':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <BrandingSettingsPanel />
                    </div>
                );
            default:
                return <WorkspaceDefaultsPanel />;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title={t('admin.modules.workspace', 'Workspace')}
            subtitle={t('admin.modules.workspaceDesc', 'Configure organization-wide defaults, templates and branding')}
        >
            {renderContent()}
        </TabLayout>
    );
};

export default WorkspaceModule;
