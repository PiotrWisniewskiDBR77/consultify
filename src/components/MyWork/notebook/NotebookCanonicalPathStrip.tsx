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
    <div className="mt-3 rounded-2xl border border-indigo-200/70 bg-indigo-50/80 px-3 py-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">
            {isPolish ? 'Kanoniczna ścieżka notatki' : 'Canonical notebook path'}
          </div>
          <div className="mt-1 text-[11px] text-indigo-700/80 dark:text-indigo-200/80">
            {isPolish
              ? 'Edytuj notatkę, dodaj źródła, wygeneruj propozycję AI, zrób review i dopiero potem konwertuj.'
              : 'Edit the note, add sources, draft an AI proposal, review it, and only then convert.'}
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
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
        <div className="mt-3 flex items-center gap-2 border-t border-indigo-200/50 pt-3 dark:border-indigo-500/15">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600/70 dark:text-indigo-300/60">
            {isPolish ? 'Przekaż do:' : 'Send to:'}
          </span>
          {onHandoffRadar && (
            <button
              type="button"
              onClick={onHandoffRadar}
              className="inline-flex items-center gap-1 rounded-full border border-indigo-200/70 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-500/20 dark:bg-navy-950/40 dark:text-indigo-300 dark:hover:bg-indigo-500/15"
            >
              <Radar size={12} />
              Radar
            </button>
          )}
          {onHandoffInitiatives && (
            <button
              type="button"
              onClick={onHandoffInitiatives}
              className="inline-flex items-center gap-1 rounded-full border border-indigo-200/70 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-500/20 dark:bg-navy-950/40 dark:text-indigo-300 dark:hover:bg-indigo-500/15"
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
    <div className="rounded-xl border border-indigo-200/70 bg-white/80 p-3 dark:border-indigo-400/15 dark:bg-navy-950/40">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
        {props.icon}
        {props.title}
      </div>
      <div className="mt-2 min-h-[34px] text-[11px] leading-5 text-slate-600 dark:text-slate-300">
        {props.helper}
      </div>
      <button
        type="button"
        onClick={props.onClick}
        disabled={props.disabled}
        className="mt-3 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
      >
        {props.actionLabel}
        <ArrowRight size={12} />
      </button>
    </div>
  );
}
