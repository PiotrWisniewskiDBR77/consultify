import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import * as audit from './auditService.js';

export type ValuationStatus = 'DRAFT' | 'REVIEW' | 'APPROVED';
export type ValuationSourceType = 'financial_model' | 'budget' | 'manual';

export type TerminalMethod = 'gordon' | 'exit_multiple';
export type ExitMultipleMetric = 'EV/EBITDA' | 'EV/Revenue';

export interface WaccBreakdown {
  riskFreeRate: number;
  equityRiskPremium: number;
  beta: number;
  costOfDebt: number;
  taxRate: number;
  debtWeight: number;
  equityWeight: number;
}

export interface ValuationAssumptions {
  horizonYears: number;
  waccPercent: number;
  waccBreakdown: WaccBreakdown;
  terminalMethod: TerminalMethod;
  terminalGrowthPercent?: number;
  exitMultiple?: number;
  exitMultipleMetric?: ExitMultipleMetric;
  netDebt?: number;
  sharesOutstanding?: number;
  manualForecast?: {
    years: Array<{ year: number; fcff: number; revenue?: number; ebitda?: number }>;
  };
}

export interface MultiplesInput {
  metric: ExitMultipleMetric | 'P/E';
  min: number;
  median: number;
  max: number;
  peerSet: Array<{ name: string; notes?: string }>;
  confidenceNote?: string;
}

function safeJsonParse<T>(raw: any, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function round(n: number, dp: number = 2): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function normalizeStatus(raw: any): ValuationStatus {
  const s = String(raw || '').toUpperCase();
  if (s === 'REVIEW') return 'REVIEW';
  if (s === 'APPROVED') return 'APPROVED';
  return 'DRAFT';
}

export function defaultAssumptions(horizonYears: number = 5): ValuationAssumptions {
  return {
    horizonYears,
    waccPercent: 12,
    waccBreakdown: {
      riskFreeRate: 4,
      equityRiskPremium: 5,
      beta: 1.2,
      costOfDebt: 8,
      taxRate: 19,
      debtWeight: 30,
      equityWeight: 70,
    },
    terminalMethod: 'gordon',
    terminalGrowthPercent: 3,
    exitMultiple: 8,
    exitMultipleMetric: 'EV/EBITDA',
    netDebt: 0,
    sharesOutstanding: undefined,
    manualForecast: { years: [] },
  };
}

export async function createValuation(
  orgId: string,
  data: {
    title: string;
    description?: string;
    projectId?: string;
    initiativeId?: string;
    sourceType: ValuationSourceType;
    sourceId?: string | null;
    horizonYears?: number;
    currency?: string;
  },
  userId?: string
): Promise<{ id: string }> {
  const id = uuidv4().replace(/-/g, '');
  const horizonYears = clamp(Number(data.horizonYears ?? 5), 1, 20);
  const assumptions = defaultAssumptions(horizonYears);

  await dbRun(
    `INSERT INTO valuations (id, organization_id, project_id, initiative_id, title, description, status, source_type, source_id, horizon_years, currency, assumptions, peers, results, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, '[]'::jsonb, '{}'::jsonb, ?)`,
    [
      id,
      orgId,
      data.projectId || null,
      data.initiativeId || null,
      data.title,
      data.description || null,
      data.sourceType,
      data.sourceId || null,
      horizonYears,
      data.currency || 'PLN',
      JSON.stringify(assumptions),
      userId || null,
    ]
  );

  return { id };
}

export async function listValuations(orgId: string): Promise<any[]> {
  const rows = await dbAll<any>(
    `SELECT id, title, description, status, source_type, source_id, horizon_years, currency, approved_at, updated_at
     FROM valuations WHERE organization_id = ? ORDER BY updated_at DESC`,
    [orgId]
  );
  return (rows || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    status: normalizeStatus(r.status),
    sourceType: r.source_type,
    sourceId: r.source_id,
    horizonYears: r.horizon_years,
    currency: r.currency,
    approvedAt: r.approved_at,
    updatedAt: r.updated_at,
  }));
}

export async function getValuation(orgId: string, valuationId: string): Promise<any | null> {
  const row = await dbGet<any>(`SELECT * FROM valuations WHERE id = ? AND organization_id = ?`, [
    valuationId,
    orgId,
  ]);
  if (!row) return null;
  return {
    ...row,
    status: normalizeStatus(row.status),
    assumptions: safeJsonParse(row.assumptions, {}),
    peers: safeJsonParse(row.peers, []),
    results: safeJsonParse(row.results, {}),
    advisory: safeJsonParse(row.advisory, null),
    negotiation_pack: safeJsonParse(row.negotiation_pack, null),
  };
}

async function setBackToDraftIfApproved(orgId: string, valuationId: string): Promise<void> {
  const row = await dbGet<any>(
    `SELECT status FROM valuations WHERE id = ? AND organization_id = ?`,
    [valuationId, orgId]
  );
  if (!row) return;
  if (normalizeStatus(row.status) === 'APPROVED') {
    await dbRun(
      `UPDATE valuations SET status = 'DRAFT', approved_by = NULL, approved_at = NULL, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
      [valuationId, orgId]
    );
  }
}

export async function updateAssumptions(
  orgId: string,
  valuationId: string,
  patch: Partial<ValuationAssumptions>,
  actor?: { userId?: string; userEmail?: string; ip?: string; userAgent?: string }
): Promise<void> {
  const current = await getValuation(orgId, valuationId);
  if (!current) throw new Error('Valuation not found');

  await setBackToDraftIfApproved(orgId, valuationId);

  const prev = safeJsonParse<ValuationAssumptions>(
    current.assumptions,
    defaultAssumptions(current.horizon_years)
  );
  const next: ValuationAssumptions = {
    ...prev,
    ...patch,
    waccBreakdown: { ...prev.waccBreakdown, ...(patch.waccBreakdown || {}) },
    manualForecast: patch.manualForecast
      ? { years: patch.manualForecast.years || [] }
      : prev.manualForecast,
  };

  await dbRun(
    `UPDATE valuations SET assumptions = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
    [JSON.stringify(next), valuationId, orgId]
  );

  try {
    await audit.log({
      actorType: 'user',
      actorId: actor?.userId,
      actorEmail: actor?.userEmail,
      actorIp: actor?.ip,
      actorUserAgent: actor?.userAgent,
      action: 'finance.valuation_assumption_updated',
      actionCategory: 'data',
      resourceType: 'valuation',
      resourceId: valuationId,
      organizationId: orgId,
      previousValues: prev as any,
      newValues: next as any,
      metadata: { keys: Object.keys(patch || {}) },
    });
  } catch (e) {
    logger.warn('[Valuation] Audit log failed for assumptions update', e as any);
  }
}

export async function updatePeers(
  orgId: string,
  valuationId: string,
  multiples: MultiplesInput,
  actor?: { userId?: string; userEmail?: string; ip?: string; userAgent?: string }
): Promise<void> {
  const current = await getValuation(orgId, valuationId);
  if (!current) throw new Error('Valuation not found');

  await setBackToDraftIfApproved(orgId, valuationId);

  const prev = safeJsonParse<any>(current.peers, []);
  await dbRun(
    `UPDATE valuations SET peers = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
    [JSON.stringify(multiples), valuationId, orgId]
  );

  try {
    await audit.log({
      actorType: 'user',
      actorId: actor?.userId,
      actorEmail: actor?.userEmail,
      actorIp: actor?.ip,
      actorUserAgent: actor?.userAgent,
      action: 'finance.valuation_peer_set_updated',
      actionCategory: 'data',
      resourceType: 'valuation',
      resourceId: valuationId,
      organizationId: orgId,
      previousValues: { peers: prev },
      newValues: { peers: multiples },
    });
  } catch (e) {
    logger.warn('[Valuation] Audit log failed for peers update', e as any);
  }
}

export interface ForecastYear {
  year: number;
  fcff: number;
  revenue?: number;
  ebitda?: number;
}

export interface ForecastBundle {
  years: ForecastYear[];
  scenarios?: Partial<Record<'base' | 'optimistic' | 'conservative', ForecastYear[]>>;
  companyMetric?: { revenueLastYear?: number; ebitdaLastYear?: number };
  sourceQuality?: {
    sourceType: ValuationSourceType;
    sourceId?: string | null;
    sourceStatus?: string;
  };
}

async function loadForecastFromBudget(
  orgId: string,
  budgetId: string,
  horizonYears: number
): Promise<ForecastBundle> {
  const budget = await dbGet<any>(
    `SELECT id, status, approved_at FROM budgets WHERE id = ? AND organization_id = ?`,
    [budgetId, orgId]
  );
  if (!budget) throw new Error('Source budget not found');

  const scenarios = await dbAll<any>(
    `SELECT scenario_type, projections FROM budget_scenarios WHERE budget_id = ? ORDER BY scenario_type`,
    [budgetId]
  );
  const buildYearsFromProjections = (projections: any): ForecastYear[] => {
    const periods: string[] = projections?.periods || [];
    const lines: Record<string, Record<string, number>> = projections?.lines || {};
    if (!periods.length) return [];

    const yearBuckets: Record<string, string[]> = {};
    for (const p of periods) {
      const y = String(p).slice(0, 4);
      if (!yearBuckets[y]) yearBuckets[y] = [];
      yearBuckets[y].push(p);
    }
    const yearsSorted = Object.keys(yearBuckets)
      .sort((a, b) => Number(a) - Number(b))
      .slice(0, horizonYears);

    return yearsSorted.map((y, idx) => {
      const ps = yearBuckets[y] || [];
      const sumLine = (code: string) =>
        ps.reduce((acc, period) => acc + Number(lines?.[code]?.[period] ?? 0), 0);
      return {
        year: idx + 1,
        fcff: round(sumLine('FCF'), 2),
        revenue: sumLine('REVENUE'),
        ebitda: sumLine('EBITDA'),
      };
    });
  };

  const baseRow = (scenarios || []).find((s: any) => String(s.scenario_type) === 'base');
  const baseYears = buildYearsFromProjections(safeJsonParse<any>(baseRow?.projections, {}));
  if (!baseYears.length)
    throw new Error('Budget projections not found. Generate projections first.');

  const scenarioMap: ForecastBundle['scenarios'] = {};
  for (const t of ['base', 'optimistic', 'conservative'] as const) {
    const row = (scenarios || []).find((s: any) => String(s.scenario_type) === t);
    const ys = buildYearsFromProjections(safeJsonParse<any>(row?.projections, {}));
    if (ys.length) scenarioMap[t] = ys;
  }

  const last = baseYears[baseYears.length - 1];
  return {
    years: baseYears,
    scenarios: scenarioMap,
    companyMetric: { revenueLastYear: last?.revenue, ebitdaLastYear: last?.ebitda },
    sourceQuality: {
      sourceType: 'budget',
      sourceId: budgetId,
      sourceStatus: String(budget.status || ''),
    },
  };
}

function loadForecastFromManual(
  manual: ValuationAssumptions['manualForecast'],
  horizonYears: number
): ForecastBundle {
  const yearsRaw = manual?.years || [];
  const yearsSorted = yearsRaw
    .map((y) => ({
      year: Number(y.year),
      fcff: Number(y.fcff),
      revenue: y.revenue == null ? undefined : Number(y.revenue),
      ebitda: y.ebitda == null ? undefined : Number(y.ebitda),
    }))
    .filter((y) => Number.isFinite(y.year) && Number.isFinite(y.fcff))
    .sort((a, b) => a.year - b.year)
    .slice(0, horizonYears)
    .map((y, idx) => ({ ...y, year: idx + 1 }));

  if (yearsSorted.length < 1) throw new Error('Manual forecast missing');
  return { years: yearsSorted, sourceQuality: { sourceType: 'manual' } };
}

export interface DcfResult {
  enterpriseValue: number;
  equityValue: number;
  perShare?: number;
  pvExplicit: number;
  pvTerminal: number;
  terminalValue: number;
  terminalMethod: TerminalMethod;
  discountRatePercent: number;
  terminalGrowthPercent?: number;
  exitMultiple?: number;
  exitMultipleMetric?: ExitMultipleMetric;
}

function computeDcf(
  forecast: ForecastYear[],
  assumptions: ValuationAssumptions,
  companyMetric: ForecastBundle['companyMetric']
): DcfResult {
  const wacc = clamp(Number(assumptions.waccPercent), 0.1, 80) / 100;
  const terminalMethod = assumptions.terminalMethod || 'gordon';
  const g = clamp(Number(assumptions.terminalGrowthPercent ?? 0), -10, 30) / 100;

  let pvExplicit = 0;
  for (let t = 1; t <= forecast.length; t++) {
    const fcff = Number(forecast[t - 1]?.fcff || 0);
    pvExplicit += fcff / Math.pow(1 + wacc, t);
  }

  const lastFcff = Number(forecast[forecast.length - 1]?.fcff || 0);
  let terminalValue = 0;
  if (terminalMethod === 'exit_multiple') {
    const exitMultiple = clamp(Number(assumptions.exitMultiple ?? 0), 0, 100);
    const metric = assumptions.exitMultipleMetric || 'EV/EBITDA';
    const last = forecast[forecast.length - 1];
    const lastEbitda = Number(last?.ebitda ?? companyMetric?.ebitdaLastYear ?? 0);
    const lastRevenue = Number(last?.revenue ?? companyMetric?.revenueLastYear ?? 0);
    const base = metric === 'EV/Revenue' ? lastRevenue : lastEbitda;
    terminalValue = base * exitMultiple;
  } else {
    if (g >= wacc) throw new Error('Terminal growth must be lower than WACC (g < WACC)');
    terminalValue = (lastFcff * (1 + g)) / (wacc - g);
  }

  const pvTerminal = terminalValue / Math.pow(1 + wacc, forecast.length);
  const enterpriseValue = pvExplicit + pvTerminal;
  const netDebt = Number(assumptions.netDebt ?? 0);
  const equityValue = enterpriseValue - netDebt;
  const shares = assumptions.sharesOutstanding;
  const perShare =
    shares && Number.isFinite(shares) && shares > 0 ? equityValue / Number(shares) : undefined;

  return {
    enterpriseValue: round(enterpriseValue, 2),
    equityValue: round(equityValue, 2),
    perShare: perShare == null ? undefined : round(perShare, 4),
    pvExplicit: round(pvExplicit, 2),
    pvTerminal: round(pvTerminal, 2),
    terminalValue: round(terminalValue, 2),
    terminalMethod,
    discountRatePercent: round(wacc * 100, 2),
    terminalGrowthPercent: terminalMethod === 'gordon' ? round(g * 100, 2) : undefined,
    exitMultiple: terminalMethod === 'exit_multiple' ? assumptions.exitMultiple : undefined,
    exitMultipleMetric:
      terminalMethod === 'exit_multiple' ? assumptions.exitMultipleMetric : undefined,
  };
}

function computeComps(
  multiples: MultiplesInput | null,
  companyMetric: ForecastBundle['companyMetric']
): any {
  if (!multiples) return null;
  const metric = multiples.metric;
  const base =
    metric === 'EV/Revenue'
      ? Number(companyMetric?.revenueLastYear ?? 0)
      : metric === 'EV/EBITDA'
        ? Number(companyMetric?.ebitdaLastYear ?? 0)
        : 0;
  return {
    ...multiples,
    companyMetric: base,
    impliedEnterpriseValue: {
      min: round(base * Number(multiples.min || 0), 2),
      median: round(base * Number(multiples.median || 0), 2),
      max: round(base * Number(multiples.max || 0), 2),
    },
  };
}

function computeSensitivityWaccVsG(
  forecast: ForecastYear[],
  assumptions: ValuationAssumptions,
  companyMetric: ForecastBundle['companyMetric']
) {
  const baseWacc = clamp(Number(assumptions.waccPercent), 0.1, 80);
  const baseG = clamp(Number(assumptions.terminalGrowthPercent ?? 0), -10, 30);
  const waccGrid = [baseWacc - 2, baseWacc - 1, baseWacc, baseWacc + 1, baseWacc + 2].map((v) =>
    round(clamp(v, 0.5, 40), 2)
  );
  const gGrid = [baseG - 1, baseG - 0.5, baseG, baseG + 0.5, baseG + 1].map((v) =>
    round(clamp(v, -5, 15), 2)
  );
  const table: Array<{ g: number; values: number[] }> = [];
  for (const g of gGrid) {
    const row: number[] = [];
    for (const w of waccGrid) {
      try {
        row.push(
          computeDcf(
            forecast,
            { ...assumptions, waccPercent: w, terminalGrowthPercent: g, terminalMethod: 'gordon' },
            companyMetric
          ).enterpriseValue
        );
      } catch {
        row.push(NaN);
      }
    }
    table.push({ g, values: row });
  }
  return { waccGrid, gGrid, table };
}

function computeSensitivityWaccVsExitMultiple(
  forecast: ForecastYear[],
  assumptions: ValuationAssumptions,
  companyMetric: ForecastBundle['companyMetric']
) {
  const baseWacc = clamp(Number(assumptions.waccPercent), 0.1, 80);
  const baseM = clamp(Number(assumptions.exitMultiple ?? 0), 0, 100);
  const waccGrid = [baseWacc - 2, baseWacc - 1, baseWacc, baseWacc + 1, baseWacc + 2].map((v) =>
    round(clamp(v, 0.5, 40), 2)
  );
  const multipleGrid = [baseM - 2, baseM - 1, baseM, baseM + 1, baseM + 2].map((v) =>
    round(clamp(v, 0, 50), 2)
  );
  const table: Array<{ multiple: number; values: number[] }> = [];
  for (const m of multipleGrid) {
    const row: number[] = [];
    for (const w of waccGrid) {
      try {
        row.push(
          computeDcf(
            forecast,
            { ...assumptions, waccPercent: w, exitMultiple: m, terminalMethod: 'exit_multiple' },
            companyMetric
          ).enterpriseValue
        );
      } catch {
        row.push(NaN);
      }
    }
    table.push({ multiple: m, values: row });
  }
  return { waccGrid, multipleGrid, table };
}

function computeTornado(
  forecast: ForecastYear[],
  assumptions: ValuationAssumptions,
  companyMetric: ForecastBundle['companyMetric'],
  baseEv: number
) {
  const drivers: Array<{ driver: string; lowEv: number; highEv: number; swing: number }> = [];
  const bump = (
    label: string,
    low: Partial<ValuationAssumptions>,
    high: Partial<ValuationAssumptions>
  ) => {
    const lowEv = computeDcf(forecast, { ...assumptions, ...low }, companyMetric).enterpriseValue;
    const highEv = computeDcf(forecast, { ...assumptions, ...high }, companyMetric).enterpriseValue;
    drivers.push({ driver: label, lowEv, highEv, swing: Math.abs(highEv - lowEv) });
  };
  bump(
    'WACC (±1%)',
    { waccPercent: assumptions.waccPercent - 1 },
    { waccPercent: assumptions.waccPercent + 1 }
  );
  {
    const scale = (factor: number) => forecast.map((y) => ({ ...y, fcff: y.fcff * factor }));
    const lowEv = computeDcf(scale(0.95), assumptions, companyMetric).enterpriseValue;
    const highEv = computeDcf(scale(1.05), assumptions, companyMetric).enterpriseValue;
    drivers.push({ driver: 'FCFF level (±5%)', lowEv, highEv, swing: Math.abs(highEv - lowEv) });
  }
  return drivers
    .map((d) => ({
      ...d,
      deltaLow: round(d.lowEv - baseEv, 2),
      deltaHigh: round(d.highEv - baseEv, 2),
    }))
    .sort((a, b) => b.swing - a.swing)
    .slice(0, 8);
}

export async function computeValuation(orgId: string, valuationId: string): Promise<any> {
  const val = await getValuation(orgId, valuationId);
  if (!val) throw new Error('Valuation not found');

  const assumptions = safeJsonParse<ValuationAssumptions>(
    val.assumptions,
    defaultAssumptions(val.horizon_years)
  );
  const horizonYears = clamp(Number(val.horizon_years || assumptions.horizonYears || 5), 1, 20);

  let forecast: ForecastBundle;
  if (val.source_type === 'financial_model') {
    throw new Error('T054 source is not available in this branch; use Budget or Manual');
  } else if (val.source_type === 'budget') {
    if (!val.source_id) throw new Error('Missing sourceId');
    forecast = await loadForecastFromBudget(orgId, val.source_id, horizonYears);
  } else {
    forecast = loadForecastFromManual(assumptions.manualForecast, horizonYears);
  }

  const dcf = computeDcf(forecast.years, assumptions, forecast.companyMetric);
  const multiples = safeJsonParse<MultiplesInput | null>(val.peers, null);
  const comps = computeComps(multiples, forecast.companyMetric);
  const scenarioComparison =
    val.source_type === 'budget' && forecast.scenarios
      ? (['base', 'optimistic', 'conservative'] as const)
          .filter(
            (k) =>
              Array.isArray(forecast.scenarios?.[k]) && (forecast.scenarios?.[k]?.length || 0) > 0
          )
          .map((k) => ({
            scenario: k,
            dcf: computeDcf(
              forecast.scenarios?.[k] as ForecastYear[],
              assumptions,
              forecast.companyMetric
            ),
          }))
      : [];
  const sensitivity =
    assumptions.terminalMethod === 'exit_multiple'
      ? {
          kind: 'wacc_vs_exit_multiple',
          ...computeSensitivityWaccVsExitMultiple(
            forecast.years,
            assumptions,
            forecast.companyMetric
          ),
        }
      : {
          kind: 'wacc_vs_g',
          ...computeSensitivityWaccVsG(forecast.years, assumptions, forecast.companyMetric),
        };
  const tornado = computeTornado(
    forecast.years,
    assumptions,
    forecast.companyMetric,
    dcf.enterpriseValue
  );

  const results = {
    computedAt: new Date().toISOString(),
    currency: val.currency,
    source: { type: val.source_type, id: val.source_id, quality: forecast.sourceQuality },
    forecast: { horizonYears, years: forecast.years },
    dcf,
    comps,
    scenarioComparison,
    sensitivity,
    tornado,
    disclaimers: [
      'For informational purposes only. Not investment, legal, or tax advice.',
      'Assumptions-driven outputs; results may vary and are not audited.',
    ],
  };

  await dbRun(
    `UPDATE valuations SET results = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
    [JSON.stringify(results), valuationId, orgId]
  );

  return results;
}

export async function approveValuation(
  orgId: string,
  valuationId: string,
  userId: string
): Promise<void> {
  const val = await getValuation(orgId, valuationId);
  if (!val) throw new Error('Valuation not found');

  const results = safeJsonParse<any>(val.results, {});
  if (!results?.dcf || results?.dcf?.enterpriseValue == null)
    throw new Error('Compute valuation before approval');

  const assumptions = safeJsonParse<ValuationAssumptions>(
    val.assumptions,
    defaultAssumptions(val.horizon_years)
  );
  if ((assumptions.terminalMethod || 'gordon') === 'gordon') {
    const w = Number(assumptions.waccPercent || 0);
    const g = Number(assumptions.terminalGrowthPercent || 0);
    if (!(g < w))
      throw new Error('Validation failed: terminal growth must be lower than WACC (g < WACC)');
  }

  const now = new Date().toISOString();
  const version = Number.isFinite(Number(val.version)) ? Number(val.version) : 1;
  await dbRun(
    `INSERT INTO valuation_snapshots (id, valuation_id, version, snapshot_data, approved_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      uuidv4().replace(/-/g, ''),
      valuationId,
      version,
      JSON.stringify({ assumptions: val.assumptions, peers: val.peers, results: val.results }),
      userId,
      now,
    ]
  );

  await dbRun(
    `UPDATE valuations
     SET status = 'APPROVED', approved_by = ?, approved_at = ?, version = version + 1, updated_at = NOW()
     WHERE id = ? AND organization_id = ?`,
    [userId, now, valuationId, orgId]
  );
}

export async function generateAdvisory(orgId: string, valuationId: string): Promise<any> {
  const val = await getValuation(orgId, valuationId);
  if (!val) throw new Error('Valuation not found');
  if (normalizeStatus(val.status) !== 'APPROVED')
    throw new Error('Valuation must be APPROVED to generate advisory');

  const results = safeJsonParse<any>(val.results, {});
  const dcf = results?.dcf || {};
  const tornado: Array<any> = Array.isArray(results?.tornado) ? results.tornado : [];

  const pvExplicit = Number(dcf.pvExplicit ?? NaN);
  const pvTerminal = Number(dcf.pvTerminal ?? NaN);
  const terminalShare =
    Number.isFinite(pvExplicit) && Number.isFinite(pvTerminal) && pvExplicit + pvTerminal !== 0
      ? pvTerminal / (pvExplicit + pvTerminal)
      : null;

  const evidenceLines: string[] = [];
  if (dcf.enterpriseValue != null) evidenceLines.push(`EV: ${dcf.enterpriseValue}`);
  if (dcf.discountRatePercent != null) evidenceLines.push(`WACC: ${dcf.discountRatePercent}%`);
  if (dcf.terminalMethod === 'gordon' && dcf.terminalGrowthPercent != null)
    evidenceLines.push(`g: ${dcf.terminalGrowthPercent}%`);
  if (terminalShare != null)
    evidenceLines.push(`PV terminal share: ${(terminalShare * 100).toFixed(0)}%`);
  const topDrivers = tornado
    .slice(0, 3)
    .map((d: any) => String(d?.driver || ''))
    .filter(Boolean);
  if (topDrivers.length) evidenceLines.push(`Top drivers: ${topDrivers.join(', ')}`);

  const mkId = () => `rec-${uuidv4().replace(/-/g, '').slice(0, 10)}`;

  const advisory = {
    generatedAt: new Date().toISOString(),
    valuationId,
    recommendations: [
      {
        id: mkId(),
        category: 'risk_reduction',
        title: 'Reduce perceived risk to improve discount rate discussion',
        hypothesis:
          'De-risk execution and strengthen reporting discipline to justify a lower WACC in negotiations.',
        mechanism: 'Lower perceived risk can reduce the discount rate applied to cash flows.',
        expectedDirection: '↓WACC / ↑EV',
        evidence: evidenceLines.length
          ? evidenceLines
          : ['Grounded in valuation assumptions and computed results.'],
        impactTier: Number(dcf.discountRatePercent ?? 0) >= 14 ? 'High' : 'Med',
        confidence: 'Med',
        effort: 'M',
        timeToImpact: '2–4 months',
        risks: ['Requires sustained operational cadence and transparent metrics.'],
        nextSteps: [
          'Define reporting cadence',
          'Track key risks + mitigations',
          'Publish monthly KPI pack',
          'Tighten audit trail for assumptions',
        ],
      },
      {
        id: mkId(),
        category: 'cash_conversion',
        title: 'Improve cash conversion (working capital + billing discipline)',
        hypothesis:
          'Increase FCFF by reducing cash tied in receivables/inventory and accelerating collections.',
        mechanism:
          'Higher near-term FCFF increases PV of explicit period and reduces terminal reliance.',
        expectedDirection: '↑FCFF / ↑EV',
        evidence: evidenceLines,
        impactTier: 'Med',
        confidence: 'Med',
        effort: 'M',
        timeToImpact: '1–3 months',
        risks: ['May impact customer experience if executed aggressively.'],
        nextSteps: [
          'Baseline DSO/DPO',
          'Introduce collection playbook',
          'Tighten billing SLAs',
          'Implement aging dashboard',
        ],
      },
      {
        id: mkId(),
        category: 'growth_acceleration',
        title: 'Improve pipeline-to-revenue conversion narrative',
        hypothesis:
          'Increase confidence in growth assumptions by tying them to measurable pipeline and conversion metrics.',
        mechanism: 'Higher credibility supports growth assumptions and comps confidence.',
        expectedDirection: '↑confidence / ↑multiple',
        evidence: evidenceLines,
        impactTier: 'Med',
        confidence: 'Med',
        effort: 'M',
        timeToImpact: '1–2 months',
        risks: ['If pipeline quality is weak, visibility can surface issues.'],
        nextSteps: [
          'Define funnel stages',
          'Track conversion rates',
          'Set leading indicators',
          'Align forecast with pipeline',
        ],
      },
      {
        id: mkId(),
        category: 'margin_improvement',
        title: 'Target margin expansion levers before fundraising/transaction',
        hypothesis: 'Improve operating leverage and gross margin to support higher exit multiples.',
        mechanism: 'Better margins can improve comps narrative and investor confidence.',
        expectedDirection: '↑multiple / ↑EV',
        evidence: evidenceLines,
        impactTier: 'Med',
        confidence: 'Low',
        effort: 'L',
        timeToImpact: '3–6 months',
        risks: ['Cost cuts can harm growth if not sequenced.'],
        nextSteps: [
          'Margin bridge',
          'Top cost drivers review',
          'Pricing/packaging review',
          'Operational efficiency initiatives',
        ],
      },
      {
        id: mkId(),
        category: 'governance_reporting',
        title: 'Strengthen model governance and assumption evidence',
        hypothesis:
          'Make key assumptions auditable and tie them to operational metrics to increase trust.',
        mechanism:
          'Higher trust improves negotiation leverage and reduces discounting of the narrative.',
        expectedDirection: '↑confidence',
        evidence: evidenceLines,
        impactTier: 'Low',
        confidence: 'High',
        effort: 'S',
        timeToImpact: '2–4 weeks',
        risks: ['Requires consistent owner and reviewer availability.'],
        nextSteps: [
          'Approval checklist',
          'Assumption owner mapping',
          'Version notes per change',
          'Sensitivity review before approval',
        ],
      },
      {
        id: mkId(),
        category: 'forecast_quality',
        title: 'Stress-test assumptions with downside cases',
        hypothesis: 'Prepare a credible downside narrative to handle objections.',
        mechanism: 'A well-prepared downside increases trust and reduces surprise discounting.',
        expectedDirection: '↑trust',
        evidence: evidenceLines,
        impactTier: 'Med',
        confidence: 'Med',
        effort: 'S',
        timeToImpact: '1–2 weeks',
        risks: ['Downside could look worse if assumptions are optimistic.'],
        nextSteps: [
          'Define downside triggers',
          'Recompute sensitivity',
          'Prepare mitigation plan',
          'Align talk track',
        ],
      },
      {
        id: mkId(),
        category: 'capital_structure',
        title: 'Clarify net debt and cash policy assumptions',
        hypothesis: 'Make the EV→equity bridge defensible with a clear cash/debt policy.',
        mechanism: 'Reduces negotiation friction around equity value adjustments.',
        expectedDirection: '↑clarity / ↓friction',
        evidence: evidenceLines,
        impactTier: 'Low',
        confidence: 'Med',
        effort: 'S',
        timeToImpact: '2–4 weeks',
        risks: ['May require board alignment.'],
        nextSteps: [
          'Define cash buffer policy',
          'Document debt terms',
          'Align working capital policy',
        ],
      },
      {
        id: mkId(),
        category: 'risk_reduction',
        title: 'Operationalize risk register and mitigations',
        hypothesis: 'Proactively address top risks surfaced by sensitivity drivers.',
        mechanism:
          'Demonstrated risk mitigation reduces perceived risk and improves negotiation stance.',
        expectedDirection: '↓risk premium',
        evidence: evidenceLines,
        impactTier: 'Med',
        confidence: 'Med',
        effort: 'M',
        timeToImpact: '4–8 weeks',
        risks: ['Requires cross-functional ownership.'],
        nextSteps: [
          'Assign risk owners',
          'Define mitigations',
          'Set review cadence',
          'Track completion',
        ],
      },
      {
        id: mkId(),
        category: 'governance_reporting',
        title: 'Improve data quality and traceability for key metrics',
        hypothesis:
          'Reduce “model discount” by demonstrating traceable, consistent financial and operating data.',
        mechanism: 'Better data quality reduces skepticism during diligence.',
        expectedDirection: '↑trust',
        evidence: evidenceLines,
        impactTier: 'Low',
        confidence: 'High',
        effort: 'M',
        timeToImpact: '1–2 months',
        risks: ['Requires agreement on metric definitions.'],
        nextSteps: [
          'Define metric dictionary',
          'Add source tags',
          'Implement checks',
          'Document assumptions',
        ],
      },
      ...(terminalShare != null && terminalShare >= 0.65
        ? [
            {
              id: mkId(),
              category: 'forecast_quality',
              title: 'Reduce terminal value dependence with higher-quality near-term plan',
              hypothesis:
                'Increase planning granularity and near-term milestones to improve explicit-period contribution.',
              mechanism: 'More value in explicit period reduces reliance on terminal assumptions.',
              expectedDirection: '↑PV explicit share / ↓terminal reliance',
              evidence: evidenceLines,
              impactTier: 'Med',
              confidence: 'Med',
              effort: 'M',
              timeToImpact: '1–2 months',
              risks: ['Planning overhead without clear ownership.'],
              nextSteps: [
                'Quarterly cash plan',
                'Unit-economics drivers',
                'Pipeline-to-revenue conversion tracking',
              ],
            },
          ]
        : []),
    ],
    guardrails: [
      'Informational only; not investment, legal, or tax advice.',
      'No guarantees; validate assumptions with qualified professionals.',
    ],
  };

  await dbRun(
    `UPDATE valuations SET advisory = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
    [JSON.stringify(advisory), valuationId, orgId]
  );

  return advisory;
}

export async function generateNegotiationPack(orgId: string, valuationId: string): Promise<any> {
  const val = await getValuation(orgId, valuationId);
  if (!val) throw new Error('Valuation not found');
  if (normalizeStatus(val.status) !== 'APPROVED')
    throw new Error('Valuation must be APPROVED to generate negotiation pack');

  const results = safeJsonParse<any>(val.results, {});
  const dcf = results?.dcf || {};
  const comps = results?.comps || null;
  const sensitivity = results?.sensitivity || null;
  const tornado: Array<any> = Array.isArray(results?.tornado) ? results.tornado : [];
  const topDrivers = tornado
    .slice(0, 5)
    .map((d: any) => String(d?.driver || ''))
    .filter(Boolean);

  const pack = {
    generatedAt: new Date().toISOString(),
    valuationId,
    proPoints: [
      {
        title: 'DCF is grounded in explicit assumptions',
        oneLiner: 'We can show what drives value and how assumptions translate to EV.',
        evidence: [
          `EV: ${dcf?.enterpriseValue ?? '—'}`,
          `WACC: ${dcf?.discountRatePercent ?? '—'}%`,
        ],
      },
      {
        title: 'Sensitivity is transparent',
        oneLiner: 'We can discuss ranges, not a single fragile number.',
        evidence: [
          `Terminal method: ${dcf?.terminalMethod ?? '—'}`,
          sensitivity?.kind ? `Sensitivity: ${String(sensitivity.kind)}` : 'Sensitivity: —',
        ],
      },
      ...(comps?.impliedEnterpriseValue
        ? [
            {
              title: 'Comps provide an external cross-check (manual in V2)',
              oneLiner:
                'Multiples-based range is provided as triangulation, not a single source of truth.',
              evidence: [
                `Comps EV min: ${comps.impliedEnterpriseValue.min ?? '—'}`,
                `median: ${comps.impliedEnterpriseValue.median ?? '—'}`,
                `max: ${comps.impliedEnterpriseValue.max ?? '—'}`,
              ],
            },
          ]
        : []),
      ...(topDrivers.length
        ? [
            {
              title: 'Top value drivers are identified',
              oneLiner: 'We focus the discussion on the few assumptions that matter most.',
              evidence: topDrivers,
            },
          ]
        : []),
    ],
    contraPoints: [
      {
        title: 'Terminal value can be challenged',
        objection: 'Terminal assumptions can dominate EV in a DCF.',
        rebuttal: 'Use sensitivity and assumptions transparency to address objections.',
      },
      {
        title: 'Assumptions are scenario-dependent',
        objection: 'Projections may differ from realized performance.',
        rebuttal:
          'We explicitly state assumptions, show sensitivity, and update the model as evidence arrives.',
      },
    ],
    qa: [
      {
        question: 'What would change your valuation view?',
        suggestedAnswer:
          'Key levers are WACC/risk, sustainable growth, and cash conversion; we show sensitivity ranges.',
      },
      {
        question: 'Why this discount rate?',
        suggestedAnswer:
          'We disclose WACC assumptions (risk-free, ERP, beta, cost of debt, tax, capital structure) and can discuss an evidence-based range.',
      },
      {
        question: 'How robust is the terminal assumption?',
        suggestedAnswer:
          'We use a transparent terminal method and provide sensitivity; we can also triangulate with multiples as a cross-check.',
      },
      {
        question: 'Why did you choose these peers/multiples?',
        suggestedAnswer:
          'Peers are a manual V2 cross-check; we document “why peers” and treat comps as triangulation, not a single source of truth.',
      },
      {
        question: 'How much of EV is driven by terminal value?',
        suggestedAnswer:
          'We explicitly show PV split between explicit period and terminal; we can improve explicit-period visibility with a near-term plan.',
      },
      {
        question: 'What are the top drivers of the valuation?',
        suggestedAnswer:
          topDrivers.length > 0
            ? `Top sensitivity drivers are: ${topDrivers.slice(0, 3).join(', ')}. We focus the discussion on these levers.`
            : 'We use tornado/sensitivity to identify top drivers and focus on the few assumptions that matter most.',
      },
      {
        question: 'How do you validate the forecast?',
        suggestedAnswer:
          'We tie key forecast assumptions to operational metrics and update the model as evidence evolves; all changes are versioned and audited.',
      },
      {
        question: 'How does this compare to a budget/base plan?',
        suggestedAnswer:
          'We prefer approved finance sources when available; otherwise we use explicit manual inputs and disclose coverage and limitations.',
      },
      {
        question: 'What are the biggest risks that could reduce value?',
        suggestedAnswer:
          'Execution risk, cash conversion, and market risk are typical. We prepare mitigations and can show how they affect sensitivity drivers.',
      },
      {
        question: 'What is your plan to justify the multiple?',
        suggestedAnswer:
          'We outline concrete actions to improve growth, margins, governance, and risk posture — strengthening the “quality” side of the story.',
      },
      {
        question: 'If growth is slower, what happens?',
        suggestedAnswer:
          'We show scenario/sensitivity ranges; we can re-run the model under conservative assumptions and discuss mitigation actions.',
      },
      {
        question: 'If the discount rate is higher, what happens?',
        suggestedAnswer:
          'Sensitivity explicitly shows EV under different WACC values; we treat WACC as a discussion range supported by evidence.',
      },
      {
        question: 'Do you provide investment advice?',
        suggestedAnswer:
          'No. This is an informational model to support internal planning and communication; it is not investment, legal, or tax advice.',
      },
      {
        question: 'What assumptions are most uncertain?',
        suggestedAnswer:
          'We call out assumptions that materially move EV via tornado/sensitivity, and we avoid claiming certainty where evidence is missing.',
      },
      {
        question: 'What would you concede without changing the strategy?',
        suggestedAnswer:
          'We can discuss structure and terms separately from the operating plan; we do not overcommit to single-point numbers without evidence.',
      },
    ],
    dontSay: [
      'Do not claim this is investment advice or that returns are guaranteed.',
      'Avoid promising a specific investor outcome or deal certainty.',
    ],
    disclaimers: [
      'Informational only; not investment, legal, or tax advice.',
      'Figures are based on stated assumptions and are not audited.',
    ],
  };

  await dbRun(
    `UPDATE valuations SET negotiation_pack = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
    [JSON.stringify(pack), valuationId, orgId]
  );

  return pack;
}

export async function convertAdvisoryRecommendationToInitiative(
  orgId: string,
  valuationId: string,
  recommendationId: string,
  userId: string
): Promise<{ initiativeId: string }> {
  const val = await getValuation(orgId, valuationId);
  if (!val) throw new Error('Valuation not found');
  const advisory = safeJsonParse<any>(val.advisory, null);
  const rec = (advisory?.recommendations || []).find((r: any) => r.id === recommendationId);
  if (!rec) throw new Error('Recommendation not found');

  const initiativeId = uuidv4();
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO initiatives (id, organization_id, project_id, name, summary, hypothesis, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      initiativeId,
      orgId,
      val.project_id || null,
      String(rec.title || 'Valuation improvement initiative'),
      String(rec.mechanism || rec.hypothesis || ''),
      String(rec.hypothesis || ''),
      'draft',
      now,
      now,
    ]
  );

  try {
    await audit.log({
      actorType: 'user',
      actorId: userId,
      action: 'finance.valuation_advisory_recommendation_converted',
      actionCategory: 'data',
      resourceType: 'initiative',
      resourceId: initiativeId,
      organizationId: orgId,
      metadata: { valuationId, recommendationId },
    });
  } catch (e) {
    logger.warn('[Valuation] Audit log failed for conversion', e as any);
  }

  return { initiativeId };
}
