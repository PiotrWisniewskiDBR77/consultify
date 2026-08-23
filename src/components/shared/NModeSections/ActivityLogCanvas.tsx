/**
 * ActivityLogCanvas
 *
 * Generic N-mode section for displaying activity log / audit trail.
 * Reusable across all artifact types (Decision, Task, Notification, Initiative).
 *
 * Shows:
 * - Summary stat cards (entries, changes, escalations, collaboration)
 * - Chronological activity feed with type icons, timestamps, old→new values
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.3
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ActivityLogEntry {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  userName?: string;
  oldValue?: string;
  newValue?: string;
}

export interface ActivityStats {
  total: number;
  edited: number;
  escalations: number;
  collaboration: number;
}

export interface ActivityTypeMeta {
  icon: React.ReactNode;
  label: string;
  style: string;
}

interface ActivityLogCanvasProps {
  /** Sorted activity log entries */
  entries: ActivityLogEntry[];
  /** Summary statistics */
  stats: ActivityStats;
  /** Function to resolve entry type → icon, label, CSS style */
  typeMeta: (type: string) => ActivityTypeMeta;
  /** Optional custom stat cards (overrides default 4-card grid) */
  customStats?: { label: { en: string; pl: string }; value: number }[];
  /** Task-owner review variant: a light chronological list, without dashboard cards. */
  variant?: 'dashboard' | 'compact-list';
}

// ── Component ───────────────────────────────────────────────────────────────

export const ActivityLogCanvas: React.FC<ActivityLogCanvasProps> = ({
  entries,
  stats,
  typeMeta,
  customStats,
  variant = 'dashboard',
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const locale = isPolish ? 'pl-PL' : 'en-US';

  const defaultStatCards = [
    { label: t('sharedComponents.activityLogCanvas.entries'), value: stats.total },
    { label: t('sharedComponents.activityLogCanvas.changes'), value: stats.edited },
    { label: t('sharedComponents.activityLogCanvas.escalations'), value: stats.escalations },
    { label: t('sharedComponents.activityLogCanvas.collaboration'), value: stats.collaboration },
  ];

  const statCards = customStats
    ? customStats.map((c) => ({
        label: isPolish ? c.label.pl : c.label.en,
        value: c.value,
      }))
    : defaultStatCards;

  if (variant === 'compact-list') {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-c-text dark:text-white">
          {t('sharedComponents.activityLogCanvas.title')}
        </h2>
        {entries.length === 0 ? (
          <p className="py-4 text-sm text-c-text-secondary dark:text-c-text-muted">
            {t('sharedComponents.activityLogCanvas.noEntries')}
          </p>
        ) : (
          <ol className="divide-y divide-c-border/60 dark:divide-c-border/60">
            {entries.map((entry) => {
              const meta = typeMeta(entry.type);
              const hasTechnicalDetails = Boolean(entry.oldValue || entry.newValue);
              const parsedTimestamp = new Date(entry.timestamp);
              const hasValidTimestamp = !Number.isNaN(parsedTimestamp.getTime());
              return (
                <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-c-text-muted" aria-hidden="true">
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-c-text dark:text-c-text">{entry.description}</p>
                      <p className="mt-1 text-xs text-c-text-secondary dark:text-c-text-muted">
                        <time dateTime={entry.timestamp}>
                          {hasValidTimestamp
                            ? parsedTimestamp.toLocaleString(locale)
                            : t('sharedComponents.activityLogCanvas.unknownDate', 'Unknown date')}
                        </time>
                        <span>{` · ${entry.userName || t('sharedComponents.activityLogCanvas.systemActor', 'System')}`}</span>
                      </p>
                      {hasTechnicalDetails && (
                        <details className="mt-1.5 text-xs text-c-text-secondary dark:text-c-text-muted">
                          <summary className="w-fit cursor-pointer select-none hover:text-c-text">
                            {t('common.details', 'Details')}
                          </summary>
                          <div className="mt-1">
                            {entry.oldValue && (
                              <p>{`${t('sharedComponents.activityLogCanvas.from')}: ${entry.oldValue}`}</p>
                            )}
                            {entry.newValue && (
                              <p>{`${t('sharedComponents.activityLogCanvas.to')}: ${entry.newValue}`}</p>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-c-text dark:text-white">
        {t('sharedComponents.activityLogCanvas.title')}
      </h2>

      {/* Stat cards */}
      <div className="space-y-4">
        <div className={`grid grid-cols-1 md:grid-cols-${statCards.length} gap-2`}>
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-c-border/60 dark:border-c-border/60 bg-white/70 dark:bg-c-surface/70 px-3 py-2"
            >
              <p className="text-[11px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted">
                {card.label}
              </p>
              <p className="text-sm font-semibold text-c-text dark:text-c-text">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Activity feed */}
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-c-border-strong/60 dark:border-c-border/70 bg-white/40 dark:bg-c-surface/40 p-6 text-center text-xs text-c-text-secondary dark:text-c-text-muted">
            {t('sharedComponents.activityLogCanvas.noEntries')}
          </div>
        ) : (
          <div className="rounded-2xl border border-c-border/60 dark:border-c-border/60 bg-white/70 dark:bg-c-surface/70 p-3">
            <div className="space-y-1">
              {entries.map((entry) => {
                const meta = typeMeta(entry.type);
                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[auto_1fr_auto] gap-3 items-start py-2.5 px-2 rounded-xl hover:bg-c-surface/70 dark:hover:bg-c-surface-raised/40 transition-colors"
                  >
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-lg border ${meta.style}`}
                    >
                      {meta.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-c-text dark:text-c-text">{entry.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-c-text-secondary dark:text-c-text-muted">
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                        {entry.userName && <span>{`· ${entry.userName}`}</span>}
                        <span className="px-1.5 py-0.5 rounded border border-c-border/60 dark:border-c-border/60">
                          {meta.label}
                        </span>
                      </div>
                      {(entry.oldValue || entry.newValue) && (
                        <div className="mt-1.5 text-[11px] text-c-text-secondary dark:text-c-text-secondary">
                          {entry.oldValue
                            ? `${t('sharedComponents.activityLogCanvas.from')}: ${entry.oldValue}`
                            : ''}
                          {entry.oldValue && entry.newValue ? '  ->  ' : ''}
                          {entry.newValue
                            ? `${t('sharedComponents.activityLogCanvas.to')}: ${entry.newValue}`
                            : ''}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wide text-c-text-secondary dark:text-c-text-secondary">
                      {entry.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogCanvas;
