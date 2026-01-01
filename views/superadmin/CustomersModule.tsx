/**
 * CustomersModule - Customer Management
 * 
 * Tabs: Organizations | Users | Feedback | Bulk Ops
 */

import React, { useState, useEffect } from 'react';
import { Building2, Users, MessageSquare, Upload } from 'lucide-react';
import { TabLayout, Tab } from '../../components/SuperAdmin/TabLayout';
import { OrganizationsView } from './OrganizationsView';
import { SuperAdminUserManagement } from './SuperAdminUserManagement';
import { SuperAdminFeedbackView } from './SuperAdminFeedbackView';
import { BulkOperationsView } from '../admin/BulkOperationsView';
import { Api } from '../../services/api';

interface CustomersModuleProps {
    initialTab?: string;
}

export const CustomersModule: React.FC<CustomersModuleProps> = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'organizations');
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);

    useEffect(() => {
        const fetchOrganizations = async () => {
            try {
                const orgs = await Api.getOrganizations();
                setOrganizations(orgs);
            } catch (err) {
                console.error('Failed to fetch organizations:', err);
            }
        };

        const fetchFeedbackCount = async () => {
            try {
                const feedback = await Api.getUserFeedback();
                const pending = feedback.filter((f: any) => f.status === 'new' || f.status === 'pending').length;
                setPendingFeedbackCount(pending);
            } catch (err) {
                // Silently fail
            }
        };

        fetchOrganizations();
        fetchFeedbackCount();
    }, []);

    const tabs: Tab[] = [
        { id: 'organizations', label: 'Organizations', icon: <Building2 size={16} /> },
        { id: 'users', label: 'Users', icon: <Users size={16} /> },
        { id: 'feedback', label: 'Feedback', icon: <MessageSquare size={16} />, badge: pendingFeedbackCount },
        { id: 'bulk-ops', label: 'Bulk Ops', icon: <Upload size={16} /> },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'organizations':
                return <OrganizationsView />;
            case 'users':
                return <SuperAdminUserManagement organizations={organizations} />;
            case 'feedback':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <SuperAdminFeedbackView />
                    </div>
                );
            case 'bulk-ops':
                return (
                    <div className="p-6 overflow-y-auto h-full">
                        <BulkOperationsView />
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
            title="Customers"
            subtitle="Manage organizations, users, and customer feedback"
        >
            {renderContent()}
        </TabLayout>
    );
};

export default CustomersModule;

