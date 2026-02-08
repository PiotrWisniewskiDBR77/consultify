/**
 * PilotSection - Pilot phase: hypotheses, success/failure criteria, results
 */

import { motion } from 'framer-motion';
import { Loader2, Plus, Sparkles, X } from 'lucide-react';
import { Sparkle } from 'lucide-react';
import React, { useState } from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const PilotSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { initiative, isPolish, isGeneratingAI, handleGenerateAI } = useInitiativeContext();

  const pilotData = initiative?.pilot || {};
  const [hypotheses, setHypotheses] = useState<string[]>(pilotData.hypotheses || []);
  const [successCriteria, setSuccessCriteria] = useState<string[]>(pilotData.successCriteria || []);
  const [failureCriteria, setFailureCriteria] = useState<string[]>(pilotData.failureCriteria || []);
  const [results, setResults] = useState(pilotData.results || '');
  const [pilotStatus, setPilotStatus] = useState(pilotData.status || 'not_started');
  const [newHyp, setNewHyp] = useState('');
  const [newSuccess, setNewSuccess] = useState('');
  const [newFailure, setNewFailure] = useState('');

  const statusConfig: Record<string, { label: string; labelPl: string; color: string }> = {
    not_started: {
      label: 'Not Started',
      labelPl: 'Nie rozpoczęty',
      color: 'bg-slate-500/20 text-slate-400',
    },
    in_progress: {
      label: 'In Progress',
      labelPl: 'W trakcie',
      color: 'bg-blue-500/20 text-blue-400',
    },
    success: { label: 'Success', labelPl: 'Sukces', color: 'bg-emerald-500/20 text-emerald-400' },
    failure: { label: 'Failed', labelPl: 'Niepowodzenie', color: 'bg-red-500/20 text-red-400' },
    inconclusive: {
      label: 'Inconclusive',
      labelPl: 'Niejednoznaczny',
      color: 'bg-amber-500/20 text-amber-400',
    },
  };

  return (
    <CollapsibleSection
      id="pilot"
      title="Pilot"
      icon={<Sparkle size={18} className="text-indigo-500 dark:text-indigo-400" />}
      iconBg="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/20 dark:to-violet-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${statusConfig[pilotStatus]?.color || 'bg-slate-500/20 text-slate-400'}`}
        >
          {isPolish ? statusConfig[pilotStatus]?.labelPl : statusConfig[pilotStatus]?.label}
        </span>
      }
      actions={
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={async (e) => {
            e.stopPropagation();
            const result = await handleGenerateAI('pilot');
            if (result?.parsedContent) {
              const data = result.parsedContent;
              if (data.hypotheses?.length) setHypotheses(data.hypotheses);
              if (data.successCriteria?.length) setSuccessCriteria(data.successCriteria);
              if (data.failureCriteria?.length) setFailureCriteria(data.failureCriteria);
            }
          }}
          disabled={isGeneratingAI === 'pilot'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
        >
          {isGeneratingAI === 'pilot' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          <span>AI</span>
        </motion.button>
      }
    >
      <div className="space-y-5">
        {/* Status */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            {isPolish ? 'Status pilotu' : 'Pilot Status'}
          </label>
          <select
            value={pilotStatus}
            onChange={(e) => setPilotStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
          >
            {Object.entries(statusConfig).map(([key, config]) => (
              <option key={key} value={key}>
                {isPolish ? config.labelPl : config.label}
              </option>
            ))}
          </select>
        </div>

        {/* Hypotheses */}
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
            {isPolish ? 'Hipotezy do zweryfikowania' : 'Hypotheses to Verify'}
          </label>
          <div className="space-y-2 mb-3">
            {hypotheses.map((h, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-200/50 dark:border-indigo-500/20"
              >
                <span className="text-xs font-bold text-indigo-500">H{i + 1}</span>
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{h}</span>
                <button
                  onClick={() => setHypotheses(hypotheses.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newHyp}
              onChange={(e) => setNewHyp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newHyp.trim()) {
                  setHypotheses([...hypotheses, newHyp.trim()]);
                  setNewHyp('');
                }
              }}
              placeholder={isPolish ? 'Dodaj hipotezę...' : 'Add hypothesis...'}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            />
            <button
              onClick={() => {
                if (newHyp.trim()) {
                  setHypotheses([...hypotheses, newHyp.trim()]);
                  setNewHyp('');
                }
              }}
              disabled={!newHyp.trim()}
              className="px-3 py-2 rounded-lg text-indigo-500 border border-indigo-200 dark:border-indigo-500/30 disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Success Criteria */}
        <div>
          <label className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2 block">
            {isPolish ? 'Kryteria sukcesu pilotu' : 'Pilot Success Criteria'}
          </label>
          <div className="space-y-2 mb-3">
            {successCriteria.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/20"
              >
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{c}</span>
                <button
                  onClick={() => setSuccessCriteria(successCriteria.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSuccess}
              onChange={(e) => setNewSuccess(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSuccess.trim()) {
                  setSuccessCriteria([...successCriteria, newSuccess.trim()]);
                  setNewSuccess('');
                }
              }}
              placeholder={
                isPolish ? 'Kiedy pilot jest sukcesem?' : 'When is the pilot successful?'
              }
              className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            />
            <button
              onClick={() => {
                if (newSuccess.trim()) {
                  setSuccessCriteria([...successCriteria, newSuccess.trim()]);
                  setNewSuccess('');
                }
              }}
              disabled={!newSuccess.trim()}
              className="px-3 py-2 rounded-lg text-emerald-500 border border-emerald-200 dark:border-emerald-500/30 disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Failure Criteria */}
        <div>
          <label className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 block">
            {isPolish ? 'Kryteria porażki' : 'Failure Criteria'}
          </label>
          <div className="space-y-2 mb-3">
            {failureCriteria.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-red-50/50 dark:bg-red-500/5 border border-red-200/50 dark:border-red-500/20"
              >
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{c}</span>
                <button
                  onClick={() => setFailureCriteria(failureCriteria.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFailure}
              onChange={(e) => setNewFailure(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFailure.trim()) {
                  setFailureCriteria([...failureCriteria, newFailure.trim()]);
                  setNewFailure('');
                }
              }}
              placeholder={isPolish ? 'Kiedy pilot jest porażką?' : 'When is the pilot a failure?'}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            />
            <button
              onClick={() => {
                if (newFailure.trim()) {
                  setFailureCriteria([...failureCriteria, newFailure.trim()]);
                  setNewFailure('');
                }
              }}
              disabled={!newFailure.trim()}
              className="px-3 py-2 rounded-lg text-red-500 border border-red-200 dark:border-red-500/30 disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Results */}
        {(pilotStatus === 'success' ||
          pilotStatus === 'failure' ||
          pilotStatus === 'inconclusive') && (
          <div className="pt-4 border-t border-slate-200 dark:border-navy-700">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
              {isPolish ? 'Wyniki pilotu' : 'Pilot Results'}
            </label>
            <textarea
              value={results}
              onChange={(e) => setResults(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-600/80 text-sm resize-none"
              placeholder={isPolish ? 'Opisz wyniki pilotu...' : 'Describe pilot results...'}
            />
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
