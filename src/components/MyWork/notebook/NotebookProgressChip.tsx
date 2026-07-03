/**
 * NotebookProgressChip — compact 1-row workflow progress indicator.
 * Replaces NotebookCanonicalPathStrip (4-card layout) with a slim pill strip.
 * L-03: same callbacks as NotebookCanonicalPathStrip, much smaller footprint.
 */
import {
  ChevronRight,
  Eye,
  FileOutput,
  Lightbulb,
  Paperclip,
  Radar,
  Sparkles,
} from 'lucide-react';
import React from 'react';

interface NotebookProgressChipProps {
  isPolish: boolean;
  hasPendingAIProposals: boolean;
  canConvertDeliverable: boolean;
  convertBlockedReason: string;
  onOpenAttachments: () => void;
  onCreateAIProposal: () => void;
  onReviewAIProposal: () => void;
  onConvert: () => void;
  onHandoffRadar?: () => void;
  onHandoffInitiatives?: () => void;
}

export const NotebookProgressChip: React.FC<NotebookProgressChipProps> = ({
  isPolish,
  hasPendingAIProposals,
  canConvertDeliverable,
  convertBlockedReason,
  onOpenAttachments,
  onCreateAIProposal,
  onReviewAIProposal,
  onConvert,
  onHandoffRadar,
  onHandoffInitiatives,
}) => {
  const pillBase =
    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors';
  const pillActive =
    'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised';
  const pillDisabled =
    'cursor-not-allowed bg-c-surface-raised text-c-text-muted';
  const pillHighlight =
    'bg-[var(--c-warning)]/10 text-c-warning hover:bg-[var(--c-warning)]/15';
  const sep = (
    <ChevronRight size={12} className="text-c-text-muted select-none" aria-hidden />
  );

  return (
    <div className="mt-3 flex items-center flex-wrap gap-1.5 rounded-xl border border-c-border bg-c-surface-raised px-3 py-1.5">
      {/* Step 1: Sources */}
      <button
        type="button"
        onClick={onOpenAttachments}
        title={isPolish ? 'Dodaj źródła i załączniki' : 'Add sources and attachments'}
        className={`${pillBase} ${pillActive}`}
      >
        <Paperclip size={11} />
        {isPolish ? 'Źródła' : 'Sources'}
      </button>

      {sep}

      {/* Step 2: AI proposal */}
      <button
        type="button"
        onClick={onCreateAIProposal}
        title={isPolish ? 'Uruchom propozycję AI' : 'Run AI proposal'}
        className={`${pillBase} ${pillActive}`}
      >
        <Sparkles size={11} />
        AI
      </button>

      {sep}

      {/* Step 3: Review */}
      <button
        type="button"
        onClick={onReviewAIProposal}
        disabled={!hasPendingAIProposals}
        title={
          hasPendingAIProposals
            ? isPolish
              ? 'Masz propozycje do review'
              : 'You have proposals to review'
            : isPolish
              ? 'Najpierw utwórz propozycję AI'
              : 'Create an AI proposal first'
        }
        className={`${pillBase} ${hasPendingAIProposals ? pillHighlight : pillDisabled}`}
      >
        <Eye size={11} />
        Review
        {hasPendingAIProposals && (
          <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-c-warning animate-pulse" />
        )}
      </button>

      {sep}

      {/* Step 4: Convert */}
      <button
        type="button"
        onClick={onConvert}
        disabled={!canConvertDeliverable}
        title={canConvertDeliverable ? (isPolish ? 'Konwertuj do raportu' : 'Convert to report') : convertBlockedReason}
        className={`${pillBase} ${canConvertDeliverable ? 'bg-c-accent text-white hover:brightness-110' : pillDisabled}`}
      >
        <FileOutput size={11} />
        {isPolish ? 'Konwertuj' : 'Convert'}
      </button>

      {/* Handoff buttons */}
      {(onHandoffRadar || onHandoffInitiatives) && (
        <>
          <span className="mx-1 h-3 w-px bg-c-border" />
          {onHandoffRadar && (
            <button
              type="button"
              onClick={onHandoffRadar}
              title={isPolish ? 'Prześlij do Radaru' : 'Send to Radar'}
              className={`${pillBase} ${pillActive}`}
            >
              <Radar size={11} />
              Radar
            </button>
          )}
          {onHandoffInitiatives && (
            <button
              type="button"
              onClick={onHandoffInitiatives}
              title={isPolish ? 'Prześlij do Inicjatyw' : 'Send to Initiatives'}
              className={`${pillBase} ${pillActive}`}
            >
              <Lightbulb size={11} />
              {isPolish ? 'Inicjatywy' : 'Initiatives'}
            </button>
          )}
        </>
      )}
    </div>
  );
};
