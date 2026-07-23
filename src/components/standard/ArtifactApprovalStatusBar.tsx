/**
 * ArtifactApprovalStatusBar (HP-8, 2026-07-15).
 *
 * Pill + role-appropriate actions for the HP-7 artifact approval workflow
 * (draft -> review -> approved/rejected), meant to be dropped into
 * `ArtifactRightPanel`'s `statusBar` slot.
 *
 * NOT wired into any live consumer yet — this is the built, ready piece;
 * actually rendering it inside a specific artifact shell (Task/Decision/
 * Insight/...) is Vegas's follow-up once it has gone through the
 * `consultify-artefakty` DoD §18.1 visual pass (dark+light screenshots +
 * owner acceptance) per CLAUDE.md rule #7. Until then it only activates
 * behind `isArtifactApprovalUiEnabled()` (default OFF) wherever a caller
 * chooses to mount it.
 *
 * Tokens: c-* only (kanon — zero navy/slate/hex/crimson on state/selection).
 */
import { Check, Send, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useArtifactApprovalStatus } from '@/hooks/useArtifactApprovalStatus';
import type { ArtifactApprovalState } from '@/services/api/artifactApprovals.api';

export interface ArtifactApprovalStatusBarProps {
  artifactType: string;
  artifactId: string;
  /** Current user's id — used to offer "Submit for review" assigned to self when no reviewer picker exists yet (Vegas: replace with a real reviewer picker). */
  currentUserId?: string;
  /** Whether the current user may approve/reject (role check owned by the caller). */
  canReview?: boolean;
  /**
   * Ukryj wlasny przycisk "Submit for review", bo karta oferuje TE SAMA akcje
   * jako `primaryAction` w naglowku (SPEC-N §2.6 — jedna akcja, jedno miejsce).
   *
   * Dotyczy dzis WYLACZNIE Initiative: jej primary cyklu zycia to wlasnie
   * "Submit for Review", wiec przycisk pojawial sie DWA RAZY na jednym ekranie
   * (zgloszenie Piotra 2026-07-21 ze zrzutu demo). Decision ma w naglowku
   * "Approve decision", Insight "Convert to initiative" — inne akcje, wiec
   * u nich pasek zostaje bez zmian i prop jest zbedny.
   *
   * Pasek NADAL pokazuje stan zatwierdzenia (Draft/Review/Approved) — znika
   * tylko zdublowany przycisk, nie informacja.
   */
  hideSubmitAction?: boolean;
  className?: string;
}

/**
 * Klucze i18n stanu (2026-07-23, naprawa „angielski pasek w polskim UI").
 *
 * BYŁO: `STATE_LABEL` trzymał na sztywno angielskie napisy („Draft"/„In review"/
 * „Approved"/„Rejected") i tak samo literał „Submit for review". Pasek jest
 * osadzony w prawym panelu Decyzji, Wglądu i Inicjatywy, więc polski użytkownik
 * widział angielski status na trzech kartach naraz.
 *
 * DLACZEGO translation.json, a nie lokalne pary { en, pl } (wzór `NModeMenu2`):
 * ten komponent mieszka w `src/components/standard/`, gdzie WSZYSTKIE komponenty
 * z tekstem (StandardTable, StandardPreview, StandardKanban, StandardKanbanCard)
 * lokalizują się przez `useTranslation()` + `translation.json`; ani jeden nie
 * trzyma lokalnych par. Pary `{ en, pl }` to wzorzec powłoki N (NModeMenu2,
 * NModeCardState) i został tam wprowadzony jako obejście braku kluczy — tu
 * klucze dopisujemy, więc idziemy konwencją katalogu `standard/`.
 * Gałąź: `sharedComponents.artifactApprovalStatusBar.*`.
 */
const STATE_LABEL_KEY: Record<ArtifactApprovalState, string> = {
  draft: 'sharedComponents.artifactApprovalStatusBar.stateDraft',
  review: 'sharedComponents.artifactApprovalStatusBar.stateReview',
  approved: 'sharedComponents.artifactApprovalStatusBar.stateApproved',
  rejected: 'sharedComponents.artifactApprovalStatusBar.stateRejected',
};

const STATE_PILL_CLASS: Record<ArtifactApprovalState, string> = {
  draft: 'bg-c-surface-raised text-c-text-muted',
  review: 'bg-[color-mix(in_srgb,var(--c-info)_15%,transparent)] text-c-info',
  approved: 'bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] text-c-success',
  rejected: 'bg-[color-mix(in_srgb,var(--c-danger)_15%,transparent)] text-c-danger',
};

const buttonClass =
  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border border-c-border-subtle bg-c-surface-raised text-c-text hover:bg-c-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] disabled:opacity-50 disabled:pointer-events-none';

export const ArtifactApprovalStatusBar: React.FC<ArtifactApprovalStatusBarProps> = ({
  artifactType,
  artifactId,
  currentUserId,
  canReview = false,
  hideSubmitAction = false,
  className,
}) => {
  const { t } = useTranslation();
  const { state, loading, error, actionPending, submitForReview, approve, reject } =
    useArtifactApprovalStatus(artifactType, artifactId);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (loading && !state) {
    return (
      <div className={`text-xs text-c-text-muted ${className ?? ''}`}>
        {t('sharedComponents.artifactApprovalStatusBar.loading')}
      </div>
    );
  }

  const effectiveState: ArtifactApprovalState = state ?? 'draft';

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center h-5 px-2 rounded-md text-[11px] font-medium ${STATE_PILL_CLASS[effectiveState]}`}
        >
          {t(STATE_LABEL_KEY[effectiveState])}
        </span>
        {actionPending ? (
          <span className="text-[11px] text-c-text-muted">
            {t('sharedComponents.artifactApprovalStatusBar.saving')}
          </span>
        ) : null}
      </div>

      {error ? <p className="text-[11px] text-c-danger">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {(effectiveState === 'draft' || effectiveState === 'rejected') &&
        currentUserId &&
        !hideSubmitAction ? (
          <button
            type="button"
            className={buttonClass}
            disabled={actionPending}
            onClick={() => void submitForReview(currentUserId)}
          >
            <Send size={12} />
            {t('sharedComponents.artifactApprovalStatusBar.submitForReview')}
          </button>
        ) : null}

        {effectiveState === 'review' && canReview ? (
          <>
            <button
              type="button"
              className={buttonClass}
              disabled={actionPending}
              onClick={() => void approve()}
            >
              <Check size={12} />
              {t('sharedComponents.artifactApprovalStatusBar.approve')}
            </button>
            {showRejectInput ? (
              <span className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t(
                    'sharedComponents.artifactApprovalStatusBar.rejectReasonPlaceholder'
                  )}
                  className="h-7 px-2 rounded-lg text-xs border border-c-border-subtle bg-c-surface text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                />
                <button
                  type="button"
                  className={buttonClass}
                  disabled={actionPending}
                  onClick={() => {
                    void reject(rejectReason || undefined).then((ok) => {
                      if (ok) {
                        setShowRejectInput(false);
                        setRejectReason('');
                      }
                    });
                  }}
                >
                  <X size={12} />
                  {t('sharedComponents.artifactApprovalStatusBar.confirmReject')}
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={buttonClass}
                disabled={actionPending}
                onClick={() => setShowRejectInput(true)}
              >
                <X size={12} />
                {t('sharedComponents.artifactApprovalStatusBar.reject')}
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ArtifactApprovalStatusBar;
