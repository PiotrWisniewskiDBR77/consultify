/**
 * AssumptionsModel (§A spec) — z briefu LLM AUTORUJE obronne założenia biznesplanu,
 * a deterministyczne helpery składają je w drivery + rejestr + market sizing i wykrywają
 * anty-wzorce. LLM daje LICZBY, kod pilnuje OBRONNOŚCI. SSOT: BUSINESS_PLAN_GENERATOR_SPEC.md.
 *
 * Rozdział: generateAssumptions (LLM, flaky) ≠ buildery (czyste, testowalne).
 */
import { z } from 'zod';

import llmService from '../ai/llmService.js';
import { deliverableModelConfig, resolveDeliverableTier } from '../deliverableGenerationTier.js';
import type {
  AntiPatternFinding,
  Assumption,
  MarketSizing,
  Provenance,
  ValueClass,
} from './businessPlanSpine.js';
import type { FinancialDrivers } from './financialEngine.js';

/** Serializowalne wejście (to produkuje LLM albo człowiek) → mapowane na SPINE. */
export interface BusinessPlanInput {
  company: string;
  language: 'PL' | 'EN';
  product: string;
  thesis: string;
  ask: string;
  startYear: number;
  years: number;
  currency: string;
  /** Drivery liczbowe (bez funkcji/horyzontu — te dokleja mapper). */
  drivers: {
    saasPricePerSeatMonth: number;
    saasSeatsStart: number;
    saasSeatGrowthYoY: number;
    grossChurnAnnual: number;
    nrr: number;
    servicesRevenueStart: number;
    servicesGrowthYoY: number;
    grossMargin: number;
    smPctRevenue: number;
    rdPctRevenue: number;
    gaPctRevenue: number;
    daPctRevenue: number;
    opexLeverageYoY: number;
    cac: number;
    arpuAnnual: number;
    startingCash: number;
    fundingRaised: number;
    taxRate: number;
  };
  market: {
    tamTopDown: number;
    tamSource: string;
    samValue: number;
    somValue: number;
    bottomUpCustomers: number;
    bottomUpArpu: number; // bottom-up = customers × arpu
    unit: string;
  };
  /** Źródło/benchmark per kluczowy driver (§A6); klucz = pole w drivers/market. */
  sources?: Record<string, string>;
}

const num = z.number();
const InputSchema = z.object({
  company: z.string(),
  language: z.enum(['PL', 'EN']),
  product: z.string(),
  thesis: z.string(),
  ask: z.string(),
  startYear: num,
  years: num,
  currency: z.string(),
  drivers: z.object({
    saasPricePerSeatMonth: num,
    saasSeatsStart: num,
    saasSeatGrowthYoY: num,
    grossChurnAnnual: num,
    nrr: num,
    servicesRevenueStart: num,
    servicesGrowthYoY: num,
    grossMargin: num,
    smPctRevenue: num,
    rdPctRevenue: num,
    gaPctRevenue: num,
    daPctRevenue: num,
    opexLeverageYoY: num,
    cac: num,
    arpuAnnual: num,
    startingCash: num,
    fundingRaised: num,
    taxRate: num,
  }),
  market: z.object({
    tamTopDown: num,
    tamSource: z.string(),
    samValue: num,
    somValue: num,
    bottomUpCustomers: num,
    bottomUpArpu: num,
    unit: z.string(),
  }),
  sources: z.record(z.string(), z.string()).optional(),
});

const SYSTEM = `Jesteś partnerem w firmie doradczej (McKinsey/BCG-grade) budującym OBRONNY model założeń biznesplanu z briefu.
Zwróć WYŁĄCZNIE obiekt zgodny ze schematem. Reguły konsultanckie (twarde):
- Każda liczba musi być realistyczna i benchmarkowana — żadnych hockey-sticków ani "1% wielkiego rynku".
- Market: TAM top-down (z realnego rzędu wielkości rynku, podaj tamSource), SAM < TAM, SOM < SAM i wynikające z realnej zdolności sprzedażowej. bottomUpCustomers×bottomUpArpu ma być w ~15% zgodne z SOM (triangulacja).
- Unit economics zdrowe: arpuAnnual ≈ saasPricePerSeatMonth×12; CAC realny (LTV/CAC≈3-5); grossMargin 0.70-0.90.
- Koszty jako udział przychodu: smPctRevenue ~0.3-0.5, rdPctRevenue ~0.2-0.3, gaPctRevenue ~0.15-0.25.
- DŹWIGNIA OPERACYJNA: ustaw opexLeverageYoY 0.80-0.90 tak, by EBITDA była DODATNIA najpóźniej w ostatnim roku (krzywa J — straty na starcie OK, ale rentowność do końca horyzontu). Jeśli suma OpEx% > marża brutto, daj niższe opexLeverageYoY (np. 0.80), żeby marża urosła powyżej zera.
- startingCash i fundingRaised dodatnie; runway nieujemny (fundingRaised ma pokryć skumulowane straty do break-even).
- W "sources" podaj źródło/benchmark dla kluczowych driverów (cena, churn, nrr, cac, grossMargin, tam).
- Waluta i język wg briefu (domyślnie PL/EUR). years=3 jeśli brief nie mówi inaczej.`;

export interface GenOpts {
  orgId?: string;
  preferPremium?: boolean;
}

/** LLM: brief → BusinessPlanInput (fail-open null). `feedback` = błędy CFO-review do naprawy. */
export async function generateAssumptions(
  brief: string,
  opts: GenOpts = {},
  feedback?: string
): Promise<BusinessPlanInput | null> {
  const tier = resolveDeliverableTier({ orgId: opts.orgId, preferPremium: opts.preferPremium });
  const userContent = feedback
    ? `Brief biznesplanu:\n${brief}\n\nPOPRZEDNIA WERSJA NIE PRZESZŁA CFO-review. NAPRAW dokładnie te problemy (zachowaj resztę realistyczną):\n${feedback}`
    : `Brief biznesplanu:\n${brief}`;
  try {
    const result = await (llmService as any).call({
      type: 'structured',
      modelConfig: deliverableModelConfig(tier as unknown as Record<string, unknown>),
      systemPrompt: SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      schema: InputSchema,
      maxTokens: 2500,
      temperature: 0.3,
      cache: false,
      timeoutMs: 120000,
    });
    const obj = (result as any)?.object;
    if (!obj || !obj.drivers || !obj.market) return null;
    return obj as BusinessPlanInput;
  } catch {
    return null;
  }
}

// ── Deterministyczne buildery (czyste, testowalne) ──────────────────────────

/** input → FinancialDrivers (dokleja horyzont + etykiety lat). */
export function toFinancialDrivers(input: BusinessPlanInput): FinancialDrivers {
  return {
    currency: input.currency,
    years: input.years,
    startYearLabel: (i: number) => `Rok ${i + 1} (${input.startYear + i})`,
    ...input.drivers,
  };
}

const prov = (input: BusinessPlanInput, key: string, fallback: string): Provenance => {
  const s = input.sources?.[key];
  return { source: s ?? fallback, benchmarked: !!s };
};

/** Market sizing z triangulacją bottom-up vs top-down + flaga rozjazdu >15% (§A2-A4). */
export function buildMarketSizing(input: BusinessPlanInput): MarketSizing {
  const m = input.market;
  const bottomUp = m.bottomUpCustomers * m.bottomUpArpu;
  // reconcile bottom-up vs SOM (oba to realnie zdobywalna część)
  const ref = m.somValue || bottomUp;
  const gapPct = ref > 0 ? Math.abs(bottomUp - ref) / ref : 1;
  return {
    tam: {
      value: m.tamTopDown,
      unit: m.unit,
      method: 'top-down',
      provenance: prov(input, 'tam', m.tamSource || 'estymata'),
    },
    sam: {
      value: m.samValue,
      unit: m.unit,
      provenance: prov(input, 'sam', 'build top-down→segment'),
    },
    som: {
      value: m.somValue,
      unit: m.unit,
      derivedFromGtm: true,
      provenance: prov(input, 'som', 'build GTM+capacity'),
    },
    bottomUp: {
      value: Math.round(bottomUp),
      unit: m.unit,
      formula: `${m.bottomUpCustomers} klientów × ${m.bottomUpArpu} ${m.unit}`,
    },
    // triangulacja: bottom-up build vs SOM (oba = realnie zdobywalne); spójne z gapPct.
    reconciliation: {
      topDown: Math.round(ref),
      bottomUp: Math.round(bottomUp),
      gapPct: Math.round(gapPct * 100) / 100,
      reconciled: gapPct <= 0.15,
    },
  };
}

/** Rejestr Assumption[] — kluczowe drivery z provenance/range/sensitivity (§A1/A6/A7). */
export function buildAssumptionRegistry(input: BusinessPlanInput): Assumption[] {
  const d = input.drivers;
  // [key, label, base, unit, sensitivityRank, parent]
  const defs: Array<[string, string, number, string, number, string?]> = [
    [
      'saas.price_per_seat_month',
      'Cena SaaS / seat / mies',
      d.saasPricePerSeatMonth,
      input.currency + '/seat/mies',
      2,
      'revenue',
    ],
    ['saas.seat_growth_yoy', 'Wzrost seatów r/r', d.saasSeatGrowthYoY, '×', 5, 'revenue'],
    ['saas.gross_churn', 'Churn brutto roczny', d.grossChurnAnnual, '%', 4, 'retention'],
    ['saas.nrr', 'Net revenue retention', d.nrr, '×', 5, 'retention'],
    [
      'services.revenue_start',
      'Przychód usług R1',
      d.servicesRevenueStart,
      input.currency,
      2,
      'revenue',
    ],
    ['cost.gross_margin', 'Marża brutto', d.grossMargin, '%', 4, 'cost'],
    ['cost.sm_pct', 'S&M % przychodu', d.smPctRevenue, '%', 3, 'cost'],
    ['ue.cac', 'CAC', d.cac, input.currency, 4, 'unit_econ'],
    ['ue.arpu_annual', 'ARPU roczne', d.arpuAnnual, input.currency, 3, 'unit_econ'],
    ['capital.funding', 'Pozyskane finansowanie', d.fundingRaised, input.currency, 1, 'capital'],
  ];
  return defs.map(([key, label, base, unit, rank, parent]): Assumption => {
    const spread = unit === '%' || unit === '×' ? 0.1 : 0.2; // ranges nie fałszywa precyzja (§A6)
    const src = input.sources?.[key.split('.').pop() ?? ''] ?? input.sources?.[key];
    const valueClass: ValueClass = 'input';
    return {
      key,
      label,
      base,
      unit,
      range: [
        Math.round(base * (1 - spread) * 100) / 100,
        Math.round(base * (1 + spread) * 100) / 100,
      ],
      provenance: { source: src ?? 'model wewnętrzny', benchmarked: !!src },
      sensitivityRank: rank,
      parent,
      valueClass,
    };
  });
}

/** Anty-wzorce na poziomie ZAŁOŻEŃ (§A9) — finansowe łapie CFO-review osobno. */
export function validateAssumptions(input: BusinessPlanInput): AntiPatternFinding[] {
  const out: AntiPatternFinding[] = [];
  const m = input.market;
  // TAM całkiem bez źródła → TWARDY gate (§A6/F3.1): blokuje + pętla naprawcza wymusza źródło.
  if (!m.tamSource || !m.tamSource.trim()) {
    out.push({
      pattern: 'tam_unsourced_or_topdown_only',
      severity: 'reject',
      detail: 'TAM bez źródła — niedopuszczalne dla inwestora',
      ref: 'market.tam',
    });
  }
  // "1% wielkiego rynku" — SOM ≈ płaski ułamek TAM zamiast z buildu (heurystyka: SOM/TAM bardzo małe i okrągłe)
  if (m.tamTopDown > 0) {
    const ratio = m.somValue / m.tamTopDown;
    if (ratio > 0 && ratio <= 0.012 && Math.abs(ratio - 0.01) < 0.003) {
      out.push({
        pattern: 'one_percent_of_market',
        severity: 'flag',
        detail: `SOM ≈ ${(ratio * 100).toFixed(1)}% TAM — wygląda na "1% rynku", nie z buildu GTM`,
        ref: 'market.som',
      });
    }
  }
  // triangulacja rozjazd >15%
  const bottomUp = m.bottomUpCustomers * m.bottomUpArpu;
  const ref = m.somValue || bottomUp;
  if (ref > 0 && Math.abs(bottomUp - ref) / ref > 0.15) {
    out.push({
      pattern: 'tam_unsourced_or_topdown_only',
      severity: 'flag',
      detail: `bottom-up (${Math.round(bottomUp)}) vs SOM (${m.somValue}) rozjazd >15%`,
      ref: 'market.reconciliation',
    });
  }
  // przychód SaaS bez CAC
  if ((!input.drivers.cac || input.drivers.cac <= 0) && input.drivers.saasSeatsStart > 0) {
    out.push({
      pattern: 'revenue_ramp_without_cac',
      severity: 'reject',
      detail: 'Rampa SaaS bez CAC',
      ref: 'ue.cac',
    });
  }
  // false precision: nierealnie precyzyjne udziały bez źródła (np. churn 0.1234)
  const tooPrecise = (v: number) => Math.abs((v * 10000) % 1) > 0 && v < 1 && v > 0;
  if (tooPrecise(input.drivers.grossChurnAnnual) && !input.sources?.['churn']) {
    out.push({
      pattern: 'false_precision',
      severity: 'flag',
      detail: `churn ${input.drivers.grossChurnAnnual} zbyt precyzyjny bez źródła`,
      ref: 'saas.gross_churn',
    });
  }
  return out;
}
