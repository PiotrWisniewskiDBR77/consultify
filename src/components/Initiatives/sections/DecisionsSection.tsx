/**
 * DecisionsSection
 *
 * Task-like table for decisions linked to the initiative.
 * Follows the same ergonomics as TasksMilestonesSection:
 *   title | type | status | owner | due | priority | row actions
 *
 * @see docs/ui-standards/02-components/initiative-sections.md §Decisions card
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  ExternalLink,
  MoreVertical,
  Plus,
  Scale,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

import { useInitiativeContext } from './InitiativeContext';
import type { Decision, InitiativeSectionProps } from './types';

// ==========================================
// STATUS CONFIG (aligned with decision-panel.md)
// ==========================================

const DECISION_STATUS_CONFIG: Record<
  string,
  { label: { en: string; pl: string }; dotColor: string; bgColor: string; textColor: string }
> = {
  PENDING: {
    label: { en: 'Pending', pl: 'Oczekująca' },
    dotColor: 'bg-amber-500 animate-pulse',
    bgColor: 'bg-amber-100 dark:bg-amber-500/20',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  APPROVED: {
    label: { en: 'Approved', pl: 'Zatwierdzona' },
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-100 dark:bg-emerald-500/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
  REJECTED: {
    label: { en: 'Rejected', pl: 'Odrzucona' },
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-100 dark:bg-red-500/20',
    textColor: 'text-red-600 dark:text-red-400',
  },
  ESCALATED: {
    label: { en: 'Escalated', pl: 'Eskalowana' },
    dotColor: 'bg-orange-500',
    bgColor: 'bg-orange-100 dark:bg-orange-500/20',
    textColor: 'text-orange-600 dark:text-orange-400',
  },
  DEFERRED: {
    label: { en: 'Deferred', pl: 'Odroczona' },
    dotColor: 'bg-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-500/20',
    textColor: 'text-slate-600 dark:text-slate-400',
  },
};

// ==========================================
// TYPE CONFIG (decision categories)
// ==========================================

const DECISION_TYPE_LABELS: Record<string, { en: string; pl: string }> = {
  GOVERNANCE_DECISION_MAKING: { en: 'Go/No-Go', pl: 'Go/No-Go' },
  GO_NO_GO: { en: 'Go/No-Go', pl: 'Go/No-Go' },
  RESOURCE_RESPONSIBILITY: { en: 'Resources Commit', pl: 'Zobowiązanie zasobów' },
  SCHEDULE_MILESTONES: { en: 'Schedule Lock', pl: 'Blokada harmonogramu' },
  BUDGET_APPROVAL: { en: 'Budget Approval', pl: 'Zatwierdzenie budżetu' },
  SCOPE_CHANGE: { en: 'Scope Change', pl: 'Zmiana zakresu' },
  RISK_ACCEPTANCE: { en: 'Risk Acceptance', pl: 'Akceptacja ryzyka' },
  RESOURCE_ALLOCATION: { en: 'Resource Allocation', pl: 'Alokacja zasobów' },
  STRATEGIC: { en: 'Strategic', pl: 'Strategiczna' },
  EXECUTION: { en: 'Execution', pl: 'Wykonawcza' },
  GENERAL: { en: 'General', pl: 'Ogólna' },
  OTHER: { en: 'Other', pl: 'Inna' },
};

// ==========================================
// PRIORITY CONFIG
// ==========================================

const PRIORITY_CONFIG: Record<string, { label: { en: string; pl: string }; color: string }> = {
  LOW: { label: { en: 'Low', pl: 'Niski' }, color: 'text-slate-500' },
  MEDIUM: { label: { en: 'Medium', pl: 'Średni' }, color: 'text-blue-500' },
  HIGH: { label: { en: 'High', pl: 'Wysoki' }, color: 'text-orange-500' },
  CRITICAL: { label: { en: 'Critical', pl: 'Krytyczny' }, color: 'text-red-600 font-bold' },
};

// ==========================================
// SOURCE CONFIG (Manual / AI)
// ==========================================

const SOURCE_CONFIG: Record<
  string,
  { label: { en: string; pl: string }; icon: typeof User; color: string }
> = {
  manual: {
    label: { en: 'Manual', pl: 'Ręczny' },
    icon: User,
    color: 'text-slate-500 dark:text-slate-400',
  },
  ai: {
    label: { en: 'AI', pl: 'AI' },
    icon: Sparkles,
    color: 'text-violet-500 dark:text-violet-400',
  },
};

// ==========================================
// HELPERS
// ==========================================

function normalizeStatus(s: string): string {
  const upper = s.toUpperCase();
  if (upper === 'PENDING' || upper === 'OPEN') return 'PENDING';
  if (upper === 'APPROVED') return 'APPROVED';
  if (upper === 'REJECTED') return 'REJECTED';
  if (upper === 'ESCALATED') return 'ESCALATED';
  if (upper === 'DEFERRED') return 'DEFERRED';
  return upper;
}

const formatDueDate = (value?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
};

// ==========================================
// GATE TYPE DETECTION
// ==========================================

const GATE_TYPES = new Set([
  'GOVERNANCE_DECISION_MAKING',
  'RESOURCE_RESPONSIBILITY',
  'SCHEDULE_MILESTONES',
  'GO_NO_GO',
]);

// ==========================================
// MAIN SECTION COMPONENT
// ==========================================

export const DecisionsSection: React.FC<InitiativeSectionProps> = ({ readonly }) => {
  const {
    decisions,
    setDecisions,
    isPolish,
    onOpenDecision,
    handleRemoveDecision,
    initiative,
    showCreateDecision,
    setShowCreateDecision,
    newDecisionTitle,
    setNewDecisionTitle,
  } = useInitiativeContext();

  const [menuDecisionId, setMenuDecisionId] = useState<string | null>(null);
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const quickInputRef = useRef<HTMLInputElement | null>(null);
  const addTriggered = useRef(false);
  const initiativeId = initiative?.id;
  const projectId =
    initiative?.projectId || initiative?.project_id || initiative?.project?.id || null;

  // Sort: pending/escalated first, then by due date
  const sortedDecisions = useMemo(() => {
    return [...decisions].sort((a, b) => {
      // Gate decisions on top
      const aIsGate = GATE_TYPES.has(a.type);
      const bIsGate = GATE_TYPES.has(b.type);
      if (aIsGate && !bIsGate) return -1;
      if (!aIsGate && bIsGate) return 1;
      // Pending first
      const aIsPending = !['APPROVED', 'REJECTED'].includes(normalizeStatus(a.status));
      const bIsPending = !['APPROVED', 'REJECTED'].includes(normalizeStatus(b.status));
      if (aIsPending && !bIsPending) return -1;
      if (!aIsPending && bIsPending) return 1;
      // Then by due date
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
  }, [decisions]);

  const approvedCount = useMemo(
    () => decisions.filter((d) => normalizeStatus(d.status) === 'APPROVED').length,
    [decisions]
  );

  const closeMenu = useCallback(() => setMenuDecisionId(null), []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuDecisionId) return;
    const onDocClick = () => setMenuDecisionId(null);
    const t = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDocClick);
    };
  }, [menuDecisionId]);

  // Auto-focus inline input
  useEffect(() => {
    if (isAddingInline) {
      setTimeout(() => quickInputRef.current?.focus(), 20);
    }
  }, [isAddingInline]);

  // Handle external "New" trigger from toolbar
  useEffect(() => {
    if (showCreateDecision && !addTriggered.current) {
      addTriggered.current = true;
      handleStartInlineAdd();
      setShowCreateDecision(false);
      setTimeout(() => {
        addTriggered.current = false;
      }, 300);
    }
  }, [showCreateDecision]);

  const handleStartInlineAdd = useCallback(() => {
    if (readonly) return;
    setIsAddingInline(true);
    setInlineTitle('');
  }, [readonly]);

  const handleCreateInlineDecision = useCallback(async () => {
    if (isCreating || !inlineTitle.trim()) return;
    setIsCreating(true);
    try {
      const res = await Api.post('/decisions', {
        title: inlineTitle.trim(),
        type: 'GENERAL',
        relatedObjectId: initiativeId,
        relatedObjectType: 'initiative',
        status: 'PENDING',
      });
      const newDecision: Decision = {
        id: res.id,
        title: res.title || inlineTitle.trim(),
        type: res.decisionType || res.type || 'GENERAL',
        status: res.status || 'PENDING',
        priority: res.priority || undefined,
        ownerName: res.ownerName || undefined,
        dueDate: res.dueDate || undefined,
        createdAt: res.createdAt || new Date().toISOString(),
        isOverdue: false,
        source: 'manual',
      };
      setDecisions((prev) => [...prev, newDecision]);
      setIsAddingInline(false);
      setInlineTitle('');
      if (newDecision.id && onOpenDecision) onOpenDecision(newDecision.id);
    } catch {
      toast.error(isPolish ? 'Nie udało się utworzyć decyzji' : 'Failed to create decision');
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, inlineTitle, initiativeId, setDecisions, isPolish, onOpenDecision]);

  const handleRemove = useCallback(
    async (id: string) => {
      if (handleRemoveDecision) {
        await handleRemoveDecision(id);
      }
    },
    [handleRemoveDecision]
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {isPolish ? 'Decyzje' : 'Decisions'}
          </h2>
          {decisions.length > 0 && (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
              {decisions.length}
            </span>
          )}
        </div>
        {!readonly && decisions.length > 0 && (
          <button
            onClick={handleStartInlineAdd}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Plus size={12} />
            {isPolish ? 'Dodaj decyzję' : 'Add decision'}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border border-slate-200 dark:border-navy-700/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-200 dark:border-navy-700/40">
              <th className="text-left py-2.5 pl-3 pr-2">{isPolish ? 'Decyzja' : 'Decision'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Typ' : 'Type'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Status' : 'Status'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Decydent' : 'Owner'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Termin' : 'Due'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Priorytet' : 'Priority'}</th>
              <th className="text-right py-2.5 pr-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
            <AnimatePresence mode="popLayout">
              {sortedDecisions.map((decision) => {
                const status = normalizeStatus(decision.status);
                const statusConfig =
                  DECISION_STATUS_CONFIG[status] || DECISION_STATUS_CONFIG.PENDING;
                const isGate = GATE_TYPES.has(decision.type);
                const typeLabel = DECISION_TYPE_LABELS[decision.type];
                const priorityKey = (decision.priority || '').toUpperCase();
                const priorityCfg = PRIORITY_CONFIG[priorityKey];
                const source = decision.source || 'manual';
                const sourceCfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.manual;

                return (
                  <motion.tr
                    key={decision.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group hover:bg-slate-50/50 dark:hover:bg-navy-800/20 transition-colors"
                  >
                    {/* Decision title */}
                    <td className="py-2.5 pl-3 pr-2">
                      <button
                        onClick={() => onOpenDecision?.(decision.id)}
                        className="text-left text-slate-700 dark:text-slate-200 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center gap-2"
                      >
                        <span className="truncate max-w-[220px]">
                          {decision.title || (isPolish ? 'Bez nazwy' : 'Untitled')}
                        </span>
                        {isGate && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-semibold flex-shrink-0">
                            GATE
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Type */}
                    <td className="py-2.5 pr-2 text-xs text-slate-500 dark:text-slate-400">
                      {isPolish ? typeLabel?.pl || decision.type : typeLabel?.en || decision.type}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 pr-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${statusConfig.bgColor} ${statusConfig.textColor}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                        {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                      </span>
                    </td>

                    {/* Owner */}
                    <td className="py-2.5 pr-2 text-xs text-slate-600 dark:text-slate-300">
                      {decision.ownerName || '—'}
                    </td>

                    {/* Due date */}
                    <td className="py-2.5 pr-2 text-xs text-slate-500 dark:text-slate-400">
                      {decision.dueDate ? (
                        <span
                          className={`inline-flex items-center gap-1 ${decision.isOverdue ? 'text-red-500 font-medium' : ''}`}
                        >
                          <Calendar size={11} />
                          {formatDueDate(decision.dueDate)}
                          {decision.isOverdue && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-medium ml-1">
                              {isPolish ? 'PRZETERMIN.' : 'OVERDUE'}
                            </span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-2.5 pr-2 text-xs">
                      <span className={priorityCfg?.color || 'text-slate-500'}>
                        {isPolish
                          ? priorityCfg?.label.pl || decision.priority || '—'
                          : priorityCfg?.label.en || decision.priority || '—'}
                      </span>
                    </td>

                    {/* Row actions */}
                    <td className="py-2.5 pr-3 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuDecisionId((prev) => (prev === decision.id ? null : decision.id));
                        }}
                        className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/10 transition-colors"
                        title={isPolish ? 'Akcje' : 'Actions'}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {menuDecisionId === decision.id && (
                        <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-black/30">
                          <button
                            onClick={() => {
                              closeMenu();
                              onOpenDecision?.(decision.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                          >
                            <ExternalLink size={13} />
                            {isPolish ? 'Otwórz kartę' : 'Open card'}
                          </button>
                          {!readonly && (
                            <>
                              <div className="my-1 border-t border-slate-100 dark:border-navy-700/50" />
                              <button
                                onClick={() => {
                                  closeMenu();
                                  void handleRemove(decision.id);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={13} />
                                {isPolish ? 'Usuń' : 'Delete'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>

            {/* Inline add row */}
            {!readonly && isAddingInline && (
              <tr className="bg-amber-50/30 dark:bg-amber-500/5">
                <td className="py-2.5 pl-3 pr-2" colSpan={6}>
                  <input
                    ref={quickInputRef}
                    type="text"
                    value={inlineTitle}
                    onChange={(e) => setInlineTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleCreateInlineDecision();
                      }
                      if (e.key === 'Escape') {
                        setIsAddingInline(false);
                        setInlineTitle('');
                      }
                    }}
                    placeholder={
                      isPolish
                        ? 'Wpisz tytuł decyzji i Enter...'
                        : 'Type decision title and press Enter...'
                    }
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-amber-300 dark:border-amber-500/40 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </td>
                <td className="py-2.5 pr-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setIsAddingInline(false);
                        setInlineTitle('');
                      }}
                      className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {isPolish ? 'Anuluj' : 'Cancel'}
                    </button>
                    <button
                      onClick={() => void handleCreateInlineDecision()}
                      disabled={isCreating || !inlineTitle.trim()}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      {isCreating
                        ? isPolish
                          ? 'Tworzenie...'
                          : 'Creating...'
                        : isPolish
                          ? 'Utwórz'
                          : 'Create'}
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty state */}
            {sortedDecisions.length === 0 && !isAddingInline && (
              <tr>
                <td
                  colSpan={7}
                  className="py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  <Scale size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p>{isPolish ? 'Brak decyzji' : 'No decisions yet'}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isPolish
                      ? 'Dodaj decyzje bramkowe lub operacyjne'
                      : 'Add gate or operational decisions'}
                  </p>
                  {!readonly && (
                    <button
                      onClick={handleStartInlineAdd}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      <Plus size={12} />
                      {isPolish ? 'Dodaj decyzję' : 'Add decision'}
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      {decisions.length > 0 && (
        <div className="pt-2 border-t border-slate-200/70 dark:border-navy-700/50 text-xs text-slate-500 dark:text-slate-400">
          {approvedCount}/{decisions.length} {isPolish ? 'zatwierdzonych' : 'approved'}
        </div>
      )}
    </motion.div>
  );
};
