/**
 * QuestionHelpDisclosure — four progressive levels of help (HELP §3, §6):
 *  1. inline help (always visible — "Co to znaczy?" / "Dlaczego pytamy?")
 *  2. expandable "Przykład i dowody"
 *  3. compare-levels drawer (L-1 / L / L+1)
 *  4. "Rozmawiaj z Teresą" — hands off to the Teresa panel, does not duplicate it.
 *
 * When the Method Pack has no help content for a level of question, this
 * renders an explicit `Help content unavailable` — Teresa must never invent a
 * substitute (HELP §5).
 */
import { ChevronDown, MessageCircleQuestion, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

import type { MethodQuestion } from '@/method-core/contracts';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import type { QuestionHelpContent } from './types';

export interface QuestionHelpDisclosureProps {
  question: MethodQuestion;
  help: QuestionHelpContent | null;
  onAskTeresa: (topic: 'explain' | 'compare_levels' | 'examples') => void;
  className?: string;
}

export const QuestionHelpDisclosure: React.FC<QuestionHelpDisclosureProps> = ({
  question,
  help,
  onAskTeresa,
  className = '',
}) => {
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const rotateTransitionClass = prefersReducedMotion ? '' : 'transition-transform';

  const hasContent = Boolean(
    question.plainLanguageExplanation || question.whyItMatters || question.positiveAnswerExample
  );

  if (!hasContent) {
    return (
      <div
        data-testid="question-help-unavailable"
        className={`rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs text-c-text-muted ${className}`}
      >
        Help content unavailable
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`} data-testid="question-help-disclosure">
      {/* Level 1 — inline, always visible */}
      <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 space-y-1.5">
        {question.plainLanguageExplanation && (
          <p className="text-xs text-c-text">
            <span className="font-medium text-c-text-secondary">Co to znaczy? </span>
            {question.plainLanguageExplanation}
          </p>
        )}
        {question.whyItMatters && (
          <p className="text-xs text-c-text">
            <span className="font-medium text-c-text-secondary">Dlaczego pytamy? </span>
            {question.whyItMatters}
          </p>
        )}
      </div>

      {/* Level 2 — expandable examples */}
      <div className="rounded-lg border border-c-border-subtle">
        <button
          type="button"
          onClick={() => setExamplesOpen((v) => !v)}
          aria-expanded={examplesOpen}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded-lg"
        >
          Przykład i dowody
          <ChevronDown size={14} className={`${examplesOpen ? 'rotate-180' : ''} ${rotateTransitionClass}`} />
        </button>
        {examplesOpen && (
          <div className="px-3 pb-3 space-y-1.5 text-xs text-c-text-secondary">
            {question.positiveAnswerExample && (
              <p>
                <span className="font-medium text-c-success">Potwierdzająca: </span>
                {question.positiveAnswerExample}
              </p>
            )}
            {question.partialAnswerExample && (
              <p>
                <span className="font-medium text-c-warning">Częściowa: </span>
                {question.partialAnswerExample}
              </p>
            )}
            {question.negativeAnswerExample && (
              <p>
                <span className="font-medium text-c-text-muted">Niepotwierdzająca: </span>
                {question.negativeAnswerExample}
              </p>
            )}
            {question.expectedEvidence.length > 0 && (
              <div>
                <p className="font-medium text-c-text-secondary">Typowe dowody:</p>
                <ul className="list-disc list-inside">
                  {question.expectedEvidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {question.commonMisunderstanding && (
              <p>
                <span className="font-medium text-c-text-secondary">Typowy błąd: </span>
                {question.commonMisunderstanding}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Level 3 — compare levels drawer */}
      {help?.levels && help.levels.length > 0 && (
        <div className="rounded-lg border border-c-border-subtle">
          <button
            type="button"
            onClick={() => setCompareOpen((v) => !v)}
            aria-expanded={compareOpen}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded-lg"
          >
            Porównaj poziomy
            <ChevronDown size={14} className={`${compareOpen ? 'rotate-180' : ''} ${rotateTransitionClass}`} />
          </button>
          {compareOpen && (
            <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {help.levels.map((level) => (
                <div key={level.level} className="rounded-md border border-c-border-subtle p-2 text-xs">
                  <p className="font-semibold text-c-text">
                    Poziom {level.level} — {level.title}
                  </p>
                  <p className="text-c-text-secondary mt-1">{level.canonicalDefinition}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Level 4 — conversation with Teresa */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onAskTeresa('explain')}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-c-info hover:bg-c-info/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <Sparkles size={13} />
          Zapytaj Teresę
        </button>
        <button
          type="button"
          onClick={() => onAskTeresa('compare_levels')}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-c-text-muted hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <MessageCircleQuestion size={13} />
          Pokaż różnicę L-1/L/L+1
        </button>
      </div>
    </div>
  );
};

export default QuestionHelpDisclosure;
