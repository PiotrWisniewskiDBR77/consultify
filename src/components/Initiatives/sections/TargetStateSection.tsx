/**
 * TargetStateSection - Target state, success criteria, deliverables
 */

import { motion } from 'framer-motion';
import { Loader2, Plus, Sparkles, Target, X } from 'lucide-react';
import React, { useState } from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const TargetStateSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { initiative, isPolish, isGeneratingAI, handleGenerateAI } = useInitiativeContext();

  const targetData = initiative?.targetState || initiative?.target_state || {};
  const [targetDescription, setTargetDescription] = useState(
    typeof targetData === 'object'
      ? targetData.description || ''
      : typeof targetData === 'string'
        ? targetData
        : ''
  );
  const [successCriteria, setSuccessCriteria] = useState<string[]>(
    typeof targetData === 'object' ? targetData.successCriteria || [] : []
  );
  const [deliverables, setDeliverables] = useState<string[]>(
    typeof targetData === 'object' ? targetData.deliverables || [] : []
  );
  const [newCriteria, setNewCriteria] = useState('');
  const [newDeliverable, setNewDeliverable] = useState('');

  const filledCount = [
    targetDescription,
    successCriteria.length > 0,
    deliverables.length > 0,
  ].filter(Boolean).length;

  return (
    <CollapsibleSection
      id="targetState"
      title={isPolish ? 'Stan docelowy i kryteria sukcesu' : 'Target State & Success Criteria'}
      icon={<Target size={18} className="text-emerald-500 dark:text-emerald-400" />}
      iconBg="bg-gradient-to-br from-emerald-500/10 to-green-500/10 dark:from-emerald-500/20 dark:to-green-500/20"
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
            const result = await handleGenerateAI('target_state');
            if (result?.parsedContent) {
              const data = result.parsedContent;
              if (data.targetDescription) setTargetDescription(data.targetDescription);
              if (data.successCriteria?.length) setSuccessCriteria(data.successCriteria);
              if (data.deliverables?.length) setDeliverables(data.deliverables);
            }
          }}
          disabled={isGeneratingAI === 'targetState'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
        >
          {isGeneratingAI === 'targetState' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          <span>AI</span>
        </motion.button>
      }
    >
      <div className="space-y-4">
        {/* Target Description */}
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
            {isPolish ? 'Opis stanu docelowego' : 'Target State Description'}
          </label>
          <textarea
            value={targetDescription}
            onChange={(e) => setTargetDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/10 resize-none transition-all text-sm"
            placeholder={
              isPolish
                ? 'Opisz pożądany stan końcowy po wdrożeniu inicjatywy...'
                : 'Describe the desired end state after initiative completion...'
            }
          />
        </div>

        {/* Success Criteria */}
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
            {isPolish ? 'Kryteria sukcesu' : 'Success Criteria'}
          </label>
          <p className="text-xs text-slate-400 mb-2">
            {isPolish
              ? 'Mierzalne warunki uznania inicjatywy za zakończoną sukcesem'
              : 'Measurable conditions for considering the initiative successful'}
          </p>
          <div className="space-y-2 mb-3">
            {successCriteria.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/20"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-500">
                  ✓
                </div>
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
              value={newCriteria}
              onChange={(e) => setNewCriteria(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCriteria.trim()) {
                  setSuccessCriteria([...successCriteria, newCriteria.trim()]);
                  setNewCriteria('');
                }
              }}
              placeholder={isPolish ? 'Dodaj kryterium sukcesu...' : 'Add success criteria...'}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            />
            <button
              onClick={() => {
                if (newCriteria.trim()) {
                  setSuccessCriteria([...successCriteria, newCriteria.trim()]);
                  setNewCriteria('');
                }
              }}
              disabled={!newCriteria.trim()}
              className="px-3 py-2 rounded-lg text-emerald-500 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Deliverables */}
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
            {isPolish ? 'Produkty / Deliverables' : 'Deliverables'}
          </label>
          <div className="space-y-2 mb-3">
            {deliverables.map((d, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200/50 dark:border-blue-500/20"
              >
                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-500">
                  {i + 1}
                </div>
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{d}</span>
                <button
                  onClick={() => setDeliverables(deliverables.filter((_, j) => j !== i))}
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
              value={newDeliverable}
              onChange={(e) => setNewDeliverable(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newDeliverable.trim()) {
                  setDeliverables([...deliverables, newDeliverable.trim()]);
                  setNewDeliverable('');
                }
              }}
              placeholder={isPolish ? 'Dodaj produkt...' : 'Add deliverable...'}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            />
            <button
              onClick={() => {
                if (newDeliverable.trim()) {
                  setDeliverables([...deliverables, newDeliverable.trim()]);
                  setNewDeliverable('');
                }
              }}
              disabled={!newDeliverable.trim()}
              className="px-3 py-2 rounded-lg text-blue-500 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};
