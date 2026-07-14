/**
 * CustomersModule - Customer Management
 *
 * Tabs: Organizations | Users | Lifecycle | Playbooks | Contracts | Security | Support & CS | Feedback | Analytics | Compliance | Automation | Communication | Bulk Ops
 */

import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CircleDollarSign,
  Command,
  FileCheck,
  FileText,
  HeadphonesIcon,
  KeyRound,
  ListTodo,
  Mail,
  MessageSquare,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Tab, TabLayout } from '../../components/SuperAdmin/TabLayout';
import { useHelpSidePanel } from '../../contexts/HelpContext';
import { Api } from '../../services/api';
import { BulkOperationsView } from './components/BulkOperationsView';
import {
  ContractManagementView,
  CustomerAnalyticsView,
  CustomerAutomationView,
  CustomerCommunicationView,
  CustomerComplianceView,
  CustomerLifecycleView,
  CustomerSuccessPlaybooksView,
} from './customers';
import { ModuleAccessControlView } from './ModuleAccessControlView';
import { ModuleWaitlistView } from './ModuleWaitlistView';
import { OrganizationResourceManager } from './OrganizationResourceManager';
import { OrganizationsView } from './OrganizationsView';
import { RevenueModule } from './RevenueModule';
import { SecurityModuleView } from './security/SecurityModuleView';
import { SuperAdminFeedbackAnalyticsView } from './SuperAdminFeedbackAnalyticsView';
import { SuperAdminFeedbackBacklogView } from './SuperAdminFeedbackBacklogView';
import { SuperAdminFeedbackView } from './SuperAdminFeedbackView';
import { SuperAdminUserManagement } from './SuperAdminUserManagement';
import { SupportModuleView } from './support/SupportModuleView';
import { TenantCommandCenterView } from './TenantCommandCenterView';

interface CustomersModuleProps {
  initialTab?: string;
  initialCommercialTab?: string;
}

export const CustomersModule: React.FC<CustomersModuleProps> = ({
  initialTab,
  initialCommercialTab,
}) => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(initialTab || 'command-center');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const { setHelpDocumentIdOverride } = useHelpSidePanel();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);

  const resolveRequestedTab = React.useCallback(() => {
    const params = new URLSearchParams(location.search);
    const rawTab = String(params.get('tab') || initialTab || '')
      .trim()
      .toLowerCase();
    if (!rawTab) return null;

    if (rawTab === 'backlog' || rawTab === 'feedback_backlog') {
      return 'feedback-backlog';
    }

    return rawTab;
  }, [initialTab, location.search]);

  useEffect(() => {
    const requestedTab = resolveRequestedTab();
    if (requestedTab) {
      setActiveTab(requestedTab);
      return;
    }
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, resolveRequestedTab]);

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
        console.warn('[CustomersModule] Failed to fetch feedback count', err);
      }
    };

    fetchOrganizations();
    fetchFeedbackCount();
  }, []);

  useEffect(() => {
    const mapping: Record<string, string> = {
      'command-center': 'superadmin_customers_command_center',
      organizations: 'superadmin_customers_organizations',
      users: 'superadmin_customers_users',
      lifecycle: 'superadmin_customers_lifecycle',
      playbooks: 'superadmin_customers_playbooks',
      contracts: 'superadmin_customers_contracts',
      commercial: 'superadmin_customers_commercial',
      limits: 'superadmin_customers_limits',
      security: 'superadmin_customers_security',
      support: 'superadmin_customers_support',
      feedback: 'superadmin_customers_feedback',
      'feedback-backlog': 'superadmin_customers_feedback_backlog',
      'feedback-analytics': 'superadmin_customers_feedback_analytics',
      analytics: 'superadmin_customers_analytics',
      compliance: 'superadmin_customers_compliance',
      automation: 'superadmin_customers_automation',
      communication: 'superadmin_customers_communication',
      'bulk-ops': 'superadmin_customers_bulk_ops',
      waitlist: 'superadmin_customers_waitlist',
      'module-access': 'superadmin_customers_module_access',
    };
    setHelpDocumentIdOverride(mapping[activeTab] || 'superadmin_customers');
    return () => setHelpDocumentIdOverride(null);
  }, [activeTab, setHelpDocumentIdOverride]);

  const tabs: Tab[] = [
    { id: 'command-center', label: 'Command Center', icon: <Command size={16} /> },
    { id: 'organizations', label: 'Organizations', icon: <Building2 size={16} /> },
    { id: 'users', label: 'Users', icon: <Users size={16} /> },
    { id: 'lifecycle', label: 'Lifecycle', icon: <RefreshCw size={16} /> },
    { id: 'playbooks', label: 'Playbooks', icon: <BookOpen size={16} /> },
    { id: 'contracts', label: 'Contracts', icon: <FileText size={16} /> },
    { id: 'commercial', label: 'Commercial', icon: <CircleDollarSign size={16} /> },
    { id: 'limits', label: 'Limits & Budgets', icon: <SlidersHorizontal size={16} /> },
    { id: 'security', label: 'Security', icon: <Shield size={16} /> },
    { id: 'support', label: 'Support & CS', icon: <HeadphonesIcon size={16} /> },
    {
      id: 'feedback',
      label: 'Feedback',
      icon: <MessageSquare size={16} />,
      badge: pendingFeedbackCount,
    },
    { id: 'feedback-backlog', label: 'Backlog', icon: <ListTodo size={16} /> },
    { id: 'feedback-analytics', label: 'Feedback Analytics', icon: <BarChart3 size={16} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
    { id: 'compliance', label: 'Compliance', icon: <FileCheck size={16} /> },
    { id: 'automation', label: 'Automation', icon: <Zap size={16} /> },
    { id: 'communication', label: 'Communication', icon: <Mail size={16} /> },
    { id: 'bulk-ops', label: 'Bulk Ops', icon: <Upload size={16} /> },
    { id: 'waitlist', label: 'Module Waitlist', icon: <Bell size={16} /> },
    { id: 'module-access', label: 'Module Access', icon: <KeyRound size={16} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'command-center':
        return <TenantCommandCenterView />;
      case 'organizations':
        return (
          <OrganizationsView
            onViewUsers={(organizationId) => {
              setSelectedOrganizationId(organizationId);
              setActiveTab('users');
            }}
          />
        );
      case 'users':
        return (
          <SuperAdminUserManagement
            organizations={organizations}
            selectedOrganizationId={selectedOrganizationId}
            onSelectedOrganizationChange={setSelectedOrganizationId}
          />
        );
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
      case 'commercial':
        return <RevenueModule initialTab={initialCommercialTab || 'billing'} />;
      case 'limits':
        return <OrganizationResourceManager />;
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
      case 'feedback-analytics':
        return (
          <div className="p-6 overflow-y-auto h-full">
            <SuperAdminFeedbackAnalyticsView />
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
      case 'waitlist':
        return <ModuleWaitlistView />;
      case 'module-access':
        return <ModuleAccessControlView />;
      default:
        return null;
    }
  };

  return (
    <TabLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="Tenant & User Operations"
      subtitle="Operate tenants through one control plane for lifecycle, users, billing, quotas, and risk"
    >
      {renderContent()}
    </TabLayout>
  );
};

export default CustomersModule;
