/**
 * ConversionPreviewDialog (E11, 2026-08-10)
 *
 * The mandatory preview required by docs/standards/idea-workspace/10_
 * KONWERSJA_EKSPORT_IMPORT_SZABLONY.md §2.2: every Convert entry point must
 * show, BEFORE anything is persisted — (1) what scope it converts, (2) the
 * target, (3) what will actually be created (mapped fields, not just a
 * target name), (4) a link/backlink note, (5) warnings.
 *
 * Prior state (E02-N5-CONVERT ledger finding, verified true before this file
 * existed): none of the three entry points (Menu 1 dropdown, right-panel
 * Convert section, Mind Map node context menu) showed anything before
 * calling `Api.convertMyIdea` — only a toast AFTER the fact. This dialog is
 * the single gate all of them now share, wired from
 * `IdeaMapWorkspace.handleConvert`.
 *
 * CRIMSON-SAFE: no `primary-*`/crimson tokens; CTA = `bg-c-text text-c-surface`;
 * focus ring = `c-focus`, matching `IdeaConvertMenu.tsx`.
 */

import { AlertTriangle, ArrowRight, Loader2, Workflow, X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

export type ConversionPreviewScopeKind = 'workspace' | 'selection' | 'single_item' | 'branch';

export interface ConversionPreviewScope {
  kind: ConversionPreviewScopeKind;
  /** e.g. "Cała Idea (14 elementów)" / "Zaznaczenie (3)" / "Węzeł: Ryzyko dostawcy" */
  labelPl: string;
  labelEn: string;
  /** Labels of the elements actually included, for a real content preview (capped by caller). */
  elementLabels: string[];
  elementCount: number;
}

export interface ConversionMappedField {
  sourcePl: string;
  sourceEn: string;
  targetPl: string;
  targetEn: string;
}

export interface ConversionPreviewWarning {
  pl: string;
  en: string;
}

export interface ConversionPreviewData {
  targetLabelPl: string;
  targetLabelEn: string;
  /** Computed name the new artifact will actually have (real title, not a placeholder). */
  targetArtifactName: string;
  scope: ConversionPreviewScope;
  mappedFields: ConversionMappedField[];
  warnings: ConversionPreviewWarning[];
  /** True only for scope.kind === 'workspace' — the one case that flips Idea.stage to Promoted. */
  willPromoteStage: boolean;
  /** How many times this Idea has already been converted (to any target) — lineage awareness. */
  priorConversionCount: number;
}

export interface ConversionPreviewDialogProps {
  open: boolean;
  isPolish: boolean;
  data: ConversionPreviewData | null;
  /** True while the confirmed conversion's server call is in flight. */
  submitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const MAX_VISIBLE_ELEMENTS = 8;

export const ConversionPreviewDialog: React.FC<ConversionPreviewDialogProps> = ({
  open,
  isPolish,
  data,
  submitting = false,
  onConfirm,
  onCancel,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  // Preview data is fetched async (real Idea content, not fabricated) — the
  // dialog opens immediately on click with a loading state rather than
  // leaving the click feeling dead while the fetch is in flight.
  if (!data) {
    return (
      <div
        className="fixed inset-0 z-overlay flex items-center justify-center bg-black/40 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={isPolish ? 'Podgląd konwersji' : 'Conversion preview'}
      >
        <div className="bg-c-surface rounded-token-lg shadow-2xl w-full max-w-lg mx-4 border border-c-border-subtle px-5 py-10 flex flex-col items-center gap-2">
          <Loader2 size={20} className="animate-spin text-c-text-secondary" aria-hidden="true" />
          <span className="text-xs text-c-text-muted">
            {isPolish ? 'Przygotowuję podgląd…' : 'Preparing preview…'}
          </span>
        </div>
      </div>
    );
  }

  const visibleElements = data.scope.elementLabels.slice(0, MAX_VISIBLE_ELEMENTS);
  const hiddenElementCount = Math.max(0, data.scope.elementCount - visibleElements.length);

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isPolish ? 'Podgląd konwersji' : 'Conversion preview'}
      data-testid="idea-conversion-preview-dialog"
    >
      <div className="bg-c-surface rounded-token-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-c-border-subtle max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-c-border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <Workflow size={16} className="text-c-text-secondary" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-c-text">
              {isPolish ? 'Podgląd konwersji' : 'Conversion preview'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            aria-label={isPolish ? 'Zamknij' : 'Close'}
            className="p-1 rounded-md text-c-text-muted hover:text-c-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* Scope → Target */}
          <div className="flex items-center gap-2 rounded-token-md bg-c-surface-raised px-3 py-2.5 text-sm">
            <span className="font-medium text-c-text">
              {isPolish ? data.scope.labelPl : data.scope.labelEn}
            </span>
            <ArrowRight size={14} className="text-c-text-muted shrink-0" aria-hidden="true" />
            <span className="font-semibold text-c-text">
              {isPolish ? data.targetLabelPl : data.targetLabelEn}
            </span>
          </div>

          {/* Target artifact name */}
          <div>
            <span className="text-xs font-medium text-c-text-muted">
              {isPolish ? 'Nazwa nowego artefaktu' : 'New artifact name'}
            </span>
            <p className="mt-1 text-sm text-c-text" data-testid="idea-conversion-preview-name">
              {data.targetArtifactName}
            </p>
          </div>

          {/* Included elements — real content, not just a count */}
          {data.scope.elementCount > 0 && (
            <div>
              <span className="text-xs font-medium text-c-text-muted">
                {isPolish
                  ? `Uwzględnione elementy (${data.scope.elementCount})`
                  : `Included elements (${data.scope.elementCount})`}
              </span>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {visibleElements.map((label, i) => (
                  <li
                    key={`${label}-${i}`}
                    className="rounded-token-sm border border-c-border-subtle bg-c-surface-raised px-2 py-0.5 text-xs text-c-text-secondary"
                  >
                    {label}
                  </li>
                ))}
                {hiddenElementCount > 0 && (
                  <li className="rounded-token-sm px-2 py-0.5 text-xs text-c-text-muted">
                    {isPolish ? `+${hiddenElementCount} więcej` : `+${hiddenElementCount} more`}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Mapped fields */}
          {data.mappedFields.length > 0 && (
            <div>
              <span className="text-xs font-medium text-c-text-muted">
                {isPolish ? 'Co dokładnie powstanie' : 'What will actually be created'}
              </span>
              <ul className="mt-1.5 space-y-1">
                {data.mappedFields.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-1.5 text-xs text-c-text-secondary"
                  >
                    <span>{isPolish ? f.sourcePl : f.sourceEn}</span>
                    <ArrowRight size={11} className="text-c-text-muted shrink-0" aria-hidden="true" />
                    <span className="text-c-text">{isPolish ? f.targetPl : f.targetEn}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stage-promotion notice — only real for scope.kind === 'workspace' (backend
              only flips promoted_to/stage on scope==='workspace', see my-work.routes.ts promote()) */}
          {data.willPromoteStage && (
            <div className="rounded-token-md border border-c-warning/40 bg-c-warning/10 px-3 py-2 text-xs text-c-text">
              {isPolish
                ? 'To oznaczy całą Ideę jako Promowaną (stage = Promoted).'
                : 'This will mark the whole Idea as Promoted (stage = Promoted).'}
            </div>
          )}
          {!data.willPromoteStage && data.scope.kind !== 'workspace' && (
            <div className="text-xs text-c-text-muted">
              {isPolish
                ? 'Konwersja fragmentu — etap Idei zostaje bez zmian, dopisywany jest tylko wpis w historii konwersji.'
                : 'Partial conversion — the Idea stage stays unchanged; only a lineage entry is appended.'}
            </div>
          )}

          {/* Prior conversions — lineage is append-only, this is informational */}
          {data.priorConversionCount > 0 && (
            <div className="text-xs text-c-text-muted">
              {isPolish
                ? `Ta Idea była już konwertowana ${data.priorConversionCount}×. Ta konwersja dopisze kolejny, osobny wpis — nie nadpisze poprzednich.`
                : `This Idea has already been converted ${data.priorConversionCount}×. This conversion appends another, separate record — it will not overwrite earlier ones.`}
            </div>
          )}

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div className="rounded-token-md border border-c-warning/40 bg-c-warning/10 px-3 py-2 space-y-1">
              {data.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-c-text">
                  <AlertTriangle size={12} className="text-c-warning shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{isPolish ? w.pl : w.en}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-c-border-subtle bg-c-surface-raised shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-medium text-c-text-secondary hover:text-c-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
            data-testid="idea-conversion-preview-cancel"
          >
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-token-md bg-c-text text-c-surface text-xs font-semibold hover:bg-c-text-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            data-testid="idea-conversion-preview-confirm"
          >
            {submitting && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
            {isPolish ? 'Potwierdź i konwertuj' : 'Confirm & convert'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConversionPreviewDialog;
