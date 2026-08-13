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

import type { TeresaCommitRequest, TeresaPreview, TeresaStatementKind } from '@/method-core/contracts';
import { formatPreviewCellRef } from '@/method-core/teresa';

import type { TeresaSixQuestions } from './types';

export interface TeresaPreviewPanelProps {
  sixQuestions: TeresaSixQuestions;
  /** Pending proposals awaiting a human decision. Empty = queue drained. */
  proposalQueue: readonly TeresaPreview[];
  onCommit: (request: TeresaCommitRequest) => void;
  onTakeLead: () => void;
  onLetMeWorkManually: () => void;
  mode: 'guided_manual' | 'teresa_led';
  className?: string;
}

const STATEMENT_LABEL: Record<TeresaStatementKind, { label: string; tone: string }> = {
  confirmed_fact: { label: 'Fakt potwierdzony', tone: 'text-c-success' },
  respondent_declaration: { label: 'Deklaracja respondenta', tone: 'text-c-info' },
  interpretation: { label: 'Interpretacja', tone: 'text-c-text-secondary' },
  missing_evidence: { label: 'Brakujący dowód', tone: 'text-c-warning' },
  proposal: { label: 'Propozycja', tone: 'text-violet-600 dark:text-violet-400' },
  decision_required: { label: 'Decyzja wymagana', tone: 'text-c-danger' },
};

function renderDiffValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const ProposalCard: React.FC<{ preview: TeresaPreview; onCommit: (r: TeresaCommitRequest) => void }> = ({
  preview,
  onCommit,
}) => {
  const isExpired = new Date(preview.expiresAt).getTime() < Date.now();
  // A commit whose preview carries quality.verdict='invalid' is refused by
  // the server (422 quality_invalid — see TeresaProposalService.commit).
  // Disabling Accept/Accept-with-edits here is defense in depth, not the
  // enforcement point: it saves the human a guaranteed-failing round trip,
  // it does not replace the server's own refusal.
  const isInvalid = preview.quality.verdict === 'invalid';
  const cellRef = formatPreviewCellRef(preview);
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
      // Kanon §7: propozycja AI nie może wyglądać jak treść już zaakceptowana
      // — akcent indigo/violet + jawna etykieta „Propozycja AI”, nigdy
      // neutralny/zielony wygląd zatwierdzonego stanu.
      className="rounded-lg border border-violet-200 dark:border-violet-700/40 bg-violet-50/60 dark:bg-violet-900/10 p-3 space-y-2"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
        <Sparkles size={13} />
        Propozycja AI — {preview.intent.capabilityId}
        {cellRef && (
          <span
            data-testid="teresa-cell-ref"
            className="rounded border border-indigo-300 dark:border-indigo-600/50 bg-indigo-100/70 dark:bg-indigo-900/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-700 dark:text-indigo-300"
            title="Komórka macierzy, której dotyczy ta propozycja (jednostka#poziom)."
          >
            {cellRef}
          </span>
        )}
        {isExpired && (
          <span className="ml-auto inline-flex items-center gap-1 text-c-warning font-medium">
            <AlertTriangle size={12} /> Wygasła
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
          <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">Podgląd zmiany</p>
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
        <p
          data-testid="teresa-quality-flag"
          className={`text-xs flex items-center gap-1 ${isInvalid ? 'text-c-danger' : 'text-c-warning'}`}
        >
          <AlertTriangle size={12} />
          {isInvalid
            ? 'Nie przeszła kontroli jakości — serwer odrzuci każdą decyzję dla tego podglądu. Poproś Teresę o nową propozycję.'
            : 'Wymaga przeglądu człowieka'}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => decide('accept')}
          disabled={isExpired || isInvalid}
          title={isInvalid ? 'Serwer odrzuca KAŻDĄ decyzję na podglądzie o verdict=invalid — ten podgląd jest martwy.' : undefined}
          className="rounded-md border border-c-success/40 bg-c-success/10 px-2 py-1 text-xs font-medium text-c-success hover:bg-c-success/20 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          Zaakceptuj
        </button>
        <button
          type="button"
          onClick={() => decide('accept_with_edits')}
          disabled={isExpired || isInvalid}
          title={isInvalid ? 'Serwer odrzuca KAŻDĄ decyzję na podglądzie o verdict=invalid — ten podgląd jest martwy.' : undefined}
          className="rounded-md border border-c-border px-2 py-1 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          Zaakceptuj z edycją
        </button>
        <button
          type="button"
          onClick={() => decide('reject')}
          disabled={isInvalid}
          title={isInvalid ? 'Serwer odrzuca KAŻDĄ decyzję na podglądzie o verdict=invalid — ten podgląd jest martwy.' : undefined}
          className="rounded-md border border-c-border px-2 py-1 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          Odrzuć
        </button>
        <button
          type="button"
          onClick={() => decide('rethink')}
          disabled={isInvalid}
          title={isInvalid ? 'Serwer odrzuca KAŻDĄ decyzję na podglądzie o verdict=invalid — ten podgląd jest martwy.' : undefined}
          className="rounded-md border border-c-border px-2 py-1 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          Przemyśl ponownie
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
  className = '',
}) => {
  return (
    <aside
      aria-label="Panel współpracy z Teresą"
      data-testid="teresa-preview-panel"
      className={`flex flex-col gap-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-c-text flex items-center gap-1.5">
          <Sparkles size={14} className="text-violet-600 dark:text-violet-400" />
          Teresa
        </h2>
        <button
          type="button"
          onClick={mode === 'teresa_led' ? onLetMeWorkManually : onTakeLead}
          className="rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {mode === 'teresa_led' ? 'Pracuję samodzielnie' : 'Prowadź Ty'}
        </button>
      </div>

      <dl className="space-y-2.5 text-xs">
        <div>
          <dt className="font-medium text-c-text-secondary">Gdzie jesteśmy?</dt>
          <dd className="text-c-text mt-0.5">{sixQuestions.whereAreWe}</dd>
        </div>
        <div>
          <dt className="font-medium text-c-text-secondary">Co teraz jest ważne?</dt>
          <dd className="text-c-text mt-0.5">{sixQuestions.whatMattersNow}</dd>
        </div>
        <div>
          <dt className="font-medium text-c-text-secondary">Dlaczego?</dt>
          <dd className="text-c-text mt-0.5">{sixQuestions.why}</dd>
        </div>
        <div>
          <dt className="font-medium text-c-text-secondary">Czego brakuje?</dt>
          <dd className="text-c-text mt-0.5">{sixQuestions.whatIsMissing}</dd>
        </div>
      </dl>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-c-text-secondary">
          Co proponuje Teresa {proposalQueue.length > 0 ? `(${proposalQueue.length})` : ''}
        </p>
        {proposalQueue.length === 0 ? (
          <p className="text-xs text-c-text-muted rounded-lg border border-dashed border-c-border-subtle px-3 py-4 text-center">
            Brak oczekujących propozycji.
          </p>
        ) : (
          <div className="space-y-2">
            {proposalQueue.map((preview) => (
              <ProposalCard key={preview.previewId} preview={preview} onCommit={onCommit} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
          Najbliższy bezpieczny krok
        </p>
        <p className="text-xs text-c-text mt-1">{sixQuestions.nextSafeAction}</p>
      </div>
    </aside>
  );
};

export default TeresaPreviewPanel;
