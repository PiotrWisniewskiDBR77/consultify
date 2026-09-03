/**
 * Flaga `financeExportImportV1` (Pakiet AP-CLIENT / Gate J — Export/Import .xlsx).
 *
 * CLAUDE.md reguła #7. Gałęzi WYŁĄCZNIE montowanie
 * `src/components/Finance/exportImport/FinanceExportImportPanel.tsx` — komponent SAMODZIELNY,
 * dev-render only do akceptu.
 *
 * Realnie odczytywana: `FinanceExportImportPanel.tsx` woła
 * `useFinanceExportImportFlag().enabled` i przy `false` zwraca `null` przed jakimkolwiek
 * wywołaniem `exportFinanceStatementPackXlsx`/`parseFinanceImportXlsx`.
 */

import { type FeatureFlag, useFeatureFlags, type UseFeatureFlagsReturn } from './useFeatureFlags';

export const FINANCE_EXPORT_IMPORT_FLAG_ID = 'financeExportImportV1';

const FINANCE_EXPORT_IMPORT_FLAG: FeatureFlag = {
  id: FINANCE_EXPORT_IMPORT_FLAG_ID,
  name: 'Finance: Export / Import .xlsx (manifest + podgląd różnic)',
  description:
    'Włącza samodzielny panel eksportu/importu Finance v3 (export-import.routes.ts, 4 ' +
    'endpointy): eksport .xlsx z manifestem (wersja/jednostka/źródło), import trzystopniowy ' +
    '(parse → podgląd różnic → zastosowanie transakcyjne, wszystko-albo-nic). DEC 03.09 ' +
    'wieczór (A2, docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md wiersz A2 — ' +
    '6 paneli Finansów) — domyślnie ON. Override OFF nadal możliwy (allowLocalOverride).',
  defaultValue: true,
  category: 'beta',
  allowLocalOverride: true,
};

export interface UseFinanceExportImportFlagReturn {
  enabled: boolean;
  flags: UseFeatureFlagsReturn;
}

export function useFinanceExportImportFlag(
  config: { userId?: string; enableLocalOverrides?: boolean } = {}
): UseFinanceExportImportFlagReturn {
  const flags = useFeatureFlags({
    flags: [FINANCE_EXPORT_IMPORT_FLAG],
    userId: config.userId,
    enableLocalOverrides: config.enableLocalOverrides ?? true,
  });
  return { enabled: flags.isEnabled(FINANCE_EXPORT_IMPORT_FLAG_ID), flags };
}

export default useFinanceExportImportFlag;
