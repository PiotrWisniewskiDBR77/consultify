/**
 * OverviewSection - Initiative Description / Summary
 *
 * Core description textarea with AI generation support.
 */

import { motion } from 'framer-motion';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const OverviewSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation();
  const { summary, setSummary, isGeneratingAI, handleGenerateAI } = useInitiativeContext();

  return (
    <CollapsibleSection
      id="summary"
      title={t('initiatives.overviewSection.initiativeDescription')}
      icon={<FileText size={18} className="text-blue-500 dark:text-blue-400" />}
      iconBg="bg-gradient-to-br from-blue-500/10 to-blue-500/10 dark:from-blue-500/20 dark:to-blue-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={summary ? <span className="text-xs text-c-text-secondary">✓</span> : undefined}
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-c-surface-raised text-c-info hover:bg-c-surface text-xs font-medium transition-all disabled:opacity-50"
          title={t('initiatives.overviewSection.generateAiDescription')}
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
        className="w-full px-3 py-2.5 rounded-xl bg-c-surface-raised border border-c-border text-c-text-secondary placeholder:text-c-text-muted focus:outline-none focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus resize-none transition-all"
        placeholder={t('initiatives.overviewSection.describeGoalScope')}
      />
    </CollapsibleSection>
  );
};
