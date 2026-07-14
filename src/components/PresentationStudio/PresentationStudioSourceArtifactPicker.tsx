/**
 * PresentationStudioSourceArtifactPicker (Sprint S9)
 *
 * Module: Consultify Presentation Studio.
 *
 * Tenant-scoped picker that lists the source artifacts available for the
 * current organization (via S9's read-only `/source-artifacts` endpoint).
 * Pure presentational. Owns no fetches; the parent injects the list, the
 * loading/error state, and a reload callback.
 *
 * Honest UI invariants:
 *   - Empty list (`list.artifacts.length === 0` and no warnings) renders an
 *     explicit empty state, never a hidden "ready" placeholder.
 *   - Backend warnings (e.g. `assessments_query_failed`) render an honest
 *     degraded banner. The picker still renders any artifacts it received,
 *     but does not silently upgrade the warning away.
 *   - Each artifact carries a readiness chip mapped through the canonical
 *     color tokens (slate/blue/amber/emerald/rose). No local custom map.
 *   - Selection is a controlled `string[]` of artifact ids; the parent owns
 *     persistence and projection into the API setup payload.
 */

import { AlertTriangle, CheckCircle2, FileText, Loader2, RefreshCw } from 'lucide-react';
import React from 'react';

import {
  EmptyState as SharedEmptyState,
  LoadingState as SharedLoadingState,
} from '@/components/shared/states';
import type {
  PresentationStudioSourceArtifactItem,
  PresentationStudioSourceArtifactList,
  PresentationStudioSourceArtifactReadiness,
} from '@/services/api/presentationStudio.api';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PresentationStudioSourceArtifactPickerProps {
  /** Loaded list. `null` while no fetch has completed yet. */
  list: PresentationStudioSourceArtifactList | null;
  loading: boolean;
  error: string | null;
  selectedIds: string[];
  onSelectionChange: (nextIds: string[]) => void;
  onReload: () => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Tone helpers (canonical color map)
// ---------------------------------------------------------------------------

type StatusTone = 'slate' | 'blue' | 'amber' | 'emerald' | 'rose';

function toneForReadiness(readiness: PresentationStudioSourceArtifactReadiness): StatusTone {
  switch (readiness) {
    case 'ready':
      return 'emerald';
    case 'partial_ready':
      return 'amber';
    case 'missing_sales_data':
      return 'rose';
    case 'policy_blocked':
      return 'rose';
    case 'insufficient_evidence':
      return 'slate';
    default:
      return 'slate';
  }
}

const READINESS_LABEL: Record<PresentationStudioSourceArtifactReadiness, string> = {
  ready: 'Ready',
  partial_ready: 'Partial',
  missing_sales_data: 'Missing data',
  policy_blocked: 'Policy blocked',
  insufficient_evidence: 'Insufficient',
};

const TONE_CLASS: Record<StatusTone, string> = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rose: 'bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-300',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ArtifactRow({
  artifact,
  selected,
  onToggle,
  disabled,
}: {
  artifact: PresentationStudioSourceArtifactItem;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}): React.ReactElement {
  const tone = toneForReadiness(artifact.readiness);
  return (
    <li
      className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
      data-testid={`psstudio-artifact-row-${artifact.id}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        disabled={disabled}
        aria-label={`Select source artifact ${artifact.label}`}
        data-testid={`psstudio-artifact-checkbox-${artifact.id}`}
        className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-primary-600 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {artifact.label}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
            data-testid={`psstudio-artifact-readiness-${artifact.id}`}
          >
            {READINESS_LABEL[artifact.readiness]}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {artifact.type}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          {artifact.confidence != null ? (
            <span>confidence {(artifact.confidence * 100).toFixed(0)}%</span>
          ) : (
            <span>confidence —</span>
          )}
          {artifact.updatedAt ? <span>updated {artifact.updatedAt}</span> : null}
          {artifact.hint ? <span>{artifact.hint}</span> : null}
        </div>
      </div>
    </li>
  );
}

export const PresentationStudioSourceArtifactPicker: React.FC<
  PresentationStudioSourceArtifactPickerProps
> = ({ list, loading, error, selectedIds, onSelectionChange, onReload, disabled }) => {
  const selectedSet = new Set(selectedIds);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const artifacts = list?.artifacts ?? [];
  const warnings = list?.warnings ?? [];
  const isEmpty = !loading && !error && artifacts.length === 0 && warnings.length === 0;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      data-testid="presentation-studio-source-picker"
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Source artifacts
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Tenant-scoped read of your assessments. Selected artifacts are attached to every preview
            and to the approval-gated generate flow.
          </p>
        </div>
        <button
          type="button"
          onClick={onReload}
          disabled={disabled || loading}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          data-testid="psstudio-source-picker-reload"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{loading ? 'Loading…' : 'Reload'}</span>
        </button>
      </header>

      <div className="px-5 py-4">
        {error ? (
          <div
            className="mb-3 flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-300"
            role="alert"
            data-testid="psstudio-source-picker-error"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <div className="font-medium">Source artifacts could not be loaded</div>
              <div className="mt-0.5">{error}</div>
            </div>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div
            className="mb-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
            role="status"
            data-testid="psstudio-source-picker-warnings"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <div className="font-medium">Backend reported degraded state</div>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {loading && artifacts.length === 0 ? (
          <div data-testid="psstudio-source-picker-loading">
            <SharedLoadingState template="list" rows={3} label="Loading source artifacts…" />
          </div>
        ) : null}

        {isEmpty ? (
          <div data-testid="psstudio-source-picker-empty">
            <SharedEmptyState
              variant="new"
              compact
              icon={FileText}
              title="No source material yet"
              description="Create or complete an assessment first — nothing is silently attached to the deck."
            />
          </div>
        ) : null}

        {artifacts.length > 0 ? (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                <strong className="font-medium text-slate-900 dark:text-slate-100">
                  {selectedIds.length}
                </strong>{' '}
                of {artifacts.length} selected
              </span>
              {list?.byType ? (
                <span className="inline-flex flex-wrap items-center gap-1">
                  {Object.entries(list.byType).map(([type, count]) => (
                    <span
                      key={type}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {type} · {count}
                    </span>
                  ))}
                </span>
              ) : null}
              {selectedIds.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  selection applies to next preview / approval
                </span>
              ) : null}
            </div>
            <ul className="space-y-2" data-testid="psstudio-source-picker-list">
              {artifacts.map((a) => (
                <ArtifactRow
                  key={a.id}
                  artifact={a}
                  selected={selectedSet.has(a.id)}
                  onToggle={() => toggle(a.id)}
                  disabled={disabled}
                />
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
};

export default PresentationStudioSourceArtifactPicker;
