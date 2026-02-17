/**
 * CollapsibleSection
 *
 * Reusable collapsible section wrapper for initiative document views.
 * Extracted from InitiativeDocumentView for reuse across all section components.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import React from 'react';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
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
}) => (
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
        <div className={`p-2 rounded-xl ${iconBg}`}>{icon}</div>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        {expanded && actions}
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={18} className="text-slate-400" />
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
