/**
 * ProblemDefinitionSection - Structured problem analysis
 *
 * Three structured fields:
 * 1. Symptom - What is observed/reported
 * 2. Root Cause - Why it's happening
 * 3. Cost of Inaction - What happens if we do nothing
 */

import { motion } from 'framer-motion';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AIFieldEnhancer } from '@/components/shared/AIFieldEnhancer';

import { CardBlockRenderer } from '../cards/CardBlockRenderer';
import { buildProblemCardSpec } from '../cards/cardSpecBuilders';
import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const ProblemDefinitionSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation();
  const { initiative, isGeneratingAI, handleGenerateAI } = useInitiativeContext();
  const artifactContext = {
    type: 'initiative',
    title: initiative?.name || '',
    status: initiative?.status || '',
    priority: initiative?.priority || '',
  };

  // Local state for structured problem fields (stored in initiative.problemDefinition JSON)
  const problemData = initiative?.problemDefinition || initiative?.problem_definition || {};
  const [symptom, setSymptom] = useState(
    typeof problemData === 'object' ? problemData.symptom || '' : ''
  );
  const [rootCause, setRootCause] = useState(
    typeof problemData === 'object' ? problemData.rootCause || '' : ''
  );
  const [costOfInaction, setCostOfInaction] = useState(
    typeof problemData === 'object' ? problemData.costOfInaction || '' : ''
  );

  const filledCount = [symptom, rootCause, costOfInaction].filter(Boolean).length;

  // F3 (D11) proof-of-pattern: declarative display layer via the generic
  // CardBlockRenderer. ADDITIVE — rendered as a read-only preview below the
  // structured edit fields. Built from the live edit state so it stays in sync.
  const problemCardSpec = buildProblemCardSpec(
    { symptom, rootCause, costOfInaction },
    {
      title: t('initiatives.problemDefinitionSection.problemDefinition'),
      symptomHeading: t('initiatives.problemDefinitionSection.symptomTitle'),
      rootCauseHeading: t('initiatives.problemDefinitionSection.rootCause'),
      costOfInactionTitle: t('initiatives.problemDefinitionSection.costOfInaction'),
    }
  );

  return (
    <CollapsibleSection
      id="problemDefinition"
      title={t('initiatives.problemDefinitionSection.problemDefinition')}
      icon={<AlertTriangle size={18} className="text-danger-500 dark:text-danger-400" />}
      iconBg="bg-gradient-to-br from-danger-500/10 to-danger-500/10 dark:from-danger-500/20 dark:to-danger-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        filledCount > 0 ? (
          <span className="text-xs text-c-text-secondary">{filledCount}/3</span>
        ) : undefined
      }
      actions={
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={async (e) => {
            e.stopPropagation();
            const result = await handleGenerateAI('problemDefinition');
            if (result?.parsedContent) {
              const data = result.parsedContent;
              if (data.symptom) setSymptom(data.symptom);
              if (data.rootCause) setRootCause(data.rootCause);
              if (data.costOfInaction) setCostOfInaction(data.costOfInaction);
            }
          }}
          disabled={isGeneratingAI === 'problemDefinition'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-c-surface-raised text-c-info hover:bg-c-surface text-xs font-medium transition-all disabled:opacity-50"
        >
          {isGeneratingAI === 'problemDefinition' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          <span>AI</span>
        </motion.button>
      }
    >
      {filledCount === 0 && (
        <div className="text-center py-6 border-2 border-dashed border-c-border rounded-xl mb-4">
          <AlertTriangle size={32} className="mx-auto mb-3 text-c-text-secondary" />
          <p className="text-sm font-medium text-c-text-secondary">
            {t('initiatives.problemDefinitionSection.noProblemDefinitionYet')}
          </p>
          <p className="text-xs text-c-text-secondary mt-1 max-w-xs mx-auto">
            {t('initiatives.problemDefinitionSection.describeOrUseAi')}
          </p>
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={async (e) => {
              e.preventDefault();
              const result = await handleGenerateAI('problemDefinition');
              if (result?.parsedContent) {
                const data = result.parsedContent;
                if (data.symptom) setSymptom(data.symptom);
                if (data.rootCause) setRootCause(data.rootCause);
                if (data.costOfInaction) setCostOfInaction(data.costOfInaction);
              }
            }}
            disabled={isGeneratingAI === 'problemDefinition'}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-c-surface-raised text-c-info hover:bg-c-surface text-sm font-medium transition-all disabled:opacity-50"
          >
            {isGeneratingAI === 'problemDefinition' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            <span>{t('initiatives.problemDefinitionSection.generateWithAi')}</span>
          </motion.button>
        </div>
      )}
      <div className="space-y-4">
        {/* Symptom */}
        <div>
          <label className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-danger-500/20 flex items-center justify-center text-xs font-bold text-danger-500">
              1
            </div>
            <span className="text-sm font-semibold text-c-text-secondary">
              {t('initiatives.problemDefinitionSection.symptomTitle')}
            </span>
            <div className="ml-auto">
              <AIFieldEnhancer
                fieldKey="problemDefinition.symptom"
                sectionLabel={t('initiatives.problemDefinitionSection.symptomLabel')}
                currentValue={symptom}
                onApply={setSymptom}
                artifactContext={artifactContext}
                iconOnly
                outputFormat="paragraph"
              />
            </div>
          </label>
          <p className="text-xs text-c-text-secondary mb-2">
            {t('initiatives.problemDefinitionSection.symptomHint')}
          </p>
          <textarea
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-c-surface-raised border border-c-border text-c-text-secondary placeholder:text-c-text-muted focus:outline-none focus:border-danger-400 focus:ring-2 focus:ring-danger-500/10 resize-none transition-all text-sm"
            placeholder={t('initiatives.problemDefinitionSection.symptomPlaceholder')}
          />
        </div>

        {/* Root Cause */}
        <div>
          <label className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-500">
              2
            </div>
            <span className="text-sm font-semibold text-c-text-secondary">
              {t('initiatives.problemDefinitionSection.rootCause')}
            </span>
            <div className="ml-auto">
              <AIFieldEnhancer
                fieldKey="problemDefinition.rootCause"
                sectionLabel={t('initiatives.problemDefinitionSection.rootCauseLabel')}
                currentValue={rootCause}
                onApply={setRootCause}
                artifactContext={artifactContext}
                iconOnly
                outputFormat="paragraph"
              />
            </div>
          </label>
          <p className="text-xs text-c-text-secondary mb-2">
            {t('initiatives.problemDefinitionSection.rootCauseHint')}
          </p>
          <textarea
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-c-surface-raised border border-c-border text-c-text-secondary placeholder:text-c-text-muted focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 resize-none transition-all text-sm"
            placeholder={t('initiatives.problemDefinitionSection.rootCausePlaceholder')}
          />
        </div>

        {/* Cost of Inaction */}
        <div>
          <label className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-danger-500/20 flex items-center justify-center text-xs font-bold text-danger-500">
              3
            </div>
            <span className="text-sm font-semibold text-c-text-secondary">
              {t('initiatives.problemDefinitionSection.costOfInaction')}
            </span>
            <div className="ml-auto">
              <AIFieldEnhancer
                fieldKey="problemDefinition.costOfInaction"
                sectionLabel={t('initiatives.problemDefinitionSection.costOfInactionLabel')}
                currentValue={costOfInaction}
                onApply={setCostOfInaction}
                artifactContext={artifactContext}
                iconOnly
                outputFormat="paragraph"
              />
            </div>
          </label>
          <p className="text-xs text-c-text-secondary mb-2">
            {t('initiatives.problemDefinitionSection.costOfInactionHint')}
          </p>
          <textarea
            value={costOfInaction}
            onChange={(e) => setCostOfInaction(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-c-surface-raised border border-c-border text-c-text-secondary placeholder:text-c-text-muted focus:outline-none focus:border-danger-400 focus:ring-2 focus:ring-danger-500/10 resize-none transition-all text-sm"
            placeholder={t('initiatives.problemDefinitionSection.costOfInactionPlaceholder')}
          />
        </div>

        {/* Completeness indicator */}
        <div className="pt-3 border-t border-c-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-c-text-muted">
              {t('initiatives.problemDefinitionSection.definitionCompleteness')}
            </span>
            <span className="text-xs font-medium text-c-text-secondary">
              {Math.round((filledCount / 3) * 100)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-c-surface-raised overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(filledCount / 3) * 100}%` }}
              className="h-full bg-gradient-to-r from-danger-500 to-danger-500 rounded-full"
            />
          </div>
        </div>

        {/* F3 (D11) display layer — generic CardBlockRenderer preview.
            ADDITIVE: a read-only "as it reads" view built from the same data,
            shown only once there is content. Does not replace the edit fields. */}
        {filledCount > 0 && (
          <div className="pt-3 border-t border-c-border">
            <div className="text-xs font-medium uppercase tracking-wide text-c-text-muted mb-2">
              {t('initiatives.problemDefinitionSection.problemDefinition')}
            </div>
            <CardBlockRenderer spec={problemCardSpec} showTitle={false} />
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
