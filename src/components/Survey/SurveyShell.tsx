/**
 * SurveyShell (T014)
 * Modern N-mode survey shell with progress tracking, autosave, resume, and focus flow.
 * Supports RTL for Arabic, mobile-first design, and multiple question types.
 */

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface SurveyQuestion {
  id: string;
  order: number;
  text: Record<string, string>;
  type: 'single_choice' | 'multi_choice' | 'scale' | 'free_text';
  options?: Array<{ value: string; label: Record<string, string> }>;
  scaleMin?: number;
  scaleMax?: number;
  required: boolean;
  section?: string;
}

export interface SurveySection {
  id: string;
  title: Record<string, string>;
  questions: SurveyQuestion[];
}

export interface SurveyAnswer {
  questionId: string;
  value: string | number | string[];
}

export interface SurveyShellProps {
  sections: SurveySection[];
  language: string;
  initialAnswers?: SurveyAnswer[];
  initialSectionIndex?: number;
  estimatedMinutes?: number;
  focusMode?: boolean;
  locked?: boolean;
  onAnswer: (answer: SurveyAnswer) => void;
  onSubmit: (answers: SurveyAnswer[]) => void | Promise<void>;
  onAutosave?: (answers: SurveyAnswer[], currentSection: number) => void;
  className?: string;
}

function getInitialFocusPosition(
  sections: SurveySection[],
  initialAnswers: SurveyAnswer[],
  fallbackSectionIndex: number
): { sectionIndex: number; questionIndex: number } {
  const answeredIds = new Set(initialAnswers.map((answer) => answer.questionId));

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const questionIndex = sections[sectionIndex]?.questions.findIndex(
      (question) => !answeredIds.has(question.id)
    );

    if (questionIndex !== undefined && questionIndex >= 0) {
      return { sectionIndex, questionIndex };
    }
  }

  return {
    sectionIndex: Math.max(0, Math.min(fallbackSectionIndex, Math.max(0, sections.length - 1))),
    questionIndex: 0,
  };
}

export const SurveyShell: React.FC<SurveyShellProps> = ({
  sections,
  language,
  initialAnswers = [],
  initialSectionIndex = 0,
  estimatedMinutes,
  focusMode = false,
  locked = false,
  onAnswer,
  onSubmit,
  onAutosave,
  className = '',
}) => {
  const { t } = useTranslation();
  const initialPosition = useMemo(
    () => getInitialFocusPosition(sections, initialAnswers, initialSectionIndex),
    [initialAnswers, initialSectionIndex, sections]
  );
  const [answers, setAnswers] = useState<Map<string, string | number | string[]>>(
    () => new Map(initialAnswers.map((a) => [a.questionId, a.value]))
  );
  const [currentSection, setCurrentSection] = useState(initialPosition.sectionIndex);
  const [focusQuestionIdx, setFocusQuestionIdx] = useState(initialPosition.questionIndex);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRTL = language === 'ar';

  const allQuestions = useMemo(() => sections.flatMap((s) => s.questions), [sections]);

  const answeredCount = useMemo(
    () => allQuestions.filter((q) => answers.has(q.id)).length,
    [allQuestions, answers]
  );

  const totalRequired = useMemo(
    () => allQuestions.filter((q) => q.required).length,
    [allQuestions]
  );

  const progressPct =
    allQuestions.length > 0 ? Math.round((answeredCount / allQuestions.length) * 100) : 0;

  const canSubmit = useMemo(() => {
    const requiredIds = allQuestions.filter((q) => q.required).map((q) => q.id);
    return requiredIds.every((id) => answers.has(id));
  }, [allQuestions, answers]);

  const scheduleAutosave = useCallback(
    (
      latestAnswers: Map<string, string | number | string[]>,
      latestSection: number = currentSection
    ) => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        if (onAutosave) {
          const answerArray = Array.from(latestAnswers.entries()).map(([questionId, value]) => ({
            questionId,
            value,
          }));
          onAutosave(answerArray, latestSection);
        }
      }, 2000);
    },
    [currentSection, onAutosave]
  );

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  const handleAnswer = useCallback(
    (questionId: string, value: string | number | string[]) => {
      if (locked) return;
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(questionId, value);
        scheduleAutosave(next, currentSection);
        return next;
      });
      onAnswer({ questionId, value });
    },
    [currentSection, locked, onAnswer, scheduleAutosave]
  );

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || locked) return;
    setIsSubmitting(true);
    const answerArray = Array.from(answers.entries()).map(([questionId, value]) => ({
      questionId,
      value,
    }));
    try {
      await Promise.resolve(onSubmit(answerArray));
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, locked, answers, onSubmit]);

  const goToSection = useCallback((idx: number) => {
    setCurrentSection(idx);
    setFocusQuestionIdx(0);
  }, []);

  const currentQuestions = sections[currentSection]?.questions || [];

  const focusQuestion = focusMode ? currentQuestions[focusQuestionIdx] : null;

  const nextFocusQuestion = useCallback(() => {
    if (focusQuestionIdx < currentQuestions.length - 1) {
      setFocusQuestionIdx((prev) => prev + 1);
    } else if (currentSection < sections.length - 1) {
      setCurrentSection((prev) => prev + 1);
      setFocusQuestionIdx(0);
    }
  }, [focusQuestionIdx, currentQuestions.length, currentSection, sections.length]);

  const prevFocusQuestion = useCallback(() => {
    if (focusQuestionIdx > 0) {
      setFocusQuestionIdx((prev) => prev - 1);
    } else if (currentSection > 0) {
      const prevSectionQuestions = sections[currentSection - 1]?.questions || [];
      setCurrentSection((prev) => prev - 1);
      setFocusQuestionIdx(Math.max(0, prevSectionQuestions.length - 1));
    }
  }, [focusQuestionIdx, currentSection, sections]);

  const renderQuestion = (question: SurveyQuestion) => {
    const qText = question.text[language] || question.text.en || '';
    const currentValue = answers.get(question.id);

    return (
      <div key={question.id} className="mb-6 last:mb-0">
        <label className="block text-sm font-medium text-c-text-secondary mb-2">
          {qText}
          {question.required && <span className="text-c-danger ml-1">*</span>}
        </label>

        {question.type === 'single_choice' && question.options && (
          <div className="space-y-2">
            {question.options.map((opt) => {
              const optLabel = opt.label[language] || opt.label.en || opt.value;
              const isSelected = currentValue === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={locked}
                  onClick={() => handleAnswer(question.id, opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm
                    ${
                      isSelected
                        ? 'border-c-accent bg-c-accent-soft text-c-accent ring-1 ring-c-accent'
                        : 'border-c-border-subtle hover:border-c-accent text-c-text-secondary'
                    } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                      ${isSelected ? 'border-c-accent bg-c-accent' : 'border-c-border-strong'}`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    {optLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {question.type === 'multi_choice' && question.options && (
          <div className="space-y-2">
            {question.options.map((opt) => {
              const optLabel = opt.label[language] || opt.label.en || opt.value;
              const selectedArr = Array.isArray(currentValue) ? currentValue : [];
              const isSelected = selectedArr.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    const arr = Array.isArray(currentValue) ? [...currentValue] : [];
                    if (isSelected) {
                      handleAnswer(
                        question.id,
                        arr.filter((v) => v !== opt.value)
                      );
                    } else {
                      handleAnswer(question.id, [...arr, opt.value]);
                    }
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm
                    ${
                      isSelected
                        ? 'border-c-accent bg-c-accent-soft text-c-accent'
                        : 'border-c-border-subtle hover:border-c-accent text-c-text-secondary'
                    } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                      ${isSelected ? 'border-c-accent bg-c-accent' : 'border-c-border-strong'}`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    {optLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {question.type === 'scale' && (
          <div className="flex items-center gap-2 flex-wrap">
            {Array.from(
              { length: (question.scaleMax || 5) - (question.scaleMin || 1) + 1 },
              (_, i) => (question.scaleMin || 1) + i
            ).map((val) => {
              const isSelected = currentValue === val;
              return (
                <button
                  key={val}
                  type="button"
                  disabled={locked}
                  onClick={() => handleAnswer(question.id, val)}
                  className={`w-12 h-12 rounded-lg border-2 font-semibold text-sm transition-all
                    ${
                      isSelected
                        ? 'border-c-accent bg-c-accent text-white'
                        : 'border-c-border-subtle hover:border-c-accent text-c-text-muted'
                    } ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {val}
                </button>
              );
            })}
            <span className="text-xs text-c-text-muted ml-2">
              {question.scaleMin || 1} = {t('survey.scaleLow', 'Low')} — {question.scaleMax || 5} ={' '}
              {t('survey.scaleHigh', 'High')}
            </span>
          </div>
        )}

        {question.type === 'free_text' && (
          <textarea
            value={typeof currentValue === 'string' ? currentValue : ''}
            onChange={(e) => handleAnswer(question.id, e.target.value)}
            disabled={locked}
            rows={3}
            placeholder={t('survey.freeTextPlaceholder', 'Type your answer...')}
            className="w-full px-4 py-3 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface
              text-c-text-secondary focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid text-sm
              resize-none disabled:opacity-60"
          />
        )}
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col lg:flex-row min-h-0 ${isRTL ? 'direction-rtl' : ''} ${className}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Left Nav — Section list (hidden in focus mode on mobile) */}
      {!focusMode && (
        <nav className="w-full lg:w-64 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-c-border-subtle bg-c-surface-raised p-4">
          <div className="mb-4">
            <div className="flex items-center gap-2 text-xs text-c-text-muted mb-1">
              <Clock className="w-3 h-3" />
              {estimatedMinutes && (
                <span>
                  ~{estimatedMinutes} {t('survey.minutes', 'min')}
                </span>
              )}
            </div>
            <div className="w-full bg-c-border-subtle rounded-full h-2">
              <div
                className="bg-c-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-c-text-muted mt-1">
              {answeredCount}/{allQuestions.length} ({progressPct}%)
            </p>
          </div>
          <ul className="space-y-1">
            {sections.map((section, idx) => {
              const sectionAnswered = section.questions.filter((q) => answers.has(q.id)).length;
              const sectionTotal = section.questions.length;
              const isComplete = sectionAnswered === sectionTotal;
              const isCurrent = idx === currentSection;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => goToSection(idx)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2
                      ${
                        isCurrent
                          ? 'bg-c-accent-soft text-c-accent font-medium'
                          : 'text-c-text-muted hover:bg-c-surface'
                      }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-c-success flex-shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-c-border-subtle flex-shrink-0" />
                    )}
                    <span className="truncate">{section.title[language] || section.title.en}</span>
                    <span className="ml-auto text-xs text-c-text-muted">
                      {sectionAnswered}/{sectionTotal}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* Canvas — Questions */}
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        {locked && (
          <div className="max-w-2xl mb-6 rounded-xl border border-c-border-subtle bg-c-surface-raised px-4 py-3">
            <div className="font-medium text-c-text">
              {t('survey.readOnlyTitle', 'Read-only mode')}
            </div>
            <div className="mt-1 text-sm text-c-text-muted">
              {t(
                'survey.readOnlyHint',
                'You can review the survey, but answering and submitting are currently disabled.'
              )}
            </div>
          </div>
        )}

        {/* Focus mode — single question */}
        {focusMode && focusQuestion ? (
          <div className="max-w-xl mx-auto">
            <div className="mb-6">
              <div className="w-full bg-c-border-subtle rounded-full h-1.5 mb-2">
                <div
                  className="h-1.5 rounded-full transition-all duration-300 bg-c-info"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-c-text-muted text-center">
                {answeredCount} / {allQuestions.length}
              </p>
            </div>
            {renderQuestion(focusQuestion)}
            <div className="flex items-center justify-between mt-8">
              <button
                type="button"
                onClick={prevFocusQuestion}
                disabled={currentSection === 0 && focusQuestionIdx === 0}
                className="flex items-center gap-1 px-4 py-2 text-sm text-c-text-muted hover:text-c-accent disabled:opacity-40"
              >
                <ArrowLeft className="w-4 h-4" /> {t('survey.back', 'Back')}
              </button>
              {currentSection === sections.length - 1 &&
              focusQuestionIdx === currentQuestions.length - 1 ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  className="flex items-center gap-1 px-6 py-2 text-sm font-medium text-white bg-c-accent rounded-lg
                    hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {t('survey.submit', 'Submit')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextFocusQuestion}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-c-accent hover:opacity-80"
                >
                  {t('survey.next', 'Next')} <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Section view — all questions in current section */}
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-c-text mb-6">
                {sections[currentSection]?.title[language] || sections[currentSection]?.title.en}
              </h2>
              {currentQuestions.map(renderQuestion)}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-c-border-subtle max-w-2xl">
              <button
                type="button"
                onClick={() => goToSection(currentSection - 1)}
                disabled={currentSection === 0}
                className="flex items-center gap-1 px-4 py-2 text-sm text-c-text-muted hover:text-c-accent disabled:opacity-40"
              >
                <ArrowLeft className="w-4 h-4" /> {t('survey.prevSection', 'Previous')}
              </button>

              {currentSection < sections.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goToSection(currentSection + 1)}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-c-accent hover:opacity-80"
                >
                  {t('survey.nextSection', 'Next Section')} <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  className="flex items-center gap-1 px-6 py-2 text-sm font-medium text-white bg-c-accent rounded-lg
                    hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {t('survey.submit', 'Submit')}
                </button>
              )}
            </div>
          </>
        )}
      </main>

      {/* Properties Strip (non-focus mode) */}
      {!focusMode && (
        <aside className="hidden xl:block w-56 flex-shrink-0 border-l border-c-border-subtle bg-c-surface-raised p-4">
          <h3 className="text-xs font-semibold text-c-text-muted uppercase tracking-wider mb-3">
            {t('survey.properties', 'Properties')}
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-c-text-muted text-xs">{t('survey.progress', 'Progress')}</span>
              <p className="font-medium text-c-text-secondary">{progressPct}%</p>
            </div>
            <div>
              <span className="text-c-text-muted text-xs">{t('survey.answered', 'Answered')}</span>
              <p className="font-medium text-c-text-secondary">
                {answeredCount} / {allQuestions.length}
              </p>
            </div>
            <div>
              <span className="text-c-text-muted text-xs">{t('survey.required', 'Required')}</span>
              <p className="font-medium text-c-text-secondary">
                {allQuestions.filter((q) => q.required && answers.has(q.id)).length} /{' '}
                {totalRequired}
              </p>
            </div>
            {estimatedMinutes && (
              <div>
                <span className="text-c-text-muted text-xs">
                  {t('survey.estimatedTime', 'Est. time')}
                </span>
                <p className="font-medium text-c-text-secondary">~{estimatedMinutes} min</p>
              </div>
            )}
            <div>
              <span className="text-c-text-muted text-xs">{t('survey.language', 'Language')}</span>
              <p className="font-medium text-c-text-secondary">{language.toUpperCase()}</p>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
