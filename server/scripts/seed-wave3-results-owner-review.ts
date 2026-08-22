#!/usr/bin/env tsx
/** Guarded deterministic Wave 3 Results owner-review fixture. Local disposable PostgreSQL only. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';

const url = process.env.DATABASE_URL ?? '';
const manifestPath = process.env.RESULTS_OWNER_FIXTURE_MANIFEST ?? '';
const password = process.env.RESULTS_OWNER_FIXTURE_PASSWORD ?? '';
const reset = process.argv.includes('--reset');
const FIXTURE_ID = 'W3-RESULTS-OWNER-v1';
const FIXTURE_NAME = 'wave3-results-owner-review-v1';
const ROI_POLICY_KEY = 'AMD-FLOW-ROI-VISIBILITY-002/v1';
const ROI_POLICY_DIGEST = 'sha256:2c49cd371727bd19b7164b950e523c2caa9068874c88a451700d05f0ced67c65';
if (process.env.SEED_WAVE3_RESULTS_OWNER_REVIEW !== 'YES')
  throw new Error('SEED_WAVE3_RESULTS_OWNER_REVIEW=YES is required');
if (!url) throw new Error('DATABASE_URL is required');
const parsed = new URL(url);
const dbName = parsed.pathname.replace(/^\//, '');
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname))
  throw new Error('Loopback PostgreSQL required');
if (!/^consultify_w3_results_owner_[a-z0-9_]+$/.test(dbName))
  throw new Error('Database name must match consultify_w3_results_owner_*');
const adminUrl = new URL(url);
adminUrl.pathname = '/postgres';
async function dropDb() {
  if (!manifestPath || !fs.existsSync(manifestPath))
    throw new Error('Reset requires the existing RESULTS_OWNER_FIXTURE_MANIFEST');
  if ((fs.statSync(manifestPath).mode & 0o777) !== 0o600)
    throw new Error('Reset manifest mode must be 0600');
  const receipt = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (
    receipt.ownershipState !== 'FINAL' ||
    receipt.fixture !== FIXTURE_NAME ||
    receipt.fixtureId !== FIXTURE_ID ||
    receipt.databaseName !== dbName ||
    receipt.marker?.table !== 'wave3_owner_fixture_markers' ||
    receipt.marker?.fixtureId !== FIXTURE_ID ||
    receipt.marker?.ownershipNonce !== receipt.ownershipNonce
  )
    throw new Error('Reset manifest is not the exact FINAL Results ownership receipt');
  const owned = new Client({ connectionString: url });
  await owned.connect();
  try {
    const marker = await owned.query(
      `SELECT database_name FROM public.wave3_owner_fixture_markers
        WHERE fixture_id=$1 AND ownership_nonce=$2`,
      [FIXTURE_ID, receipt.ownershipNonce]
    );
    if (marker.rowCount !== 1 || marker.rows[0]?.database_name !== dbName)
      throw new Error('Reset refused: durable Results ownership marker mismatch');
  } finally {
    await owned.end();
  }
  const c = new Client({ connectionString: adminUrl.toString() });
  await c.connect();
  try {
    await c.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',
      [dbName]
    );
    await c.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    const q = await c.query('SELECT 1 FROM pg_database WHERE datname=$1', [dbName]);
    if (q.rowCount) throw new Error('Results DB remains in catalog');
    process.stdout.write(
      `${JSON.stringify({ fixture: FIXTURE_NAME, reset: true, catalogAbsent: true })}\n`
    );
  } finally {
    await c.end();
  }
}
if (reset) {
  await dropDb();
  process.exit(0);
}
if (!manifestPath || !password)
  throw new Error('RESULTS_OWNER_FIXTURE_MANIFEST and RESULTS_OWNER_FIXTURE_PASSWORD are required');
if (fs.existsSync(manifestPath)) throw new Error('Refusing to overwrite existing manifest');
const F = '2026-08-21T08:00:00.000Z';
const ownershipNonce = crypto.randomBytes(32).toString('hex');
const I = {
  org: 'b0900000-0000-4000-8000-000000000001',
  foreignOrg: 'b0900000-0000-4000-8000-000000000002',
  owner: 'b0910000-0000-4000-8000-000000000001',
  admin: 'b0910000-0000-4000-8000-000000000002',
  member: 'b0910000-0000-4000-8000-000000000003',
  foreign: 'b0910000-0000-4000-8000-000000000004',
  initiative: 'res-owner-initiative',
  kpi: 'b0920000-0000-4000-8000-000000000001',
  kpiVersion: 'b0920000-0000-4000-8000-000000000002',
  m1: 'b0920000-0000-4000-8000-000000000003',
  m2: 'b0920000-0000-4000-8000-000000000004',
  deviation: 'b0920000-0000-4000-8000-000000000005',
  roi: 'b0930000-0000-4000-8000-000000000001',
  baseline: 'b0930000-0000-4000-8000-000000000002',
  actual: 'b0930000-0000-4000-8000-000000000003',
  actualSnap: 'b0930000-0000-4000-8000-000000000004',
  finLink: 'b0930000-0000-4000-8000-000000000005',
  recon: 'b0930000-0000-4000-8000-000000000006',
  pir: 'b0930000-0000-4000-8000-000000000007',
  roiRun: 'b0930000-0000-4000-8000-000000000008',
  approvalSnap: 'b0930000-0000-4000-8000-000000000009',
  program: 'b0940000-0000-4000-8000-000000000001',
  policy: 'b0940000-0000-4000-8000-000000000002',
  cycle: 'b0940000-0000-4000-8000-000000000003',
  set: 'b0940000-0000-4000-8000-000000000004',
  objective: 'b0940000-0000-4000-8000-000000000005',
  kr: 'b0940000-0000-4000-8000-000000000006',
  occurrence: 'b0940000-0000-4000-8000-000000000007',
  checkin: 'b0940000-0000-4000-8000-000000000008',
  review: 'b0940000-0000-4000-8000-000000000009',
  signal: 'b0950000-0000-4000-8000-000000000001',
  execLink: 'b0950000-0000-4000-8000-000000000002',
  receipt: 'b0950000-0000-4000-8000-000000000003',
  evidence: 'b0950000-0000-4000-8000-000000000004',
  project: 'results-owner-project',
  executionCase: 'results-owner-case',
  artifactLink: 'cwlink-results-owner-evidence',
  kpiVisibilityPolicy: 'b0960000-0000-4000-8000-000000000001',
  roiVisibilityPolicy: 'b0960000-0000-4000-8000-000000000002',
  okrVisibilityPolicy: 'b0960000-0000-4000-8000-000000000003',
};
const emails = {
  owner: 'wave3.results.owner.20260821@local.test',
  admin: 'wave3.results.checker.20260821@local.test',
  member: 'wave3.results.member.20260821@local.test',
  foreign: 'wave3.results.foreign.20260821@local.test',
};
const db = new Client({ connectionString: url });
await db.connect();
try {
  const ident = await db.query('SELECT current_database() name');
  if (ident.rows[0]?.name !== dbName) throw new Error('DB identity mismatch');
  const mig = await db.query(
    `SELECT count(*)::int count FROM schema_migrations WHERE status IN ('applied','success')`
  );
  if (Number(mig.rows[0]?.count) < 800) throw new Error('Results DB is not migrated');
  const collision = await db.query('SELECT 1 FROM organizations WHERE id=ANY($1::text[]) LIMIT 1', [
    [I.org, I.foreignOrg],
  ]);
  if (collision.rowCount) {
    throw new Error('Results fixture identities already exist; use --reset on the owned database');
  }
  const hash = await bcrypt.hash(password, 10);
  await db.query('BEGIN');
  await db.query(`CREATE TABLE IF NOT EXISTS public.wave3_owner_fixture_markers(
    fixture_id text PRIMARY KEY,
    ownership_nonce text NOT NULL,
    database_name text NOT NULL
  )`);
  await db.query(
    `INSERT INTO public.wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name)
     VALUES($1,$2,current_database())`,
    [FIXTURE_ID, ownershipNonce]
  );
  await db.query(
    `INSERT INTO organizations(id,name) VALUES($1,'Wave 3 Results Owner'),($2,'Wave 3 Results Foreign')`,
    [I.org, I.foreignOrg]
  );
  for (const [id, org, email, first, role] of [
    [I.owner, I.org, emails.owner, 'Owner', 'ADMIN'],
    [I.admin, I.org, emails.admin, 'Checker', 'ADMIN'],
    [I.member, I.org, emails.member, 'Member', 'USER'],
    [I.foreign, I.foreignOrg, emails.foreign, 'Foreign', 'ADMIN'],
  ])
    await db.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status) VALUES($1,$2,$3,$4,$5,'Reviewer',$6,'active')`,
      [id, org, email, hash, first, role]
    );
  for (const [org, id, role] of [
    [I.org, I.owner, 'OWNER'],
    [I.org, I.admin, 'ADMIN'],
    [I.org, I.member, 'MEMBER'],
    [I.foreignOrg, I.foreign, 'OWNER'],
  ])
    await db.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES(gen_random_uuid()::text,$1,$2,$3,'ACTIVE')`,
      [org, id, role]
    );
  for (const [policyId, domain, mode] of [
    [I.kpiVisibilityPolicy, 'kpi', 'OPEN_ORG'],
    [I.roiVisibilityPolicy, 'roi', 'ROI_GOVERNED'],
    [I.okrVisibilityPolicy, 'okr', 'OPEN_ORG'],
  ])
    await db.query(
      `INSERT INTO rvn_platform_visibility_policies(
         policy_id,organization_id,domain,policy_version,visibility_mode,
         allow_narrowing_only,is_active,effective_from,created_by,created_at)
       VALUES($1,$2,$3,1,$4,true,true,$5,$6,$5)`,
      [policyId, I.org, domain, mode, F, I.admin]
    );
  const roiGovernanceFingerprint = crypto
    .createHash('sha256')
    .update(JSON.stringify([I.org, I.owner, ROI_POLICY_KEY, ROI_POLICY_DIGEST]))
    .digest('hex');
  await db.query(
    `INSERT INTO rvn_roi_visibility_governance(
       organization_id,published_by,published_at,idempotency_key,request_fingerprint)
     VALUES($1,$2,$3,'results-owner-roi-governance-v1',$4)`,
    [I.org, I.owner, F, roiGovernanceFingerprint]
  );
  await db.query(
    `INSERT INTO projects(id,organization_id,name,status,owner_id,created_at)
     VALUES($1,$2,'Results owner execution project','active',$3,$4)`,
    [I.project, I.org, I.owner, F]
  );
  await db.query(
    `INSERT INTO initiatives(id,organization_id,project_id,name,status,owner_business_id)
     VALUES($1,$2,$3,'Program poprawy realizacji','EXECUTING',$4)`,
    [I.initiative, I.org, I.project, I.owner]
  );
  await db.query(
    `INSERT INTO rvn_kpi_definitions(kpi_id,organization_id,kpi_code,status,current_definition_version_id,owner_user_id,created_by,created_at,updated_at) VALUES($1,$2,'DELIVERY_ON_TIME','active',NULL,$3,$3,$4,$4)`,
    [I.kpi, I.org, I.owner, F]
  );
  await db.query(
    `INSERT INTO rvn_kpi_definition_versions(definition_version_id,kpi_id,organization_id,version_number,name,unit,target_geometry,target_value,warning_low,critical_low,approval_status,effective_from,created_by,submitted_by,submitted_at,approved_by,approved_at,created_at,updated_at) VALUES($1,$2,$3,1,'Terminowość dostaw','%','threshold_min',90,85,75,'approved',$4,$5,$5,$4,$6,$4,$4,$4)`,
    [I.kpiVersion, I.kpi, I.org, F, I.owner, I.admin]
  );
  await db.query(
    'UPDATE rvn_kpi_definitions SET current_definition_version_id=$1 WHERE kpi_id=$2',
    [I.kpiVersion, I.kpi]
  );
  await db.query(
    `INSERT INTO rvn_platform_resource_visibility(
       resource_type,resource_id,organization_id,visibility_mode,policy_id,owner_user_id)
     VALUES('kpi',$1,$2,'OPEN_ORG',$3,$4)`,
    [I.kpi, I.org, I.kpiVisibilityPolicy, I.owner]
  );
  for (const [id, start, end, val, status] of [
    [I.m1, '2026-06-01', '2026-06-30', 92, 'on_target'],
    [I.m2, '2026-07-01', '2026-07-31', 78, 'critical'],
  ])
    await db.query(
      `INSERT INTO rvn_kpi_measurements(measurement_id,kpi_id,definition_version_id,organization_id,period_start,period_end,actual_value,performance_status,data_quality_status,source,evidence_refs,notes,recorded_by,recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'verified','execution_receipt',$9,'Monthly operational close',$10,$11)`,
      [
        id,
        I.kpi,
        I.kpiVersion,
        I.org,
        start,
        end,
        val,
        status,
        JSON.stringify([{ receiptId: I.receipt }]),
        I.owner,
        F,
      ]
    );
  await db.query(
    `INSERT INTO rvn_kpi_deviation_cases(case_id,organization_id,kpi_id,trigger_measurement_id,severity,status,owner_user_id,manager_user_id,detected_at,root_cause_summary,root_cause_category,created_by,created_at,updated_at) VALUES($1,$2,$3,$4,'critical','analysis_required',$5,$6,$7,'Supplier lead-time variance','supplier',$5,$7,$7)`,
    [I.deviation, I.org, I.kpi, I.m2, I.owner, I.admin, F]
  );
  await db.query(
    `INSERT INTO rvn_roi_cases(case_id,organization_id,initiative_id,title,owner_user_id,status,currency,analysis_start,analysis_end,created_by,created_at,updated_at) VALUES($1,$2,$3,'ROI automatyzacji planowania',$4,'post_investment_review','PLN','2026-01-01','2026-12-31',$4,$5,$5)`,
    [I.roi, I.org, I.initiative, I.owner, F]
  );
  await db.query(
    `INSERT INTO rvn_platform_resource_visibility(
       resource_type,resource_id,organization_id,visibility_mode,policy_id,owner_user_id)
     VALUES('roi_case',$1,$2,'ROI_GOVERNED',$3,$4)`,
    [I.roi, I.org, I.roiVisibilityPolicy, I.owner]
  );
  await db.query(
    `INSERT INTO rvn_roi_baselines(baseline_id,case_id,organization_id,baseline_period_start,baseline_period_end,current_measured_value,current_measured_unit,current_measured_as_of,source,confidence,owner_user_id,frozen_at,frozen_by,created_by,created_at,updated_at) VALUES($1,$2,$3,'2025-01-01','2025-12-31',100000,'PLN','2025-12-31','approved baseline','high',$4,$5,$4,$4,$5,$5)`,
    [I.baseline, I.roi, I.org, I.owner, F]
  );
  const roiRunPayload = {
    runId: I.roiRun,
    caseId: I.roi,
    status: 'completed',
    totalCosts: 100000,
    totalFinancialBenefits: 200000,
    simpleRoi: 1,
    npv: 85000,
    irrPct: 18,
    irrStatus: 'computed',
    paybackPeriods: 8,
    discountedPaybackPeriods: 9,
    benefitCostRatio: 2,
  };
  await db.query(
    `INSERT INTO rvn_roi_calculation_runs(
       run_id,case_id,organization_id,engine_version,policy_version_stamp,status,input_snapshot,input_hash,
       total_costs,total_financial_benefits,simple_roi,npv,irr_pct,irr_status,payback_periods,
       discounted_payback_periods,benefit_cost_ratio,period_series,initiated_by,started_at,completed_at,created_at)
     VALUES($1,$2,$3,'results-owner-fixture-v1','results-owner-policy-v1','completed',$4,$5,
       100000,200000,1,85000,18,'computed',8,9,2,'[]',$6,$7,$7,$7)`,
    [
      I.roiRun,
      I.roi,
      I.org,
      JSON.stringify({ fixture: FIXTURE_ID, baselineId: I.baseline }),
      crypto.createHash('sha256').update(`${FIXTURE_ID}:${I.roiRun}`).digest('hex'),
      I.owner,
      F,
    ]
  );
  const approvalPayload = {
    case: { caseId: I.roi, organizationId: I.org, status: 'approved' },
    baseline: { baselineId: I.baseline, caseId: I.roi },
    calculationPolicy: { caseId: I.roi, requiredMetrics: ['roi', 'npv', 'irr'] },
    assumptions: [],
    costLines: [],
    benefitLines: [],
    benefitEvidenceLinks: [],
    scenarios: [],
    scenarioOverrides: [],
    decisionCalculationRun: roiRunPayload,
  };
  await db.query(
    `INSERT INTO rvn_roi_approval_snapshots(
       snapshot_id,case_id,organization_id,sequence_number,decision_calculation_run_id,
       approved_by,approved_at,content_hash,snapshot_payload,created_at)
     VALUES($1,$2,$3,1,$4,$5,$6,$7,$8,$6)`,
    [
      I.approvalSnap,
      I.roi,
      I.org,
      I.roiRun,
      I.admin,
      F,
      crypto.createHash('sha256').update(JSON.stringify(approvalPayload)).digest('hex'),
      JSON.stringify(approvalPayload),
    ]
  );
  await db.query(
    `INSERT INTO rvn_roi_actual_entries(actual_entry_id,case_id,organization_id,entry_type,period_start,period_end,amount,currency,data_quality_status,source,evidence_refs,notes,recorded_by,recorded_at,verified_by,verified_at) VALUES($1,$2,$3,'observation','2026-01-01','2026-06-30',125000,'PLN','verified','results_actual','[]','Realized benefit observation',$4,$5,$6,$5)`,
    [I.actual, I.roi, I.org, I.owner, F, I.admin]
  );
  await db.query(
    `INSERT INTO rvn_roi_actual_snapshots(actual_snapshot_id,case_id,organization_id,sequence_number,as_of_period_end,published_by,published_at,total_actual_costs,total_actual_financial_benefits,actual_simple_roi,periods_with_actual_count,periods_expected_count,coverage_pct,unverified_entry_count,disputed_entry_count,entry_ids_included,created_at) VALUES($1,$2,$3,1,'2026-06-30',$4,$5,70000,125000,0.7857,6,6,100,0,0,$6,$5)`,
    [I.actualSnap, I.roi, I.org, I.owner, F, JSON.stringify([I.actual])]
  );
  await db.query(
    `UPDATE rvn_roi_cases
        SET original_approved_snapshot_id=$1,
            latest_approved_snapshot_id=$1,
            decision_calculation_run_id=$2,
            current_actual_snapshot_id=$3,
            approved_by=$4,
            approved_at=$5
      WHERE case_id=$6 AND organization_id=$7`,
    [I.approvalSnap, I.roiRun, I.actualSnap, I.admin, F, I.roi, I.org]
  );
  await db.query(
    `INSERT INTO rvn_roi_finance_links(link_id,case_id,organization_id,finance_artifact_type,finance_artifact_id,finance_version_id,mapping_version,source,as_of,semantic_unit,currency,link_purpose,linked_by,linked_at,created_by,created_at,updated_at) VALUES($1,$2,$3,'business_version','finance-bv-owner-001','finance-wr-owner-001',1,'approved_finance_snapshot',$4,'benefit','PLN','reconciliation',$5,$4,$5,$4,$4)`,
    [I.finLink, I.roi, I.org, F, I.admin]
  );
  await db.query(
    `INSERT INTO rvn_roi_finance_reconciliations(reconciliation_id,case_id,organization_id,finance_link_id,roi_value,finance_value,divergence_reason,status,opened_by,opened_at,resolved_by,resolved_at,resolution_notes) VALUES($1,$2,$3,$4,125000,110000,'Timing difference','accepted_divergence',$5,$6,$5,$6,'Finance differs by timing; Results Actual preserved')`,
    [I.recon, I.roi, I.org, I.finLink, I.admin, F]
  );
  await db.query(
    `INSERT INTO rvn_roi_post_investment_reviews(pir_id,case_id,organization_id,sequence_number,status,started_by,started_at,review_snapshot_payload,review_snapshot_hash,outcome,lessons_learned,recommendation,finalized_by,finalized_at,created_by,created_at,updated_at) VALUES($1,$2,$3,1,'finalized',$4,$5,$6,'sha256:results-owner-pir','benefits_partially_realized','Adoption cadence determines value realization','Continue with monthly variance reviews',$7,$5,$4,$5,$5)`,
    [
      I.pir,
      I.roi,
      I.org,
      I.owner,
      F,
      JSON.stringify({ actualSnapshotId: I.actualSnap, reconciliationId: I.recon }),
      I.admin,
    ]
  );
  await db.query(
    `INSERT INTO okr_vnext_programs(program_id,organization_id,name,status,approval_required,manager_review_required,active_policy_version_id,created_by,created_at,updated_at) VALUES($1,$2,'Results 2026','active',true,true,NULL,$3,$4,$4)`,
    [I.program, I.org, I.owner, F]
  );
  await db.query(
    `INSERT INTO okr_vnext_program_policy_versions(policy_version_id,program_id,organization_id,version_number,snapshot,published_by,published_at) VALUES($1,$2,$3,1,'{"scoringModel":"zero_to_one"}',$4,$5)`,
    [I.policy, I.program, I.org, I.admin, F]
  );
  await db.query('UPDATE okr_vnext_programs SET active_policy_version_id=$1 WHERE program_id=$2', [
    I.policy,
    I.program,
  ]);
  await db.query(
    `INSERT INTO okr_vnext_cycles(cycle_id,organization_id,program_id,name,start_date,end_date,draft_open_at,submission_due_at,approval_due_at,active_start_at,midcycle_review_at,final_update_due_at,review_open_at,reflection_due_at,manager_review_due_at,close_at,status,policy_version_id,created_by,created_at,updated_at) VALUES($1,$2,$3,'Q3 2026','2026-07-01','2026-09-30',$4,$4,$4,$4,$4,$4,$4,$4,$4,$4,'review',$5,$6,$4,$4)`,
    [I.cycle, I.org, I.program, F, I.policy, I.owner]
  );
  await db.query(
    `INSERT INTO okr_vnext_sets(set_id,organization_id,program_id,cycle_id,scope_type,scope_id,owner_user_id,reviewer_user_id,title,status,current_version,approved_version,overall_progress,overall_confidence,attention_state,last_checkin_at,created_by,created_at,updated_at) VALUES($1,$2,$3,$4,'company',$2,$5,$6,'Company Results Q3','review',1,1,0.72,'medium','watch',$7,$5,$7,$7)`,
    [I.set, I.org, I.program, I.cycle, I.owner, I.admin, F]
  );
  await db.query(
    `INSERT INTO rvn_platform_resource_visibility(
       resource_type,resource_id,organization_id,visibility_mode,policy_id,owner_user_id)
     VALUES('okr_set',$1,$2,'OPEN_ORG',$3,$4)`,
    [I.set, I.org, I.okrVisibilityPolicy, I.owner]
  );
  await db.query(
    `INSERT INTO okr_vnext_objectives(objective_id,set_id,organization_id,owner_user_id,title,description,ambition_type,status,progress,progress_calc_policy_version_id,progress_calc_reason,confidence,confidence_calc_policy_version_id,confidence_calc_reason,created_by,created_at,updated_at) VALUES($1,$2,$3,$4,'Improve delivery predictability','Customer-facing operational outcome','committed','active',0.72,$5,'weighted KR rollup','medium',$5,'lowest KR',$4,$6,$6)`,
    [I.objective, I.set, I.org, I.owner, I.policy, F]
  );
  await db.query(
    `INSERT INTO okr_vnext_key_results(key_result_id,objective_id,set_id,organization_id,owner_user_id,title,measurement_type,unit,baseline_value,target_value,start_value,current_value,direction,progress,progress_calc_policy_version_id,progress_calc_reason,confidence,status,source_type,source_reference,created_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'Increase on-time delivery','percentage','%',70,90,70,84,'increase',0.70,$6,'(84-70)/(90-70)','medium','at_risk','manual',$7,$5,$8,$8)`,
    [I.kr, I.objective, I.set, I.org, I.owner, I.policy, I.kpi, F]
  );
  await db.query(
    `INSERT INTO okr_vnext_checkin_occurrences(cadence_occurrence_id,organization_id,cycle_id,window_start,window_end,generated_at,generated_by) VALUES($1,$2,$3,'2026-08-01','2026-08-14',$4,'fixture')`,
    [I.occurrence, I.org, I.cycle, F]
  );
  await db.query(
    `INSERT INTO okr_vnext_checkins(checkin_id,organization_id,key_result_id,objective_id,set_id,cadence_occurrence_id,previous_value,new_value,calculated_progress,owner_declared_status,system_suggested_status,confidence,note,blocker,evidence_refs,submitted_by,submitted_at) VALUES($1,$2,$3,$4,$5,$6,80,84,0.70,'at_risk','at_risk','medium','Supplier recovery started','Lead time', $7,$8,$9)`,
    [
      I.checkin,
      I.org,
      I.kr,
      I.objective,
      I.set,
      I.occurrence,
      JSON.stringify([{ kpiId: I.kpi }]),
      I.owner,
      F,
    ]
  );
  await db.query(
    `INSERT INTO okr_vnext_reviews(review_id,set_id,organization_id,review_type,reviewer_user_id,status,outcome,comments,reviewed_set_version,submitted_by,submitted_at,decided_by,decided_at,created_by,created_at,updated_at) VALUES($1,$2,$3,'manager',$4,'approved','Continue with recovery plan',$5,1,$6,$7,$4,$7,$6,$7,$7)`,
    [
      I.review,
      I.set,
      I.org,
      I.admin,
      JSON.stringify([{ level: 'key_result', targetId: I.kr, text: 'Maintain weekly review' }]),
      I.owner,
      F,
    ]
  );
  await db.query(
    `INSERT INTO case_core(
       case_id,project_id,organization_id,case_profile,governance_tier,
       contracted_closure_type,created_by_actor_id,created_at,updated_at,case_name
     ) VALUES($1,$2,$3,'MONITORING','CONTROLLED','OUTCOME_VALIDATED',$4,$5,$5,
       'Results owner execution case')`,
    [I.executionCase, I.project, I.org, I.owner, F]
  );
  await db.query(
    `INSERT INTO case_workspace_artifact_links(
       link_id,organization_id,project_id,case_id,artifact_type,artifact_id,
       artifact_revision,revision_pin_history,relation,linked_by_actor_id,
       linked_at,dedupe_key,created_at,updated_at
     ) VALUES($1,$2,$3,$4,'kpi_measurement',$5,'v1',$6,'OUTCOME_MEASUREMENT',$7,$8,$9,$8,$8)`,
    [
      I.artifactLink,
      I.org,
      I.project,
      I.executionCase,
      I.m2,
      JSON.stringify([{ revision: 'v1', pinnedAt: F, pinnedByActorId: I.owner }]),
      I.owner,
      F,
      'results-owner-artifact-link',
    ]
  );
  await db.query(
    `INSERT INTO execution_case_links(
       link_id,organization_id,initiative_id,case_id,project_id,
       intake_idempotency_key,status,created_by,created_at,updated_at
     ) VALUES($1,$2,$3,$4,$5,'results-owner-intake','ACTIVE',$6,$7,$7)`,
    [I.execLink, I.org, I.initiative, I.executionCase, I.project, I.owner, F]
  );
  await db.query(
    `INSERT INTO execution_delivery_evidence(
       evidence_id,organization_id,execution_link_id,artifact_link_id,
       artifact_revision,content_digest,approval_status,submitted_by,
       approved_by,approved_at,idempotency_key,created_at,updated_at
     ) VALUES($1,$2,$3,$4,'v1','sha256:results-owner-kpi-measurement',
       'APPROVED',$5,$6,$7,'results-owner-delivery-evidence',$7,$7)`,
    [I.evidence, I.org, I.execLink, I.artifactLink, I.owner, I.admin, F]
  );
  await db.query(
    `INSERT INTO execution_results_signal_outbox(
       signal_id,organization_id,execution_link_id,initiative_id,case_id,evidence_id,
       signal_type,payload_version,payload_json,delivery_status,idempotency_key,
       created_at,delivered_at
     ) VALUES($1,$2,$3,$4,$5,$6,'EXECUTION_DELIVERY_APPROVED',1,$7,
       'DELIVERED','results-owner-signal',$8,$8)`,
    [
      I.signal,
      I.org,
      I.execLink,
      I.initiative,
      I.executionCase,
      I.evidence,
      JSON.stringify({ metric: 'DELIVERY_ON_TIME', value: 78 }),
      F,
    ]
  );
  await db.query(
    `INSERT INTO rvn_execution_signal_receipts(
       receipt_id,organization_id,source_signal_id,source_execution_link_id,
       source_initiative_id,source_case_id,signal_type,payload_version,
       observation_payload,observed_at
     ) VALUES($1,$2,$3,$4,$5,$6,'EXECUTION_DELIVERY_APPROVED',1,$7,$8)`,
    [
      I.receipt,
      I.org,
      I.signal,
      I.execLink,
      I.initiative,
      I.executionCase,
      JSON.stringify({ metric: 'DELIVERY_ON_TIME', value: 78, kpiId: I.kpi }),
      F,
    ]
  );
  await db.query('COMMIT');
  const rb = await db.query(
    `SELECT
       (SELECT count(*)::int FROM rvn_kpi_measurements WHERE kpi_id=$1) kpi_points,
       (SELECT count(*)::int FROM rvn_kpi_deviation_cases WHERE kpi_id=$1) deviations,
       (SELECT count(*)::int FROM rvn_execution_signal_receipts WHERE receipt_id=$2) receipts,
       (SELECT count(*)::int FROM rvn_roi_actual_entries WHERE case_id=$3) actuals,
       (SELECT count(*)::int FROM rvn_roi_finance_reconciliations WHERE case_id=$3) reconciliations,
       (SELECT count(*)::int FROM rvn_roi_post_investment_reviews WHERE case_id=$3) pirs,
       (SELECT count(*)::int FROM rvn_roi_approval_snapshots
         WHERE snapshot_id=$8 AND case_id=$3
           AND (snapshot_payload->'decisionCalculationRun'->>'totalFinancialBenefits')::numeric=200000) approval_snapshots,
       (SELECT count(*)::int FROM rvn_roi_cases
         WHERE case_id=$3 AND latest_approved_snapshot_id=$8
           AND current_actual_snapshot_id=$9 AND decision_calculation_run_id=$10) roi_pointers,
       (SELECT count(*)::int FROM okr_vnext_key_results WHERE set_id=$4) key_results,
       (SELECT count(*)::int FROM okr_vnext_checkins WHERE set_id=$4) checkins,
       (SELECT count(*)::int FROM okr_vnext_reviews WHERE set_id=$4) reviews,
       (SELECT count(*)::int FROM rvn_platform_resource_visibility
         WHERE organization_id=$5 AND resource_id=ANY($6::text[])) visibility_rows,
       (SELECT count(*)::int FROM rvn_roi_visibility_governance
         WHERE organization_id=$5 AND published_by=$7) roi_governance,
       (SELECT count(*)::int
          FROM rvn_execution_signal_receipts r
          JOIN execution_results_signal_outbox s ON s.signal_id=r.source_signal_id
          JOIN execution_case_links l ON l.link_id=r.source_execution_link_id
          JOIN initiatives i ON i.id=r.source_initiative_id
          JOIN case_core c ON c.case_id=r.source_case_id
         WHERE r.receipt_id=$2
           AND s.execution_link_id=l.link_id
           AND s.initiative_id=i.id
           AND s.case_id=c.case_id
           AND l.initiative_id=i.id
           AND l.case_id=c.case_id) execution_graph,
       (SELECT count(*)::int
          FROM rvn_execution_signal_receipts r
          LEFT JOIN execution_results_signal_outbox s ON s.signal_id=r.source_signal_id
          LEFT JOIN execution_case_links l ON l.link_id=r.source_execution_link_id
          LEFT JOIN initiatives i ON i.id=r.source_initiative_id
          LEFT JOIN case_core c ON c.case_id=r.source_case_id
         WHERE r.receipt_id=$2
           AND (s.signal_id IS NULL OR l.link_id IS NULL OR i.id IS NULL OR c.case_id IS NULL)) execution_orphans`,
    [
      I.kpi,
      I.receipt,
      I.roi,
      I.set,
      I.org,
      [I.kpi, I.roi, I.set],
      I.owner,
      I.approvalSnap,
      I.actualSnap,
      I.roiRun,
    ]
  );
  const expected = {
    kpi_points: 2,
    deviations: 1,
    receipts: 1,
    actuals: 1,
    reconciliations: 1,
    pirs: 1,
    approval_snapshots: 1,
    roi_pointers: 1,
    key_results: 1,
    checkins: 1,
    reviews: 1,
    visibility_rows: 3,
    roi_governance: 1,
    execution_graph: 1,
    execution_orphans: 0,
  };
  for (const [k, v] of Object.entries(expected))
    if (Number(rb.rows[0]?.[k]) !== v) throw new Error(`Readback failed: ${k}`);
  const manifest = {
    schemaVersion: 1,
    fixture: FIXTURE_NAME,
    fixtureId: FIXTURE_ID,
    ownershipState: 'FINAL',
    ownershipNonce,
    marker: {
      table: 'wave3_owner_fixture_markers',
      fixtureId: FIXTURE_ID,
      ownershipNonce,
    },
    fixtureState: 'SEEDED_AND_READBACK_VERIFIED',
    ownerReviewReady: false,
    generatedAt: F,
    databaseName: dbName,
    deepLinkVerified: false,
    route: '/results?ff_wave3ResultsOwnerReview=1',
    flags: {
      resultsVNext: 'REQUIRED_RUNTIME_CONFIRMATION',
      legacyWriter: 'DISABLED',
      mobile: 'DEFERRED_NON_GATING',
    },
    personas: {
      owner: { email: emails.owner, role: 'OWNER' },
      checker: { email: emails.admin, role: 'ADMIN' },
      memberDenied: { email: emails.member, role: 'MEMBER' },
      foreignDenied: { email: emails.foreign, organizationId: I.foreignOrg },
      credentialsIncluded: false,
    },
    slices: {
      kpi: {
        id: I.kpi,
        trendPoints: 2,
        deviationCaseId: I.deviation,
        executionReceiptId: I.receipt,
      },
      roi: {
        id: I.roi,
        actualEntryId: I.actual,
        actualSnapshotId: I.actualSnap,
        financeReconciliationId: I.recon,
        pirId: I.pir,
        actualOwnership: 'RESULTS_IMMUTABLE',
      },
      okr: {
        programId: I.program,
        cycleId: I.cycle,
        setId: I.set,
        objectiveId: I.objective,
        keyResultId: I.kr,
        checkinId: I.checkin,
        reviewId: I.review,
      },
    },
    boundaries: {
      memberAndForeignSeeded: true,
      deniedRequestsExecuted: false,
      canonicalJourneyExecuted: false,
    },
    canonicalReadSurface: {
      kpi: '/api/vnext/results/kpi',
      roi: '/api/vnext/results/roi/cases',
      okr: '/api/vnext/results/okr/company',
      expectedRowsEach: 1,
      visibilityPolicy: 'EXPLICIT_AND_READBACK_VERIFIED',
    },
    readback: expected,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
  if ((fs.statSync(manifestPath).mode & 0o777) !== 0o600)
    throw new Error('Manifest mode is not 0600');
  process.stdout.write(
    `${JSON.stringify({ fixture: manifest.fixture, seeded: true, readback: expected, manifestPath })}\n`
  );
} catch (e) {
  await db.query('ROLLBACK').catch(() => undefined);
  throw e;
} finally {
  await db.end();
}
