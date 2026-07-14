/**
 * benefitProfileService — M15/W1 task 1.2.
 *
 * Enriches raw KPI rows with a "benefit profile" overlay: inferred type
 * (financial / non-financial / strategic), category (revenue/cost/risk/
 * efficiency/customer), dis-benefit flag, and ownership hint.
 *
 * Pure & deterministic — uses heuristic rules on existing KPI fields;
 * no additional DB I/O required. A real benefit_profiles table can
 * replace these inferred fields in a later wave without changing the
 * interface consumed by the route.
 */

export type BenefitType = 'financial' | 'non-financial' | 'strategic';
export type BenefitCategory = 'revenue' | 'cost' | 'risk' | 'efficiency' | 'customer' | 'unknown';

export interface RawKpiInput {
  id: string;
  name: string;
  unit?: string | null;
  target_value?: number | null;
  current_value?: number | null;
  owner_name?: string | null;
  measurement_frequency?: string | null;
}

export interface BenefitProfile {
  kpiId: string;
  name: string;
  type: BenefitType;
  category: BenefitCategory;
  isDisBenefit: boolean;
  businessOwner: string | null;
  hasTarget: boolean;
  realizationPct: number | null;
}

const REVENUE_PATTERNS = [/revenue/i, /sprzedaż/i, /przychód/i, /income/i, /zysk/i, /profit/i];
const COST_PATTERNS = [
  /cost/i,
  /koszt/i,
  /wydatek/i,
  /expense/i,
  /savings?/i,
  /oszczędności/i,
  /redukcja/i,
];
const RISK_PATTERNS = [
  /risk/i,
  /ryzyko/i,
  /compliance/i,
  /incident/i,
  /defect/i,
  /błąd/i,
  /usterka/i,
];
const EFFICIENCY_PATTERNS = [
  /effic/i,
  /effekt/i,
  /czas/i,
  /time/i,
  /process/i,
  /proces/i,
  /wydajność/i,
  /lead.?time/i,
  /cycle/i,
];
const CUSTOMER_PATTERNS = [
  /customer/i,
  /klient/i,
  /nps/i,
  /satisfaction/i,
  /satysfakcja/i,
  /retention/i,
  /churn/i,
];

function inferCategory(name: string): BenefitCategory {
  if (REVENUE_PATTERNS.some((re) => re.test(name))) return 'revenue';
  if (COST_PATTERNS.some((re) => re.test(name))) return 'cost';
  if (RISK_PATTERNS.some((re) => re.test(name))) return 'risk';
  if (CUSTOMER_PATTERNS.some((re) => re.test(name))) return 'customer';
  if (EFFICIENCY_PATTERNS.some((re) => re.test(name))) return 'efficiency';
  return 'unknown';
}

function inferType(name: string, unit?: string | null): BenefitType {
  const lname = name.toLowerCase();
  const lunit = (unit || '').toLowerCase();
  // Financial indicators: currency units or known financial keywords
  if (/pln|zł|usd|eur|gbp|€|\$/.test(lunit)) return 'financial';
  if (/revenue|cost|koszt|przychód|income|profit|zysk|savings|oszczędności/.test(lname))
    return 'financial';
  // Strategic: if name has strategic keywords
  if (/strategic|strategiczny|capability|vision|brand|marka|pozycja|market.?share/.test(lname))
    return 'strategic';
  return 'non-financial';
}

function inferIsDisBenefit(name: string): boolean {
  return /dis.?benefit|negatyw|negative|reduction|redukcja|zmniejszenie|spadek|obniżenie/.test(
    name.toLowerCase()
  );
}

function realizationPct(
  current: number | null | undefined,
  target: number | null | undefined
): number | null {
  if (current == null || target == null || target === 0) return null;
  return Math.min(Math.max(current / target, 0), 2); // cap at 200%
}

export function buildBenefitProfile(kpi: RawKpiInput): BenefitProfile {
  return {
    kpiId: kpi.id,
    name: kpi.name,
    type: inferType(kpi.name, kpi.unit),
    category: inferCategory(kpi.name),
    isDisBenefit: inferIsDisBenefit(kpi.name),
    businessOwner: kpi.owner_name ?? null,
    hasTarget: kpi.target_value != null,
    realizationPct: realizationPct(kpi.current_value, kpi.target_value),
  };
}

export function buildBenefitProfiles(kpis: RawKpiInput[]): BenefitProfile[] {
  return kpis.map(buildBenefitProfile);
}

export interface BenefitProfileSummary {
  total: number;
  financial: number;
  nonFinancial: number;
  strategic: number;
  withTarget: number;
  disBenefits: number;
  byCategory: Record<BenefitCategory, number>;
}

export function benefitProfileSummary(profiles: BenefitProfile[]): BenefitProfileSummary {
  const byCategory: Record<BenefitCategory, number> = {
    revenue: 0,
    cost: 0,
    risk: 0,
    efficiency: 0,
    customer: 0,
    unknown: 0,
  };
  let financial = 0;
  let nonFinancial = 0;
  let strategic = 0;
  let withTarget = 0;
  let disBenefits = 0;

  for (const p of profiles) {
    if (p.type === 'financial') financial++;
    else if (p.type === 'non-financial') nonFinancial++;
    else strategic++;
    if (p.hasTarget) withTarget++;
    if (p.isDisBenefit) disBenefits++;
    byCategory[p.category]++;
  }

  return {
    total: profiles.length,
    financial,
    nonFinancial,
    strategic,
    withTarget,
    disBenefits,
    byCategory,
  };
}
