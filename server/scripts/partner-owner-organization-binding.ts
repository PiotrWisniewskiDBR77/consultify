#!/usr/bin/env tsx
/**
 * Explicit historical Partner -> Consultify tenant binding.
 *
 * Dry-run is the default. APPLY and ROLLBACK both consume a signed manifest;
 * neither mode infers ownership from users, e-mail domains, names or activity.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const MANIFEST_SCHEMA_VERSION = 1;
export const SIGNATURE_ALGORITHM = 'HMAC-SHA256';
export const SIGNING_KEY_ENV = 'PARTNER_OWNER_BINDING_HMAC_KEY';
export const SIGNING_KEY_ID_ENV = 'PARTNER_OWNER_BINDING_HMAC_KEY_ID';

export type BindingOperation = 'APPLY' | 'ROLLBACK';
export interface OwnerBindingMapping {
  partnerOrganizationId: string;
  ownerOrganizationId: string;
}
export interface OwnerBindingManifest {
  schemaVersion: 1;
  runId: string;
  operation: BindingOperation;
  applyRunId?: string;
  actorUserId: string;
  issuedAt: string;
  expiresAt: string;
  mappings: OwnerBindingMapping[];
  signature: { algorithm: 'HMAC-SHA256'; keyId: string; value: string };
}
export interface BindingRunResult {
  runId: string;
  operation: BindingOperation;
  inputSha256: string;
  resultSha256: string;
  mappingCount: number;
  replay: boolean;
  dryRun: boolean;
  mappings: OwnerBindingMapping[];
  connectionParity: {
    legacyConnectedUsers: number;
    strictEligibleUsers: number;
    strictConnectedUsers: number;
    exceptions: ConnectionParityException[];
  };
}

type Queryable = Pick<pg.PoolClient, 'query'> | Pick<pg.Pool, 'query'>;

export interface ConnectionParityException {
  partnerOrganizationId: string;
  ownerOrganizationId: string;
  userId: string;
  reason: 'ACTIVE_OWNER_MEMBERSHIP_MISSING' | 'COLLEAGUE_INHERITED';
}

export interface ConnectionParity {
  legacyConnectedUsers: number;
  strictEligibleUsers: number;
  strictConnectedUsers: number;
  exceptions: ConnectionParityException[];
}

/**
 * Mapping-scoped cut-over control for DEC-2026-08-25-64.
 *
 * `legacyConnectedUsers` is the non-mutating projection of users that the
 * legacy resolver (`server/src/services/partnerOrgResolution.ts:11-98`,
 * `getActivePartnerOrgIdForUser`) can resolve, across all three of its
 * branches:
 *   1. an active `partner_users` link (direct);
 *   2. the `partner_organizations.created_by` fallback;
 *   3. "colleague inheritance" (`partnerOrgResolution.ts:44-79`): a user with
 *      NEITHER of the above, but who shares an ACTIVE/ACCEPTED membership in
 *      the mapped owner tenant with another user who has a direct link — the
 *      legacy resolver self-heals a `partner_users` row for them at read
 *      time and silently connects them.
 *
 * `strictEligibleUsers` additionally requires an ACTIVE membership in the
 * explicitly mapped owner tenant — but colleague-inherited users are never
 * eligible here. They are counted (so they never silently disappear from the
 * parity comparison) and always surface as a `COLLEAGUE_INHERITED` exception,
 * deferred to an explicit cut-over decision rather than auto-connected.
 * After APPLY, `strictConnectedUsers` also requires the persisted exact
 * tenant binding.
 */
export async function readConnectionParity(
  queryable: Queryable,
  mappings: OwnerBindingMapping[]
): Promise<ConnectionParity> {
  const partnerIds = mappings.map((mapping) => mapping.partnerOrganizationId);
  const ownerIds = mappings.map((mapping) => mapping.ownerOrganizationId);
  const result = await queryable.query<{
    legacy_connected_users: number;
    strict_eligible_users: number;
    strict_connected_users: number;
    exceptions: ConnectionParityException[];
  }>(
    `WITH mappings AS (
       SELECT * FROM unnest($1::uuid[], $2::text[]) AS m(partner_id, owner_id)
     ), direct_users AS (
       SELECT DISTINCT m.partner_id,m.owner_id,pu.user_id::text AS user_id
         FROM mappings m
         JOIN partner_organizations po ON po.id=m.partner_id
         JOIN partner_users pu ON pu.partner_org_id=po.id
        WHERE lower(coalesce(po.status,'active'))='active'
          AND lower(coalesce(pu.status,'active'))='active'
     ), created_by_users AS (
       SELECT DISTINCT m.partner_id,m.owner_id,po.created_by::text AS user_id
         FROM mappings m
         JOIN partner_organizations po ON po.id=m.partner_id
        WHERE lower(coalesce(po.status,'active'))='active'
          AND po.created_by IS NOT NULL
     ), colleague_users AS (
       -- Reproduces partnerOrgResolution.ts:44-58: a user with no direct
       -- partner_users row who shares an ACTIVE/ACCEPTED membership in the
       -- mapped owner tenant with someone who does have a direct link.
       SELECT DISTINCT m.partner_id,m.owner_id,candidate_member.user_id::text AS user_id
         FROM mappings m
         JOIN partner_organizations po ON po.id=m.partner_id
         JOIN partner_users pu ON pu.partner_org_id=po.id
          AND lower(coalesce(pu.status,'active'))='active'
         JOIN organization_members owner_member
           ON owner_member.user_id=pu.user_id::text
          AND owner_member.organization_id=m.owner_id
          AND upper(coalesce(owner_member.status,'ACTIVE')) IN ('ACTIVE','ACCEPTED')
         JOIN organization_members candidate_member
           ON candidate_member.organization_id=owner_member.organization_id
          AND upper(coalesce(candidate_member.status,'ACTIVE')) IN ('ACTIVE','ACCEPTED')
          AND candidate_member.user_id<>owner_member.user_id
        WHERE lower(coalesce(po.status,'active'))='active'
          AND NOT EXISTS (
            SELECT 1 FROM partner_users pu2
             WHERE pu2.partner_org_id=po.id
               AND pu2.user_id::text=candidate_member.user_id
               AND lower(coalesce(pu2.status,'active'))='active'
          )
          AND candidate_member.user_id<>coalesce(po.created_by::text,'')
     ), legacy_users AS (
       SELECT * FROM direct_users
       UNION
       SELECT * FROM created_by_users
       UNION
       SELECT * FROM colleague_users
     ), eligible AS (
       SELECT DISTINCT lu.partner_id,lu.owner_id,lu.user_id
         FROM legacy_users lu
         JOIN organization_members om
           ON om.organization_id=lu.owner_id AND om.user_id::text=lu.user_id
        WHERE upper(coalesce(om.status,'ACTIVE'))='ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM colleague_users cu
             WHERE cu.partner_id=lu.partner_id
               AND cu.owner_id=lu.owner_id
               AND cu.user_id=lu.user_id
          )
     ), strict_connected AS (
       SELECT DISTINCT e.partner_id,e.owner_id,e.user_id
         FROM eligible e
         JOIN partner_organizations po
           ON po.id=e.partner_id AND po.owner_organization_id=e.owner_id
     )
     SELECT
       (SELECT count(*)::int FROM legacy_users) AS legacy_connected_users,
       (SELECT count(*)::int FROM eligible) AS strict_eligible_users,
       (SELECT count(*)::int FROM strict_connected) AS strict_connected_users,
       COALESCE((
         SELECT json_agg(json_build_object(
           'partnerOrganizationId',lu.partner_id::text,
           'ownerOrganizationId',lu.owner_id,
           'userId',lu.user_id,
           'reason', CASE WHEN cu.user_id IS NOT NULL
                          THEN 'COLLEAGUE_INHERITED'
                          ELSE 'ACTIVE_OWNER_MEMBERSHIP_MISSING' END
         ) ORDER BY lu.partner_id,lu.user_id)
           FROM legacy_users lu
           LEFT JOIN colleague_users cu
             ON cu.partner_id=lu.partner_id
            AND cu.owner_id=lu.owner_id
            AND cu.user_id=lu.user_id
          WHERE NOT EXISTS (
            SELECT 1 FROM eligible e
             WHERE e.partner_id=lu.partner_id
               AND e.owner_id=lu.owner_id
               AND e.user_id=lu.user_id
          )
       ),'[]'::json) AS exceptions`,
    [partnerIds, ownerIds]
  );
  const row = result.rows[0];
  return {
    legacyConnectedUsers: Number(row?.legacy_connected_users || 0),
    strictEligibleUsers: Number(row?.strict_eligible_users || 0),
    strictConnectedUsers: Number(row?.strict_connected_users || 0),
    exceptions: Array.isArray(row?.exceptions) ? row.exceptions : [],
  };
}

export function assertApplyParityCandidate(parity: ConnectionParity): void {
  if (parity.legacyConnectedUsers !== parity.strictEligibleUsers) {
    throw new Error(
      `Connection parity exception: legacy=${parity.legacyConnectedUsers}, strictEligible=${parity.strictEligibleUsers}, exceptions=${JSON.stringify(parity.exceptions)}`
    );
  }
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sorted(child)])
  );
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sorted(value));
}

export function manifestPayload(manifest: OwnerBindingManifest): string {
  const { signature: _signature, ...unsigned } = manifest;
  return canonicalJson(unsigned);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function requiredString(value: unknown, label: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function assertManifestShape(manifest: OwnerBindingManifest): void {
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Unsupported manifest schemaVersion ${String(manifest.schemaVersion)}`);
  }
  requiredString(manifest.runId, 'runId');
  requiredString(manifest.actorUserId, 'actorUserId');
  if (manifest.operation !== 'APPLY' && manifest.operation !== 'ROLLBACK') {
    throw new Error('operation must be APPLY or ROLLBACK');
  }
  if (manifest.operation === 'ROLLBACK') requiredString(manifest.applyRunId, 'applyRunId');
  if (manifest.operation === 'APPLY' && manifest.applyRunId) {
    throw new Error('APPLY manifest must not contain applyRunId');
  }
  const issuedAt = Date.parse(manifest.issuedAt);
  const expiresAt = Date.parse(manifest.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) {
    throw new Error('issuedAt/expiresAt must describe a valid positive time window');
  }
  if (Date.now() > expiresAt) throw new Error('Manifest has expired');
  if (issuedAt > Date.now() + 5 * 60_000) throw new Error('Manifest issuedAt is in the future');
  if (!Array.isArray(manifest.mappings) || manifest.mappings.length === 0) {
    throw new Error('At least one explicit mapping is required');
  }
  const partnerIds = new Set<string>();
  const ownerIds = new Set<string>();
  for (const mapping of manifest.mappings) {
    const partnerId = requiredString(mapping.partnerOrganizationId, 'partnerOrganizationId');
    const ownerId = requiredString(mapping.ownerOrganizationId, 'ownerOrganizationId');
    if (partnerIds.has(partnerId)) throw new Error(`Duplicate Partner organization ${partnerId}`);
    if (ownerIds.has(ownerId)) throw new Error(`Duplicate active owner tenant ${ownerId}`);
    partnerIds.add(partnerId);
    ownerIds.add(ownerId);
  }
}

export function verifyManifest(
  manifest: OwnerBindingManifest,
  key: { keyId: string; secret: string }
): { inputSha256: string; mappings: OwnerBindingMapping[] } {
  assertManifestShape(manifest);
  if (manifest.signature?.algorithm !== SIGNATURE_ALGORITHM) {
    throw new Error(`Manifest signature must use ${SIGNATURE_ALGORITHM}`);
  }
  if (manifest.signature.keyId !== key.keyId) throw new Error('Manifest signing key id mismatch');
  if (key.secret.length < 32) throw new Error('Binding signing key must be at least 32 characters');
  const payload = manifestPayload(manifest);
  const expected = createHmac('sha256', key.secret).update(payload, 'utf8').digest('hex');
  const actual = String(manifest.signature.value || '');
  if (
    actual.length !== expected.length ||
    !timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
  ) {
    throw new Error('Manifest signature verification failed');
  }
  const mappings = [...manifest.mappings]
    .map((mapping) => ({
      partnerOrganizationId: mapping.partnerOrganizationId.trim(),
      ownerOrganizationId: mapping.ownerOrganizationId.trim(),
    }))
    .sort((left, right) => left.partnerOrganizationId.localeCompare(right.partnerOrganizationId));
  return { inputSha256: sha256(payload), mappings };
}

async function assertActor(queryable: Queryable, actorUserId: string): Promise<void> {
  const actor = await queryable.query<{
    role: string | null;
    status: string | null;
  }>(`SELECT role,status FROM users WHERE id=$1`, [actorUserId]);
  if (actor.rowCount !== 1) throw new Error(`Actor ${actorUserId} does not exist`);
  const role = String(actor.rows[0].role || '').toUpperCase();
  const status = String(actor.rows[0].status || 'active').toLowerCase();
  if (role !== 'SUPERADMIN' || status !== 'active') {
    throw new Error('Binding actor must be an active SUPERADMIN');
  }
}

async function lockAndValidateMappings(
  client: Queryable,
  operation: BindingOperation,
  mappings: OwnerBindingMapping[]
): Promise<void> {
  const partnerIds = mappings.map((mapping) => mapping.partnerOrganizationId);
  const ownerIds = mappings.map((mapping) => mapping.ownerOrganizationId);
  const partners = await client.query<{
    id: string;
    owner_organization_id: string | null;
  }>(
    `SELECT id::text AS id,owner_organization_id FROM partner_organizations
      WHERE id::text=ANY($1::text[]) ORDER BY id FOR UPDATE`,
    [partnerIds]
  );
  if (partners.rowCount !== partnerIds.length)
    throw new Error('One or more Partner rows are missing');
  const byId = new Map(partners.rows.map((row) => [row.id, row.owner_organization_id]));
  const organizations = await client.query<{
    id: string;
    status: string | null;
    is_active: number | null;
  }>(
    `SELECT id,status,is_active FROM organizations WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE`,
    [ownerIds]
  );
  if (organizations.rowCount !== ownerIds.length)
    throw new Error('One or more owner tenants are missing');
  if (operation === 'APPLY') {
    for (const organization of organizations.rows) {
      if (
        String(organization.status || 'active').toLowerCase() !== 'active' ||
        Number(organization.is_active ?? 1) !== 1
      ) {
        throw new Error(`Owner tenant ${organization.id} is inactive`);
      }
    }
  }
  if (operation === 'APPLY') {
    const occupied = await client.query<{ owner_organization_id: string }>(
      `SELECT owner_organization_id FROM partner_organizations
        WHERE owner_organization_id=ANY($1::text[])
          AND lower(coalesce(status,'active'))='active'
          AND NOT (id::text=ANY($2::text[]))
        ORDER BY owner_organization_id FOR UPDATE`,
      [ownerIds, partnerIds]
    );
    if (occupied.rowCount) {
      throw new Error(`Owner tenant collision: ${occupied.rows[0].owner_organization_id}`);
    }
  }
  for (const mapping of mappings) {
    const current = byId.get(mapping.partnerOrganizationId) ?? null;
    if (operation === 'APPLY' && current !== null) {
      throw new Error(`Partner ${mapping.partnerOrganizationId} is already bound`);
    }
    if (operation === 'ROLLBACK' && current !== mapping.ownerOrganizationId) {
      throw new Error(
        `Partner ${mapping.partnerOrganizationId} no longer matches the apply receipt`
      );
    }
  }
}

async function assertReceiptState(
  client: Queryable,
  operation: BindingOperation,
  mappings: OwnerBindingMapping[]
): Promise<void> {
  const partnerIds = mappings.map((mapping) => mapping.partnerOrganizationId);
  const rows = await client.query<{
    id: string;
    owner_organization_id: string | null;
  }>(
    `SELECT id::text AS id,owner_organization_id FROM partner_organizations
      WHERE id::text=ANY($1::text[]) ORDER BY id FOR UPDATE`,
    [partnerIds]
  );
  if (rows.rowCount !== partnerIds.length)
    throw new Error('Receipt state drift: Partner row missing');
  const byId = new Map(rows.rows.map((row) => [row.id, row.owner_organization_id]));
  for (const mapping of mappings) {
    const expected = operation === 'APPLY' ? mapping.ownerOrganizationId : null;
    if ((byId.get(mapping.partnerOrganizationId) ?? null) !== expected) {
      throw new Error(`Receipt state drift for Partner ${mapping.partnerOrganizationId}`);
    }
  }
}

async function readReceipt(queryable: Queryable, runId: string): Promise<any | null> {
  const result = await queryable.query(
    `SELECT run_id,operation,apply_run_id,input_sha256,result_sha256,mapping_count,mappings_json
       FROM partner_owner_binding_receipts WHERE run_id=$1`,
    [runId]
  );
  return result.rows[0] || null;
}

function resultDigest(manifest: OwnerBindingManifest, mappings: OwnerBindingMapping[]): string {
  return sha256(
    canonicalJson({
      runId: manifest.runId,
      operation: manifest.operation,
      applyRunId: manifest.applyRunId || null,
      mappings,
      outcome: manifest.operation === 'APPLY' ? 'BOUND' : 'UNBOUND',
    })
  );
}

export async function executeManifest(params: {
  pool: pg.Pool;
  manifest: OwnerBindingManifest;
  key: { keyId: string; secret: string };
  write: boolean;
  injectFailureAfter?: number;
}): Promise<BindingRunResult> {
  const verified = verifyManifest(params.manifest, params.key);
  const expectedResultSha = resultDigest(params.manifest, verified.mappings);
  const beforeParity = await readConnectionParity(params.pool, verified.mappings);
  if (params.manifest.operation === 'APPLY') assertApplyParityCandidate(beforeParity);
  if (!params.write) {
    await assertActor(params.pool, params.manifest.actorUserId);
    await lockAndValidateMappings(params.pool, params.manifest.operation, verified.mappings);
    if (params.manifest.operation === 'ROLLBACK') {
      const applyReceipt = await readReceipt(params.pool, params.manifest.applyRunId!);
      if (!applyReceipt || applyReceipt.operation !== 'APPLY')
        throw new Error('Apply receipt not found');
      if (canonicalJson(applyReceipt.mappings_json) !== canonicalJson(verified.mappings)) {
        throw new Error('Rollback mappings do not match the apply receipt');
      }
    }
    return {
      runId: params.manifest.runId,
      operation: params.manifest.operation,
      inputSha256: verified.inputSha256,
      resultSha256: expectedResultSha,
      mappingCount: verified.mappings.length,
      replay: false,
      dryRun: true,
      mappings: verified.mappings,
      connectionParity: beforeParity,
    };
  }

  const client = await params.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `partner-owner-binding:${params.manifest.runId}`,
    ]);
    const prior = await readReceipt(client, params.manifest.runId);
    if (prior) {
      if (
        prior.input_sha256 !== verified.inputSha256 ||
        prior.operation !== params.manifest.operation
      ) {
        throw new Error('Run id collision with a different signed manifest');
      }
      await assertReceiptState(client, prior.operation, prior.mappings_json);
      await client.query('COMMIT');
      return {
        runId: prior.run_id,
        operation: prior.operation,
        inputSha256: prior.input_sha256,
        resultSha256: prior.result_sha256,
        mappingCount: prior.mapping_count,
        replay: true,
        dryRun: false,
        mappings: prior.mappings_json,
        connectionParity: await readConnectionParity(client, prior.mappings_json),
      };
    }
    await assertActor(client, params.manifest.actorUserId);
    if (params.manifest.operation === 'ROLLBACK') {
      const applyReceipt = await readReceipt(client, params.manifest.applyRunId!);
      if (!applyReceipt || applyReceipt.operation !== 'APPLY')
        throw new Error('Apply receipt not found');
      if (canonicalJson(applyReceipt.mappings_json) !== canonicalJson(verified.mappings)) {
        throw new Error('Rollback mappings do not match the apply receipt');
      }
    }
    await lockAndValidateMappings(client, params.manifest.operation, verified.mappings);
    let changed = 0;
    for (const mapping of verified.mappings) {
      const result =
        params.manifest.operation === 'APPLY'
          ? await client.query(
              `UPDATE partner_organizations SET owner_organization_id=$2,updated_at=NOW()
                WHERE id=$1::uuid AND owner_organization_id IS NULL`,
              [mapping.partnerOrganizationId, mapping.ownerOrganizationId]
            )
          : await client.query(
              `UPDATE partner_organizations SET owner_organization_id=NULL,updated_at=NOW()
                WHERE id=$1::uuid AND owner_organization_id=$2`,
              [mapping.partnerOrganizationId, mapping.ownerOrganizationId]
            );
      if (result.rowCount !== 1) throw new Error('Binding state changed during transaction');
      changed += 1;
      if (params.injectFailureAfter === changed) throw new Error('Injected owner-binding failure');
    }
    const afterParity = await readConnectionParity(client, verified.mappings);
    if (
      params.manifest.operation === 'APPLY' &&
      afterParity.strictConnectedUsers !== afterParity.legacyConnectedUsers
    ) {
      throw new Error(
        `Connection parity mismatch after APPLY: legacy=${afterParity.legacyConnectedUsers}, strict=${afterParity.strictConnectedUsers}`
      );
    }
    await client.query(
      `INSERT INTO partner_owner_binding_receipts
       (run_id,operation,apply_run_id,input_sha256,signature_key_id,actor_user_id,
        manifest_issued_at,mapping_count,mappings_json,result_sha256)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
      [
        params.manifest.runId,
        params.manifest.operation,
        params.manifest.applyRunId || null,
        verified.inputSha256,
        params.manifest.signature.keyId,
        params.manifest.actorUserId,
        params.manifest.issuedAt,
        verified.mappings.length,
        JSON.stringify(verified.mappings),
        expectedResultSha,
      ]
    );
    await client.query('COMMIT');
    return {
      runId: params.manifest.runId,
      operation: params.manifest.operation,
      inputSha256: verified.inputSha256,
      resultSha256: expectedResultSha,
      mappingCount: verified.mappings.length,
      replay: false,
      dryRun: false,
      mappings: verified.mappings,
      connectionParity: afterParity,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function buildRunReport(result: BindingRunResult, executedAt = new Date()): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      ...result,
      observedAt: executedAt.toISOString(),
    },
    null,
    2
  )}\n`;
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (['apply', 'rollback'].includes(key)) args[key] = true;
    else args[key] = argv[++index] || '';
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(requiredString(args.manifest, '--manifest'));
  const databaseUrl = requiredString(
    args['database-url'] || process.env.DATABASE_URL,
    'DATABASE_URL'
  );
  const target = new URL(databaseUrl);
  const expectedHost = requiredString(args['expect-host'], '--expect-host');
  const expectedDatabase = requiredString(args['expect-database'], '--expect-database');
  const actualDatabase = target.pathname.replace(/^\/+/, '');
  if (target.hostname !== expectedHost || actualDatabase !== expectedDatabase) {
    throw new Error('Database target does not match the explicitly approved host/database');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as OwnerBindingManifest;
  const write = args.apply === true || args.rollback === true;
  if (args.apply === true && manifest.operation !== 'APPLY')
    throw new Error('--apply requires APPLY');
  if (args.rollback === true && manifest.operation !== 'ROLLBACK') {
    throw new Error('--rollback requires ROLLBACK');
  }
  if (args.apply && args.rollback) throw new Error('Choose only one of --apply or --rollback');
  const key = {
    keyId: requiredString(process.env[SIGNING_KEY_ID_ENV], SIGNING_KEY_ID_ENV),
    secret: requiredString(process.env[SIGNING_KEY_ENV], SIGNING_KEY_ENV),
  };
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const live = await pool.query<{ database: string }>('SELECT current_database() database');
    if (live.rows[0].database !== expectedDatabase) throw new Error('Connected database mismatch');
    const result = await executeManifest({ pool, manifest, key, write });
    const reportPath = path.resolve(
      String(
        args.report ||
          `${manifestPath}.${write ? manifest.operation.toLowerCase() : 'dry-run'}.json`
      )
    );
    fs.writeFileSync(reportPath, buildRunReport(result), {
      encoding: 'utf8',
      mode: 0o600,
    });
    console.log(`${write ? manifest.operation : 'DRY_RUN'} ${result.replay ? 'REPLAY' : 'OK'}`);
    console.log(`input sha256: ${result.inputSha256}`);
    console.log(`report: ${reportPath}`);
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
