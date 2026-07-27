/**
 * Consultify Document Studio — Progressive Generation Panel (C1).
 *
 * Rendered while the document streams from `POST /generate/stream`. It paints
 * the section skeleton the instant the `plan` event arrives, then fills each
 * section as its `section` event lands, so the consultant watches the
 * deliverable assemble instead of staring at a blind spinner.
 *
 * Pure presentation — the streaming state (outline + which sections are ready)
 * is owned by DocumentStudioView and passed down. Uses c-* tokens only; no
 * crimson.
 */

import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { DocumentOutline, DocumentSourceRef } from './types';

export interface GeneratingSectionState {
  /** Section title (from outline, overwritten by the streamed section title). */
  title: string;
  /** True once the `section` event for this position has arrived. */
  ready: boolean;
  /**
   * §5/§7.2 doctrine (`_DOKTRYNA_STREAMING_2026-07-27.md`) — the sources this
   * section's blocks are grounded on ("na czym opieram tę sekcję"), deduped
   * from `section.blocks[].sourceRef`. Already flows through the `section` SSE
   * event server-side; this was previously computed but never rendered.
   */
  sourceRefs?: DocumentSourceRef[];
}

interface DocumentStudioGeneratingPanelProps {
  /** Resolved outline (present once the `plan` event landed). Null while planning. */
  outline: DocumentOutline | null;
  /** Per-position readiness, indexed to match `outline.sections`. */
  sections: GeneratingSectionState[];
  /** Optional error surfaced when the stream failed and no fallback is running. */
  error?: string | null;
  /**
   * §4/§7.1 doctrine — non-blocking, honest heads-up shown when the live SSE
   * connection dropped and generation is continuing via the synchronous
   * fallback. Never silent: this is what replaces the old "nothing happened"
   * cichy fallback.
   */
  notice?: string | null;
  /** Called when the user asks to stop the in-flight generation (§2/§7.3). */
  onStop?: () => void;
  /**
   * False once the run has fallen back to the non-abortable synchronous path
   * — the Stop button is hidden rather than left as a dead control (clicking
   * it then would do nothing, which is its own kind of silent failure).
   */
  canStop?: boolean;
}

export const DocumentStudioGeneratingPanel: React.FC<DocumentStudioGeneratingPanelProps> = ({
  outline,
  sections,
  error,
  notice,
  onStop,
  canStop,
}) => {
  const { t } = useTranslation();

  const total = sections.length;
  const readyCount = sections.filter((s) => s.ready).length;

  return (
    <div
      data-testid="document-studio-generating"
      className="flex h-full min-h-0 flex-col overflow-y-auto p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-c-text">
            <Loader2 className="h-4 w-4 animate-spin text-c-text-secondary" aria-hidden="true" />
            {outline?.title ?? t('documentStudio.generating.title', 'Generating your document…')}
          </h2>
          <p className="mt-1 text-sm text-c-text-muted" aria-live="polite">
            {outline
              ? t('documentStudio.generating.progress', {
                  defaultValue: 'Writing sections… {{done}} of {{total}} ready',
                  done: readyCount,
                  total,
                })
              : t('documentStudio.generating.planning', 'Planning the outline…')}
          </p>
        </div>
        {onStop && canStop && (
          <button
            type="button"
            data-testid="document-studio-stop-generation"
            onClick={onStop}
            className="shrink-0 rounded-lg border border-c-border px-3 py-1.5 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {t('documentStudio.generating.stop', 'Stop')}
          </button>
        )}
      </div>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          data-testid="document-studio-stream-notice"
          className="mb-4 flex items-start gap-2 rounded-md border border-c-warning/40 bg-c-warning/10 px-3 py-2 text-xs text-c-text"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-c-warning" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {total > 0 && (
        <div
          className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-c-surface"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={readyCount}
        >
          <div
            className="h-full rounded-full bg-c-success transition-all duration-300"
            style={{ width: `${total > 0 ? (readyCount / total) * 100 : 0}%` }}
          />
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {(outline?.sections ?? []).map((section, idx) => {
          const state = sections[idx];
          const ready = state?.ready ?? false;
          const title = state?.title || section.title;
          return (
            <li
              key={`${section.title}-${idx}`}
              data-testid={`generating-section-${idx}`}
              data-ready={ready ? 'true' : 'false'}
              className={`flex items-baseline gap-3 rounded-lg border p-3 text-sm transition-colors ${
                ready
                  ? 'border-c-border bg-c-surface'
                  : 'border-c-border-subtle bg-c-surface-raised'
              }`}
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                {ready ? (
                  <Check className="h-4 w-4 text-c-success" aria-hidden="true" />
                ) : (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin text-c-text-muted"
                    aria-hidden="true"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <span className={`font-medium ${ready ? 'text-c-text' : 'text-c-text-secondary'}`}>
                  {idx + 1}. {title}
                </span>
                {ready && state?.sourceRefs && state.sourceRefs.length > 0 && (
                  <div
                    className="mt-1.5 flex flex-wrap items-center gap-1.5"
                    data-testid={`generating-section-${idx}-sources`}
                  >
                    <span className="text-[11px] text-c-text-muted">
                      {t('documentStudio.generating.basedOn', 'Based on:')}
                    </span>
                    {state.sourceRefs.map((ref, refIdx) => (
                      <span
                        key={`${ref.sourceType}-${ref.sourceId}-${refIdx}`}
                        className="rounded-full border border-c-border bg-c-surface-raised px-2 py-0.5 text-[11px] text-c-text-secondary"
                        title={ref.sourceTitle || `${ref.sourceType}:${ref.sourceId}`}
                      >
                        {ref.sourceTitle || ref.sourceType}
                      </span>
                    ))}
                  </div>
                )}
                {!ready && (
                  <div className="mt-2 space-y-1.5" aria-hidden="true">
                    <div className="h-2.5 w-11/12 animate-pulse rounded bg-c-border-subtle" />
                    <div className="h-2.5 w-4/5 animate-pulse rounded bg-c-border-subtle" />
                    <div className="h-2.5 w-2/3 animate-pulse rounded bg-c-border-subtle" />
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {/* Before the plan lands we don't know the sections — show 3 skeleton rows. */}
        {!outline &&
          [0, 1, 2].map((i) => (
            <li
              key={`skeleton-${i}`}
              className="flex items-baseline gap-3 rounded-lg border border-c-border-subtle bg-c-surface-raised p-3"
            >
              <Loader2
                className="mt-0.5 h-3.5 w-3.5 animate-spin text-c-text-muted"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-2.5 w-1/3 animate-pulse rounded bg-c-border-subtle" />
                <div className="h-2.5 w-4/5 animate-pulse rounded bg-c-border-subtle" />
              </div>
            </li>
          ))}
      </ol>

      {error && (
        <p className="mt-4 text-sm text-c-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default DocumentStudioGeneratingPanel;
