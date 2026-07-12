/**
 * assumptionsFinancialModelDrivers — #82f front wiring: podpięcie `assumptionsRegistry`
 * (Z114) pod REALNY model 3-statement (`financial_models.assumptions_json`), czytany przez
 * `FinancialModelWorkspace.tsx` (zakładka „Inputs & Assumptions").
 *
 * DLACZEGO TEN PLIK (reuse-not-rebuild, wzorzec `assumptionsFinanceDrivers.ts`):
 *   Model 3-statement ma DWIE grupy driverów:
 *     1. baseline P&L (revenue/cogs/opex/depreciation/interest/tax/capex) — `assumptions.baseline`,
 *     2. otwarcie bilansu (initialCash/.../initialAP) — `assumptions.<key>` płasko.
 *   Prowieniencja NIE jest zgadywana — jest CZYTANA z sygnałów już liczonych przez
 *   `financialModelingService` przy seedowaniu (`buildSeededAssumptionsFromStatement` /
 *   `buildSeededAssumptionsFromPack`): `seedSource.type` (grounded z pakietu/sprawozdania)
 *   + `seedStatus.missingBaselineLines` (które linie NIE miały pokrycia w źródle → mimo
 *   obecnej wartości w modelu, to nie jest liczba "z dokumentu"). Model bez `seedSource`
 *   (manual/zero-seeded) → wszystkie drivery `ai_assumed`/`missing`, nigdy `imported`.
 *
 * Czyste, deterministyczne — zero I/O (caller dostarcza już wczytany `model`).
 */
import type { Assumption, AssumptionSourceType, RequiredDriver } from './assumptionsRegistry.js';

export const FINANCIAL_MODEL_DRIVERS: readonly RequiredDriver[] = [
  { key: 'baseline.revenue', label: 'Przychód (baseline)', unit: 'kwota' },
  { key: 'baseline.cogs', label: 'COGS (baseline)', unit: 'kwota' },
  { key: 'baseline.opex', label: 'OPEX (baseline)', unit: 'kwota' },
  { key: 'baseline.depreciation', label: 'Amortyzacja (baseline)', unit: 'kwota', optional: true },
  { key: 'baseline.interest', label: 'Odsetki (baseline)', unit: 'kwota', optional: true },
  { key: 'baseline.tax', label: 'Podatek (baseline)', unit: 'kwota', optional: true },
  { key: 'baseline.capex', label: 'CAPEX (baseline)', unit: 'kwota', optional: true },
  { key: 'initialCash', label: 'Gotówka otwarcia', unit: 'kwota' },
  { key: 'initialEquity', label: 'Kapitał własny otwarcia', unit: 'kwota' },
  { key: 'initialDebt', label: 'Dług otwarcia', unit: 'kwota' },
  { key: 'initialPPE', label: 'Środki trwałe (netto) otwarcia', unit: 'kwota' },
  { key: 'initialAR', label: 'Należności otwarcia', unit: 'kwota' },
  { key: 'initialInventory', label: 'Zapasy otwarcia', unit: 'kwota' },
  { key: 'initialAP', label: 'Zobowiązania otwarcia', unit: 'kwota' },
];

const BASELINE_KEYS = new Set(
  FINANCIAL_MODEL_DRIVERS.filter((d) => d.key.startsWith('baseline.')).map((d) =>
    d.key.replace('baseline.', '')
  )
);

export interface ModelSeedSourceLike {
  type?: string;
  periodLabel?: string;
  sourceFileName?: string;
}

/**
 * Zbuduj znormalizowany rejestr założeń dla modelu 3-statement — wejście do
 * `listAssumptions`/`auditCoverage` (assumptionsRegistry). `isGrounded` i
 * `missingBaselineLines` to sygnały JUŻ policzone przez `financialModelingService`
 * (seedSource/seedStatus) — ten mostek TYLKO je znakuje w formacie Z114, nie
 * przelicza ani nie zgaduje niczego nowego.
 */
export function financialModelToAssumptions(params: {
  assumptions: Record<string, any>;
  isGrounded: boolean;
  missingBaselineLines: readonly string[];
  seedSource: ModelSeedSourceLike | null;
}): Assumption[] {
  const { assumptions, isGrounded, missingBaselineLines, seedSource } = params;
  const baseline = (assumptions?.baseline || {}) as Record<string, unknown>;
  const missingSet = new Set(missingBaselineLines);
  const sourceRef =
    seedSource?.periodLabel || seedSource?.sourceFileName
      ? `${seedSource?.periodLabel || ''}${seedSource?.sourceFileName ? ` (${seedSource.sourceFileName})` : ''}`.trim()
      : undefined;

  return FINANCIAL_MODEL_DRIVERS.map((driver): Assumption => {
    const isBaseline = driver.key.startsWith('baseline.');
    const fieldKey = isBaseline ? driver.key.replace('baseline.', '') : driver.key;
    const raw = isBaseline ? baseline[fieldKey] : (assumptions as Record<string, unknown>)[fieldKey];
    const value = typeof raw === 'number' && !Number.isNaN(raw) ? raw : null;

    let source_type: AssumptionSourceType;
    let rationale: string | undefined;

    if (isBaseline && missingSet.has(fieldKey)) {
      // Backend już wie, że ta linia NIE miała pokrycia w źródle (buildSeededAssumptionsFromStatement/Pack).
      source_type = 'ai_assumed';
      rationale = 'Brak tej linii w pakiecie/sprawozdaniu źródłowym — wartość domyślna, do przeglądu.';
    } else if (isGrounded && value !== null) {
      source_type = 'imported';
      rationale = 'Zaciągnięte z pakietu sprawozdań / sprawozdania źródłowego modelu.';
    } else if (value !== null) {
      source_type = 'ai_assumed';
      rationale = 'Model bez powiązanego źródła (manual/zero-seeded) — wartość domyślna, edytowalna.';
    } else {
      source_type = 'ai_assumed';
    }

    return {
      key: driver.key,
      label: driver.label,
      value,
      unit: driver.unit,
      provenance: { source_type, source_ref: sourceRef, rationale },
    };
  });
}
