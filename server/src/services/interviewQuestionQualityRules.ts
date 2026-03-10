/**
 * interviewQuestionQualityRules — V6-B04 Question Quality Evaluator
 *
 * Pure function module: no DB, no AI, instant deterministic evaluation.
 * Lints interview template questions and returns actionable warnings.
 */

export interface QualityWarning {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: { en: string; pl: string };
  suggestion?: { en: string; pl: string };
}

export interface QuestionQualityResult {
  questionId: string;
  score: number; // 0-100
  warnings: QualityWarning[];
}

export function evaluateQuestionQuality(params: {
  questionText: string;
  answerType: string;
  answerOptions?: string[];
  isRequired?: boolean;
  helpHint?: string;
}): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  const text = params.questionText.trim();

  // Rule 1: Too short
  if (text.length < 10) {
    warnings.push({
      ruleId: 'too_short',
      severity: 'error',
      message: { en: 'Question is too short (min 10 chars)', pl: 'Pytanie jest za krótkie (min 10 znaków)' },
    });
  }

  // Rule 2: Too long
  if (text.length > 500) {
    warnings.push({
      ruleId: 'too_long',
      severity: 'warning',
      message: { en: 'Question is very long — consider splitting', pl: 'Pytanie jest bardzo długie — rozważ podział' },
    });
  }

  // Rule 3: Double-barreled (multiple question marks = multiple questions)
  if (text.includes('?') && text.split('?').length > 2) {
    warnings.push({
      ruleId: 'double_barreled',
      severity: 'warning',
      message: {
        en: 'Multiple questions detected — split into separate questions',
        pl: 'Wykryto wiele pytań — podziel na osobne pytania',
      },
    });
  }

  // Rule 4: Leading question
  const leadingPatterns = [
    /^(don't you think|wouldn't you say|isn't it true|czy nie uważasz|czy nie sądzisz|prawda że)/i,
    /^(surely|obviously|clearly|oczywiście|z pewnością)/i,
  ];
  if (leadingPatterns.some((p) => p.test(text))) {
    warnings.push({
      ruleId: 'leading',
      severity: 'warning',
      message: { en: 'Question may be leading — rephrase neutrally', pl: 'Pytanie może być sugerujące — przeformułuj neutralnie' },
    });
  }

  // Rule 5: Missing question mark
  if (!text.endsWith('?') && !text.endsWith('...') && text.length > 20) {
    warnings.push({
      ruleId: 'no_question_mark',
      severity: 'info',
      message: { en: 'Consider ending with a question mark', pl: 'Rozważ zakończenie znakiem zapytania' },
    });
  }

  // Rule 6: Choice question without enough options
  const choiceTypes = ['single_choice', 'multi_choice', 'dropdown', 'select'];
  if (choiceTypes.includes(params.answerType) && (!params.answerOptions || params.answerOptions.length < 2)) {
    warnings.push({
      ruleId: 'missing_options',
      severity: 'error',
      message: { en: 'Choice question needs at least 2 options', pl: 'Pytanie wyboru wymaga co najmniej 2 opcji' },
    });
  }

  // Rule 7: Too many options
  if (params.answerOptions && params.answerOptions.length > 10) {
    warnings.push({
      ruleId: 'too_many_options',
      severity: 'warning',
      message: {
        en: 'Too many options — consider grouping or using open text',
        pl: 'Za dużo opcji — rozważ grupowanie lub pytanie otwarte',
      },
    });
  }

  // Rule 8: Vague question (single generic word + optional question mark)
  const vaguePatterns = [/^(what|how|why|co|jak|dlaczego|describe|opisz)\s*\??$/i];
  if (vaguePatterns.some((p) => p.test(text))) {
    warnings.push({
      ruleId: 'vague',
      severity: 'warning',
      message: { en: 'Question is too vague — add context or specifics', pl: 'Pytanie jest zbyt ogólne — dodaj kontekst lub szczegóły' },
    });
  }

  // Rule 9: Jargon/acronym heavy (more than 3 uppercase words of 2+ chars)
  const uppercaseWords = text.match(/\b[A-Z]{2,}\b/g) || [];
  if (uppercaseWords.length > 3) {
    warnings.push({
      ruleId: 'jargon_heavy',
      severity: 'info',
      message: {
        en: 'Many acronyms — ensure respondent understands them',
        pl: 'Dużo skrótów — upewnij się, że respondent je rozumie',
      },
    });
  }

  // Rule 10: Rating without scale context
  if (['rating', 'scale', 'score'].includes(params.answerType) && !params.helpHint) {
    warnings.push({
      ruleId: 'rating_no_hint',
      severity: 'info',
      message: {
        en: 'Rating question — add a hint explaining the scale',
        pl: 'Pytanie ze skalą — dodaj wskazówkę wyjaśniającą skalę',
      },
    });
  }

  return warnings;
}

export function calculateQuestionScore(warnings: QualityWarning[]): number {
  let score = 100;
  for (const w of warnings) {
    if (w.severity === 'error') score -= 25;
    else if (w.severity === 'warning') score -= 10;
    else if (w.severity === 'info') score -= 3;
  }
  return Math.max(0, Math.min(100, score));
}
