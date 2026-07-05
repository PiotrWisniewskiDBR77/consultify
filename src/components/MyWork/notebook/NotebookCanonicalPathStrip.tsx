import {
  ArrowRight,
  CheckCircle2,
  FileOutput,
  Lightbulb,
  Paperclip,
  Radar,
  Sparkles,
} from 'lucide-react';
import React from 'react';

interface NotebookCanonicalPathStripProps {
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

export const NotebookCanonicalPathStrip: React.FC<NotebookCanonicalPathStripProps> = ({
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
  return (
    <div className="mt-3 rounded-2xl border border-c-border bg-c-surface-raised px-3 py-3 dark:border-c-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary">
            {isPolish ? 'Kanoniczna ścieżka notatki' : 'Canonical notebook path'}
          </div>
          <div className="mt-1 text-[11px] text-c-text-secondary">
            {isPolish
              ? 'Edytuj notatkę, dodaj źródła, wygeneruj propozycję AI, zrób review i dopiero potem konwertuj.'
              : 'Edit the note, add sources, draft an AI proposal, review it, and only then convert.'}
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-c-surface-raised px-2.5 py-1 text-[10px] font-medium text-c-text-secondary dark:bg-navy-800/60 dark:text-c-text-secondary">
          <CheckCircle2 size={11} />
          {hasPendingAIProposals
            ? isPolish
              ? 'Review czeka'
              : 'Review pending'
            : canConvertDeliverable
              ? isPolish
                ? 'Gotowe do konwersji'
                : 'Ready to convert'
              : isPolish
                ? 'Najpierw dopracuj treść'
                : 'Refine content first'}
        </div>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-4">
        <WorkflowStep
          icon={<Paperclip size={13} />}
          title={isPolish ? '1. Dodaj źródła' : '1. Add sources'}
          helper={
            isPolish ? 'Załącz pliki i materiały wejściowe.' : 'Attach files and source material.'
          }
          actionLabel={isPolish ? 'Attachments' : 'Attachments'}
          onClick={onOpenAttachments}
        />
        <WorkflowStep
          icon={<Sparkles size={13} />}
          title={isPolish ? '2. Zrób propozycję AI' : '2. Draft AI proposal'}
          helper={
            isPolish
              ? 'Uruchom AI action plan dla tej notatki.'
              : 'Run an AI action-plan proposal for this note.'
          }
          actionLabel={isPolish ? 'AI proposal' : 'AI proposal'}
          onClick={onCreateAIProposal}
        />
        <WorkflowStep
          icon={<CheckCircle2 size={13} />}
          title={isPolish ? '3. Review propozycji' : '3. Review proposal'}
          helper={
            hasPendingAIProposals
              ? isPolish
                ? 'Masz propozycje gotowe do akceptacji lub odrzucenia.'
                : 'You have proposals ready to accept or reject.'
              : isPolish
                ? 'Najpierw utwórz propozycję AI.'
                : 'Create an AI proposal first.'
          }
          actionLabel={isPolish ? 'Review' : 'Review'}
          onClick={onReviewAIProposal}
          disabled={!hasPendingAIProposals}
        />
        <WorkflowStep
          icon={<FileOutput size={13} />}
          title={isPolish ? '4. Konwertuj' : '4. Convert'}
          helper={
            canConvertDeliverable
              ? isPolish
                ? 'Konwertuj do raportu, gdy outline jest gotowy.'
                : 'Convert to a report once the outline is ready.'
              : convertBlockedReason
          }
          actionLabel={isPolish ? 'To report' : 'To report'}
          onClick={onConvert}
          disabled={!canConvertDeliverable}
        />
      </div>

      {(onHandoffRadar || onHandoffInitiatives) && (
        <div className="mt-3 flex items-center gap-2 border-t border-c-border/50 pt-3 dark:border-white/[0.06]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
            {isPolish ? 'Przekaż do:' : 'Send to:'}
          </span>
          {onHandoffRadar && (
            <button
              type="button"
              onClick={onHandoffRadar}
              className="inline-flex items-center gap-1 rounded-full border border-c-border bg-c-surface-raised px-2.5 py-1 text-[11px] font-medium text-c-text-secondary transition hover:bg-c-surface-raised dark:border-white/[0.07] dark:bg-navy-800/40 dark:text-c-text-secondary dark:hover:bg-white/[0.08]"
            >
              <Radar size={12} />
              Radar
            </button>
          )}
          {onHandoffInitiatives && (
            <button
              type="button"
              onClick={onHandoffInitiatives}
              className="inline-flex items-center gap-1 rounded-full border border-c-border bg-c-surface-raised px-2.5 py-1 text-[11px] font-medium text-c-text-secondary transition hover:bg-c-surface-raised dark:border-white/[0.07] dark:bg-navy-800/40 dark:text-c-text-secondary dark:hover:bg-white/[0.08]"
            >
              <Lightbulb size={12} />
              {isPolish ? 'Inicjatywy' : 'Initiatives'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

function WorkflowStep(props: {
  icon: React.ReactNode;
  title: string;
  helper: string;
  actionLabel: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-c-border bg-c-surface-raised p-3 dark:border-white/[0.06] dark:bg-navy-900/40">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-c-text-secondary">
        {props.icon}
        {props.title}
      </div>
      <div className="mt-2 min-h-[34px] text-[11px] leading-5 text-c-text-secondary">
        {props.helper}
      </div>
      <button
        type="button"
        onClick={props.onClick}
        disabled={props.disabled}
        className="mt-3 inline-flex items-center gap-1 rounded-full bg-c-accent px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {props.actionLabel}
        <ArrowRight size={12} />
      </button>
    </div>
  );
}
