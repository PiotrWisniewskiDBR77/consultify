/**
 * StandardQuestion — SPEC-Q, the 4th canonical artifact format of Consultify
 * (alongside SPEC-L / list-table, SPEC-A / artifact, SPEC-I). It is the ONE
 * card that renders any diagnostic question — Interview, DRD, Assessment,
 * Audit — so the 5 divergent question code-paths collapse into a single,
 * frozen presentation contract. The module DECLARES the question; this
 * component IMPOSES the look (exactly the standard/ doctrine: StandardTable is
 * to lists what StandardQuestion is to questions).
 *
 * DESIGN SOURCE — richness parity with the richest question today
 * (`src/components/Interview/InterviewSingleQuestionRuntime.tsx`): pulsing
 * lightbulb → collapsed guidance (hint + example + evidence prompt, remembered
 * in localStorage so the pulse never nags twice), AI deep-dive, inline
 * evidence + links, per-input-type answer surfaces. Here it is distilled into
 * a PURE presentational component: props in, JSX out — no store, no API, no
 * context, no upload logic. Side-effectful handlers (attach / link / Teresa /
 * deep-dive) are STUBS the host wires; this component only calls them.
 *
 * SPEC-Q ANATOMY — 5 layers, always in this order:
 *   1. RDZEŃ (core)     — counter · question text · "po co pytamy" context ·
 *                         pulsing-lightbulb guidance (hint + example + evidence)
 *   2. AI               — "Zapytaj Teresę" + optional deep-dive chips
 *   3. OCENA (rubric)   — maturity LADDER (each rung shows label + definition +
 *                         example + boundary-vs-prev — the cure for "za mało
 *                         info żeby wybrać poziom") and/or a scoring rubric
 *   4. WEJŚCIE (input)  — per inputType: text | level | scale | choice
 *   5. DOWODY + NAWIGACJA — evidence buttons · Wstecz / Dalej / Pomiń · "zapisano"
 *
 * COLOR DOCTRINE (hard — mirrors DRDLightShell/ExecutionLightShell, enforced by
 * check-triada.sh / check-artefakt.sh):
 *   - `c-accent` (Harvard Crimson) is reserved for critical semantics — NOT
 *     used here for CTA/selected. Selected rung / active answer = the BLUE
 *     focus token (`--c-focus-solid`). Focus ring = `c-focus`, never crimson.
 *   - Primary CTA is neutral (`bg-c-text text-c-surface`). No `primary-*`
 *     tokens anywhere (those are crimson).
 *   - All colors via c-* tokens; both light + dark adapt automatically.
 */
import {
  ArrowLeft,
  ArrowRight,
  Check,
  HelpCircle,
  Info,
  Lightbulb,
  Link2,
  Paperclip,
  SkipForward,
  Sparkles,
  Target,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

// Blue selection tokens — identical to the *LightShell doctrine. Never crimson.
const BLUE = 'rgb(var(--c-focus-solid-rgb))';
const BLUE_SOFT = 'rgb(var(--c-focus-solid-rgb) / 0.10)';

export type QuestionInputType = 'text' | 'level' | 'scale' | 'choice';

export interface QuestionLevel {
  n: number;
  label: string;
  definition: string;
  example?: string;
  /** What distinguishes THIS rung from the one below — the boundary that makes
   *  a maturity level pickable without guessing. */
  boundaryVsPrev?: string;
}

export interface QuestionRubricRow {
  criterion: string;
  maxPoints: number;
  descriptor?: string;
}

export interface StandardQuestionModel {
  id: string;
  text: string;
  /** Why we ask — shown as a subtitle under the question. */
  context?: string;
  /** Guidance under the pulsing lightbulb. */
  hint?: string;
  exampleAnswer?: string;
  /** What to attach as evidence. */
  evidencePrompt?: string;
  inputType: QuestionInputType;
  /** Maturity ladder — required for inputType='level', optional context elsewhere. */
  levels?: QuestionLevel[];
  /** Optional scoring rubric. */
  rubric?: QuestionRubricRow[];
  aiDeepDiveEnabled?: boolean;
}

export interface StandardQuestionProps {
  question: StandardQuestionModel;
  isPolish: boolean;
  value?: string | number;
  onChange?: (v: string | number) => void;
  /** Stub handlers — the component never uploads; it only calls these. */
  onAttach?: () => void;
  onAddLink?: () => void;
  onAskTeresa?: (q: StandardQuestionModel) => void;
  onDeepDive?: (q: StandardQuestionModel) => void;
  // Optional navigation.
  index?: number;
  total?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onSkip?: () => void;
  saved?: boolean;
}

type AnswerState = 'untouched' | 'in_progress' | 'answered' | 'skipped';

// ── Small shared primitives ────────────────────────────────────────────────

/** Neutral chip button (AI actions, evidence). Never crimson. */
const ChipButton: React.FC<{
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  title?: string;
}> = ({ onClick, icon, label, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text-secondary transition-colors hover:border-c-border-strong hover:text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
  >
    {icon}
    {label}
  </button>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
    {children}
  </div>
);

// ── Component ───────────────────────────────────────────────────────────────

export const StandardQuestion: React.FC<StandardQuestionProps> = ({
  question,
  isPolish,
  value,
  onChange,
  onAttach,
  onAddLink,
  onAskTeresa,
  onDeepDive,
  index,
  total,
  onPrev,
  onNext,
  onSkip,
  saved = false,
}) => {
  const t = (pl: string, en: string) => (isPolish ? pl : en);

  // Guidance disclosure — pulsing lightbulb, remembered per question id.
  const guidanceKey = `sq_guidance_seen_${question.id}`;
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceSeen, setGuidanceSeen] = useState(false);

  useEffect(() => {
    setGuidanceOpen(false);
    try {
      setGuidanceSeen(localStorage.getItem(guidanceKey) === '1');
    } catch {
      setGuidanceSeen(false);
    }
  }, [guidanceKey]);

  const toggleGuidance = useCallback(() => {
    setGuidanceOpen((prev) => {
      const next = !prev;
      if (next && !guidanceSeen) {
        setGuidanceSeen(true);
        try {
          localStorage.setItem(guidanceKey, '1');
        } catch {
          /* ignore quota / privacy mode */
        }
      }
      return next;
    });
  }, [guidanceKey, guidanceSeen]);

  const hasGuidance =
    !!question.hint || !!question.exampleAnswer || !!question.evidencePrompt;

  // Answer state (visual only — derived from value + skip).
  const [skipped, setSkipped] = useState(false);
  const answerState: AnswerState = skipped
    ? 'skipped'
    : value !== undefined && value !== '' && value !== null
      ? 'answered'
      : 'untouched';

  const handleSkip = useCallback(() => {
    setSkipped(true);
    onSkip?.();
  }, [onSkip]);

  const stateBadge = (() => {
    switch (answerState) {
      case 'answered':
        return {
          label: t('Odpowiedziane', 'Answered'),
          cls: 'text-c-success',
          icon: <Check size={12} />,
        };
      case 'skipped':
        return {
          label: t('Pominięte', 'Skipped'),
          cls: 'text-c-text-muted',
          icon: <SkipForward size={12} />,
        };
      default:
        return {
          label: t('Bez odpowiedzi', 'Unanswered'),
          cls: 'text-c-text-muted',
          icon: <Info size={12} />,
        };
    }
  })();

  const levels = question.levels ?? [];

  // ── LAYER 4: input surface, per inputType ─────────────────────────────────
  const renderInput = () => {
    switch (question.inputType) {
      case 'level':
      case 'choice':
        // The ladder (Layer 3) is the selection surface for 'level'. For
        // 'choice' the same rung list acts as radio options. A justification
        // field accompanies 'level'.
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              {levels.map((lvl) => {
                const selected = String(value) === String(lvl.n);
                return (
                  <button
                    key={lvl.n}
                    type="button"
                    onClick={() => onChange?.(lvl.n)}
                    className="flex w-full gap-3 rounded-xl border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-c-focus"
                    style={{
                      borderColor: selected ? BLUE : 'var(--c-border)',
                      background: selected ? BLUE_SOFT : 'var(--c-surface)',
                    }}
                  >
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
                      style={{
                        borderColor: selected ? BLUE : 'var(--c-border-strong)',
                        color: selected ? BLUE : 'var(--c-text-secondary)',
                        background: selected ? 'var(--c-surface)' : 'transparent',
                      }}
                    >
                      {selected ? <Check size={13} /> : lvl.n}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-c-text">
                        {lvl.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-c-text-secondary">
                        {lvl.definition}
                      </span>
                      {lvl.example && (
                        <span className="mt-1 block text-xs leading-relaxed text-c-text-muted">
                          <span className="font-medium">{t('Przykład', 'Example')}:</span>{' '}
                          {lvl.example}
                        </span>
                      )}
                      {lvl.boundaryVsPrev && (
                        <span className="mt-1 flex items-start gap-1 text-[11px] leading-relaxed text-c-text-muted">
                          <Target size={11} className="mt-0.5 shrink-0" />
                          <span>
                            <span className="font-medium">
                              {t('Granica względem niższego', 'Boundary vs. lower')}:
                            </span>{' '}
                            {lvl.boundaryVsPrev}
                          </span>
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {question.inputType === 'level' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-c-text-secondary">
                  {t('Uzasadnienie wyboru', 'Justification for the choice')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t(
                    'Dlaczego ten poziom? Na czym opierasz ocenę…',
                    'Why this level? What is the assessment based on…'
                  )}
                  className="w-full resize-none rounded-xl border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
                />
              </div>
            )}
          </div>
        );

      case 'scale': {
        const opts = [1, 2, 3, 4, 5];
        return (
          <div className="flex flex-wrap items-center gap-2">
            {opts.map((n) => {
              const selected = String(value) === String(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange?.(n)}
                  className="h-11 w-11 rounded-xl border text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-c-focus"
                  style={{
                    borderColor: selected ? BLUE : 'var(--c-border)',
                    background: selected ? BLUE_SOFT : 'var(--c-surface)',
                    color: selected ? BLUE : 'var(--c-text-secondary)',
                  }}
                >
                  {n}
                </button>
              );
            })}
            <span className="ml-1 text-xs text-c-text-muted">
              {t('1 = niski · 5 = wysoki', '1 = low · 5 = high')}
            </span>
          </div>
        );
      }

      case 'text':
      default:
        return (
          <div className="rounded-xl border border-c-border bg-c-surface">
            <textarea
              rows={5}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder={t(
                'Wpisz odpowiedź…',
                'Write the answer…'
              )}
              className="w-full resize-none rounded-t-xl bg-transparent px-3 py-2.5 text-sm text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
            {/* Mini composer toolbar — stub actions (record / attach / link). */}
            <div className="flex items-center gap-1 border-t border-c-border px-2 py-1.5">
              <ChipButton
                onClick={onAttach}
                icon={<Paperclip size={13} />}
                label={t('Załącznik', 'Attachment')}
              />
              <ChipButton
                onClick={onAddLink}
                icon={<Link2 size={13} />}
                label={t('Link', 'Link')}
              />
            </div>
          </div>
        );
    }
  };

  // ── LAYER 3: rubric (scoring) — ladder is rendered inside the input above ──
  const showRubric = !!question.rubric && question.rubric.length > 0;
  // For non-level inputs that still carry a ladder (reference), show it read-only.
  const showReferenceLadder =
    levels.length > 0 &&
    question.inputType !== 'level' &&
    question.inputType !== 'choice';

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-c-border bg-c-surface-raised p-5 shadow-sm sm:p-6">
      {/* ── LAYER 1: RDZEŃ (core) ── */}
      <div className="flex items-start justify-between gap-3">
        {index !== undefined && total !== undefined && (
          <span className="rounded-full bg-c-surface px-2.5 py-1 text-xs font-medium text-c-text-secondary">
            {t('Pytanie', 'Question')} {index}
            <span className="text-c-text-muted"> / {total}</span>
          </span>
        )}
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${stateBadge.cls}`}>
          {stateBadge.icon}
          {stateBadge.label}
        </span>
      </div>

      <h2
        className="mt-3 text-lg font-semibold leading-snug text-c-text"
        style={{ textWrap: 'balance' } as React.CSSProperties}
      >
        {question.text}
      </h2>

      {question.context && (
        <p className="mt-1.5 text-sm leading-relaxed text-c-text-secondary">
          <span className="font-medium text-c-text-muted">{t('Po co pytamy', 'Why we ask')}:</span>{' '}
          {question.context}
        </p>
      )}

      {/* Pulsing-lightbulb guidance disclosure */}
      {hasGuidance && (
        <div className="mt-3">
          <button
            type="button"
            onClick={toggleGuidance}
            className="inline-flex items-center gap-2 rounded-lg border border-c-border bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text-secondary transition-colors hover:text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <Lightbulb
              size={14}
              className={!guidanceSeen ? 'animate-pulse text-c-warning' : 'text-c-text-muted'}
            />
            {guidanceOpen
              ? t('Ukryj wskazówkę i przykład', 'Hide guidance and example')
              : t('Pokaż wskazówkę i przykład', 'Show guidance and example')}
          </button>

          {guidanceOpen && (
            <div className="mt-2 space-y-2 rounded-xl border border-c-border bg-c-surface p-3 text-sm">
              {question.hint && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                    {t('Wskazówka', 'Guidance')}
                  </div>
                  <p className="mt-0.5 leading-relaxed text-c-text-secondary">{question.hint}</p>
                </div>
              )}
              {question.exampleAnswer && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                    {t('Przykładowa odpowiedź', 'Example answer')}
                  </div>
                  <p className="mt-0.5 leading-relaxed text-c-text-secondary">
                    {question.exampleAnswer}
                  </p>
                </div>
              )}
              {question.evidencePrompt && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                    {t('Co podłączyć jako dowód', 'What to attach as evidence')}
                  </div>
                  <p className="mt-0.5 leading-relaxed text-c-text-secondary">
                    {question.evidencePrompt}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LAYER 2: AI ── */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ChipButton
          onClick={() => onAskTeresa?.(question)}
          icon={<Sparkles size={13} />}
          label={t('Zapytaj Teresę', 'Ask Teresa')}
          title={t('Zapytaj asystenta AI o to pytanie', 'Ask the AI assistant about this question')}
        />
        {question.aiDeepDiveEnabled && (
          <ChipButton
            onClick={() => onDeepDive?.(question)}
            icon={<HelpCircle size={13} />}
            label={t('Wyjaśnij głębiej', 'Explain deeper')}
            title={t('Rozwiń pytanie z przykładami', 'Expand the question with examples')}
          />
        )}
      </div>

      {/* ── LAYER 3: OCENA (rubric / reference ladder) ── */}
      {(showRubric || showReferenceLadder) && (
        <div className="mt-5">
          <SectionLabel>{t('Ocena', 'Assessment')}</SectionLabel>
          {showReferenceLadder && (
            <div className="mb-3 space-y-1.5">
              {levels.map((lvl) => (
                <div
                  key={lvl.n}
                  className="rounded-lg border border-c-border bg-c-surface px-3 py-2"
                >
                  <span className="text-sm font-medium text-c-text">
                    {lvl.n}. {lvl.label}
                  </span>
                  <p className="mt-0.5 text-xs leading-relaxed text-c-text-secondary">
                    {lvl.definition}
                  </p>
                </div>
              ))}
            </div>
          )}
          {showRubric && (
            <div className="overflow-hidden rounded-xl border border-c-border">
              {question.rubric!.map((row, i) => (
                <div
                  key={row.criterion}
                  className={`flex items-start justify-between gap-3 px-3 py-2 ${
                    i > 0 ? 'border-t border-c-border' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-c-text">{row.criterion}</div>
                    {row.descriptor && (
                      <div className="mt-0.5 text-xs leading-relaxed text-c-text-muted">
                        {row.descriptor}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 rounded-md bg-c-surface px-2 py-0.5 text-xs font-semibold text-c-text-secondary">
                    {t('maks.', 'max')} {row.maxPoints}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LAYER 4: WEJŚCIE (input) ── */}
      <div className="mt-5">
        <SectionLabel>
          {question.inputType === 'level'
            ? t('Wybierz poziom dojrzałości', 'Choose the maturity level')
            : t('Odpowiedź', 'Answer')}
        </SectionLabel>
        {renderInput()}
      </div>

      {/* ── LAYER 5: DOWODY + NAWIGACJA ── */}
      <div className="mt-5 border-t border-c-border pt-4">
        <SectionLabel>{t('Dowody', 'Evidence')}</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          <ChipButton
            onClick={onAttach}
            icon={<Paperclip size={13} />}
            label={t('Dodaj załącznik', 'Add attachment')}
          />
          <ChipButton
            onClick={onAddLink}
            icon={<Link2 size={13} />}
            label={t('Dodaj link', 'Add link')}
          />
        </div>

        {(onPrev || onNext || onSkip) && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={!onPrev}
              className="inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm font-medium text-c-text-secondary transition-colors hover:text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus disabled:opacity-40"
            >
              <ArrowLeft size={15} />
              {t('Wstecz', 'Back')}
            </button>

            <div className="flex items-center gap-2">
              {saved && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-c-success">
                  <Check size={13} />
                  {t('zapisano', 'saved')}
                </span>
              )}
              {onSkip && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-c-text-muted transition-colors hover:text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                >
                  <SkipForward size={15} />
                  {t('Pomiń', 'Skip')}
                </button>
              )}
              <button
                type="button"
                onClick={onNext}
                disabled={!onNext}
                // Neutral CTA — bg-c-text/text-c-surface, never crimson primary-*.
                className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-4 py-2 text-sm font-semibold text-c-surface transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-c-focus disabled:opacity-40"
              >
                {t('Dalej', 'Next')}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StandardQuestion;
