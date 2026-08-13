/**
 * RN-G4 lane `teresa` (FALA 2, 2026-08-11) — the "Teresa niedostępna" state
 * the task brief requires as a HARD requirement: "Ścieżka ręczna musi
 * działać także wtedy, gdy Teresa jest niedostępna." Shown whenever
 * `createTeresaProposal`/`executeTeresaProposal` fails with a transport-level
 * error (`TeresaProposalApiError.status === 0`, i.e. network unreachable —
 * NOT a domain denial like `DISPOSITION_ALREADY_RECORDED`, which is a
 * different, already-handled state the panel renders separately).
 *
 * This banner never blocks `onManualFallback` — the whole point is that the
 * manual path (e.g. ROI's pre-existing `RoiPirDraftEditModal` +
 * `updateRoiPostInvestmentReviewDraft`, which never calls Teresa at all) is
 * reachable and fully functional regardless of Teresa's own availability.
 */
import { AlertOctagon, PenLine } from 'lucide-react';
import React from 'react';

export interface TeresaUnavailableBannerProps {
  isPolish: boolean;
  reason?: string | null;
  onRetry?: () => void;
  onManualFallback?: () => void;
  manualFallbackLabel?: string;
}

export const TeresaUnavailableBanner: React.FC<TeresaUnavailableBannerProps> = ({
  isPolish,
  reason,
  onRetry,
  onManualFallback,
  manualFallbackLabel,
}) => {
  return (
    <div
      role="alert"
      data-testid="teresa-unavailable-banner"
      className="space-y-3 rounded-lg border border-c-warning/40 bg-c-warning/10 p-4"
    >
      <div className="flex items-start gap-2">
        <AlertOctagon size={16} className="mt-0.5 shrink-0 text-c-warning" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-c-text">
            {isPolish ? 'Teresa jest teraz niedostępna' : 'Teresa is currently unavailable'}
          </p>
          <p className="text-[12px] text-c-text-secondary">
            {isPolish
              ? 'Nie można teraz poprosić Teresy o wersję roboczą. Możesz kontynuować ręcznie — nic w tym ekranie nie wymaga jej obecności.'
              : "Teresa can't be asked for a draft right now. You can keep working manually — nothing on this screen requires her."}
          </p>
          {reason ? <p className="text-[11px] text-c-text-muted">{reason}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            data-testid="teresa-unavailable-retry"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-c-border bg-c-surface px-3 text-[12px] font-medium text-c-text transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {isPolish ? 'Spróbuj ponownie' : 'Try again'}
          </button>
        ) : null}
        {onManualFallback ? (
          <button
            type="button"
            onClick={onManualFallback}
            data-testid="teresa-unavailable-manual"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-c-text px-3 text-[12px] font-medium text-c-bg transition-colors hover:bg-c-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <PenLine size={13} />
            <span>
              {manualFallbackLabel ?? (isPolish ? 'Kontynuuj ręcznie' : 'Continue manually')}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default TeresaUnavailableBanner;
