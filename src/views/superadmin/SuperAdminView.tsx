/**
 * SuperAdminView - Main Super Admin Panel
 *
 * Canonical root information architecture:
 * - Tenant & User Ops
 * - AI Operations
 * - Connector Ops
 * - Governance & Compliance
 * - Platform Security
 *
 * Legacy views are remapped into one of the mounted branches instead of
 * rendering as additional top-level destinations.
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
import { FeatureFlagsDevToolsToggleButton } from '../../components/settings/FeatureFlagsDevToolsToggleButton';
import { SuperAdminSignalCenter } from '../../components/SuperAdmin/SuperAdminSignalCenter';
import { SuperAdminStatusIndicators } from '../../components/SuperAdmin/SuperAdminStatusIndicators';
import { useAppStore } from '../../store/useAppStore';
import { AppView, User } from '../../types';

// Lazy load heavy modules
const NewAIPlatformModule = React.lazy(() =>
  import('./AIPlatformModule/AIPlatformModule').then((m) => ({ default: m.AIPlatformModule }))
);
const CustomersModule = React.lazy(() =>
  import('./CustomersModule').then((m) => ({ default: m.CustomersModule }))
);
const GovernanceModule = React.lazy(() =>
  import('./GovernanceModule').then((m) => ({ default: m.GovernanceModule }))
);
const SecurityModule = React.lazy(() =>
  import('./SecurityModule').then((m) => ({ default: m.SecurityModule }))
);
const SystemModule = React.lazy(() =>
  import('./SystemModule').then((m) => ({ default: m.SystemModule }))
);
const VirtualWorkersModule = React.lazy(() =>
  import('./VirtualWorkersModule').then((m) => ({ default: m.VirtualWorkersModule }))
);

interface SuperAdminViewProps {
  currentUser: User;
  onNavigate: (view: any) => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ currentUser, onNavigate }) => {
  const { isSidebarCollapsed, currentView, setCurrentView, logout } = useAppStore();

  // Derive activeSection from currentView
  const activeSection: SuperAdminSection = appViewToSection[currentView] || 'customers';

  // Helper to set section (updates currentView in store)
  const setActiveSection = (section: SuperAdminSection) => {
    setCurrentView(sectionToAppView[section]);
  };

  // Normalize all entry points to the mounted root branches.
  useEffect(() => {
    if (!currentView.startsWith('SUPERADMIN_')) {
      setCurrentView(AppView.SUPERADMIN_CUSTOMERS);
    }
  }, [currentView, setCurrentView]);

  const handleLogout = () => {
    logout();
    onNavigate(AppView.WELCOME);
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
            case AppView.SUPERADMIN_DASHBOARD:
              return <CustomersModule initialTab="command-center" />;

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
              return <GovernanceModule />;

            case AppView.SUPERADMIN_SECURITY:
              return <SecurityModule />;

            case AppView.SUPERADMIN_CONFIGURATION:
            case AppView.SUPERADMIN_ANALYTICS:
              return (
                <SystemModule
                  initialTab={
                    currentView === AppView.SUPERADMIN_ANALYTICS ? 'analytics' : 'configuration'
                  }
                />
              );

            case AppView.SUPERADMIN_REVENUE:
              return <CustomersModule initialTab="commercial" initialCommercialTab="usage" />;
            case AppView.SUPERADMIN_BILLING:
              return <CustomersModule initialTab="commercial" initialCommercialTab="billing" />;
            case AppView.SUPERADMIN_INVOICES:
              return <CustomersModule initialTab="commercial" initialCommercialTab="invoices" />;

            case AppView.SUPERADMIN_VIRTUAL_WORKERS:
              return <VirtualWorkersModule />;

            // Legacy view redirects - redirect to appropriate module with initial tab
            case AppView.SUPERADMIN_ORGANIZATIONS:
            case AppView.SUPERADMIN_USERS:
            case AppView.SUPERADMIN_COMMUNICATION:
            case AppView.SUPERADMIN_FEEDBACK:
            case AppView.SUPERADMIN_BULK_OPERATIONS:
              return (
                <CustomersModule
                  initialTab={
                    currentView === AppView.SUPERADMIN_ORGANIZATIONS
                      ? 'organizations'
                      : currentView === AppView.SUPERADMIN_USERS
                        ? 'users'
                        : currentView === AppView.SUPERADMIN_COMMUNICATION
                          ? 'communication'
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
                    currentView === AppView.SUPERADMIN_LLM_MANAGEMENT
                      ? 'llm-providers'
                      : 'global-settings'
                  }
                />
              );

            case AppView.SUPERADMIN_AI_INTELLIGENCE:
            case AppView.SUPERADMIN_KNOWLEDGE:
              return (
                <NewAIPlatformModule
                  initialTab={
                    currentView === AppView.SUPERADMIN_AI_INTELLIGENCE ? 'development' : 'knowledge'
                  }
                  initialSubTab={
                    currentView === AppView.SUPERADMIN_AI_INTELLIGENCE
                      ? 'prompt-builder'
                      : 'knowledge-base'
                  }
                />
              );

            case AppView.SUPERADMIN_API_MANAGEMENT:
              return <SystemModule initialTab="api-keys" />;

            case AppView.SUPERADMIN_SSO:
            case AppView.SUPERADMIN_SECURITY_POLICIES:
              return (
                <SecurityModule
                  initialTab={
                    currentView === AppView.SUPERADMIN_SSO
                      ? 'sso'
                      : 'policies'
                  }
                />
              );

            case AppView.SUPERADMIN_COMPLIANCE:
              return <GovernanceModule initialTab="compliance" />;

            case AppView.SUPERADMIN_SETTINGS:
            case AppView.SUPERADMIN_WHITELABEL:
              return <SystemModule initialTab="configuration" />;

            case AppView.SUPERADMIN_PLAYBOOK_TEMPLATES:
            case AppView.SUPERADMIN_PLAYBOOK_EDITOR:
              return <CustomersModule initialTab="playbooks" />;

            default:
              return <CustomersModule initialTab="command-center" />;
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
        className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ${
          isSidebarCollapsed ? 'pl-16' : 'pl-72'
        }`}
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
        <main className="flex-1 min-w-0 overflow-hidden relative z-0 pr-16">{renderContent()}</main>
      </div>

      {/* Floating Action Buttons - Order: Help, Feedback, Docs */}
      <div className="fixed right-0 top-[70%] z-50 flex flex-col gap-2 items-end pointer-events-none">
        <div className="pointer-events-auto">
          <HelpToggleButton />
        </div>
        <div className="pointer-events-auto">
          <FeedbackToggleButton />
        </div>
        <div className="pointer-events-auto">
          <DocumentToggleButton />
        </div>
        <div className="pointer-events-auto">
          <FeatureFlagsDevToolsToggleButton />
        </div>
      </div>
      <HelpSidePanel />
      <DocumentSidePanel />
      <FeedbackSidePanel />
    </div>
  );
};
