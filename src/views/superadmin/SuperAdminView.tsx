/**
 * SuperAdminView - Main Super Admin Panel
 *
 * Unified AI Platform structure (6 main tabs with sub-tabs):
 * - Overview (Dashboard, Metrics, Signals)
 * - Customers (Organizations, Users, Feedback, Bulk Ops)
 * - AI Platform (unified with 6 tabs):
 *   - Configuration (LLM Providers, Model Tiers, Routing Rules, Global Settings)
 *   - Development (Prompts Library, Prompt Builder, Experiments, Model Registry)
 *   - Operations (Mission Control, Health Monitoring, Performance, SLA)
 *   - Analytics (Usage, Costs, Performance Metrics, Custom Reports)
 *   - Security (API Keys, Access Control, Audit Logs, Compliance)
 *   - Knowledge (Knowledge Base, Documents RAG, Strategic Directions)
 * - System (Health, Audit Log, Feature Flags, Integrations)
 * - Content (Playbooks, Email Templates)
 * - Revenue (Billing, Invoices, Usage)
 * - Security (SSO, Policies, API Keys, Compliance)
 * - Configuration (Settings, White-label, Legal)
 */

import { RefreshCw, Shield } from 'lucide-react';
import React, { useEffect } from 'react';

import { DocumentSidePanel } from '../../components/documents/DocumentSidePanel';
import { DocumentToggleButton } from '../../components/documents/DocumentToggleButton';
import { FeedbackSidePanel } from '../../components/Feedback/FeedbackSidePanel';
import { FeedbackToggleButton } from '../../components/Feedback/FeedbackToggleButton';
// Floating Widgets
import { HelpSidePanel } from '../../components/Help/HelpSidePanel';
import { HelpToggleButton } from '../../components/Help/HelpToggleButton';
import {
  appViewToSection,
  sectionToAppView,
  SuperAdminSection,
  SuperAdminSidebar,
} from '../../components/layout/SuperAdminSidebar';
import { UserProfileMenu } from '../../components/layout/UserProfileMenu';
import { SuperAdminSignalCenter } from '../../components/SuperAdmin/SuperAdminSignalCenter';
import { SuperAdminStatusIndicators } from '../../components/SuperAdmin/SuperAdminStatusIndicators';
import { useAppStore } from '../../store/useAppStore';
import { AppView, User } from '../../types';

// Lazy load heavy modules
// Legacy AI modules - kept for backward compatibility redirects
const AIDevelopmentModule = React.lazy(() =>
  import('./AIDevelopmentModule').then((m) => ({ default: m.AIDevelopmentModule }))
);
const AIInfrastructureModule = React.lazy(() =>
  import('./AIInfrastructureModule').then((m) => ({ default: m.AIInfrastructureModule }))
);
const AIOperationsModule = React.lazy(() =>
  import('./AIOperationsModule').then((m) => ({ default: m.AIOperationsModule }))
);
// NEW: Unified AI Platform Module with 6 main tabs
const AIPlatformModule = React.lazy(() =>
  import('./AIPlatformModule').then((m) => ({ default: m.AIPlatformModule }))
);
// NEW: AI Platform Module from new folder structure
const NewAIPlatformModule = React.lazy(() =>
  import('./AIPlatformModule/AIPlatformModule').then((m) => ({ default: m.AIPlatformModule }))
);
const AnalyticsModuleView = React.lazy(() =>
  import('./analytics').then((m) => ({ default: m.AnalyticsModuleView }))
);
const ConfigurationModule = React.lazy(() =>
  import('./ConfigurationModule').then((m) => ({ default: m.ConfigurationModule }))
);
const ContentModule = React.lazy(() =>
  import('./ContentModule').then((m) => ({ default: m.ContentModule }))
);
const CustomersModule = React.lazy(() =>
  import('./CustomersModule').then((m) => ({ default: m.CustomersModule }))
);
const OverviewModule = React.lazy(() =>
  import('./OverviewModule').then((m) => ({ default: m.OverviewModule }))
);
const RevenueModule = React.lazy(() =>
  import('./RevenueModule').then((m) => ({ default: m.RevenueModule }))
);
const SecurityModule = React.lazy(() =>
  import('./SecurityModule').then((m) => ({ default: m.SecurityModule }))
);
const SystemModule = React.lazy(() =>
  import('./SystemModule').then((m) => ({ default: m.SystemModule }))
);

interface SuperAdminViewProps {
  currentUser: User;
  onNavigate: (view: any) => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ currentUser, onNavigate }) => {
  const { isSidebarCollapsed, currentView, setCurrentView, logout } = useAppStore();

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
    logout();
    onNavigate(AppView.WELCOME);
  };

  // Navigate to a specific section (for inter-module navigation)
  const handleNavigateToSection = (section: string) => {
    setActiveSection(section as SuperAdminSection);
  };

  // Render content based on currentView (Modular AI Platform - Variant A)
  const renderContent = () => {
    return (
      <React.Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        }
      >
        {(() => {
          switch (currentView) {
            case AppView.SUPERADMIN_OVERVIEW:
              return <OverviewModule onNavigateToSection={handleNavigateToSection} />;

            case AppView.SUPERADMIN_CUSTOMERS:
              return <CustomersModule />;

            // NEW: Unified AI Platform with 6 main tabs
            case AppView.SUPERADMIN_AI_PLATFORM:
              return <NewAIPlatformModule />;

            // Legacy AI modules - redirect to unified AI Platform
            case AppView.SUPERADMIN_AI_INFRASTRUCTURE:
              return <NewAIPlatformModule initialTab="configuration" />;

            case AppView.SUPERADMIN_AI_DEVELOPMENT:
              return <NewAIPlatformModule initialTab="development" />;

            case AppView.SUPERADMIN_AI_OPERATIONS:
              return <NewAIPlatformModule initialTab="operations" />;

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
              return (
                <CustomersModule
                  initialTab={
                    currentView === AppView.SUPERADMIN_ORGANIZATIONS
                      ? 'organizations'
                      : currentView === AppView.SUPERADMIN_USERS
                        ? 'users'
                        : currentView === AppView.SUPERADMIN_FEEDBACK
                          ? 'feedback'
                          : 'bulk-ops'
                  }
                />
              );

            // Legacy AI views - redirect to unified AI Platform with appropriate tab
            case AppView.SUPERADMIN_LLM_MANAGEMENT:
            case AppView.SUPERADMIN_AI_CONFIG:
              return (
                <NewAIPlatformModule
                  initialTab="configuration"
                  initialSubTab={
                    currentView === AppView.SUPERADMIN_LLM_MANAGEMENT ? 'llm-providers' : 'global-settings'
                  }
                />
              );

            case AppView.SUPERADMIN_AI_INTELLIGENCE:
            case AppView.SUPERADMIN_KNOWLEDGE:
              return (
                <NewAIPlatformModule
                  initialTab={
                    currentView === AppView.SUPERADMIN_AI_INTELLIGENCE
                      ? 'development'
                      : 'knowledge'
                  }
                  initialSubTab={
                    currentView === AppView.SUPERADMIN_AI_INTELLIGENCE
                      ? 'prompt-builder'
                      : 'knowledge-base'
                  }
                />
              );

            case AppView.SUPERADMIN_BILLING:
            case AppView.SUPERADMIN_INVOICES:
              return (
                <RevenueModule
                  initialTab={currentView === AppView.SUPERADMIN_INVOICES ? 'invoices' : 'billing'}
                />
              );

            case AppView.SUPERADMIN_SSO:
            case AppView.SUPERADMIN_SECURITY_POLICIES:
            case AppView.SUPERADMIN_API_MANAGEMENT:
            case AppView.SUPERADMIN_COMPLIANCE:
              return (
                <SecurityModule
                  initialTab={
                    currentView === AppView.SUPERADMIN_SSO
                      ? 'sso'
                      : currentView === AppView.SUPERADMIN_SECURITY_POLICIES
                        ? 'policies'
                        : currentView === AppView.SUPERADMIN_API_MANAGEMENT
                          ? 'api-keys'
                          : 'compliance'
                  }
                />
              );

            case AppView.SUPERADMIN_SETTINGS:
            case AppView.SUPERADMIN_WHITELABEL:
              return (
                <ConfigurationModule
                  initialTab={
                    currentView === AppView.SUPERADMIN_WHITELABEL ? 'whitelabel' : 'settings'
                  }
                />
              );

            case AppView.SUPERADMIN_PLAYBOOK_TEMPLATES:
              return <ContentModule initialTab="playbooks" />;

            default:
              // Fallback - show overview
              return <OverviewModule onNavigateToSection={handleNavigateToSection} />;
          }
        })()}
      </React.Suspense>
    );
  };

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-navy-950 text-slate-900 dark:text-white overflow-hidden">
      {/* Sidebar (Fixed Position) */}
      <SuperAdminSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={handleLogout}
        currentUserEmail={currentUser.email}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'ml-16' : 'ml-72'}`}
      >
        {/* SuperAdmin Dedicated Header */}
        <header className="h-14 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-800 flex items-center justify-between px-4 shrink-0 shadow-sm relative z-50">
          {/* Left side - Branding + Status Indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Shield size={20} />
              <span className="font-semibold text-sm hidden sm:inline">Super Admin Console</span>
            </div>
            <div className="h-5 w-px bg-slate-200 dark:bg-white/10" />
            <SuperAdminStatusIndicators />
          </div>

          {/* Right side - Signal Center + Profile */}
          <div className="flex items-center gap-3">
            <SuperAdminSignalCenter />
            <div className="h-6 w-px bg-slate-200 dark:bg-white/10" />
            <UserProfileMenu showName={true} />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden relative z-0">{renderContent()}</main>
      </div>

      {/* Floating Action Buttons - Order: Help, Feedback, Docs */}
      <div className="fixed right-0 top-[60%] z-50 flex flex-col gap-2 items-end pointer-events-none">
        <div className="pointer-events-auto">
          <HelpToggleButton />
        </div>
        <div className="pointer-events-auto">
          <FeedbackToggleButton />
        </div>
        <div className="pointer-events-auto">
          <DocumentToggleButton />
        </div>
      </div>
      <HelpSidePanel />
      <DocumentSidePanel />
      <FeedbackSidePanel />
    </div>
  );
};
