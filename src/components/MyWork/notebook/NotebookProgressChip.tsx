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
    'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.08]';
  const pillDisabled =
    'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-white/[0.04] dark:text-slate-500';
  const pillHighlight =
    'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/15';
  const sep = (
    <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 select-none" aria-hidden />
  );

  return (
    <div className="mt-3 flex items-center flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/[0.07] dark:bg-white/[0.03] px-3 py-1.5">
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
          <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        )}
      </button>

      {sep}

      {/* Step 4: Convert */}
      <button
        type="button"
        onClick={onConvert}
        disabled={!canConvertDeliverable}
        title={canConvertDeliverable ? (isPolish ? 'Konwertuj do raportu' : 'Convert to report') : convertBlockedReason}
        className={`${pillBase} ${canConvertDeliverable ? 'bg-navy-900 text-white hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]' : pillDisabled}`}
      >
        <FileOutput size={11} />
        {isPolish ? 'Konwertuj' : 'Convert'}
      </button>

      {/* Handoff buttons */}
      {(onHandoffRadar || onHandoffInitiatives) && (
        <>
          <span className="mx-1 h-3 w-px bg-slate-200 dark:bg-white/[0.07]" />
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
