/**
 * statementReadinessCopy — kody gotowości pakietu sprawozdań → zdania dla ludzi.
 *
 * FALA 1 / „surowe identyfikatory w UI" (2026-07-27): preview i karta
 * sprawozdania wypisywały wprost listę kodów backendu
 * (`MISSING_PL, MISSING_CF, HAS_PENDING_STATEMENT`) jako komunikat dla
 * użytkownika. Kod błędu nie jest komunikatem — komunikat mówi, CZEGO brakuje
 * i CO z tym zrobić (wzorzec: Interview→Insights „Edit — AI-generated —
 * read-only": konkretny powód, nie kod).
 *
 * Źródło kodów: `server/src/services/financialStatementPackService.ts`
 * (`reasonCodes.push(...)`). Kod nieznany temu słownikowi NIE jest pokazywany
 * surowo — dostaje ogólne, ale zrozumiałe zdanie.
 */

import type { TFunction } from 'i18next';

interface ReasonCopy {
  key: string;
  fallbackEn: string;
}

const REASON_COPY: Record<string, ReasonCopy> = {
  MISSING_PL: {
    key: 'finance.statements.reason.missingPl',
    fallbackEn: 'Missing profit and loss statement',
  },
  MISSING_BS: {
    key: 'finance.statements.reason.missingBs',
    fallbackEn: 'Missing balance sheet',
  },
  MISSING_CF: {
    key: 'finance.statements.reason.missingCf',
    fallbackEn: 'Missing cash flow statement',
  },
  DUPLICATE_STATEMENT_TYPE: {
    key: 'finance.statements.reason.duplicateType',
    fallbackEn: 'The same statement type was imported more than once',
  },
  INCONSISTENT_CURRENCY: {
    key: 'finance.statements.reason.inconsistentCurrency',
    fallbackEn: 'Statements use different currencies',
  },
  INCONSISTENT_SCALING: {
    key: 'finance.statements.reason.inconsistentScaling',
    fallbackEn: 'Statements use different value scales (e.g. units vs thousands)',
  },
  INCONSISTENT_PERIOD: {
    key: 'finance.statements.reason.inconsistentPeriod',
    fallbackEn: 'Statements cover different reporting periods',
  },
  HAS_REJECTED_STATEMENT: {
    key: 'finance.statements.reason.hasRejected',
    fallbackEn: 'At least one statement was rejected during validation',
  },
  HAS_PENDING_STATEMENT: {
    key: 'finance.statements.reason.hasPending',
    fallbackEn: 'At least one statement is still awaiting validation',
  },
  HAS_RECOVERABLE_STATEMENT: {
    key: 'finance.statements.reason.hasRecoverable',
    fallbackEn: 'At least one statement needs corrections before it can be used',
  },
};

/** Jedno zdanie dla jednego kodu. Nigdy nie zwraca surowego kodu. */
export function statementReasonSentence(code: string, t: TFunction): string {
  const copy = REASON_COPY[String(code || '').toUpperCase()];
  if (copy) return t(copy.key, copy.fallbackEn);
  return t(
    'finance.statements.reason.unknown',
    'This statement needs review before it can be used'
  );
}

/** Lista kodów → lista zdań, bez powtórzeń (dwa kody mogą dać to samo zdanie). */
export function statementReasonSentences(
  codes: readonly string[] | null | undefined,
  t: TFunction
): string[] {
  if (!codes?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of codes) {
    const sentence = statementReasonSentence(code, t);
    if (seen.has(sentence)) continue;
    seen.add(sentence);
    out.push(sentence);
  }
  return out;
}
