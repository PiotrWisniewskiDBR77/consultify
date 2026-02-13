/**
 * NModeLeftNav
 *
 * Sticky left navigation rail (~220px) for section switching.
 * Shows icons + labels with active state highlighting.
 * Click → shows ONE section at a time in the Canvas (no scroll-all).
 *
 * @see docs/ui-standards/detail-view-presentation-modes.md §2.5.2
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import type { NModeSection } from './types';

interface NModeLeftNavProps {
  /** Available sections */
  sections: NModeSection[];
  /** Currently active section id */
  activeSection: string;
  /** Section change handler */
  onSectionChange: (sectionId: string) => void;
}

export const NModeLeftNav: React.FC<NModeLeftNavProps> = ({
  sections,
  activeSection,
  onSectionChange,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  return (
    <nav className="w-[220px] flex-shrink-0 pr-4 border-r border-slate-200/40 dark:border-navy-700/40">
      <div className="sticky top-28 pt-1 space-y-1">
        {sections.map((section) => {
          const isActive = activeSection === section.id;
          const Icon = section.icon;

          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`group w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-[180ms] ${
                isActive
                  ? 'bg-primary-500/10 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 border-l-2 border-primary-500'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-navy-800/60 border-l-2 border-transparent'
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon
                  size={14}
                  className={
                    isActive
                      ? 'text-primary-500 dark:text-primary-400'
                      : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300'
                  }
                />
                {isPolish ? section.label.pl : section.label.en}
                {section.badge !== undefined && section.badge > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-slate-200/80 dark:bg-navy-700/80 text-slate-500 dark:text-slate-400">
                    {section.badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default NModeLeftNav;
