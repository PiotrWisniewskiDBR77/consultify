/**
 * DecisionsSection
 *
 * Key decisions linked to the initiative with approval tracking.
 * Extracted from InitiativeDocumentView.
 */

import { motion } from 'framer-motion';
import { Loader2, Plus, Scale, Sparkles } from 'lucide-react';
import React from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const DecisionsSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const {
    decisions,
    isPolish,
    isGeneratingAI,
    handleGenerateAI,
    isMutating,
    showCreateDecision,
    setShowCreateDecision,
    newDecisionTitle,
    setNewDecisionTitle,
    newDecisionType,
    setNewDecisionType,
    handleCreateDecision,
    onOpenDecision,
  } = useInitiativeContext();

  return (
    <CollapsibleSection
      id="decisions"
      title={isPolish ? 'Decyzje' : 'Decisions'}
      icon={<Scale size={18} className="text-amber-500 dark:text-amber-400" />}
      iconBg="bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        decisions.length > 0 ? (
          <span className="text-xs text-slate-400">
            {decisions.filter((d) => d.status === 'APPROVED').length}/{decisions.length}
          </span>
        ) : undefined
      }
      actions={
        <div className="flex items-center gap-2">
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateDecision(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-medium transition-all"
          >
            <Plus size={14} />
            <span>{isPolish ? 'Nowa' : 'New'}</span>
          </motion.button>
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateAI('decisions');
            }}
            disabled={isGeneratingAI === 'decisions'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
            title={isPolish ? 'AI zasugeruje decyzje' : 'AI will suggest decisions'}
          >
            {isGeneratingAI === 'decisions' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            <span>AI</span>
          </motion.button>
        </div>
      }
    >
      {showCreateDecision && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-xl border-2 border-amber-300 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-500/5 space-y-3"
        >
          <input
            type="text"
            value={newDecisionTitle}
            onChange={(e) => setNewDecisionTitle(e.target.value)}
            placeholder={isPolish ? 'Tytuł decyzji...' : 'Decision title...'}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            autoFocus
          />
          <select
            value={newDecisionType}
            onChange={(e) => setNewDecisionType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
          >
            <option value="GOVERNANCE_DECISION_MAKING">Go/No-Go</option>
            <option value="RESOURCE_RESPONSIBILITY">Resources Commit</option>
            <option value="SCHEDULE_MILESTONES">Schedule Lock</option>
            <option value="BUDGET_APPROVAL">Budget Approval</option>
            <option value="OTHER">Other</option>
          </select>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateDecision(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              onClick={handleCreateDecision}
              disabled={isMutating || !newDecisionTitle.trim()}
              className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg disabled:opacity-50"
            >
              {isPolish ? 'Utwórz' : 'Create'}
            </button>
          </div>
        </motion.div>
      )}
      {/* Decision Stats Summary */}
      {decisions.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-amber-500/10 text-center">
            <div className="text-lg font-bold text-amber-500">
              {
                decisions.filter(
                  (d) =>
                    (d.status as string) === 'pending' ||
                    (d.status as string) === 'PENDING' ||
                    (d.status as string) === 'escalated' ||
                    (d.status as string) === 'ESCALATED'
                ).length
              }
            </div>
            <div className="text-[10px] uppercase text-amber-500/70">
              {isPolish ? 'Oczekujące' : 'Pending'}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-center">
            <div className="text-lg font-bold text-emerald-500">
              {
                decisions.filter(
                  (d) => (d.status as string) === 'APPROVED' || (d.status as string) === 'approved'
                ).length
              }
            </div>
            <div className="text-[10px] uppercase text-emerald-500/70">
              {isPolish ? 'Zatwierdzone' : 'Approved'}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-red-500/10 text-center">
            <div className="text-lg font-bold text-red-500">
              {
                decisions.filter(
                  (d) => (d.status as string) === 'REJECTED' || (d.status as string) === 'rejected'
                ).length
              }
            </div>
            <div className="text-[10px] uppercase text-red-500/70">
              {isPolish ? 'Odrzucone' : 'Rejected'}
            </div>
          </div>
        </div>
      )}

      {decisions.length === 0 && !showCreateDecision ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
          <Scale size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">{isPolish ? 'Brak decyzji' : 'No decisions yet'}</p>
          <p className="text-xs text-slate-400 mt-1">
            {isPolish
              ? 'Dodaj decyzje bramkowe lub operacyjne'
              : 'Add gate or operational decisions'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Gate decisions first */}
          {decisions
            .sort((a, b) => {
              // Gate decisions on top
              const aIsGate = [
                'GOVERNANCE_DECISION_MAKING',
                'RESOURCE_RESPONSIBILITY',
                'SCHEDULE_MILESTONES',
              ].includes(a.type);
              const bIsGate = [
                'GOVERNANCE_DECISION_MAKING',
                'RESOURCE_RESPONSIBILITY',
                'SCHEDULE_MILESTONES',
              ].includes(b.type);
              if (aIsGate && !bIsGate) return -1;
              if (!aIsGate && bIsGate) return 1;
              // Then by status: pending first
              const aIsPending = !['APPROVED', 'approved', 'REJECTED', 'rejected'].includes(
                a.status as string
              );
              const bIsPending = !['APPROVED', 'approved', 'REJECTED', 'rejected'].includes(
                b.status as string
              );
              if (aIsPending && !bIsPending) return -1;
              if (!aIsPending && bIsPending) return 1;
              return 0;
            })
            .map((d) => {
              const isGate = [
                'GOVERNANCE_DECISION_MAKING',
                'RESOURCE_RESPONSIBILITY',
                'SCHEDULE_MILESTONES',
                'GO_NO_GO',
              ].includes(d.type);
              const isApproved =
                (d.status as string) === 'APPROVED' || (d.status as string) === 'approved';
              const isRejected =
                (d.status as string) === 'REJECTED' || (d.status as string) === 'rejected';
              const isPending = !isApproved && !isRejected;
              const isOverdue = d.dueDate && isPending && new Date(d.dueDate) < new Date();

              const GATE_TYPE_LABELS: Record<string, { en: string; pl: string }> = {
                GOVERNANCE_DECISION_MAKING: { en: 'Go/No-Go', pl: 'Go/No-Go' },
                RESOURCE_RESPONSIBILITY: { en: 'Resources Commit', pl: 'Zobowiązanie zasobów' },
                SCHEDULE_MILESTONES: { en: 'Schedule Lock', pl: 'Blokada harmonogramu' },
                BUDGET_APPROVAL: { en: 'Budget Approval', pl: 'Zatwierdzenie budżetu' },
                OTHER: { en: 'Decision', pl: 'Decyzja' },
              };

              return (
                <div
                  key={d.id}
                  className={`p-3 rounded-lg border transition-all cursor-pointer group ${
                    isGate && isPending
                      ? 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-200/50 dark:border-amber-500/20'
                      : isApproved
                        ? 'bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-200/50 dark:border-emerald-500/20'
                        : isRejected
                          ? 'bg-red-50/30 dark:bg-red-500/5 border-red-200/50 dark:border-red-500/20'
                          : 'bg-slate-50/50 dark:bg-navy-800/50 border-slate-200/50 dark:border-navy-700/50 hover:border-amber-500/30'
                  }`}
                  onClick={() => onOpenDecision?.(d.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          isApproved
                            ? 'bg-emerald-500'
                            : isRejected
                              ? 'bg-red-500'
                              : isPending
                                ? 'bg-amber-500 animate-pulse'
                                : 'bg-slate-400'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                            {d.title}
                          </p>
                          {isGate && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-semibold flex-shrink-0">
                              GATE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {isPolish
                            ? GATE_TYPE_LABELS[d.type]?.pl || d.type
                            : GATE_TYPE_LABELS[d.type]?.en || d.type}
                          {(d as any).deciderName && ` · ${(d as any).deciderName}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {isOverdue && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">
                          {isPolish ? 'PRZETERMIN.' : 'OVERDUE'}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                          isApproved
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isRejected
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </CollapsibleSection>
  );
};
