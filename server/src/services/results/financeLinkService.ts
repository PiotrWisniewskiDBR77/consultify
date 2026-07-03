/**
 * financeLinkService — czysty adapter spinający wartość M15 (Rezultaty/KPI)
 * z liniami finansowymi P&L / BS / CF (M16 Finanse). Jedno źródło prawdy
 * dla translacji „delta KPI" → „wpływ na linię finansową".
 *
 * Bez zależności od DB — to deterministyczny adapter liczbowy/formatujący.
 * M15/W6 (6.6).
 */

export type StatementType = 'P&L' | 'BS' | 'CF';

export type ImpactDirection = 'positive' | 'negative' | 'neutral';

export interface KpiFinanceMapping {
  kpiId: string;
  statementLineId: string;
  statementType: StatementType;
  /** Skala przeliczenia delty KPI na jednostkę finansową. Domyślnie 1. */
  multiplier?: number;
  /** Znak wpływu: positive=+1, negative=-1, neutral=0. Domyślnie positive. */
  direction?: ImpactDirection;
  /** Zmiana wartości KPI (aktual − baza). Domyślnie 0. */
  kpiDelta?: number;
}

export interface StatementLineImpact {
  statementLineId: string;
  statementType: StatementType;
  totalImpact: number;
}

export interface FinanceBridgeEntry {
  lineId: string;
  statementType: StatementType;
  value: number;
  source: 'M15_BENEFITS';
}

/** Wszystkie typy sprawozdań w stałej kolejności. */
const STATEMENT_TYPES: StatementType[] = ['P&L', 'BS', 'CF'];

function sign(direction: ImpactDirection | undefined): number {
  switch (direction) {
    case 'negative':
      return -1;
    case 'neutral':
      return 0;
    case 'positive':
    default:
      return 1;
  }
}

function safeNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Agreguje wpływ finansowy delt KPI per linia sprawozdania.
 * impact = kpiDelta × multiplier × sign(direction); sumowane per statementLineId.
 */
export function aggregateKpiFinancialImpact(
  mappings: KpiFinanceMapping[],
): StatementLineImpact[] {
  const byLine = new Map<string, StatementLineImpact>();

  for (const m of mappings) {
    if (!m || !m.statementLineId) continue;

    const kpiDelta = safeNumber(m.kpiDelta, 0);
    const multiplier = safeNumber(m.multiplier, 1);
    const impact = kpiDelta * multiplier * sign(m.direction);

    // Klucz agregacji łączy linię i typ sprawozdania — ta sama linia w innym
    // sprawozdaniu pozostaje osobnym wierszem.
    const key = `${m.statementType}::${m.statementLineId}`;
    const existing = byLine.get(key);

    if (existing) {
      existing.totalImpact += impact;
    } else {
      byLine.set(key, {
        statementLineId: m.statementLineId,
        statementType: m.statementType,
        totalImpact: impact,
      });
    }
  }

  return Array.from(byLine.values());
}

/**
 * Sumuje całkowity wpływ per typ sprawozdania (P&L / BS / CF).
 * Zawsze zwraca komplet kluczy (brak danych = 0).
 */
export function financialImpactByStatement(
  impacts: StatementLineImpact[],
): Record<StatementType, number> {
  const result: Record<StatementType, number> = {
    'P&L': 0,
    BS: 0,
    CF: 0,
  };

  for (const impact of impacts) {
    if (!impact || !STATEMENT_TYPES.includes(impact.statementType)) continue;
    result[impact.statementType] += safeNumber(impact.totalImpact, 0);
  }

  return result;
}

/**
 * Mostkuje wpływy do formatu konsumowanego przez moduł M16 Finanse.
 * Każdy wpis jest oznaczony źródłem M15_BENEFITS (audytowalna proweniencja).
 */
export function bridgeToFinanceModule(
  impacts: StatementLineImpact[],
): FinanceBridgeEntry[] {
  return impacts.map((impact) => ({
    lineId: impact.statementLineId,
    statementType: impact.statementType,
    value: safeNumber(impact.totalImpact, 0),
    source: 'M15_BENEFITS' as const,
  }));
}

export default {
  aggregateKpiFinancialImpact,
  financialImpactByStatement,
  bridgeToFinanceModule,
};
