/**
 * BlankCreationState — shared "creating a blank artifact" gate.
 *
 * Fixes a class of bug from the 2026-07-28 live odbiór (właściciel): the
 * Materiały wspólny launcher's `?entry=blank` auto-create effect (Document
 * Studio / Excele / Prezentacje — each POSTs a `.../blank` endpoint on mount
 * and then routes to the real artifact) left the view's local
 * `entryMode==='blank'` gate stuck FOREVER in two situations:
 *
 *   1. SUCCESS on a lane that stays on the same route after creating (Excele:
 *      `navigate('/excele?artifactId=…')` does not remount the component —
 *      the `entryMode==='blank'` early-return kept winning over the real
 *      content even after the workbook existed and had loaded).
 *   2. FAILURE on every lane: the `catch` block only fired a `toast.error(…)`,
 *      which disappears after a few seconds — after that the user is left
 *      staring at an unkillable spinner with no button, no error text, no way
 *      out. The underlying request already has a hard transport timeout
 *      (`fetchWithRetry` / `Api.post`, 20s default — see
 *      `src/services/api/baseClient.ts` and `src/services/api.ts`), so the
 *      network side was never actually infinite; the UI state simply never
 *      reacted to the rejection.
 *
 * "Zero cichych fallbacków" (CLAUDE.md doktryna): a failed action must leave
 * a permanent, actionable trace — not a spinner that outlives its own toast.
 * Callers own the timing (when to flip `status` to `'failed'`); this
 * component only renders the two states consistently across lanes.
 */
import { Loader2 } from 'lucide-react';
import React from 'react';

export interface BlankCreationStateProps {
  /** 'creating' = spinner; 'failed' = permanent error card with a way out. */
  status: 'creating' | 'failed';
  /** Label shown next to the spinner while `status === 'creating'`. */
  creatingLabel: string;
  /** Message shown in the error card while `status === 'failed'`. */
  failedMessage: string;
  onRetry: () => void;
  retryLabel: string;
  onBack: () => void;
  backLabel: string;
  /** Base for `data-testid` — rendered as `${testId}-creating` / `${testId}-failed`. */
  testId?: string;
}

export const BlankCreationState: React.FC<BlankCreationStateProps> = ({
  status,
  creatingLabel,
  failedMessage,
  onRetry,
  retryLabel,
  onBack,
  backLabel,
  testId,
}) => {
  if (status === 'creating') {
    return (
      <div
        data-testid={testId ? `${testId}-creating` : undefined}
        className="flex h-full flex-1 items-center justify-center gap-2 text-c-text-secondary"
      >
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">{creatingLabel}</span>
      </div>
    );
  }

  return (
    <div
      data-testid={testId ? `${testId}-failed` : undefined}
      className="mx-auto mt-16 max-w-xl rounded-xl border border-c-border bg-c-surface p-6 text-center"
    >
      <p className="text-sm text-c-text">{failedMessage}</p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {retryLabel}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {backLabel}
        </button>
      </div>
    </div>
  );
};

export default BlankCreationState;
