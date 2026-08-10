/**
 * Financial Case — factories for empty drivers/case (no fabricated numbers:
 * every numeric field starts at 0 / empty, never a plausible-looking sample).
 */
import type {
  FinancialBenefitType,
  FinancialCaseInput,
  FinancialCostType,
  FinancialDriver,
  FinancialDriverKind,
} from './financialTypes';

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

export function currentPeriodKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function createEmptyDriver(
  kind: FinancialDriverKind,
  subtype?: FinancialCostType | FinancialBenefitType
): FinancialDriver {
  const now = new Date().toISOString();
  return {
    id: nextId('drv'),
    label: '',
    kind,
    costType: kind === 'cost' ? ((subtype as FinancialCostType) ?? 'investment') : undefined,
    benefitType: kind === 'benefit' ? ((subtype as FinancialBenefitType) ?? 'cash') : undefined,
    category: '',
    unit: 'PLN',
    monthlyValues: {},
    scenarioMultipliers: {},
    confidence: 'medium',
    evidence: [],
    notes: undefined,
    updatedAt: now,
  };
}

export function createEmptyCase(): FinancialCaseInput {
  return {
    currency: 'PLN',
    discountRatePct: 10,
    startPeriod: currentPeriodKey(),
    horizonMonths: 12,
    drivers: [],
    scenarios: ['base', 'upside', 'downside'],
  };
}

/** Generates the ordered list of period keys ('YYYY-MM') covered by a case. */
export function periodKeysForCase(startPeriod: string, horizonMonths: number): string[] {
  const [yStr, mStr] = startPeriod.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || horizonMonths <= 0) return [];
  const out: string[] = [];
  for (let i = 0; i < horizonMonths; i++) {
    const total = m - 1 + i;
    const yy = y + Math.floor(total / 12);
    const mm = (total % 12) + 1;
    out.push(`${yy}-${String(mm).padStart(2, '0')}`);
  }
  return out;
}
