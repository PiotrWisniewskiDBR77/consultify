#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';

type Mode = 'dry-run' | 'apply' | 'rollback' | 'verify';
type LegacyRow = Record<string, unknown> & {
  id: string;
  organization_id: string;
  project_id: string | null;
  owner_business_id: string | null;
};

type Manifest = {
  generatedAt: string;
  codeSha: string;
  database: string;
  host: string;
  mode: Mode;
  counts: {
    legacyBefore: number;
    canonicalBefore: number;
    missingBefore: number;
    eligible: number;
    skipped: number;
    created: number;
    canonicalAfter: number;
    missingAfter: number;
  };
  createdAggregateIds: string[];
};

const STATUS: Record<string, string> = {
  DRAFT: 'REGISTERED_DRAFT',
  PROPOSED: 'DEFINED',
  PENDING_APPROVAL: 'READY_FOR_DECISION',
  APPROVED: 'APPROVED_BACKLOG',
  IN_EXECUTION: 'IN_EXECUTION',
  EXECUTING: 'IN_EXECUTION',
  REJECTED: 'ARCHIVED',
  CLOSED: 'CLOSED',
};

const args = process.argv.slice(2);
const value = (prefix: string) => args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
const rollbackPath = value('--rollback=');
const explicitManifest = value('--manifest=');
const manifestDir = value('--manifest-dir=') || process.cwd();
const expectedHost = value('--oczekiwany-host=');
const mode: Mode = rollbackPath
  ? 'rollback'
  : args.includes('--apply')
    ? 'apply'
    : args.includes('--verify')
      ? 'verify'
      : 'dry-run';

function target(): { url: string; host: string; database: string } {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('Brak DATABASE_URL.');
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error(`ODMOWA: host ${host} nie jest lokalny.`);
  if (expectedHost !== '127.0.0.1' || host !== '127.0.0.1') {
    throw new Error('ODMOWA: wymagane --oczekiwany-host=127.0.0.1 i DATABASE_URL z hostem 127.0.0.1.');
  }
  if (database !== 'codex1_staging_1009') throw new Error(`ODMOWA: niedozwolona baza ${database}.`);
  if (mode === 'apply' && process.env.MIGRACJA_INICJATYW_APPLY !== 'true') {
    throw new Error('ODMOWA: --apply wymaga MIGRACJA_INICJATYW_APPLY=true.');
  }
  return { url, host, database };
}

async function scalar(client: PoolClient, sql: string): Promise<number> {
  const result = await client.query<{ count: string }>(sql);
  return Number(result.rows[0]?.count || 0);
}

async function codeSha(): Promise<string> {
  const { execFileSync } = await import('node:child_process');
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function reason(row: LegacyRow): string[] {
  return [!row.project_id && 'BRAK_PROJECT_ID', !row.owner_business_id && 'BRAK_OWNER_BUSINESS_ID'].filter(Boolean) as string[];
}

function payload(row: LegacyRow): Record<string, unknown> {
  const title = String(row.title || row.name || row.id);
  const state = STATUS[String(row.status || 'DRAFT').toUpperCase()] || String(row.status || 'REGISTERED_DRAFT');
  return {
    initiativeId: row.id,
    title,
    name: title,
    problem: String(row.problem_statement || row.summary || row.description || title),
    proposedOutcome: row.summary || null,
    lifecycleState: state,
    projectId: row.project_id,
    initiativeOwnerId: row.owner_business_id,
    priority: String(row.priority || 'MEDIUM').toUpperCase(),
    plannedStartDate: row.planned_start_date || row.start_date || null,
    plannedEndDate: row.planned_end_date || row.end_date || null,
    requiredCapacityFte: Number(row.required_capacity_fte || 0),
    source: {
      sourceType: 'legacy_initiatives_migration',
      sourceId: row.id,
      sourceVersion: 1,
      freshness: 'MIGRATED',
      refreshedAt: new Date().toISOString(),
    },
    planning: {
      source: 'LEGACY_INITIATIVES',
      moduleStatus: String(row.status || 'DRAFT'),
      registeredAt: row.created_at || new Date().toISOString(),
      registeredBy: row.created_by || row.owner_business_id,
      conditional: false,
    },
    readiness: 'NOT_EVALUATED',
    conditional: false,
    dependencySnapshot: [],
  };
}

async function main(): Promise<void> {
  const identity = target();
  const pool = new Pool({ connectionString: identity.url, max: 1 });
  const client = await pool.connect();
  try {
    if (mode === 'rollback' || mode === 'verify') {
      const manifestPath = rollbackPath || explicitManifest;
      if (!manifestPath) throw new Error(`${mode} wymaga --manifest=<plik> albo --rollback=<plik>.`);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;
      if (manifest.database !== identity.database || manifest.host !== identity.host) throw new Error('Manifest wskazuje inny cel.');
      const ids = manifest.createdAggregateIds;
      if (mode === 'rollback') {
        await client.query('BEGIN');
        const deleted = ids.length
          ? await client.query(
              `DELETE FROM ie_aggregate_state WHERE aggregate_type='initiative' AND aggregate_id = ANY($1::text[])`,
              [ids]
            )
          : { rowCount: 0 };
        await client.query('COMMIT');
        const canonicalAfter = await scalar(client, `SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type='initiative'`);
        const missingAfter = await scalar(client, `SELECT count(*) FROM initiatives i WHERE NOT EXISTS (SELECT 1 FROM ie_aggregate_state s WHERE s.aggregate_type='initiative' AND s.aggregate_id=i.id)`);
        const receipt: Manifest = {
          ...manifest,
          generatedAt: new Date().toISOString(),
          codeSha: await codeSha(),
          mode: 'rollback',
          counts: { ...manifest.counts, created: 0, canonicalAfter, missingAfter },
        };
        const receiptPath = path.join(path.dirname(manifestPath), `inicjatywy-kanon-rollback-${receipt.generatedAt.replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
        console.log(JSON.stringify({ mode, deleted: deleted.rowCount, manifest: manifestPath, receiptPath }));
      } else {
        const present = ids.length
          ? Number((await client.query<{ count: string }>(`SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type='initiative' AND aggregate_id = ANY($1::text[])`, [ids])).rows[0]?.count || 0)
          : 0;
        const missingNow = await scalar(client, `SELECT count(*) FROM initiatives i WHERE NOT EXISTS (SELECT 1 FROM ie_aggregate_state s WHERE s.aggregate_type='initiative' AND s.aggregate_id=i.id)`);
        const expectedPresent = manifest.mode === 'apply' ? ids.length : 0;
        const ok = present === expectedPresent && missingNow === manifest.counts.missingAfter;
        console.log(JSON.stringify({ mode, ok, present, expectedPresent, missingNow, expectedMissing: manifest.counts.missingAfter, manifest: manifestPath }));
        if (!ok) process.exitCode = 2;
      }
      return;
    }

    const rows = (await client.query<LegacyRow>(`SELECT i.* FROM initiatives i WHERE NOT EXISTS (SELECT 1 FROM ie_aggregate_state s WHERE s.aggregate_type='initiative' AND s.aggregate_id=i.id) ORDER BY i.id`)).rows;
    const eligible = rows.filter((row) => reason(row).length === 0);
    const skipped = rows.filter((row) => reason(row).length > 0);
    const legacyBefore = await scalar(client, 'SELECT count(*) FROM initiatives');
    const canonicalBefore = await scalar(client, `SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type='initiative'`);
    let createdIds: string[] = [];
    if (mode === 'apply') {
      await client.query('BEGIN');
      for (const row of eligible) {
        const result = await client.query(
          `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json,updated_at)
           VALUES($1,'initiative',$2,1,$3::jsonb,COALESCE($4::timestamptz,CURRENT_TIMESTAMP))
           ON CONFLICT (organization_id,aggregate_type,aggregate_id) DO NOTHING
           RETURNING aggregate_id`,
          [row.organization_id, row.id, JSON.stringify(payload(row)), row.updated_at || row.created_at || null]
        );
        if (result.rowCount === 1) createdIds.push(row.id);
      }
      await client.query('COMMIT');
    }
    const canonicalAfter = await scalar(client, `SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type='initiative'`);
    const missingAfter = await scalar(client, `SELECT count(*) FROM initiatives i WHERE NOT EXISTS (SELECT 1 FROM ie_aggregate_state s WHERE s.aggregate_type='initiative' AND s.aggregate_id=i.id)`);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.mkdirSync(manifestDir, { recursive: true });
    const base = `inicjatywy-kanon-${mode}-${stamp}`;
    const manifestPath = path.join(manifestDir, `${base}.json`);
    const decisionPath = path.join(manifestDir, `${base}-do-decyzji-wlasciciela.json`);
    const manifest: Manifest = {
      generatedAt: new Date().toISOString(), codeSha: await codeSha(), database: identity.database, host: identity.host, mode,
      counts: { legacyBefore, canonicalBefore, missingBefore: rows.length, eligible: eligible.length, skipped: skipped.length, created: createdIds.length, canonicalAfter, missingAfter },
      createdAggregateIds: createdIds,
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    fs.writeFileSync(decisionPath, JSON.stringify({ generatedAt: manifest.generatedAt, database: identity.database, count: skipped.length, rows: skipped.map((row) => ({ reasons: reason(row), row })) }, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify({ ...manifest, manifestPath, ownerDecisionManifestPath: decisionPath, examples: eligible.slice(0, 3).map(payload) }));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
