/**
 * CollapsibleSection
 *
 * Reusable collapsible section wrapper for initiative document views.
 * Extracted from InitiativeDocumentView for reuse across all section components.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import React from 'react';

import { SectionIcon } from './shared/sectionIcon';
import type { SectionTypeInfo } from './types';

interface CollapsibleSectionProps {
  id: string;
  /** Explicit title; when omitted, derived from `sectionType` (registry). */
  title?: string;
  /** Explicit icon; when omitted, derived from `sectionType.icon`. */
  icon?: React.ReactNode;
  /** Explicit icon background; when omitted, derived from `sectionType.iconBg`. */
  iconBg?: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** M13/K2: registry-driven visual identity (icon/color/title fallback). */
  sectionType?: SectionTypeInfo;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  icon,
  iconBg,
  expanded,
  onToggle,
  badge,
  children,
  actions,
  sectionType,
}) => {
  // K2: a single, registry-driven header — explicit props win, else derive from
  // SectionTypeInfo so the section's identity comes from one source.
  const resolvedTitle = title ?? (sectionType ? sectionType.namePl || sectionType.name : '');
  const resolvedIcon =
    icon ??
    (sectionType ? <SectionIcon name={sectionType.icon} color={sectionType.iconColor} /> : null);
  const resolvedIconBg = iconBg ?? sectionType?.iconBg ?? 'bg-slate-500/10 dark:bg-slate-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/70 dark:bg-navy-900/70 backdrop-blur rounded-2xl border border-slate-200 dark:border-navy-700/60 overflow-hidden"
    >
      <div
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${resolvedIconBg}`}>{resolvedIcon}</div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {resolvedTitle}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {expanded && actions}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-slate-600" />
          </motion.div>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200/80 dark:border-navy-700/80 overflow-hidden"
          >
            <div className="p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
