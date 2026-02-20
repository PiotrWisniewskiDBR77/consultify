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
  manualForecast?: { years: Array<{ year: number; fcff: number; revenue?: number; ebitda?: number }> };
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
  const row = await dbGet<any>(`SELECT status FROM valuations WHERE id = ? AND organization_id = ?`, [
    valuationId,
    orgId,
  ]);
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

  const prev = safeJsonParse<ValuationAssumptions>(current.assumptions, defaultAssumptions(current.horizon_years));
  const next: ValuationAssumptions = {
    ...prev,
    ...patch,
    waccBreakdown: { ...prev.waccBreakdown, ...(patch.waccBreakdown || {}) },
    manualForecast: patch.manualForecast ? { years: patch.manualForecast.years || [] } : prev.manualForecast,
  };

  await dbRun(`UPDATE valuations SET assumptions = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`, [
    JSON.stringify(next),
    valuationId,
    orgId,
  ]);

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
  await dbRun(`UPDATE valuations SET peers = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`, [
    JSON.stringify(multiples),
    valuationId,
    orgId,
  ]);

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
  companyMetric?: { revenueLastYear?: number; ebitdaLastYear?: number };
  sourceQuality?: { sourceType: ValuationSourceType; sourceId?: string | null; sourceStatus?: string };
}

async function loadForecastFromBudget(orgId: string, budgetId: string, horizonYears: number): Promise<ForecastBundle> {
  const budget = await dbGet<any>(`SELECT id, status FROM budgets WHERE id = ? AND organization_id = ?`, [budgetId, orgId]);
  if (!budget) throw new Error('Source budget not found');

  const scenarios = await dbAll<any>(`SELECT scenario_type, projections FROM budget_scenarios WHERE budget_id = ?`, [budgetId]);
  const base = (scenarios || []).find((s: any) => String(s.scenario_type) === 'base');
  const projections = safeJsonParse<any>(base?.projections, {});
  const periods: string[] = projections?.periods || [];
  const lines: Record<string, Record<string, number>> = projections?.lines || {};
  if (!periods.length) throw new Error('Budget projections not found. Generate projections first.');

  const yearBuckets: Record<string, string[]> = {};
  for (const p of periods) {
    const y = String(p).slice(0, 4);
    if (!yearBuckets[y]) yearBuckets[y] = [];
    yearBuckets[y].push(p);
  }
  const yearsSorted = Object.keys(yearBuckets).sort((a, b) => Number(a) - Number(b)).slice(0, horizonYears);

  const years: ForecastYear[] = yearsSorted.map((y, idx) => {
    const ps = yearBuckets[y] || [];
    const sumLine = (code: string) => ps.reduce((acc, period) => acc + Number(lines?.[code]?.[period] ?? 0), 0);
    return { year: idx + 1, fcff: round(sumLine('FCF'), 2), revenue: sumLine('REVENUE'), ebitda: sumLine('EBITDA') };
  });

  const last = years[years.length - 1];
  return {
    years,
    companyMetric: { revenueLastYear: last?.revenue, ebitdaLastYear: last?.ebitda },
    sourceQuality: { sourceType: 'budget', sourceId: budgetId, sourceStatus: String(budget.status || '') },
  };
}

function loadForecastFromManual(manual: ValuationAssumptions['manualForecast'], horizonYears: number): ForecastBundle {
  const yearsRaw = manual?.years || [];
  const yearsSorted = yearsRaw
    .map((y) => ({ year: Number(y.year), fcff: Number(y.fcff), revenue: y.revenue == null ? undefined : Number(y.revenue), ebitda: y.ebitda == null ? undefined : Number(y.ebitda) }))
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

function computeDcf(forecast: ForecastYear[], assumptions: ValuationAssumptions, companyMetric: ForecastBundle['companyMetric']): DcfResult {
  const wacc = clamp(Number(assumptions.waccPercent), 0.1, 80) / 100;
  const terminalMethod = assumptions.terminalMethod || 'gordon';
  const g = clamp(Number(assumptions.terminalGrowthPercent ?? 0), -10, 30) / 100;

  let pvExplicit = 0;
  for (let t = 1; t <= forecast.length; t++) {
    pvExplicit += Number(forecast[t - 1]?.fcff || 0) / Math.pow(1 + wacc, t);
  }

  const lastFcff = Number(forecast[forecast.length - 1]?.fcff || 0);
  let terminalValue = 0;
  if (terminalMethod === 'exit_multiple') {
    const exitMultiple = clamp(Number(assumptions.exitMultiple ?? 0), 0, 100);
    const metric = assumptions.exitMultipleMetric || 'EV/EBITDA';
    const last = forecast[forecast.length - 1];
    const lastEbitda = Number(last?.ebitda ?? companyMetric?.ebitdaLastYear ?? 0);
    const lastRevenue = Number(last?.revenue ?? companyMetric?.revenueLastYear ?? 0);
    terminalValue = (metric === 'EV/Revenue' ? lastRevenue : lastEbitda) * exitMultiple;
  } else {
    if (g >= wacc) throw new Error('Terminal growth must be lower than WACC (g < WACC)');
    terminalValue = (lastFcff * (1 + g)) / (wacc - g);
  }

  const pvTerminal = terminalValue / Math.pow(1 + wacc, forecast.length);
  const enterpriseValue = pvExplicit + pvTerminal;
  const netDebt = Number(assumptions.netDebt ?? 0);
  const equityValue = enterpriseValue - netDebt;
  const shares = assumptions.sharesOutstanding;
  const perShare = shares && Number.isFinite(shares) && shares > 0 ? equityValue / Number(shares) : undefined;

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
    exitMultipleMetric: terminalMethod === 'exit_multiple' ? assumptions.exitMultipleMetric : undefined,
  };
}

function computeComps(multiples: MultiplesInput | null, companyMetric: ForecastBundle['companyMetric']): any {
  if (!multiples) return null;
  const metric = multiples.metric;
  const base = metric === 'EV/Revenue' ? Number(companyMetric?.revenueLastYear ?? 0) : metric === 'EV/EBITDA' ? Number(companyMetric?.ebitdaLastYear ?? 0) : 0;
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

export async function computeValuation(orgId: string, valuationId: string): Promise<any> {
  const val = await getValuation(orgId, valuationId);
  if (!val) throw new Error('Valuation not found');

  const assumptions = safeJsonParse<ValuationAssumptions>(val.assumptions, defaultAssumptions(val.horizon_years));
  const horizonYears = clamp(Number(val.horizon_years || assumptions.horizonYears || 5), 1, 20);

  let forecast: ForecastBundle;
  if (val.source_type === 'budget') {
    if (!val.source_id) throw new Error('Missing sourceId');
    forecast = await loadForecastFromBudget(orgId, val.source_id, horizonYears);
  } else {
    forecast = loadForecastFromManual(assumptions.manualForecast, horizonYears);
  }

  const dcf = computeDcf(forecast.years, assumptions, forecast.companyMetric);
  const multiples = safeJsonParse<MultiplesInput | null>(val.peers, null);
  const comps = computeComps(multiples, forecast.companyMetric);

  const results = {
    computedAt: new Date().toISOString(),
    currency: val.currency,
    source: { type: val.source_type, id: val.source_id, quality: forecast.sourceQuality },
    forecast: { horizonYears, years: forecast.years },
    dcf,
    comps,
    disclaimers: [
      'For informational purposes only. Not investment, legal, or tax advice.',
      'Assumptions-driven outputs; results may vary and are not audited.',
    ],
  };

  await dbRun(`UPDATE valuations SET results = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`, [JSON.stringify(results), valuationId, orgId]);
  return results;
}

export async function approveValuation(orgId: string, valuationId: string, userId: string): Promise<void> {
  const val = await getValuation(orgId, valuationId);
  if (!val) throw new Error('Valuation not found');
  const results = safeJsonParse<any>(val.results, {});
  if (!results?.dcf || results?.dcf?.enterpriseValue == null) throw new Error('Compute valuation before approval');

  const assumptions = safeJsonParse<ValuationAssumptions>(val.assumptions, defaultAssumptions(val.horizon_years));
  if ((assumptions.terminalMethod || 'gordon') === 'gordon') {
    const w = Number(assumptions.waccPercent || 0);
    const g = Number(assumptions.terminalGrowthPercent || 0);
    if (!(g < w)) throw new Error('Validation failed: terminal growth must be lower than WACC (g < WACC)');
  }

  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO valuation_snapshots (id, valuation_id, version, snapshot_data, approved_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4().replace(/-/g, ''), valuationId, val.version, JSON.stringify({ assumptions: val.assumptions, peers: val.peers, results: val.results }), userId, now]
  );
  await dbRun(
    `UPDATE valuations SET status = 'APPROVED', approved_by = ?, approved_at = ?, version = version + 1, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
    [userId, now, valuationId, orgId]
  );
}

export async function generateAdvisory(orgId: string, valuationId: string): Promise<any> {
  const val = await getValuation(orgId, valuationId);
  if (!val) throw new Error('Valuation not found');
  if (normalizeStatus(val.status) !== 'APPROVED') throw new Error('Valuation must be APPROVED to generate advisory');

  const results = safeJsonParse<any>(val.results, {});
  const advisory = {
    generatedAt: new Date().toISOString(),
    valuationId,
    recommendations: [
      {
        id: `rec-${uuidv4().replace(/-/g, '').slice(0, 10)}`,
        category: 'governance_reporting',
        title: 'Upgrade model governance and approval process',
        hypothesis: 'Make assumptions explicit and versioned to increase stakeholder trust.',
        mechanism: 'Higher trust reduces discount applied in negotiation.',
        expectedDirection: '↑confidence / ↓discount',
        evidence: ['Grounded in valuation assumptions and computed results.'],
        impactTier: 'Low',
        confidence: 'Med',
        effort: 'S',
        timeToImpact: '1–2 months',
        risks: ['Requires consistent owner and review cadence.'],
        nextSteps: ['Define approval checklist', 'Assign model owner and reviewer', 'Log key assumption changes'],
      },
    ],
    guardrails: [
      'Informational only; not investment, legal, or tax advice.',
      'No guarantees; validate assumptions with qualified professionals.',
    ],
    _grounding: { hasResults: !!results?.dcf },
  };

  await dbRun(`UPDATE valuations SET advisory = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`, [JSON.stringify(advisory), valuationId, orgId]);
  return advisory;
}

export async function generateNegotiationPack(orgId: string, valuationId: string): Promise<any> {
  const val = await getValuation(orgId, valuationId);
  if (!val) throw new Error('Valuation not found');
  if (normalizeStatus(val.status) !== 'APPROVED') throw new Error('Valuation must be APPROVED to generate negotiation pack');

  const results = safeJsonParse<any>(val.results, {});
  const dcf = results?.dcf || {};
  const pack = {
    generatedAt: new Date().toISOString(),
    valuationId,
    proPoints: [
      {
        title: 'DCF is grounded in explicit assumptions',
        oneLiner: 'We can show what drives value and how assumptions translate to EV.',
        evidence: [`EV: ${dcf?.enterpriseValue ?? '—'}`, `WACC: ${dcf?.discountRatePercent ?? '—'}%`],
      },
    ],
    contraPoints: [
      {
        title: 'Terminal value can be challenged',
        objection: 'Terminal assumptions can dominate EV in a DCF.',
        rebuttal: 'Use sensitivity and assumptions transparency to address objections.',
      },
    ],
    qa: [
      {
        question: 'What would change your valuation view?',
        suggestedAnswer: 'Key levers are WACC/risk, sustainable growth, and cash conversion; we show sensitivity ranges.',
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

  await dbRun(`UPDATE valuations SET negotiation_pack = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`, [JSON.stringify(pack), valuationId, orgId]);
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

