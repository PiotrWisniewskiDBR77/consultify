/**
 * AIGovernancePanel — Unified AI governance panel for mindmap workspace.
 *
 * Shows AI activity timeline, review controls, AI statistics,
 * and unreviewed-changes indicator. Reads from canvasGovernance
 * extensions and writes through the extensions patch mechanism.
 *
 * @see docs/product/MINDMAP_V1_SSOT.md §9
 * @see docs/product/IDEA_WORKSPACE_V5_SSOT.md §7
 */
import {
  Activity,
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileCheck,
  MessageSquare,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ToolsPanelShell } from '@/components/shared/WorkspaceTools';

import TeresaMark from '../../shared/TeresaMark';
import type { CanvasAIReplayEntry, CanvasGovernanceStatus } from '../ideaSelectionTypes';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AIGovernancePanelProps {
  open: boolean;
  onClose: () => void;
  mapExtensions: Record<string, any>;
  graphNodes: any[];
  currentUserName: string;
  onGovernanceUpdate: (update: { status: string; note?: string; actor?: string }) => void;
}

type SectionKey = 'timeline' | 'review' | 'stats';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseGovernance(ext: Record<string, any>) {
  const gov =
    ext?.canvasGovernance &&
    typeof ext.canvasGovernance === 'object' &&
    !Array.isArray(ext.canvasGovernance)
      ? (ext.canvasGovernance as Record<string, unknown>)
      : {};

  const aiReplayLog = Array.isArray(gov.aiReplayLog)
    ? (gov.aiReplayLog as CanvasAIReplayEntry[])
    : [];

  const status = (gov.status as CanvasGovernanceStatus) || 'draft';
  const lastAiApplyAt = gov.lastAiApplyAt ? String(gov.lastAiApplyAt) : null;
  const reviewedBy = gov.reviewedBy ? String(gov.reviewedBy) : null;
  const reviewedAt = gov.reviewedAt ? String(gov.reviewedAt) : null;
  const reviewNote = gov.reviewNote ? String(gov.reviewNote) : null;
  const lastReviewedAt = gov.lastReviewedAt ? String(gov.lastReviewedAt) : null;

  return {
    aiReplayLog,
    status,
    lastAiApplyAt,
    reviewedBy,
    reviewedAt,
    reviewNote,
    lastReviewedAt,
  };
}

function hasUnreviewedChanges(
  status: CanvasGovernanceStatus,
  lastAiApplyAt: string | null,
  lastReviewedAt: string | null
): boolean {
  if (!lastAiApplyAt) return false;
  if (status === 'approved') return false;
  if (!lastReviewedAt) return true;
  return new Date(lastAiApplyAt) > new Date(lastReviewedAt);
}

function formatTimestamp(iso: string, isPl: boolean): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return isPl ? 'Przed chwilą' : 'Just now';
    if (diffMin < 60) return isPl ? `${diffMin} min temu` : `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return isPl ? `${diffH}h temu` : `${diffH}h ago`;
    return d.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const STATUS_CONFIG: Record<
  CanvasGovernanceStatus,
  { labelPl: string; labelEn: string; color: string; icon: React.ElementType }
> = {
  draft: {
    labelPl: 'Szkic',
    labelEn: 'Draft',
    color: 'text-c-text-secondary bg-c-surface-raised dark:bg-c-surface',
    icon: FileCheck,
  },
  in_review: {
    labelPl: 'W przeglądzie',
    labelEn: 'In Review',
    color: 'text-c-warning bg-c-warning dark:bg-c-warning',
    icon: Eye,
  },
  approved: {
    labelPl: 'Zatwierdzony',
    labelEn: 'Approved',
    color: 'text-c-success bg-c-success dark:bg-c-success',
    icon: ShieldCheck,
  },
  changes_requested: {
    labelPl: 'Zmiany wymagane',
    labelEn: 'Changes Requested',
    color: 'text-c-danger bg-c-danger dark:bg-c-danger',
    icon: AlertCircle,
  },
};

const GENERATOR_LABELS: Record<string, { pl: string; en: string }> = {
  expand_branch: { pl: 'Rozbudowa gałęzi', en: 'Branch expansion' },
  auto_cluster: { pl: 'Auto-klastrowanie', en: 'Auto-clustering' },
  blind_spots: { pl: 'Wykrywanie luk', en: 'Blind spots detection' },
  competitive: { pl: 'Analiza konkurencji', en: 'Competitive analysis' },
  dependency: { pl: 'Wykrywanie zależności', en: 'Dependency detection' },
  sentiment: { pl: 'Analiza sentymentu', en: 'Sentiment analysis' },
  priority: { pl: 'Rekomendacja priorytetów', en: 'Priority recommendation' },
  what_if: { pl: 'Scenariusze what-if', en: 'What-if scenarios' },
  ai_suggestions_panel: { pl: 'Panel sugestii AI', en: 'AI suggestions panel' },
  unknown: { pl: 'Akcja AI', en: 'AI action' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AIGovernancePanel: React.FC<AIGovernancePanelProps> = ({
  open,
  onClose,
  mapExtensions,
  graphNodes,
  currentUserName,
  onGovernanceUpdate,
}) => {
  const { i18n } = useTranslation();
  const isPl = useMemo(() => i18n.language?.startsWith('pl'), [i18n.language]);

  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['timeline', 'review', 'stats'])
  );
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const governance = useMemo(() => parseGovernance(mapExtensions), [mapExtensions]);

  const unreviewed = useMemo(
    () =>
      hasUnreviewedChanges(governance.status, governance.lastAiApplyAt, governance.lastReviewedAt),
    [governance.status, governance.lastAiApplyAt, governance.lastReviewedAt]
  );

  const sortedLog = useMemo(() => [...governance.aiReplayLog].reverse(), [governance.aiReplayLog]);

  // AI statistics
  const stats = useMemo(() => {
    const log = governance.aiReplayLog;
    const totalActions = log.length;
    const totalProposals = log.reduce((sum, e) => sum + (e.proposalIds?.length || 0), 0);

    const aiNodeIds = new Set<string>();
    for (const entry of log) {
      for (const pid of entry.proposalIds || []) {
        aiNodeIds.add(pid);
      }
    }

    const nodesFromAI = graphNodes.filter(
      (n: any) => n?.data?.sourceType === 'ai' || n?.data?.source === 'ai' || aiNodeIds.has(n?.id)
    ).length;
    const totalNodes = graphNodes.length;
    const manualNodes = totalNodes - nodesFromAI;

    const toolCounts: Record<string, number> = {};
    const generatorCounts: Record<string, number> = {};
    for (const entry of log) {
      const t = entry.tool || 'unknown';
      toolCounts[t] = (toolCounts[t] || 0) + 1;
      const g = entry.generatorType || 'unknown';
      generatorCounts[g] = (generatorCounts[g] || 0) + 1;
    }

    const mostUsedGenerator = Object.entries(generatorCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      totalActions,
      totalProposals,
      nodesFromAI,
      manualNodes,
      totalNodes,
      mostUsedGenerator: mostUsedGenerator
        ? { type: mostUsedGenerator[0], count: mostUsedGenerator[1] }
        : null,
      lastAiAction: governance.lastAiApplyAt,
    };
  }, [governance.aiReplayLog, governance.lastAiApplyAt, graphNodes]);

  const toggleSection = useCallback((key: SectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleStatusChange = useCallback(
    (nextStatus: CanvasGovernanceStatus) => {
      onGovernanceUpdate({
        status: nextStatus,
        note: reviewNote.trim() || undefined,
        actor: currentUserName,
      });
      setReviewNote('');
    },
    [currentUserName, onGovernanceUpdate, reviewNote]
  );

  if (!open) return null;

  const statusCfg = STATUS_CONFIG[governance.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;

  return (
    <ToolsPanelShell
      title={isPl ? 'Governance AI' : 'AI Governance'}
      subtitle={isPl ? 'Przegląd i kontrola' : 'Review & control'}
      icon={
        <div className="w-7 h-7 rounded-lg bg-c-surface-raised flex items-center justify-center shadow-sm ">
          <Shield size={13} className="text-c-text" />
        </div>
      }
      onClose={onClose}
    >
      <div className="px-3 py-3 flex-1 overflow-auto space-y-3">
        {/* Unreviewed changes alert */}
        {unreviewed && (
          <div className="rounded-xl border border-c-warning dark:border-c-warning bg-c-warning dark:bg-c-warning p-2.5 flex items-start gap-2">
            <div className="mt-0.5">
              <AlertCircle size={14} className="text-c-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-c-warning dark:text-c-warning">
                {isPl ? 'Niesprawdzone zmiany AI' : 'Unreviewed AI changes'}
              </div>
              <div className="text-[10px] text-c-warning dark:text-c-warning mt-0.5">
                {isPl
                  ? 'AI dokonało zmian, które nie zostały jeszcze zrecenzowane.'
                  : 'AI made changes that have not been reviewed yet.'}
              </div>
            </div>
          </div>
        )}

        {/* Current status badge */}
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusCfg.color}`}
          >
            <StatusIcon size={12} />
            {isPl ? statusCfg.labelPl : statusCfg.labelEn}
          </div>
          {governance.reviewedBy && (
            <span className="text-[9px] text-c-text-secondary dark:text-c-text-secondary">
              {isPl ? 'przez' : 'by'} {governance.reviewedBy}
            </span>
          )}
        </div>

        {/* ── AI Activity Timeline ─────────────────────────────────── */}
        <div className="rounded-xl border border-c-border-subtle dark:border-c-border bg-c-surface-raised dark:bg-c-surface p-2.5">
          <button
            type="button"
            onClick={() => toggleSection('timeline')}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <Activity size={12} className="text-c-text-secondary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-secondary dark:text-c-text-muted flex-1">
              {isPl ? 'Oś czasu AI' : 'AI Activity Timeline'}
            </span>
            <span className="text-[9px] text-c-text-secondary mr-1">{sortedLog.length}</span>
            {expandedSections.has('timeline') ? (
              <ChevronUp size={12} className="text-c-text-muted" />
            ) : (
              <ChevronDown size={12} className="text-c-text-muted" />
            )}
          </button>

          {expandedSections.has('timeline') && (
            <div className="mt-2 space-y-1.5">
              {sortedLog.length === 0 ? (
                <div className="text-[10px] text-c-text-secondary dark:text-c-text-secondary text-center py-3">
                  {isPl
                    ? 'Brak akcji AI — canvas jest w pełni ręczny'
                    : 'No AI actions — canvas is fully manual'}
                </div>
              ) : (
                sortedLog.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id;
                  const genLabel =
                    GENERATOR_LABELS[entry.generatorType] || GENERATOR_LABELS.unknown;
                  const proposalCount = entry.proposalIds?.length || 0;

                  return (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-c-border-subtle dark:border-c-border bg-c-surface-raised dark:bg-c-surface-raised overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
                      >
                        <TeresaMark size={12} className="text-c-text-secondary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-c-text-secondary dark:text-c-text-muted truncate">
                            {isPl ? genLabel.pl : genLabel.en}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-c-text-secondary">
                              <Clock size={8} className="inline mr-0.5 -mt-px" />
                              {formatTimestamp(entry.acceptedAt, !!isPl)}
                            </span>
                            <span className="text-[9px] text-c-text-secondary">
                              {proposalCount} {isPl ? 'propozycji' : 'proposals'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <CheckCircle2 size={10} className="text-c-success" />
                          {isExpanded ? (
                            <ChevronUp size={10} className="text-c-text-secondary" />
                          ) : (
                            <ChevronDown size={10} className="text-c-text-secondary" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-c-border-subtle dark:border-c-border">
                          <div className="pt-2">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-1">
                              {isPl ? 'Narzędzie' : 'Tool'}
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text-muted">
                              {entry.tool}
                            </span>
                          </div>

                          {entry.rationale?.length > 0 && (
                            <div>
                              <div className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-1">
                                {isPl ? 'Uzasadnienie' : 'Rationale'}
                              </div>
                              <div className="space-y-1">
                                {entry.rationale.map((r, i) => (
                                  <div
                                    key={i}
                                    className="text-[10px] text-c-text-secondary dark:text-c-text-muted bg-c-surface-raised dark:bg-c-surface rounded-lg p-1.5"
                                  >
                                    {r}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {entry.citations?.length > 0 && (
                            <div>
                              <div className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-1">
                                {isPl ? 'Cytowania' : 'Citations'}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {entry.citations.map((c, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-c-info dark:bg-c-info text-c-info dark:text-c-info"
                                  >
                                    {c.kind && (
                                      <span className="font-bold uppercase text-[7px] opacity-60">
                                        {c.kind}
                                      </span>
                                    )}
                                    {c.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="text-[9px] text-c-text-secondary">
                            IDs: {entry.proposalIds?.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ── Review Controls ──────────────────────────────────────── */}
        <div className="rounded-xl border border-c-success dark:border-c-success bg-c-success dark:bg-c-success p-2.5">
          <button
            type="button"
            onClick={() => toggleSection('review')}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <ShieldCheck size={12} className="text-c-success" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-c-success dark:text-c-success flex-1">
              {isPl ? 'Kontrola review' : 'Review Controls'}
            </span>
            {expandedSections.has('review') ? (
              <ChevronUp size={12} className="text-c-success" />
            ) : (
              <ChevronDown size={12} className="text-c-success" />
            )}
          </button>

          {expandedSections.has('review') && (
            <div className="mt-2 space-y-2">
              {/* Review note */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-1 block">
                  {isPl ? 'Notatka review' : 'Review note'}
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={
                    isPl ? 'Opcjonalny komentarz do review...' : 'Optional review comment...'
                  }
                  rows={2}
                  className="w-full text-[10px] px-2.5 py-1.5 rounded-lg border border-c-success dark:border-c-success bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted placeholder:text-c-text-muted outline-none focus:ring-1 focus:ring-c-success resize-none"
                />
              </div>

              {/* Status buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    'draft',
                    'in_review',
                    'approved',
                    'changes_requested',
                  ] as CanvasGovernanceStatus[]
                ).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  const Icon = cfg.icon;
                  const isActive = governance.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleStatusChange(s)}
                      disabled={isActive}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        isActive
                          ? `${cfg.color} ring-1 ring-current/20`
                          : 'text-c-text-secondary dark:text-c-text-muted bg-c-surface-raised dark:bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-c-surface-raised border border-c-border-subtle dark:border-c-border'
                      }`}
                    >
                      <Icon size={11} />
                      <span className="truncate">{isPl ? cfg.labelPl : cfg.labelEn}</span>
                    </button>
                  );
                })}
              </div>

              {/* Last review info */}
              {governance.lastReviewedAt && (
                <div className="text-[9px] text-c-text-secondary dark:text-c-text-secondary flex items-center gap-1">
                  <Clock size={9} />
                  {isPl ? 'Ostatni review' : 'Last review'}:{' '}
                  {formatTimestamp(governance.lastReviewedAt, !!isPl)}
                  {governance.reviewedBy && ` (${governance.reviewedBy})`}
                </div>
              )}
              {governance.reviewNote && (
                <div className="text-[10px] text-c-text-secondary dark:text-c-text-muted bg-c-surface-raised dark:bg-c-surface-raised rounded-lg p-2 border border-c-border-subtle dark:border-c-border">
                  <MessageSquare size={9} className="inline mr-1 text-c-text-secondary" />
                  {governance.reviewNote}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── AI Statistics ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-c-info dark:border-c-info bg-c-info dark:bg-c-info p-2.5">
          <button
            type="button"
            onClick={() => toggleSection('stats')}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <BarChart3 size={12} className="text-c-info" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-c-info dark:text-c-info flex-1">
              {isPl ? 'Statystyki AI' : 'AI Statistics'}
            </span>
            {expandedSections.has('stats') ? (
              <ChevronUp size={12} className="text-c-info" />
            ) : (
              <ChevronDown size={12} className="text-c-info" />
            )}
          </button>

          {expandedSections.has('stats') && (
            <div className="mt-2 space-y-2">
              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-lg bg-c-surface-raised dark:bg-c-surface-raised p-2 border border-c-info dark:border-c-info">
                  <div className="text-[16px] font-bold text-c-text dark:text-c-text">
                    {stats.totalActions}
                  </div>
                  <div className="text-[9px] text-c-text-secondary">
                    {isPl ? 'Akcji AI' : 'AI actions'}
                  </div>
                </div>
                <div className="rounded-lg bg-c-surface-raised dark:bg-c-surface-raised p-2 border border-c-info dark:border-c-info">
                  <div className="text-[16px] font-bold text-c-text dark:text-c-text">
                    {stats.totalProposals}
                  </div>
                  <div className="text-[9px] text-c-text-secondary">
                    {isPl ? 'Propozycji' : 'Proposals'}
                  </div>
                </div>
              </div>

              {/* AI vs Manual nodes */}
              <div className="rounded-lg bg-c-surface-raised dark:bg-c-surface-raised p-2 border border-c-info dark:border-c-info">
                <div className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-1.5">
                  {isPl ? 'Węzły: AI vs ręczne' : 'Nodes: AI vs manual'}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-c-surface-raised dark:bg-c-surface overflow-hidden">
                      {stats.totalNodes > 0 && (
                        <div
                          className="h-full rounded-full bg-c-surface-raised  "
                          style={{
                            width: `${Math.round((stats.nodesFromAI / stats.totalNodes) * 100)}%`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-c-text-secondary dark:text-c-text-muted shrink-0">
                    <span className="font-semibold text-c-text-secondary dark:text-c-text">
                      {stats.nodesFromAI}
                    </span>
                    {' / '}
                    <span className="font-semibold">{stats.totalNodes}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[9px] text-c-text-secondary flex items-center gap-1">
                    <TeresaMark size={8} />
                    {isPl ? 'AI' : 'AI'}: {stats.nodesFromAI}
                  </span>
                  <span className="text-[9px] text-c-text-secondary flex items-center gap-1">
                    <Sparkles size={8} />
                    {isPl ? 'Ręczne' : 'Manual'}: {stats.manualNodes}
                  </span>
                </div>
              </div>

              {/* Most used generator */}
              {stats.mostUsedGenerator && (
                <div className="rounded-lg bg-c-surface-raised dark:bg-c-surface-raised p-2 border border-c-info dark:border-c-info">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-1">
                    {isPl ? 'Najczęściej używany generator' : 'Most used generator'}
                  </div>
                  <div className="text-[11px] font-medium text-c-text-secondary dark:text-c-text-muted">
                    {isPl
                      ? (GENERATOR_LABELS[stats.mostUsedGenerator.type] || GENERATOR_LABELS.unknown)
                          .pl
                      : (GENERATOR_LABELS[stats.mostUsedGenerator.type] || GENERATOR_LABELS.unknown)
                          .en}
                  </div>
                  <div className="text-[9px] text-c-text-secondary mt-0.5">
                    {stats.mostUsedGenerator.count}× {isPl ? 'użyć' : 'uses'}
                  </div>
                </div>
              )}

              {/* Last AI action */}
              {stats.lastAiAction && (
                <div className="text-[9px] text-c-text-secondary dark:text-c-text-secondary flex items-center gap-1">
                  <Clock size={9} />
                  {isPl ? 'Ostatnia akcja AI' : 'Last AI action'}:{' '}
                  {formatTimestamp(stats.lastAiAction, !!isPl)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ToolsPanelShell>
  );
};

/* ------------------------------------------------------------------ */
/*  Badge — small indicator for workspace header                       */
/* ------------------------------------------------------------------ */

interface AIGovernanceBadgeProps {
  mapExtensions: Record<string, any>;
  onClick: () => void;
}

export const AIGovernanceBadge: React.FC<AIGovernanceBadgeProps> = ({ mapExtensions, onClick }) => {
  const { i18n } = useTranslation();
  const isPl = useMemo(() => i18n.language?.startsWith('pl'), [i18n.language]);

  const governance = useMemo(() => parseGovernance(mapExtensions), [mapExtensions]);

  const unreviewed = useMemo(
    () =>
      hasUnreviewedChanges(governance.status, governance.lastAiApplyAt, governance.lastReviewedAt),
    [governance.status, governance.lastAiApplyAt, governance.lastReviewedAt]
  );

  const aiCount = governance.aiReplayLog.length;
  if (aiCount === 0 && !unreviewed) return null;

  const statusCfg = STATUS_CONFIG[governance.status] || STATUS_CONFIG.draft;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:scale-[1.02] ${
        unreviewed
          ? 'bg-c-warning dark:bg-c-warning text-c-warning dark:text-c-warning border border-c-warning dark:border-c-warning animate-pulse'
          : 'bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text-muted border border-c-border-subtle dark:border-c-border'
      }`}
      title={
        isPl
          ? `Governance AI: ${statusCfg.labelPl}${unreviewed ? ' — niesprawdzone zmiany' : ''}`
          : `AI Governance: ${statusCfg.labelEn}${unreviewed ? ' — unreviewed changes' : ''}`
      }
    >
      <Shield size={11} className={unreviewed ? 'text-c-warning' : 'text-c-text-secondary'} />
      {unreviewed && <span className="w-1.5 h-1.5 rounded-full bg-c-warning animate-pulse" />}
      <span>{aiCount}</span>
    </button>
  );
};

export default AIGovernancePanel;
