#!/usr/bin/env npx tsx
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { Client, type PoolClient } from 'pg';

import {
  getDatabaseHost,
  isKnownProductionDatabaseHost,
} from '../server/src/config/databaseTargetResolver.js';
import {
  METALPOL_CLIENT,
  METALPOL_DRD_AREAS,
  METALPOL_IDS,
  METALPOL_SKIP_DECISIONS,
} from './demo-seed/metalpolDrdDataset.js';

const REMOTE_CONFIRMATION = 'I_UNDERSTAND_THIS_IS_A_REMOTE_DATABASE';
const PACK_VERSION = '2.0.0-methodpack.1';
const EVENT_COUNT = METALPOL_DRD_AREAS.length + 1;

export type SeedMode = 'dry-run' | 'apply' | 'purge' | 'verify';

export class SeedTargetError extends Error {
  constructor(
    message: string,
    readonly exitCode: 2 | 3
  ) {
    super(message);
  }
}

export function validateSeedTarget(env: NodeJS.ProcessEnv): string {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new SeedTargetError('odmowa: brak DATABASE_URL', 2);
  const host = getDatabaseHost(databaseUrl);
  if (!host) throw new SeedTargetError('odmowa: nieprawidłowy DATABASE_URL', 2);
  if (isKnownProductionDatabaseHost(host, env)) {
    throw new SeedTargetError('odmowa: host produkcyjny (DEC-2026-08-28-171)', 3);
  }
  if (
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    env.DEMO_SEED_TARGET_CONFIRM !== REMOTE_CONFIRMATION
  ) {
    throw new SeedTargetError('odmowa: zdalny host wymaga jawnego potwierdzenia', 2);
  }
  return databaseUrl;
}

export function parseMode(argv: string[]): SeedMode {
  const modes = argv.filter((arg) => /^--(dry-run|apply|purge|verify)$/.test(arg));
  if (modes.length > 1) throw new SeedTargetError('odmowa: wybierz dokładnie jeden tryb', 2);
  return (modes[0]?.slice(2) as SeedMode | undefined) ?? 'dry-run';
}

const contentHash = crypto
  .createHash('sha256')
  .update(JSON.stringify(METALPOL_DRD_AREAS))
  .digest('hex');

function evidenceFor(area: (typeof METALPOL_DRD_AREAS)[number]) {
  if (area.evidenceClass !== 'evidenced') return [];
  return [
    {
      evidenceId: `demo-metalpol-ev-${area.unitId}-1`,
      evidenceType: 'document',
      strength: 'E2',
      locator: `demo-seed://metalpol-drd/${area.unitId}/1`,
      title: `[demo-seed] materiał źródłowy obszaru ${area.unitId}`,
    },
  ];
}

const TABLE_EXPECTATIONS = Object.freeze({
  organizations: 1,
  users: 1,
  projects: 1,
  method_sessions: 1,
  method_events: EVENT_COUNT,
  method_snapshots: 1,
  method_outputs: 1,
  method_findings: METALPOL_DRD_AREAS.length,
  assessment_skip_reasons: METALPOL_SKIP_DECISIONS.length,
});

async function countRows(client: Client | PoolClient): Promise<Record<string, number>> {
  const filters: Record<string, { sql: string; values: string[] }> = {
    organizations: { sql: 'id = $1', values: [METALPOL_IDS.organization] },
    users: { sql: 'id LIKE $1', values: ['demo-metalpol-user-%'] },
    projects: { sql: 'id LIKE $1', values: ['demo-metalpol-project%'] },
    method_sessions: { sql: 'id LIKE $1', values: ['demo-metalpol-session%'] },
    method_events: { sql: 'id LIKE $1', values: ['demo-metalpol-event-%'] },
    method_snapshots: { sql: 'id LIKE $1', values: ['demo-metalpol-snapshot%'] },
    method_outputs: { sql: 'id LIKE $1', values: ['demo-metalpol-output-%'] },
    method_findings: { sql: 'id LIKE $1', values: ['demo-metalpol-finding-%'] },
    assessment_skip_reasons: {
      sql: "organization_id = $1 AND idempotency_key LIKE 'demo-seed:metalpol:%'",
      values: [METALPOL_IDS.organization],
    },
  };
  const result: Record<string, number> = {};
  for (const [table, filter] of Object.entries(filters)) {
    const query = await client.query(
      `SELECT count(*)::int AS count FROM ${table} WHERE ${filter.sql}`,
      filter.values
    );
    result[table] = query.rows[0].count;
  }
  return result;
}

function printCounts(label: string, counts: Record<string, number>): void {
  console.log(label);
  for (const [table, expected] of Object.entries(TABLE_EXPECTATIONS)) {
    console.log(`${table}: ${counts[table] ?? 0}/${expected}`);
  }
}

async function applySeed(client: Client): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO organizations (id,name,industry)
       VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, industry=EXCLUDED.industry`,
      [METALPOL_IDS.organization, METALPOL_CLIENT.name, METALPOL_CLIENT.industry]
    );
    await client.query(
      // FIX-5 (nadzorca 2026-08-28): first_name/last_name were never seeded,
      // so the DRD cover's "Oceniający" row fell back to the raw e-mail.
      // The columns exist since server/migrations/000_initdb_core_tables.sql;
      // the seed just never filled them.
      `INSERT INTO users (id,organization_id,email,first_name,last_name,role)
       VALUES ($1,$2,$3,$4,$5,'user')
       ON CONFLICT (id) DO UPDATE SET organization_id=EXCLUDED.organization_id,email=EXCLUDED.email,
         first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,role=EXCLUDED.role`,
      [
        METALPOL_IDS.user,
        METALPOL_IDS.organization,
        'anna.kowalczyk@demo-seed.invalid',
        'Anna',
        'Kowalczyk',
      ]
    );
    await client.query(
      `INSERT INTO projects (id,organization_id,name,description)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET organization_id=EXCLUDED.organization_id,name=EXCLUDED.name,description=EXCLUDED.description`,
      [
        METALPOL_IDS.project,
        METALPOL_IDS.organization,
        METALPOL_CLIENT.name,
        `[demo-seed] ${METALPOL_CLIENT.site}; zatrudnienie ${METALPOL_CLIENT.headcount}.`,
      ]
    );
    await client.query(
      `INSERT INTO method_sessions
       (id,organization_id,project_id,module,method_pack_id,method_pack_version,state,mode,owner_user_id)
       VALUES ($1,$2,$3,'assessment','drd',$4,'active','guided_manual',$5)
       ON CONFLICT (id) DO UPDATE SET organization_id=EXCLUDED.organization_id,project_id=EXCLUDED.project_id,
         method_pack_id=EXCLUDED.method_pack_id,method_pack_version=EXCLUDED.method_pack_version,
         state=EXCLUDED.state,mode=EXCLUDED.mode,owner_user_id=EXCLUDED.owner_user_id`,
      [
        METALPOL_IDS.session,
        METALPOL_IDS.organization,
        METALPOL_IDS.project,
        PACK_VERSION,
        METALPOL_IDS.user,
      ]
    );
    for (const [index, area] of METALPOL_DRD_AREAS.entries()) {
      await client.query(
        `INSERT INTO method_events
         (id,organization_id,session_id,type,unit_id,level,actor_kind,actor_user_id,method_pack_version,idempotency_key,payload_json)
         VALUES ($1,$2,$3,'ANSWER_CONFIRMED',$4,$5,'human',$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET level=EXCLUDED.level,payload_json=EXCLUDED.payload_json`,
        [
          `demo-metalpol-event-${String(index + 1).padStart(2, '0')}`,
          METALPOL_IDS.organization,
          METALPOL_IDS.session,
          area.unitId,
          area.currentLevel,
          METALPOL_IDS.user,
          PACK_VERSION,
          `demo-seed:metalpol:event:${area.unitId}`,
          JSON.stringify({
            source: 'demo-seed',
            questionId: `${area.unitId}-L${area.currentLevel}`,
            answerState: 'confirmed',
            currentLevel: area.currentLevel,
            targetLevel: area.targetLevel,
          }),
        ]
      );
    }
    await client.query(
      `INSERT INTO method_events
       (id,organization_id,session_id,type,actor_kind,method_pack_version,idempotency_key,payload_json)
       VALUES ($1,$2,$3,'OUTPUT_CREATED','system',$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET payload_json=EXCLUDED.payload_json`,
      [
        `demo-metalpol-event-${String(EVENT_COUNT).padStart(2, '0')}`,
        METALPOL_IDS.organization,
        METALPOL_IDS.session,
        PACK_VERSION,
        'demo-seed:metalpol:event:output',
        JSON.stringify({ source: 'demo-seed', outputId: METALPOL_IDS.output }),
      ]
    );
    await client.query(
      `INSERT INTO method_snapshots (id,organization_id,session_id,method_pack_version,payload_json,content_hash)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [
        METALPOL_IDS.snapshot,
        METALPOL_IDS.organization,
        METALPOL_IDS.session,
        PACK_VERSION,
        JSON.stringify({ source: 'demo-seed', dataset: 'metalpol-drd' }),
        contentHash,
      ]
    );
    await client.query(
      `INSERT INTO method_outputs
       (id,organization_id,session_id,snapshot_id,module,method_pack_id,method_pack_version,output_version,scope,limitations_json,lineage_json,content_hash)
       VALUES ($1,$2,$3,$4,'assessment','drd',$5,1,'organization',$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET limitations_json=EXCLUDED.limitations_json,lineage_json=EXCLUDED.lineage_json,content_hash=EXCLUDED.content_hash`,
      [
        METALPOL_IDS.output,
        METALPOL_IDS.organization,
        METALPOL_IDS.session,
        METALPOL_IDS.snapshot,
        PACK_VERSION,
        JSON.stringify(['demo-seed: measured values only']),
        JSON.stringify({
          sourceRevisionOfSessionId: null,
          demoSeed: { dataset: 'metalpol-drd', datasetVersion: '1', source: 'demo-seed' },
        }),
        contentHash,
      ]
    );
    for (const area of METALPOL_DRD_AREAS) {
      const gap = area.targetLevel - area.currentLevel;
      await client.query(
        `INSERT INTO method_findings
         (id,organization_id,output_id,unit_id,unit_name,current_level,target_level,gap,
          supporting_evidence_json,business_meaning,root_cause_hypothesis,risk_or_opportunity,
          recommendation,prerequisite,expected_outcome,confidence,priority_rationale,source_locators_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id) DO UPDATE SET unit_name=EXCLUDED.unit_name,current_level=EXCLUDED.current_level,
          target_level=EXCLUDED.target_level,gap=EXCLUDED.gap,supporting_evidence_json=EXCLUDED.supporting_evidence_json,
          business_meaning=EXCLUDED.business_meaning,root_cause_hypothesis=EXCLUDED.root_cause_hypothesis,
          risk_or_opportunity=EXCLUDED.risk_or_opportunity,recommendation=EXCLUDED.recommendation,
          prerequisite=EXCLUDED.prerequisite,expected_outcome=EXCLUDED.expected_outcome,
          confidence=EXCLUDED.confidence,priority_rationale=EXCLUDED.priority_rationale,
          source_locators_json=EXCLUDED.source_locators_json`,
        [
          `demo-metalpol-finding-${area.unitId}`,
          METALPOL_IDS.organization,
          METALPOL_IDS.output,
          area.unitId,
          area.namePL,
          area.currentLevel,
          area.targetLevel,
          gap,
          JSON.stringify(evidenceFor(area)),
          area.businessMeaning,
          area.rootCauseHypothesis,
          area.riskOrOpportunity,
          area.recommendation,
          area.prerequisite,
          area.expectedOutcome,
          area.evidenceClass === 'incomplete'
            ? 'low'
            : area.evidenceClass === 'declared'
              ? 'medium'
              : 'high',
          area.priorityRationale,
          JSON.stringify([`demo-seed://metalpol-drd/${area.unitId}`]),
        ]
      );
    }
    for (const decision of METALPOL_SKIP_DECISIONS) {
      await client.query(
        `INSERT INTO assessment_skip_reasons
         (id,organization_id,session_id,unit_id,question_id,level,skip_code,recorded_by_user_id,idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (organization_id,idempotency_key) DO NOTHING`,
        [
          `demo-metalpol-skip-${decision.unitId}-${decision.level}`,
          METALPOL_IDS.organization,
          METALPOL_IDS.session,
          decision.unitId,
          decision.questionId,
          decision.level,
          decision.skipCode,
          METALPOL_IDS.user,
          `demo-seed:metalpol:${decision.unitId}:${decision.questionId}`,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function purgeSeed(client: Client): Promise<void> {
  const deletes = [
    [
      'assessment_skip_reasons',
      "organization_id=$1 AND idempotency_key LIKE 'demo-seed:metalpol:%'",
      [METALPOL_IDS.organization],
    ],
    ['method_findings', 'id LIKE $1', ['demo-metalpol-finding-%']],
    ['method_outputs', 'id LIKE $1', ['demo-metalpol-output-%']],
    ['method_snapshots', 'id LIKE $1', ['demo-metalpol-snapshot%']],
    ['method_events', 'id LIKE $1', ['demo-metalpol-event-%']],
    ['method_sessions', 'id LIKE $1', ['demo-metalpol-session%']],
    ['projects', 'id LIKE $1', ['demo-metalpol-project%']],
    ['users', 'id LIKE $1', ['demo-metalpol-user-%']],
    ['organizations', 'id = $1', [METALPOL_IDS.organization]],
  ] as const;
  await client.query('BEGIN');
  try {
    for (const [table, where, values] of deletes) {
      const result = await client.query(`DELETE FROM ${table} WHERE ${where}`, [...values]);
      console.log(`${table}: usunięto ${result.rowCount ?? 0}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function run(mode: SeedMode, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const databaseUrl = validateSeedTarget(env);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const before = await countRows(client);
    if (mode === 'dry-run') {
      printCounts('plan (istnieje/oczekiwane):', before);
      console.log('--dry-run: nic nie zapisano.');
      return;
    }
    if (mode === 'apply') await applySeed(client);
    if (mode === 'purge') await purgeSeed(client);
    const after = await countRows(client);
    printCounts(mode === 'verify' ? 'verify:' : `${mode} readback:`, after);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  try {
    await run(parseMode(process.argv.slice(2)));
  } catch (error) {
    if (error instanceof SeedTargetError) {
      console.error(error.message);
      process.exitCode = error.exitCode;
      return;
    }
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main();
