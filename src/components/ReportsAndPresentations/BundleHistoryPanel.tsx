/**
 * BundleHistoryPanel — W3.8 in-app bundle history/viewer + W4.4 lifecycle state display.
 *
 * Shows a collapsible list of Komplet AI bundles generated for this org.
 * Each row displays: title, date, lifecycle badge, quality indicator.
 * Clicking a row opens a detail overlay with metadata.
 */

import { CheckCircle2, Clock, Package2, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { BundleListItem } from '../../services/deliverablesBundle';
import { useBundleList } from './useBundleList';

// ---------------------------------------------------------------------------
// Lifecycle badge
// ---------------------------------------------------------------------------

const LIFECYCLE_BADGE: Record<string, { label: string; classes: string }> = {
  draft: {
    label: 'Draft',
    classes: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  },
  generating: {
    label: 'Generating',
    classes: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  ready: {
    label: 'Ready',
    classes: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  error: {
    label: 'Error',
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
};

function LifecycleBadge({ state }: { state: string }) {
  const meta = LIFECYCLE_BADGE[state] ?? {
    label: state,
    classes: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.classes}`}
    >
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Quality indicator
// ---------------------------------------------------------------------------

function QualityIcon({ passed }: { passed: boolean | null }) {
  if (passed === true)
    return <CheckCircle2 className="h-4 w-4 text-green-500" aria-label="Quality OK" />;
  if (passed === false)
    return <XCircle className="h-4 w-4 text-red-500" aria-label="Quality issues" />;
  return <Clock className="h-4 w-4 text-c-text-muted" aria-label="Quality pending" />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function truncate(s: string | null, max = 40): string {
  if (!s) return '—';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ---------------------------------------------------------------------------
// Detail modal
// ---------------------------------------------------------------------------

interface BundleDetailModalProps {
  bundle: BundleListItem;
  onClose: () => void;
}

function BundleDetailModal({ bundle, onClose }: BundleDetailModalProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md rounded-xl bg-c-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package2 className="h-5 w-5 shrink-0 text-blue-500" />
            <h2 className="text-base font-semibold text-c-text">
              {bundle.title ?? t('rap.bundles.untitled', 'Untitled bundle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-c-text-muted hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            aria-label={t('common.close', 'Close')}
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {/* Metadata */}
        <dl className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <dt className="w-28 shrink-0 text-c-text-muted">
              {t('rap.bundles.detail.status', 'Status')}
            </dt>
            <dd>
              <LifecycleBadge state={bundle.lifecycleState} />
            </dd>
          </div>

          <div className="flex items-center gap-2">
            <dt className="w-28 shrink-0 text-c-text-muted">
              {t('rap.bundles.detail.quality', 'Quality')}
            </dt>
            <dd className="flex items-center gap-1.5">
              <QualityIcon passed={bundle.qualityPassed} />
              <span className="text-c-text-secondary">
                {bundle.qualityPassed === true
                  ? t('rap.bundles.quality.ok', '✓ OK')
                  : bundle.qualityPassed === false
                    ? t('rap.bundles.quality.issues', '✗ Quality issues')
                    : t('rap.bundles.quality.pending', 'Pending')}
              </span>
            </dd>
          </div>

          <div className="flex items-center gap-2">
            <dt className="w-28 shrink-0 text-c-text-muted">
              {t('rap.bundles.detail.created', 'Created')}
            </dt>
            <dd className="text-c-text-secondary">{formatDate(bundle.createdAt)}</dd>
          </div>

          <div className="flex items-center gap-2">
            <dt className="w-28 shrink-0 text-c-text-muted">
              {t('rap.bundles.detail.language', 'Language')}
            </dt>
            <dd className="text-c-text-secondary">{bundle.language.toUpperCase()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <div className="divide-y divide-c-border-subtle" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="h-4 w-40 animate-pulse rounded bg-c-surface-raised" />
          <div className="h-4 w-20 animate-pulse rounded bg-c-surface-raised" />
          <div className="ml-auto h-5 w-14 animate-pulse rounded-full bg-c-surface-raised" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export interface BundleHistoryPanelProps {
  /** Zmiana tej wartości wymusza odświeżenie listy (np. po wygenerowaniu bundla). */
  refreshSignal?: number;
}

export function BundleHistoryPanel({ refreshSignal }: BundleHistoryPanelProps = {}) {
  const { t } = useTranslation();
  const { bundles, loading, error, refetch } = useBundleList();
  const [selected, setSelected] = useState<BundleListItem | null>(null);

  // Po sygnale z huba (świeżo wygenerowany bundle) — pobierz listę ponownie.
  useEffect(() => {
    if (refreshSignal !== undefined && refreshSignal > 0) refetch();
  }, [refreshSignal, refetch]);

  return (
    <div
      className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface"
      data-testid="bundle-history-panel"
    >
      {/* Loading */}
      {loading && <SkeletonRows />}

      {/* Error */}
      {!loading && error && (
        <p className="px-4 py-6 text-center text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Empty state */}
      {!loading && !error && bundles.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-c-text-muted">
          {t('rap.bundles.empty', 'No bundles generated yet')}
        </p>
      )}

      {/* Bundle list */}
      {!loading && !error && bundles.length > 0 && (
        <ul className="divide-y divide-c-border-subtle" role="list">
          {bundles.map((bundle) => (
            <li key={bundle.id}>
              <button
                onClick={() => setSelected(bundle)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {/* Title + date */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-c-text">
                    {truncate(bundle.title)}
                  </p>
                  <p className="text-xs text-c-text-muted">{formatDate(bundle.createdAt)}</p>
                </div>

                {/* Lifecycle badge */}
                <LifecycleBadge state={bundle.lifecycleState} />

                {/* Quality icon */}
                <QualityIcon passed={bundle.qualityPassed} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Detail overlay */}
      {selected && <BundleDetailModal bundle={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
