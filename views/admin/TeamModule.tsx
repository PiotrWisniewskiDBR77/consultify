/**
 * TeamModule - Team & User Management
 * 
 * Tabs: Users | Invitations | Licenses | Work Mode | Consultants
 */

import React, { useState, useEffect } from 'react';
import { Users, Mail, Briefcase, UserCog, Crown, UsersRound, Shield } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { AdminUserManagement } from './AdminUserManagement';
import { InvitationsManagement } from './InvitationsManagement';
import { LicenseManagementPanel } from '../../components/admin/LicenseManagementPanel';
import { WorkModeSettings } from '../../components/Admin/WorkModeSettings';
import { AdminSettingsConsultants } from './AdminSettingsConsultants';
import { UserGroupsView } from './UserGroupsView';
import { RolesManagementPanel } from '../../components/admin/RolesManagementPanel';
import { useTranslation } from 'react-i18next';
import { Api } from '../../services/api';
import { User } from '../../types';

interface TeamModuleProps {
    initialTab?: string;
    initialUsers?: User[];
}

export const TeamModule: React.FC<TeamModuleProps> = ({ 
    initialTab,
    initialUsers = []
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(initialTab || 'users');
    const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

    // Fetch pending invitations count
    useEffect(() => {
        const fetchPendingCount = async () => {
            try {
                const invitations = await Api.getInvitations();
                const pending = invitations.filter((inv: any) => inv.status === 'pending').length;
                setPendingInvitesCount(pending);
            } catch (err) {
                // Silently fail
            }
        };
        fetchPendingCount();
    }, [activeTab]);

    const tabs: Tab[] = [
        { 
            id: 'users', 
            label: t('admin.tabs.users', 'Users'), 
            icon: <Users size={16} /> 
        },
        { 
            id: 'invitations', 
            label: t('admin.tabs.invitations', 'Invitations'), 
            icon: <Mail size={16} />,
            badge: pendingInvitesCount
        },
        { 
            id: 'groups', 
            label: t('admin.tabs.groups', 'Groups'), 
            icon: <UsersRound size={16} /> 
        },
        { 
            id: 'roles', 
            label: t('admin.tabs.roles', 'Roles'), 
            icon: <Shield size={16} /> 
        },
        { 
            id: 'licenses', 
            label: t('admin.tabs.licenses', 'Licenses'), 
            icon: <Crown size={16} /> 
        },
        { 
            id: 'work-mode', 
            label: t('admin.tabs.workMode', 'Work Mode'), 
            icon: <Briefcase size={16} /> 
        },
        { 
            id: 'consultants', 
            label: t('admin.tabs.consultants', 'Consultants'), 
            icon: <UserCog size={16} /> 
        },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'users':
                return <AdminUserManagement initialUsers={initialUsers} />;
            case 'invitations':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <InvitationsManagement />
                    </div>
                );
            case 'groups':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <UserGroupsView />
                    </div>
                );
            case 'roles':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <RolesManagementPanel />
                    </div>
                );
            case 'licenses':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <LicenseManagementPanel />
                    </div>
                );
            case 'work-mode':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <WorkModeSettings />
                    </div>
                );
            case 'consultants':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <AdminSettingsConsultants />
                    </div>
                );
            default:
                return <AdminUserManagement initialUsers={initialUsers} />;
        }
    };

    return (
        <TabLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            title={t('admin.modules.team', 'Team')}
            subtitle={t('admin.modules.teamDesc', 'Manage users, invitations, work modes, and external consultants')}
        >
            {renderContent()}
        </TabLayout>
    );
};

export default TeamModule;

