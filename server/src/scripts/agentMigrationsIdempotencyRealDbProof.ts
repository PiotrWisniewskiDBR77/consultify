import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

/** Frozen Agent/T01 release order. Do not infer it from the filesystem. */
const migrationNames = [
  '20260801_res003a_kpi_recovery_card.sql',
  '20260806_v8_agent_template_version_prerequisite.sql',
  '20260807_agent_t01_transformation_case.sql',
  '20260807_v8_agent_adapter_orchestration.sql',
  '20260807_v8_agent_context_grounding.sql',
  '20260807_v8_agent_operator_console.sql',
  '20260807_v8_agent_proposal_governance.sql',
  '20260807_v8_agent_quality_evaluation.sql',
  '20260807_v8_agent_run_identity.sql',
  '20260807_v8_agent_template_governance.sql',
  '20260807_v8_multi_agent_work_manager.sql',
  '20260808_assessment_report_origin_runtime.sql',
  '20260808_t01_portfolio_decision_resolution.sql',
  '20260808_t01_project_team_blueprints.sql',
  '20260808_u04_recovery_experiments.sql',
  '20260808_v8_agent_admin_settings.sql',
  '20260808_v8_agent_canonical_projection_bindings.sql',
  '20260808_v8_agent_resource_governance.sql',
  '20260809_t01_u03_owner_backed_execution.sql',
  '20260809_v8_wave8_agent_runtime_forward.sql',
  '20260810_t01_initiative_lifecycle_gate_decisions.sql',
  '20260810_t01_u02_native_final_outputs.sql',
] as const;

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
if (!adminDatabaseUrl) throw new Error('ADMIN_DATABASE_URL is required');
const databaseName = `agent_rc_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
const adminUrl = new URL(adminDatabaseUrl);
const admin = new Pool({ connectionString: adminUrl.toString() });

function quotedIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function installCanonicalPrerequisites(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE organizations (id TEXT PRIMARY KEY);
    CREATE TABLE users (id TEXT PRIMARY KEY, organization_id TEXT);
    CREATE TABLE projects (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, owner_id TEXT);
    CREATE TABLE initiatives (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, status TEXT, name TEXT);
    CREATE TABLE v8_execution_runs (run_id TEXT PRIMARY KEY, organization_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE ai_playbook_templates (id TEXT PRIMARY KEY);
    CREATE TABLE wave8_agent_runs (
      run_id TEXT PRIMARY KEY, organization_id TEXT, agent_id TEXT, user_id TEXT,
      project_id TEXT, status TEXT, goal TEXT, requested_tools_json TEXT DEFAULT '[]',
      output_json TEXT DEFAULT '{}', schema_valid INTEGER DEFAULT 0, audit_json TEXT DEFAULT '{}',
      schedule_json TEXT, owner_user_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ
    );
    CREATE TABLE wave8_agent_schedules (
      schedule_id TEXT PRIMARY KEY, organization_id TEXT, agent_id TEXT, owner_user_id TEXT,
      cadence TEXT, next_run_at TEXT, scheduler_mode TEXT, status TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE ai_agent_plans (id TEXT PRIMARY KEY, organization_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE wave8_agent_definitions (
      agent_id TEXT PRIMARY KEY, organization_id TEXT, name TEXT, role TEXT, purpose TEXT, persona TEXT,
      allowed_tools_json TEXT, blocked_tools_json TEXT, source_scope_json TEXT, output_schema_json TEXT,
      approval_policy TEXT, cost_class TEXT, risk_level TEXT, editable INTEGER
    );
    CREATE TABLE v8_tool_catalog (
      tool_id TEXT PRIMARY KEY, organization_id TEXT, name TEXT, description TEXT, category TEXT,
      risk_class TEXT, mutation_type TEXT, classification_status TEXT, default_approval_mode TEXT,
      classified_by TEXT, classified_at TIMESTAMPTZ, version TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
    );
    CREATE TABLE v8_consumer_tool_policies (
      policy_id TEXT PRIMARY KEY, organization_id TEXT, project_id TEXT, consumer_class TEXT,
      tool_id TEXT, allowed INTEGER, approval_override TEXT, max_invocations_per_run INTEGER,
      effective_from TIMESTAMPTZ, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
    );
    CREATE TABLE kpi_deviation_cases (id TEXT PRIMARY KEY);
    CREATE TABLE initiative_kpis (id TEXT PRIMARY KEY);
    CREATE TABLE tasks (id TEXT PRIMARY KEY);
    CREATE TABLE kpi_time_series (id TEXT PRIMARY KEY);
    CREATE TABLE report_builder_versions (
      id TEXT PRIMARY KEY, report_id TEXT NOT NULL, version_number INTEGER NOT NULL,
      snapshot_json JSONB DEFAULT '{}'::jsonb
    );
    CREATE TABLE presentation_deck_versions (
      id TEXT PRIMARY KEY, deck_id TEXT NOT NULL, version INTEGER NOT NULL,
      snapshot_json JSONB DEFAULT '{}'::jsonb
    );
    CREATE TABLE v8_artifact_origin_links (
      link_id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      origin_runtime TEXT NOT NULL,
      origin_record_id TEXT NOT NULL,
      is_primary_origin INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT v8_artifact_origin_links_origin_runtime_check CHECK (
        origin_runtime IN (
          'report','presentation','sheet','native_artifact','report_template',
          'presentation_template','sheet_template','document_template'
        )
      )
    );
    INSERT INTO organizations VALUES ('org-proof');
    INSERT INTO users VALUES ('user-proof','org-proof');
    INSERT INTO projects VALUES ('project-proof','org-proof','user-proof');
    INSERT INTO initiatives VALUES ('initiative-proof','org-proof','DRAFT','Proof');
    INSERT INTO v8_execution_runs(run_id,organization_id) VALUES ('run-proof','org-proof');
    INSERT INTO kpi_deviation_cases(id) VALUES ('deviation-proof');
    INSERT INTO initiative_kpis(id) VALUES ('kpi-proof');
    INSERT INTO report_builder_versions(id,report_id,version_number) VALUES ('report-version-proof','report-proof',1);
    INSERT INTO presentation_deck_versions(id,deck_id,version) VALUES ('deck-version-proof','deck-proof',1);
  `);
}

async function applyReleaseSet(pool: Pool, pass: number): Promise<void> {
  for (const name of migrationNames) {
    const sql = fs.readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8');
    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK').catch(() => undefined);
      const pg = error as { code?: string; message?: string; detail?: string };
      throw new Error(
        `AGENT_RC_MIGRATION_FAILED pass=${pass} file=${name} SQLSTATE=${pg.code ?? 'UNKNOWN'} message=${pg.message ?? error}${pg.detail ? ` detail=${pg.detail}` : ''}`
      );
    }
  }
}

async function main(): Promise<void> {
  await admin.query(`CREATE DATABASE ${quotedIdentifier(databaseName)}`);
  const testUrl = new URL(adminUrl.toString());
  testUrl.pathname = `/${databaseName}`;
  const pool = new Pool({ connectionString: testUrl.toString() });
  try {
    await installCanonicalPrerequisites(pool);
    await applyReleaseSet(pool, 1);

    // Sentinel data must survive the second full application.
    await pool.query(
      `INSERT INTO transformation_planning_intakes
       (intake_id,organization_id,conversation_id,initiated_by_user_id,idempotency_key,mandate,measurable_outcomes_json,status,missing_keys_json)
       VALUES ('intake-sentinel','org-proof','conversation-proof','user-proof','sentinel-key','Sentinel','[]'::jsonb,'needs_clarification','["sponsorUserId"]'::jsonb)`
    );
    await applyReleaseSet(pool, 2);

    const sentinel = await pool.query(
      `SELECT mandate,status,missing_keys_json FROM transformation_planning_intakes WHERE intake_id='intake-sentinel'`
    );
    assert.equal(sentinel.rowCount, 1);
    assert.equal(sentinel.rows[0].mandate, 'Sentinel');

    const duplicateConstraints = await pool.query(`
      SELECT conrelid::regclass::text table_name,conname,COUNT(*)::int count
        FROM pg_constraint
       WHERE connamespace='public'::regnamespace
       GROUP BY 1,2 HAVING COUNT(*)>1
    `);
    assert.equal(duplicateConstraints.rowCount, 0);
    await pool.query(
      `INSERT INTO v8_artifact_origin_links
       (link_id,artifact_id,organization_id,origin_runtime,origin_record_id,is_primary_origin)
       VALUES ('assessment-origin-proof','artifact-proof','org-proof','assessment_report','assessment-proof',1)`
    );

    const expectedColumns: Array<[string, string]> = [
      ['transformation_cases', 'execution_run_id'],
      ['transformation_stage_proposals', 'governed_proposal_version_id'],
      ['wave8_agent_runs', 'canonical_run_id'],
      ['wave8_agent_schedules', 'canonical_run_id'],
      ['wave8_agent_schedules', 'lease_owner'],
      ['ai_agent_plans', 'canonical_run_id'],
      ['kpi_recovery_cards', 'experiment_version'],
      ['transformation_final_output_runs', 'native_report_id'],
      ['transformation_final_output_runs', 'native_deck_id'],
    ];
    for (const [table, column] of expectedColumns) {
      const found = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
        [table, column]
      );
      assert.equal(found.rowCount, 1, `missing column ${table}.${column}`);
    }

    const expectedRelations = [
      'v8_agent_run_identities',
      'v8_agent_context_revalidations',
      'v8_agent_proposal_versions',
      'v8_agent_adapter_invocations',
      'v8_agent_resource_reservations',
      'v8_agent_operator_recovery_events',
      'v8_agent_work_graphs',
      'v8_agent_quality_eval_runs',
      'v8_agent_tenant_settings',
      'transformation_portfolio_decision_packs',
      'transformation_project_team_blueprints',
      'kpi_recovery_experiments',
      'transformation_monitoring_definitions',
      'initiative_lifecycle_gate_decisions',
    ];
    for (const relation of expectedRelations) {
      const found = await pool.query(`SELECT to_regclass($1) relation`, [`public.${relation}`]);
      assert.ok(found.rows[0].relation, `missing relation ${relation}`);
    }

    const expectedForeignKeys: Array<[string, string, string]> = [
      [
        'transformation_stage_proposals',
        'governed_proposal_version_id',
        'v8_agent_proposal_versions',
      ],
      [
        'transformation_final_output_governance',
        'governed_proposal_version_id',
        'v8_agent_proposal_versions',
      ],
      [
        'transformation_result_gate_governance',
        'governed_proposal_version_id',
        'v8_agent_proposal_versions',
      ],
      [
        'initiative_lifecycle_gate_decisions',
        'a05_proposal_version_id',
        'v8_agent_proposal_versions',
      ],
      [
        'initiative_lifecycle_gate_decisions',
        'a05_approval_receipt_ref',
        'v8_agent_proposal_scope_reviews',
      ],
    ];
    for (const [table, column, foreignTable] of expectedForeignKeys) {
      const found = await pool.query(
        `SELECT 1
           FROM pg_constraint c
           JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
          WHERE c.contype='f' AND c.conrelid=$1::regclass AND a.attname=$2
            AND c.confrelid=$3::regclass`,
        [table, column, foreignTable]
      );
      assert.equal(found.rowCount, 1, `missing FK ${table}.${column} -> ${foreignTable}`);
    }

    const expectedIndexes = [
      'idx_v8_agent_adapter_run',
      'idx_v8_agent_resource_active',
      'idx_v8_agent_settings_scope',
      'idx_transformation_monitoring_due',
      'idx_initiative_lifecycle_gate_current',
      'report_builder_versions_report_version_uq',
      'presentation_deck_versions_deck_version_uq',
      'idx_transformation_final_output_runs_native_report',
      'idx_transformation_final_output_runs_native_deck',
    ];
    for (const index of expectedIndexes) {
      const found = await pool.query(`SELECT to_regclass($1) relation`, [`public.${index}`]);
      assert.ok(found.rows[0].relation, `missing index ${index}`);
    }

    const tools = await pool.query(
      `SELECT COUNT(*)::int count FROM v8_tool_catalog WHERE organization_id='org-proof' AND name LIKE 'transformation.%'`
    );
    const policies = await pool.query(
      `SELECT COUNT(*)::int count FROM v8_consumer_tool_policies WHERE organization_id='org-proof' AND policy_id LIKE 'a06-t01-policy:%'`
    );
    assert.equal(tools.rows[0].count, 18);
    assert.equal(policies.rows[0].count, 18);

    console.log(
      JSON.stringify({
        proof: 'AGENT_T01_RELEASE_MIGRATIONS_REALDB_GREEN',
        database: databaseName,
        passes: 2,
        migrations: migrationNames.length,
        frozenOrder: [...migrationNames],
        sentinelPreserved: true,
        duplicateConstraints: 0,
        verifiedColumns: expectedColumns.length,
        verifiedRelations: expectedRelations.length,
        verifiedForeignKeys: expectedForeignKeys.length,
        verifiedIndexes: expectedIndexes.length,
        assessmentOriginRuntimeAccepted: true,
        transformationTools: 18,
        transformationPolicies: 18,
      })
    );
  } finally {
    await pool.end();
  }
}

main()
  .finally(async () => {
    await admin
      .query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`,
        [databaseName]
      )
      .catch(() => undefined);
    await admin
      .query(`DROP DATABASE IF EXISTS ${quotedIdentifier(databaseName)}`)
      .catch(() => undefined);
    await admin.end();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
