#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Results Module Seed (KPI + ROI + Deviation) — safe, opt-in
 *
 * Goal: ensure there is coherent, non-placeholder data to validate the Results module end-to-end.
 *
 * Usage (recommended local env):
 *   docker compose up -d postgres redis api
 *   cd server
 *   npx tsx scripts/seed-results-module.ts
 *
 * Notes:
 * - Uses INSERT ... ON CONFLICT DO NOTHING to be idempotent.
 * - Writes only to a dedicated orgId `org-results-demo` to avoid contaminating existing datasets.
 */

import { randomUUID } from 'crypto';

import { createDatabase } from '../src/database/Database.js';

const ORG_ID = 'org-results-demo';
const ORG_NAME = 'Results Demo Org';
const OWNER_USER_ID = 'user-results-owner';
const OWNER_EMAIL = 'results.owner@demo.local';

const INIT_1 = 'init-results-energy';
const INIT_2 = 'init-results-otd';

const KPI_OEE = 'kpi-results-oee';
const KPI_ENERGY = 'kpi-results-energy';
const KPI_OTD = 'kpi-results-otd';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthStart(offsetMonths: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1));
  return isoDate(d);
}

async function main() {
  const db = await createDatabase();

  console.log('Seeding Results module dataset…');

  // 1) Organization + owner user (minimal)
  await db.run(
    `INSERT INTO organizations (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING`,
    [ORG_ID, ORG_NAME]
  );

  await db.run(
    `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [OWNER_USER_ID, ORG_ID, OWNER_EMAIL, 'Results', 'Owner', 'admin', 'active']
  );

  // 2) Initiatives (keep consistent with ResultsSummaryView + ROI)
  await db.run(
    `INSERT INTO initiatives (id, organization_id, name, status, summary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING`,
    [INIT_1, ORG_ID, 'Energy optimization (Phase 1)', 'DONE', 'Reduce energy consumption per unit produced.']
  );
  await db.run(
    `INSERT INTO initiatives (id, organization_id, name, status, summary, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING`,
    [INIT_2, ORG_ID, 'On-time delivery improvement', 'DONE', 'Improve on-time delivery via scheduling + WMS.']
  );

  // 3) KPIs (global KPIs scoped by organization_id; mappings define N↔N relations)
  await db.run(
    `INSERT INTO initiative_kpis (
        id, initiative_id, organization_id, name, description, unit,
        baseline_value, target_value, measurement_frequency,
        owner_user_id, direction, threshold_mode, amber_threshold_pct, red_threshold_pct,
        created_at, updated_at
     ) VALUES (
        ?, NULL, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     ) ON CONFLICT (id) DO NOTHING`,
    [
      KPI_OEE,
      ORG_ID,
      'OEE',
      'Overall Equipment Effectiveness',
      '%',
      72,
      82,
      'MONTHLY',
      OWNER_USER_ID,
      'HIGHER_IS_BETTER',
      'PERCENT_FROM_TARGET',
      0.1,
      0.2,
    ]
  );

  await db.run(
    `INSERT INTO initiative_kpis (
        id, initiative_id, organization_id, name, description, unit,
        baseline_value, target_value, measurement_frequency,
        owner_user_id, direction, threshold_mode, amber_threshold_pct, red_threshold_pct,
        created_at, updated_at
     ) VALUES (
        ?, NULL, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     ) ON CONFLICT (id) DO NOTHING`,
    [
      KPI_ENERGY,
      ORG_ID,
      'Energy per unit',
      'kWh per produced unit',
      'kWh',
      6.2,
      5.4,
      'MONTHLY',
      OWNER_USER_ID,
      'LOWER_IS_BETTER',
      'PERCENT_FROM_TARGET',
      0.05,
      0.1,
    ]
  );

  await db.run(
    `INSERT INTO initiative_kpis (
        id, initiative_id, organization_id, name, description, unit,
        baseline_value, target_value, measurement_frequency,
        owner_user_id, direction, threshold_mode, amber_threshold_pct, red_threshold_pct,
        created_at, updated_at
     ) VALUES (
        ?, NULL, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     ) ON CONFLICT (id) DO NOTHING`,
    [
      KPI_OTD,
      ORG_ID,
      'OTD',
      'On-time delivery',
      '%',
      86,
      95,
      'MONTHLY',
      OWNER_USER_ID,
      'HIGHER_IS_BETTER',
      'PERCENT_FROM_TARGET',
      0.05,
      0.1,
    ]
  );

  // 4) KPI mappings (N↔N)
  await db.run(
    `INSERT INTO initiative_kpi_mappings (
        id, initiative_id, kpi_id, organization_id,
        impact_weight, impact_direction, confidence, notes, created_at, updated_at, created_by
     ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?
     ) ON CONFLICT (initiative_id, kpi_id) DO NOTHING`,
    [randomUUID().replace(/-/g, ''), INIT_1, KPI_ENERGY, ORG_ID, 1.0, 'decrease', 'high', 'Primary KPI for initiative', OWNER_USER_ID]
  );
  await db.run(
    `INSERT INTO initiative_kpi_mappings (
        id, initiative_id, kpi_id, organization_id,
        impact_weight, impact_direction, confidence, notes, created_at, updated_at, created_by
     ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?
     ) ON CONFLICT (initiative_id, kpi_id) DO NOTHING`,
    [randomUUID().replace(/-/g, ''), INIT_2, KPI_OTD, ORG_ID, 1.0, 'increase', 'high', 'Primary KPI for initiative', OWNER_USER_ID]
  );
  // Cross-link OEE to both initiatives (example N↔N)
  await db.run(
    `INSERT INTO initiative_kpi_mappings (
        id, initiative_id, kpi_id, organization_id,
        impact_weight, impact_direction, confidence, notes, created_at, updated_at, created_by
     ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?
     ) ON CONFLICT (initiative_id, kpi_id) DO NOTHING`,
    [randomUUID().replace(/-/g, ''), INIT_1, KPI_OEE, ORG_ID, 0.6, 'increase', 'medium', 'Secondary KPI (shared)', OWNER_USER_ID]
  );
  await db.run(
    `INSERT INTO initiative_kpi_mappings (
        id, initiative_id, kpi_id, organization_id,
        impact_weight, impact_direction, confidence, notes, created_at, updated_at, created_by
     ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?
     ) ON CONFLICT (initiative_id, kpi_id) DO NOTHING`,
    [randomUUID().replace(/-/g, ''), INIT_2, KPI_OEE, ORG_ID, 0.4, 'increase', 'medium', 'Secondary KPI (shared)', OWNER_USER_ID]
  );

  // 5) KPI time-series (3 last months incl. "prev" point used by trends)
  const ts = [
    { kpiId: KPI_OEE, values: [76, 79, 81] }, // trending up, close to target
    { kpiId: KPI_ENERGY, values: [6.0, 5.8, 5.9] }, // needs improvement, slight regression
    { kpiId: KPI_OTD, values: [89, 92, 94] }, // improving
  ];

  for (let idx = 0; idx < ts.length; idx++) {
    const item = ts[idx];
    for (let m = -2; m <= 0; m++) {
      const value = item.values[m + 2];
      const id = randomUUID().replace(/-/g, '');
      await db.run(
        `INSERT INTO kpi_time_series (
            id, kpi_id, initiative_id, organization_id, value, period_start, source, notes, recorded_by, created_at
         ) VALUES (
            ?, ?, NULL, ?, ?, ?, 'manual', ?, ?, CURRENT_TIMESTAMP
         ) ON CONFLICT (id) DO NOTHING`,
        [id, item.kpiId, ORG_ID, value, monthStart(m), 'Seeded for Results module validation', OWNER_USER_ID]
      );
    }
  }

  // 6) ROI assumptions + realized for INIT_1 (used by ROITrackingView + ROIDetailDrawer)
  await db.run(
    `INSERT INTO roi_assumptions (
        id, initiative_id, organization_id,
        capex, opex_annual, expected_roi_percent, expected_npv, expected_payback_months, horizon_months,
        baseline_revenue, baseline_cost, expected_revenue_delta, expected_cost_delta,
        effect_start_date, assumptions_text, assumptions_owner, confidence, last_updated_by,
        created_at, updated_at
     ) VALUES (
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     ) ON CONFLICT (initiative_id) DO UPDATE SET
       capex=excluded.capex,
       opex_annual=excluded.opex_annual,
       expected_roi_percent=excluded.expected_roi_percent,
       expected_npv=excluded.expected_npv,
       expected_payback_months=excluded.expected_payback_months,
       horizon_months=excluded.horizon_months,
       baseline_revenue=excluded.baseline_revenue,
       baseline_cost=excluded.baseline_cost,
       expected_revenue_delta=excluded.expected_revenue_delta,
       expected_cost_delta=excluded.expected_cost_delta,
       effect_start_date=excluded.effect_start_date,
       assumptions_text=excluded.assumptions_text,
       assumptions_owner=excluded.assumptions_owner,
       confidence=excluded.confidence,
       last_updated_by=excluded.last_updated_by,
       updated_at=CURRENT_TIMESTAMP`,
    [
      randomUUID().replace(/-/g, ''),
      INIT_1,
      ORG_ID,
      120000,
      15000,
      28,
      180000,
      14,
      36,
      1200000,
      820000,
      0,
      60000,
      monthStart(-2),
      'Energy savings from optimized scheduling + compressed air leak detection.',
      'Ops Director',
      'high',
      OWNER_USER_ID,
    ]
  );

  // realized values (last 3 months)
  const realized = [
    { m: -2, savings: 12000, notes: 'Phase 1 rollout - baseline savings' },
    { m: -1, savings: 16000, notes: 'Leak fixes + machine idle policy' },
    { m: 0, savings: 18000, notes: 'Stabilized savings; monitoring weekly' },
  ];
  for (const r of realized) {
    await db.run(
      `INSERT INTO roi_realized_values (
          id, initiative_id, organization_id, period_month,
          realized_revenue_delta, realized_cost_delta, realized_savings,
          source, variance_notes, recorded_by, created_at
       ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?,
          'manual', ?, ?, CURRENT_TIMESTAMP
       ) ON CONFLICT (id) DO NOTHING`,
      [
        randomUUID().replace(/-/g, ''),
        INIT_1,
        ORG_ID,
        monthStart(r.m),
        0,
        -r.savings,
        r.savings,
        r.notes,
        OWNER_USER_ID,
      ]
    );
  }

  // 7) One open deviation case + action (used by KPITimeSeriesDrawer + KPI report snapshot)
  const caseId = 'kpi-devcase-energy-1';
  await db.run(
    `INSERT INTO kpi_deviation_cases (
        id, kpi_id, organization_id, period_start, period_end,
        severity, status, owner_user_id, deviation_summary, rca_text, detected_at, detected_by, created_at, updated_at
     ) VALUES (
        ?, ?, ?, ?, NULL,
        ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     ) ON CONFLICT (organization_id, kpi_id, period_start) DO NOTHING`,
    [
      caseId,
      KPI_ENERGY,
      ORG_ID,
      monthStart(0),
      'AMBER',
      'OPEN',
      OWNER_USER_ID,
      'Energy per unit above target threshold (AMBER).',
      'Main cause: compressed air leaks + shift change idle time.',
    ]
  );

  await db.run(
    `INSERT INTO kpi_deviation_actions (
        id, case_id, title, owner_user_id, due_date, status, created_at, updated_at
     ) VALUES (
        ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     ) ON CONFLICT (id) DO NOTHING`,
    [
      'kpi-devaction-energy-1',
      caseId,
      'Run leak test and implement weekly checklist',
      OWNER_USER_ID,
      monthStart(1),
      'OPEN',
    ]
  );

  console.log('✓ Results seed completed');
  console.log(`- orgId: ${ORG_ID}`);
  console.log(`- initiatives: ${INIT_1}, ${INIT_2}`);
  console.log(`- kpis: ${KPI_OEE}, ${KPI_ENERGY}, ${KPI_OTD}`);
  console.log(`- deviation case: ${caseId}`);
  console.log('');
  console.log('You can now open Results module and verify: KPI list, trends, needs entry, KPI report snapshot, ROI tracking.');
}

main().catch((err) => {
  console.error('Seed failed:', err?.message || err);
  process.exit(1);
});

