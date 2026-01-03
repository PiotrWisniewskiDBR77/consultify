/**
 * SuperAdminView - Main Super Admin Panel
 * 
 * Restructured with modular AI Platform (Variant A - 3 Modules):
 * - Overview (Dashboard, Metrics, Signals)
 * - Customers (Organizations, Users, Feedback, Bulk Ops)
 * - AI Infrastructure (LLM Providers, Tiers, Settings, Health)
 * - AI Development (Prompts, Intelligence, Experiments, Knowledge)
 * - AI Operations (Mission Control, Performance, Costs, SLA, Analytics)
 * - System (Health, Audit Log, Feature Flags, Integrations)
 * - Content (Playbooks, Email Templates)
 * - Revenue (Billing, Invoices, Usage)
 * - Security (SSO, Policies, API Keys, Compliance)
 * - Configuration (Settings, White-label, Legal)
 */

import React, { useEffect } from 'react';
import { User, AppView } from '../../types';
import { RefreshCw, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { SuperAdminSidebar, SuperAdminSection, appViewToSection, sectionToAppView } from '../../components/SuperAdminSidebar';
import { SuperAdminOrgDetailsModal } from './SuperAdminOrgDetailsModal';

// Module imports
import { OverviewModule } from './OverviewModule';
import { CustomersModule } from './CustomersModule';
import { AIPlatformModule } from './AIPlatformModule'; // Legacy - kept for backward compatibility
import { AIInfrastructureModule } from './AIInfrastructureModule';
import { AIDevelopmentModule } from './AIDevelopmentModule';
import { AIOperationsModule } from './AIOperationsModule';
import { SystemModule } from './SystemModule';
import { ContentModule } from './ContentModule';
import { RevenueModule } from './RevenueModule';
import { SecurityModule } from './SecurityModule';
import { ConfigurationModule } from './ConfigurationModule';
import { AnalyticsModuleView } from './analytics';

// Floating Widgets
import { HelpSidePanel } from '../../components/Help/HelpSidePanel';
import { HelpToggleButton } from '../../components/Help/HelpToggleButton';
import { DocumentToggleButton } from '../../components/documents/DocumentToggleButton';
import { DocumentSidePanel } from '../../components/documents/DocumentSidePanel';
import { FeedbackToggleButton } from '../../components/Feedback/FeedbackToggleButton';
import { FeedbackSidePanel } from '../../components/Feedback/FeedbackSidePanel';
import { UserProfileMenu } from '../../components/UserProfileMenu';
import { SuperAdminSignalCenter } from '../../components/SuperAdmin/SuperAdminSignalCenter';

interface SuperAdminViewProps {
    currentUser: User;
    onNavigate: (view: any) => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ currentUser, onNavigate }) => {
    const { isSidebarCollapsed, currentView, setCurrentView } = useAppStore();

    // Derive activeSection from currentView
    const activeSection: SuperAdminSection = appViewToSection[currentView] || 'overview';

    // Helper to set section (updates currentView in store)
    const setActiveSection = (section: SuperAdminSection) => {
        setCurrentView(sectionToAppView[section]);
    };

    // Initialize to overview if not a superadmin view
    useEffect(() => {
        if (!currentView.startsWith('SUPERADMIN_')) {
            setCurrentView(AppView.SUPERADMIN_OVERVIEW);
        }
    }, [currentView, setCurrentView]);

    const handleLogout = () => {
        onNavigate(AppView.WELCOME);
    };

    // Navigate to a specific section (for inter-module navigation)
    const handleNavigateToSection = (section: string) => {
        setActiveSection(section as SuperAdminSection);
    };

    // Render content based on currentView (Modular AI Platform - Variant A)
    const renderContent = () => {
        switch (currentView) {
            case AppView.SUPERADMIN_OVERVIEW:
                return <OverviewModule onNavigateToSection={handleNavigateToSection} />;

            case AppView.SUPERADMIN_CUSTOMERS:
                return <CustomersModule />;

            // NEW: AI Platform - 3 Modular Structure (Variant A)
            case AppView.SUPERADMIN_AI_INFRASTRUCTURE:
                return <AIInfrastructureModule />;

            case AppView.SUPERADMIN_AI_DEVELOPMENT:
                return <AIDevelopmentModule />;

            case AppView.SUPERADMIN_AI_OPERATIONS:
                return <AIOperationsModule />;

            // Legacy AI Platform - redirects to AI Infrastructure
            case AppView.SUPERADMIN_AI_PLATFORM:
                return <AIInfrastructureModule />;

            case AppView.SUPERADMIN_SYSTEM:
                return <SystemModule />;

            case AppView.SUPERADMIN_CONTENT:
                return <ContentModule />;

            case AppView.SUPERADMIN_REVENUE:
                return <RevenueModule />;

            case AppView.SUPERADMIN_SECURITY:
                return <SecurityModule />;

            case AppView.SUPERADMIN_CONFIGURATION:
                return <ConfigurationModule />;

            case AppView.SUPERADMIN_ANALYTICS:
                return <AnalyticsModuleView />;

            // Legacy view redirects - redirect to appropriate module with initial tab
            case AppView.SUPERADMIN_DASHBOARD:
                return <OverviewModule onNavigateToSection={handleNavigateToSection} />;

            case AppView.SUPERADMIN_ORGANIZATIONS:
            case AppView.SUPERADMIN_USERS:
            case AppView.SUPERADMIN_FEEDBACK:
            case AppView.SUPERADMIN_BULK_OPERATIONS:
                return <CustomersModule initialTab={
                    currentView === AppView.SUPERADMIN_ORGANIZATIONS ? 'organizations' :
                        currentView === AppView.SUPERADMIN_USERS ? 'users' :
                            currentView === AppView.SUPERADMIN_FEEDBACK ? 'feedback' :
                                'bulk-ops'
                } />;

            // Legacy AI views - redirect to appropriate new module
            case AppView.SUPERADMIN_LLM_MANAGEMENT:
            case AppView.SUPERADMIN_AI_CONFIG:
                return <AIInfrastructureModule initialTab={
                    currentView === AppView.SUPERADMIN_LLM_MANAGEMENT ? 'llm-config' : 'settings'
                } />;

            case AppView.SUPERADMIN_AI_INTELLIGENCE:
            case AppView.SUPERADMIN_KNOWLEDGE:
                return <AIDevelopmentModule initialTab={
                    currentView === AppView.SUPERADMIN_AI_INTELLIGENCE ? 'intelligence' : 'knowledge'
                } />;

            case AppView.SUPERADMIN_BILLING:
            case AppView.SUPERADMIN_INVOICES:
                return <RevenueModule initialTab={
                    currentView === AppView.SUPERADMIN_INVOICES ? 'invoices' : 'billing'
                } />;

            case AppView.SUPERADMIN_SSO:
            case AppView.SUPERADMIN_SECURITY_POLICIES:
            case AppView.SUPERADMIN_API_MANAGEMENT:
            case AppView.SUPERADMIN_COMPLIANCE:
                return <SecurityModule initialTab={
                    currentView === AppView.SUPERADMIN_SSO ? 'sso' :
                        currentView === AppView.SUPERADMIN_SECURITY_POLICIES ? 'policies' :
                            currentView === AppView.SUPERADMIN_API_MANAGEMENT ? 'api-keys' :
                                'compliance'
                } />;

            case AppView.SUPERADMIN_SETTINGS:
            case AppView.SUPERADMIN_WHITELABEL:
                return <ConfigurationModule initialTab={
                    currentView === AppView.SUPERADMIN_WHITELABEL ? 'whitelabel' : 'settings'
                } />;

            case AppView.SUPERADMIN_PLAYBOOK_TEMPLATES:
                return <ContentModule initialTab="playbooks" />;

            default:
                // Fallback - show overview
                return <OverviewModule onNavigateToSection={handleNavigateToSection} />;
        }
    };

    return (
        <div className="flex h-full bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white overflow-hidden">
            {/* Sidebar (Fixed Position) */}
            <SuperAdminSidebar
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                onLogout={handleLogout}
                currentUserEmail={currentUser.email}
            />

            {/* Main Content (Push with ml-xx) */}
            <main
                className={`flex-1 overflow-hidden flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'ml-16' : 'ml-72'}`}
            >
                {renderContent()}
            </main>

            {/* Top Right User Profile - Absolute Positioned */}
            <div className="fixed top-4 right-12 z-50 flex items-center gap-6">
                <SuperAdminSignalCenter />
                <UserProfileMenu />
            </div>

            {/* Floating Action Buttons */}
            <div className="fixed right-0 top-[66%] z-50 flex flex-col gap-3 items-end translate-x-0 pointer-events-none">
                <div className="pointer-events-auto"><HelpToggleButton /></div>
                <div className="pointer-events-auto"><DocumentToggleButton /></div>
                <div className="pointer-events-auto"><FeedbackToggleButton /></div>
            </div>
            <HelpSidePanel />
            <DocumentSidePanel />
            <FeedbackSidePanel />
        </div>
    );
};
