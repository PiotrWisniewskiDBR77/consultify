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

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const ProblemDefinitionSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { initiative, isPolish, isGeneratingAI, handleGenerateAI } = useInitiativeContext();

  // Local state for structured problem fields (stored in initiative.problemDefinition JSON)
  const problemData = initiative?.problemDefinition || initiative?.problem_definition || {};
  const [symptom, setSymptom] = useState(typeof problemData === 'object' ? problemData.symptom || '' : '');
  const [rootCause, setRootCause] = useState(typeof problemData === 'object' ? problemData.rootCause || '' : '');
  const [costOfInaction, setCostOfInaction] = useState(typeof problemData === 'object' ? problemData.costOfInaction || '' : '');

  const filledCount = [symptom, rootCause, costOfInaction].filter(Boolean).length;

  return (
    <CollapsibleSection
      id="problemDefinition"
      title={isPolish ? 'Definicja problemu' : 'Problem Definition'}
      icon={<AlertTriangle size={18} className="text-rose-500 dark:text-rose-400" />}
      iconBg="bg-gradient-to-br from-rose-500/10 to-red-500/10 dark:from-rose-500/20 dark:to-red-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        filledCount > 0 ? (
          <span className="text-xs text-slate-400">{filledCount}/3</span>
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
            const result = await handleGenerateAI('problem_definition');
            if (result?.parsedContent) {
              const data = result.parsedContent;
              if (data.symptom) setSymptom(data.symptom);
              if (data.rootCause) setRootCause(data.rootCause);
              if (data.costOfInaction) setCostOfInaction(data.costOfInaction);
            }
          }}
          disabled={isGeneratingAI === 'problemDefinition'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
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
      <div className="space-y-4">
        {/* Symptom */}
        <div>
          <label className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center text-xs font-bold text-rose-500">1</div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {isPolish ? 'Symptom / Co obserwujemy' : 'Symptom / What is observed'}
            </span>
          </label>
          <p className="text-xs text-slate-400 mb-2">
            {isPolish
              ? 'Opisz widoczne objawy problemu - co zgłaszają użytkownicy, jakie metryki spadają'
              : 'Describe visible symptoms - what users report, which metrics are declining'}
          </p>
          <textarea
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 resize-none transition-all text-sm"
            placeholder={isPolish ? 'Np. Czas odpowiedzi API wzrósł o 40% w ciągu ostatniego kwartału...' : 'E.g. API response time has increased by 40% over the last quarter...'}
          />
        </div>

        {/* Root Cause */}
        <div>
          <label className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-xs font-bold text-orange-500">2</div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {isPolish ? 'Przyczyna źródłowa' : 'Root Cause'}
            </span>
          </label>
          <p className="text-xs text-slate-400 mb-2">
            {isPolish
              ? 'Zidentyfikuj dlaczego problem występuje - analiza 5 Why, diagram Ishikawy'
              : 'Identify why the problem occurs - 5 Whys analysis, Ishikawa diagram'}
          </p>
          <textarea
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 resize-none transition-all text-sm"
            placeholder={isPolish ? 'Np. Baza danych nie jest zoptymalizowana pod kątem rosnącego wolumenu transakcji...' : 'E.g. Database is not optimized for growing transaction volume...'}
          />
        </div>

        {/* Cost of Inaction */}
        <div>
          <label className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-xs font-bold text-red-500">3</div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {isPolish ? 'Koszt bezczynności' : 'Cost of Inaction'}
            </span>
          </label>
          <p className="text-xs text-slate-400 mb-2">
            {isPolish
              ? 'Co się stanie jeśli nie podejmiemy działań? Jakie są konsekwencje biznesowe?'
              : 'What happens if we do nothing? What are the business consequences?'}
          </p>
          <textarea
            value={costOfInaction}
            onChange={(e) => setCostOfInaction(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/10 resize-none transition-all text-sm"
            placeholder={isPolish ? 'Np. Ryzyko utraty 15% klientów enterprise w ciągu 6 miesięcy...' : 'E.g. Risk of losing 15% of enterprise clients within 6 months...'}
          />
        </div>

        {/* Completeness indicator */}
        <div className="pt-3 border-t border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">{isPolish ? 'Kompletność definicji' : 'Definition Completeness'}</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{Math.round((filledCount / 3) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(filledCount / 3) * 100}%` }}
              className="h-full bg-gradient-to-r from-rose-500 to-red-500 rounded-full"
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};
