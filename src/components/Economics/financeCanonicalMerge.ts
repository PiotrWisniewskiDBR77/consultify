/**
 * financeCanonicalMerge — scalenie listy legacy z rejestrem artefaktów
 * kanonicznych dla Finansów.
 *
 * ★ POWÓD (audyt FIN 2026-09-06, defekt #5/#8, zrzut `05-analiza-lista.png`):
 * zakładka „Analiza" pokazywała uczciwy, ale FAŁSZYWY stan pusty („Brak analiz.
 * Utwórz pierwszą analizę."), mimo że organizacja miała policzoną analizę
 * wskaźnikową CD PROJEKT (18 wskaźników, `business_version_id d7b0b5de-…`).
 * Przyczyna: `useFinanceData.loadAnalyses` czyta ALBO legacy
 * (`GET /api/v8/finance/analyses`, tabela `financial_analyses`), ALBO kanoniczne
 * (`GET /api/v8/finance-v2/artifacts?artifactType=HISTORICAL_ANALYSIS`) —
 * rozstrzyga o tym flaga trybu odbioru właściciela. Analiza istniejąca WYŁĄCZNIE
 * jako artefakt kanoniczny była więc niewidoczna przy fladze OFF, a wiersze
 * czysto legacy znikały przy fladze ON.
 *
 * To jest ten sam kształt awarii, który w Inicjatywach naprawiono
 * `mergeLegacyInitiativesIntoRegister`
 * (`src/components/Initiatives/initiativeRegisterProjection.ts:387`) — z jedną
 * ZMIERZONĄ różnicą co do tego, kto wygrywa kolizję. W Inicjatywach bogatszy
 * jest rzut kanoniczny. W Finansach jest odwrotnie: wiersz legacy niesie pola
 * domenowe (typ analizy, waluta, okresy, powiązany pakiet), a rejestr kanoniczny
 * świadomie ich NIE ma (`canonicalArtifactAsHubRow` → `canonicalRegistryProjection`),
 * i to wiersz legacy niesie już wskaźnik na swojego kanonicznego bliźniaka
 * (`canonicalArtifactId`). Dlatego przy kolizji wygrywa LEGACY, a rejestr
 * kanoniczny dokłada wyłącznie SIEROTY — artefakty, których żaden wiersz legacy
 * nie reprezentuje.
 */

export interface FinanceMergeableRow {
  id?: unknown;
  canonicalArtifactId?: unknown;
  [key: string]: unknown;
}

function keyOf(row: FinanceMergeableRow): string {
  const canonical = String(row.canonicalArtifactId ?? '').trim();
  if (canonical) return `canonical:${canonical}`;
  return `legacy:${String(row.id ?? '').trim()}`;
}

/**
 * Wiersze legacy + sieroty kanoniczne, w tej kolejności. Referencyjnie stabilne:
 * gdy nie ma czego dokleić, zwraca DOKŁADNIE tablicę `legacyRows` (memoizacja
 * po stronie wołającego nie jest psuta).
 */
export function mergeCanonicalArtifactsIntoFinanceRows<T extends FinanceMergeableRow>(
  legacyRows: readonly T[],
  canonicalRows: readonly T[]
): T[] {
  if (canonicalRows.length === 0) return legacyRows as T[];
  const seen = new Set<string>();
  for (const row of legacyRows) {
    seen.add(keyOf(row));
    const canonical = String(row.canonicalArtifactId ?? '').trim();
    if (canonical) seen.add(`canonical:${canonical}`);
  }
  const orphans = canonicalRows.filter((row) => !seen.has(keyOf(row)));
  if (orphans.length === 0) return legacyRows as T[];
  return [...legacyRows, ...orphans];
}
