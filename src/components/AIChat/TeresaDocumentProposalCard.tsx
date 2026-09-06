/**
 * 1.1-A (06.09) — karta PROPOZYCJI DOKUMENTU w czacie. [ODMROZENIE 13_CHAT DEC-397]
 *
 * Zastępuje dwa zmierzone defekty naraz:
 *   • prośba „zrób mi plan w oknie obok" nie ląduje już jako
 *     `Initiatives · create` (rutowanie naprawione w
 *     `canvasStreamIntentDetector.ts`);
 *   • treść NIE wjeżdża do dokumentu sama — tu jest podgląd i przycisk
 *     „Wstaw do dokumentu" (ZASADY_AI_TERESA_SSOT §3, zakaz auto-apply).
 *
 * Karta nic nie zapisuje: emituje `CANVAS_DOCUMENT_APPLY_EVENT`, którego
 * słucha `WorkCanvasDocumentPanel` (ta sama luźna wiązka zdarzeniowa, co
 * `canvas-stream-request` — bez przeciągania instancji edytora przez drzewo).
 *
 * Kolory: wyłącznie tokeny `c-*` / neutralne. `primary-*` = crimson (pułapka
 * nr 1 kanonu) — nie występuje.
 */

import { Check, FileInput, Replace, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CANVAS_DOCUMENT_APPLY_EVENT,
  type CanvasDocumentApplyDetail,
  type CanvasDocumentApplyMode,
  type CanvasDocumentProposal,
} from './canvasDocumentProposal';

interface TeresaDocumentProposalCardProps {
  proposal: CanvasDocumentProposal;
  onStateChange?: (proposalId: string, state: CanvasDocumentProposal['state']) => void;
}

export const TeresaDocumentProposalCard: React.FC<TeresaDocumentProposalCardProps> = ({
  proposal,
  onStateChange,
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState<CanvasDocumentProposal['state']>(proposal.state);

  const apply = (mode: CanvasDocumentApplyMode) => {
    const detail: CanvasDocumentApplyDetail = {
      markdown: proposal.markdown,
      mode,
      proposalId: proposal.proposalId,
    };
    window.dispatchEvent(new CustomEvent(CANVAS_DOCUMENT_APPLY_EVENT, { detail }));
    setState('applied');
    onStateChange?.(proposal.proposalId, 'applied');
  };

  const reject = () => {
    setState('rejected');
    onStateChange?.(proposal.proposalId, 'rejected');
  };

  const badge =
    state === 'applied'
      ? {
          label: t('aiChat.documentProposal.state.applied', 'Wstawione do dokumentu'),
          className:
            'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
        }
      : state === 'rejected'
        ? {
            label: t('aiChat.documentProposal.state.rejected', 'Odrzucone'),
            className:
              'border-c-border bg-c-surface-raised text-c-text-secondary dark:border-c-border dark:bg-c-surface-raised dark:text-c-text-secondary',
          }
        : {
            label: t('aiChat.documentProposal.state.pending', 'Do zatwierdzenia'),
            className:
              'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
          };

  return (
    <div
      data-testid="teresa-document-proposal"
      data-proposal-state={state}
      className="mt-4 rounded-2xl border border-c-border bg-c-surface p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-c-text-secondary">
            {t('aiChat.documentProposal.heading', 'Propozycja Teresy')}
          </div>
          <div className="truncate text-sm font-semibold text-c-text">{proposal.request}</div>
          <div className="text-xs text-c-text-secondary">
            {t('aiChat.documentProposal.target', 'Dokument obok: {{title}}', {
              title: proposal.documentTitle,
            })}
          </div>
        </div>
        <span
          data-testid="teresa-document-proposal-badge"
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <pre
        data-testid="teresa-document-proposal-preview"
        className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-c-border bg-c-surface-raised p-3 font-sans text-xs leading-relaxed text-c-text-secondary"
      >
        {proposal.markdown}
      </pre>

      {state === 'pending' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="teresa-document-proposal-insert"
            onClick={() => apply('append')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-3 py-1.5 text-xs font-medium text-c-bg transition-colors hover:bg-c-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <FileInput size={13} />
            {t('aiChat.documentProposal.insert', 'Wstaw do dokumentu')}
          </button>

          {proposal.hasSelection && (
            <button
              type="button"
              data-testid="teresa-document-proposal-replace"
              onClick={() => apply('replace')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <Replace size={13} />
              {t('aiChat.documentProposal.replace', 'Zastąp sekcję')}
            </button>
          )}

          <button
            type="button"
            data-testid="teresa-document-proposal-reject"
            onClick={reject}
            className="inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X size={13} />
            {t('aiChat.documentProposal.reject', 'Odrzuć')}
          </button>
        </div>
      )}

      {state === 'applied' && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-c-text-secondary">
          <Check size={13} />
          {t('aiChat.documentProposal.appliedNote', 'Treść jest w dokumencie obok.')}
        </div>
      )}
    </div>
  );
};

export default TeresaDocumentProposalCard;
