#!/usr/bin/env npx tsx
/**
 * RN-G6 — realistic local seed for the Results Next runtime environment.
 *
 * Writes directly to the KPI / ROI / OKR-vnext tables via raw parameterized
 * SQL (NOT through server services/routes — this is a data-shape seed for a
 * throwaway local Postgres, not a business-rule replay). Column names, enum
 * values and FK graph were read from `information_schema` / `\d` on this
 * exact schema (see docs/product/results-vnext/RN_G6_RUNTIME_ENVIRONMENT.md).
 *
 * Guardrails (same posture as server/scripts/lib/scriptDatabaseTarget.ts):
 *  - refuses to run unless DATABASE_URL points at localhost AND
 *    NODE_ENV=test/CI/VITEST (assertNoLocalDatabaseOutsideTests)
 *  - refuses to run unless SEED_CONFIRM=YES_SEED_RN_G6_LOCAL is set
 *  - is NOT idempotent by default: re-running without --wipe will hit unique
 *    constraints. Pass --wipe to delete prior rows for the two seed org ids
 *    first (scoped delete, not a truncate).
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:55821/rn_g6_runtime \
 *   NODE_ENV=test SEED_CONFIRM=YES_SEED_RN_G6_LOCAL \
 *   npx tsx scripts/rn-g6-seed-runtime-dataset.ts --wipe
 */
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

import { assertNoLocalDatabaseOutsideTests } from '../server/src/config/databaseTargetResolver.js';

const ORG_A = 'rn-g6-org-przemysl';
const ORG_B = 'rn-g6-org-doradztwo';

const USER_A = 'rn-g6-user-a-admin';
const USER_B = 'rn-g6-user-b-admin';
const TEST_PASSWORD = 'RnG6Runtime!2026';

async function main() {
  assertNoLocalDatabaseOutsideTests(process.env);

  if (process.env.SEED_CONFIRM !== 'YES_SEED_RN_G6_LOCAL') {
    throw new Error(
      'Refusing to seed without confirmation. Set SEED_CONFIRM=YES_SEED_RN_G6_LOCAL.'
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');

  const wipe = process.argv.includes('--wipe');

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (wipe) {
      console.log('--wipe: deleting prior RN-G6 seed rows for', ORG_A, ORG_B);
      await wipeOrg(client, ORG_A);
      await wipeOrg(client, ORG_B);
    }

    console.log('Seeding organizations + users...');
    await seedOrgsAndUsers(client);

    console.log('Seeding initiatives...');
    const initiatives = await seedInitiatives(client);

    console.log('Seeding KPI domain (org A, rich)...');
    const kpiA = await seedKpiDomain(client, ORG_A, USER_A, initiatives.initA1, 'rich');

    console.log('Seeding KPI domain (org B, light)...');
    const kpiB = await seedKpiDomain(client, ORG_B, USER_B, initiatives.initB1, 'light');

    console.log('Seeding ROI domain (org A, 4 phases)...');
    const roiA = await seedRoiDomain(
      client,
      ORG_A,
      USER_A,
      [initiatives.initA2, initiatives.initA1, initiatives.initA3, initiatives.initA4],
      'rich'
    );

    console.log('Seeding ROI domain (org B, 2 cases)...');
    const roiB = await seedRoiDomain(
      client,
      ORG_B,
      USER_B,
      [initiatives.initB1, initiatives.initB2],
      'light'
    );

    console.log('Seeding OKR domain (org A, active program)...');
    const okrA = await seedOkrDomain(client, ORG_A, USER_A, 'rich');

    console.log('Seeding OKR domain (org B, draft-only program)...');
    const okrB = await seedOkrDomain(client, ORG_B, USER_B, 'light');

    // Platform visibility rows — WITHOUT these, every list/detail read on
    // KPI/ROI/OKR-set goes through `buildVisibilityScopedCte`
    // (server/src/services/resultsVnext/platform/visibilityScopedQuery.ts)
    // and returns ZERO rows even though the underlying tables have data,
    // because that CTE INNER JOINs against rvn_platform_resource_visibility.
    // Discovered live against this exact seed: GET /api/vnext/results/kpi
    // returned {"kpis":[]} with 8 rows in rvn_kpi_definitions until this
    // step was added. OPEN_ORG is the simplest realistic mode; it also
    // matches KPI/ROI screens' apparent default expectation of "everyone in
    // the org can see it" absent an explicit narrower policy.
    console.log('Seeding platform visibility (OPEN_ORG) for org A resources...');
    await seedOpenOrgVisibility(client, ORG_A, USER_A, [
      ...Object.entries(kpiA)
        .filter(([k]) => k.startsWith('kpi'))
        .map(([, id]) => ({ resourceType: 'kpi', resourceId: id })),
      ...(kpiA.deviationCase1
        ? [{ resourceType: 'deviation_case', resourceId: kpiA.deviationCase1 }]
        : []),
      ...(kpiA.scorecard1 ? [{ resourceType: 'kpi_scorecard', resourceId: kpiA.scorecard1 }] : []),
      ...Object.entries(roiA).map(([, id]) => ({ resourceType: 'roi_case', resourceId: id })),
      ...(okrA.set1 ? [{ resourceType: 'okr_set', resourceId: okrA.set1 }] : []),
    ]);

    console.log('Seeding platform visibility (OPEN_ORG) for org B resources...');
    await seedOpenOrgVisibility(client, ORG_B, USER_B, [
      ...Object.entries(kpiB)
        .filter(([k]) => k.startsWith('kpi'))
        .map(([, id]) => ({ resourceType: 'kpi', resourceId: id })),
      ...(kpiB.deviationCase1
        ? [{ resourceType: 'deviation_case', resourceId: kpiB.deviationCase1 }]
        : []),
      ...Object.entries(roiB).map(([, id]) => ({ resourceType: 'roi_case', resourceId: id })),
      ...(okrB.set1 ? [{ resourceType: 'okr_set', resourceId: okrB.set1 }] : []),
    ]);

    await client.query('COMMIT');

    const summary = {
      organizations: [ORG_A, ORG_B],
      users: [
        { id: USER_A, email: `${USER_A}@consultify.local`, org: ORG_A },
        { id: USER_B, email: `${USER_B}@consultify.local`, org: ORG_B },
      ],
      password: TEST_PASSWORD,
      initiatives,
      kpi: { orgA: kpiA, orgB: kpiB },
      roi: { orgA: roiA, orgB: roiB },
      okr: { orgA: okrA, orgB: okrB },
    };
    console.log('\n=== RN-G6 SEED SUMMARY (save this) ===');
    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

async function wipeOrg(client: any, orgId: string) {
  // Delete in FK-safe order (children first). Scoped to organization_id —
  // never a blanket TRUNCATE.
  const tables = [
    'rvn_platform_resource_visibility',
    'rvn_platform_visibility_policies',
    'okr_vnext_checkins',
    'okr_vnext_checkin_occurrences',
    'okr_vnext_alignments',
    'okr_vnext_decision_links',
    'okr_vnext_support_requests',
    'okr_vnext_reflections',
    'okr_vnext_key_results',
    'okr_vnext_objectives',
    'okr_vnext_sets',
    'okr_vnext_cycles',
    'okr_vnext_program_policy_versions',
    'okr_vnext_programs',
    'rvn_roi_variances',
    'rvn_roi_actual_entries',
    'rvn_roi_actual_snapshots',
    'rvn_roi_post_investment_reviews',
    'rvn_roi_scenario_overrides',
    'rvn_roi_scenarios',
    'rvn_roi_forecast_versions',
    'rvn_roi_approval_snapshots',
    'rvn_roi_calculation_runs',
    'rvn_roi_assumptions',
    'rvn_roi_cost_lines',
    'rvn_roi_benefit_lines',
    'rvn_roi_baselines',
    'rvn_roi_calculation_policy',
    'rvn_roi_cases',
    'rvn_kpi_corrective_actions',
    'rvn_kpi_deviation_cases',
    'rvn_kpi_scorecard_review_snapshots',
    'rvn_kpi_scorecard_items',
    'rvn_kpi_scorecards',
    'rvn_kpi_measurements',
    'rvn_kpi_definition_versions',
    'rvn_kpi_definitions',
    'initiatives',
  ];
  // Join table with no organization_id of its own — delete via its parent.
  await client.query(
    `DELETE FROM rvn_kpi_scorecard_review_snapshot_measurements
     WHERE snapshot_id IN (SELECT snapshot_id FROM rvn_kpi_scorecard_review_snapshots WHERE organization_id = $1)`,
    [orgId]
  );
  // Break the programs -> policy_versions cycle before either side is deleted.
  await client.query(
    `UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id = $1`,
    [orgId]
  );
  // Break rvn_roi_cases' nullable forward references before deleting the
  // rows they point to (cases itself is deleted last in the list below).
  await client.query(
    `UPDATE rvn_roi_cases SET decision_calculation_run_id = NULL, original_approved_snapshot_id = NULL,
       latest_approved_snapshot_id = NULL, current_forecast_version_id = NULL, current_actual_snapshot_id = NULL
     WHERE organization_id = $1`,
    [orgId]
  );
  await client.query(
    `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
    [orgId]
  );
  for (const t of tables) {
    await client.query(`DELETE FROM ${t} WHERE organization_id = $1`, [orgId]);
  }
  await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId]);
  await client.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]);
  await client.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
}

async function seedOrgsAndUsers(client: any) {
  const passwordHash = bcrypt.hashSync(TEST_PASSWORD, 8);

  await client.query(
    `INSERT INTO organizations (id, name, plan, status, industry, organization_type, is_active)
     VALUES ($1, $2, 'enterprise', 'active', 'Manufacturing', 'CUSTOMER', 1)`,
    [ORG_A, 'Zjednoczona Grupa Przemysłowo-Technologiczna Wschód sp. z o.o.']
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status, industry, organization_type, is_active)
     VALUES ($1, $2, 'enterprise', 'active', 'Professional Services', 'CUSTOMER', 1)`,
    [ORG_B, 'Konsorcjum Doradztwa Strategicznego i Transformacji Cyfrowej S.A.']
  );

  await client.query(
    `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, access_level)
     VALUES ($1, $2, $3, $4, 'Anna', 'Kowalska-Wróbel', 'ADMIN', 'active', 'admin')`,
    [USER_A, ORG_A, `${USER_A}@consultify.local`, passwordHash]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status, access_level)
     VALUES ($1, $2, $3, $4, 'Marek', 'Zieliński', 'ADMIN', 'active', 'admin')`,
    [USER_B, ORG_B, `${USER_B}@consultify.local`, passwordHash]
  );

  // organization_members rows — WITHOUT these, GET /api/auth/me's
  // `resolveAuthEffectiveRole` (server/src/utils/platformRoles.ts) silently
  // downgrades every user to 'USER' regardless of users.role. Root cause
  // (found live against this exact seed, NOT fixed here — out of allowlist):
  // `normalizePlatformRole(membershipRole)` returns the STRING 'USER' as its
  // default for a null/absent membershipRole (normalizeApplicationRole's
  // fallthrough), never `null` — so `normalizePlatformRole(membershipRole) ||
  // userRole` in resolveAuthEffectiveRole never reaches the `|| userRole`
  // fallback its own comment describes. Any user without an
  // organization_members row is silently coerced to USER, which then trips
  // RouterSync's `isPilotRestrictedRole` gate and bounces every route to
  // /interview. See RN_G6_RUNTIME_ENVIRONMENT.md "Findings" for the reproduction.
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1,$2,$3,'ADMIN','ACTIVE')`,
    [uid(ORG_A, 'orgmember-a-admin'), ORG_A, USER_A]
  );
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1,$2,$3,'ADMIN','ACTIVE')`,
    [uid(ORG_B, 'orgmember-b-admin'), ORG_B, USER_B]
  );
}

async function seedInitiatives(client: any) {
  const initA1 = 'rn-g6-init-a1';
  const initA2 = 'rn-g6-init-a2';
  const initA3 = 'rn-g6-init-a3';
  const initA4 = 'rn-g6-init-a4';
  const initB1 = 'rn-g6-init-b1';

  await client.query(
    `INSERT INTO initiatives (id, organization_id, name, status)
     VALUES ($1,$2,$3,'TRACKING')`,
    [initA1, ORG_A, 'Wdrożenie predykcyjnego utrzymania ruchu w fabryce elementów precyzyjnych']
  );
  await client.query(
    `INSERT INTO initiatives (id, organization_id, name, status)
     VALUES ($1,$2,$3,'EXECUTING')`,
    [initA2, ORG_A, 'Cyfryzacja łańcucha dostaw i integracja z dostawcami strategicznymi']
  );
  await client.query(
    `INSERT INTO initiatives (id, organization_id, name, status)
     VALUES ($1,$2,$3,'EXECUTING')`,
    [initA3, ORG_A, 'Automatyzacja procesów zakupowych w dziale zaopatrzenia strategicznego']
  );
  await client.query(
    `INSERT INTO initiatives (id, organization_id, name, status)
     VALUES ($1,$2,$3,'DONE')`,
    [initA4, ORG_A, 'Robotyzacja stanowisk pakowania w zakładzie głównym — projekt zakończony']
  );
  await client.query(
    `INSERT INTO initiatives (id, organization_id, name, status)
     VALUES ($1,$2,$3,'PLANNING')`,
    [initB1, ORG_B, 'Transformacja modelu obsługi klienta korporacyjnego poprzez automatyzację']
  );
  const initB2 = 'rn-g6-init-b2';
  await client.query(
    `INSERT INTO initiatives (id, organization_id, name, status)
     VALUES ($1,$2,$3,'EXECUTING')`,
    [initB2, ORG_B, 'Wdrożenie zunifikowanej platformy raportowania dla klientów doradczych']
  );

  return { initA1, initA2, initA3, initA4, initB1, initB2 };
}

async function seedKpiDomain(
  client: any,
  orgId: string,
  userId: string,
  initiativeId: string,
  depth: 'rich' | 'light'
) {
  const ids: Record<string, string> = {};

  // KPI 1 — active, on-target, currency unit with a LARGE NEGATIVE value
  // (budget variance) alongside a healthy period, to exercise the numeric
  // formatter's negative-currency path per §11.
  const kpi1 = uid(orgId, 'kpi1');
  const v1 = uid(orgId, 'kpi1v1');
  await insertKpiDefinition(client, {
    kpiId: kpi1,
    orgId,
    kpiCode: 'KPI-A-001',
    status: 'active',
    currentVersionId: v1,
    createdBy: userId,
  });
  await insertKpiVersion(client, {
    versionId: v1,
    kpiId: kpi1,
    orgId,
    versionNumber: 1,
    name: 'Odchylenie budżetu utrzymania ruchu względem planu rocznego dla linii precyzyjnej',
    unit: 'PLN',
    targetGeometry: 'threshold_min',
    targetValue: '0',
    warningLow: '-500000',
    criticalLow: '-2000000',
    approvalStatus: 'approved',
    createdBy: userId,
  });
  const m1a = uid(orgId, 'kpi1m1');
  await insertKpiMeasurement(client, {
    measurementId: m1a,
    kpiId: kpi1,
    versionId: v1,
    orgId,
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    actualValue: '-125430.50',
    performanceStatus: 'warning',
    dataQualityStatus: 'verified',
    source: 'finance_export',
    recordedBy: userId,
  });
  const m1b = uid(orgId, 'kpi1m2');
  await insertKpiMeasurement(client, {
    measurementId: m1b,
    kpiId: kpi1,
    versionId: v1,
    orgId,
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    actualValue: '-2450320.75',
    performanceStatus: 'critical',
    dataQualityStatus: 'verified',
    source: 'finance_export',
    recordedBy: userId,
  });
  ids.kpi1 = kpi1;

  // Deviation case triggered by the critical June measurement — status open.
  const dev1 = uid(orgId, 'dev1');
  await client.query(
    `INSERT INTO rvn_kpi_deviation_cases
       (case_id, organization_id, kpi_id, trigger_measurement_id, severity, status,
        owner_user_id, detected_at, response_due_at, root_cause_summary, root_cause_category,
        created_by)
     VALUES ($1,$2,$3,$4,'critical','plan_required',$5, now() - interval '5 days',
             now() + interval '2 days',
             'Nieplanowany przestój przekładni napędowej wymusił awaryjny zakup części od dostawcy zewnętrznego po cenie premium.',
             'unplanned_maintenance', $5)`,
    [dev1, orgId, kpi1, m1b, userId]
  );
  await client.query(
    `INSERT INTO rvn_kpi_corrective_actions
       (action_id, deviation_case_id, organization_id, title, owner_user_id, due_date, status, expected_effect, created_by)
     VALUES ($1,$2,$3,$4,$5, now() + interval '14 days', 'active',
             'Odzyskanie 60% odchylenia do końca Q3 poprzez renegocjację kontraktu serwisowego.', $5)`,
    [uid(orgId, 'act1'), dev1, orgId, 'Renegocjacja kontraktu serwisowego z dostawcą części zamiennych', userId]
  );
  ids.deviationCase1 = dev1;

  // KPI 2 — max counter (very large integer-shaped numeric), verified data.
  const kpi2 = uid(orgId, 'kpi2');
  const v2 = uid(orgId, 'kpi2v1');
  await insertKpiDefinition(client, {
    kpiId: kpi2,
    orgId,
    kpiCode: 'KPI-A-002',
    status: 'active',
    currentVersionId: v2,
    createdBy: userId,
  });
  await insertKpiVersion(client, {
    versionId: v2,
    kpiId: kpi2,
    orgId,
    versionNumber: 1,
    name: 'Łączna liczba przetworzonych zdarzeń czujników IoT na linii montażowej nr 3',
    unit: 'events',
    targetGeometry: 'threshold_max',
    targetValue: '900000000',
    approvalStatus: 'approved',
    createdBy: userId,
  });
  await insertKpiMeasurement(client, {
    measurementId: uid(orgId, 'kpi2m1'),
    kpiId: kpi2,
    versionId: v2,
    orgId,
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    actualValue: '999999999',
    performanceStatus: 'on_target',
    dataQualityStatus: 'verified',
    source: 'iot_gateway',
    recordedBy: userId,
  });
  ids.kpi2 = kpi2;

  if (depth === 'rich') {
    // KPI 3 — draft, no measurements at all (honest "—" / "brak danych" state).
    const kpi3 = uid(orgId, 'kpi3');
    const v3 = uid(orgId, 'kpi3v1');
    await insertKpiDefinition(client, {
      kpiId: kpi3,
      orgId,
      kpiCode: 'KPI-A-003',
      status: 'draft',
      currentVersionId: v3,
      createdBy: userId,
    });
    await insertKpiVersion(client, {
      versionId: v3,
      kpiId: kpi3,
      orgId,
      versionNumber: 1,
      name: 'Wskaźnik retencji kluczowych klientów strategicznych segmentu przemysłowego B2B',
      unit: '%',
      targetGeometry: 'threshold_min',
      targetValue: '92',
      approvalStatus: 'draft',
      createdBy: userId,
    });
    ids.kpi3 = kpi3;

    // KPI 4 — pending_approval.
    const kpi4 = uid(orgId, 'kpi4');
    const v4 = uid(orgId, 'kpi4v1');
    await insertKpiDefinition(client, {
      kpiId: kpi4,
      orgId,
      kpiCode: 'KPI-A-004',
      status: 'pending_approval',
      currentVersionId: v4,
      createdBy: userId,
    });
    await insertKpiVersion(client, {
      versionId: v4,
      kpiId: kpi4,
      orgId,
      versionNumber: 1,
      name: 'Czas realizacji zamówień specjalnych w dziale obsługi klienta korporacyjnego',
      unit: 'days',
      targetGeometry: 'threshold_max',
      targetValue: '5',
      approvalStatus: 'submitted',
      submittedBy: userId,
      createdBy: userId,
    });
    ids.kpi4 = kpi4;

    // KPI 5 — suspended.
    const kpi5 = uid(orgId, 'kpi5');
    const v5 = uid(orgId, 'kpi5v1');
    await insertKpiDefinition(client, {
      kpiId: kpi5,
      orgId,
      kpiCode: 'KPI-A-005',
      status: 'suspended',
      currentVersionId: v5,
      createdBy: userId,
    });
    await insertKpiVersion(client, {
      versionId: v5,
      kpiId: kpi5,
      orgId,
      versionNumber: 1,
      name: 'Wskaźnik wykorzystania mocy produkcyjnych w zakładzie drugorzędnym Wrocław-Południe',
      unit: '%',
      targetGeometry: 'range',
      targetMin: '70',
      targetMax: '90',
      approvalStatus: 'approved',
      createdBy: userId,
    });
    ids.kpi5 = kpi5;

    // KPI 6 — archived, with historical measurement.
    const kpi6 = uid(orgId, 'kpi6');
    const v6 = uid(orgId, 'kpi6v1');
    await insertKpiDefinition(client, {
      kpiId: kpi6,
      orgId,
      kpiCode: 'KPI-A-006',
      status: 'archived',
      currentVersionId: v6,
      createdBy: userId,
    });
    await insertKpiVersion(client, {
      versionId: v6,
      kpiId: kpi6,
      orgId,
      versionNumber: 1,
      name: 'Nieaktualny wskaźnik satysfakcji klienta wewnętrznego sprzed reorganizacji 2024',
      unit: 'pts',
      targetGeometry: 'threshold_min',
      targetValue: '80',
      approvalStatus: 'approved',
      createdBy: userId,
    });
    const m6 = uid(orgId, 'kpi6m1');
    await insertKpiMeasurement(client, {
      measurementId: m6,
      kpiId: kpi6,
      versionId: v6,
      orgId,
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
      actualValue: '74',
      performanceStatus: 'warning',
      dataQualityStatus: 'estimated',
      source: 'legacy_import',
      recordedBy: userId,
    });
    ids.kpi6 = kpi6;

    // Scorecard bundling KPI 1, 2, 5 with one published review snapshot.
    const scorecard1 = uid(orgId, 'sc1');
    await client.query(
      `INSERT INTO rvn_kpi_scorecards
         (scorecard_id, organization_id, name, description, scope_type, owner_user_id, review_frequency, lifecycle_status, created_by)
       VALUES ($1,$2,$3,$4,'organization',$5,'monthly','active',$5)`,
      [
        scorecard1,
        orgId,
        'Karta wyników zarządu — segment przemysłowy Q2/Q3 2026',
        'Zbiorczy przegląd kluczowych wskaźników operacyjnych i finansowych dla segmentu przemysłowego.',
        userId,
      ]
    );
    await client.query(
      `INSERT INTO rvn_kpi_scorecard_items (item_id, scorecard_id, kpi_id, organization_id, role, sort_order, added_by)
       VALUES ($1,$2,$3,$4,'primary',0,$5)`,
      [uid(orgId, 'sci1'), scorecard1, kpi1, orgId, userId]
    );
    await client.query(
      `INSERT INTO rvn_kpi_scorecard_items (item_id, scorecard_id, kpi_id, organization_id, role, sort_order, added_by)
       VALUES ($1,$2,$3,$4,'supporting',1,$5)`,
      [uid(orgId, 'sci2'), scorecard1, kpi2, orgId, userId]
    );
    await client.query(
      `INSERT INTO rvn_kpi_scorecard_items (item_id, scorecard_id, kpi_id, organization_id, role, sort_order, added_by)
       VALUES ($1,$2,$3,$4,'supporting',2,$5)`,
      [uid(orgId, 'sci3'), scorecard1, kpi5, orgId, userId]
    );
    const snap1 = uid(orgId, 'snap1');
    await client.query(
      `INSERT INTO rvn_kpi_scorecard_review_snapshots
         (snapshot_id, scorecard_id, organization_id, review_period_start, review_period_end,
          snapshot_payload, status, published_by, published_at, created_by)
       VALUES ($1,$2,$3,'2026-06-01','2026-06-30', $4::jsonb, 'published', $5, now(), $5)`,
      [snap1, scorecard1, orgId, JSON.stringify({ note: 'seed snapshot' }), userId]
    );
    await client.query(
      `INSERT INTO rvn_kpi_scorecard_review_snapshot_measurements (snapshot_id, measurement_id)
       VALUES ($1,$2)`,
      [snap1, m1b]
    );
    ids.scorecard1 = scorecard1;
  }

  return ids;
}

async function insertKpiDefinition(
  client: any,
  p: {
    kpiId: string;
    orgId: string;
    kpiCode: string;
    status: string;
    currentVersionId: string;
    createdBy: string;
  }
) {
  // Insert the definition first WITHOUT current_definition_version_id (FK
  // would fail — the version doesn't exist yet), then backfill after the
  // version row is written.
  await client.query(
    `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, created_by)
     VALUES ($1,$2,$3,$4,$5)`,
    [p.kpiId, p.orgId, p.kpiCode, p.status, p.createdBy]
  );
}

async function insertKpiVersion(
  client: any,
  p: {
    versionId: string;
    kpiId: string;
    orgId: string;
    versionNumber: number;
    name: string;
    unit: string;
    targetGeometry: string;
    targetValue?: string;
    targetMin?: string;
    targetMax?: string;
    warningLow?: string;
    criticalLow?: string;
    approvalStatus: string;
    submittedBy?: string;
    createdBy: string;
  }
) {
  await client.query(
    `INSERT INTO rvn_kpi_definition_versions
       (definition_version_id, kpi_id, organization_id, version_number, name, unit,
        target_geometry, target_value, target_min, target_max, warning_low, critical_low,
        approval_status, effective_from, submitted_by, submitted_at, approved_by, approved_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
             CASE WHEN $13 = 'approved' THEN now() ELSE NULL END,
             $14::text, CASE WHEN $14::text IS NOT NULL THEN now() ELSE NULL END,
             CASE WHEN $13 = 'approved' THEN $15::text ELSE NULL END,
             CASE WHEN $13 = 'approved' THEN now() ELSE NULL END,
             $15)`,
    [
      p.versionId,
      p.kpiId,
      p.orgId,
      p.versionNumber,
      p.name,
      p.unit,
      p.targetGeometry,
      p.targetValue ?? null,
      p.targetMin ?? null,
      p.targetMax ?? null,
      p.warningLow ?? null,
      p.criticalLow ?? null,
      p.approvalStatus,
      p.submittedBy ?? null,
      p.createdBy,
    ]
  );
  await client.query(
    `UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`,
    [p.versionId, p.kpiId]
  );
}

async function insertKpiMeasurement(
  client: any,
  p: {
    measurementId: string;
    kpiId: string;
    versionId: string;
    orgId: string;
    periodStart: string;
    periodEnd: string;
    actualValue: string;
    performanceStatus: string;
    dataQualityStatus: string;
    source: string;
    recordedBy: string;
  }
) {
  await client.query(
    `INSERT INTO rvn_kpi_measurements
       (measurement_id, kpi_id, definition_version_id, organization_id, period_start, period_end,
        actual_value, performance_status, data_quality_status, source, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      p.measurementId,
      p.kpiId,
      p.versionId,
      p.orgId,
      p.periodStart,
      p.periodEnd,
      p.actualValue,
      p.performanceStatus,
      p.dataQualityStatus,
      p.source,
      p.recordedBy,
    ]
  );
}

async function seedRoiDomain(
  client: any,
  orgId: string,
  userId: string,
  initiativeIds: string[],
  depth: 'rich' | 'light'
) {
  const ids: Record<string, string> = {};
  const [initiativeId, initiativeId2, initiativeId3, initiativeId4] = initiativeIds;

  // Phase 1 — Build Case (status: modeling). Intentionally left WITHOUT a
  // calculation run so the ROI screen must render an honest "nieobliczalne"
  // state, and includes one non-financial benefit line (amount IS NULL) to
  // exercise the same "—" path on benefit lines per §11.
  const case1 = uid(orgId, 'roi1');
  await client.query(
    `INSERT INTO rvn_roi_cases (case_id, organization_id, initiative_id, title, owner_user_id, status, currency, granularity, analysis_start, analysis_end, created_by)
     VALUES ($1,$2,$3,$4,$5,'modeling','PLN','monthly','2026-07-01','2028-06-30',$5)`,
    [case1, orgId, initiativeId, 'Predykcyjne utrzymanie ruchu — budowa uzasadnienia biznesowego', userId]
  );
  await client.query(
    `INSERT INTO rvn_roi_assumptions (assumption_id, case_id, organization_id, category, label, unit, base_value, downside_value, upside_value, confidence, owner_user_id, created_by)
     VALUES ($1,$2,$3,'operational','Redukcja nieplanowanych przestojów linii precyzyjnej','%',35,20,50,'medium',$4,$4)`,
    [uid(orgId, 'roi1-a1'), case1, orgId, userId]
  );
  await client.query(
    `INSERT INTO rvn_roi_cost_lines (cost_line_id, case_id, organization_id, category, label, description, amount, currency, timing_type, one_time_period_date, confidence, owner_user_id, created_by)
     VALUES ($1,$2,$3,'technology','Zakup i wdrożenie platformy czujników IoT oraz licencji analitycznych', 'Sprzęt, integracja z MES, licencje 3-letnie.', 15750000.00,'PLN','one_time','2026-08-01','high',$4,$4)`,
    [uid(orgId, 'roi1-c1'), case1, orgId, userId]
  );
  await client.query(
    `INSERT INTO rvn_roi_cost_lines (cost_line_id, case_id, organization_id, category, label, amount, currency, timing_type, recurrence_start_date, recurrence_cadence, confidence, owner_user_id, created_by)
     VALUES ($1,$2,$3,'operational','Utrzymanie platformy i wsparcie dostawcy', 185000.00,'PLN','recurring','2026-09-01','quarterly','medium',$4,$4)`,
    [uid(orgId, 'roi1-c2'), case1, orgId, userId]
  );
  await client.query(
    `INSERT INTO rvn_roi_benefit_lines (benefit_line_id, case_id, organization_id, category, label, is_financial, amount, currency, timing_type, recurrence_start_date, recurrence_cadence, confidence, owner_user_id, created_by)
     VALUES ($1,$2,$3,'cost_avoidance','Unikniecie strat produkcyjnych z tytułu awarii nieplanowanych', true, 4200000.00,'PLN','recurring','2027-01-01','quarterly','medium',$4,$4)`,
    [uid(orgId, 'roi1-b1'), case1, orgId, userId]
  );
  await client.query(
    `INSERT INTO rvn_roi_benefit_lines (benefit_line_id, case_id, organization_id, category, label, description, is_financial, timing_type, confidence, owner_user_id, created_by)
     VALUES ($1,$2,$3,'strategic','Poprawa reputacji jakościowej u kluczowych klientów OEM', 'Korzyść niefinansowa — brak wiarygodnej metody wyceny na etapie budowy przypadku.', false,'one_time','low',$4,$4)`,
    [uid(orgId, 'roi1-b2'), case1, orgId, userId]
  );
  ids.case1BuildNoCalc = case1;

  // Phase 2 — Decision (status: approved), WITH a completed calculation run
  // and an approval snapshot referencing it.
  const case2 = uid(orgId, 'roi2');
  await client.query(
    `INSERT INTO rvn_roi_cases (case_id, organization_id, initiative_id, title, owner_user_id, status, currency, granularity, analysis_start, analysis_end, submitted_by, submitted_at, approved_by, approved_at, created_by)
     VALUES ($1,$2,$3,$4,$5,'approved','PLN','monthly','2026-04-01','2028-03-31',$5, now() - interval '30 days', $5, now() - interval '20 days', $5)`,
    [case2, orgId, initiativeId2 ?? initiativeId, 'Cyfryzacja łańcucha dostaw — decyzja inwestycyjna zatwierdzona przez zarząd', userId]
  );
  await client.query(
    `INSERT INTO rvn_roi_cost_lines (cost_line_id, case_id, organization_id, category, label, amount, currency, timing_type, one_time_period_date, confidence, owner_user_id, created_by)
     VALUES ($1,$2,$3,'technology','Wdrożenie platformy integracyjnej EDI z dostawcami strategicznymi', 6800000.00,'PLN','one_time','2026-05-01','high',$4,$4)`,
    [uid(orgId, 'roi2-c1'), case2, orgId, userId]
  );
  await client.query(
    `INSERT INTO rvn_roi_benefit_lines (benefit_line_id, case_id, organization_id, category, label, is_financial, amount, currency, timing_type, recurrence_start_date, recurrence_cadence, confidence, owner_user_id, created_by)
     VALUES ($1,$2,$3,'efficiency','Redukcja kosztów magazynowania i nadwyżek zapasów', true, 1950000.00,'PLN','recurring','2026-06-01','quarterly','high',$4,$4)`,
    [uid(orgId, 'roi2-b1'), case2, orgId, userId]
  );
  const run2 = uid(orgId, 'roi2-run1');
  await client.query(
    `INSERT INTO rvn_roi_calculation_runs
       (run_id, case_id, organization_id, engine_version, policy_version_stamp, status, input_snapshot, input_hash,
        total_costs, total_financial_benefits, simple_roi, npv, irr_pct, irr_status, payback_periods,
        discounted_payback_periods, benefit_cost_ratio, period_series, initiated_by)
     VALUES ($1,$2,$3,'seed-1.0','seed-policy-1','completed', $4::jsonb, $5,
             6800000.00, 7800000.00, 0.1471, 612000.00, 18.4, 'computed', 22.3, 24.1, 1.147, $6::jsonb, $7)`,
    [
      run2,
      case2,
      orgId,
      JSON.stringify({ seed: true, costs: 6800000, benefits: 7800000 }),
      'seed-hash-roi2-run1',
      JSON.stringify([{ period: '2026-06', costs: 0, benefits: 162500 }]),
      userId,
    ]
  );
  await client.query(`UPDATE rvn_roi_cases SET decision_calculation_run_id = $1 WHERE case_id = $2`, [run2, case2]);
  const snap2 = uid(orgId, 'roi2-snap1');
  await client.query(
    `INSERT INTO rvn_roi_approval_snapshots (snapshot_id, case_id, organization_id, sequence_number, decision_calculation_run_id, approved_by, content_hash, snapshot_payload)
     VALUES ($1,$2,$3,1,$4,$5,'seed-content-hash-roi2', $6::jsonb)`,
    [snap2, case2, orgId, run2, userId, JSON.stringify({ seed: true })]
  );
  await client.query(
    `UPDATE rvn_roi_cases SET original_approved_snapshot_id = $1, latest_approved_snapshot_id = $1 WHERE case_id = $2`,
    [snap2, case2]
  );
  ids.case2DecisionApproved = case2;

  if (depth === 'rich') {
    // Phase 3 — Realize Value (status: tracking), with actual entries and an
    // OPEN variance (forecast vs actual) so the deviation surface has data.
    const case3 = uid(orgId, 'roi3');
    await client.query(
      `INSERT INTO rvn_roi_cases (case_id, organization_id, initiative_id, title, owner_user_id, status, currency, granularity, analysis_start, analysis_end, approved_by, approved_at, created_by)
       VALUES ($1,$2,$3,$4,$5,'tracking','PLN','monthly','2025-10-01','2027-09-30',$5, now() - interval '200 days', $5)`,
      [case3, orgId, initiativeId3 ?? initiativeId, 'Automatyzacja procesów zakupowych — realizacja wartości w toku', userId]
    );
    const cl3 = uid(orgId, 'roi3-c1');
    await client.query(
      `INSERT INTO rvn_roi_cost_lines (cost_line_id, case_id, organization_id, category, label, amount, currency, timing_type, one_time_period_date, confidence, owner_user_id, created_by)
       VALUES ($1,$2,$3,'technology','Wdrożenie systemu zakupowego P2P', 3100000.00,'PLN','one_time','2025-11-01','high',$4,$4)`,
      [cl3, case3, orgId, userId]
    );
    const bl3 = uid(orgId, 'roi3-b1');
    await client.query(
      `INSERT INTO rvn_roi_benefit_lines (benefit_line_id, case_id, organization_id, category, label, is_financial, amount, currency, timing_type, recurrence_start_date, recurrence_cadence, confidence, owner_user_id, created_by)
       VALUES ($1,$2,$3,'efficiency','Oszczędności z tytułu negocjacji cen zakupowych', true, 980000.00,'PLN','recurring','2026-01-01','quarterly','high',$4,$4)`,
      [bl3, case3, orgId, userId]
    );
    const actSnap3 = uid(orgId, 'roi3-actsnap1');
    await client.query(
      `INSERT INTO rvn_roi_actual_snapshots
         (actual_snapshot_id, case_id, organization_id, sequence_number, as_of_period_end, published_by,
          total_actual_costs, total_actual_financial_benefits, actual_simple_roi, actual_npv,
          periods_with_actual_count, periods_expected_count, coverage_pct, unverified_entry_count,
          disputed_entry_count, entry_ids_included)
       VALUES ($1,$2,$3,1,'2026-06-30',$4, 3100000.00, 612000.00, -0.6753, -2488000.00, 2, 24, 8.3, 0, 0, '[]'::jsonb)`,
      [actSnap3, case3, orgId, userId]
    );
    await client.query(`UPDATE rvn_roi_cases SET current_actual_snapshot_id = $1 WHERE case_id = $2`, [actSnap3, case3]);
    await client.query(
      `INSERT INTO rvn_roi_actual_entries (actual_entry_id, case_id, organization_id, entry_type, cost_line_id, period_start, period_end, amount, currency, data_quality_status, source, recorded_by)
       VALUES ($1,$2,$3,'cost',$4,'2025-11-01','2025-11-30', 3100000.00,'PLN','verified','finance_import',$5)`,
      [uid(orgId, 'roi3-ae1'), case3, orgId, cl3, userId]
    );
    await client.query(
      `INSERT INTO rvn_roi_actual_entries (actual_entry_id, case_id, organization_id, entry_type, benefit_line_id, period_start, period_end, amount, currency, data_quality_status, source, recorded_by)
       VALUES ($1,$2,$3,'benefit',$4,'2026-06-01','2026-06-30', 205000.00,'PLN','estimated','manual_entry',$5)`,
      [uid(orgId, 'roi3-ae2'), case3, orgId, bl3, userId]
    );
    await client.query(
      `INSERT INTO rvn_roi_variances
         (variance_id, case_id, organization_id, comparison_type, metric, reference_actual_snapshot_id,
          baseline_value, comparison_value, variance_amount, variance_pct, status, owner_user_id, created_by)
       VALUES ($1,$2,$3,'forecast_vs_actual','simpleRoi',$4, 0.3162, -0.6753, -0.9915, -313.5, 'open', $5, $5)`,
      [uid(orgId, 'roi3-var1'), case3, orgId, actSnap3, userId]
    );
    ids.case3RealizeTracking = case3;

    // Phase 4 — Learn (status: post_investment_review), with a finalized PIR.
    const case4 = uid(orgId, 'roi4');
    await client.query(
      `INSERT INTO rvn_roi_cases (case_id, organization_id, initiative_id, title, owner_user_id, status, currency, granularity, analysis_start, analysis_end, approved_by, approved_at, created_by)
       VALUES ($1,$2,$3,$4,$5,'post_investment_review','PLN','monthly','2024-01-01','2025-12-31',$5, now() - interval '700 days', $5)`,
      [case4, orgId, initiativeId4 ?? initiativeId, 'Robotyzacja pakowania — przegląd po wdrożeniu (PIR) zamknięty', userId]
    );
    await client.query(
      `INSERT INTO rvn_roi_post_investment_reviews
         (pir_id, case_id, organization_id, sequence_number, status, started_by, review_snapshot_payload,
          review_snapshot_hash, outcome, lessons_learned, recommendation, finalized_by, finalized_at, created_by)
       VALUES ($1,$2,$3,1,'finalized',$4, $5::jsonb, 'seed-hash-roi4-pir1',
               'benefits_partially_realized',
               'Oszczędności materiałowe przekroczyły plan, ale tempo adopcji operatorów było wolniejsze niż zakładano — brakowało budżetu na szkolenia zmianowe.',
               'Przy kolejnych wdrożeniach robotyzacji zarezerwować min. 8% budżetu na change management i szkolenia zmianowe.',
               $4, now() - interval '30 days', $4)`,
      [uid(orgId, 'roi4-pir1'), case4, orgId, userId, JSON.stringify({ seed: true })]
    );
    ids.case4LearnClosed = case4;
  }

  return ids;
}

async function seedOkrDomain(client: any, orgId: string, userId: string, depth: 'rich' | 'light') {
  const ids: Record<string, string> = {};

  const programStatus = depth === 'rich' ? 'active' : 'draft';
  const program = uid(orgId, 'okrprog1');
  await client.query(
    `INSERT INTO okr_vnext_programs (program_id, organization_id, name, status, cycle_model, created_by)
     VALUES ($1,$2,$3,$4,'quarterly',$5)`,
    [program, orgId, 'Program OKR — cykl transformacyjny 2026', programStatus, userId]
  );
  ids.program = program;

  const policy = uid(orgId, 'okrpolicy1');
  await client.query(
    `INSERT INTO okr_vnext_program_policy_versions (policy_version_id, program_id, organization_id, version_number, snapshot, published_by)
     VALUES ($1,$2,$3,1,$4::jsonb,$5)`,
    [policy, program, orgId, JSON.stringify({ seed: true, scoringModel: 'zero_to_one' }), userId]
  );
  await client.query(`UPDATE okr_vnext_programs SET active_policy_version_id = $1 WHERE program_id = $2`, [
    policy,
    program,
  ]);

  if (depth === 'light') {
    // Org B stays program-only (draft, never activated) — an honest
    // "brak danych" tenant to exercise isolation without deep OKR content.
    return ids;
  }

  const cycle = uid(orgId, 'okrcycle1');
  await client.query(
    `INSERT INTO okr_vnext_cycles
       (cycle_id, organization_id, program_id, name, start_date, end_date, draft_open_at, submission_due_at,
        active_start_at, final_update_due_at, review_open_at, reflection_due_at, close_at, status,
        policy_version_id, created_by)
     VALUES ($1,$2,$3,'Q3 2026','2026-07-01','2026-09-30',
             '2026-06-15','2026-07-05','2026-07-08','2026-09-25','2026-09-26','2026-10-03','2026-10-10',
             'active',$4,$5)`,
    [cycle, orgId, program, policy, userId]
  );
  ids.cycle = cycle;

  const occ1 = uid(orgId, 'okrocc1');
  await client.query(
    `INSERT INTO okr_vnext_checkin_occurrences (cadence_occurrence_id, organization_id, cycle_id, window_start, window_end)
     VALUES ($1,$2,$3,'2026-07-15','2026-07-19')`,
    [occ1, orgId, cycle]
  );
  const occ2 = uid(orgId, 'okrocc2');
  await client.query(
    `INSERT INTO okr_vnext_checkin_occurrences (cadence_occurrence_id, organization_id, cycle_id, window_start, window_end)
     VALUES ($1,$2,$3,'2026-07-29','2026-08-02')`,
    [occ2, orgId, cycle]
  );

  const set1 = uid(orgId, 'okrset1');
  await client.query(
    `INSERT INTO okr_vnext_sets
       (set_id, organization_id, program_id, cycle_id, scope_type, scope_id, owner_user_id, title, status,
        submitted_by, submitted_at, approved_by, approved_at, overall_progress, overall_confidence,
        attention_state, created_by)
     VALUES ($1,$2,$3,$4,'team','operations-team',$5,'OKR zespołu operacyjnego — transformacja Q3 2026','active',
             $5, now() - interval '25 days', $5, now() - interval '20 days', 0.58, 'medium', 'watch', $5)`,
    [set1, orgId, program, cycle, userId]
  );
  ids.set1 = set1;

  // Objective 1 — on track, progress within [0,1].
  const obj1 = uid(orgId, 'okrobj1');
  await client.query(
    `INSERT INTO okr_vnext_objectives
       (objective_id, set_id, organization_id, owner_user_id, title, ambition_type, status, progress,
        progress_calc_policy_version_id, confidence, sort_order, created_by, approved_at)
     VALUES ($1,$2,$3,$4,'Skrócić czas przestoju nieplanowanego o połowę w kluczowych liniach produkcyjnych',
             'committed','active',0.62,$5,'medium',0,$4, now() - interval '20 days')`,
    [obj1, set1, orgId, userId, policy]
  );
  const kr1 = uid(orgId, 'okrkr1');
  await client.query(
    `INSERT INTO okr_vnext_key_results
       (key_result_id, objective_id, set_id, organization_id, owner_user_id, title, measurement_type, unit,
        baseline_value, target_value, start_value, current_value, direction, progress,
        progress_calc_policy_version_id, status, created_by)
     VALUES ($1,$2,$3,$4,$5,'Zredukować średni czas przestoju z 48h do 24h miesięcznie','numeric','hours',
             48, 24, 48, 31, 'decrease', 0.71, $6, 'on_track', $5)`,
    [kr1, obj1, set1, orgId, userId, policy]
  );
  // Check-ins: unclamped >1.0 example lives on KR2 below; this one stays sane.
  await client.query(
    `INSERT INTO okr_vnext_checkins
       (checkin_id, organization_id, key_result_id, objective_id, set_id, cadence_occurrence_id,
        previous_value, new_value, calculated_progress, owner_declared_status, note, submitted_by, submitted_at)
     VALUES ($1,$2,$3,$4,$5,$6, 48, 38, 0.42, 'on_track', 'Wdrożono harmonogram predykcyjnych przeglądów — pierwsze efekty widoczne.', $7, now() - interval '18 days')`,
    [uid(orgId, 'okrci1'), orgId, kr1, obj1, set1, occ1, userId]
  );
  await client.query(
    `INSERT INTO okr_vnext_checkins
       (checkin_id, organization_id, key_result_id, objective_id, set_id, cadence_occurrence_id,
        previous_value, new_value, calculated_progress, owner_declared_status, note, submitted_by, submitted_at)
     VALUES ($1,$2,$3,$4,$5,$6, 38, 31, 0.71, 'on_track', 'Trend utrzymany, kolejny przegląd zaplanowany na sierpień.', $7, now() - interval '4 days')`,
    [uid(orgId, 'okrci2'), orgId, kr1, obj1, set1, occ2, userId]
  );

  const kr2 = uid(orgId, 'okrkr2');
  await client.query(
    `INSERT INTO okr_vnext_key_results
       (key_result_id, objective_id, set_id, organization_id, owner_user_id, title, measurement_type, unit,
        baseline_value, target_value, start_value, current_value, direction, progress,
        progress_calc_policy_version_id, status, created_by)
     VALUES ($1,$2,$3,$4,$5,'Wdrożyć system czujników predykcyjnych na min. 12 maszynach krytycznych','numeric','machines',
             0, 12, 0, 16, 'increase', 1.3333, $6, 'achieved', $5)`,
    [kr2, obj1, set1, orgId, userId, policy]
  );

  // Objective 2 — at risk, no key-result check-ins yet (honest "—" state).
  const obj2 = uid(orgId, 'okrobj2');
  await client.query(
    `INSERT INTO okr_vnext_objectives
       (objective_id, set_id, organization_id, owner_user_id, title, ambition_type, status, progress,
        confidence, sort_order, created_by)
     VALUES ($1,$2,$3,$4,'Uruchomić portal samoobsługowy dla dostawców strategicznych','aspirational','at_risk',
             NULL, 'low', 1, $4)`,
    [obj2, set1, orgId, userId]
  );
  const kr3 = uid(orgId, 'okrkr3');
  await client.query(
    `INSERT INTO okr_vnext_key_results
       (key_result_id, objective_id, set_id, organization_id, owner_user_id, title, measurement_type,
        baseline_value, target_value, direction, progress_calc_policy_version_id, status, created_by)
     VALUES ($1,$2,$3,$4,$5,'Onboardować 25 dostawców strategicznych na portalu','numeric', 0, 25, 'increase', $6, 'not_started', $5)`,
    [kr3, obj2, set1, orgId, userId, policy]
  );

  // Alignment: objective 2 contributes to objective 1 (same cycle, required by CHECK).
  await client.query(
    `INSERT INTO okr_vnext_alignments
       (alignment_id, organization_id, source_objective_id, target_objective_id, relation, status,
        source_cycle_id, target_cycle_id, proposed_by, responded_by, responded_at)
     VALUES ($1,$2,$3,$4,'contributes_to','accepted',$5,$5,$6,$6, now() - interval '15 days')`,
    [uid(orgId, 'okralign1'), orgId, obj2, obj1, cycle, userId]
  );

  ids.objective1 = obj1;
  ids.objective2 = obj2;
  ids.keyResult1 = kr1;
  ids.keyResult2 = kr2;
  ids.keyResult3NoCheckins = kr3;

  return ids;
}

async function seedOpenOrgVisibility(
  client: any,
  orgId: string,
  userId: string,
  entries: Array<{ resourceType: string; resourceId: string }>
) {
  const domainForResourceType: Record<string, string> = {
    kpi: 'kpi',
    kpi_scorecard: 'kpi',
    deviation_case: 'kpi',
    roi_case: 'roi',
    okr_set: 'okr',
  };
  const policyIdByDomain = new Map<string, string>();

  for (const { resourceType, resourceId } of entries) {
    const domain = domainForResourceType[resourceType];
    if (!domain) throw new Error(`No visibility domain mapped for resourceType=${resourceType}`);

    let policyId = policyIdByDomain.get(domain);
    if (!policyId) {
      policyId = uid(orgId, `vispolicy-${domain}`);
      await client.query(
        `INSERT INTO rvn_platform_visibility_policies
           (policy_id, organization_id, domain, policy_version, visibility_mode, created_by)
         VALUES ($1,$2,$3,1,'OPEN_ORG',$4)
         ON CONFLICT (policy_id) DO NOTHING`,
        [policyId, orgId, domain, userId]
      );
      policyIdByDomain.set(domain, policyId);
    }

    await client.query(
      `INSERT INTO rvn_platform_resource_visibility
         (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
       VALUES ($1,$2,$3,'OPEN_ORG',$4,$5)
       ON CONFLICT (resource_type, resource_id) DO NOTHING`,
      [resourceType, resourceId, orgId, policyId, userId]
    );
  }
}

function uid(orgId: string, tag: string): string {
  // Deterministic, readable, valid-format UUIDs so docs can reference exact
  // seeded ids across re-runs with --wipe. Not cryptographically derived —
  // just a stable hash-free encoding for local seed data only.
  const base = `${orgId}-${tag}`;
  let h1 = 0,
    h2 = 0;
  for (let i = 0; i < base.length; i++) {
    h1 = (h1 * 31 + base.charCodeAt(i)) >>> 0;
    h2 = (h2 * 131 + base.charCodeAt(i)) >>> 0;
  }
  const hex = (n: number, len: number) => (n >>> 0).toString(16).padStart(len, '0').slice(0, len);
  return `${hex(h1, 8)}-${hex(h2, 4)}-4${hex(h1 ^ h2, 3)}-8${hex(h2 ^ h1, 3)}-${hex(h1, 6)}${hex(h2, 6)}`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
