/**
 * AdminView - Main Admin Panel with Two-Column Layout (Settings-style)
 *
 * Architecture:
 * - Left sidebar (280px) with grouped navigation and search
 * - Right content area with dynamic component rendering
 *
 * Based on SettingsView pattern for consistent UX.
 */

import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  CreditCard,
  Crown,
  Database,
  Download,
  FileText,
  Globe,
  History,
  Key,
  Layers,
  LayoutDashboard,
  Lock,
  Mail,
  MessageSquare,
  Palette,
  PlayCircle,
  Settings,
  Shield,
  TrendingUp,
  UserPlus,
  Users,
  UsersRound,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

// UI components
import { Button } from '../../components/ui/primitives/Button';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { AppView, Project, User } from '../../types';

// New AI Admin Components (6-tab structure) - Lazy Loaded
const AccessLimitsTab = React.lazy(() =>
  import('../../components/Admin/AI').then((m) => ({ default: m.AccessLimitsTab }))
);
const AuditComplianceTab = React.lazy(() =>
  import('../../components/Admin/AI').then((m) => ({ default: m.AuditComplianceTab }))
);
const FeaturesPrivacyTab = React.lazy(() =>
  import('../../components/Admin/AI').then((m) => ({ default: m.FeaturesPrivacyTab }))
);
const HealthMonitoringTab = React.lazy(() =>
  import('../../components/Admin/AI').then((m) => ({ default: m.HealthMonitoringTab }))
);
const ModelsProvidersTab = React.lazy(() =>
  import('../../components/Admin/AI').then((m) => ({ default: m.ModelsProvidersTab }))
);
const PolicyGovernanceTab = React.lazy(() =>
  import('../../components/Admin/AI').then((m) => ({ default: m.PolicyGovernanceTab }))
);

const SecuritySettings = React.lazy(() =>
  import('../../components/Admin/SecuritySettings').then((m) => ({ default: m.SecuritySettings }))
);

// Lazy load views
const AdminAnalyticsView = React.lazy(() =>
  import('./AdminAnalyticsView').then((m) => ({ default: m.AdminAnalyticsView }))
);
const AdminBillingManagement = React.lazy(() =>
  import('./AdminBillingManagement').then((m) => ({ default: m.AdminBillingManagement }))
);
const AdminDashboard = React.lazy(() =>
  import('./AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const AdminFeedbackView = React.lazy(() =>
  import('./AdminFeedbackView').then((m) => ({ default: m.AdminFeedbackView }))
);
const AdminKnowledgeView = React.lazy(() =>
  import('./AdminKnowledgeView').then((m) => ({ default: m.AdminKnowledgeView }))
);
const AdminMetricsDashboardView = React.lazy(() =>
  import('./AdminMetricsDashboardView').then((m) => ({ default: m.AdminMetricsDashboardView }))
);
const AdminProjectManagement = React.lazy(() =>
  import('./AdminProjectManagement').then((m) => ({ default: m.AdminProjectManagement }))
);
const AdminSecuritySettings = React.lazy(() =>
  import('./AdminSecuritySettings').then((m) => ({ default: m.AdminSecuritySettings }))
);
const AdminSettingsConsultants = React.lazy(() =>
  import('./AdminSettingsConsultants').then((m) => ({ default: m.AdminSettingsConsultants }))
);
const AdminUserManagement = React.lazy(() =>
  import('./AdminUserManagement').then((m) => ({ default: m.AdminUserManagement }))
);
const ApiKeysManagementView = React.lazy(() =>
  import('./ApiKeysManagementView').then((m) => ({ default: m.ApiKeysManagementView }))
);
const AuditLogView = React.lazy(() =>
  import('./AuditLogView').then((m) => ({ default: m.AuditLogView }))
);
const BillingSettingsView = React.lazy(() =>
  import('./BillingSettingsView').then((m) => ({ default: m.BillingSettingsView }))
);
const BulkOperationsView = React.lazy(() =>
  import('./BulkOperationsView').then((m) => ({ default: m.BulkOperationsView }))
);
const CostAllocationView = React.lazy(() =>
  import('./CostAllocationView').then((m) => ({ default: m.CostAllocationView }))
);
const DataManagementView = React.lazy(() =>
  import('./DataManagementView').then((m) => ({ default: m.DataManagementView }))
);
const InvitationsManagement = React.lazy(() =>
  import('./InvitationsManagement').then((m) => ({ default: m.InvitationsManagement }))
);
const InvoicesView = React.lazy(() =>
  import('./InvoicesView').then((m) => ({ default: m.InvoicesView }))
);
const OrganizationProfileView = React.lazy(() =>
  import('./OrganizationProfileView').then((m) => ({ default: m.OrganizationProfileView }))
);
const OwnershipManagementView = React.lazy(() =>
  import('./OwnershipManagementView').then((m) => ({ default: m.OwnershipManagementView }))
);
const PaymentMethodsView = React.lazy(() =>
  import('./PaymentMethodsView').then((m) => ({ default: m.PaymentMethodsView }))
);
const PlaybookRunsView = React.lazy(() =>
  import('./PlaybookRunsView').then((m) => ({ default: m.PlaybookRunsView }))
);
const RolesPermissionsView = React.lazy(() =>
  import('./RolesPermissionsView').then((m) => ({ default: m.RolesPermissionsView }))
);
const SpendingAlertsView = React.lazy(() =>
  import('./SpendingAlertsView').then((m) => ({ default: m.SpendingAlertsView }))
);
const UsageDashboardView = React.lazy(() =>
  import('./UsageDashboardView').then((m) => ({ default: m.UsageDashboardView }))
);
const UserGroupsView = React.lazy(() =>
  import('./UserGroupsView').then((m) => ({ default: m.UserGroupsView }))
);

// Compliance components - using wrappers with API integration
const GDPRComplianceWrapper = React.lazy(() =>
  import('../../components/Admin/compliance/GDPRComplianceWrapper').then((m) => ({
    default: m.GDPRComplianceWrapper,
  }))
);
const CookieSettingsWrapper = React.lazy(() =>
  import('../../components/Admin/compliance/CookieSettingsWrapper').then((m) => ({
    default: m.CookieSettingsWrapper,
  }))
);
const ComplianceDashboard = React.lazy(() =>
  import('../../components/Admin/ComplianceDashboard').then((m) => ({
    default: m.ComplianceDashboard,
  }))
);

// Organization components
const RegionalSettingsView = React.lazy(() =>
  import('../../components/settings/RegionalSettings').then((m) => ({
    default: m.RegionalSettings,
  }))
);
const FiscalYearSettings = React.lazy(() =>
  import('../../components/Admin/organization/FiscalYearSettings').then((m) => ({
    default: m.FiscalYearSettings,
  }))
);
const DataHostingSettings = React.lazy(() =>
  import('../../components/Admin/organization/DataHostingSettings').then((m) => ({
    default: m.DataHostingSettings,
  }))
);
const ApprovedDomainsSettings = React.lazy(() =>
  import('../../components/Admin/organization/ApprovedDomainsSettings').then((m) => ({
    default: m.ApprovedDomainsSettings,
  }))
);

// ============================================================================
// Types
// ============================================================================

export type AdminSection =
  // Overview
  | 'dashboard'
  | 'metrics'
  | 'analytics'
  // Organization
  | 'profile'
  | 'branding'
  | 'ownership'
  | 'regional'
  | 'fiscal-year'
  | 'data-hosting'
  | 'approved-domains'
  // Team
  | 'users'
  | 'groups'
  | 'invitations'
  | 'roles'
  | 'consultants'
  // Workspace
  | 'projects'
  | 'knowledge'
  | 'playbooks'
  | 'bulk-ops'
  // AI
  | 'ai-models'
  | 'ai-health'
  | 'ai-policy'
  | 'ai-access'
  | 'ai-features'
  | 'ai-audit'
  // Billing
  | 'usage'
  | 'plan'
  | 'payment'
  | 'invoices'
  | 'alerts'
  | 'billing-settings'
  | 'cost-allocation'
  // Security
  | 'security-settings'
  | 'authentication'
  | 'api-keys'
  | 'audit-log'
  | 'data-management'
  // Compliance
  | 'compliance-overview'
  | 'gdpr'
  | 'cookie-settings'
  | 'data-requests'
  // Feedback
  | 'feedback';

interface NavItem {
  id: AdminSection;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// Section metadata for headers
const sectionMeta: Record<AdminSection, { title: string; subtitle: string }> = {
  // Overview
  dashboard: { title: 'Dashboard', subtitle: 'Organization overview and quick stats' },
  metrics: { title: 'Metrics', subtitle: 'Key performance indicators and trends' },
  analytics: { title: 'Analytics', subtitle: 'Detailed analytics and reports' },
  // Organization
  profile: { title: 'Organization Profile', subtitle: 'Company information and branding' },
  branding: { title: 'Branding', subtitle: 'Logo, colors, and visual identity' },
  ownership: { title: 'Ownership', subtitle: 'Organization owners and transfer' },
  regional: { title: 'Regional Settings', subtitle: 'Timezone, date format, and localization' },
  'fiscal-year': { title: 'Fiscal Year', subtitle: 'Financial calendar settings' },
  'data-hosting': { title: 'Data Hosting', subtitle: 'Data residency and hosting region' },
  'approved-domains': { title: 'Approved Domains', subtitle: 'Email domain restrictions' },
  // Team
  users: { title: 'Users', subtitle: 'Manage team members and access' },
  groups: { title: 'Teams', subtitle: 'Organize users into teams' },
  invitations: { title: 'Invitations', subtitle: 'Pending invitations and approvals' },
  roles: { title: 'Roles & Permissions', subtitle: 'Access control configuration' },
  consultants: { title: 'Consultants', subtitle: 'External consultant access' },
  // Workspace
  projects: { title: 'Projects', subtitle: 'Project management and settings' },
  knowledge: { title: 'Knowledge Base', subtitle: 'Organizational knowledge and documents' },
  playbooks: { title: 'Playbooks', subtitle: 'Automation playbooks and runs' },
  'bulk-ops': { title: 'Bulk Operations', subtitle: 'Mass actions and imports' },
  // AI
  'ai-models': { title: 'AI Models', subtitle: 'Configure AI models and providers' },
  'ai-health': { title: 'AI Health', subtitle: 'Monitor AI performance and status' },
  'ai-policy': { title: 'AI Policy', subtitle: 'Usage policies and governance' },
  'ai-access': { title: 'AI Access', subtitle: 'Token limits and user quotas' },
  'ai-features': { title: 'AI Features', subtitle: 'Enable or disable AI features' },
  'ai-audit': { title: 'AI Audit', subtitle: 'AI usage logs and compliance' },
  // Billing
  usage: { title: 'Usage Dashboard', subtitle: 'Current usage and consumption' },
  plan: { title: 'Plan & Subscription', subtitle: 'Current plan and upgrade options' },
  payment: { title: 'Payment Methods', subtitle: 'Cards and billing information' },
  invoices: { title: 'Invoices', subtitle: 'Billing history and receipts' },
  alerts: { title: 'Spending Alerts', subtitle: 'Budget limits and notifications' },
  'billing-settings': { title: 'Billing Settings', subtitle: 'Invoice preferences and tax info' },
  'cost-allocation': { title: 'Cost Allocation', subtitle: 'Department and project billing' },
  // Security
  'security-settings': { title: 'Security Settings', subtitle: 'General security configuration' },
  authentication: { title: 'SSO & Authentication', subtitle: 'Single sign-on and login settings' },
  'api-keys': { title: 'API Keys', subtitle: 'Manage API access tokens' },
  'audit-log': { title: 'Audit Log', subtitle: 'Security events and changes' },
  'data-management': { title: 'Data Management', subtitle: 'Export and retention policies' },
  // Compliance
  'compliance-overview': { title: 'Compliance Overview', subtitle: 'Regulatory compliance status' },
  gdpr: { title: 'GDPR', subtitle: 'GDPR compliance settings' },
  'cookie-settings': { title: 'Cookie Settings', subtitle: 'Cookie consent and preferences' },
  'data-requests': { title: 'Data Requests', subtitle: 'Subject access and deletion requests' },
  // Feedback
  feedback: { title: 'Feedback', subtitle: 'User feedback and feature requests' },
};

interface AdminViewProps {
  currentUser: User;
  onNavigate: (view: AppView) => void;
}

// ============================================================================
// Admin Sidebar Component (inline, like SettingsSidebar)
// ============================================================================

interface AdminSidebarInlineProps {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
}

const AdminSidebarInline: React.FC<AdminSidebarInlineProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['overview']));

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        id: 'overview',
        label: 'OVERVIEW',
        items: [
          {
            id: 'dashboard',
            label: t('admin.sections.dashboard', 'Dashboard'),
            icon: LayoutDashboard,
          },
          { id: 'metrics', label: t('admin.sections.metrics', 'Metrics'), icon: TrendingUp },
          { id: 'analytics', label: t('admin.sections.analytics', 'Analytics'), icon: BarChart3 },
        ],
      },
      {
        id: 'organization',
        label: 'ORGANIZATION',
        items: [
          {
            id: 'profile',
            label: t('admin.sections.profile', 'Profile & Branding'),
            icon: Building2,
          },
          { id: 'ownership', label: t('admin.sections.ownership', 'Ownership'), icon: Crown },
          { id: 'regional', label: t('admin.sections.regional', 'Regional Settings'), icon: Globe },
          {
            id: 'fiscal-year',
            label: t('admin.sections.fiscalYear', 'Fiscal Year'),
            icon: BarChart3,
          },
          {
            id: 'data-hosting',
            label: t('admin.sections.dataHosting', 'Data Hosting'),
            icon: Database,
          },
          {
            id: 'approved-domains',
            label: t('admin.sections.approvedDomains', 'Approved Domains'),
            icon: Mail,
          },
        ],
      },
      {
        id: 'team',
        label: 'TEAM',
        items: [
          { id: 'users', label: t('admin.sections.users', 'Users'), icon: Users },
          { id: 'groups', label: t('admin.sections.groups', 'Teams'), icon: UsersRound },
          {
            id: 'invitations',
            label: t('admin.sections.invitations', 'Invitations'),
            icon: UserPlus,
          },
          { id: 'roles', label: t('admin.sections.roles', 'Roles & Permissions'), icon: Key },
          {
            id: 'consultants',
            label: t('admin.sections.consultants', 'Consultants'),
            icon: Briefcase,
          },
        ],
      },
      {
        id: 'workspace',
        label: 'WORKSPACE',
        items: [
          { id: 'projects', label: t('admin.sections.projects', 'Projects'), icon: Briefcase },
          {
            id: 'knowledge',
            label: t('admin.sections.knowledge', 'Knowledge Base'),
            icon: BookOpen,
          },
          { id: 'playbooks', label: t('admin.sections.playbooks', 'Playbooks'), icon: PlayCircle },
          { id: 'bulk-ops', label: t('admin.sections.bulkOps', 'Bulk Operations'), icon: Layers },
        ],
      },
      {
        id: 'ai',
        label: 'AI & INTELLIGENCE',
        items: [
          {
            id: 'ai-models',
            label: t('admin.sections.aiModels', 'Models & Providers'),
            icon: Brain,
          },
          {
            id: 'ai-health',
            label: t('admin.sections.aiHealth', 'Health & Monitoring'),
            icon: Activity,
          },
          {
            id: 'ai-policy',
            label: t('admin.sections.aiPolicy', 'Policy & Governance'),
            icon: Shield,
          },
          { id: 'ai-access', label: t('admin.sections.aiAccess', 'Access & Limits'), icon: Users },
          {
            id: 'ai-features',
            label: t('admin.sections.aiFeatures', 'Features & Privacy'),
            icon: Settings,
          },
          {
            id: 'ai-audit',
            label: t('admin.sections.aiAudit', 'Audit & Compliance'),
            icon: History,
          },
        ],
      },
      {
        id: 'billing',
        label: 'BILLING',
        items: [
          { id: 'usage', label: t('admin.sections.usage', 'Usage Dashboard'), icon: Activity },
          { id: 'plan', label: t('admin.sections.plan', 'Plan & Subscription'), icon: CreditCard },
          {
            id: 'payment',
            label: t('admin.sections.payment', 'Payment Methods'),
            icon: CreditCard,
          },
          { id: 'invoices', label: t('admin.sections.invoices', 'Invoices'), icon: FileText },
          { id: 'alerts', label: t('admin.sections.alerts', 'Spending Alerts'), icon: Bell },
          {
            id: 'billing-settings',
            label: t('admin.sections.billingSettings', 'Settings'),
            icon: Settings,
          },
          {
            id: 'cost-allocation',
            label: t('admin.sections.costAllocation', 'Cost Allocation'),
            icon: Building2,
          },
        ],
      },
      {
        id: 'security',
        label: 'SECURITY',
        items: [
          {
            id: 'security-settings',
            label: t('admin.sections.securitySettings', 'Security Settings'),
            icon: Shield,
          },
          {
            id: 'authentication',
            label: t('admin.sections.authentication', 'SSO & Auth'),
            icon: Lock,
          },
          { id: 'api-keys', label: t('admin.sections.apiKeys', 'API Keys'), icon: Key },
          { id: 'audit-log', label: t('admin.sections.auditLog', 'Audit Log'), icon: History },
          {
            id: 'data-management',
            label: t('admin.sections.dataManagement', 'Data Management'),
            icon: Download,
          },
        ],
      },
      {
        id: 'compliance',
        label: 'COMPLIANCE',
        items: [
          {
            id: 'compliance-overview',
            label: t('admin.sections.complianceOverview', 'Overview'),
            icon: Shield,
          },
          { id: 'gdpr', label: t('admin.sections.gdpr', 'GDPR'), icon: FileText },
          {
            id: 'cookie-settings',
            label: t('admin.sections.cookieSettings', 'Cookie Settings'),
            icon: Settings,
          },
          {
            id: 'data-requests',
            label: t('admin.sections.dataRequests', 'Data Requests'),
            icon: Download,
          },
        ],
      },
      {
        id: 'feedback',
        label: 'FEEDBACK',
        items: [
          {
            id: 'feedback',
            label: t('admin.sections.feedback', 'User Feedback'),
            icon: MessageSquare,
          },
        ],
      },
    ],
    [t]
  );

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Find which group contains the active section and expand it
  useEffect(() => {
    for (const group of navGroups) {
      if (group.items.some((item) => item.id === activeSection)) {
        setExpandedGroups((prev) => new Set([...prev, group.id]));
        break;
      }
    }
  }, [activeSection, navGroups]);

  return (
    <div className="flex-1 overflow-y-auto px-3">
      <nav className="space-y-1">
        {navGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.id);

          return (
            <div key={group.id}>
              {/* Group Header - Clickable, no icon */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-2 py-2.5 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-300 transition-colors"
              >
                <span>{group.label}</span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Group Items - Animated collapse */}
              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="space-y-0.5 pb-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.id === activeSection;

                    return (
                      <button
                        key={item.id}
                        onClick={() => onSectionChange(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                          isActive
                            ? 'bg-violet-600/20 text-violet-300 font-medium'
                            : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800/20 hover:text-white'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-500 dark:text-slate-400'}`}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );
};

// ============================================================================
// Main AdminView Component
// ============================================================================

export const AdminView: React.FC<AdminViewProps> = ({ currentUser, onNavigate }) => {
  const { setCurrentView } = useAppStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Load initial data
  useEffect(() => {
    const initData = async () => {
      try {
        const [u, p] = await Promise.all([Api.getUsers(), Api.getProjects()]);
        setUsers(u);
        setProjects(p as any);
      } catch (e) {
        console.error('Failed to load initial admin data', e);
      }
    };
    initData();
  }, []);

  // Handle section change
  const handleSectionChange = useCallback((section: AdminSection) => {
    setActiveSection(section);
  }, []);

  // Handle back to dashboard
  const handleBackToDashboard = useCallback(() => {
    setCurrentView(AppView.DASHBOARD);
    navigate('/dashboard');
  }, [setCurrentView, navigate]);

  // Get current section metadata
  const currentMeta = useMemo(() => {
    const meta = sectionMeta[activeSection];
    return {
      title: t(`admin.sections.${activeSection}.title`, meta.title),
      subtitle: t(`admin.sections.${activeSection}.subtitle`, meta.subtitle),
    };
  }, [activeSection, t]);

  // Render content based on active section
  const renderContent = useCallback(() => {
    const FallbackLoader = () => (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
          <Activity className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading module...</span>
        </div>
      </div>
    );

    return (
      <React.Suspense fallback={<FallbackLoader />}>
        {(() => {
          switch (activeSection) {
            // Overview
            case 'dashboard':
              return <AdminDashboard users={users} projects={projects} />;
            case 'metrics':
              return <AdminMetricsDashboardView />;
            case 'analytics':
              return <AdminAnalyticsView />;

            // Organization
            case 'profile':
            case 'branding':
              return <OrganizationProfileView />;
            case 'ownership':
              return <OwnershipManagementView />;
            case 'regional':
              return <RegionalSettingsView currentUser={currentUser} onUpdateUser={() => {}} />;
            case 'fiscal-year':
              return <FiscalYearSettings config={{ startMonth: 1, endMonth: 12 }} onChange={() => {}} onSave={async () => {}} />;
            case 'data-hosting':
              return <DataHostingSettings config={{ region: 'eu', compliance: [] }} onChange={() => {}} onSave={async () => {}} />;
            case 'approved-domains':
              return (
                <ApprovedDomainsSettings
                  domains={[]}
                  onAdd={async (_domain: string, _autoJoin: boolean) => {}}
                  onUpdate={async (_id: string, _updates: any) => {}}
                  onDelete={async (_id: string) => {}}
                  onVerify={async (_id: string) => true}
                />
              );

            // Team
            case 'users':
              return <AdminUserManagement initialUsers={users} />;
            case 'groups':
              return <UserGroupsView />;
            case 'invitations':
              return <InvitationsManagement />;
            case 'roles':
              return <RolesPermissionsView />;
            case 'consultants':
              return <AdminSettingsConsultants />;

            // Workspace
            case 'projects':
              return <AdminProjectManagement initialProjects={projects} />;
            case 'knowledge':
              return <AdminKnowledgeView />;
            case 'playbooks':
              return <PlaybookRunsView />;
            case 'bulk-ops':
              return <BulkOperationsView />;

            // AI
            case 'ai-models':
              return <ModelsProvidersTab />;
            case 'ai-health':
              return <HealthMonitoringTab />;
            case 'ai-policy':
              return <PolicyGovernanceTab />;
            case 'ai-access':
              return <AccessLimitsTab />;
            case 'ai-features':
              return <FeaturesPrivacyTab />;
            case 'ai-audit':
              return <AuditComplianceTab />;

            // Billing
            case 'usage':
              return <UsageDashboardView />;
            case 'plan':
              return <AdminBillingManagement />;
            case 'payment':
              return <PaymentMethodsView />;
            case 'invoices':
              return <InvoicesView />;
            case 'alerts':
              return <SpendingAlertsView />;
            case 'billing-settings':
              return <BillingSettingsView />;
            case 'cost-allocation':
              return <CostAllocationView />;

            // Security
            case 'security-settings':
              return <SecuritySettings />;
            case 'authentication':
              return <AdminSecuritySettings />;
            case 'api-keys':
              return <ApiKeysManagementView />;
            case 'audit-log':
              return <AuditLogView />;
            case 'data-management':
              return <DataManagementView />;

            // Compliance
            case 'compliance-overview':
              return <ComplianceDashboard />;
            case 'gdpr':
              return <GDPRComplianceWrapper />;
            case 'cookie-settings':
              return <CookieSettingsWrapper />;
            case 'data-requests':
              return <DataManagementView />;

            // Feedback
            case 'feedback':
              return <AdminFeedbackView />;

            default:
              return (
                <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
                  {t('admin.sectionNotFound', 'Section not found')}
                </div>
              );
          }
        })()}
      </React.Suspense>
    );
  }, [activeSection, currentUser, users, projects, t]);

  return (
    <div className="flex h-full bg-navy-950">
      {/* Left Sidebar - Dark Navy (matching Settings) */}
      <div className="w-[280px] flex-shrink-0 flex flex-col bg-navy-950">
        {/* Header - Clean style (no icon, bold title) */}
        <div className="px-5 pt-5 pb-4">
          <h1 className="text-lg font-bold text-white tracking-wide">
            {t('admin.title', 'ADMIN')}
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
            {t('admin.subtitle', 'Organization settings')}
          </p>
        </div>

        {/* Navigation */}
        <AdminSidebarInline activeSection={activeSection} onSectionChange={handleSectionChange} />

        {/* Footer */}
        <div className="p-3 border-t border-white/5">
          <button
            onClick={handleBackToDashboard}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('admin.backToApp', 'Back to App')}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-navy-900">
        {/* Header */}
        <header className="flex items-center justify-between px-6 h-14 border-b border-white/5 bg-navy-900">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToDashboard}
              className="text-slate-400 dark:text-slate-500 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('admin.backToDashboard', 'Back to Dashboard')}
            </Button>
            <div className="h-5 w-px bg-white/10" />
            <div>
              <h1 className="text-lg font-semibold text-white">{currentMeta.title}</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500">{currentMeta.subtitle}</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-5xl mx-auto w-full">
            <div className="bg-navy-800/50 rounded-xl border border-white/5 p-6">
              {renderContent()}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default AdminView;
