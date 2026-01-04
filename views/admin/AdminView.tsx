/**
 * AdminView - Main Admin Panel with 7-Module Tab Structure
 *
 * Modules: Overview | Organization | Team | Workspace | AI | Billing | Security
 *
 * Best practices from: ClickUp, HubSpot, Replit, Notion
 * - Owner/Billing Admin role management
 * - Organization profile & branding
 * - User groups & permissions
 * - Spending controls & alerts
 */

import {
    Activity,
    BarChart3,
    Bell,
    BookOpen,
    Brain,
    Briefcase,
    Building2,
    CreditCard,
    Crown,
    Download,
    FileText,
    Globe,
    HelpCircle,
    History,
    Key,
    Layers,
    LayoutDashboard,
    Lock,
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
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// New AI Admin Components (6-tab structure)
// New AI Admin Components (6-tab structure) - Lazy Loaded
const AccessLimitsTab = React.lazy(() =>
    import('../../components/Admin/AI').then((m) => ({ default: m.AccessLimitsTab })),
);
const AuditComplianceTab = React.lazy(() =>
    import('../../components/Admin/AI').then((m) => ({ default: m.AuditComplianceTab })),
);
const FeaturesPrivacyTab = React.lazy(() =>
    import('../../components/Admin/AI').then((m) => ({ default: m.FeaturesPrivacyTab })),
);
const HealthMonitoringTab = React.lazy(() =>
    import('../../components/Admin/AI').then((m) => ({ default: m.HealthMonitoringTab })),
);
const ModelsProvidersTab = React.lazy(() =>
    import('../../components/Admin/AI').then((m) => ({ default: m.ModelsProvidersTab })),
);
const PolicyGovernanceTab = React.lazy(() =>
    import('../../components/Admin/AI').then((m) => ({ default: m.PolicyGovernanceTab })),
);

const AIMissionControl = React.lazy(() =>
    import('../../components/Admin/AIMissionControl').then((m) => ({ default: m.AIMissionControl })),
);
const AuditLogViewer = React.lazy(() =>
    import('../../components/Admin/AuditLogViewer').then((m) => ({ default: m.AuditLogViewer })),
);
const SecuritySettings = React.lazy(() =>
    import('../../components/Admin/SecuritySettings').then((m) => ({ default: m.SecuritySettings })),
);
const WorkModeSettings = React.lazy(() =>
    import('../../components/Admin/WorkModeSettings').then((m) => ({ default: m.WorkModeSettings })),
);

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { AppView, Project, User } from '../../types';

// Lazy load views
const AdminAnalyticsView = React.lazy(() =>
    import('./AdminAnalyticsView').then((m) => ({ default: m.AdminAnalyticsView })),
);
const AdminBillingManagement = React.lazy(() =>
    import('./AdminBillingManagement').then((m) => ({ default: m.AdminBillingManagement })),
);
const AdminDashboard = React.lazy(() => import('./AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminFeedbackView = React.lazy(() =>
    import('./AdminFeedbackView').then((m) => ({ default: m.AdminFeedbackView })),
);
const AdminKnowledgeView = React.lazy(() =>
    import('./AdminKnowledgeView').then((m) => ({ default: m.AdminKnowledgeView })),
);
const AdminLLMView = React.lazy(() => import('./AdminLLMView').then((m) => ({ default: m.AdminLLMView })));
const AdminMetricsDashboardView = React.lazy(() =>
    import('./AdminMetricsDashboardView').then((m) => ({ default: m.AdminMetricsDashboardView })),
);
const AdminProjectManagement = React.lazy(() =>
    import('./AdminProjectManagement').then((m) => ({ default: m.AdminProjectManagement })),
);
const AdminSecuritySettings = React.lazy(() =>
    import('./AdminSecuritySettings').then((m) => ({ default: m.AdminSecuritySettings })),
);
const AdminSettingsConsultants = React.lazy(() =>
    import('./AdminSettingsConsultants').then((m) => ({ default: m.AdminSettingsConsultants })),
);
const AdminTokenPackages = React.lazy(() =>
    import('./AdminTokenPackages').then((m) => ({ default: m.AdminTokenPackages })),
);
const AdminUserManagement = React.lazy(() =>
    import('./AdminUserManagement').then((m) => ({ default: m.AdminUserManagement })),
);
const ApiKeysManagementView = React.lazy(() =>
    import('./ApiKeysManagementView').then((m) => ({ default: m.ApiKeysManagementView })),
);
const AuditLogView = React.lazy(() => import('./AuditLogView').then((m) => ({ default: m.AuditLogView })));
const BillingSettingsView = React.lazy(() =>
    import('./BillingSettingsView').then((m) => ({ default: m.BillingSettingsView })),
);
const BulkOperationsView = React.lazy(() =>
    import('./BulkOperationsView').then((m) => ({ default: m.BulkOperationsView })),
);
const CostAllocationView = React.lazy(() =>
    import('./CostAllocationView').then((m) => ({ default: m.CostAllocationView })),
);
const DataManagementView = React.lazy(() =>
    import('./DataManagementView').then((m) => ({ default: m.DataManagementView })),
);
const HelpAnalyticsDashboard = React.lazy(() =>
    import('./HelpAnalyticsDashboard').then((m) => ({ default: m.HelpAnalyticsDashboard })),
);
const InvitationsManagement = React.lazy(() =>
    import('./InvitationsManagement').then((m) => ({ default: m.InvitationsManagement })),
);
const InvoicesView = React.lazy(() => import('./InvoicesView').then((m) => ({ default: m.InvoicesView })));
const OrgAISettingsView = React.lazy(() =>
    import('./OrgAISettingsView').then((m) => ({ default: m.OrgAISettingsView })),
);
const OrganizationProfileView = React.lazy(() =>
    import('./OrganizationProfileView').then((m) => ({ default: m.OrganizationProfileView })),
);
const OwnershipManagementView = React.lazy(() =>
    import('./OwnershipManagementView').then((m) => ({ default: m.OwnershipManagementView })),
);
const PaymentMethodsView = React.lazy(() =>
    import('./PaymentMethodsView').then((m) => ({ default: m.PaymentMethodsView })),
);
const PlaybookRunsView = React.lazy(() => import('./PlaybookRunsView').then((m) => ({ default: m.PlaybookRunsView })));
const ProjectDetailsView = React.lazy(() =>
    import('./ProjectDetailsView').then((m) => ({ default: m.ProjectDetailsView })),
);
const RolesPermissionsView = React.lazy(() =>
    import('./RolesPermissionsView').then((m) => ({ default: m.RolesPermissionsView })),
);
const SpendingAlertsView = React.lazy(() =>
    import('./SpendingAlertsView').then((m) => ({ default: m.SpendingAlertsView })),
);
const UsageDashboardView = React.lazy(() =>
    import('./UsageDashboardView').then((m) => ({ default: m.UsageDashboardView })),
);
const UserGroupsView = React.lazy(() => import('./UserGroupsView').then((m) => ({ default: m.UserGroupsView })));

// Admin section type - expanded to 8 modules (with dedicated Feedback module)
type AdminSection = 'overview' | 'organization' | 'team' | 'workspace' | 'ai' | 'billing' | 'security' | 'feedback';

// Map AppView to AdminSection
const getAdminSection = (view: AppView): AdminSection => {
    // New module-based navigation (8 modules)
    if (view === AppView.ADMIN_OVERVIEW) return 'overview';
    if (view === AppView.ADMIN_ORGANIZATION) return 'organization';
    if (view === AppView.ADMIN_TEAM) return 'team';
    if (view === AppView.ADMIN_WORKSPACE) return 'workspace';
    if (view === AppView.ADMIN_AI) return 'ai';
    if (view === AppView.ADMIN_BILLING) return 'billing';
    if (view === AppView.ADMIN_SECURITY) return 'security';
    if (view === AppView.ADMIN_FEEDBACK) return 'feedback';
    if (view === AppView.ADMIN_SETTINGS) return 'security'; // Legacy redirect

    // Legacy views mapping
    if (view === AppView.ADMIN_DASHBOARD || view === AppView.ADMIN_METRICS || view === AppView.ADMIN_ANALYTICS) {
        return 'overview';
    }
    // Organization module
    if (view === AppView.ADMIN_ORGANIZATION_SETTINGS) {
        return 'organization';
    }
    // Team module
    if (
        view === AppView.ADMIN_USERS ||
        view === AppView.ADMIN_INVITATIONS ||
        view === AppView.ADMIN_WORK_MODE ||
        view === AppView.ADMIN_SETTINGS_CONSULTANTS
    ) {
        return 'team';
    }
    // Workspace module
    if (
        view === AppView.ADMIN_PROJECTS ||
        view === AppView.ADMIN_PROJECT_DETAILS ||
        view === AppView.ADMIN_KNOWLEDGE ||
        view === AppView.ADMIN_PLAYBOOK_RUNS ||
        view === AppView.ADMIN_BULK_OPERATIONS
    ) {
        return 'workspace';
    }
    // AI module
    if (
        view === AppView.ADMIN_LLM ||
        view === AppView.ADMIN_AI_HEALTH ||
        view === AppView.HELP_ANALYTICS ||
        view === AppView.ADMIN_TOKEN_MANAGEMENT
    ) {
        return 'ai';
    }
    return 'overview';
};

interface AdminViewProps {
    currentUser: User;
    onNavigate: (view: AppView) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser, onNavigate }) => {
    const { currentView, setCurrentView } = useAppStore();
    const { t } = useTranslation();
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    // Handle URL module parameter on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const moduleParam = params.get('module');
        if (moduleParam) {
            const moduleMap: Record<string, AppView> = {
                dashboard: AppView.ADMIN_OVERVIEW,
                overview: AppView.ADMIN_OVERVIEW,
                organization: AppView.ADMIN_ORGANIZATION,
                team: AppView.ADMIN_TEAM,
                workspace: AppView.ADMIN_WORKSPACE,
                ai: AppView.ADMIN_AI,
                billing: AppView.ADMIN_BILLING,
                security: AppView.ADMIN_SECURITY,
                feedback: AppView.ADMIN_FEEDBACK,
            };
            const targetView = moduleMap[moduleParam.toLowerCase()];
            if (targetView && currentView !== targetView) {
                setCurrentView(targetView);
            }
        }
    }, []); // Run only on mount

    // Derive active section from currentView
    const activeSection = useMemo<AdminSection>(() => {
        return getAdminSection(currentView);
    }, [currentView]);

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

    // Handle section change - using new module AppView values (8 modules)
    const handleSectionChange = (section: string) => {
        switch (section) {
            case 'overview':
                setCurrentView(AppView.ADMIN_OVERVIEW);
                break;
            case 'organization':
                setCurrentView(AppView.ADMIN_ORGANIZATION);
                break;
            case 'team':
                setCurrentView(AppView.ADMIN_TEAM);
                break;
            case 'workspace':
                setCurrentView(AppView.ADMIN_WORKSPACE);
                break;
            case 'ai':
                setCurrentView(AppView.ADMIN_AI);
                break;
            case 'billing':
                setCurrentView(AppView.ADMIN_BILLING);
                break;
            case 'security':
                setCurrentView(AppView.ADMIN_SECURITY);
                break;
            case 'feedback':
                setCurrentView(AppView.ADMIN_FEEDBACK);
                break;
            case 'settings': // Legacy redirect
                setCurrentView(AppView.ADMIN_SECURITY);
                break;
        }
    };

    // Get section title and subtitle
    const getSectionInfo = () => {
        switch (activeSection) {
            case 'overview':
                return {
                    title: t('admin.overview.title', 'Overview'),
                    subtitle: t('admin.overview.subtitle', 'Dashboard, metrics, and analytics for your organization'),
                };
            case 'organization':
                return {
                    title: t('admin.organization.title', 'Organization'),
                    subtitle: t('admin.organization.subtitle', 'Profile, branding, ownership, and regional settings'),
                };
            case 'team':
                return {
                    title: t('admin.team.title', 'Team'),
                    subtitle: t('admin.team.subtitle', 'Manage users, groups, invitations, and permissions'),
                };
            case 'workspace':
                return {
                    title: t('admin.workspace.title', 'Workspace'),
                    subtitle: t('admin.workspace.subtitle', 'Projects, knowledge base, and playbooks'),
                };
            case 'ai':
                return {
                    title: t('admin.ai.title', 'AI & Intelligence'),
                    subtitle: t('admin.ai.subtitle', 'AI configuration, health monitoring, and analytics'),
                };
            case 'billing':
                return {
                    title: t('admin.billing.title', 'Billing & Subscription'),
                    subtitle: t('admin.billing.subtitle', 'Plans, payments, invoices, and spending controls'),
                };
            case 'security':
                return {
                    title: t('admin.security.title', 'Security & Compliance'),
                    subtitle: t(
                        'admin.security.subtitle',
                        'Authentication, access control, audit logs, and data management',
                    ),
                };
            case 'feedback':
                return {
                    title: t('admin.feedback.title', 'Feedback & Support'),
                    subtitle: t('admin.feedback.subtitle', 'Review user feedback, feature requests, and bug reports'),
                };
            default:
                return { title: 'Admin', subtitle: '' };
        }
    };

    const sectionInfo = getSectionInfo();

    // Render content based on active section
    const renderContent = () => {
        const FallbackLoader = () => (
            <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Activity className="h-6 w-6 animate-spin" />
                    <span className="text-sm">Loading module...</span>
                </div>
            </div>
        );

        return (
            <React.Suspense fallback={<FallbackLoader />}>
                {(() => {
                    switch (activeSection) {
                        case 'overview':
                            return (
                                <Tabs defaultValue="dashboard" className="w-full">
                                    <TabsList className="admin-tabs bg-transparent p-0 h-auto">
                                        <TabsTrigger
                                            value="dashboard"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <LayoutDashboard size={14} />
                                            {t('admin.overview.tabs.dashboard', 'Dashboard')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="metrics"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <TrendingUp size={14} />
                                            {t('admin.overview.tabs.metrics', 'Metrics')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="analytics"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <BarChart3 size={14} />
                                            {t('admin.overview.tabs.analytics', 'Analytics')}
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="dashboard" className="mt-6">
                                        <AdminDashboard users={users} projects={projects} />
                                    </TabsContent>
                                    <TabsContent value="metrics" className="mt-6">
                                        <AdminMetricsDashboardView />
                                    </TabsContent>
                                    <TabsContent value="analytics" className="mt-6">
                                        <AdminAnalyticsView />
                                    </TabsContent>
                                </Tabs>
                            );

                        case 'organization':
                            return (
                                <Tabs defaultValue="profile" className="w-full">
                                    <TabsList className="admin-tabs bg-transparent p-0 h-auto">
                                        <TabsTrigger
                                            value="profile"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Building2 size={14} />
                                            {t('admin.organization.tabs.profile', 'Profile & Branding')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="ownership"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Crown size={14} />
                                            {t('admin.organization.tabs.ownership', 'Ownership')}
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="profile" className="mt-6">
                                        <OrganizationProfileView />
                                    </TabsContent>
                                    <TabsContent value="ownership" className="mt-6">
                                        <OwnershipManagementView />
                                    </TabsContent>
                                </Tabs>
                            );

                        case 'team':
                            return (
                                <Tabs defaultValue="users" className="w-full">
                                    <TabsList className="admin-tabs bg-transparent p-0 h-auto flex-wrap">
                                        <TabsTrigger
                                            value="users"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Users size={14} />
                                            {t('admin.team.tabs.users', 'Users')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="groups"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <UsersRound size={14} />
                                            {t('admin.team.tabs.groups', 'Teams')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="invitations"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <UserPlus size={14} />
                                            {t('admin.team.tabs.invitations', 'Invitations')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="roles"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Key size={14} />
                                            {t('admin.team.tabs.roles', 'Roles')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="consultants"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Briefcase size={14} />
                                            {t('admin.team.tabs.consultants', 'Consultants')}
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="users" className="mt-6">
                                        <AdminUserManagement initialUsers={users} />
                                    </TabsContent>
                                    <TabsContent value="groups" className="mt-6">
                                        <UserGroupsView />
                                    </TabsContent>
                                    <TabsContent value="invitations" className="mt-6">
                                        <InvitationsManagement />
                                    </TabsContent>
                                    <TabsContent value="roles" className="mt-6">
                                        <RolesPermissionsView />
                                    </TabsContent>
                                    <TabsContent value="consultants" className="mt-6">
                                        <AdminSettingsConsultants />
                                    </TabsContent>
                                </Tabs>
                            );

                        case 'workspace':
                            if (currentView === AppView.ADMIN_PROJECT_DETAILS) {
                                return (
                                    <ProjectDetailsView
                                        projectId={useAppStore.getState().currentProjectId || ''}
                                        onBack={() => setCurrentView(AppView.ADMIN_PROJECTS)}
                                    />
                                );
                            }
                            return (
                                <Tabs defaultValue="projects" className="w-full">
                                    <TabsList className="admin-tabs bg-transparent p-0 h-auto">
                                        <TabsTrigger
                                            value="projects"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Briefcase size={14} />
                                            {t('admin.workspace.tabs.projects', 'Projects')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="knowledge"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <BookOpen size={14} />
                                            {t('admin.workspace.tabs.knowledge', 'Knowledge')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="playbooks"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <PlayCircle size={14} />
                                            {t('admin.workspace.tabs.playbooks', 'Playbooks')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="bulk-ops"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Layers size={14} />
                                            {t('admin.workspace.tabs.bulkOps', 'Bulk Operations')}
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="projects" className="mt-6">
                                        <AdminProjectManagement initialProjects={projects} />
                                    </TabsContent>
                                    <TabsContent value="knowledge" className="mt-6">
                                        <AdminKnowledgeView />
                                    </TabsContent>
                                    <TabsContent value="playbooks" className="mt-6">
                                        <PlaybookRunsView />
                                    </TabsContent>
                                    <TabsContent value="bulk-ops" className="mt-6">
                                        <BulkOperationsView />
                                    </TabsContent>
                                </Tabs>
                            );

                        case 'ai':
                            return (
                                <Tabs defaultValue="models" className="w-full">
                                    <TabsList className="admin-tabs bg-transparent p-0 h-auto flex-wrap">
                                        <TabsTrigger
                                            value="models"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Brain size={14} />
                                            {t('admin.ai.tabs.models', 'Models & Providers')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="health"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Activity size={14} />
                                            {t('admin.ai.tabs.health', 'Health & Monitoring')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="policy"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Shield size={14} />
                                            {t('admin.ai.tabs.policy', 'Policy & Governance')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="access"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Users size={14} />
                                            {t('admin.ai.tabs.access', 'Access & Limits')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="features"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Settings size={14} />
                                            {t('admin.ai.tabs.features', 'Features & Privacy')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="audit"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <History size={14} />
                                            {t('admin.ai.tabs.audit', 'Audit & Compliance')}
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="models" className="mt-6">
                                        <ModelsProvidersTab />
                                    </TabsContent>
                                    <TabsContent value="health" className="mt-6">
                                        <HealthMonitoringTab />
                                    </TabsContent>
                                    <TabsContent value="policy" className="mt-6">
                                        <PolicyGovernanceTab />
                                    </TabsContent>
                                    <TabsContent value="access" className="mt-6">
                                        <AccessLimitsTab />
                                    </TabsContent>
                                    <TabsContent value="features" className="mt-6">
                                        <FeaturesPrivacyTab />
                                    </TabsContent>
                                    <TabsContent value="audit" className="mt-6">
                                        <AuditComplianceTab />
                                    </TabsContent>
                                </Tabs>
                            );

                        case 'billing':
                            return (
                                <Tabs defaultValue="usage" className="w-full">
                                    <TabsList className="admin-tabs bg-transparent p-0 h-auto flex-wrap">
                                        <TabsTrigger
                                            value="usage"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Activity size={14} />
                                            {t('admin.billing.tabs.usage', 'Usage Dashboard')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="plan"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <CreditCard size={14} />
                                            {t('admin.billing.tabs.plan', 'Plan & Subscription')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="payment"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <CreditCard size={14} />
                                            {t('admin.billing.tabs.payment', 'Payment Methods')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="invoices"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <FileText size={14} />
                                            {t('admin.billing.tabs.invoices', 'Invoices')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="alerts"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Bell size={14} />
                                            {t('admin.billing.tabs.alerts', 'Spending Alerts')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="settings"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Settings size={14} />
                                            {t('admin.billing.tabs.settings', 'Billing Settings')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="cost-allocation"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Building2 size={14} />
                                            {t('admin.billing.tabs.costAllocation', 'Cost Allocation')}
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="usage" className="mt-6">
                                        <UsageDashboardView />
                                    </TabsContent>
                                    <TabsContent value="plan" className="mt-6">
                                        <AdminBillingManagement />
                                    </TabsContent>
                                    <TabsContent value="payment" className="mt-6">
                                        <PaymentMethodsView />
                                    </TabsContent>
                                    <TabsContent value="invoices" className="mt-6">
                                        <InvoicesView />
                                    </TabsContent>
                                    <TabsContent value="alerts" className="mt-6">
                                        <SpendingAlertsView />
                                    </TabsContent>
                                    <TabsContent value="settings" className="mt-6">
                                        <BillingSettingsView />
                                    </TabsContent>
                                    <TabsContent value="cost-allocation" className="mt-6">
                                        <CostAllocationView />
                                    </TabsContent>
                                </Tabs>
                            );

                        case 'security':
                            return (
                                <Tabs defaultValue="security-settings" className="w-full">
                                    <TabsList className="admin-tabs bg-transparent p-0 h-auto flex-wrap">
                                        <TabsTrigger
                                            value="security-settings"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Shield size={14} />
                                            {t('admin.security.tabs.settings', 'Security Settings')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="authentication"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Lock size={14} />
                                            {t('admin.security.tabs.authentication', 'SSO & Auth')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="access"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Key size={14} />
                                            {t('admin.security.tabs.access', 'API Keys')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="audit"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <History size={14} />
                                            {t('admin.security.tabs.audit', 'Audit Log')}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="data"
                                            className="admin-tab data-[state=active]:admin-tab-active flex items-center gap-2 rounded-none bg-transparent shadow-none"
                                        >
                                            <Download size={14} />
                                            {t('admin.security.tabs.data', 'Data Management')}
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="security-settings" className="mt-6">
                                        <SecuritySettings />
                                    </TabsContent>
                                    <TabsContent value="authentication" className="mt-6">
                                        <AdminSecuritySettings />
                                    </TabsContent>
                                    <TabsContent value="access" className="mt-6">
                                        <ApiKeysManagementView />
                                    </TabsContent>
                                    <TabsContent value="audit" className="mt-6">
                                        <AuditLogView />
                                    </TabsContent>
                                    <TabsContent value="data" className="mt-6">
                                        <DataManagementView />
                                    </TabsContent>
                                </Tabs>
                            );

                        case 'feedback':
                            return <AdminFeedbackView />;

                        default:
                            return null;
                    }
                })()}
            </React.Suspense>
        );
    };

    return (
        <div className="h-full overflow-auto">
            <div className="p-6">
                {/* Header - Clean minimal */}
                <div className="mb-6 pb-4 border-b border-slate-200 dark:border-[var(--admin-border)]">
                    <h1 className="text-lg font-medium text-navy-900 dark:text-white">{sectionInfo.title}</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-500 mt-0.5">{sectionInfo.subtitle}</p>
                </div>

                {/* Content with tabs */}
                {renderContent()}
            </div>
        </div>
    );
};

export default AdminView;
