/**
 * ProblemPreview — right-side preview pane (Outlook-style) for a selected problem row.
 *
 * Header: severity badge, title, root cause
 * Body: source entity link, affected entities, timeline, meta details
 * Footer: action buttons matching the problem's actions list
 */

import { CheckCircle2, ChevronRight, ExternalLink, Info, Link2, X, XCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { actionPillClass } from '../../shared/PreviewPane/previewStyles';
import type { ManagerProblemRow, ProblemAction, ProblemSeverity } from './types';

interface ProblemPreviewProps {
  problem: ManagerProblemRow;
  onAction: (action: ProblemAction) => void;
  onClose: () => void;
  onOpenEntity?: (type: string, id: string) => void;
  /** Read-back state after a manager decision write-back (P0-7). */
  confirmedOutcome?: 'approved' | 'rejected';
}

const SEVERITY_COLORS: Record<
  ProblemSeverity,
  { bg: string; text: string; border: string; label: string }
> = {
  critical: {
    bg: 'bg-danger-50 dark:bg-danger-900/20',
    text: 'text-danger-700 dark:text-danger-400',
    border: 'border-danger-200 dark:border-danger-800/40',
    label: 'Critical',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/40',
    label: 'Warning',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/40',
    label: 'Info',
  },
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  INITIATIVE: <span className="text-sm">🎯</span>,
  TASK: <span className="text-sm">📋</span>,
  DECISION: <span className="text-sm">⚖️</span>,
  RAID_ITEM: <span className="text-sm">🛡️</span>,
  PERSON: <span className="text-sm">👤</span>,
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-c-text-muted whitespace-nowrap">
        {label}
      </span>
      <span className="text-xs text-right text-c-text-secondary">{value}</span>
    </div>
  );
}

function ActionButton({ action, onClick }: { action: ProblemAction; onClick: () => void }) {
  // canon §7.3b: action pills use the shared actionPillClass SSOT (h-9, border, palette schemes).
  const scheme =
    action.variant === 'primary' ? 'primary' : action.variant === 'danger' ? 'red' : 'neutral';
  return (
    <button type="button" onClick={onClick} className={actionPillClass(scheme)}>
      {action.label}
    </button>
  );
}

export function ProblemPreview({
  problem,
  onAction,
  onClose,
  onOpenEntity,
  confirmedOutcome,
}: ProblemPreviewProps) {
  const { t } = useTranslation();
  const sev = SEVERITY_COLORS[problem.severity];
  const typeLabel = problem.problemType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const meta = problem.meta || {};
  const metaEntries = Object.entries(meta).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );

  return (
    <div className="flex flex-col h-full border-l border-c-border-subtle bg-c-surface">
      {/* ─── Header ─── */}
      <div className={`p-4 ${sev.bg} border-b ${sev.border}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span
              className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded ${sev.bg} ${sev.text} border ${sev.border}`}
            >
              {sev.label}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 dark:bg-navy-800 text-c-text-secondary">
              {typeLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
          >
            <X size={16} className="text-c-text-muted" />
          </button>
        </div>

        <h3 className="mt-3 text-sm font-semibold text-c-text leading-snug">{problem.title}</h3>

        <p className="mt-1.5 text-xs text-c-text-secondary leading-relaxed">{problem.rootCause}</p>
      </div>

      {/* ─── Body ─── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Source entity */}
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-c-text-muted mb-2">
            {t('manager.preview.sourceEntity', 'Source Entity')}
          </h4>
          <button
            type="button"
            onClick={() => onOpenEntity?.(problem.sourceEntityType, problem.sourceEntityId)}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-c-border-subtle hover:bg-c-surface-raised transition-colors group"
          >
            {SOURCE_ICONS[problem.sourceEntityType] || <Info size={14} />}
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-medium text-c-text truncate">{problem.sourceEntityName}</p>
              <p className="text-[10px] text-c-text-muted">
                {problem.sourceEntityType.replace(/_/g, ' ')}
              </p>
            </div>
            <ExternalLink
              size={12}
              className="text-c-text-secondary group-hover:text-blue-500 transition-colors shrink-0"
            />
          </button>
        </div>

        {/* Details */}
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-c-text-muted mb-2">
            {t('manager.preview.details', 'Details')}
          </h4>
          <div className="divide-y divide-c-border-subtle border border-c-border-subtle rounded-lg p-3">
            {problem.ownerName && <DetailRow label="Owner" value={problem.ownerName} />}
            {problem.daysOverdue !== null && (
              <DetailRow
                label="Deadline"
                value={
                  problem.daysOverdue > 0 ? (
                    <span className="text-danger-600 dark:text-danger-400 font-medium">
                      {problem.daysOverdue} days overdue
                    </span>
                  ) : problem.daysOverdue < 0 ? (
                    <span className="text-c-text-muted">
                      In {Math.abs(problem.daysOverdue)} days
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">Due today</span>
                  )
                }
              />
            )}
            <DetailRow
              label="Impact"
              value={
                problem.impactCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {problem.impactCount} downstream affected
                  </span>
                ) : (
                  '—'
                )
              }
            />
            {metaEntries.map(([key, val]) => (
              <DetailRow key={key} label={key.replace(/_/g, ' ')} value={String(val)} />
            ))}
          </div>
        </div>

        {/* Affected entities */}
        {problem.affectedEntities.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-c-text-muted mb-2">
              {t('manager.preview.affected', 'Affected Entities')} (
              {problem.affectedEntities.length})
            </h4>
            <div className="space-y-1">
              {problem.affectedEntities.map((ent) => (
                <button
                  key={ent.id}
                  type="button"
                  onClick={() => onOpenEntity?.(ent.type, ent.id)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg border border-c-border-subtle hover:bg-c-surface-raised transition-colors group text-left"
                >
                  {SOURCE_ICONS[ent.type] || <Link2 size={12} />}
                  <span className="text-xs text-c-text-secondary truncate flex-1">{ent.name}</span>
                  <ChevronRight
                    size={12}
                    className="text-c-text-secondary group-hover:text-blue-500 shrink-0"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Footer — Confirmed read-back badge OR Actions ─── */}
      {confirmedOutcome ? (
        <div className="p-3 border-t border-c-border-subtle bg-c-surface-raised">
          <span
            data-testid="decision-confirmed-badge"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
              confirmedOutcome === 'approved'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-crimson-50 text-crimson-700 dark:bg-crimson-900/30 dark:text-crimson-300'
            }`}
          >
            {confirmedOutcome === 'approved' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {confirmedOutcome === 'approved'
              ? t('execution.manager.decision.approvedBadge', 'APPROVED')
              : t('execution.manager.decision.rejectedBadge', 'REJECTED')}
          </span>
        </div>
      ) : (
        problem.actions.length > 0 && (
          <div className="p-3 border-t border-c-border-subtle bg-c-surface-raised">
            <div className="flex flex-wrap gap-2">
              {problem.actions.map((action) => (
                <ActionButton key={action.id} action={action} onClick={() => onAction(action)} />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
