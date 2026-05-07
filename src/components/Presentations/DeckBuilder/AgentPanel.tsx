import {
  Check,
  ChevronDown,
  ChevronRight,
  FileDiff,
  History as HistoryIcon,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  bulkRevertPresentationAgentOperations,
  fetchPresentationAgentHistory,
  revertPresentationAgentOperation,
  type AgentHistoryFetchStatus,
  type PresentationAgentHistoryEntry,
  type PresentationAgentHistoryRevertResult,
  type PresentationBulkRevertResult,
} from '@/services/presentationAgentHistory';

const ACTION_CHIP_STYLE = {
  added: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  removed: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300',
  modified: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
  unchanged: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300',
} as const;

const SlideDiffRow: React.FC<{ slide: ProposalSlideDiff; onOpen?: (slide: ProposalSlideDiff) => void }> = ({ slide, onOpen }) => {
  const layoutChanged =
    !!slide.layoutAfter && slide.layoutAfter !== slide.layoutBefore;
  const addedBullets = slide.bulletsAdded || [];
  const removedBullets = slide.bulletsRemoved || [];
  const visibleAdded = addedBullets.slice(0, 4);
  const visibleRemoved = removedBullets.slice(0, 4);

  const interactive = typeof onOpen === 'function';
  const handleActivate = () => {
    if (onOpen) onOpen(slide);
  };
  return (
    <li
      role="listitem"
      className={`rounded-md border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/40 px-2 py-1.5 ${
        interactive
          ? 'cursor-pointer hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-500/5 focus-within:ring-2 focus-within:ring-primary-400'
          : ''
      }`}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? handleActivate : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleActivate();
              }
            }
          : undefined
      }
      aria-label={
        interactive
          ? `Open before/after detail for slide ${slide.index + 1}`
          : undefined
      }
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="inline-flex items-center justify-center min-w-[28px] h-[18px] rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
          #{slide.index + 1}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${ACTION_CHIP_STYLE[slide.action]}`}
        >
          {slide.action}
        </span>
        {layoutChanged && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
            {slide.layoutBefore || '—'} → {slide.layoutAfter}
          </span>
        )}
      </div>
      <div className="text-[11px] text-slate-700 dark:text-slate-200">
        {slide.action === 'added' && (
          <span className="text-emerald-700 dark:text-emerald-300">
            + {slide.titleAfter || '(untitled)'}
          </span>
        )}
        {slide.action === 'removed' && (
          <span className="text-rose-700 dark:text-rose-300 line-through">
            {slide.titleBefore || '(untitled)'}
          </span>
        )}
        {slide.action === 'modified' && (
          <span>
            {slide.titleBefore && slide.titleAfter && slide.titleBefore !== slide.titleAfter ? (
              <>
                <span className="text-slate-500 dark:text-slate-400 line-through">
                  {slide.titleBefore}
                </span>{' '}
                <span className="text-slate-400">→</span>{' '}
                <span className="text-amber-700 dark:text-amber-300">{slide.titleAfter}</span>
              </>
            ) : (
              slide.titleAfter || slide.titleBefore || '(untitled)'
            )}
          </span>
        )}
      </div>
      {(visibleAdded.length > 0 || visibleRemoved.length > 0) && (
        <div className="mt-1 grid grid-cols-1 gap-0.5">
          {visibleAdded.map((b, idx) => (
            <div
              key={`a-${idx}`}
              className="text-[10px] text-emerald-700 dark:text-emerald-300 truncate"
              title={b}
            >
              + {b}
            </div>
          ))}
          {addedBullets.length > visibleAdded.length && (
            <div className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70 italic">
              +{addedBullets.length - visibleAdded.length} more
            </div>
          )}
          {visibleRemoved.map((b, idx) => (
            <div
              key={`r-${idx}`}
              className="text-[10px] text-rose-700 dark:text-rose-300 line-through truncate"
              title={b}
            >
              − {b}
            </div>
          ))}
          {removedBullets.length > visibleRemoved.length && (
            <div className="text-[10px] text-rose-700/70 dark:text-rose-300/70 italic">
              −{removedBullets.length - visibleRemoved.length} more
            </div>
          )}
        </div>
      )}
    </li>
  );
};

const SlideDiffDetailModal: React.FC<{
  slide: ProposalSlideDiff;
  onClose: () => void;
}> = ({ slide, onClose }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const before = {
    title: slide.titleBefore ?? null,
    layout: slide.layoutBefore ?? null,
    bullets: slide.bulletsRemoved || [],
  };
  const after = {
    title: slide.titleAfter ?? null,
    layout: slide.layoutAfter ?? null,
    bullets: slide.bulletsAdded || [],
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slide-diff-detail-title"
    >
      <div className="max-w-2xl w-full mx-4 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-navy-800">
          <div className="flex items-center gap-2">
            <FileDiff size={16} className="text-amber-500" />
            <h2
              id="slide-diff-detail-title"
              className="text-sm font-semibold text-slate-700 dark:text-white"
            >
              Slide #{slide.index + 1} ·{' '}
              <span className={`uppercase text-[11px] ${ACTION_CHIP_STYLE[slide.action]} px-1.5 py-0.5 rounded-full`}>
                {slide.action}
              </span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          <SlideDiffSide label="Before" tone="rose" snapshot={before} emptyMessage={slide.action === 'added' ? '(new slide)' : '(no content)'} />
          <SlideDiffSide label="After" tone="emerald" snapshot={after} emptyMessage={slide.action === 'removed' ? '(removed slide)' : '(no content)'} />
        </div>
      </div>
    </div>
  );
};

const SlideDiffSide: React.FC<{
  label: string;
  tone: 'rose' | 'emerald';
  snapshot: { title: string | null; layout: string | null; bullets: string[] };
  emptyMessage: string;
}> = ({ label, tone, snapshot, emptyMessage }) => {
  const headerStyle =
    tone === 'rose'
      ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
      : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300';
  const isEmpty = !snapshot.title && !snapshot.layout && snapshot.bullets.length === 0;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/40 overflow-hidden">
      <div className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${headerStyle}`}>
        {label}
      </div>
      <div className="px-3 py-2 space-y-2">
        {isEmpty ? (
          <div className="text-[12px] italic text-slate-500 dark:text-slate-400">{emptyMessage}</div>
        ) : (
          <>
            {snapshot.title !== null && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Title</div>
                <div className="text-sm text-slate-800 dark:text-slate-100">{snapshot.title || '(untitled)'}</div>
              </div>
            )}
            {snapshot.layout !== null && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Layout</div>
                <div className="text-sm text-slate-800 dark:text-slate-100">{snapshot.layout}</div>
              </div>
            )}
            {snapshot.bullets.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Bullets</div>
                <ul className="list-disc list-inside text-[12px] text-slate-700 dark:text-slate-200 space-y-0.5">
                  {snapshot.bullets.map((b, idx) => (
                    <li key={`${label}-${idx}`}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

import { useConversationStore } from '@/store/useConversationStore';

interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
}

interface ProposalSlideDiff {
  index: number;
  action: 'added' | 'removed' | 'modified' | 'unchanged';
  titleBefore?: string | null;
  titleAfter?: string | null;
  bulletsAdded?: string[];
  bulletsRemoved?: string[];
  layoutBefore?: string | null;
  layoutAfter?: string | null;
}

interface ProposalDiff {
  cardsBefore?: number;
  cardsAfter?: number;
  cardsAdded?: number;
  cardsRemoved?: number;
  changedCards?: number;
  slides?: ProposalSlideDiff[];
  editPlan?: unknown;
  [key: string]: unknown;
}

interface PendingProposal {
  operationId: string;
  plan?: {
    scope?: string;
    mutationKinds?: string[];
    targetSlides?: Array<string | number>;
    sectionHint?: string;
    [key: string]: unknown;
  };
  diff?: ProposalDiff;
  reply?: string;
  appliedActions?: string[];
}

interface AgentPanelProps {
  onClose: () => void;
  sourceNames?: string[];
  onSendMessage?: (
    message: string
  ) => Promise<{ reply?: string; [key: string]: unknown } | string | void>;
  conversationId?: string | null;
  deckId?: string;
  onProposalAccepted?: (payload: { operationId: string; deck?: any; version?: number }) => void;
  onProposalRejected?: (payload: { operationId: string }) => void;
}

const SUGGESTION_KEYS = [
  'presentations.agent.suggestions.addSummary',
  'presentations.agent.suggestions.makeConcise',
  'presentations.agent.suggestions.addNotes',
  'presentations.agent.suggestions.updateData',
  'presentations.agent.suggestions.improveVisuals',
];

export const AgentPanel: React.FC<AgentPanelProps> = ({
  onClose,
  sourceNames,
  onSendMessage,
  conversationId,
  deckId,
  onProposalAccepted,
  onProposalRejected,
}) => {
  const { t } = useTranslation();
  const { activeMessages, addMessage } = useConversationStore();
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'greeting',
      role: 'agent',
      text: t('presentations.agent.greeting', {
        sources: sourceNames?.join(', ') || 'your sources',
        defaultValue: `Hi! I know this deck was built from ${sourceNames?.join(', ') || 'your sources'}. How can I help?`,
      }),
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [pendingProposal, setPendingProposal] = useState<PendingProposal | null>(null);
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [activeSlideDiff, setActiveSlideDiff] = useState<ProposalSlideDiff | null>(null);

  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  const [historyCacheKey, setHistoryCacheKey] = useState(0);
  const [historyEntries, setHistoryEntries] = useState<PresentationAgentHistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyStatus, setHistoryStatus] = useState<AgentHistoryFetchStatus | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyWarnings, setHistoryWarnings] = useState<string[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [loadedHistoryKey, setLoadedHistoryKey] = useState<{
    deckId: string;
    key: number;
  } | null>(null);
  type RevertBanner =
    | {
        kind: 'success';
        versionBefore: number;
        versionAfter: number;
        diffSummary: PresentationAgentHistoryRevertResult['data'] extends infer D
          ? D extends { diffSummary: infer S }
            ? S
            : never
          : never;
      }
    | { kind: 'conflict'; reason?: string; message: string }
    | { kind: 'forbidden'; message: string }
    | { kind: 'error'; message: string };
  const [revertConfirmId, setRevertConfirmId] = useState<string | null>(null);
  const [revertChecked, setRevertChecked] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [revertBanners, setRevertBanners] = useState<Record<string, RevertBanner>>({});

  type BulkRevertBanner =
    | {
        kind: 'success';
        count: number;
        versionBefore: number;
        versionAfter: number;
        diffSummary: NonNullable<PresentationBulkRevertResult['data']>['diffSummary'];
      }
    | { kind: 'conflict'; message: string }
    | { kind: 'forbidden'; message: string }
    | { kind: 'error'; message: string };
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkChecked, setBulkChecked] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkBanner, setBulkBanner] = useState<BulkRevertBanner | null>(null);

  useEffect(() => {
    setShowEditPlan(false);
    setActiveSlideDiff(null);
  }, [pendingProposal?.operationId]);

  const slideEntries = useMemo(() => {
    const list = Array.isArray(pendingProposal?.diff?.slides)
      ? (pendingProposal!.diff!.slides as ProposalSlideDiff[])
      : [];
    return list;
  }, [pendingProposal]);

  const slideStats = useMemo(() => {
    const stats = { changed: 0, added: 0, removed: 0, hasAny: false };
    for (const s of slideEntries) {
      if (s.action === 'modified') stats.changed += 1;
      else if (s.action === 'added') stats.added += 1;
      else if (s.action === 'removed') stats.removed += 1;
      if (s.action !== 'unchanged') stats.hasAny = true;
    }
    return stats;
  }, [slideEntries]);

  const loadHistory = useCallback(
    async (mode: 'reset' | 'append', currentOffset: number) => {
      if (!deckId) return;
      setHistoryLoading(true);
      try {
        const result = await fetchPresentationAgentHistory(deckId, {
          limit: 50,
          offset: currentOffset,
        });
        setHistoryStatus(result.status);
        if (result.status === 'ok') {
          const fresh = result.entries || [];
          setHistoryWarnings(result.warnings || []);
          setHistoryError(null);
          if (mode === 'reset') {
            setHistoryEntries(fresh);
            setHistoryTotal(result.total ?? fresh.length);
          } else {
            setHistoryEntries((prev) => {
              const seen = new Set(prev.map((e) => e.id));
              const merged = [...prev];
              for (const entry of fresh) {
                if (!seen.has(entry.id)) merged.push(entry);
              }
              return merged;
            });
            setHistoryTotal((prevTotal) =>
              typeof result.total === 'number' ? result.total : prevTotal
            );
          }
        } else {
          setHistoryError(result.error || null);
          if (mode === 'reset') {
            setHistoryEntries([]);
            setHistoryTotal(0);
            setHistoryWarnings([]);
          }
        }
      } finally {
        setHistoryLoading(false);
      }
    },
    [deckId]
  );

  useEffect(() => {
    setHistoryEntries([]);
    setHistoryTotal(0);
    setHistoryStatus(null);
    setHistoryError(null);
    setHistoryWarnings([]);
    setExpandedHistoryId(null);
    setLoadedHistoryKey(null);
    setRevertConfirmId(null);
    setRevertChecked(false);
    setRevertingId(null);
    setRevertBanners({});
    setSelectedHistoryIds(new Set());
    setBulkConfirmOpen(false);
    setBulkChecked(false);
    setBulkBusy(false);
    setBulkBanner(null);
  }, [deckId]);

  useEffect(() => {
    setSelectedHistoryIds(new Set());
    setBulkConfirmOpen(false);
    setBulkChecked(false);
  }, [activeTab, historyCacheKey]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    if (!deckId) return;
    const needsLoad =
      !loadedHistoryKey ||
      loadedHistoryKey.deckId !== deckId ||
      loadedHistoryKey.key !== historyCacheKey;
    if (!needsLoad) return;
    setExpandedHistoryId(null);
    setLoadedHistoryKey({ deckId, key: historyCacheKey });
    void loadHistory('reset', 0);
  }, [activeTab, deckId, historyCacheKey, loadedHistoryKey, loadHistory]);

  const handleHistoryRefresh = useCallback(() => {
    setHistoryCacheKey((k) => k + 1);
  }, []);

  const handleHistoryLoadMore = useCallback(() => {
    if (historyLoading) return;
    if (historyEntries.length >= historyTotal) return;
    void loadHistory('append', historyEntries.length);
  }, [historyLoading, historyEntries.length, historyTotal, loadHistory]);

  const handleRevertEntry = useCallback(
    async (operationId: string) => {
      if (!deckId || !operationId) return;
      setRevertingId(operationId);
      try {
        const result = await revertPresentationAgentOperation(deckId, operationId);
        if (result.status === 'ok' && result.data) {
          setRevertBanners((prev) => ({
            ...prev,
            [operationId]: {
              kind: 'success',
              versionBefore: result.data!.versionBefore,
              versionAfter: result.data!.versionAfter,
              diffSummary: result.data!.diffSummary,
            },
          }));
          setRevertConfirmId(null);
          setRevertChecked(false);
          setHistoryCacheKey((k) => k + 1);
          onProposalAccepted?.({
            operationId: result.data.revertOperationId,
            version: result.data.versionAfter,
          });
          return;
        }
        if (result.status === 'conflict') {
          const reason = result.reason || '';
          const message =
            reason === 'newer_operation_exists'
              ? t(
                  'presentations.agent.history.revert.conflictNewer',
                  'Cannot revert: newer applied edits exist. Revert from the most recent operation first.'
                )
              : reason === 'no_snapshot'
                ? t(
                    'presentations.agent.history.revert.conflictNoSnapshot',
                    'Cannot revert: pre-edit snapshot is missing for this operation.'
                  )
                : reason === 'operation_not_applied'
                  ? t(
                      'presentations.agent.history.revert.conflictNotApplied',
                      'Only applied or accepted proposals can be reverted.'
                    )
                  : result.error ||
                    t('presentations.agent.history.revert.blocked', 'Revert blocked.');
          setRevertBanners((prev) => ({
            ...prev,
            [operationId]: { kind: 'conflict', reason, message },
          }));
          return;
        }
        if (result.status === 'forbidden') {
          setRevertBanners((prev) => ({
            ...prev,
            [operationId]: {
              kind: 'forbidden',
              message: t(
                'presentations.agent.history.revert.forbidden',
                "You don't have permission to revert this deck."
              ),
            },
          }));
          return;
        }
        setRevertBanners((prev) => ({
          ...prev,
          [operationId]: {
            kind: 'error',
            message: t(
              'presentations.agent.history.revert.failed',
              'Could not revert this proposal. Please retry.'
            ),
          },
        }));
      } finally {
        setRevertingId((current) => (current === operationId ? null : current));
      }
    },
    [deckId, onProposalAccepted, t]
  );

  const toggleHistorySelection = useCallback((entryId: string) => {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }, []);

  const clearHistorySelection = useCallback(() => {
    setSelectedHistoryIds(new Set());
    setBulkConfirmOpen(false);
    setBulkChecked(false);
  }, []);

  const selectableEntries = useMemo(
    () =>
      historyEntries.filter(
        (entry) => entry.status === 'applied' || entry.status === 'accepted'
      ),
    [historyEntries]
  );

  const selectedEntries = useMemo(
    () => selectableEntries.filter((entry) => selectedHistoryIds.has(entry.id)),
    [selectableEntries, selectedHistoryIds]
  );

  const clientBaseSnapshot = useMemo(() => {
    if (selectedEntries.length === 0) return null;
    const sorted = [...selectedEntries].sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : NaN;
      const tb = b.createdAt ? Date.parse(b.createdAt) : NaN;
      const aValid = Number.isFinite(ta);
      const bValid = Number.isFinite(tb);
      if (aValid && bValid && ta !== tb) return ta - tb;
      const sa = a.createdAt || '';
      const sb = b.createdAt || '';
      if (sa !== sb) return sa < sb ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return sorted[0];
  }, [selectedEntries]);

  const handleBulkRevert = useCallback(async () => {
    if (!deckId || selectedHistoryIds.size === 0) return;
    const ids = Array.from(selectedHistoryIds);
    setBulkBusy(true);
    try {
      const result = await bulkRevertPresentationAgentOperations(deckId, ids);
      if (result.status === 'ok' && result.data) {
        setBulkBanner({
          kind: 'success',
          count: result.data.count,
          versionBefore: result.data.versionBefore,
          versionAfter: result.data.versionAfter,
          diffSummary: result.data.diffSummary,
        });
        setBulkConfirmOpen(false);
        setBulkChecked(false);
        setSelectedHistoryIds(new Set());
        setHistoryCacheKey((k) => k + 1);
        onProposalAccepted?.({
          operationId: result.data.revertOperationId,
          version: result.data.versionAfter,
        });
        return;
      }
      if (result.status === 'conflict') {
        let message: string;
        if (result.missingIds && result.missingIds.length > 0) {
          message = t(
            'presentations.agent.history.bulkRevert.missingIds',
            'Cannot bulk-revert: selection skips operations {{ids}}. Include them or revert in two steps.',
            { ids: result.missingIds.join(', ') }
          );
        } else {
          const firstReason = (result.reasons || [])[0] || '';
          if (firstReason.startsWith('op_') && firstReason.endsWith('_not_applied')) {
            message = t(
              'presentations.agent.history.bulkRevert.notApplied',
              'Some selected operations are not applied/accepted.'
            );
          } else if (firstReason.startsWith('op_') && firstReason.endsWith('_no_snapshot')) {
            message = t(
              'presentations.agent.history.bulkRevert.noSnapshot',
              'The oldest selected proposal has no pre-edit snapshot.'
            );
          } else if (firstReason === 'newer_op_outside_selection') {
            message = t(
              'presentations.agent.history.bulkRevert.newerOutside',
              'Newer applied operations are not part of the selection.'
            );
          } else {
            message =
              result.error ||
              t('presentations.agent.history.bulkRevert.blocked', 'Bulk revert blocked.');
          }
        }
        setBulkBanner({ kind: 'conflict', message });
        return;
      }
      if (result.status === 'forbidden') {
        setBulkBanner({
          kind: 'forbidden',
          message: t(
            'presentations.agent.history.bulkRevert.forbidden',
            "You don't have permission to bulk-revert this deck."
          ),
        });
        return;
      }
      if (result.status === 'not_found') {
        setBulkBanner({
          kind: 'error',
          message: t(
            'presentations.agent.history.bulkRevert.notFound',
            'Deck or operations not found.'
          ),
        });
        return;
      }
      setBulkBanner({
        kind: 'error',
        message: t(
          'presentations.agent.history.bulkRevert.failed',
          'Could not bulk-revert these proposals. Please retry.'
        ),
      });
    } finally {
      setBulkBusy(false);
    }
  }, [deckId, selectedHistoryIds, onProposalAccepted, t]);

  useEffect(() => {
    if (!conversationId || !activeMessages?.length) return;
    const kimiMessages: AgentMessage[] = activeMessages
      .filter((m) => m.role === 'user' || m.role === 'ai')
      .map((m) => ({
        id: m.id || `kimi-${Date.now()}-${Math.random()}`,
        role: m.role === 'user' ? ('user' as const) : ('agent' as const),
        text: typeof m.content === 'string' ? m.content : '',
        timestamp: (m as { timestamp?: string }).timestamp || new Date().toISOString(),
      }))
      .filter((m) => m.text);
    if (kimiMessages.length > 0) {
      setMessages((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newMsgs = kimiMessages.filter((m) => !existingIds.has(m.id));
        return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
      });
    }
  }, [conversationId, activeMessages]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const message = input.trim();
    const userMsg: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: message,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    if (conversationId) {
      addMessage?.({ conversationId, role: 'user', content: message, messageType: 'text' }).catch(
        () => {}
      );
    }

    try {
      const response = await onSendMessage?.(message);
      const isProposal =
        typeof response === 'object' &&
        response !== null &&
        'operationId' in response &&
        (response as { status?: unknown }).status === 'proposal';

      if (isProposal) {
        const payload = response as {
          operationId: string;
          plan?: PendingProposal['plan'];
          diff?: PendingProposal['diff'];
          reply?: string;
          appliedActions?: string[];
        };
        const appliedActions =
          payload.appliedActions ||
          (Array.isArray(payload.plan?.mutationKinds)
            ? (payload.plan?.mutationKinds as string[])
            : undefined);
        setPendingProposal({
          operationId: payload.operationId,
          plan: payload.plan,
          diff: payload.diff,
          reply: payload.reply,
          appliedActions,
        });
        setProposalError(null);
        if (payload.reply) {
          const agentMsg: AgentMessage = {
            id: `msg-${Date.now()}-agent`,
            role: 'agent',
            text: payload.reply,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, agentMsg]);
          if (conversationId) {
            addMessage?.({
              conversationId,
              role: 'ai',
              content: payload.reply,
              messageType: 'text',
            }).catch(() => {});
          }
        }
        return;
      }

      const reply =
        typeof response === 'string'
          ? response
          : response?.reply ||
            t(
              'presentations.agent.updated',
              'Deck updated. Review the applied changes on the canvas.'
            );
      const agentMsg: AgentMessage = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        text: reply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMsg]);

      if (conversationId) {
        addMessage?.({ conversationId, role: 'ai', content: reply, messageType: 'text' }).catch(
          () => {}
        );
      }
    } catch {
      const agentMsg: AgentMessage = {
        id: `msg-${Date.now()}-agent-error`,
        role: 'agent',
        text: t(
          'presentations.agent.failed',
          'I could not apply that edit to the deck. Please try a different instruction.'
        ),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    }
  }, [input, onSendMessage, t, conversationId, addMessage]);

  const handleSuggestion = (key: string) => {
    const text = t(key, '');
    if (text) {
      setInput(text);
    }
  };

  const pushAgentMessage = useCallback(
    (text: string) => {
      const agentMsg: AgentMessage = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMsg]);
      if (conversationId) {
        addMessage?.({
          conversationId,
          role: 'ai',
          content: text,
          messageType: 'text',
        }).catch(() => {});
      }
    },
    [conversationId, addMessage]
  );

  const handleAcceptProposal = useCallback(async () => {
    if (!pendingProposal || !deckId) return;
    setProposalBusy(true);
    setProposalError(null);
    try {
      const res = await fetch(
        `/api/presentations/decks/${encodeURIComponent(deckId)}/agent-edit/${encodeURIComponent(
          pendingProposal.operationId
        )}/accept`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }
      );
      if (!res.ok) {
        setProposalError(
          t(
            'presentations.agent.proposal.acceptFailed',
            'Could not accept the proposal. Please retry.'
          )
        );
        return;
      }
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: {
          deck?: unknown;
          operationId?: string;
          appliedActions?: string[];
          reply?: string;
          version?: number;
        };
      } | null;
      const data = json?.data;
      const applied =
        (data?.appliedActions && data.appliedActions.length > 0
          ? data.appliedActions
          : pendingProposal.appliedActions) || [];
      onProposalAccepted?.({
        operationId: pendingProposal.operationId,
        deck: data?.deck,
        version: data?.version,
      });
      pushAgentMessage(
        applied.length > 0
          ? `Applied: ${applied.join(', ')}`
          : data?.reply || t('presentations.agent.proposal.applied', 'Applied changes.')
      );
      setPendingProposal(null);
      setHistoryCacheKey((k) => k + 1);
    } catch {
      setProposalError(
        t(
          'presentations.agent.proposal.acceptFailed',
          'Could not accept the proposal. Please retry.'
        )
      );
    } finally {
      setProposalBusy(false);
    }
  }, [pendingProposal, deckId, onProposalAccepted, pushAgentMessage, t]);

  const handleRejectProposal = useCallback(async () => {
    if (!pendingProposal || !deckId) return;
    setProposalBusy(true);
    setProposalError(null);
    try {
      const res = await fetch(
        `/api/presentations/decks/${encodeURIComponent(deckId)}/agent-edit/${encodeURIComponent(
          pendingProposal.operationId
        )}/reject`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }
      );
      if (!res.ok) {
        setProposalError(
          t(
            'presentations.agent.proposal.rejectFailed',
            'Could not reject the proposal. Please retry.'
          )
        );
        return;
      }
      onProposalRejected?.({ operationId: pendingProposal.operationId });
      pushAgentMessage(t('presentations.agent.proposal.rejected', 'Proposal rejected.'));
      setPendingProposal(null);
      setHistoryCacheKey((k) => k + 1);
    } catch {
      setProposalError(
        t(
          'presentations.agent.proposal.rejectFailed',
          'Could not reject the proposal. Please retry.'
        )
      );
    } finally {
      setProposalBusy(false);
    }
  }, [pendingProposal, deckId, onProposalRejected, pushAgentMessage, t]);

  return (
    <div className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-navy-800">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-primary-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-white">
            {t('presentations.agent.title', 'AI Agent')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-navy-800">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          aria-pressed={activeTab === 'chat'}
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
            activeTab === 'chat'
              ? 'bg-primary-500/10 text-primary-600 dark:text-primary-300 border border-primary-200 dark:border-primary-500/30'
              : 'text-slate-500 dark:text-slate-400 border border-transparent hover:bg-slate-100 dark:hover:bg-navy-800'
          }`}
        >
          <MessageSquare size={11} />
          {t('presentations.agent.tabs.chat', 'Chat')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          aria-pressed={activeTab === 'history'}
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-primary-500/10 text-primary-600 dark:text-primary-300 border border-primary-200 dark:border-primary-500/30'
              : 'text-slate-500 dark:text-slate-400 border border-transparent hover:bg-slate-100 dark:hover:bg-navy-800'
          }`}
        >
          <HistoryIcon size={11} />
          {t('presentations.agent.tabs.history', 'History')}
        </button>
      </div>

      {activeTab === 'chat' && (
      <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTION_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => handleSuggestion(key)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors"
              >
                <Sparkles size={10} />
                {t(key, '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending Proposal */}
      {pendingProposal && deckId && (
        <div className="mx-3 mb-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5">
          <div className="flex items-center justify-between px-3 py-2 border-b border-amber-200/70 dark:border-amber-500/20">
            <div className="flex items-center gap-2">
              <FileDiff size={14} className="text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {t('presentations.agent.proposal.title', 'Proposed Edit')}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
              {t('presentations.agent.proposal.awaiting', 'Awaiting your approval')}
            </span>
          </div>
          <div className="px-3 py-2 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            {pendingProposal.plan?.scope && (
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-200">Scope:</span>{' '}
                {pendingProposal.plan.scope}
              </div>
            )}
            {Array.isArray(pendingProposal.plan?.mutationKinds) &&
              pendingProposal.plan!.mutationKinds!.length > 0 && (
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Mutation kinds:
                  </span>{' '}
                  {pendingProposal.plan!.mutationKinds!.join(', ')}
                </div>
              )}
            {Array.isArray(pendingProposal.plan?.targetSlides) &&
              pendingProposal.plan!.targetSlides!.length > 0 && (
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Target slides:
                  </span>{' '}
                  {pendingProposal.plan!.targetSlides!.map((s) => String(s)).join(', ')}
                </div>
              )}
            {pendingProposal.plan?.sectionHint && (
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Section hint:
                </span>{' '}
                {pendingProposal.plan.sectionHint}
              </div>
            )}
          </div>
          <div className="px-3 pb-2 space-y-2">
            {slideEntries.length > 0 ? (
              <>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {slideStats.changed} changed · {slideStats.added} added · {slideStats.removed} removed
                </div>
                {slideStats.hasAny ? (
                  <ul role="list" className="max-h-72 overflow-auto space-y-1.5">
                    {slideEntries
                      .filter((s) => s.action !== 'unchanged')
                      .map((slide) => (
                        <SlideDiffRow
                          key={`${slide.index}-${slide.action}`}
                          slide={slide}
                          onOpen={(s) => setActiveSlideDiff(s)}
                        />
                      ))}
                  </ul>
                ) : (
                  <div className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    {t(
                      'presentations.agent.proposal.noStructuralChanges',
                      'No structural changes — content adjustments only'
                    )}
                  </div>
                )}
                {pendingProposal.diff?.editPlan !== undefined && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowEditPlan((v) => !v)}
                      className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {showEditPlan ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      {t('presentations.agent.proposal.showEditPlan', 'Show edit plan')}
                    </button>
                    {showEditPlan && (
                      <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-slate-900/90 dark:bg-navy-950 text-[10px] leading-snug text-slate-100 px-2 py-1.5 whitespace-pre-wrap break-words">
                        {JSON.stringify(pendingProposal.diff.editPlan, null, 2).slice(0, 1000)}
                      </pre>
                    )}
                  </div>
                )}
              </>
            ) : pendingProposal.appliedActions && pendingProposal.appliedActions.length > 0 ? (
              <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                {pendingProposal.appliedActions.map((action, idx) => (
                  <li key={`${action}-${idx}`}>{action}</li>
                ))}
              </ul>
            ) : (
              <div className="text-[11px] italic text-slate-500 dark:text-slate-400">
                {t('presentations.agent.proposal.noDiff', 'No diff details available.')}
              </div>
            )}
          </div>
          {proposalError && (
            <div className="mx-3 mb-2 rounded-md border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-700 dark:text-rose-300">
              {proposalError}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 pb-3">
            <button
              type="button"
              onClick={handleAcceptProposal}
              disabled={proposalBusy}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check size={12} />
              {t('presentations.agent.proposal.accept', 'Accept')}
            </button>
            <button
              type="button"
              onClick={handleRejectProposal}
              disabled={proposalBusy}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 border border-slate-200 dark:border-navy-700 disabled:opacity-50"
            >
              <XCircle size={12} />
              {t('presentations.agent.proposal.reject', 'Reject')}
            </button>
            {proposalBusy && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('presentations.agent.proposal.working', 'Working...')}
              </span>
            )}
          </div>
        </div>
      )}
      </>
      )}

      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('presentations.agent.history.title', 'Proposal history')}
              {historyEntries.length > 0 && (
                <span className="ml-1 normal-case text-slate-400 dark:text-slate-500">
                  ({historyEntries.length}/{historyTotal})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {historyWarnings.includes('schema_missing_ai_operations') && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-700">
                  {t('presentations.agent.history.schemaMissing', 'Schema not available')}
                </span>
              )}
              <button
                type="button"
                onClick={handleHistoryRefresh}
                disabled={historyLoading || !deckId}
                aria-label={t('presentations.agent.history.refresh', 'Refresh history')}
                title={t('presentations.agent.history.refresh', 'Refresh history')}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-50"
              >
                <RefreshCw size={12} className={historyLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {historyStatus === 'forbidden' && (
            <div className="rounded-md border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-700 dark:text-rose-300">
              {t(
                'presentations.agent.history.forbidden',
                "You don't have permission to view this deck's proposal history."
              )}
            </div>
          )}

          {historyStatus &&
            historyStatus !== 'ok' &&
            historyStatus !== 'forbidden' && (
              <div className="rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300 flex items-center justify-between gap-2">
                <span>
                  {historyStatus === 'not_found'
                    ? t(
                        'presentations.agent.history.notFound',
                        'No proposal history available for this deck.'
                      )
                    : t(
                        'presentations.agent.history.loadFailed',
                        "Couldn't load proposal history."
                      )}
                </span>
                <button
                  type="button"
                  onClick={handleHistoryRefresh}
                  disabled={historyLoading}
                  className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30 text-[10px] font-medium disabled:opacity-50"
                >
                  {t('presentations.agent.history.retry', 'Retry')}
                </button>
              </div>
            )}

          {selectedHistoryIds.size > 0 && (
            <div className="sticky top-0 z-10 -mx-3 px-3 py-2 bg-white/95 dark:bg-navy-900/95 backdrop-blur border-b border-slate-200 dark:border-navy-700 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">
                    {t('presentations.agent.history.bulkRevert.selected', '{{count}} selected', {
                      count: selectedHistoryIds.size,
                    })}
                  </span>
                  {clientBaseSnapshot && (
                    <span className="ml-1 text-slate-500 dark:text-slate-400">
                      {t('presentations.agent.history.bulkRevert.oldest', '· oldest = {{ref}}', {
                        ref:
                          (clientBaseSnapshot.prompt &&
                            clientBaseSnapshot.prompt.length > 0 &&
                            clientBaseSnapshot.prompt.slice(0, 32)) ||
                          clientBaseSnapshot.id.slice(0, 8),
                      })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkConfirmOpen(true);
                      setBulkChecked(false);
                      setBulkBanner(null);
                    }}
                    disabled={bulkBusy || bulkConfirmOpen}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
                  >
                    <RotateCcw size={11} />
                    {t(
                      'presentations.agent.history.bulkRevert.button',
                      'Revert {{count}} operations',
                      { count: selectedHistoryIds.size }
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={clearHistorySelection}
                    disabled={bulkBusy}
                    className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 border border-slate-200 dark:border-navy-700 disabled:opacity-50"
                  >
                    {t('presentations.agent.history.bulkRevert.clear', 'Clear selection')}
                  </button>
                </div>
              </div>
              {bulkBanner?.kind === 'success' && (
                <div className="rounded-md border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                  <div className="font-medium">
                    {t(
                      'presentations.agent.history.bulkRevert.successTitle',
                      'Reverted {{count}} proposals to v{{before}} → v{{after}}',
                      {
                        count: bulkBanner.count,
                        before: bulkBanner.versionBefore,
                        after: bulkBanner.versionAfter,
                      }
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-700/80 dark:text-emerald-300/80">
                    +{bulkBanner.diffSummary.cardsAdded} -{bulkBanner.diffSummary.cardsRemoved} ~
                    {bulkBanner.diffSummary.changedCards}
                  </div>
                </div>
              )}
              {(bulkBanner?.kind === 'conflict' ||
                bulkBanner?.kind === 'forbidden' ||
                bulkBanner?.kind === 'error') && (
                <div className="rounded-md border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-700 dark:text-rose-300">
                  {bulkBanner.message}
                </div>
              )}
              {bulkConfirmOpen && (
                <div className="rounded-md border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/5 px-2 py-2 space-y-1.5">
                  <div className="text-[11px] text-slate-700 dark:text-slate-200">
                    {t(
                      'presentations.agent.history.bulkRevert.warning',
                      'This will revert the deck to the state before the OLDEST selected proposal. The {{count}} proposals will remain in history but be marked as reverted.',
                      { count: selectedHistoryIds.size }
                    )}
                  </div>
                  <label className="flex items-start gap-1.5 text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkChecked}
                      onChange={(e) => setBulkChecked(e.target.checked)}
                      className="mt-0.5"
                      disabled={bulkBusy}
                    />
                    <span>
                      {t(
                        'presentations.agent.history.bulkRevert.acknowledge',
                        'I understand this rewrites the deck.'
                      )}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBulkRevert}
                      disabled={!bulkChecked || bulkBusy}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
                    >
                      <RotateCcw size={11} />
                      {bulkBusy
                        ? t(
                            'presentations.agent.history.bulkRevert.working',
                            'Reverting...'
                          )
                        : t(
                            'presentations.agent.history.bulkRevert.confirm',
                            'Confirm bulk revert'
                          )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBulkConfirmOpen(false);
                        setBulkChecked(false);
                      }}
                      disabled={bulkBusy}
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 border border-slate-200 dark:border-navy-700 disabled:opacity-50"
                    >
                      {t('presentations.agent.history.bulkRevert.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {historyStatus === 'ok' && historyEntries.length === 0 && !historyLoading && (
            <div className="text-[11px] italic text-slate-500 dark:text-slate-400 px-1 py-2">
              {t('presentations.agent.history.empty', 'No prior proposals yet')}
            </div>
          )}

          {historyLoading && historyEntries.length === 0 && (
            <div className="text-[11px] italic text-slate-500 dark:text-slate-400 px-1 py-2">
              {t('presentations.agent.history.loading', 'Loading proposal history...')}
            </div>
          )}

          {historyEntries.length > 0 && (
            <ul role="list" className="space-y-1.5">
              {historyEntries.map((entry) => {
                const isExpanded = expandedHistoryId === entry.id;
                const statusKey = entry.status as
                  | 'applied'
                  | 'rejected'
                  | 'draft'
                  | 'accepted'
                  | 'failed'
                  | string;
                const statusStyle =
                  statusKey === 'applied'
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : statusKey === 'rejected'
                      ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                      : statusKey === 'draft'
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        : statusKey === 'accepted'
                          ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300';
                const ts = entry.createdAt
                  ? (() => {
                      const d = new Date(entry.createdAt);
                      return Number.isNaN(d.getTime())
                        ? entry.createdAt
                        : d.toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                    })()
                  : '';
                const diffStrip =
                  entry.diff.cardsAdded || entry.diff.cardsRemoved || entry.diff.changedCards
                    ? `+${entry.diff.cardsAdded} -${entry.diff.cardsRemoved} ~${entry.diff.changedCards}`
                    : '';
                const slides = Array.isArray(entry.diff.slides) ? entry.diff.slides : [];
                const isSelectable =
                  entry.status === 'applied' || entry.status === 'accepted';
                const isSelected = selectedHistoryIds.has(entry.id);
                return (
                  <li
                    key={entry.id}
                    className={`rounded-md border overflow-hidden ${
                      isSelected
                        ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50/40 dark:bg-rose-500/5'
                        : 'border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/40'
                    }`}
                  >
                    <div className="flex items-stretch">
                      {isSelectable && (
                        <label
                          className="flex items-center justify-center px-2 border-r border-slate-100 dark:border-navy-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800/50"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={t(
                            'presentations.agent.history.bulkRevert.selectRow',
                            'Select operation for bulk revert'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleHistorySelection(entry.id)}
                            className="cursor-pointer"
                          />
                        </label>
                      )}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedHistoryId((prev) => (prev === entry.id ? null : entry.id))
                      }
                      aria-expanded={isExpanded}
                      className="flex-1 w-full text-left px-2 py-1.5 hover:bg-primary-50/40 dark:hover:bg-primary-500/5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusStyle}`}
                        >
                          {entry.status}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
                          {entry.operationType}
                        </span>
                        {ts && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {ts}
                          </span>
                        )}
                        {diffStrip && (
                          <span className="ml-auto text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {diffStrip}
                          </span>
                        )}
                      </div>
                      {entry.prompt && (
                        <div
                          className="mt-1 text-[11px] text-slate-700 dark:text-slate-200 line-clamp-1"
                          title={entry.prompt}
                        >
                          {entry.prompt}
                        </div>
                      )}
                    </button>
                    </div>

                    {isExpanded && (
                      <div className="px-2 pb-2 pt-1 space-y-2 border-t border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/30">
                        {entry.reply && (
                          <div className="text-[11px] text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                            {entry.reply}
                          </div>
                        )}
                        {entry.actions.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-0.5">
                              {t('presentations.agent.history.actions', 'Actions')}
                            </div>
                            <ul className="list-disc list-inside text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                              {entry.actions.map((action, idx) => (
                                <li key={`${entry.id}-act-${idx}`}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {slides.length > 0 ? (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-0.5">
                              {t('presentations.agent.history.slides', 'Slide changes')}
                            </div>
                            <ul role="list" className="space-y-1.5 max-h-60 overflow-auto">
                              {slides
                                .filter((s) => s.action !== 'unchanged')
                                .map((slide) => (
                                  <SlideDiffRow
                                    key={`${entry.id}-${slide.index}-${slide.action}`}
                                    slide={slide as unknown as ProposalSlideDiff}
                                    onOpen={(s) => setActiveSlideDiff(s)}
                                  />
                                ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="text-[11px] italic text-slate-500 dark:text-slate-400">
                            {t(
                              'presentations.agent.history.noSlideDiff',
                              'No slide-level diff recorded.'
                            )}
                          </div>
                        )}
                        {(entry.versionBefore != null || entry.versionAfter != null) && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            v{entry.versionBefore ?? '—'} → v{entry.versionAfter ?? '—'}
                          </div>
                        )}
                        {(entry.status === 'applied' || entry.status === 'accepted') && (() => {
                          const banner = revertBanners[entry.id];
                          const confirmOpen = revertConfirmId === entry.id;
                          const isReverting = revertingId === entry.id;
                          return (
                            <div className="pt-1.5 mt-1.5 border-t border-slate-200/70 dark:border-navy-800/70 space-y-1.5">
                              {banner?.kind === 'success' && (
                                <div className="rounded-md border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                                  <div className="font-medium">
                                    {t(
                                      'presentations.agent.history.revert.successTitle',
                                      'Reverted to v{{before}} → v{{after}}.',
                                      {
                                        before: banner.versionBefore,
                                        after: banner.versionAfter,
                                      }
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-emerald-700/80 dark:text-emerald-300/80">
                                    +{banner.diffSummary.cardsAdded} -{banner.diffSummary.cardsRemoved} ~{banner.diffSummary.changedCards}
                                  </div>
                                </div>
                              )}
                              {banner?.kind === 'conflict' && (
                                <div className="rounded-md border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-700 dark:text-rose-300">
                                  {banner.message}
                                </div>
                              )}
                              {banner?.kind === 'forbidden' && (
                                <div className="rounded-md border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-700 dark:text-rose-300">
                                  {banner.message}
                                </div>
                              )}
                              {banner?.kind === 'error' && (
                                <div className="rounded-md border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
                                  <span>{banner.message}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRevertEntry(entry.id)}
                                    disabled={isReverting}
                                    className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/30 text-[10px] font-medium disabled:opacity-50"
                                  >
                                    {t('presentations.agent.history.revert.retry', 'Retry')}
                                  </button>
                                </div>
                              )}

                              {!confirmOpen && banner?.kind !== 'success' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRevertConfirmId(entry.id);
                                    setRevertChecked(false);
                                  }}
                                  disabled={isReverting}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50"
                                >
                                  <RotateCcw size={11} />
                                  {t(
                                    'presentations.agent.history.revert.button',
                                    'Revert deck'
                                  )}
                                </button>
                              )}

                              {confirmOpen && (
                                <div className="rounded-md border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/5 px-2 py-2 space-y-1.5">
                                  <div className="text-[11px] text-slate-700 dark:text-slate-200">
                                    {t(
                                      'presentations.agent.history.revert.warning',
                                      'This will replace the current deck with the snapshot taken before this proposal. The original proposal will remain in history.'
                                    )}
                                  </div>
                                  <label className="flex items-start gap-1.5 text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={revertChecked}
                                      onChange={(e) => setRevertChecked(e.target.checked)}
                                      className="mt-0.5"
                                      disabled={isReverting}
                                    />
                                    <span>
                                      {t(
                                        'presentations.agent.history.revert.acknowledge',
                                        'I understand this rewrites the deck.'
                                      )}
                                    </span>
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleRevertEntry(entry.id)}
                                      disabled={!revertChecked || isReverting}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
                                    >
                                      <RotateCcw size={11} />
                                      {isReverting
                                        ? t(
                                            'presentations.agent.history.revert.working',
                                            'Reverting...'
                                          )
                                        : t(
                                            'presentations.agent.history.revert.confirm',
                                            'Confirm revert'
                                          )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRevertConfirmId(null);
                                        setRevertChecked(false);
                                      }}
                                      disabled={isReverting}
                                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 border border-slate-200 dark:border-navy-700 disabled:opacity-50"
                                    >
                                      {t(
                                        'presentations.agent.history.revert.cancel',
                                        'Cancel'
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {historyEntries.length > 0 && historyEntries.length < historyTotal && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleHistoryLoadMore}
                disabled={historyLoading}
                className="w-full px-2 py-1.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 border border-slate-200 dark:border-navy-700 disabled:opacity-50"
              >
                {historyLoading
                  ? t('presentations.agent.history.loadingMore', 'Loading...')
                  : t('presentations.agent.history.loadMore', 'Load more')}
              </button>
            </div>
          )}
        </div>
      )}

      {activeSlideDiff && (
        <SlideDiffDetailModal
          slide={activeSlideDiff}
          onClose={() => setActiveSlideDiff(null)}
        />
      )}

      {activeTab === 'chat' && (
      /* Input */
      <div className="px-3 py-3 border-t border-slate-100 dark:border-navy-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t(
              'presentations.agent.placeholder',
              'Ask me to edit, create, or style anything'
            )}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-sm text-slate-700 dark:text-slate-300 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
      )}
    </div>
  );
};
