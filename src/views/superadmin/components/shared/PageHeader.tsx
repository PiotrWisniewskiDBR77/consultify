/**
 * Admin PageHeader Component
 *
 * Clean page header for Admin module
 *
 * Key principles:
 * - Reduced title size (text-xl vs text-2xl)
 * - font-semibold instead of font-bold
 * - tracking-tight for refined typography
 * - Smaller subtitle margin
 */

import { LucideIcon } from 'lucide-react';
import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  action,
  breadcrumb,
  className = '',
}) => {
  return (
    <header className={`mb-8 ${className}`}>
      {breadcrumb && <div className="mb-3">{breadcrumb}</div>}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 dark:border-transparent dark:bg-slate-800 flex items-center justify-center shadow-sm dark:shadow-none">
              <Icon size={20} className="text-slate-500 dark:text-slate-400" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50 tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </header>
  );
};

// Section header for sub-sections
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
  className = '',
}) => {
  return (
    <div className={`flex items-start justify-between mb-4 ${className}`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

// Breadcrumb component
interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav className="flex items-center gap-2 text-sm">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-slate-600 dark:text-slate-400">/</span>}
          {item.onClick || item.href ? (
            <button
              onClick={item.onClick}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-300 transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span
              className={
                index === items.length - 1 ? 'text-slate-600' : 'text-slate-500 dark:text-slate-400'
              }
            >
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default PageHeader;
