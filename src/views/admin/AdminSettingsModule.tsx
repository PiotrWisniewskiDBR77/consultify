/**
 * AdminSettingsModule - Organization Settings
 *
 * Two-column layout with sidebar navigation (matching Settings pattern)
 */

import { Menu, MessageSquare, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { AdminInitiativeCreatorPanel } from '../../components/Admin/AdminInitiativeCreatorPanel';
import {
  AdminSettingsSection,
  AdminSettingsSidebar,
} from '../../components/Admin/AdminSettingsSidebar';
import { AuditExportPanel } from '../../components/Admin/AuditExportPanel';
import { BrandingSettingsPanel } from '../../components/Admin/BrandingSettingsPanel';
import { DataGovernancePanel } from '../../components/Admin/DataGovernancePanel';
import { IntegrationsManagementPanel } from '../../components/Admin/IntegrationsManagementPanel';
import { PaymentMethodsPanel } from '../../components/billing/PaymentMethodsPanel';
import { SubscriptionManager } from '../../components/billing/SubscriptionManager';
import { TaxSettingsForm } from '../../components/billing/TaxSettingsForm';
import { UsageAlertsConfig } from '../../components/billing/UsageAlertsConfig';
import { BlockTypesManager } from '../../components/ReportBuilder/BlockTypesManager';
import { TemplatesManager } from '../../components/ReportBuilder/TemplatesManager';
import { OrganizationProfileForm } from '../../components/settings/OrganizationProfileForm';
import { SecuritySettings } from '../../components/settings/SecuritySettings';
import { Button } from '../../components/ui/primitives/Button';
import { ScrollArea } from '../../components/ui/scroll-area';
import { cn } from '../../lib/utils';
import { ROUTES } from '../../routes/routeConfig';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { AppView, User } from '../../types';
import { ApiKeysManagementView } from './ApiKeysManagementView';

interface AdminSettingsModuleProps {
  initialTab?: AdminSettingsSection;
  currentUser: User;
}

// Section metadata for headers
const sectionMeta: Record<AdminSettingsSection, { title: string; subtitle: string }> = {
  organization: {
    title: 'Strategic Profile',
    subtitle: 'Define your organization context for AI-powered strategic insights',
  },
  branding: { title: 'Branding', subtitle: "Customize your organization's visual identity" },
  billing: { title: 'Plans', subtitle: 'Manage your subscription and plan details' },
  payment: { title: 'Payment', subtitle: 'Manage payment methods and billing information' },
  tax: { title: 'Tax', subtitle: 'Configure tax settings and VAT information' },
  alerts: { title: 'Alerts', subtitle: 'Configure spending and usage alerts' },
  security: { title: 'Security', subtitle: 'Manage security settings and access controls' },
  governance: { title: 'Governance', subtitle: 'Configure data governance policies' },
  audit: { title: 'Audit', subtitle: 'View and export audit logs' },
  'report-creator': {
    title: 'Report Templates',
    subtitle: 'Manage report templates for your organization',
  },
  'block-library': {
    title: 'Block Library',
    subtitle: 'Define block types (render + prompt) reusable across reports',
  },
  'initiative-creator': {
    title: 'Initiative Creator',
    subtitle: 'Generate initiatives based on analysis',
  },
  integrations: { title: 'Integrations', subtitle: 'Manage third-party integrations' },
  api: { title: 'API', subtitle: 'Manage API keys and access' },
  feedback: { title: 'Feedback', subtitle: 'View and manage user feedback' },
};

// Simple Feedback View Component
const AdminFeedbackView: React.FC = () => {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const data = await Api.getFeedback();
        setFeedback(data);
      } catch (err) {
        console.error('Failed to fetch feedback:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeedback();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('admin.feedback.title', 'User Feedback')}
        </h3>
        <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-full">
          {feedback.length} {t('admin.feedback.items', 'items')}
        </span>
      </div>

      {feedback.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-white/5 rounded-xl">
          <MessageSquare className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400">
            {t('admin.feedback.empty', 'No feedback received yet')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.slice(0, 20).map((item: any) => (
            <div
              key={item.id}
              className="p-4 bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-navy-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        item.status === 'new'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300'
                          : item.status === 'resolved'
                            ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300'
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {item.type || 'General'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {item.message || item.content}
                  </p>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Admin Templates Panel - Wrapper for TemplatesManager
const AdminTemplatesPanel: React.FC = () => {
  return <TemplatesManager />;
};

// Admin Initiatives Panel - Uses the custom AdminInitiativeCreatorPanel
const AdminInitiativesPanel: React.FC = () => {
  return <AdminInitiativeCreatorPanel />;
};

export const AdminSettingsModule: React.FC<AdminSettingsModuleProps> = ({
  initialTab,
  currentUser,
}) => {
  const { t } = useTranslation();
  const { setCurrentView } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);

  const activeSection = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('tab');
    const fallback = initialTab || 'organization';
    return (
      section && Object.keys(sectionMeta).includes(section) ? section : fallback
    ) as AdminSettingsSection;
  }, [initialTab, location.search]);

  // Fetch pending feedback count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const feedback = await Api.getFeedback();
        const pending = feedback.filter(
          (f: any) => f.status === 'new' || f.status === 'pending'
        ).length;
        setPendingFeedbackCount(pending);
      } catch (err) {
        // Silently fail
      }
    };
    fetchPendingCount();
  }, [activeSection]);

  // Handle section change
  const handleSectionChange = useCallback(
    (section: AdminSettingsSection) => {
      const params = new URLSearchParams(location.search);
      params.set('tab', section);
      navigate({ pathname: location.pathname, search: params.toString() });
      setSidebarOpen(false);
    },
    [location.pathname, location.search, navigate]
  );

  // Handle back to main app (Chat)
  const handleBackToDashboard = useCallback(() => {
    setCurrentView(AppView.AI_CHAT);
    navigate(ROUTES.AI_CHAT);
  }, [navigate, setCurrentView]);

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
    switch (activeSection) {
      case 'organization':
        return <OrganizationProfileForm currentUser={currentUser} />;
      case 'branding':
        return <BrandingSettingsPanel />;
      case 'billing':
        return <SubscriptionManager />;
      case 'payment':
        return <PaymentMethodsPanel />;
      case 'tax':
        return <TaxSettingsForm />;
      case 'alerts':
        return <UsageAlertsConfig />;
      case 'security':
        return <SecuritySettings currentUser={currentUser} />;
      case 'governance':
        return <DataGovernancePanel />;
      case 'audit':
        return <AuditExportPanel />;
      case 'report-creator':
        return <AdminTemplatesPanel />;
      case 'block-library':
        return <BlockTypesManager embedded />;
      case 'initiative-creator':
        return <AdminInitiativesPanel />;
      case 'integrations':
        return <IntegrationsManagementPanel />;
      case 'api':
        return <ApiKeysManagementView />;
      case 'feedback':
        return <AdminFeedbackView />;
      default:
        return <OrganizationProfileForm currentUser={currentUser} />;
    }
  }, [activeSection, currentUser]);

  return (
    <div className="flex h-full bg-slate-50 dark:bg-navy-950 relative">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-[280px] transform transition-transform duration-300 ease-in-out',
          'lg:static lg:transform-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <AdminSettingsSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          pendingFeedbackCount={pendingFeedbackCount}
          onBack={handleBackToDashboard}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-navy-900">
        {/* Mobile menu button - only visible on mobile */}
        <div className="lg:hidden flex items-center px-4 py-2 border-b border-slate-200 dark:border-white/5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-600 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white p-2"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Content - No additional header, breadcrumbs are in MainLayout */}
        <ScrollArea className="flex-1">
          <div className="p-2 lg:p-3 w-full">{renderContent()}</div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default AdminSettingsModule;
