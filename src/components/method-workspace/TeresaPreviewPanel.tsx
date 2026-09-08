/**
 * TeresaPreviewPanel — Teresa Collaboration Panel (TOOL-SESSION §8).
 *
 * Always answers six questions (Where are we / What matters now / Why / What
 * is missing / What does Teresa propose / What is the next safe action) and
 * enforces the mandated Intent → Preview → Commit cycle from
 * `src/method-core/contracts/teresa.ts`: nothing commits without a preview,
 * the diff (`before`/`after`) is always shown, and the only ways to resolve a
 * preview are `accept` / `accept_with_edits` / `reject` / `rethink` — a commit
 * request is unrepresentable without a `previewId` at the type level, and this
 * panel never calls `onCommit` without one.
 */
import { AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation, type TFunction } from 'react-i18next';

import type { TeresaCommitRequest, TeresaPreview, TeresaStatementKind } from '@/method-core/contracts';

import type { TeresaSixQuestions } from './types';

export interface TeresaPreviewPanelProps {
  sixQuestions: TeresaSixQuestions;
  /** Pending proposals awaiting a human decision. Empty = queue drained. */
  proposalQueue: readonly TeresaPreview[];
  onCommit: (request: TeresaCommitRequest) => void;
  onTakeLead: () => void;
  onLetMeWorkManually: () => void;
  mode: 'guided_manual' | 'teresa_led';
  readOnly?: boolean;
  className?: string;
}

/** Słownik enumu rodzajów wypowiedzi (PLAN §2 pkt 6) — etykiety z `t()`. */
function etykietyWypowiedzi(t: TFunction): Record<TeresaStatementKind, { label: string; tone: string }> {
  return {
    confirmed_fact: { label: t('methodWorkspace.teresa.statement.confirmedFact', 'Confirmed fact'), tone: 'text-c-success' },
    respondent_declaration: {
      label: t('methodWorkspace.teresa.statement.respondentDeclaration', 'Respondent declaration'),
      tone: 'text-c-info',
    },
    interpretation: { label: t('methodWorkspace.teresa.statement.interpretation', 'Interpretation'), tone: 'text-c-text-secondary' },
    missing_evidence: { label: t('methodWorkspace.teresa.statement.missingEvidence', 'Missing evidence'), tone: 'text-c-warning' },
    proposal: { label: t('methodWorkspace.teresa.statement.proposal', 'Proposal'), tone: 'text-teal-600 dark:text-teal-400' },
    decision_required: { label: t('methodWorkspace.teresa.statement.decisionRequired', 'Decision required'), tone: 'text-c-danger' },
  };
}

function renderDiffValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const ProposalCard: React.FC<{ preview: TeresaPreview; onCommit: (r: TeresaCommitRequest) => void; readOnly?: boolean }> = ({
  preview,
  onCommit,
  readOnly = false,
}) => {
  const { t } = useTranslation();
  const STATEMENT_LABEL = React.useMemo(() => etykietyWypowiedzi(t), [t]);
  const isExpired = new Date(preview.expiresAt).getTime() < Date.now();
  const decide = (decision: TeresaCommitRequest['decision']) => {
    onCommit({
      previewId: preview.previewId,
      decision,
      actorUserId: preview.intent.actorUserId,
      idempotencyKey: `${preview.previewId}:${decision}:${Date.now()}`,
    });
  };

  return (
    <div
      data-testid="teresa-proposal-card"
      data-preview-id={preview.previewId}
      className="rounded-lg border border-teal-200 dark:border-teal-700/40 bg-teal-50/60 dark:bg-teal-900/10 p-3 space-y-2"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300">
        <Sparkles size={13} />
        {t('methodWorkspace.teresa.aiProposal', 'AI proposal')} — {preview.intent.capabilityId}
        {isExpired && (
          <span className="ml-auto inline-flex items-center gap-1 text-c-warning font-medium">
            <AlertTriangle size={12} /> {t('methodWorkspace.teresa.expired', 'Expired')}
          </span>
        )}
      </div>

      <ul className="space-y-1">
        {preview.statements.map((s, i) => (
          <li key={i} className="text-xs">
            <span className={`font-medium ${STATEMENT_LABEL[s.kind].tone}`}>
              {STATEMENT_LABEL[s.kind].label}:
            </span>{' '}
            <span className="text-c-text-secondary">{s.text}</span>
          </li>
        ))}
      </ul>

      {preview.proposedChanges.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-c-border-subtle bg-c-surface p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
            {t('methodWorkspace.teresa.changePreview', 'Change preview')}
          </p>
          {preview.proposedChanges.map((change, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-c-surface-raised px-2 py-1 text-c-text-muted line-through decoration-c-danger/50">
                {renderDiffValue(change.before)}
              </div>
              <div className="rounded bg-c-info/10 px-2 py-1 text-c-info flex items-center gap-1">
                <ArrowRight size={11} className="shrink-0" />
                {renderDiffValue(change.after)}
              </div>
            </div>
          ))}
        </div>
      )}

      {preview.quality.verdict !== 'valid' && (
        <p className="text-xs text-c-warning flex items-center gap-1">
          <AlertTriangle size={12} />
          {preview.quality.verdict === 'invalid'
            ? t('methodWorkspace.teresa.qualityFailed', 'Did not pass the quality check')
            : t('methodWorkspace.teresa.needsHumanReview', 'Needs a human review')}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => decide('accept')}
          disabled={isExpired || readOnly}
          className="rounded-md border border-c-success/40 bg-c-success/10 px-2 py-1 text-xs font-medium text-c-success hover:bg-c-success/20 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {t('methodWorkspace.teresa.accept', 'Accept')}
        </button>
        <button
          type="button"
          onClick={() => decide('accept_with_edits')}
          disabled={isExpired || readOnly}
          className="rounded-md border border-c-border px-2 py-1 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {t('methodWorkspace.teresa.acceptWithEdits', 'Accept with edits')}
        </button>
        <button
          type="button"
          onClick={() => decide('reject')}
          disabled={readOnly}
          className="rounded-md border border-c-border px-2 py-1 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {t('methodWorkspace.teresa.reject', 'Reject')}
        </button>
        <button
          type="button"
          onClick={() => decide('rethink')}
          disabled={readOnly}
          className="rounded-md border border-c-border px-2 py-1 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {t('methodWorkspace.teresa.rethink', 'Rethink')}
        </button>
      </div>
    </div>
  );
};

export const TeresaPreviewPanel: React.FC<TeresaPreviewPanelProps> = ({
  sixQuestions,
  proposalQueue,
  onCommit,
  onTakeLead,
  onLetMeWorkManually,
  mode,
  readOnly = false,
  className = '',
}) => {
  const { t } = useTranslation();
  return (
    <aside
      aria-label={t('methodWorkspace.teresa.panelLabel', 'Teresa collaboration panel')}
      data-testid="teresa-preview-panel"
      className={`flex flex-col gap-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-c-text flex items-center gap-1.5">
          <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
          Teresa
        </h2>
        <button
          type="button"
          onClick={mode === 'teresa_led' ? onLetMeWorkManually : onTakeLead}
          disabled={readOnly}
          className="rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {mode === 'teresa_led'
            ? t('methodWorkspace.teresa.workManually', 'I will work on my own')
            : t('methodWorkspace.teresa.takeLead', 'You take the lead')}
        </button>
      </div>

      <dl className="space-y-2.5 text-xs">
        <div>
          <dt className="font-medium text-c-text-secondary">{t('methodWorkspace.teresa.whereAreWe', 'Where are we?')}</dt>
          <dd className="text-c-text mt-0.5">{sixQuestions.whereAreWe}</dd>
        </div>
        <div>
          <dt className="font-medium text-c-text-secondary">{t('methodWorkspace.teresa.whatMattersNow', 'What matters now?')}</dt>
          <dd className="text-c-text mt-0.5">{sixQuestions.whatMattersNow}</dd>
        </div>
        <div>
          <dt className="font-medium text-c-text-secondary">{t('methodWorkspace.teresa.why', 'Why?')}</dt>
          <dd className="text-c-text mt-0.5">{sixQuestions.why}</dd>
        </div>
        <div>
          <dt className="font-medium text-c-text-secondary">{t('methodWorkspace.teresa.whatIsMissing', 'What is missing?')}</dt>
          <dd className="text-c-text mt-0.5">{sixQuestions.whatIsMissing}</dd>
        </div>
      </dl>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-c-text-secondary">
          {t('methodWorkspace.teresa.whatTeresaProposes', 'What Teresa proposes')}{' '}
          {proposalQueue.length > 0 ? `(${proposalQueue.length})` : ''}
        </p>
        {proposalQueue.length === 0 ? (
          <p className="text-xs text-c-text-muted rounded-lg border border-dashed border-c-border-subtle px-3 py-4 text-center">
            {t('methodWorkspace.teresa.noPendingProposals', 'No pending proposals.')}
          </p>
        ) : (
          <div className="space-y-2">
            {proposalQueue.map((preview) => (
              <ProposalCard key={preview.previewId} preview={preview} onCommit={onCommit} readOnly={readOnly} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
          {t('methodWorkspace.teresa.nextSafeAction', 'Next safe step')}
        </p>
        <p className="text-xs text-c-text mt-1">{sixQuestions.nextSafeAction}</p>
      </div>
    </aside>
  );
};

export default TeresaPreviewPanel;
