/**
 * DeckQualityGatesPanel — G1: Quality Gates for presentations.
 * Shows structure/content/brand/traceability check results with score.
 */

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Shield,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface DeckQualityGateResult {
  id: string;
  gateType: string;
  severity: 'error' | 'warning' | 'info';
  priority?: 'P0' | 'P1' | 'P2';
  message: string;
  cardIndex?: number;
  category: 'structure' | 'content' | 'brand' | 'traceability' | 'quality';
}

interface DeckQualityReport {
  deckId: string;
  canExport: boolean;
  canShare: boolean;
  gates: DeckQualityGateResult[];
  score: number;
  result?: 'PASS' | 'PASS_WITH_P2' | 'BLOCKED_P1' | 'INCONCLUSIVE';
  scorecard?: {
    p0: number;
    p1: number;
    p2: number;
    passVocabulary: 'PASS' | 'PASS_WITH_P2' | 'BLOCKED_P1' | 'INCONCLUSIVE';
  };
  checkedAt: string;
}

interface DeckQualityGatesPanelProps {
  deckId: string;
  isOpen: boolean;
  onClose: () => void;
  onJumpToCard?: (cardIndex: number) => void;
}

const categoryIcons: Record<string, typeof Shield> = {
  structure: Shield,
  content: Info,
  brand: CheckCircle2,
  traceability: Info,
  quality: CheckCircle2,
};

const categoryLabels: Record<string, string> = {
  structure: 'Structure',
  content: 'Content',
  brand: 'Brand',
  traceability: 'Traceability',
  quality: 'Quality',
};

const severityStyles: Record<string, { bg: string; text: string; icon: typeof XCircle }> = {
  error: { bg: 'bg-danger-500/10', text: 'text-danger-600', icon: XCircle },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-600', icon: AlertTriangle },
  info: { bg: 'bg-blue-500/10', text: 'text-blue-500', icon: Info },
};

const priorityPillStyles: Record<'P0' | 'P1' | 'P2', string> = {
  P0: 'bg-danger-500/15 text-danger-700 dark:text-danger-300 ring-1 ring-danger-500/30',
  P1: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30',
  P2: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30',
};

type PriorityKey = 'P0' | 'P1' | 'P2' | 'Other';

const priorityOrder: PriorityKey[] = ['P0', 'P1', 'P2', 'Other'];

const priorityGroupLabel: Record<PriorityKey, string> = {
  P0: 'P0 — Blockers',
  P1: 'P1 — Blockers',
  P2: 'P2 — Warnings',
  Other: 'Other',
};

const priorityGroupHeaderColor: Record<PriorityKey, string> = {
  P0: 'text-danger-600',
  P1: 'text-amber-600',
  P2: 'text-blue-600',
  Other: 'text-c-text-secondary',
};

const resultStyles: Record<string, string> = {
  PASS: 'text-emerald-600',
  PASS_WITH_P2: 'text-amber-600',
  BLOCKED_P1: 'text-danger-600',
  INCONCLUSIVE: 'text-c-text-secondary',
};

function PriorityPill({ priority }: { priority: 'P0' | 'P1' | 'P2' }) {
  return (
    <span
      aria-label={`Priority ${priority}`}
      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${priorityPillStyles[priority]}`}
    >
      {priority}
    </span>
  );
}

function getHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  };
}

export const DeckQualityGatesPanel: React.FC<DeckQualityGatesPanelProps> = ({
  deckId,
  isOpen,
  onClose,
  onJumpToCard,
}) => {
  const { t } = useTranslation();
  const [report, setReport] = useState<DeckQualityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['structure', 'content'])
  );
  const [expandedPriorities, setExpandedPriorities] = useState<Set<string>>(
    new Set(['P0', 'P1', 'P2', 'Other'])
  );
  const [viewMode, setViewMode] = useState<'category' | 'priority'>('priority');

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const firstBlockerRef = useRef<HTMLDivElement | null>(null);

  const runCheck = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/presentations/decks/${deckId}/quality-gates`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setReport(json?.data || null);
      } else {
        setError(
          json?.error || t('presentations.qualityGates.failed', 'Quality gates failed to run.')
        );
      }
    } catch (err: any) {
      setError(
        err?.message || t('presentations.qualityGates.failed', 'Quality gates failed to run.')
      );
    } finally {
      setLoading(false);
    }
  }, [deckId, t]);

  useEffect(() => {
    if (isOpen && deckId) runCheck();
  }, [isOpen, deckId, runCheck]);

  const firstBlockerId = useMemo(() => {
    const gates = report?.gates || [];
    const p0 = gates.find((g) => g.priority === 'P0');
    if (p0) return p0.id;
    const p1 = gates.find((g) => g.priority === 'P1');
    if (p1) return p1.id;
    return null;
  }, [report]);

  // Auto-scroll to highest-priority blocker once per report load.
  useEffect(() => {
    if (!report || report.gates.length === 0 || !firstBlockerId) return;
    const handle = window.setTimeout(() => {
      firstBlockerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    return () => window.clearTimeout(handle);
  }, [report, firstBlockerId]);

  if (!isOpen) return null;

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const togglePriority = (p: string) => {
    setExpandedPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const grouped: Record<string, DeckQualityGateResult[]> = {};
  for (const g of report?.gates || []) {
    if (!grouped[g.category]) grouped[g.category] = [];
    grouped[g.category].push(g);
  }

  const groupedByPriority: Record<PriorityKey, DeckQualityGateResult[]> = {
    P0: [],
    P1: [],
    P2: [],
    Other: [],
  };
  for (const g of report?.gates || []) {
    const key: PriorityKey = (g.priority ?? 'Other') as PriorityKey;
    groupedByPriority[key].push(g);
  }
  for (const key of priorityOrder) {
    groupedByPriority[key].sort(
      (a, b) => a.category.localeCompare(b.category) || a.message.localeCompare(b.message)
    );
  }

  const scoreColor =
    (report?.score ?? 0) >= 80
      ? 'text-green-500'
      : (report?.score ?? 0) >= 50
        ? 'text-amber-500'
        : 'text-danger-500';

  const renderGateRow = (gate: DeckQualityGateResult) => {
    const sev = severityStyles[gate.severity] || severityStyles.info;
    const SevIcon = sev.icon;
    const isFirstBlocker = gate.id === firstBlockerId;
    return (
      <div
        key={gate.id}
        ref={isFirstBlocker ? firstBlockerRef : undefined}
        className={`flex items-start gap-2 p-2 rounded-lg ${sev.bg} cursor-pointer hover:opacity-80`}
        onClick={() => {
          if (gate.cardIndex != null) onJumpToCard?.(gate.cardIndex);
        }}
      >
        <SevIcon size={14} className={`${sev.text} mt-0.5 flex-shrink-0`} />
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {gate.priority && <PriorityPill priority={gate.priority} />}
          <p className={`text-[11px] ${sev.text}`}>{gate.message}</p>
        </div>
      </div>
    );
  };

  const resultValue = report?.scorecard?.passVocabulary ?? report?.result;
  const resultColorClass = resultValue
    ? resultStyles[resultValue] || 'text-c-text-secondary'
    : 'text-c-text-secondary';

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-c-surface border-l border-c-border-subtle z-30 flex flex-col shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-c-accent" />
          <h3 className="text-sm font-semibold text-c-text">
            {t('presentations.qualityGates.title', 'Quality Gates')}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close', 'Close')}
          title={t('common.close', 'Close')}
          className="inline-flex h-9 w-9 items-center justify-center rounded text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* Score */}
      {report && (
        <div className="px-4 py-3 border-b border-c-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs text-c-text-secondary">
              {t('presentations.qualityGates.score', 'Deck Score')}
            </span>
            <span className={`text-2xl font-bold ${scoreColor}`}>{report.score}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.result && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-c-surface-raised text-c-text-secondary">
                {report.result}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                report.canExport
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-danger-500/10 text-danger-600'
              }`}
            >
              {report.canExport ? 'Export OK' : 'Export Blocked'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                report.canShare
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-amber-500/10 text-amber-600'
              }`}
            >
              {report.canShare ? 'Share OK' : 'Share Warning'}
            </span>
          </div>
        </div>
      )}

      {/* Body */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {error && (
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-xs text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-5 h-5 border-2 border-c-accent border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && report && report.scorecard && (
          <div className="rounded-lg border border-c-border-subtle p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md bg-danger-500/10 p-2 text-center">
                <div className="text-lg font-bold text-danger-600">{report.scorecard.p0}</div>
                <div className="text-[10px] uppercase tracking-wide text-danger-700/80 dark:text-danger-300/80">
                  P0 Blockers
                </div>
              </div>
              <div className="rounded-md bg-amber-500/10 p-2 text-center">
                <div className="text-lg font-bold text-amber-600">{report.scorecard.p1}</div>
                <div className="text-[10px] uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">
                  P1 Blockers
                </div>
              </div>
              <div className="rounded-md bg-blue-500/10 p-2 text-center">
                <div className="text-lg font-bold text-blue-600">{report.scorecard.p2}</div>
                <div className="text-[10px] uppercase tracking-wide text-blue-700/80 dark:text-blue-300/80">
                  P2 Warnings
                </div>
              </div>
            </div>
            {resultValue && (
              <div className="text-xs text-c-text-secondary">
                Result: <span className={`font-semibold ${resultColorClass}`}>{resultValue}</span>
              </div>
            )}
          </div>
        )}

        {!loading && report && report.gates.length > 0 && (
          <div
            role="group"
            aria-label="View mode"
            className="inline-flex rounded-md border border-c-border-subtle overflow-hidden text-[11px]"
          >
            <button
              type="button"
              aria-pressed={viewMode === 'priority'}
              onClick={() => setViewMode('priority')}
              className={`px-2.5 py-1 ${
                viewMode === 'priority'
                  ? 'bg-c-surface text-c-text'
                  : 'bg-transparent text-c-text-secondary'
              }`}
            >
              By priority
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'category'}
              onClick={() => setViewMode('category')}
              className={`px-2.5 py-1 border-l border-c-border-subtle ${
                viewMode === 'category'
                  ? 'bg-c-surface text-c-text'
                  : 'bg-transparent text-c-text-secondary'
              }`}
            >
              By category
            </button>
          </div>
        )}

        {!loading && report && report.gates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 size={32} className="text-green-500 mb-2" />
            <p className="text-sm font-medium text-c-text">
              {t('presentations.qualityGates.allPassed', 'All quality gates passed!')}
            </p>
            <p className="text-xs text-c-text-secondary mt-1">
              {t(
                'presentations.qualityGates.readyToExport',
                'Your deck is ready to export and share.'
              )}
            </p>
          </div>
        )}

        {!loading &&
          viewMode === 'category' &&
          Object.entries(grouped).map(([category, gates]) => {
            const CatIcon = categoryIcons[category] || Info;
            const expanded = expandedCategories.has(category);
            const errorCount = gates.filter((g) => g.severity === 'error').length;
            const warnCount = gates.filter((g) => g.severity === 'warning').length;

            return (
              <div key={category}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-2 w-full text-left py-1.5"
                >
                  {expanded ? (
                    <ChevronDown size={14} className="text-c-text-secondary" />
                  ) : (
                    <ChevronRight size={14} className="text-c-text-secondary" />
                  )}
                  <CatIcon size={14} className="text-c-text-secondary" />
                  <span className="text-xs font-semibold text-c-text-secondary uppercase tracking-wide">
                    {categoryLabels[category] || category}
                  </span>
                  <div className="ml-auto flex gap-1">
                    {errorCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-danger-500/10 text-danger-600 font-medium">
                        {errorCount}
                      </span>
                    )}
                    {warnCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 font-medium">
                        {warnCount}
                      </span>
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="ml-5 space-y-1.5 mt-1">{gates.map(renderGateRow)}</div>
                )}
              </div>
            );
          })}

        {!loading &&
          viewMode === 'priority' &&
          report &&
          report.gates.length > 0 &&
          priorityOrder.map((p) => {
            const gates = groupedByPriority[p];
            if (!gates || gates.length === 0) return null;
            const expanded = expandedPriorities.has(p);
            return (
              <div key={p}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => togglePriority(p)}
                  className="flex items-center gap-2 w-full text-left py-1.5"
                >
                  {expanded ? (
                    <ChevronDown size={14} className="text-c-text-secondary" />
                  ) : (
                    <ChevronRight size={14} className="text-c-text-secondary" />
                  )}
                  <span
                    className={`text-xs font-semibold uppercase tracking-wide ${priorityGroupHeaderColor[p]}`}
                  >
                    {priorityGroupLabel[p]}
                  </span>
                  <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] bg-c-surface-raised text-c-text-secondary font-medium">
                    {gates.length}
                  </span>
                </button>
                {expanded && (
                  <div className="ml-5 space-y-1.5 mt-1">{gates.map(renderGateRow)}</div>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-c-border-subtle">
        <button
          onClick={runCheck}
          disabled={loading}
          className="w-full py-2 rounded-lg bg-c-surface text-c-text text-xs font-medium hover:bg-c-surface-raised disabled:opacity-50"
        >
          {loading
            ? t('presentations.qualityGates.checking', 'Checking...')
            : t('presentations.qualityGates.recheck', 'Re-check Quality Gates')}
        </button>
      </div>
    </div>
  );
};
