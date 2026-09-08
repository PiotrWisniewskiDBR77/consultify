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
import { useTranslation } from 'react-i18next';

import type { MethodQuestion } from '@/method-core/contracts';

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
  const { t } = useTranslation();
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const hasContent = Boolean(
    question.plainLanguageExplanation || question.whyItMatters || question.positiveAnswerExample
  );

  if (!hasContent) {
    return (
      <div
        data-testid="question-help-unavailable"
        className={`rounded-lg border border-c-border-subtle bg-c-surface-raised px-4 py-3 text-sm text-c-text-muted ${className}`}
      >
        {t('methodWorkspace.help.unavailable', 'Help content unavailable')}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`} data-testid="question-help-disclosure">
      {/* Level 1 — inline, always visible */}
      {/* ★ CZYTELNOŚĆ POMOCY (DEC-415c): „Co to znaczy" i „Dlaczego pytamy"
          to zdania czytane przy kliencie, nie metadane — nie schodzą poniżej
          `text-sm`. */}
      <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-4 py-3 space-y-2">
        {question.plainLanguageExplanation && (
          <p className="text-sm leading-relaxed text-c-text">
            <span className="font-medium text-c-text-secondary">{t('methodWorkspace.help.whatItMeans', 'What does this mean? ')}</span>
            {question.plainLanguageExplanation}
          </p>
        )}
        {question.whyItMatters && (
          <p className="text-sm leading-relaxed text-c-text">
            <span className="font-medium text-c-text-secondary">{t('methodWorkspace.help.whyWeAsk', 'Why do we ask? ')}</span>
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
          className="flex min-h-[2.75rem] w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded-lg"
        >
          {t('methodWorkspace.help.examplesAndEvidence', 'Example and evidence')}
          <ChevronDown size={14} className={examplesOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {examplesOpen && (
          <div className="px-4 pb-4 space-y-2 text-sm leading-relaxed text-c-text-secondary">
            {question.positiveAnswerExample && (
              <p>
                <span className="font-medium text-c-success">{t('methodWorkspace.help.exampleConfirming', 'Confirming: ')}</span>
                {question.positiveAnswerExample}
              </p>
            )}
            {question.partialAnswerExample && (
              <p>
                <span className="font-medium text-c-warning">{t('methodWorkspace.help.examplePartial', 'Partial: ')}</span>
                {question.partialAnswerExample}
              </p>
            )}
            {question.negativeAnswerExample && (
              <p>
                <span className="font-medium text-c-text-muted">{t('methodWorkspace.help.exampleNegative', 'Not confirming: ')}</span>
                {question.negativeAnswerExample}
              </p>
            )}
            {question.expectedEvidence.length > 0 && (
              <div>
                <p className="font-medium text-c-text-secondary">
                  {t('methodWorkspace.help.typicalEvidence', 'Typical evidence:')}
                </p>
                <ul className="list-disc list-inside">
                  {question.expectedEvidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {question.commonMisunderstanding && (
              <p>
                <span className="font-medium text-c-text-secondary">{t('methodWorkspace.help.commonMistake', 'Common mistake: ')}</span>
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
            className="flex min-h-[2.75rem] w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded-lg"
          >
            {t('methodWorkspace.help.compareLevels', 'Compare levels')}
            <ChevronDown size={14} className={compareOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          {compareOpen && (
            <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {help.levels.map((level) => (
                <div key={level.level} className="rounded-md border border-c-border-subtle p-3 text-sm">
                  <p className="font-semibold text-c-text">
                    {t('methodWorkspace.help.levelTitle', 'Level {{level}} — {{title}}', {
                      level: level.level,
                      title: level.title,
                    })}
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
          className="inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-c-info hover:bg-c-info/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <Sparkles size={13} />
          {t('methodWorkspace.help.askTeresa', 'Ask Teresa')}
        </button>
        <button
          type="button"
          onClick={() => onAskTeresa('compare_levels')}
          className="inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-c-text-muted hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <MessageCircleQuestion size={13} />
          {t('methodWorkspace.help.showLevelDiff', 'Show the L-1/L/L+1 difference')}
        </button>
      </div>
    </div>
  );
};

export default QuestionHelpDisclosure;
