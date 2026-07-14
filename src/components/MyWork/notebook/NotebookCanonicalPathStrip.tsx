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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <div className="mt-3 rounded-2xl border border-c-border-subtle bg-c-surface-raised px-3 py-3 dark:border-c-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary">
            {t('notebook.canonicalPathStrip.label', 'Canonical notebook path')}
          </div>
          <div className="mt-1 text-[11px] text-c-text-secondary">
            {t(
              'notebook.canonicalPathStrip.label2',
              'Edit the note, add sources, draft an AI proposal, review it, and only then convert.'
            )}
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-c-surface-raised px-2.5 py-1 text-[10px] font-medium text-c-text-secondary dark:bg-navy-800/60 dark:text-c-text-secondary">
          <CheckCircle2 size={11} />
          {hasPendingAIProposals
            ? t('notebook.canonicalPathStrip.label3', 'Review pending')
            : canConvertDeliverable
              ? t('notebook.canonicalPathStrip.label4', 'Ready to convert')
              : t('notebook.canonicalPathStrip.label5', 'Refine content first')}
        </div>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-4">
        <WorkflowStep
          icon={<Paperclip size={13} />}
          title={t('notebook.canonicalPathStrip.title', '1. Add sources')}
          helper={t('notebook.canonicalPathStrip.label6', 'Attach files and source material.')}
          actionLabel={t('notebook.canonicalPathStrip.label7', 'Attachments')}
          onClick={onOpenAttachments}
        />
        <WorkflowStep
          icon={<Sparkles size={13} />}
          title={t('notebook.canonicalPathStrip.title2', '2. Draft AI proposal')}
          helper={t(
            'notebook.canonicalPathStrip.label8',
            'Run an AI action-plan proposal for this note.'
          )}
          actionLabel={t('notebook.canonicalPathStrip.label9', 'AI proposal')}
          onClick={onCreateAIProposal}
        />
        <WorkflowStep
          icon={<CheckCircle2 size={13} />}
          title={t('notebook.canonicalPathStrip.title3', '3. Review proposal')}
          helper={
            hasPendingAIProposals
              ? t(
                  'notebook.canonicalPathStrip.label10',
                  'You have proposals ready to accept or reject.'
                )
              : t('notebook.canonicalPathStrip.label11', 'Create an AI proposal first.')
          }
          actionLabel={t('notebook.canonicalPathStrip.label12', 'Review')}
          onClick={onReviewAIProposal}
          disabled={!hasPendingAIProposals}
        />
        <WorkflowStep
          icon={<FileOutput size={13} />}
          title={t('notebook.canonicalPathStrip.title4', '4. Convert')}
          helper={
            canConvertDeliverable
              ? t(
                  'notebook.canonicalPathStrip.label13',
                  'Convert to a report once the outline is ready.'
                )
              : convertBlockedReason
          }
          actionLabel={t('notebook.canonicalPathStrip.label14', 'To report')}
          onClick={onConvert}
          disabled={!canConvertDeliverable}
        />
      </div>

      {(onHandoffRadar || onHandoffInitiatives) && (
        <div className="mt-3 flex items-center gap-2 border-t border-c-border-subtle/50 pt-3 dark:border-white/[0.06]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
            {t('notebook.canonicalPathStrip.label15', 'Send to:')}
          </span>
          {onHandoffRadar && (
            <button
              type="button"
              onClick={onHandoffRadar}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised px-2.5 py-1 text-[11px] font-medium text-c-text-secondary transition hover:bg-c-surface-raised dark:border-white/[0.07] dark:bg-navy-800/40 dark:text-c-text-secondary dark:hover:bg-white/[0.08]"
            >
              <Radar size={12} />
              Radar
            </button>
          )}
          {onHandoffInitiatives && (
            <button
              type="button"
              onClick={onHandoffInitiatives}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised px-2.5 py-1 text-[11px] font-medium text-c-text-secondary transition hover:bg-c-surface-raised dark:border-white/[0.07] dark:bg-navy-800/40 dark:text-c-text-secondary dark:hover:bg-white/[0.08]"
            >
              <Lightbulb size={12} />
              {t('notebook.canonicalPathStrip.label16', 'Initiatives')}
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
    <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-3 dark:border-white/[0.06] dark:bg-navy-900/40">
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
        className="mt-3 inline-flex items-center gap-1 rounded-full bg-c-text px-2.5 py-1 text-[11px] font-medium text-c-surface transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {props.actionLabel}
        <ArrowRight size={12} />
      </button>
    </div>
  );
}
