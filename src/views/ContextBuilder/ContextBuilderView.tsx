/**
 * ContextBuilderView - Organization Context Module
 *
 * Architecture:
 * - Left sidebar (280px) with grouped navigation (matching Settings pattern)
 * - Right content area with dynamic component rendering
 * - Mobile-first responsive design
 *
 * @version 2.0
 */

import {
  ArrowLeft,
  Building2,
  ChevronDown,
  Globe,
  Layout,
  Menu,
  RefreshCw,
  Scale,
  Target,
  Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { ScrollArea } from '../../components/ui/scroll-area';
import { cn } from '../../lib/utils';
import { ROUTES } from '../../routes/routeConfig';
import { useAppStore } from '../../store/useAppStore';
import { useContextBuilderStore } from '../../store/useContextBuilderStore';
import { AppView } from '../../types';
import { ChallengeMapModule } from './modules/ChallengeMapModule';
import { GoalsExpectationsModule } from './modules/GoalsExpectationsModule';
import { MegatrendScannerModule } from './modules/MegatrendScannerModule';
import { OrganizationProfileModule } from './modules/OrganizationProfileModule';
import { StrategicSynthesisModule } from './modules/StrategicSynthesisModule';

// ==========================================
// TYPES
// ==========================================

interface ContextBuilderProps {
  initialTab?: number;
}

type OrganizationSection = 'profile' | 'goals' | 'challenges' | 'megatrends' | 'strategy';

// Section metadata for headers
const sectionMeta: Record<OrganizationSection, { title: string; subtitle: string }> = {
  profile: {
    title: 'Company Profile',
    subtitle: 'Define the "as-is" state of the organization.',
  },
  goals: {
    title: 'Goals & Expectations',
    subtitle: 'Set strategic objectives and success metrics.',
  },
  challenges: {
    title: 'Challenge Map',
    subtitle: 'Map operational pain points and root causes.',
  },
  megatrends: {
    title: 'Megatrend Scanner',
    subtitle: 'Analyze external trends and pressures.',
  },
  strategy: {
    title: 'Strategic Synthesis',
    subtitle: 'Synthesize findings into a strategic roadmap.',
  },
};

// Map tab number to section
const tabToSection: Record<number, OrganizationSection> = {
  1: 'profile',
  2: 'goals',
  3: 'challenges',
  4: 'megatrends',
  5: 'strategy',
};

// ==========================================
// SIDEBAR COMPONENT
// ==========================================

interface OrganizationSidebarProps {
  activeSection: OrganizationSection;
  onSectionChange: (section: OrganizationSection) => void;
  onBack?: () => void;
  className?: string;
}

const OrganizationSidebar: React.FC<OrganizationSidebarProps> = ({
  activeSection,
  onSectionChange,
  onBack,
  className,
}) => {
  const { t } = useTranslation();

  const navItems = [
    { id: 'profile' as const, label: t('sidebar.context.profile', 'Profile'), icon: Building2 },
    { id: 'goals' as const, label: t('sidebar.context.goals', 'Goals'), icon: Target },
    {
      id: 'challenges' as const,
      label: t('sidebar.context.challenges', 'Challenges'),
      icon: Scale,
    },
    {
      id: 'megatrends' as const,
      label: t('sidebar.context.megatrends', 'Megatrends'),
      icon: Globe,
    },
    { id: 'strategy' as const, label: t('sidebar.context.strategy', 'Strategy'), icon: Zap },
  ];

  return (
    <div
      className={cn(
        'w-[280px] h-full bg-white dark:bg-navy-900 border-r border-slate-200 dark:border-navy-700 flex flex-col',
        className
      )}
    >
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-slate-200 dark:border-navy-700">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-3"
          >
            <ArrowLeft size={16} />
            {t('common.backToDashboard', 'Back to Dashboard')}
          </button>
        )}
        <h2 className="text-lg font-bold text-navy-900 dark:text-white">
          {t('sidebar.organization', 'Organization')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {t('organization.subtitle', 'Define your organization context')}
        </p>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                <Icon
                  size={18}
                  className={cn(
                    isActive
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-slate-600 dark:text-slate-400'
                  )}
                />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-navy-900 dark:bg-white" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// REFRESH BUTTON
// ==========================================

const RefreshAnalysisButton = () => {
  const { isGenerating, generateAnalysis } = useContextBuilderStore();
  return (
    <button
      onClick={generateAnalysis}
      disabled={isGenerating}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-500/30 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors disabled:opacity-50"
    >
      <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
      {isGenerating ? 'Analyzing...' : 'Refresh Analysis'}
    </button>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const ContextBuilderView: React.FC<ContextBuilderProps> = ({ initialTab = 1 }) => {
  const { t } = useTranslation();
  const { setCurrentView } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get section from URL path or initialTab
  const activeSection = useMemo(() => {
    const pathSection =
      location.pathname.replace('/context/', '').replace(/^\/+|\/+$/g, '') || 'profile';

    if (Object.keys(sectionMeta).includes(pathSection)) {
      return pathSection as OrganizationSection;
    }

    // Fallback to initialTab
    return tabToSection[initialTab] || 'profile';
  }, [location.pathname, initialTab]);

  // Handle section change - update URL
  const handleSectionChange = useCallback(
    (section: OrganizationSection) => {
      navigate(`${ROUTES.CONTEXT_BUILDER.ROOT}/${section}`);
      setSidebarOpen(false); // Close mobile sidebar
    },
    [navigate]
  );

  // Handle back to dashboard
  const handleBack = useCallback(() => {
    setCurrentView(AppView.MY_WORK);
    navigate('/my-work');
  }, [setCurrentView, navigate]);

  // Render active module content
  const renderActiveModule = () => {
    switch (activeSection) {
      case 'profile':
        return <OrganizationProfileModule />;
      case 'goals':
        return <GoalsExpectationsModule />;
      case 'challenges':
        return <ChallengeMapModule />;
      case 'megatrends':
        return <MegatrendScannerModule />;
      case 'strategy':
        return <StrategicSynthesisModule />;
      default:
        return (
          <div className="mt-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
            <Layout className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-navy-900 dark:text-white">
              Module Under Construction
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              This module is part of the planned roadmap.
            </p>
          </div>
        );
    }
  };

  const meta = sectionMeta[activeSection] || sectionMeta.profile;

  return (
    <div className="flex h-full w-full bg-slate-50 dark:bg-navy-950 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar - Desktop always visible, Mobile as drawer */}
      <div
        className={cn(
          'fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <OrganizationSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          onBack={handleBack}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header with section info */}
        <div className="shrink-0 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between px-4 lg:px-6 py-4">
            <div className="flex items-center gap-4">
              {/* Mobile menu toggle */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <Menu size={20} />
              </button>

              <div>
                <h1 className="text-xl font-bold text-navy-900 dark:text-white">{meta.title}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">{meta.subtitle}</p>
              </div>
            </div>

            {/* Header Actions */}
            {activeSection === 'strategy' && <RefreshAnalysisButton />}
          </div>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 lg:p-6">
            <div className="max-w-5xl mx-auto">{renderActiveModule()}</div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ContextBuilderView;
