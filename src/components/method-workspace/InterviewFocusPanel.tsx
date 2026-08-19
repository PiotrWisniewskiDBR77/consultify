/**
 * InterviewFocusPanel — the default work screen for one unit (UI-NAV §1.1).
 *
 * One question (or a 2-3 item inseparable sequence), "why we ask", the answer,
 * evidence, Wstecz/Zapisz/Dalej/Pomiń z uzasadnieniem, a discreet "Zapytaj
 * Teresę", and a question breadcrumb — with progressive disclosure so nothing
 * is dumped on screen at once. Manual typing, Teresa's proposals and voice all
 * write into the SAME `answerText`/`answerState` — there is no separate save
 * path per channel (A5 spec, cross-cutting requirement).
 */
import { ArrowLeft, ArrowRight, Paperclip, SkipForward, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

import type { MethodEvidenceState, ResolutionAction, ResolutionCardData } from './types';
import type { InterviewFocusQuestion } from './types';
import { AnswerStateControl } from './AnswerStateControl';
import { QuestionHelpDisclosure } from './QuestionHelpDisclosure';
import { VoiceAnswerChannel } from './VoiceAnswerChannel';

export interface InterviewFocusPanelProps {
  /** Breadcrumb context — axis/pillar, area/dimension, level under consideration. */
  breadcrumb: readonly string[];
  /** The current question, or 2-3 forming one inseparable sequence. */
  questions: readonly InterviewFocusQuestion[];
  questionIndex: number;
  questionTotal: number;
  resolutionData: ResolutionCardData;
  onAnswerChange: (questionId: string, text: string) => void;
  onAnswerStateChange: (questionId: string, state: InterviewFocusQuestion['answerState'], justification?: string) => void;
  onResolutionAction: (questionId: string, action: ResolutionAction) => void;
  onEvidenceDrop: (questionId: string, files: FileList) => void;
  onBack: () => void;
  onSave: () => void;
  onNext: () => void;
  onSkip: (justification: string) => void;
  onAskTeresa: (questionId: string, topic: 'explain' | 'compare_levels' | 'examples') => void;
  canGoBack: boolean;
  canGoNext: boolean;
  readOnly?: boolean;
  className?: string;
}

const EVIDENCE_LABEL: Record<MethodEvidenceState, string> = {
  complete: 'Dowód kompletny',
  weak: 'Dowód słaby',
  missing: 'Brak dowodu',
  conflicting: 'Dowody sprzeczne',
};

export const InterviewFocusPanel: React.FC<InterviewFocusPanelProps> = ({
  breadcrumb,
  questions,
  questionIndex,
  questionTotal,
  resolutionData,
  onAnswerChange,
  onAnswerStateChange,
  onResolutionAction,
  onEvidenceDrop,
  onBack,
  onSave,
  onNext,
  onSkip,
  onAskTeresa,
  canGoBack,
  canGoNext,
  readOnly = false,
  className = '',
}) => {
  const [skipJustification, setSkipJustification] = useState('');
  const [skipping, setSkipping] = useState(false);
  const [dragActive, setDragActive] = useState<string | null>(null);

  const primary = questions[0];
  if (!primary) {
    return (
      <div className="p-6 text-sm text-c-text-muted" data-testid="interview-focus-empty">
        Brak pytań do wyświetlenia w tym obszarze.
      </div>
    );
  }

  return (
    <section
      aria-label="Interview Focus"
      data-testid="interview-focus-panel"
      className={`flex flex-col gap-4 ${className}`}
    >
      {/* Breadcrumb + progress — compact, no visual overload */}
      <div className="flex items-center justify-between gap-3 text-xs text-c-text-muted">
        <nav aria-label="Ścieżka pytania" className="flex items-center gap-1 min-w-0 truncate">
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={crumb}>
              {i > 0 && <span aria-hidden="true">/</span>}
              <span className={i === breadcrumb.length - 1 ? 'text-c-text font-medium' : ''}>{crumb}</span>
            </React.Fragment>
          ))}
        </nav>
        <span className="shrink-0" data-testid="question-progress">
          Pytanie {questionIndex + 1} z {questionTotal}
        </span>
      </div>

      {questions.length > 1 && (
        <p className="text-xs text-c-text-muted -mt-2">
          Te {questions.length} pytania tworzą nierozdzielną sekwencję — odpowiedz na wszystkie razem.
        </p>
      )}

      {questions.map((q) => (
        <div key={q.question.questionId} className="rounded-xl border border-c-border bg-c-surface p-4 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-c-text">{q.question.canonicalWording}</h2>
            {q.question.intent && (
              <p className="text-xs text-c-text-muted mt-1">{q.question.intent}</p>
            )}
          </div>

          <QuestionHelpDisclosure
            question={q.question}
            help={null}
            onAskTeresa={(topic) => onAskTeresa(q.question.questionId, topic)}
          />

          <div className="space-y-2">
            <label className="text-xs font-medium text-c-text-secondary" htmlFor={`answer-${q.question.questionId}`}>
              Twoja odpowiedź
            </label>
            <div className="flex items-start gap-2">
              <textarea
                id={`answer-${q.question.questionId}`}
                value={q.answerText}
                disabled={readOnly}
                onChange={(e) => onAnswerChange(q.question.questionId, e.target.value)}
                rows={3}
                className="flex-1 rounded-lg border border-c-border bg-c-surface p-2.5 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                placeholder="Opisz sytuację własnymi słowami…"
              />
              <VoiceAnswerChannel
                disabled={readOnly}
                onTranscript={(text, isFinal) => {
                  if (isFinal) onAnswerChange(q.question.questionId, `${q.answerText} ${text}`.trim());
                }}
              />
            </div>
          </div>

          <AnswerStateControl
            disabled={readOnly}
            value={q.answerState}
            onChange={(state, justification) => onAnswerStateChange(q.question.questionId, state, justification)}
            resolutionData={{ ...resolutionData, questionId: q.question.questionId }}
            onResolutionAction={(action) => onResolutionAction(q.question.questionId, action)}
          />

          {/* Evidence drop zone */}
          <div
            data-testid="evidence-drop-zone"
            onDragOver={(e) => {
              if (readOnly) return;
              e.preventDefault();
              setDragActive(q.question.questionId);
            }}
            onDragLeave={() => setDragActive(null)}
            onDrop={(e) => {
              if (readOnly) return;
              e.preventDefault();
              setDragActive(null);
              if (e.dataTransfer.files.length > 0) onEvidenceDrop(q.question.questionId, e.dataTransfer.files);
            }}
            className={`flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors ${
              dragActive === q.question.questionId
                ? 'border-c-info bg-c-info/5'
                : 'border-c-border-subtle bg-c-surface-raised'
            }`}
          >
            <span className="flex items-center gap-1.5 text-c-text-secondary">
              <Paperclip size={13} />
              Przeciągnij dowód lub{' '}
              <label className={readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer underline underline-offset-2 hover:text-c-text'}>
                wybierz plik
                <input
                  type="file"
                  disabled={readOnly}
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onEvidenceDrop(q.question.questionId, e.target.files);
                    }
                  }}
                />
              </label>
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                // Kanon TOOL_SESSION_WORKSPACE_STANDARD §7: czerwień WYŁĄCZNIE dla
                // blockera. `weak` i `missing` to ostrzeżenia (amber) — brak dowodu
                // nie jest błędem użytkownika. Czerwień zostaje tylko dla
                // `conflicting`, bo sprzeczne dowody blokują freeze do rozstrzygnięcia
                // (ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md §6, rozbieżność).
                className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${
                  q.evidenceState === 'complete'
                    ? 'bg-c-success/10 text-c-success'
                    : q.evidenceState === 'conflicting'
                      ? 'bg-c-danger/10 text-c-danger'
                      : 'bg-c-warning/10 text-c-warning'
                }`}
              >
                {EVIDENCE_LABEL[q.evidenceState]}
                {q.evidenceCount > 0 ? ` (${q.evidenceCount})` : ''}
              </span>
              {/* Siła dowodu (E0-E4) jest TRZECIĄ, niezależną osią — nie ta sama
                  rzeczy co rollup evidenceState powyżej ani poziom/zatwierdzenie.
                  Neutralny token: siła dowodu opisuje jakość źródła, nie jest
                  sama w sobie ostrzeżeniem. */}
              {q.evidenceStrength && (
                <span
                  data-testid="evidence-strength-badge"
                  title="Siła dowodu E0–E4 (E0 deklaracja … E4 wynik potwierdzony) — niezależna od poziomu i od statusu zatwierdzenia."
                  className="shrink-0 rounded-full border border-c-border px-2 py-0.5 font-medium text-c-text-secondary"
                >
                  Siła dowodu: {q.evidenceStrength}
                </span>
              )}
            </span>
          </div>
        </div>
      ))}

      {/* Command row: Wstecz / Zapisz / Dalej / Pomiń z uzasadnieniem + dyskretne Zapytaj Teresę */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-c-border px-3 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <ArrowLeft size={14} />
          Wstecz
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={readOnly}
          className="inline-flex items-center gap-1.5 rounded-lg border border-c-border px-3 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          Zapisz
        </button>
        {/* Single obvious primary action */}
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-c-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          Dalej
          <ArrowRight size={14} />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => onAskTeresa(primary.question.questionId, 'explain')}
          disabled={readOnly}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-c-info hover:bg-c-info/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <Sparkles size={13} />
          Zapytaj Teresę
        </button>

        {!skipping ? (
          <button
            type="button"
            onClick={() => setSkipping(true)}
            disabled={readOnly}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-c-text-muted hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <SkipForward size={13} />
            Pomiń z uzasadnieniem
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              value={skipJustification}
              onChange={(e) => setSkipJustification(e.target.value)}
              placeholder="Powód pominięcia…"
              className="rounded-md border border-c-border bg-c-surface px-2 py-1 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            />
            <button
              type="button"
              disabled={skipJustification.trim().length === 0}
              onClick={() => {
                onSkip(skipJustification.trim());
                setSkipJustification('');
                setSkipping(false);
              }}
              className="rounded-md border border-c-border px-2 py-1 text-xs font-medium text-c-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              Potwierdź
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default InterviewFocusPanel;
