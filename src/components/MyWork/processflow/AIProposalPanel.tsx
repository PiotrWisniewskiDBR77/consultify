import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Link2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import TeresaMark from '../../shared/TeresaMark';
// M07 F2: the view-model is owned by the hook (single source of truth) —
// the panel re-exports it so existing importers keep working.
import type { AIProposal, AIProposalOp } from './useProcessFlowAIProposal';

export type { AIProposal, AIProposalOp } from './useProcessFlowAIProposal';

export interface AIProposalPanelProps {
  proposal: AIProposal | null;
  isGenerating: boolean;
  error: string | null;
  isPl: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEditPrompt: (prompt: string) => void;
  onDismiss: () => void;
  onGenerate: (prompt: string) => void;
}

const panelShell =
  'rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3';

function opIcon(action: AIProposalOp['action']) {
  switch (action) {
    case 'create':
      return Plus;
    case 'delete':
      return Trash2;
    case 'connect':
      return Link2;
    case 'move':
      return ArrowRight;
    case 'update_label':
      return Pencil;
    default:
      return ChevronRight;
  }
}

function destructiveCount(ops: AIProposalOp[]) {
  return ops.filter((o) => o.action === 'delete').length;
}

export const AIProposalPanel: React.FC<AIProposalPanelProps> = ({
  proposal,
  isGenerating,
  error,
  onGenerate,
  onAccept,
  onReject,
  onEditPrompt,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const [draftPrompt, setDraftPrompt] = useState('');

  useEffect(() => {
    if (proposal?.prompt) setDraftPrompt(proposal.prompt);
  }, [proposal?.id, proposal?.prompt]);

  // Renamed from a local `t` object (would have shadowed react-i18next's `t`).
  const labels = {
    title: t('processFlow.aiProposalPanel.title', 'AI proposal'),
    promptLabel: t('processFlow.aiProposalPanel.promptLabel', 'AI prompt'),
    generate: t('processFlow.aiProposalPanel.generate', 'Generate'),
    generating: t('processFlow.aiProposalPanel.generating', 'Generating proposal…'),
    summary: t('processFlow.aiProposalPanel.summary', 'Summary'),
    ops: t('processFlow.aiProposalPanel.ops', 'Operations'),
    risks: t('processFlow.aiProposalPanel.risks', 'Risk flags'),
    destructive: t('processFlow.aiProposalPanel.destructive', 'Destructive ops'),
    before: t('processFlow.aiProposalPanel.before', 'Before'),
    after: t('processFlow.aiProposalPanel.after', 'After'),
    validation: t('processFlow.aiProposalPanel.validation', 'Validation impact'),
    issues: (n: number) =>
      t('processFlow.aiProposalPanel.issuesCount', '{{value}} issues', { value: n }),
    improved: t('processFlow.aiProposalPanel.improved', 'Improved'),
    accept: t('processFlow.aiProposalPanel.accept', 'Accept'),
    reject: t('processFlow.aiProposalPanel.reject', 'Reject'),
    editPrompt: t('processFlow.aiProposalPanel.editPrompt', 'Edit prompt'),
    dismiss: t('processFlow.aiProposalPanel.dismiss', 'Dismiss'),
  };

  const pending = proposal?.status === 'pending';
  const improved =
    proposal && proposal.validation_after.issue_count < proposal.validation_before.issue_count;

  return (
    <div className={`flex flex-col gap-3 ${panelShell}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
            {labels.title}
          </div>
          <div className="mt-0.5 text-xs font-semibold text-c-text">
            {t('processFlow.aiProposalPanel.lifecycle', 'Proposal lifecycle')}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[9px] text-success-600 dark:text-success-400">
            <Building2 size={10} />
            {t('processFlow.aiProposalPanel.orgContextActive', 'Organization context active')}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1.5 text-c-text-muted hover:bg-c-surface-raised transition-colors"
          title={labels.dismiss}
          aria-label={labels.dismiss}
        >
          <X size={16} />
        </button>
      </div>

      {error ? (
        <p className="text-xs font-medium text-danger-600 dark:text-danger-400">{error}</p>
      ) : null}

      {isGenerating ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-c-text-secondary">
          <TeresaMark size={28} className="animate-spin text-c-text-secondary" />
          <span className="text-xs font-medium">{labels.generating}</span>
        </div>
      ) : proposal ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2.5 text-xs text-c-text">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-c-text-secondary">
              {labels.summary}
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">{proposal.summary}</p>
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
              {labels.ops}
            </div>
            <ul className="flex flex-col gap-1">
              {proposal.operations.map((op, i) => {
                const Icon = opIcon(op.action);
                return (
                  <li
                    key={`${op.action}-${op.target_id ?? i}`}
                    className="flex items-center gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-2 py-1.5 text-[11px]"
                  >
                    <Icon size={14} className="shrink-0 text-c-text-secondary" />
                    <span className="font-mono text-[10px] text-c-text-muted">{op.action}</span>
                    {typeof op.params?.label === 'string' && op.params.label ? (
                      <span className="truncate text-c-text-secondary">{op.params.label}</span>
                    ) : op.target_id ? (
                      <span className="truncate text-c-text-secondary">{op.target_id}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          {proposal.risk_flags.length > 0 || destructiveCount(proposal.operations) > 0 ? (
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                {labels.risks}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {proposal.risk_flags.map((flag) => (
                  <span
                    key={flag}
                    className="inline-flex items-center gap-1 rounded-full bg-warning-500/15 px-2 py-0.5 text-[10px] font-semibold text-warning-800 dark:text-warning-200"
                  >
                    <AlertTriangle size={11} />
                    {flag}
                  </span>
                ))}
                {destructiveCount(proposal.operations) > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-danger-500/15 px-2 py-0.5 text-[10px] font-bold text-danger-700 dark:text-danger-300">
                    {labels.destructive}: {destructiveCount(proposal.operations)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
              {labels.before} / {labels.after}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-2">
                <div className="mb-1 text-[9px] font-bold uppercase text-c-text-secondary">
                  {labels.before}
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-snug text-c-text-secondary">
                  {proposal.readback_before}
                </pre>
              </div>
              <div className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-2">
                <div className="mb-1 text-[9px] font-bold uppercase text-c-text-secondary">
                  {labels.after}
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-snug text-c-text-secondary">
                  {proposal.readback_after}
                </pre>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-c-border-subtle px-2.5 py-2 text-[11px]">
            <span className="text-c-text-secondary">{labels.validation}:</span>
            <span className="font-medium text-c-text">
              {labels.issues(proposal.validation_before.issue_count)}
            </span>
            <span className="text-c-text-secondary">→</span>
            <span
              className={`font-semibold ${
                improved ? 'text-success-600 dark:text-success-400' : 'text-c-text'
              }`}
            >
              {labels.issues(proposal.validation_after.issue_count)}
            </span>
            {improved ? (
              <span className="text-[10px] font-semibold text-success-600 dark:text-success-400">
                ({labels.improved})
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={!pending}
              onClick={onAccept}
              className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl bg-success-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-success-600 dark:hover:bg-success-500"
            >
              <Check size={14} />
              {labels.accept}
            </button>
            <button
              type="button"
              disabled={!pending}
              onClick={onReject}
              className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl border border-danger-300 bg-danger-50 px-3 py-2 text-xs font-semibold text-danger-700 hover:bg-danger-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-danger-500/40 dark:bg-danger-900/30 dark:text-danger-300 dark:hover:bg-danger-900/50"
            >
              <X size={14} />
              {labels.reject}
            </button>
            <button
              type="button"
              onClick={() => onEditPrompt(proposal.prompt)}
              className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl border border-c-border-subtle bg-c-surface px-3 py-2 text-xs font-semibold text-c-text-secondary hover:bg-c-surface-raised"
            >
              <Pencil size={14} />
              {labels.editPrompt}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
            {labels.promptLabel}
          </label>
          <textarea
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            rows={5}
            className="w-full resize-y rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none ring-c-info placeholder:text-c-text-muted focus:border-c-info focus:ring-2 dark:placeholder:text-c-text-muted"
            placeholder={t(
              'processFlow.aiProposalPanel.promptPlaceholder',
              'Describe the process changes…'
            )}
          />
          <button
            type="button"
            onClick={() => onGenerate(draftPrompt)}
            disabled={!draftPrompt.trim() || isGenerating}
            className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl bg-c-text px-4 py-2 text-xs font-semibold text-c-surface shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <TeresaMark size={14} />
            {labels.generate}
          </button>
        </div>
      )}
    </div>
  );
};

export default AIProposalPanel;
