/**
 * financeArtifactTitle — tytuł artefaktu Finansów widziany przez człowieka,
 * z twardym zakazem pokazywania klucza technicznego.
 *
 * ★ POWÓD (audyt FIN 2026-09-06, `evidence/audyt-mvp-20260906/FIN/RAPORT_FIN.md`
 * defekt #3): nagłówek karty pakietu pokazywał
 * `seed:finance-cdprojekt-2025:cc9db573-260f-4a19-927f-f3cc1fbaea38:GRUPA_KAPITALOWA_CD_PROJEKT`,
 * a nagłówek karty analizy `derived-analysis:script:4db71c39-eb9a-4379-bb35-d6b4c939e8fd`.
 * Oba to `natural_key` — klucz idempotencji, nie nazwa. Migracja
 * `20261102_finance_artifact_display_name.sql` rozdzieliła te role; ten moduł
 * jest JEDYNYM miejscem, gdzie warstwa prezentacji podejmuje decyzję „co
 * pokazać", żeby naprawa nie musiała być powtarzana per ekran (cztery warsztaty
 * v3 renderowały tytuł niezależnie od siebie).
 *
 * Zasada: `display_name` → `natural_key` (TYLKO jeśli nie jest techniczny) →
 * uczciwa nazwa rodzajowa („Sprawozdanie bez nazwy"). Klucz techniczny NIGDY
 * nie trafia na ekran — nawet jako ostatnia deska ratunku.
 */

import type { FinanceArtifactType } from '../services/api/financeV2.types';

/** UUID w dowolnym miejscu napisu — najpewniejszy znacznik ciągu maszynowego. */
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/** Prefiks maszynowy: małe litery/cyfry/łączniki, zaraz dwukropek, bez spacji przed nim (`seed:`, `derived-analysis:`, `financial_statement_packs:`). Nazwa pisana przez człowieka („Analiza 2025: wnioski") zaczyna się wielką literą albo ma spację przed dwukropkiem. */
const MACHINE_PREFIX = /^[a-z][a-z0-9_.-]*:/;
/** Cały napis to jeden token maszynowy bez spacji (`cdp2025-pack-33d3c3b64a`). */
const SINGLE_MACHINE_TOKEN = /^[a-z0-9][a-z0-9_.-]{7,}$/;

/**
 * `true` gdy wartość jest identyfikatorem/kluczem, a nie nazwą. Używane przez
 * `financeArtifactDisplayTitle` ORAZ przez testy jako bezpiecznik „żadna surowa
 * wartość techniczna nie wychodzi na ekran".
 */
export function isRawTechnicalValue(value: string | null | undefined): boolean {
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (UUID_ANYWHERE.test(text)) return true;
  if (MACHINE_PREFIX.test(text)) return true;
  if (SINGLE_MACHINE_TOKEN.test(text)) return true;
  return false;
}

const GENERIC_TITLE_BY_TYPE: Partial<Record<FinanceArtifactType, string>> = {
  STATEMENT_PACK: 'Sprawozdanie bez nazwy',
  HISTORICAL_ANALYSIS: 'Analiza bez nazwy',
  BASELINE_MODEL: 'Model bazowy bez nazwy',
  PREDICTION_SCENARIO: 'Scenariusz predykcji bez nazwy',
  VALUATION_CASE: 'Wycena bez nazwy',
};

export interface FinanceArtifactTitleInput {
  displayName?: string | null;
  naturalKey?: string | null;
  artifactType?: FinanceArtifactType | null;
  /** Nazwa rodzajowa, gdy typ jest nieznany temu modułowi. */
  genericFallback?: string;
}

export function financeArtifactDisplayTitle(input: FinanceArtifactTitleInput): string {
  const displayName = String(input.displayName ?? '').trim();
  if (displayName && !isRawTechnicalValue(displayName)) return displayName;

  const naturalKey = String(input.naturalKey ?? '').trim();
  if (naturalKey && !isRawTechnicalValue(naturalKey)) return naturalKey;

  const byType = input.artifactType ? GENERIC_TITLE_BY_TYPE[input.artifactType] : undefined;
  return byType ?? input.genericFallback ?? 'Artefakt bez nazwy';
}
