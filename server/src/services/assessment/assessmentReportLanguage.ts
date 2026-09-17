/**
 * assessmentReportLanguage — WSPÓLNY resolver języka raportu z oceny (DEC-461/R2).
 *
 * ★ CO ROBI. Zwraca `'pl' | 'en'` dla eksportu raportu z oceny (DOCX/PPTX/PDF
 * z magazynu zastanego oraz DOCX z jądra metodycznego). Wynik pochodzi z JEDNEJ
 * kolejności — pierwsza trafiona wygrywa:
 *   1. `?lang=` z URL (jawny wybór na ekranie/w linku);
 *   2. `jobLocale` z zamrożonego zadania (opcjonalne — raporty asynchroniczne);
 *   3. `users.language` żądającego (`20260726_users_language_preference.sql`);
 *   4. `organizations.default_language` organizacji (`\d organizations` = istnieje);
 *   5. `'en'` — domyślny język aplikacji po DEC-461.
 *
 * ★ CZEMU TU MIESZKA. Do DEC-461/R2 tę logikę trzymał WYŁĄCZNIE `assessment-
 * reports.routes.ts` (trasa magazynu zastanego), a druga trasa —
 * `method-core.routes.ts /sessions/:id/assessment-report.docx` — w ogóle nie
 * przewlekała języka do `assessmentReportContractService.build()`. Kompozytor
 * kontraktu domyślnie renderował po polsku, więc raport DOCX z jądra
 * metodycznego pokazywał EN-owemu użytkownikowi polską prozę i etykiety.
 * Wspólny helper gwarantuje, że OBIE trasy stosują TĘ SAMĄ kolejność źródeł.
 *
 * ★ CZEGO NIE ROBI. NIE waliduje wejścia (`?lang=pl-PL` daje `'pl'`, `?lang=de`
 * spada do domyślnej — to jest zamierzone). NIE zapisuje nigdzie języka
 * (raport nie zmienia preferencji użytkownika). Każdy krok bazy jest
 * best-effort: błąd zapytania NIGDY nie wywraca eksportu, tylko cofa do
 * następnego kandydata (fail-safe w stronę `'en'`, bo to teraz domyślny język
 * aplikacji — odwrotnie niż `languagePolicy.ts`, które jest SSOT WYŁĄCZNIE
 * dla odpowiedzi czatu AI Teresy, nie dla plików eksportu).
 */
import * as DbPromise from '../../utils/DbPromise.js';
import type { ReportLanguage } from './assessmentReportI18n.js';

export function parseExplicitReportLanguage(value: unknown): ReportLanguage | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('pl')) return 'pl';
  if (normalized.startsWith('en')) return 'en';
  return null;
}

export interface ResolveAssessmentReportLanguageParams {
  readonly organizationId: string;
  readonly explicit?: unknown;
  readonly userId?: string | null;
  readonly jobLocale?: unknown;
}

export async function resolveAssessmentReportLanguage(
  params: ResolveAssessmentReportLanguageParams
): Promise<ReportLanguage> {
  const explicit = parseExplicitReportLanguage(params.explicit);
  if (explicit) return explicit;

  const frozenJobLocale = parseExplicitReportLanguage(params.jobLocale);
  if (frozenJobLocale) return frozenJobLocale;

  try {
    if (params.userId) {
      const row = await DbPromise.get<{ language: string | null }>(
        `SELECT language FROM users WHERE id = ?`,
        [params.userId],
        { fallback: false }
      );
      const fromUser = parseExplicitReportLanguage(row?.language ?? null);
      if (fromUser) return fromUser;
    }
  } catch {
    /* users.language niedostępne — schodzimy do organizacji, potem do 'en' */
  }

  try {
    const org = await DbPromise.get<{ default_language: string | null }>(
      `SELECT default_language FROM organizations WHERE id = ?`,
      [params.organizationId],
      { fallback: false }
    );
    const fromOrg = parseExplicitReportLanguage(org?.default_language ?? null);
    if (fromOrg) return fromOrg;
  } catch {
    /* organizations.default_language niedostępne — 'en' */
  }

  return 'en';
}
