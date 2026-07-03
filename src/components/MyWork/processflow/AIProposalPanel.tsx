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

import TeresaMark from '../../shared/TeresaMark';
export interface AIProposalOp {
  action: 'create' | 'delete' | 'connect' | 'move' | 'update_label';
  target_id?: string;
  params?: Record<string, unknown>;
}

export interface AIProposal {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  prompt: string;
  summary: string;
  operations: AIProposalOp[];
  risk_flags: string[];
  validation_before: { valid: boolean; issue_count: number };
  validation_after: { valid: boolean; issue_count: number };
  readback_before: string;
  readback_after: string;
  created_at: string;
}

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
  'rounded-xl border border-c-border-subtle bg-c-surface p-3';

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
  isPl,
  onGenerate,
  onAccept,
  onReject,
  onEditPrompt,
  onDismiss,
}) => {
  const [draftPrompt, setDraftPrompt] = useState('');

  useEffect(() => {
    if (proposal?.prompt) setDraftPrompt(proposal.prompt);
  }, [proposal?.id, proposal?.prompt]);

  const t = {
    title: isPl ? 'Propozycja AI' : 'AI proposal',
    promptLabel: isPl ? 'Instrukcja dla AI' : 'AI prompt',
    generate: isPl ? 'Generuj' : 'Generate',
    generating: isPl ? 'Generowanie propozycji…' : 'Generating proposal…',
    summary: isPl ? 'Podsumowanie' : 'Summary',
    ops: isPl ? 'Operacje' : 'Operations',
    risks: isPl ? 'Flagi ryzyka' : 'Risk flags',
    destructive: isPl ? 'Operacje destrukcyjne' : 'Destructive ops',
    before: isPl ? 'Przed' : 'Before',
    after: isPl ? 'Po' : 'After',
    validation: isPl ? 'Wpływ na walidację' : 'Validation impact',
    issues: (n: number) => (isPl ? `${n} problemów` : `${n} issues`),
    improved: isPl ? 'Poprawa' : 'Improved',
    accept: isPl ? 'Akceptuj' : 'Accept',
    reject: isPl ? 'Odrzuć' : 'Reject',
    editPrompt: isPl ? 'Edytuj prompt' : 'Edit prompt',
    dismiss: isPl ? 'Zamknij' : 'Dismiss',
  };

  const pending = proposal?.status === 'pending';
  const improved =
    proposal && proposal.validation_after.issue_count < proposal.validation_before.issue_count;

  return (
    <div className={`flex flex-col gap-3 ${panelShell}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
            {t.title}
          </div>
          <div className="mt-0.5 text-xs font-semibold text-c-text">
            {isPl ? 'Cykl życia propozycji' : 'Proposal lifecycle'}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400">
            <Building2 size={10} />
            {isPl ? 'Kontekst organizacji aktywny' : 'Organization context active'}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1.5 text-c-text-muted hover:bg-c-surface-raised transition-colors"
          title={t.dismiss}
          aria-label={t.dismiss}
        >
          <X size={16} />
        </button>
      </div>

      {error ? (
        <p className="text-xs font-medium text-danger-600 dark:text-danger-400">{error}</p>
      ) : null}

      {isGenerating ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-c-text-secondary">
          <TeresaMark size={28} className="animate-spin text-primary-600 dark:text-primary-400" />
          <span className="text-xs font-medium">{t.generating}</span>
        </div>
      ) : proposal ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-primary-200/80 bg-primary-50/80 px-3 py-2.5 text-xs text-c-text dark:border-primary-500/25 dark:bg-primary-900/15">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-700 dark:text-primary-300">
              {t.summary}
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">{proposal.summary}</p>
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
              {t.ops}
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
                    <span className="font-mono text-[10px] text-c-text-muted">
                      {op.action}
                    </span>
                    {op.target_id ? (
                      <span className="truncate text-c-text-secondary">
                        {op.target_id}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
              {t.risks}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {proposal.risk_flags.map((flag) => (
                <span
                  key={flag}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200"
                >
                  <AlertTriangle size={11} />
                  {flag}
                </span>
              ))}
              {destructiveCount(proposal.operations) > 0 ? (
                <span className="inline-flex items-center rounded-full bg-danger-500/15 px-2 py-0.5 text-[10px] font-bold text-danger-700 dark:text-danger-300">
                  {t.destructive}: {destructiveCount(proposal.operations)}
                </span>
              ) : null}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
              {t.before} / {t.after}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-c-border-subtle bg-c-surface p-2">
                <div className="mb-1 text-[9px] font-bold uppercase text-c-text-secondary">{t.before}</div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-snug text-c-text-secondary">
                  {proposal.readback_before}
                </pre>
              </div>
              <div className="rounded-lg border border-c-border-subtle bg-c-surface p-2">
                <div className="mb-1 text-[9px] font-bold uppercase text-c-text-secondary">{t.after}</div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-snug text-c-text-secondary">
                  {proposal.readback_after}
                </pre>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-c-border-subtle px-2.5 py-2 text-[11px]">
            <span className="text-c-text-secondary">{t.validation}:</span>
            <span className="font-medium text-c-text">
              {t.issues(proposal.validation_before.issue_count)}
            </span>
            <span className="text-c-text-secondary">→</span>
            <span
              className={`font-semibold ${
                improved
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-c-text'
              }`}
            >
              {t.issues(proposal.validation_after.issue_count)}
            </span>
            {improved ? (
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ({t.improved})
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={!pending}
              onClick={onAccept}
              className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Check size={14} />
              {t.accept}
            </button>
            <button
              type="button"
              disabled={!pending}
              onClick={onReject}
              className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl border border-danger-300 bg-danger-50 px-3 py-2 text-xs font-semibold text-danger-700 hover:bg-danger-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-danger-500/40 dark:bg-danger-900/30 dark:text-danger-300 dark:hover:bg-danger-900/50"
            >
              <X size={14} />
              {t.reject}
            </button>
            <button
              type="button"
              onClick={() => onEditPrompt(proposal.prompt)}
              className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl border border-c-border-subtle bg-c-surface px-3 py-2 text-xs font-semibold text-c-text-secondary hover:bg-c-surface-raised"
            >
              <Pencil size={14} />
              {t.editPrompt}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
            {t.promptLabel}
          </label>
          <textarea
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            rows={5}
            className="w-full resize-y rounded-xl border border-c-border-subtle bg-c-surface px-3 py-2 text-xs text-c-text outline-none ring-blue-500/30 placeholder:text-c-text-muted focus:border-blue-400 focus:ring-2 dark:placeholder:text-c-text-muted"
            placeholder={isPl ? 'Opisz zmiany w procesie…' : 'Describe the process changes…'}
          />
          <button
            type="button"
            onClick={() => onGenerate(draftPrompt)}
            disabled={!draftPrompt.trim() || isGenerating}
            className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-primary-500 dark:hover:bg-primary-400"
          >
            <TeresaMark size={14} />
            {t.generate}
          </button>
        </div>
      )}
    </div>
  );
};

export default AIProposalPanel;
