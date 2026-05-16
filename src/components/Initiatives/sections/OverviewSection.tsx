/**
 * OverviewSection - Initiative Description / Summary
 *
 * Core description textarea with AI generation support.
 */

import { motion } from 'framer-motion';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import React from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const OverviewSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { summary, setSummary, isGeneratingAI, handleGenerateAI, isPolish } =
    useInitiativeContext();

  return (
    <CollapsibleSection
      id="summary"
      title={isPolish ? 'Opis inicjatywy' : 'Initiative Description'}
      icon={<FileText size={18} className="text-blue-500 dark:text-blue-400" />}
      iconBg="bg-gradient-to-br from-blue-500/10 to-blue-500/10 dark:from-blue-500/20 dark:to-blue-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={summary ? <span className="text-xs text-slate-400">✓</span> : undefined}
      actions={
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            handleGenerateAI('overview');
          }}
          disabled={isGeneratingAI === 'overview'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 text-xs font-medium transition-all disabled:opacity-50"
          title={isPolish ? 'Wygeneruj opis AI' : 'Generate AI description'}
        >
          {isGeneratingAI === 'overview' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          <span>AI</span>
        </motion.button>
      }
    >
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={4}
        className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/10 resize-none transition-all"
        placeholder={
          isPolish ? 'Opisz cel i zakres inicjatywy...' : 'Describe initiative goal and scope...'
        }
      />
    </CollapsibleSection>
  );
};
