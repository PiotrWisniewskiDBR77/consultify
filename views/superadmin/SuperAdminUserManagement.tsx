import React from 'react';
import { User } from '../../types';
import { Api } from '../../services/api';
import { UserManagementCore } from '../../components/shared/UserManagementCore';
import { InfoButton } from '../../components/shared/InfoButton';

interface SuperAdminUserManagementProps {
    organizations?: Array<{ id: string; name: string; status: string }>;
}

export const SuperAdminUserManagement: React.FC<SuperAdminUserManagementProps> = ({ organizations = [] }) => {
    return (
        <div className="p-8 overflow-y-auto relative">
            <InfoButton cardId="superadmin-users" position="top-right" />
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">User Management</h1>
                    <p className="text-slate-400 text-sm mt-1">Manage all platform users across organizations</p>
                </div>
                <InfoButton cardId="superadmin-users" position="header-inline" size="md" showLabel label="Help" />
            </div>
            
            <UserManagementCore
                mode="platform"
                organizations={organizations}
                showInvite={true}
                showMove={true}
                showImpersonate={true}
                showBlock={true}
                showRoleManagement={true}
                showLicenseManagement={true}
            />
        </div>
    );
};

export default SuperAdminUserManagement;

