/**
 * PartnerLayout - Two-column layout wrapper for Partner Portal
 *
 * Features:
 * - Fixed sidebar (280px) with PartnerSidebar
 * - Scrollable content area
 * - Responsive design (sidebar collapses on mobile)
 * - Breadcrumb support
 * - Header with section title and actions
 *
 * Design: Floating panels (ClickUp-style, consistent with AdminLayout)
 * - Gap-based separation instead of border lines
 * - Subtle shadow for depth
 * - Background shows through gaps
 */

import { ChevronRight, Menu, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { cn } from '../../utils/cn';
import { PartnerSection, PartnerSidebar } from './PartnerSidebar';

export interface Breadcrumb {
  label: string;
  section?: PartnerSection;
  href?: string;
}

interface PartnerLayoutProps {
  children: React.ReactNode;
  activeSection: PartnerSection;
  onSectionChange: (section: PartnerSection) => void;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  headerActions?: React.ReactNode;
  activeClients?: number;
  pendingCertifications?: number;
  onBack?: () => void;
  className?: string;
}

export const PartnerLayout: React.FC<PartnerLayoutProps> = ({
  children,
  activeSection,
  onSectionChange,
  title,
  subtitle,
  breadcrumbs,
  headerActions,
  activeClients,
  pendingCertifications,
  onBack,
  className,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar on section change (mobile)
  const handleSectionChange = useCallback(
    (section: PartnerSection) => {
      onSectionChange(section);
      if (isMobile) {
        setSidebarOpen(false);
      }
    },
    [onSectionChange, isMobile]
  );

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

  // Handle back to app
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      navigate('/chat');
    }
  }, [navigate, onBack]);

  return (
    <div className={cn('flex h-full bg-slate-100 dark:bg-navy-950', className)}>
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Dark Navy (matching Admin/Settings) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:transform-none',
          isMobile ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
        )}
      >
        <PartnerSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          activeClients={activeClients}
          pendingCertifications={pendingCertifications}
          onBack={handleBack}
        />
      </aside>

      {/* Main Content - Navy Background */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-navy-900">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-white/5 border-t-2 border-t-crimson-600 dark:border-t-crimson-500">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14">
            {/* Left side: Mobile menu + Breadcrumbs/Title */}
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              {isMobile && (
                <button
                  type="button"
                  aria-label={sidebarOpen ? 'Close partner navigation' : 'Open partner navigation'}
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-lg text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-800/20 transition-colors"
                >
                  {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              )}

              {/* Breadcrumbs or Title */}
              <div>
                {breadcrumbs && breadcrumbs.length > 0 ? (
                  <nav className="flex items-center gap-1 text-sm">
                    {breadcrumbs.map((crumb, index) => (
                      <React.Fragment key={index}>
                        {index > 0 && <ChevronRight className="w-4 h-4 text-slate-600" />}
                        {index < breadcrumbs.length - 1 ? (
                          <button
                            onClick={() => crumb.section && onSectionChange(crumb.section)}
                            className="text-slate-500 hover:text-primary-400 transition-colors"
                          >
                            {crumb.label}
                          </button>
                        ) : (
                          <span className="font-medium text-slate-900 dark:text-white">
                            {crumb.label}
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </nav>
                ) : (
                  title && (
                    <div>
                      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {title}
                      </h1>
                      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Right side: Actions */}
            {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6">
            <div className="bg-white dark:bg-navy-800/50 rounded-xl border border-slate-200 dark:border-white/5 p-6">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PartnerLayout;
