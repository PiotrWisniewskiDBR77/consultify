/**
 * CustomersModule - Customer Management
 *
 * Tabs: Organizations | Users | Lifecycle | Playbooks | Contracts | Security | Support & CS | Feedback | Analytics | Compliance | Automation | Communication | Bulk Ops
 */

import {
  BarChart3,
  BookOpen,
  Building2,
  FileCheck,
  FileText,
  HeadphonesIcon,
  ListTodo,
  Mail,
  MessageSquare,
  RefreshCw,
  Shield,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { useHelpSidePanel } from '../../contexts/HelpContext';
import { Api } from '../../services/api';
import { BulkOperationsView } from '../admin/BulkOperationsView';
import {
  ContractManagementView,
  CustomerAnalyticsView,
  CustomerAutomationView,
  CustomerCommunicationView,
  CustomerComplianceView,
  CustomerLifecycleView,
  CustomerSuccessPlaybooksView,
} from './customers';
import { OrganizationsView } from './OrganizationsView';
import { SecurityModuleView } from './security/SecurityModuleView';
import { SuperAdminFeedbackBacklogView } from './SuperAdminFeedbackBacklogView';
import { SuperAdminFeedbackView } from './SuperAdminFeedbackView';
import { SuperAdminUserManagement } from './SuperAdminUserManagement';
import { SupportModuleView } from './support/SupportModuleView';

interface CustomersModuleProps {
  initialTab?: string;
}

export const CustomersModule: React.FC<CustomersModuleProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'organizations');
  const { setHelpDocumentIdOverride } = useHelpSidePanel();
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
        const feedback = await Api.getFeedback();
        const pending = feedback.filter((f: any) => {
          const s = String(f?.status || '').toUpperCase();
          return s === 'NEW' || s === 'PENDING' || s === 'IN_PROGRESS';
        }).length;
        setPendingFeedbackCount(pending);
      } catch (err) {
        // Silently fail
      }
    };

    fetchOrganizations();
    fetchFeedbackCount();
  }, []);

  useEffect(() => {
    const mapping: Record<string, string> = {
      organizations: 'superadmin_customers_organizations',
      users: 'superadmin_customers_users',
      lifecycle: 'superadmin_customers_lifecycle',
      playbooks: 'superadmin_customers_playbooks',
      contracts: 'superadmin_customers_contracts',
      security: 'superadmin_customers_security',
      support: 'superadmin_customers_support',
      feedback: 'superadmin_customers_feedback',
      'feedback-backlog': 'superadmin_customers_feedback_backlog',
      analytics: 'superadmin_customers_analytics',
      compliance: 'superadmin_customers_compliance',
      automation: 'superadmin_customers_automation',
      communication: 'superadmin_customers_communication',
      'bulk-ops': 'superadmin_customers_bulk_ops',
    };
    setHelpDocumentIdOverride(mapping[activeTab] || 'superadmin_customers');
    return () => setHelpDocumentIdOverride(null);
  }, [activeTab, setHelpDocumentIdOverride]);

  const tabs: Tab[] = [
    { id: 'organizations', label: 'Organizations', icon: <Building2 size={16} /> },
    { id: 'users', label: 'Users', icon: <Users size={16} /> },
    { id: 'lifecycle', label: 'Lifecycle', icon: <RefreshCw size={16} /> },
    { id: 'playbooks', label: 'Playbooks', icon: <BookOpen size={16} /> },
    { id: 'contracts', label: 'Contracts', icon: <FileText size={16} /> },
    { id: 'security', label: 'Security', icon: <Shield size={16} /> },
    { id: 'support', label: 'Support & CS', icon: <HeadphonesIcon size={16} /> },
    {
      id: 'feedback',
      label: 'Feedback',
      icon: <MessageSquare size={16} />,
      badge: pendingFeedbackCount,
    },
    { id: 'feedback-backlog', label: 'Backlog', icon: <ListTodo size={16} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
    { id: 'compliance', label: 'Compliance', icon: <FileCheck size={16} /> },
    { id: 'automation', label: 'Automation', icon: <Zap size={16} /> },
    { id: 'communication', label: 'Communication', icon: <Mail size={16} /> },
    { id: 'bulk-ops', label: 'Bulk Ops', icon: <Upload size={16} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'organizations':
        return <OrganizationsView />;
      case 'users':
        return <SuperAdminUserManagement organizations={organizations} />;
      case 'lifecycle':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <CustomerLifecycleView />
          </div>
        );
      case 'playbooks':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <CustomerSuccessPlaybooksView />
          </div>
        );
      case 'contracts':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <ContractManagementView />
          </div>
        );
      case 'security':
        return <SecurityModuleView />;
      case 'support':
        return <SupportModuleView />;
      case 'feedback':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <SuperAdminFeedbackView />
          </div>
        );
      case 'feedback-backlog':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <SuperAdminFeedbackBacklogView />
          </div>
        );
      case 'analytics':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <CustomerAnalyticsView />
          </div>
        );
      case 'compliance':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <CustomerComplianceView />
          </div>
        );
      case 'automation':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <CustomerAutomationView />
          </div>
        );
      case 'communication':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <CustomerCommunicationView />
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
