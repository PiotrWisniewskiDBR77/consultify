/**
 * assumptionsFinanceDrivers — PRZYKŁADOWE użycie `assumptionsRegistry` (Z114) dla
 * silnika Finance (drivery modelu 3-statement / biznesplanu).
 *
 * Pokazuje jak podpiąć generalizowalny rdzeń do konkretnego typu modelu:
 *  - rejestr wymaganych driverów `FINANCE_SAAS_3STMT_DRIVERS` (per typ modelu),
 *  - `financialDriversToAssumptions` — mostek z istniejącego `FinancialDrivers`
 *    (deliverables/financialEngine) do znormalizowanego rejestru założeń.
 *
 * To DEMONSTRACJA kontraktu, nie zmiana zachowania — `financialEngine`/`assumptionsModel`
 * pozostają nietknięte. Docelowo TEN wzorzec zasili też Results/KPI i Assessment.
 *
 * Deterministyczne, czyste, nigdy nie rzuca.
 */

import type { FinancialDrivers } from '../deliverables/financialEngine.js';
import type { Assumption, AssumptionSourceType, RequiredDriver } from './assumptionsRegistry.js';

/** Klucz typu modelu w rejestrze driverów. */
export const FINANCE_SAAS_3STMT = 'finance.saas_3stmt';

/**
 * Wymagane drivery modelu SaaS 3-statement — źródło prawdy „czego potrzeba".
 * `benchmarkHint` to podpowiedź rzędu wielkości dla kroku „AI zakłada" (nie compute).
 * Klucze w konwencji kropkowej, spójne z `buildAssumptionRegistry` z deliverables.
 */
export const FINANCE_SAAS_3STMT_DRIVERS: readonly RequiredDriver[] = [
  { key: 'saas.price_per_seat_month', label: 'Cena SaaS / seat / mies', unit: 'EUR/seat/mies', benchmarkHint: 40 },
  { key: 'saas.seats_start', label: 'Seaty na koniec R1', unit: 'szt', benchmarkHint: 500 },
  { key: 'saas.seat_growth_yoy', label: 'Wzrost seatów r/r', unit: '×', benchmarkHint: 1.6 },
  { key: 'saas.gross_churn', label: 'Churn brutto roczny', unit: '%', benchmarkHint: 0.12 },
  { key: 'saas.nrr', label: 'Net revenue retention', unit: '×', benchmarkHint: 1.1 },
  { key: 'services.revenue_start', label: 'Przychód usług R1', unit: 'EUR', benchmarkHint: 200000 },
  { key: 'services.growth_yoy', label: 'Wzrost usług r/r', unit: '%', benchmarkHint: 0.3 },
  { key: 'cost.gross_margin', label: 'Marża brutto', unit: '%', benchmarkHint: 0.8 },
  { key: 'cost.sm_pct', label: 'S&M % przychodu', unit: '%', benchmarkHint: 0.45 },
  { key: 'cost.rd_pct', label: 'R&D % przychodu', unit: '%', benchmarkHint: 0.24 },
  { key: 'cost.ga_pct', label: 'G&A % przychodu', unit: '%', benchmarkHint: 0.2 },
  { key: 'cost.da_pct', label: 'D&A % przychodu', unit: '%', benchmarkHint: 0.02 },
  { key: 'ue.cac', label: 'CAC', unit: 'EUR', benchmarkHint: 1500 },
  { key: 'ue.arpu_annual', label: 'ARPU roczne', unit: 'EUR', benchmarkHint: 5000 },
  { key: 'capital.starting_cash', label: 'Gotówka startowa', unit: 'EUR', benchmarkHint: 1000000 },
  { key: 'capital.funding', label: 'Pozyskane finansowanie', unit: 'EUR', benchmarkHint: 2000000 },
  { key: 'tax.rate', label: 'Stopa podatku', unit: '%', benchmarkHint: 0.19 },
  // opex leverage jest opcjonalny (default 1 w silniku) — nie liczony jako brak
  { key: 'cost.opex_leverage_yoy', label: 'Dźwignia OpEx r/r', unit: '×', benchmarkHint: 0.85, optional: true },
];

/** Mapa klucz-rejestru → pole w `FinancialDrivers`. Jednoznaczny, testowalny mostek. */
const KEY_TO_FIELD: Record<string, keyof FinancialDrivers> = {
  'saas.price_per_seat_month': 'saasPricePerSeatMonth',
  'saas.seats_start': 'saasSeatsStart',
  'saas.seat_growth_yoy': 'saasSeatGrowthYoY',
  'saas.gross_churn': 'grossChurnAnnual',
  'saas.nrr': 'nrr',
  'services.revenue_start': 'servicesRevenueStart',
  'services.growth_yoy': 'servicesGrowthYoY',
  'cost.gross_margin': 'grossMargin',
  'cost.sm_pct': 'smPctRevenue',
  'cost.rd_pct': 'rdPctRevenue',
  'cost.ga_pct': 'gaPctRevenue',
  'cost.da_pct': 'daPctRevenue',
  'cost.opex_leverage_yoy': 'opexLeverageYoY',
  'ue.cac': 'cac',
  'ue.arpu_annual': 'arpuAnnual',
  'capital.starting_cash': 'startingCash',
  'capital.funding': 'fundingRaised',
  'tax.rate': 'taxRate',
};

/** Opcje mostka: jak oznaczyć pochodzenie zmapowanych wartości. */
export interface FinanceMapOpts {
  /** Domyślny typ źródła dla obecnych wartości (np. z uploadu → 'imported'). Domyślnie 'imported'. */
  defaultSourceType?: AssumptionSourceType;
  /** Referencja źródła (np. „upload:2026-financials.xlsx" / model id). */
  sourceRef?: string;
  /** Per-klucz nadpisanie typu źródła (np. część pól ręcznie → 'user'). */
  sourceTypeByKey?: Partial<Record<string, AssumptionSourceType>>;
}

/**
 * Zbuduj znormalizowany rejestr założeń z `FinancialDrivers`.
 * Pola nieliczbowe/NaN mapują się na `value: null` (→ wykrywalne jako brak).
 * Nie dokleja driverów spoza `FINANCE_SAAS_3STMT_DRIVERS`.
 */
export function financialDriversToAssumptions(
  drivers: Partial<FinancialDrivers>,
  opts: FinanceMapOpts = {},
): Assumption[] {
  const defaultSource = opts.defaultSourceType ?? 'imported';
  return FINANCE_SAAS_3STMT_DRIVERS.map((r): Assumption => {
    const field = KEY_TO_FIELD[r.key];
    const raw = field ? (drivers as Record<string, unknown>)[field] : undefined;
    const value = typeof raw === 'number' && !Number.isNaN(raw) ? raw : null;
    const source_type = opts.sourceTypeByKey?.[r.key] ?? defaultSource;
    return {
      key: r.key,
      label: r.label,
      value,
      unit: r.unit,
      provenance: { source_type, source_ref: opts.sourceRef },
    };
  });
}
