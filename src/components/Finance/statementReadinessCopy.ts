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
  // F-M1 (2026-09-05): 5 codes verified against the real emitter
  // (`server/src/services/financialStatementPackService.ts` `reasonCodes.push`)
  // that were missing from this map — before this fix they fell through to
  // the generic "needs review" sentence below instead of a specific one.
  INVALID_PERIOD_COUNT: {
    key: 'finance.statements.reason.invalidPeriodCount',
    fallbackEn: 'The pack must cover exactly two reporting periods',
  },
  INVALID_MEMBER_COUNT: {
    key: 'finance.statements.reason.invalidMemberCount',
    fallbackEn: 'The pack is missing one or more required statements',
  },
  MISSING_PERIOD_STATEMENT: {
    key: 'finance.statements.reason.missingPeriodStatement',
    fallbackEn: 'At least one reporting period is missing a statement',
  },
  INCONSISTENT_ENTITY: {
    key: 'finance.statements.reason.inconsistentEntity',
    fallbackEn: 'Statements belong to different legal entities',
  },
  INCONSISTENT_SOURCE: {
    key: 'finance.statements.reason.inconsistentSource',
    fallbackEn: 'Statements come from different sources',
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

// ---------------------------------------------------------------------------
// „Stan pakietu" — jedno zdanie zamiast angielskiego akapitu z backendu.
//
// ★ POWÓD (audyt FIN 2026-09-06 defekt #8, zrzut `02-sprawozdania-podglad.png`):
// wiersz „Stan pakietu" w podglądzie renderował WPROST
// `financial_statement_packs.pack_quality_summary`, czyli angielskie zdanie
// sklejone w `server/src/services/financialStatementPackService.ts:216-224`
// („Statement pack contains a complete ready set of P&L, Balance Sheet, and
// Cash Flow."). Backend nie zna języka użytkownika i nie powinien go znać —
// niesie STAN (`packReadinessStatus`) i KODY POWODÓW (`packQualityReasonCodes`),
// a zdanie składa warstwa prezentacji, z tego samego słownika co reszta pliku.
// ---------------------------------------------------------------------------

/** Zdanie o gotowości pakietu z jego stanu i kodów powodów. NIGDY nie zwraca tekstu z backendu. */
export function statementPackStateSentence(
  readinessStatus: string | null | undefined,
  reasonCodes: readonly string[] | null | undefined,
  t: TFunction
): string {
  const status = String(readinessStatus || '').trim().toLowerCase();
  const sentences = statementReasonSentences(reasonCodes, t);

  if (status === 'ready') {
    return t(
      'finance.statements.state.ready',
      'Pakiet jest kompletny: rachunek zysków i strat, bilans oraz rachunek przepływów pieniężnych.'
    );
  }
  if (status === 'rejected') {
    return t(
      'finance.statements.state.rejected',
      'Wszystkie sprawozdania w tym pakiecie zostały odrzucone — pakiet nie może zasilić dalszej pracy.'
    );
  }
  if (sentences.length > 0) {
    return `${t('finance.statements.state.needsAttention', 'Pakiet wymaga uwagi')}: ${sentences
      .map((sentence, index) => (index === 0 ? sentence : sentence.charAt(0).toLowerCase() + sentence.slice(1)))
      .join('; ')}.`;
  }
  return t(
    'finance.statements.state.collecting',
    'Pakiet wciąż zbiera wymagane sprawozdania.'
  );
}
