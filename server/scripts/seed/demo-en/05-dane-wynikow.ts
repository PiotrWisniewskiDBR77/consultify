/**
 * D5 — DANE modułów Wyniki i Finanse dla organizacji „Northwind Manufacturing
 * Ltd." (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D5, §3.1 poz. 8-9).
 *
 * Ten plik trzyma WYŁĄCZNIE treść (po angielsku) i słowniki. Mechanika —
 * `05-wyniki-finanse.ts`. Podział jak D3 (`03-dane-inicjatyw.ts` +
 * `03-inicjatywy.ts`), żeby plik wykonawczy dało się czytać.
 *
 * KAŻDY tekst poniżej jest po angielsku — to jest przedmiot paczki. Polskie
 * są tylko komentarze.
 */

// ============================================================================
// Osoby (slug e-maila) i inicjatywy (slug tytułu) z paczek D1 i D3
// ============================================================================
export type SlugOsoby =
  | 'james.whitfield'
  | 'sarah.mitchell'
  | 'robert.chen'
  | 'emily.carter'
  | 'daniel.osei'
  | 'laura.novak'
  | 'michael.grant'
  | 'priya.sharma'
  | 'thomas.baker';

/** Tytuły inicjatyw D3 — po nich (a nie po zgadywanym UUID) szukamy id w bazie. */
export const TYTUL_INICJATYWY = {
  mes: 'MES Rollout Line 3',
  predictive: 'Predictive Maintenance for CNC Line',
  warehouse: 'Warehouse Automation Pilot',
  skills: 'Skills Matrix and Upskilling',
  energy: 'Energy Monitoring and ISO 50001',
  scrap: 'Scrap Reduction Programme',
  supplier: 'Supplier Quality Gate',
  handover: 'Shift Handover Digitisation',
} as const;
export type KluczInicjatywy = keyof typeof TYTUL_INICJATYWY;

// ============================================================================
// KPI — 8 definicji × 6 pomiarów
// ============================================================================
export interface Kpi {
  kod: string;
  nazwa: string;
  opis: string;
  jednostka: string;
  /** `threshold_min` = wyżej lepiej, `threshold_max` = niżej lepiej. */
  geometria: 'threshold_min' | 'threshold_max';
  targetValue: number;
  targetMin: number | null;
  targetMax: number | null;
  warningLow: number | null;
  warningHigh: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  formula: string;
  czestotliwoscDni: number;
  wlasciciel: SlugOsoby;
  inicjatywa: KluczInicjatywy;
  /** Kierunek wpływu inicjatywy na KPI (`rvn_kpi_initiative_impacts`). */
  kierunekWplywu: 'increase' | 'decrease';
  wkladOczekiwany: number;
  zrodloPomiaru: string;
  /** 6 pomiarów: styczeń–czerwiec 2026, w kolejności chronologicznej. */
  pomiary: number[];
}

/** Sześć miesięcy 2026 — wspólne okna pomiarowe dla wszystkich ośmiu KPI. */
export const OKRESY_POMIAROW: Array<{ etykieta: string; od: string; do: string }> = [
  { etykieta: 'January 2026', od: '2026-01-01T00:00:00.000Z', do: '2026-01-31T23:59:59.000Z' },
  { etykieta: 'February 2026', od: '2026-02-01T00:00:00.000Z', do: '2026-02-28T23:59:59.000Z' },
  { etykieta: 'March 2026', od: '2026-03-01T00:00:00.000Z', do: '2026-03-31T23:59:59.000Z' },
  { etykieta: 'April 2026', od: '2026-04-01T00:00:00.000Z', do: '2026-04-30T23:59:59.000Z' },
  { etykieta: 'May 2026', od: '2026-05-01T00:00:00.000Z', do: '2026-05-31T23:59:59.000Z' },
  { etykieta: 'June 2026', od: '2026-06-01T00:00:00.000Z', do: '2026-06-30T23:59:59.000Z' },
];

export const KPI: Kpi[] = [
  {
    kod: 'NW-OEE-L3',
    nazwa: 'OEE — Line 3',
    opis:
      'Overall Equipment Effectiveness of assembly Line 3 in Rotherham, calculated as availability x performance x quality against the planned production window. Line 3 is the constraint of the Rotherham value stream, so its OEE sets the ceiling for the whole plant. The MES rollout is expected to lift it by removing manual changeover logging and giving supervisors live loss data.',
    jednostka: '%',
    geometria: 'threshold_min',
    targetValue: 78,
    targetMin: 78,
    targetMax: null,
    warningLow: 74,
    warningHigh: null,
    criticalLow: 70,
    criticalHigh: null,
    formula: 'availability x performance x quality, planned production time only',
    czestotliwoscDni: 30,
    wlasciciel: 'sarah.mitchell',
    inicjatywa: 'mes',
    kierunekWplywu: 'increase',
    wkladOczekiwany: 7,
    zrodloPomiaru: 'MES shift export, Rotherham Line 3',
    pomiary: [70.8, 71.6, 72.9, 74.1, 75.4, 76.2],
  },
  {
    kod: 'NW-SCRAP',
    nazwa: 'Scrap Rate',
    opis:
      'Scrapped material as a share of material issued to production across both plants. Scrap is the single largest controllable cost line after direct labour and it hides quality problems that only surface at final inspection. The scrap reduction programme targets the three part families that account for two thirds of the loss.',
    jednostka: '%',
    geometria: 'threshold_max',
    targetValue: 2.5,
    targetMin: null,
    targetMax: 2.5,
    warningLow: null,
    warningHigh: 3.0,
    criticalLow: null,
    criticalHigh: 3.6,
    formula: 'scrapped material value / material issued to production',
    czestotliwoscDni: 30,
    wlasciciel: 'robert.chen',
    inicjatywa: 'scrap',
    kierunekWplywu: 'decrease',
    wkladOczekiwany: -0.9,
    zrodloPomiaru: 'ERP scrap postings, both plants',
    pomiary: [3.42, 3.31, 3.18, 2.97, 2.84, 2.71],
  },
  {
    kod: 'NW-OTD',
    nazwa: 'On-Time Delivery',
    opis:
      'Share of customer order lines despatched on or before the confirmed delivery date. Two automotive customers have contractual penalties below 95 percent, so this measure carries direct revenue risk. Warehouse automation is expected to remove the picking backlog that causes most late despatches on Fridays.',
    jednostka: '%',
    geometria: 'threshold_min',
    targetValue: 96,
    targetMin: 96,
    targetMax: null,
    warningLow: 94,
    warningHigh: null,
    criticalLow: 92,
    criticalHigh: null,
    formula: 'order lines despatched on or before confirmed date / total order lines',
    czestotliwoscDni: 30,
    wlasciciel: 'emily.carter',
    inicjatywa: 'warehouse',
    kierunekWplywu: 'increase',
    wkladOczekiwany: 4,
    zrodloPomiaru: 'ERP despatch confirmations',
    pomiary: [91.7, 92.4, 93.1, 94.0, 94.8, 95.6],
  },
  {
    kod: 'NW-ENERGY',
    nazwa: 'Energy Intensity',
    opis:
      'Electricity and gas consumption per finished unit, normalised for product mix. Energy is the fastest growing overhead at Northwind and the ISO 50001 certification requires a documented, improving trend. Sub-metering installed under the energy monitoring initiative makes the figure auditable per line rather than per site.',
    jednostka: 'kWh/unit',
    geometria: 'threshold_max',
    targetValue: 4.2,
    targetMin: null,
    targetMax: 4.2,
    warningLow: null,
    warningHigh: 4.5,
    criticalLow: null,
    criticalHigh: 4.9,
    formula: 'total site energy consumption / finished units, mix-normalised',
    czestotliwoscDni: 30,
    wlasciciel: 'laura.novak',
    inicjatywa: 'energy',
    kierunekWplywu: 'decrease',
    wkladOczekiwany: -0.8,
    zrodloPomiaru: 'Sub-meter readings, Leeds and Rotherham',
    pomiary: [5.05, 4.94, 4.81, 4.66, 4.53, 4.41],
  },
  {
    kod: 'NW-FPY',
    nazwa: 'First Pass Yield',
    opis:
      'Share of units passing final inspection without any rework or concession. First pass yield exposes upstream problems that scrap rate alone hides, because reworked units still reach the customer. The supplier quality gate targets incoming material variation, which currently drives roughly half of the failures.',
    jednostka: '%',
    geometria: 'threshold_min',
    targetValue: 94,
    targetMin: 94,
    targetMax: null,
    warningLow: 92,
    warningHigh: null,
    criticalLow: 90,
    criticalHigh: null,
    formula: 'units passing final inspection first time / units presented',
    czestotliwoscDni: 30,
    wlasciciel: 'robert.chen',
    inicjatywa: 'supplier',
    kierunekWplywu: 'increase',
    wkladOczekiwany: 3.5,
    zrodloPomiaru: 'Final inspection records',
    pomiary: [90.2, 90.9, 91.6, 92.3, 92.9, 93.4],
  },
  {
    kod: 'NW-DOWNTIME',
    nazwa: 'Unplanned Downtime',
    opis:
      'Hours of unplanned machine stoppage per month across the CNC cells and both assembly lines. Unplanned downtime is what turns a healthy order book into late deliveries, and it is the measure maintenance and production argue about most. Predictive maintenance replaces the argument with vibration and spindle-load evidence.',
    jednostka: 'hours/month',
    geometria: 'threshold_max',
    targetValue: 40,
    targetMin: null,
    targetMax: 40,
    warningLow: null,
    warningHigh: 48,
    criticalLow: null,
    criticalHigh: 58,
    formula: 'sum of unplanned stoppage hours across CNC cells and assembly lines',
    czestotliwoscDni: 30,
    wlasciciel: 'daniel.osei',
    inicjatywa: 'predictive',
    kierunekWplywu: 'decrease',
    wkladOczekiwany: -22,
    zrodloPomiaru: 'CMMS work orders and MES stoppage log',
    pomiary: [62.5, 59.0, 55.5, 51.0, 47.5, 44.0],
  },
  {
    kod: 'NW-INV-TURNS',
    nazwa: 'Inventory Turns',
    opis:
      'Annualised cost of goods sold divided by average inventory value. Northwind holds roughly eleven weeks of stock, which ties up working capital the transformation programme needs. Warehouse automation and the associated slotting review are the main levers on this measure in 2026.',
    jednostka: 'turns/year',
    geometria: 'threshold_min',
    targetValue: 9,
    targetMin: 9,
    targetMax: null,
    warningLow: 8,
    warningHigh: null,
    criticalLow: 7,
    criticalHigh: null,
    formula: 'annualised cost of goods sold / average inventory value',
    czestotliwoscDni: 30,
    wlasciciel: 'thomas.baker',
    inicjatywa: 'warehouse',
    kierunekWplywu: 'increase',
    wkladOczekiwany: 2.4,
    zrodloPomiaru: 'Monthly management accounts',
    pomiary: [6.6, 6.9, 7.2, 7.6, 7.9, 8.3],
  },
  {
    kod: 'NW-TRAINING',
    nazwa: 'Training Hours per FTE',
    opis:
      'Recorded training hours per full-time equivalent per quarter, counting only completed and signed-off sessions. Northwind has an ageing skills profile and the skills matrix initiative depends on protected training time actually being taken, not merely scheduled. The measure is reported monthly as a rolling quarterly figure.',
    jednostka: 'hours/quarter',
    geometria: 'threshold_min',
    targetValue: 12,
    targetMin: 12,
    targetMax: null,
    warningLow: 10,
    warningHigh: null,
    criticalLow: 8,
    criticalHigh: null,
    formula: 'completed training hours / full-time equivalents, rolling quarter',
    czestotliwoscDni: 30,
    wlasciciel: 'priya.sharma',
    inicjatywa: 'skills',
    kierunekWplywu: 'increase',
    wkladOczekiwany: 5,
    zrodloPomiaru: 'Learning management system export',
    pomiary: [6.8, 7.4, 8.3, 9.1, 10.0, 10.8],
  },
];

// ============================================================================
// RAPORT KPI (karta wyników) — POZIOM 1 modułu Wyniki
//
// Zakładka „KPI" nie pokazuje definicji, tylko RAPORTY
// (`ResultsKpiRegistryPage.tsx:908` — domyślna zakładka to `scorecards`,
// SSOT_WYNIKI_KPI_OKR_ROI.md §6/P7K: „raport jest TABELĄ mierników").
// Osiem definicji bez raportu daje ekran „No KPI reports yet" — pusty mimo
// kompletnych danych. Zmierzone zrzutem 08.09, nie założone.
// ============================================================================
export const RAPORT_KPI = {
  nazwa: 'Northwind 2027 — monthly performance report',
  opis:
    'The monthly operational performance report reviewed at the plant management meeting. It carries the eight transformation measures agreed for 2026: four leading indicators the shift teams can move within a week, and four lagging measures the steering group is held to.',
  scopeType: 'organization' as const,
  reviewFrequency: 'monthly' as const,
  wlasciciel: 'sarah.mitchell' as SlugOsoby,
  /** Kody KPI w kolejności prezentacji; `primary` = miernik nagłówkowy. */
  pozycje: [
    { kod: 'NW-OEE-L3', rola: 'primary' as const },
    { kod: 'NW-SCRAP', rola: 'primary' as const },
    { kod: 'NW-OTD', rola: 'primary' as const },
    { kod: 'NW-DOWNTIME', rola: 'primary' as const },
    { kod: 'NW-FPY', rola: 'supporting' as const },
    { kod: 'NW-ENERGY', rola: 'supporting' as const },
    { kod: 'NW-INV-TURNS', rola: 'supporting' as const },
    { kod: 'NW-TRAINING', rola: 'supporting' as const },
  ],
};

// ============================================================================
// OKR — 1 program, 1 cykl kwartalny 2026, 1 zestaw firmowy, 3 cele
// ============================================================================
export const OKR_PROGRAM = {
  nazwa: 'Northwind 2027 Transformation OKRs',
  /** Wszystkie pola polityki podane JAWNIE — kolumny `okr_vnext_programs` są
   * NOT NULL, a komenda wstawia dokładnie to, co przyszło w ciele (brak pola
   * = NULL = błąd 500). Zmierzone 08.09 na kopii d5. */
  polityka: {
    cycleModel: 'quarterly' as const,
    annualDirectionEnabled: true,
    objectiveMinRecommended: 2,
    objectiveMaxRecommended: 5,
    krMinRequired: 2,
    krMaxRecommended: 5,
    checkinFrequency: 'biweekly' as const,
    approvalRequired: true,
    scoringModel: 'zero_to_one' as const,
    objectiveRollupModel: 'weighted_average' as const,
    confidenceEnabled: true,
    confidenceModel: 'high_medium_low' as const,
    objectiveConfidenceModel: 'lowest_kr' as const,
    visibilityDefault: 'OPEN_ORG' as const,
    committedVsAspirationalEnabled: true,
    managerReviewRequired: true,
    selfReviewRequired: false,
    reflectionRequiredForClose: false,
    recognitionEnabled: true,
  },
};

/** Pola nazwane jak w ciele żądania `POST /okr/cycles` — ten obiekt idzie do
 * API w całości, więc własne nazewnictwo byłoby tu tylko pułapką. */
export const OKR_CYKL = {
  name: 'FY2026 Q3 — Jul to Sep',
  startDate: '2026-07-01T00:00:00.000Z',
  endDate: '2026-09-30T00:00:00.000Z',
  draftOpenAt: '2026-06-08T00:00:00.000Z',
  submissionDueAt: '2026-06-22T00:00:00.000Z',
  approvalDueAt: '2026-06-29T00:00:00.000Z',
  activeStartAt: '2026-07-01T00:00:00.000Z',
  midcycleReviewAt: '2026-08-14T00:00:00.000Z',
  finalUpdateDueAt: '2026-09-24T00:00:00.000Z',
  reviewOpenAt: '2026-09-25T00:00:00.000Z',
  reflectionDueAt: '2026-09-28T00:00:00.000Z',
  managerReviewDueAt: '2026-09-29T00:00:00.000Z',
  closeAt: '2026-09-30T00:00:00.000Z',
};

export const OKR_ZESTAW = {
  tytul: 'Northwind 2027 — company OKRs, Q3 FY2026',
  scopeType: 'company' as const,
  wlasciciel: 'james.whitfield' as SlugOsoby,
  recenzent: 'sarah.mitchell' as SlugOsoby,
};

export interface KluczowyWynik {
  tytul: string;
  opis: string;
  measurementType: 'numeric' | 'percentage' | 'currency' | 'binary' | 'milestone' | 'custom';
  direction: 'increase' | 'decrease' | 'reach' | 'maintain_range' | 'binary';
  jednostka: string | null;
  baselineValue: number;
  targetValue: number;
  currentValue: number;
  confidence: 'high' | 'medium' | 'low';
  wlasciciel: SlugOsoby;
  waga: number;
}

export interface CelOkr {
  tytul: string;
  opis: string;
  uzasadnienie: string;
  ambicja: 'committed' | 'aspirational' | 'standard';
  wlasciciel: SlugOsoby;
  kluczoweWyniki: KluczowyWynik[];
}

export const OKR_CELE: CelOkr[] = [
  {
    tytul: 'Lift equipment effectiveness across both plants',
    opis:
      'Make Line 3 and the CNC cells produce reliably at the rate the order book already assumes, without adding shifts or capital beyond the approved programme.',
    uzasadnienie:
      'Rotherham Line 3 is the constraint of the whole value stream. Every point of OEE it gains releases capacity that today is bought back as weekend overtime.',
    ambicja: 'committed',
    wlasciciel: 'sarah.mitchell',
    kluczoweWyniki: [
      {
        tytul: 'Raise Line 3 OEE from 71 to 78 percent',
        opis: 'Measured on planned production time only, from the MES shift export.',
        measurementType: 'percentage',
        direction: 'increase',
        jednostka: '%',
        baselineValue: 70.8,
        targetValue: 78,
        currentValue: 76.2,
        confidence: 'high',
        wlasciciel: 'sarah.mitchell',
        waga: 60,
      },
      {
        tytul: 'Cut unplanned downtime from 62 to 40 hours per month',
        opis: 'Across the CNC cells and both assembly lines, from the CMMS work orders.',
        measurementType: 'numeric',
        direction: 'decrease',
        jednostka: 'hours/month',
        baselineValue: 62.5,
        targetValue: 40,
        currentValue: 44,
        confidence: 'medium',
        wlasciciel: 'daniel.osei',
        waga: 40,
      },
    ],
  },
  {
    tytul: 'Make quality the cheapest option',
    opis:
      'Stop paying twice for the same part. Cut scrap and rework at source rather than catching defects at final inspection.',
    uzasadnienie:
      'Scrap and rework together cost Northwind more than the entire transformation programme budget for 2026. Half of it traces back to incoming material variation.',
    ambicja: 'committed',
    wlasciciel: 'robert.chen',
    kluczoweWyniki: [
      {
        tytul: 'Reduce scrap rate from 3.4 to 2.5 percent',
        opis: 'Scrapped material value as a share of material issued, both plants.',
        measurementType: 'percentage',
        direction: 'decrease',
        jednostka: '%',
        baselineValue: 3.42,
        targetValue: 2.5,
        currentValue: 2.71,
        confidence: 'high',
        wlasciciel: 'robert.chen',
        waga: 50,
      },
      {
        tytul: 'Lift first pass yield from 90 to 94 percent',
        opis: 'Units passing final inspection without rework or concession.',
        measurementType: 'percentage',
        direction: 'increase',
        jednostka: '%',
        baselineValue: 90.2,
        targetValue: 94,
        currentValue: 93.4,
        confidence: 'medium',
        wlasciciel: 'laura.novak',
        waga: 50,
      },
    ],
  },
  {
    tytul: 'Build a digitally confident frontline',
    opis:
      'Give operators and team leaders the skills and the digital tools to run the new way of working without a consultant standing behind them.',
    uzasadnienie:
      'Every previous improvement attempt at Northwind decayed within two quarters because the standard lived in a binder. This time the standard lives in the tool the shift actually uses.',
    ambicja: 'aspirational',
    wlasciciel: 'priya.sharma',
    kluczoweWyniki: [
      {
        tytul: 'Deliver 12 training hours per FTE per quarter',
        opis: 'Completed and signed-off sessions only, from the learning management system.',
        measurementType: 'numeric',
        direction: 'increase',
        jednostka: 'hours/quarter',
        baselineValue: 6.8,
        targetValue: 12,
        currentValue: 10.8,
        confidence: 'medium',
        wlasciciel: 'priya.sharma',
        waga: 50,
      },
      {
        tytul: 'Move every shift handover to the digital form',
        opis: 'Share of shift handovers recorded in the digital form rather than on paper.',
        measurementType: 'percentage',
        direction: 'increase',
        jednostka: '%',
        baselineValue: 0,
        targetValue: 100,
        currentValue: 55,
        confidence: 'low',
        wlasciciel: 'michael.grant',
        waga: 50,
      },
    ],
  },
];

// ============================================================================
// ROI — 1 przypadek inwestycyjny dla „MES Rollout Line 3"
// ============================================================================
export const ROI_PRZYPADEK = {
  tytul: 'MES Rollout Line 3 — investment case',
  inicjatywa: 'mes' as KluczInicjatywy,
  wlasciciel: 'thomas.baker' as SlugOsoby,
  waluta: 'GBP',
  granularity: 'annual' as const,
  analysisStart: '2026-01-01T00:00:00.000Z',
  analysisEnd: '2028-12-31T00:00:00.000Z',
  polityka: {
    discountRatePct: 9,
    taxTreatment: 'pre_tax' as const,
    inflationRatePct: 2.5,
    roundingPolicy: 'half_up_2dp' as const,
    notes:
      'Discount rate agreed with the Finance Controller as the group weighted average cost of capital plus one point for delivery risk. Benefits are stated pre-tax and before inflation indexation.',
    confidence: 'medium' as const,
  },
  zalozenia: [
    {
      category: 'Volume',
      label: 'Line 3 saleable units per year',
      unit: 'units',
      baseValue: 186000,
      downsideValue: 172000,
      upsideValue: 198000,
      confidence: 'high' as const,
      source: 'FY2025 despatch history, mix-adjusted',
      notes: 'Order book for 2026 is already covered to 88 percent by framework agreements.',
      sensitivityRank: 1,
    },
    {
      category: 'Margin',
      label: 'Contribution margin per unit',
      unit: 'GBP/unit',
      baseValue: 31.4,
      downsideValue: 27.0,
      upsideValue: 34.0,
      confidence: 'medium' as const,
      source: 'FY2025 management accounts, Line 3 product family',
      notes: 'Excludes the two lowest-margin legacy parts scheduled for withdrawal in 2027.',
      sensitivityRank: 2,
    },
    {
      category: 'Adoption',
      label: 'Share of shifts using MES loss capture',
      unit: '%',
      baseValue: 90,
      downsideValue: 65,
      upsideValue: 100,
      confidence: 'low' as const,
      source: 'Pilot cell adoption over eight weeks',
      notes: 'The downside case assumes night shift keeps paper logging for the first year.',
      sensitivityRank: 3,
    },
  ],
  kosztyLinie: [
    {
      category: 'Software',
      label: 'MES licences and implementation',
      description:
        'Perpetual licences for 3 lines plus vendor implementation, interface build to the ERP and eight weeks of on-site support.',
      amount: 482000,
      timingType: 'one_time' as const,
      oneTimePeriodDate: '2026-03-31T00:00:00.000Z',
      confidence: 'high' as const,
      source: 'Signed vendor quotation, February 2026',
    },
    {
      category: 'Hardware',
      label: 'Line 3 edge hardware and network',
      description:
        'Industrial panel PCs at six stations, PLC gateway modules, shopfloor wireless upgrade and the associated installation work.',
      amount: 146500,
      timingType: 'one_time' as const,
      oneTimePeriodDate: '2026-04-30T00:00:00.000Z',
      confidence: 'high' as const,
      source: 'Two competitive quotations, average taken',
    },
    {
      category: 'Run cost',
      label: 'MES support, hosting and internal run team',
      description:
        'Annual vendor support contract, hosting, and 0.5 FTE of internal application support from the automation team.',
      amount: 63000,
      timingType: 'recurring' as const,
      recurrenceStartDate: '2026-07-01T00:00:00.000Z',
      recurrenceEndDate: '2028-12-31T00:00:00.000Z',
      recurrenceCadence: 'annual' as const,
      confidence: 'medium' as const,
      source: 'Vendor support schedule plus internal rate card',
    },
  ],
  korzysciLinie: [
    {
      category: 'Throughput',
      label: 'Throughput gain from higher OEE on Line 3',
      description:
        'Seven points of OEE released as saleable volume, valued at the Line 3 contribution margin. Benefit ramps over four quarters as the loss-capture discipline beds in.',
      amount: 412000,
      timingType: 'recurring' as const,
      recurrenceStartDate: '2026-07-01T00:00:00.000Z',
      recurrenceEndDate: '2028-12-31T00:00:00.000Z',
      recurrenceCadence: 'annual' as const,
      rampPeriods: 4,
      confidence: 'medium' as const,
      source: 'Constraint model agreed with Operations and Finance',
      kpi: 'NW-OEE-L3',
      celWiazania: 'primary_evidence' as const,
    },
    {
      category: 'Quality',
      label: 'Scrap reduction on Line 3 part families',
      description:
        'Live in-process measurement lets operators stop a drifting process within one pallet instead of one shift, cutting scrapped material on the three worst part families.',
      amount: 138000,
      timingType: 'recurring' as const,
      recurrenceStartDate: '2026-10-01T00:00:00.000Z',
      recurrenceEndDate: '2028-12-31T00:00:00.000Z',
      recurrenceCadence: 'annual' as const,
      rampPeriods: 2,
      confidence: 'medium' as const,
      source: 'Pilot cell scrap comparison, eight weeks',
      kpi: 'NW-SCRAP',
      celWiazania: 'primary_evidence' as const,
    },
    {
      category: 'Availability',
      label: 'Avoided cost of unplanned downtime',
      description:
        'Automatic stoppage capture removes the reporting delay that currently keeps maintenance blind for a full shift, shortening mean time to repair.',
      amount: 96000,
      timingType: 'recurring' as const,
      recurrenceStartDate: '2026-10-01T00:00:00.000Z',
      recurrenceEndDate: '2028-12-31T00:00:00.000Z',
      recurrenceCadence: 'annual' as const,
      rampPeriods: 2,
      confidence: 'low' as const,
      source: 'Maintenance downtime cost model, FY2025 rates',
      kpi: 'NW-DOWNTIME',
      celWiazania: 'supporting' as const,
    },
  ],
};

// ============================================================================
// FINANSE — 1 paczka sprawozdań (4 kwartały, GBP) + 1 budżet programu
// ============================================================================
export const PACZKA_SPRAWOZDAN = {
  slug: 'northwind-quarterly-fy2026',
  entityName: 'Northwind Manufacturing Ltd.',
  periodLabel: 'Q3 FY2025 – Q2 FY2026',
  periodStart: '2025-07-01',
  periodEnd: '2026-06-30',
  currency: 'GBP',
  /** Wartości w tysiącach funtów — tak jest oznaczone `scaling`. */
  scaling: 'thousands' as const,
};

export interface SprawozdanieKwartalne {
  slug: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  /** Wartości w kolejności `LINIE_PL` (tysiące GBP). */
  wartosci: number[];
}

/** Jedenaście systemowych linii kanonicznych P&L, w kolejności prezentacji.
 * Identyfikatory zweryfikowane zapytaniem na `financial_statement_lines`
 * (`is_system = TRUE`) — nie zakładane. */
export const LINIE_PL: Array<{ id: string; etykieta: string }> = [
  { id: 'fsl-pl-revenue', etykieta: 'Revenue' },
  { id: 'fsl-pl-cogs', etykieta: 'Cost of Goods Sold' },
  { id: 'fsl-pl-gross', etykieta: 'Gross Profit' },
  { id: 'fsl-pl-opex', etykieta: 'Operating Expenses (SG&A)' },
  { id: 'fsl-pl-ebitda', etykieta: 'EBITDA' },
  { id: 'fsl-pl-depreciation', etykieta: 'Depreciation & Amortization' },
  { id: 'fsl-pl-ebit', etykieta: 'EBIT / Operating Profit' },
  { id: 'fsl-pl-interest', etykieta: 'Interest Expense' },
  { id: 'fsl-pl-ebt', etykieta: 'Earnings Before Tax' },
  { id: 'fsl-pl-tax', etykieta: 'Income Tax Expense' },
  { id: 'fsl-pl-net', etykieta: 'Net Income' },
];

/** Kolejność wartości = kolejność `LINIE_PL`. Rachunek się domyka:
 * gross = revenue - cogs; ebitda = gross - opex; ebit = ebitda - dep;
 * ebt = ebit - interest; net = ebt - tax. */
export const SPRAWOZDANIA: SprawozdanieKwartalne[] = [
  {
    slug: 'q3-fy2025',
    periodLabel: 'Q3 2025 (Jul–Sep)',
    periodStart: '2025-07-01',
    periodEnd: '2025-09-30',
    wartosci: [11420, 8194, 3226, 2088, 1138, 402, 736, 148, 588, 147, 441],
  },
  {
    slug: 'q4-fy2025',
    periodLabel: 'Q4 2025 (Oct–Dec)',
    periodStart: '2025-10-01',
    periodEnd: '2025-12-31',
    wartosci: [12680, 9002, 3678, 2214, 1464, 408, 1056, 151, 905, 226, 679],
  },
  {
    slug: 'q1-fy2026',
    periodLabel: 'Q1 2026 (Jan–Mar)',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    wartosci: [11960, 8372, 3588, 2151, 1437, 415, 1022, 145, 877, 219, 658],
  },
  {
    slug: 'q2-fy2026',
    periodLabel: 'Q2 2026 (Apr–Jun)',
    periodStart: '2026-04-01',
    periodEnd: '2026-06-30',
    wartosci: [12840, 8834, 4006, 2246, 1760, 431, 1329, 142, 1187, 297, 890],
  },
];

export const BUDZET = {
  tytul: 'Northwind 2027 Programme Budget — FY2026',
  opis:
    'Consolidated budget for the Northwind 2027 operational transformation programme: the four initiatives in execution plus the shared programme run cost. Figures are the approved plan agreed at the February 2026 steering group and are stated in pounds sterling.',
  projekt: 'Operational Excellence Programme',
  periodStart: '2026-01-01',
  periodEnd: '2026-12-31',
  granularity: 'quarterly' as const,
  waluta: 'GBP',
  /** Wartości bazowe dla 15 kanonicznych pozycji, które zakłada pisarz
   * `registerBudget` (`budgetRegistrationService.ts`). Klucz = `line_code`. */
  wartosciLinii: {
    REVENUE: '49320000.00',
    COGS: '34486000.00',
    GROSS_PROFIT: '14834000.00',
    OPEX: '8899000.00',
    EBITDA: '5935000.00',
    DEPRECIATION: '1682000.00',
    EBIT: '4253000.00',
    INTEREST_EXPENSE: '586000.00',
    TAX: '917000.00',
    NET_INCOME: '2750000.00',
    OPERATING_CF: '4980000.00',
    CAPEX: '1640000.00',
    FCF: '3340000.00',
    FINANCING_CF: '-820000.00',
    NET_CF: '2520000.00',
  } as Record<string, string>,
  /** Inicjatywy, które programowo konsumują ten budżet (`budget_initiative_links`). */
  inicjatywy: ['mes', 'predictive', 'warehouse', 'skills'] as KluczInicjatywy[],
};
