/**
 * OrganizationView - Settings-like two-column Organization module
 *
 * Single Sidebar entry → this view → internal left navigation with URL sections.
 * Reuses ContextBuilder modules for content.
 */

import { Menu, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import OrganizationSidebar, {
  type OrganizationSection,
} from '../components/Organization/OrganizationSidebar';
import { ROUTES } from '../routes/routeConfig';
import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';
import { ChallengeMapModule } from './ContextBuilder/modules/ChallengeMapModule';
import { CompanyProfileModule } from './ContextBuilder/modules/CompanyProfileModule';
import { GoalsExpectationsModule } from './ContextBuilder/modules/GoalsExpectationsModule';
import { MegatrendScannerModule } from './ContextBuilder/modules/MegatrendScannerModule';
import { StrategicSynthesisModule } from './ContextBuilder/modules/StrategicSynthesisModule';

const sectionMeta: Record<OrganizationSection, { title: string; subtitle: string }> = {
  profile: { title: 'Profile', subtitle: 'Company snapshot and operating model' },
  goals: { title: 'Goals', subtitle: 'Strategic intent, metrics, scope and expectations' },
  challenges: { title: 'Challenges', subtitle: 'Challenge map, evidence and root causes' },
  megatrends: { title: 'Megatrends', subtitle: 'Industry baseline and trend radar' },
  strategy: { title: 'Strategy', subtitle: 'Synthesis, scenarios and executive summary' },
};

export const OrganizationView: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { setCurrentView } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeSection = useMemo(() => {
    const pathSection =
      location.pathname.replace(`${ROUTES.ORGANIZATION.ROOT}/`, '').replace(/^\/+|\/+$/g, '') ||
      'profile';
    const allowed = Object.keys(sectionMeta) as OrganizationSection[];
    return (
      allowed.includes(pathSection as OrganizationSection) ? pathSection : 'profile'
    ) as OrganizationSection;
  }, [location.pathname]);

  const handleSectionChange = useCallback(
    (section: OrganizationSection) => {
      navigate(`${ROUTES.ORGANIZATION.ROOT}/${section}`);
      setSidebarOpen(false);
    },
    [navigate]
  );

  const handleBackToDashboard = useCallback(() => {
    setCurrentView(AppView.AI_CHAT);
    navigate(ROUTES.AI_CHAT);
  }, [navigate, setCurrentView]);

  const currentMeta = useMemo(() => {
    const meta = sectionMeta[activeSection];
    return {
      title: t(`organization.sections.${activeSection}.title`, meta.title),
      subtitle: t(`organization.sections.${activeSection}.subtitle`, meta.subtitle),
    };
  }, [activeSection, t]);

  const renderContent = useCallback(() => {
    if (activeSection === 'goals') return <GoalsExpectationsModule />;
    if (activeSection === 'challenges') return <ChallengeMapModule />;
    if (activeSection === 'megatrends') return <MegatrendScannerModule />;
    if (activeSection === 'strategy') return <StrategicSynthesisModule />;
    return <CompanyProfileModule />;
  }, [activeSection]);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-50 dark:bg-navy-950">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close organization navigation"
          data-testid="organization-mobile-overlay"
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (desktop) */}
      <div className="hidden lg:block">
        <OrganizationSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          onBack={handleBackToDashboard}
        />
      </div>

      {/* Sidebar (mobile drawer) */}
      <div
        data-testid="organization-mobile-drawer"
        className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <OrganizationSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          onBack={handleBackToDashboard}
          className="h-full bg-white dark:bg-navy-900"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 z-10 bg-slate-50/90 dark:bg-navy-950/80 backdrop-blur border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3 px-4 py-4">
            <button
              type="button"
              className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300"
              aria-label="Open organization navigation"
              data-testid="organization-mobile-open"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-navy-900 dark:text-white truncate">
                {currentMeta.title}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {currentMeta.subtitle}
              </p>
            </div>

            {sidebarOpen && (
              <button
                type="button"
                className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300"
                aria-label="Close organization navigation"
                data-testid="organization-mobile-close"
                onClick={() => setSidebarOpen(false)}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="p-4 lg:p-6">{renderContent()}</div>
      </div>
    </div>
  );
};

export default OrganizationView;
