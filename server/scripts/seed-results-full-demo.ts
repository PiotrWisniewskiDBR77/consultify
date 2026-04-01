#!/usr/bin/env tsx
/**
 * Results Module Full Demo Seed — populates KPIs, time series, ROI assumptions/realized,
 * deviation cases, and KPI mappings for the active organization so that all Results tabs
 * (Summary, KPIs, KPI Reports, ROI, Operational, ROI Analysis) show meaningful data.
 *
 * Usage:
 *   npx tsx server/scripts/seed-results-full-demo.ts
 *
 * Targets: DEMO_ORG_ID from env (default: atelier).
 * Idempotent: uses ON CONFLICT DO NOTHING / DO UPDATE.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../src/database/Database.js';
import * as DbPromise from '../src/utils/DbPromise.js';

const ORG_ID = process.env.DEMO_ORG_ID || 'atelier';
const OWNER_USER_ID = '924c78c0-4401-42d7-9151-6f91d694c523'; // Piotr Wisniewski

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthStart(offsetMonths: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1));
  return isoDate(d);
}

function uid(): string {
  return uuidv4().replace(/-/g, '');
}

async function tableExists(name: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists`,
      [name]
    );
    return row?.exists === true;
  } catch {
    return false;
  }
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const row = await DbPromise.get<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
      ) AS exists`,
      [tableName, columnName]
    );
    return row?.exists === true;
  } catch {
    return false;
  }
}

// ─── KPI Definitions ────────────────────────────────────────────────

interface KpiDef {
  id: string;
  name: string;
  description: string;
  unit: string;
  baseline: number;
  target: number;
  frequency: string;
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  values: number[]; // 6 months of time series, oldest first
}

const KPIS: KpiDef[] = [
  {
    id: 'atelier-kpi-oee',
    name: 'OEE (Overall Equipment Effectiveness)',
    description: 'Measures equipment utilization, performance, and quality rate',
    unit: '%',
    baseline: 68,
    target: 85,
    frequency: 'MONTHLY',
    direction: 'HIGHER_IS_BETTER',
    values: [70, 72, 74, 76, 79, 81],
  },
  {
    id: 'atelier-kpi-energy',
    name: 'Energy Consumption per Unit',
    description: 'kWh consumed per produced unit across all lines',
    unit: 'kWh/unit',
    baseline: 6.8,
    target: 5.2,
    frequency: 'MONTHLY',
    direction: 'LOWER_IS_BETTER',
    values: [6.5, 6.3, 6.1, 5.9, 5.7, 5.8],
  },
  {
    id: 'atelier-kpi-otd',
    name: 'On-Time Delivery Rate',
    description: 'Percentage of orders delivered within committed lead time',
    unit: '%',
    baseline: 82,
    target: 95,
    frequency: 'MONTHLY',
    direction: 'HIGHER_IS_BETTER',
    values: [84, 86, 88, 91, 93, 94],
  },
  {
    id: 'atelier-kpi-scrap',
    name: 'Scrap Rate',
    description: 'Percentage of production output classified as scrap',
    unit: '%',
    baseline: 4.2,
    target: 1.5,
    frequency: 'MONTHLY',
    direction: 'LOWER_IS_BETTER',
    values: [3.8, 3.5, 3.2, 2.9, 2.6, 2.4],
  },
  {
    id: 'atelier-kpi-nps',
    name: 'Customer NPS',
    description: 'Net Promoter Score from quarterly customer surveys',
    unit: 'score',
    baseline: 32,
    target: 55,
    frequency: 'QUARTERLY',
    direction: 'HIGHER_IS_BETTER',
    values: [35, 38, 41, 44, 47, 50],
  },
  {
    id: 'atelier-kpi-mttr',
    name: 'MTTR (Mean Time to Repair)',
    description: 'Average time to restore equipment after failure',
    unit: 'hours',
    baseline: 8.5,
    target: 3.0,
    frequency: 'MONTHLY',
    direction: 'LOWER_IS_BETTER',
    values: [7.8, 7.2, 6.5, 5.8, 5.1, 4.5],
  },
  {
    id: 'atelier-kpi-revenue-growth',
    name: 'Revenue Growth YoY',
    description: 'Year-over-year revenue growth percentage',
    unit: '%',
    baseline: 3.2,
    target: 12.0,
    frequency: 'QUARTERLY',
    direction: 'HIGHER_IS_BETTER',
    values: [4.1, 5.3, 6.8, 7.9, 9.2, 10.5],
  },
  {
    id: 'atelier-kpi-employee-engagement',
    name: 'Employee Engagement Index',
    description: 'Composite score from pulse surveys (1-100)',
    unit: 'score',
    baseline: 58,
    target: 78,
    frequency: 'QUARTERLY',
    direction: 'HIGHER_IS_BETTER',
    values: [60, 62, 65, 68, 71, 73],
  },
];

// ─── Initiative ↔ KPI Mapping ───────────────────────────────────────

interface MappingDef {
  initiativeId: string;
  kpiId: string;
  weight: number;
  direction: 'increase' | 'decrease';
  confidence: 'low' | 'medium' | 'high';
}

const MAPPINGS: MappingDef[] = [
  { initiativeId: 'atelier-init-01', kpiId: 'atelier-kpi-oee', weight: 1.0, direction: 'increase', confidence: 'high' },
  { initiativeId: 'atelier-init-01', kpiId: 'atelier-kpi-energy', weight: 0.8, direction: 'decrease', confidence: 'high' },
  { initiativeId: 'atelier-init-02', kpiId: 'atelier-kpi-otd', weight: 1.0, direction: 'increase', confidence: 'high' },
  { initiativeId: 'atelier-init-02', kpiId: 'atelier-kpi-scrap', weight: 0.6, direction: 'decrease', confidence: 'medium' },
  { initiativeId: 'atelier-init-03', kpiId: 'atelier-kpi-nps', weight: 1.0, direction: 'increase', confidence: 'medium' },
  { initiativeId: 'atelier-init-03', kpiId: 'atelier-kpi-revenue-growth', weight: 0.7, direction: 'increase', confidence: 'medium' },
  { initiativeId: 'atelier-init-04', kpiId: 'atelier-kpi-mttr', weight: 1.0, direction: 'decrease', confidence: 'high' },
  { initiativeId: 'atelier-init-04', kpiId: 'atelier-kpi-oee', weight: 0.5, direction: 'increase', confidence: 'medium' },
  { initiativeId: 'atelier-init-05', kpiId: 'atelier-kpi-employee-engagement', weight: 1.0, direction: 'increase', confidence: 'medium' },
  { initiativeId: 'atelier-init-05', kpiId: 'atelier-kpi-scrap', weight: 0.3, direction: 'decrease', confidence: 'low' },
  { initiativeId: 'atelier-init-06', kpiId: 'atelier-kpi-revenue-growth', weight: 1.0, direction: 'increase', confidence: 'high' },
  { initiativeId: 'atelier-init-06', kpiId: 'atelier-kpi-nps', weight: 0.5, direction: 'increase', confidence: 'medium' },
];

// ─── ROI Assumptions ────────────────────────────────────────────────

interface RoiAssumptionDef {
  initiativeId: string;
  capex: number;
  opexAnnual: number;
  expectedRoiPercent: number;
  expectedNpv: number;
  expectedPaybackMonths: number;
  horizonMonths: number;
  baselineRevenue: number;
  baselineCost: number;
  expectedRevenueDelta: number;
  expectedCostDelta: number;
  confidence: 'low' | 'medium' | 'high';
  text: string;
  owner: string;
}

const ROI_ASSUMPTIONS: RoiAssumptionDef[] = [
  {
    initiativeId: 'atelier-init-01',
    capex: 180000, opexAnnual: 24000,
    expectedRoiPercent: 35, expectedNpv: 280000, expectedPaybackMonths: 14, horizonMonths: 36,
    baselineRevenue: 2400000, baselineCost: 1680000,
    expectedRevenueDelta: 120000, expectedCostDelta: -85000,
    confidence: 'high',
    text: 'OEE improvement through predictive maintenance and scheduling optimization.',
    owner: 'Operations Director',
  },
  {
    initiativeId: 'atelier-init-02',
    capex: 95000, opexAnnual: 12000,
    expectedRoiPercent: 28, expectedNpv: 145000, expectedPaybackMonths: 18, horizonMonths: 36,
    baselineRevenue: 2400000, baselineCost: 1680000,
    expectedRevenueDelta: 60000, expectedCostDelta: -42000,
    confidence: 'high',
    text: 'On-time delivery via WMS upgrade and route optimization.',
    owner: 'Supply Chain Manager',
  },
  {
    initiativeId: 'atelier-init-03',
    capex: 65000, opexAnnual: 18000,
    expectedRoiPercent: 22, expectedNpv: 95000, expectedPaybackMonths: 24, horizonMonths: 36,
    baselineRevenue: 2400000, baselineCost: 1680000,
    expectedRevenueDelta: 180000, expectedCostDelta: -15000,
    confidence: 'medium',
    text: 'Customer experience program: NPS improvement driving retention and upsell.',
    owner: 'Customer Success Lead',
  },
  {
    initiativeId: 'atelier-init-04',
    capex: 220000, opexAnnual: 30000,
    expectedRoiPercent: 42, expectedNpv: 380000, expectedPaybackMonths: 12, horizonMonths: 36,
    baselineRevenue: 2400000, baselineCost: 1680000,
    expectedRevenueDelta: 0, expectedCostDelta: -150000,
    confidence: 'high',
    text: 'Predictive maintenance platform reducing MTTR and unplanned downtime.',
    owner: 'Maintenance Manager',
  },
  {
    initiativeId: 'atelier-init-05',
    capex: 45000, opexAnnual: 22000,
    expectedRoiPercent: 15, expectedNpv: 55000, expectedPaybackMonths: 30, horizonMonths: 36,
    baselineRevenue: 2400000, baselineCost: 1680000,
    expectedRevenueDelta: 40000, expectedCostDelta: -20000,
    confidence: 'medium',
    text: 'Employee engagement program: training, feedback loops, career paths.',
    owner: 'HR Director',
  },
];

// ─── ROI Realized Values ────────────────────────────────────────────

interface RoiRealizedDef {
  initiativeId: string;
  months: Array<{ offset: number; revDelta: number; costDelta: number; savings: number; notes: string }>;
}

const ROI_REALIZED: RoiRealizedDef[] = [
  {
    initiativeId: 'atelier-init-01',
    months: [
      { offset: -5, revDelta: 8000, costDelta: -6000, savings: 14000, notes: 'Phase 1 baseline savings from scheduling' },
      { offset: -4, revDelta: 12000, costDelta: -9000, savings: 18000, notes: 'Compressed air leak fixes deployed' },
      { offset: -3, revDelta: 15000, costDelta: -11000, savings: 22000, notes: 'Predictive alerts reducing idle time' },
      { offset: -2, revDelta: 18000, costDelta: -13000, savings: 25000, notes: 'Full shift optimization active' },
      { offset: -1, revDelta: 20000, costDelta: -14500, savings: 28000, notes: 'Stabilized at target run rate' },
      { offset: 0, revDelta: 22000, costDelta: -15000, savings: 30000, notes: 'Exceeding plan — monitoring weekly' },
    ],
  },
  {
    initiativeId: 'atelier-init-02',
    months: [
      { offset: -4, revDelta: 5000, costDelta: -3500, savings: 8000, notes: 'WMS go-live, initial routing gains' },
      { offset: -3, revDelta: 8000, costDelta: -5000, savings: 11000, notes: 'Route optimization Phase 2' },
      { offset: -2, revDelta: 10000, costDelta: -6500, savings: 14000, notes: 'Carrier consolidation savings' },
      { offset: -1, revDelta: 12000, costDelta: -7000, savings: 16000, notes: 'On-time rate above 93%' },
      { offset: 0, revDelta: 13000, costDelta: -7500, savings: 17000, notes: 'Approaching target delivery rate' },
    ],
  },
  {
    initiativeId: 'atelier-init-03',
    months: [
      { offset: -3, revDelta: 15000, costDelta: -2000, savings: 3000, notes: 'CX program launched, early retention signal' },
      { offset: -2, revDelta: 22000, costDelta: -2500, savings: 4000, notes: 'Upsell pipeline growing' },
      { offset: -1, revDelta: 28000, costDelta: -3000, savings: 5000, notes: 'NPS improved to 47' },
      { offset: 0, revDelta: 35000, costDelta: -3000, savings: 6000, notes: 'Retention rate up 8pp' },
    ],
  },
  {
    initiativeId: 'atelier-init-04',
    months: [
      { offset: -5, revDelta: 0, costDelta: -12000, savings: 20000, notes: 'Sensor deployment Phase 1' },
      { offset: -4, revDelta: 0, costDelta: -18000, savings: 28000, notes: 'ML model trained, first alerts' },
      { offset: -3, revDelta: 0, costDelta: -22000, savings: 35000, notes: 'MTTR reduced to 5.8h' },
      { offset: -2, revDelta: 0, costDelta: -25000, savings: 40000, notes: 'Unplanned downtime -40%' },
      { offset: -1, revDelta: 0, costDelta: -28000, savings: 45000, notes: 'MTTR at 5.1h, ahead of plan' },
      { offset: 0, revDelta: 0, costDelta: -30000, savings: 48000, notes: 'Full predictive coverage active' },
    ],
  },
];

// ─── Deviation Cases ────────────────────────────────────────────────

interface DeviationDef {
  id: string;
  kpiId: string;
  severity: 'AMBER' | 'RED';
  status: string;
  summary: string;
  rca: string;
  actions: Array<{ id: string; title: string; status: 'OPEN' | 'DONE' }>;
}

const DEVIATIONS: DeviationDef[] = [
  {
    id: 'atelier-dev-energy-01',
    kpiId: 'atelier-kpi-energy',
    severity: 'AMBER',
    status: 'IN_PROGRESS',
    summary: 'Energy per unit regressed from 5.7 to 5.8 kWh — above amber threshold.',
    rca: 'Root cause: Line 3 compressor leak detected during weekend shift. Secondary: shift changeover idle time increased due to new operator onboarding.',
    actions: [
      { id: 'atelier-dev-act-01', title: 'Schedule compressor leak repair (Line 3)', status: 'DONE' },
      { id: 'atelier-dev-act-02', title: 'Implement shift changeover checklist', status: 'OPEN' },
      { id: 'atelier-dev-act-03', title: 'Install real-time energy monitoring on Line 3', status: 'OPEN' },
    ],
  },
  {
    id: 'atelier-dev-mttr-01',
    kpiId: 'atelier-kpi-mttr',
    severity: 'AMBER',
    status: 'OPEN',
    summary: 'MTTR still at 4.5h vs target 3.0h — improvement pace slowing.',
    rca: 'Spare parts lead time for critical components exceeds SLA. Technician skill gap on new CNC equipment.',
    actions: [
      { id: 'atelier-dev-act-04', title: 'Negotiate express delivery SLA with parts supplier', status: 'OPEN' },
      { id: 'atelier-dev-act-05', title: 'Schedule CNC training for maintenance team', status: 'OPEN' },
    ],
  },
  {
    id: 'atelier-dev-scrap-01',
    kpiId: 'atelier-kpi-scrap',
    severity: 'RED',
    status: 'ACKNOWLEDGED',
    summary: 'Scrap rate at 2.4% — still significantly above 1.5% target. RED threshold breached.',
    rca: 'Material quality variance from new supplier batch. Tool wear detection algorithm needs recalibration.',
    actions: [
      { id: 'atelier-dev-act-06', title: 'Return defective material batch to supplier', status: 'DONE' },
      { id: 'atelier-dev-act-07', title: 'Recalibrate tool wear detection thresholds', status: 'OPEN' },
      { id: 'atelier-dev-act-08', title: 'Add incoming material quality gate', status: 'OPEN' },
    ],
  },
];

// ─── Main Seed ──────────────────────────────────────────────────────

// ─── Initiative Definitions ─────────────────────────────────────────

interface InitiativeDef {
  id: string;
  name: string;
  status: string;
  summary: string;
  priority: string;
}

const INITIATIVES: InitiativeDef[] = [
  { id: 'atelier-init-01', name: 'OEE Improvement Program', status: 'in_progress', summary: 'Predictive maintenance and scheduling optimization to increase OEE from 68% to 85%.', priority: 'high' },
  { id: 'atelier-init-02', name: 'Supply Chain Excellence', status: 'in_progress', summary: 'WMS upgrade and route optimization for 95% on-time delivery.', priority: 'high' },
  { id: 'atelier-init-03', name: 'Customer Experience Transformation', status: 'in_progress', summary: 'NPS improvement program driving retention and upsell revenue.', priority: 'medium' },
  { id: 'atelier-init-04', name: 'Predictive Maintenance Platform', status: 'in_progress', summary: 'IoT sensor deployment and ML-based failure prediction to reduce MTTR.', priority: 'high' },
  { id: 'atelier-init-05', name: 'Employee Engagement & Development', status: 'planned', summary: 'Training, feedback loops, and career path development program.', priority: 'medium' },
  { id: 'atelier-init-06', name: 'Digital Revenue Growth', status: 'in_progress', summary: 'E-commerce platform and digital channel expansion for revenue growth.', priority: 'high' },
  { id: 'atelier-init-07', name: 'Quality Management System', status: 'planned', summary: 'Automated quality inspection and SPC implementation.', priority: 'medium' },
  { id: 'atelier-init-08', name: 'Sustainability & Energy Management', status: 'completed', summary: 'Energy monitoring, LED retrofit, and compressed air optimization.', priority: 'medium' },
];

async function main() {
  await getDatabase();
  console.log(`\n🔧 Seeding Results module for org: ${ORG_ID}\n`);

  // 0) Initiatives
  console.log('  → Ensuring initiatives exist...');
  const hasPriority = await columnExists('initiatives', 'priority');
  const hasSummary = await columnExists('initiatives', 'summary');

  for (const init of INITIATIVES) {
    const cols = ['id', 'organization_id', 'name', 'status'];
    const vals: (string | number | null)[] = [init.id, ORG_ID, init.name, init.status];

    if (hasPriority) { cols.push('priority'); vals.push(init.priority); }
    if (hasSummary) { cols.push('summary'); vals.push(init.summary); }

    const ph = cols.map((_, i) => `$${i + 1}`);
    await DbPromise.run(
      `INSERT INTO initiatives (${cols.join(', ')}, created_at, updated_at)
       VALUES (${ph.join(', ')}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status`,
      vals
    );
    console.log(`    ✓ ${init.name}`);
  }

  // 1) KPIs
  console.log('  → Inserting KPI definitions...');
  const hasCurrentValue = await columnExists('initiative_kpis', 'current_value');
  const hasBaseline = await columnExists('initiative_kpis', 'baseline_value');
  const hasDirection = await columnExists('initiative_kpis', 'direction');
  const hasThresholdMode = await columnExists('initiative_kpis', 'threshold_mode');

  for (const kpi of KPIS) {
    const latestValue = kpi.values[kpi.values.length - 1];
    const cols = [
      'id', 'initiative_id', 'organization_id', 'name', 'description', 'unit',
      'target_value', 'measurement_frequency', 'owner_user_id',
      'created_at', 'updated_at',
    ];
    const vals: (string | number | null)[] = [
      kpi.id, null, ORG_ID, kpi.name, kpi.description, kpi.unit,
      kpi.target, kpi.frequency, OWNER_USER_ID,
      'NOW()', 'NOW()',
    ];

    if (hasBaseline) { cols.push('baseline_value'); vals.push(kpi.baseline); }
    if (hasCurrentValue) { cols.push('current_value'); vals.push(latestValue); }
    if (hasDirection) { cols.push('direction'); vals.push(kpi.direction); }
    if (hasThresholdMode) {
      cols.push('threshold_mode', 'amber_threshold_pct', 'red_threshold_pct');
      vals.push('PERCENT_FROM_TARGET', 0.1, 0.2);
    }

    const placeholders = cols.map((c, i) => {
      if (c === 'created_at' || c === 'updated_at') return 'CURRENT_TIMESTAMP';
      return `$${i + 1 - (cols.slice(0, i).filter(cc => cc === 'created_at' || cc === 'updated_at').length)}`;
    });

    // Simpler approach: just use numbered params for non-timestamp cols
    const realCols = cols.filter(c => c !== 'created_at' && c !== 'updated_at');
    const realVals = vals.filter((_, i) => cols[i] !== 'created_at' && cols[i] !== 'updated_at');
    const ph = realCols.map((_, i) => `$${i + 1}`);

    await DbPromise.run(
      `INSERT INTO initiative_kpis (${realCols.join(', ')}, created_at, updated_at)
       VALUES (${ph.join(', ')}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         target_value = EXCLUDED.target_value,
         ${hasCurrentValue ? 'current_value = EXCLUDED.current_value,' : ''}
         ${hasBaseline ? 'baseline_value = EXCLUDED.baseline_value,' : ''}
         updated_at = CURRENT_TIMESTAMP`,
      realVals
    );
    console.log(`    ✓ ${kpi.name}`);
  }

  // 2) KPI Time Series (6 months of data per KPI)
  console.log('  → Inserting KPI time series...');
  if (await tableExists('kpi_time_series')) {
    for (const kpi of KPIS) {
      for (let m = 0; m < kpi.values.length; m++) {
        const offset = m - (kpi.values.length - 1);
        const id = `${kpi.id}-ts-${String(m + 1).padStart(2, '0')}`;
        await DbPromise.run(
          `INSERT INTO kpi_time_series (id, kpi_id, organization_id, value, period_start, source, notes, recorded_by, created_at)
           VALUES ($1, $2, $3, $4, $5, 'seed', $6, $7, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value`,
          [id, kpi.id, ORG_ID, kpi.values[m], monthStart(offset), `Seeded value for ${kpi.name}`, OWNER_USER_ID]
        );
      }
    }
    console.log(`    ✓ ${KPIS.length * 6} time series records`);
  }

  // 3) KPI Mappings (initiative ↔ KPI)
  console.log('  → Inserting KPI ↔ Initiative mappings...');
  if (await tableExists('initiative_kpi_mappings')) {
    for (const m of MAPPINGS) {
      const id = uid();
      await DbPromise.run(
        `INSERT INTO initiative_kpi_mappings (id, initiative_id, kpi_id, organization_id, impact_weight, impact_direction, confidence, notes, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (initiative_id, kpi_id) DO UPDATE SET
           impact_weight = EXCLUDED.impact_weight,
           impact_direction = EXCLUDED.impact_direction,
           confidence = EXCLUDED.confidence,
           updated_at = CURRENT_TIMESTAMP`,
        [id, m.initiativeId, m.kpiId, ORG_ID, m.weight, m.direction, m.confidence, `Mapping: ${m.initiativeId} → ${m.kpiId}`, OWNER_USER_ID]
      );
    }
    console.log(`    ✓ ${MAPPINGS.length} mappings`);
  }

  // 4) ROI Assumptions
  console.log('  → Inserting ROI assumptions...');
  if (await tableExists('roi_assumptions')) {
    for (const a of ROI_ASSUMPTIONS) {
      await DbPromise.run(
        `INSERT INTO roi_assumptions (
           id, initiative_id, organization_id,
           capex, opex_annual, expected_roi_percent, expected_npv, expected_payback_months, horizon_months,
           baseline_revenue, baseline_cost, expected_revenue_delta, expected_cost_delta,
           effect_start_date, assumptions_text, assumptions_owner, confidence, last_updated_by,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3,
           $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13,
           $14, $15, $16, $17, $18,
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         ) ON CONFLICT (initiative_id) DO UPDATE SET
           capex = EXCLUDED.capex,
           opex_annual = EXCLUDED.opex_annual,
           expected_roi_percent = EXCLUDED.expected_roi_percent,
           expected_npv = EXCLUDED.expected_npv,
           expected_payback_months = EXCLUDED.expected_payback_months,
           horizon_months = EXCLUDED.horizon_months,
           baseline_revenue = EXCLUDED.baseline_revenue,
           baseline_cost = EXCLUDED.baseline_cost,
           expected_revenue_delta = EXCLUDED.expected_revenue_delta,
           expected_cost_delta = EXCLUDED.expected_cost_delta,
           effect_start_date = EXCLUDED.effect_start_date,
           assumptions_text = EXCLUDED.assumptions_text,
           assumptions_owner = EXCLUDED.assumptions_owner,
           confidence = EXCLUDED.confidence,
           last_updated_by = EXCLUDED.last_updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [
          uid(), a.initiativeId, ORG_ID,
          a.capex, a.opexAnnual, a.expectedRoiPercent, a.expectedNpv, a.expectedPaybackMonths, a.horizonMonths,
          a.baselineRevenue, a.baselineCost, a.expectedRevenueDelta, a.expectedCostDelta,
          monthStart(-6), a.text, a.owner, a.confidence, OWNER_USER_ID,
        ]
      );
      console.log(`    ✓ ROI assumptions for ${a.initiativeId}`);
    }
  }

  // 5) ROI Realized Values
  console.log('  → Inserting ROI realized values...');
  if (await tableExists('roi_realized_values')) {
    let count = 0;
    for (const r of ROI_REALIZED) {
      for (const m of r.months) {
        const id = `${r.initiativeId}-roi-${String(Math.abs(m.offset)).padStart(2, '0')}`;
        await DbPromise.run(
          `INSERT INTO roi_realized_values (id, initiative_id, organization_id, period_month, realized_revenue_delta, realized_cost_delta, realized_savings, source, variance_notes, recorded_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'seed', $8, $9, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE SET
             realized_revenue_delta = EXCLUDED.realized_revenue_delta,
             realized_cost_delta = EXCLUDED.realized_cost_delta,
             realized_savings = EXCLUDED.realized_savings,
             variance_notes = EXCLUDED.variance_notes`,
          [id, r.initiativeId, ORG_ID, monthStart(m.offset), m.revDelta, m.costDelta, m.savings, m.notes, OWNER_USER_ID]
        );
        count++;
      }
    }
    console.log(`    ✓ ${count} realized value records`);
  }

  // 6) Deviation Cases + Actions
  console.log('  → Inserting deviation cases and actions...');
  if (await tableExists('kpi_deviation_cases')) {
    for (const d of DEVIATIONS) {
      const hasEvidence = await columnExists('kpi_deviation_cases', 'evidence_text');
      const hasLinked = await columnExists('kpi_deviation_cases', 'linked_initiative_id');

      await DbPromise.run(
        `INSERT INTO kpi_deviation_cases (
           id, kpi_id, organization_id, period_start, severity, status,
           owner_user_id, deviation_summary, rca_text,
           detected_at, detected_by, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9,
           CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         ) ON CONFLICT (organization_id, kpi_id, period_start) DO UPDATE SET
           severity = EXCLUDED.severity,
           status = EXCLUDED.status,
           deviation_summary = EXCLUDED.deviation_summary,
           rca_text = EXCLUDED.rca_text,
           updated_at = CURRENT_TIMESTAMP`,
        [d.id, d.kpiId, ORG_ID, monthStart(0), d.severity, d.status, OWNER_USER_ID, d.summary, d.rca]
      );

      for (const a of d.actions) {
        await DbPromise.run(
          `INSERT INTO kpi_deviation_actions (id, case_id, title, owner_user_id, due_date, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             status = EXCLUDED.status,
             updated_at = CURRENT_TIMESTAMP`,
          [a.id, d.id, a.title, OWNER_USER_ID, monthStart(1), a.status]
        );
      }
      console.log(`    ✓ Deviation: ${d.summary.slice(0, 60)}...`);
    }
  }

  // 7) V8 KPI Definitions (for the V8 dashboard/scorecard surface)
  console.log('  → Inserting V8 KPI definitions...');
  const v8KpiIdMap = new Map<string, string>();
  if (await tableExists('v8_kpi_definitions')) {
    const v8Kpis = [
      { name: 'OEE', mode: 'initiative_linked', initId: 'atelier-init-01', type: 'percentage', baseline: 68, target: 85, current: 81, cadence: 'monthly', status: 'active' },
      { name: 'Energy per Unit', mode: 'initiative_linked', initId: 'atelier-init-01', type: 'ratio', baseline: 6.8, target: 5.2, current: 5.8, cadence: 'monthly', status: 'deviation' },
      { name: 'On-Time Delivery', mode: 'initiative_linked', initId: 'atelier-init-02', type: 'percentage', baseline: 82, target: 95, current: 94, cadence: 'monthly', status: 'active' },
      { name: 'Scrap Rate', mode: 'standalone', initId: null, type: 'percentage', baseline: 4.2, target: 1.5, current: 2.4, cadence: 'monthly', status: 'deviation' },
      { name: 'Customer NPS', mode: 'initiative_linked', initId: 'atelier-init-03', type: 'score', baseline: 32, target: 55, current: 50, cadence: 'quarterly', status: 'measurement' },
      { name: 'MTTR', mode: 'initiative_linked', initId: 'atelier-init-04', type: 'duration', baseline: 8.5, target: 3.0, current: 4.5, cadence: 'monthly', status: 'improvement' },
      { name: 'Revenue Growth YoY', mode: 'standalone', initId: null, type: 'percentage', baseline: 3.2, target: 12.0, current: 10.5, cadence: 'quarterly', status: 'active' },
      { name: 'Employee Engagement', mode: 'initiative_linked', initId: 'atelier-init-05', type: 'score', baseline: 58, target: 78, current: 73, cadence: 'quarterly', status: 'design' },
    ];

    for (const k of v8Kpis) {
      const id = uid();
      v8KpiIdMap.set(k.name, id);
      try {
        await DbPromise.run(
          `INSERT INTO v8_kpi_definitions (kpi_id, organization_id, name, mode, initiative_id, metric_type, baseline_value, target_value, current_value, measurement_cadence, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [id, ORG_ID, k.name, k.mode, k.initId, k.type, k.baseline, k.target, k.current, k.cadence, k.status]
        );
      } catch (err: any) {
        console.log(`    ⚠ V8 KPI ${k.name}: ${err?.message?.slice(0, 80)}`);
      }
    }
    console.log(`    ✓ ${v8Kpis.length} V8 KPI definitions`);
  }

  // 8) V8 Deviation Records (for V8 dashboard)
  console.log('  → Inserting V8 deviation records...');
  if (await tableExists('v8_deviation_records')) {
    const v8Deviations = [
      { kpiName: 'Energy per Unit', type: 'underperformance', severity: 'medium', action: 'Investigate compressor leak on Line 3', actual: 5.8, target: 5.2 },
      { kpiName: 'Scrap Rate', type: 'underperformance', severity: 'high', action: 'Recalibrate tool wear detection and inspect incoming materials', actual: 2.4, target: 1.5 },
      { kpiName: 'MTTR', type: 'underperformance', severity: 'medium', action: 'Review spare parts SLA and schedule CNC training', actual: 4.5, target: 3.0 },
    ];

    for (const d of v8Deviations) {
      const kpiId = v8KpiIdMap.get(d.kpiName);
      if (!kpiId) { console.log(`    ⚠ Skipping deviation for ${d.kpiName} — no V8 KPI ID`); continue; }
      try {
        await DbPromise.run(
          `INSERT INTO v8_deviation_records (deviation_id, organization_id, kpi_id, deviation_type, severity, action_required, created_at, observed_actual, observed_target)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8)`,
          [uid(), ORG_ID, kpiId, d.type, d.severity, d.action, d.actual, d.target]
        );
      } catch (err: any) {
        console.log(`    ⚠ V8 deviation ${d.kpiName}: ${err?.message?.slice(0, 80)}`);
      }
    }
    console.log(`    ✓ ${v8Deviations.length} V8 deviation records`);
  }

  // 9) V8 ROI Realization Entries (for V8 dashboard)
  console.log('  → Inserting V8 ROI realization entries...');
  if (await tableExists('v8_roi_realization_entries')) {
    const v8Roi = [
      { kpiName: 'OEE', initId: 'atelier-init-01', value: 95000, period: monthStart(-1) },
      { kpiName: 'OEE', initId: 'atelier-init-01', value: 110000, period: monthStart(0) },
      { kpiName: 'On-Time Delivery', initId: 'atelier-init-02', value: 48000, period: monthStart(-1) },
      { kpiName: 'On-Time Delivery', initId: 'atelier-init-02', value: 56000, period: monthStart(0) },
      { kpiName: 'Customer NPS', initId: 'atelier-init-03', value: 38000, period: monthStart(0) },
      { kpiName: 'MTTR', initId: 'atelier-init-04', value: 135000, period: monthStart(-1) },
      { kpiName: 'MTTR', initId: 'atelier-init-04', value: 148000, period: monthStart(0) },
    ];

    for (const r of v8Roi) {
      const kpiId = v8KpiIdMap.get(r.kpiName);
      if (!kpiId) { console.log(`    ⚠ Skipping ROI for ${r.kpiName} — no V8 KPI ID`); continue; }
      try {
        await DbPromise.run(
          `INSERT INTO v8_roi_realization_entries (entry_id, organization_id, kpi_id, initiative_id, realized_value, period, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [uid(), ORG_ID, kpiId, r.initId, r.value, r.period]
        );
      } catch (err: any) {
        console.log(`    ⚠ V8 ROI ${r.kpiName}: ${err?.message?.slice(0, 80)}`);
      }
    }
    console.log(`    ✓ ${v8Roi.length} V8 ROI entries`);
  }

  // 10) KPI Report Snapshot (so KPI Reports tab has data)
  console.log('  → Inserting KPI report snapshot...');
  if (await tableExists('results_kpi_report_snapshots')) {
    const snapshotId = 'atelier-kpi-report-01';
    const snapshotJson = JSON.stringify({
      title: 'Q1 2026 KPI Performance Review',
      periodStart: monthStart(-3),
      periodEnd: monthStart(0),
      kpis: KPIS.map(k => ({
        id: k.id,
        name: k.name,
        unit: k.unit,
        target: k.target,
        current: k.values[k.values.length - 1],
        baseline: k.baseline,
        trend: k.direction === 'HIGHER_IS_BETTER'
          ? (k.values[k.values.length - 1] > k.values[0] ? 'improving' : 'declining')
          : (k.values[k.values.length - 1] < k.values[0] ? 'improving' : 'declining'),
      })),
      deviationCases: DEVIATIONS.length,
      stats: {
        totalKpis: KPIS.length,
        onTarget: KPIS.filter(k => {
          const latest = k.values[k.values.length - 1];
          return k.direction === 'HIGHER_IS_BETTER' ? latest >= k.target : latest <= k.target;
        }).length,
        belowTarget: KPIS.filter(k => {
          const latest = k.values[k.values.length - 1];
          return k.direction === 'HIGHER_IS_BETTER' ? latest < k.target : latest > k.target;
        }).length,
      },
    });

    try {
      await DbPromise.run(
        `INSERT INTO results_kpi_report_snapshots (id, organization_id, period_start, period_end, title, snapshot_json, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           snapshot_json = EXCLUDED.snapshot_json,
           title = EXCLUDED.title`,
        [snapshotId, ORG_ID, monthStart(-3), monthStart(0), 'Q1 2026 KPI Performance Review', snapshotJson, OWNER_USER_ID]
      );
    } catch {
      // FK on created_by may fail if user not in users table; try without created_by
      await DbPromise.run(
        `INSERT INTO results_kpi_report_snapshots (id, organization_id, period_start, period_end, title, snapshot_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           snapshot_json = EXCLUDED.snapshot_json,
           title = EXCLUDED.title`,
        [snapshotId, ORG_ID, monthStart(-3), monthStart(0), 'Q1 2026 KPI Performance Review', snapshotJson]
      );
    }
    console.log(`    ✓ KPI report snapshot: Q1 2026`);
  }

  console.log('\n✅ Results module seed completed successfully!');
  console.log(`   Organization: ${ORG_ID}`);
  console.log(`   KPIs: ${KPIS.length}`);
  console.log(`   Time series: ${KPIS.length * 6} records`);
  console.log(`   KPI mappings: ${MAPPINGS.length}`);
  console.log(`   ROI assumptions: ${ROI_ASSUMPTIONS.length}`);
  console.log(`   ROI realized: ${ROI_REALIZED.reduce((s, r) => s + r.months.length, 0)} records`);
  console.log(`   Deviations: ${DEVIATIONS.length} cases, ${DEVIATIONS.reduce((s, d) => s + d.actions.length, 0)} actions`);
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err?.message || err);
  console.error(err?.stack);
  process.exit(1);
});
