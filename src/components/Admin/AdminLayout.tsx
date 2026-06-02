/**
 * AdminLayout - Two-column layout wrapper for Admin module
 *
 * Features:
 * - Fixed sidebar (280px) with AdminSidebar
 * - Scrollable content area
 * - Responsive design (sidebar collapses on mobile)
 * - Breadcrumb support
 * - Header with section title and actions
 *
 * Design: Floating panels (ClickUp-style)
 * - Gap-based separation instead of border lines
 * - Subtle shadow for depth
 * - Background shows through gaps
 */

import { ChevronRight, Menu, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils/cn';
import { AdminSection, AdminSidebar } from '../layout/AdminSidebar';

export interface Breadcrumb {
  label: string;
  section?: AdminSection;
  href?: string;
}

interface AdminLayoutProps {
  children: React.ReactNode;
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  headerActions?: React.ReactNode;
  pendingInvites?: number;
  pendingDataRequests?: number;
  onBack?: () => void;
  className?: string;
  currentUserEmail?: string;
  companyName?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activeSection,
  onSectionChange,
  title,
  subtitle,
  breadcrumbs,
  headerActions,
  pendingInvites,
  pendingDataRequests,
  onBack,
  className,
}) => {
  const { t } = useTranslation();
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
    (section: AdminSection) => {
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

  return (
    <div className={cn('flex h-full bg-slate-100 dark:bg-navy-950 gap-0.5', className)}>
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Floating Panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:transform-none',
          isMobile ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
        )}
      >
        <AdminSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          onBackToApp={onBack || (() => {})}
          currentUserEmail=""
          companyName=""
        />
      </aside>

      {/* Main Content - Floating Panel */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-navy-900 lg:rounded-l-lg shadow-sm">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-navy-900/80 backdrop-blur-sm border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14">
            {/* Left side: Mobile menu + Breadcrumbs/Title */}
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
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
                        {index > 0 && (
                          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        )}
                        {index < breadcrumbs.length - 1 ? (
                          <button
                            onClick={() => crumb.section && onSectionChange(crumb.section)}
                            className="text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                          >
                            {crumb.label}
                          </button>
                        ) : (
                          <span className="font-medium text-navy-900 dark:text-white">
                            {crumb.label}
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </nav>
                ) : (
                  title && (
                    <div>
                      <h1 className="text-lg font-semibold text-navy-900 dark:text-white">
                        {title}
                      </h1>
                      {subtitle && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
                      )}
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
          <div className="p-4 lg:p-6">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
