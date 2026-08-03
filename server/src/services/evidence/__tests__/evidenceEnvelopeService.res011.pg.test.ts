/**
 * RES-011 (Phase 0 — security fix) — evidenceEnvelopeService cross-tenant
 * write/poisoning guard, proved against a REAL PostgreSQL.
 *
 * Confirmed pre-fix (see docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/
 * RES-011_IMPLEMENTATION_PACKET.md and tests/reproducers/
 * res11-cross-tenant-evidence-repro.md): `getEnvelope` had no
 * `organization_id` predicate, so `upsertEnvelope`'s existing-row lookup
 * would match ANY org's row for the same (artifactType, artifactId), and
 * the UPDATE branch never re-checked the row's actual owner — org B could
 * silently overwrite (and partially read back, via the merge-forward of
 * omitted fields) org A's evidence envelope just by guessing/observing a
 * KPI id. A mock cannot prove this: the bug and the fix both hinge on
 * `artifact_evidence`'s real UNIQUE (artifact_type, artifact_id) constraint
 * (org NOT in the key) actually existing and actually being hit.
 *
 * HOW TO RUN:
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:<port>/consultinity_test \
 *   npx vitest run --retry=0 server/src/services/evidence/__tests__/evidenceEnvelopeService.res011.pg.test.ts
 *
 * TENANCY: every test uses fresh org ids (orgFor(key)) so tests never
 * observe each other's rows and can run in any order. artifactId is also
 * randomized per test to avoid UNIQUE(artifact_type, artifact_id)
 * collisions across runs.
 */
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

async function canReach(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

async function hasEvidenceSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const result = await probe.query(
      `SELECT to_regclass('public.artifact_evidence') IS NOT NULL AS present`
    );
    return Boolean(result.rows[0]?.present);
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;
const HAS_SCHEMA = REACHABLE ? await hasEvidenceSchema(CONNECTION_STRING) : false;

if (!REACHABLE || !HAS_SCHEMA) {
  // eslint-disable-next-line no-console
  console.warn(
    `[RES-011 evidenceEnvelopeService suite SKIPPED — this is a clean skip, not a failure] ` +
      `needs DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<reachable, evidence-migrated postgres>. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE} hasSchema=${HAS_SCHEMA}`
  );
}

const suite = REACHABLE && HAS_SCHEMA ? describe.sequential : describe.skip;

const ORG_PREFIX = 'res011-evidence';
const orgFor = (key: string): string => `${ORG_PREFIX}-${key}-${Date.now().toString(36)}`;
const artifactIdFor = (key: string): string => `${key}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`;

let control: Pool;
let evidence: typeof import('../evidenceEnvelopeService.js');

async function seedOrg(orgId: string): Promise<void> {
  await control.query(
    `INSERT INTO organizations (id, name) VALUES ($1, $1) ON CONFLICT (id) DO NOTHING`,
    [orgId]
  );
}

suite('evidenceEnvelopeService — RES-011 cross-tenant guard (real PostgreSQL)', () => {
  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    process.env.DB_TYPE = 'postgres';
    process.env.DATABASE_URL = CONNECTION_STRING;
    evidence = await import('../evidenceEnvelopeService.js');
  }, 60_000);

  afterAll(async () => {
    if (!control) return;
    await control.end().catch(() => undefined);
    const { default: db } = await import('../../../database/PostgresDatabase.js');
    await (db as unknown as { close: () => Promise<void> }).close().catch(() => undefined);
  }, 60_000);

  it('1. getEnvelope is org-scoped: org B cannot read org A\'s envelope by artifactId', async () => {
    const orgA = orgFor('read-a');
    const orgB = orgFor('read-b');
    await seedOrg(orgA);
    await seedOrg(orgB);
    const artifactId = artifactIdFor('kpi-read');

    await evidence.upsertEnvelope({
      organizationId: orgA,
      artifactType: 'kpi',
      artifactId,
      sources: [{ type: 'interview', ref: 'interview-secret-A' }],
      confidence: 0.9,
    });

    const asOwner = await evidence.getEnvelope('kpi', artifactId, orgA);
    expect(asOwner?.sources[0]?.ref).toBe('interview-secret-A');

    const asForeign = await evidence.getEnvelope('kpi', artifactId, orgB);
    expect(asForeign).toBeNull();
  });

  it("2. THE FIX: org B's upsertEnvelope against org A's artifactId is REJECTED, not silently applied", async () => {
    const orgA = orgFor('write-a');
    const orgB = orgFor('write-b');
    await seedOrg(orgA);
    await seedOrg(orgB);
    const artifactId = artifactIdFor('kpi-write');

    await evidence.upsertEnvelope({
      organizationId: orgA,
      artifactType: 'kpi',
      artifactId,
      sources: [{ type: 'interview', ref: 'interview-secret-A' }],
      confidence: 0.9,
    });

    await expect(
      evidence.upsertEnvelope({
        organizationId: orgB,
        artifactType: 'kpi',
        artifactId,
        sources: [{ type: 'benchmark', ref: 'attacker-controlled' }],
        confidence: 0.99,
      })
    ).rejects.toThrow(evidence.EvidenceEnvelopeForeignOrgError);

    // Org A's envelope survives completely untouched — the pre-fix bug's
    // "silent overwrite" outcome does NOT happen.
    const stillOwnedByA = await evidence.getEnvelope('kpi', artifactId, orgA);
    expect(stillOwnedByA?.sources[0]?.ref).toBe('interview-secret-A');
    expect(stillOwnedByA?.confidence).toBe(0.9);
  });

  it('3. THE FIX: org B\'s attachSource against org A\'s artifactId is REJECTED, no append happens', async () => {
    const orgA = orgFor('attach-a');
    const orgB = orgFor('attach-b');
    await seedOrg(orgA);
    await seedOrg(orgB);
    const artifactId = artifactIdFor('kpi-attach');

    await evidence.upsertEnvelope({
      organizationId: orgA,
      artifactType: 'kpi',
      artifactId,
      sources: [{ type: 'interview', ref: 'original-source-A' }],
    });

    await expect(
      evidence.attachSource({
        organizationId: orgB,
        artifactType: 'kpi',
        artifactId,
        source: { type: 'benchmark', ref: 'attacker-appended' },
      })
    ).rejects.toThrow(evidence.EvidenceEnvelopeForeignOrgError);

    const stillOwnedByA = await evidence.getEnvelope('kpi', artifactId, orgA);
    expect(stillOwnedByA?.sources).toHaveLength(1);
    expect(stillOwnedByA?.sources[0]?.ref).toBe('original-source-A');
  });

  it('4. POSITIVE CONTROL: org A updating its OWN envelope still works normally (fail-closed does not over-block)', async () => {
    const orgA = orgFor('positive-a');
    await seedOrg(orgA);
    const artifactId = artifactIdFor('kpi-positive');

    await evidence.upsertEnvelope({
      organizationId: orgA,
      artifactType: 'kpi',
      artifactId,
      sources: [{ type: 'interview', ref: 'v1' }],
      confidence: 0.5,
    });
    const updated = await evidence.upsertEnvelope({
      organizationId: orgA,
      artifactType: 'kpi',
      artifactId,
      sources: [{ type: 'interview', ref: 'v2' }],
      confidence: 0.8,
    });

    expect(updated.sources[0]?.ref).toBe('v2');
    expect(updated.confidence).toBe(0.8);
  });

  it('5. NEGATIVE CONTROL: a genuinely new artifactId (no existing envelope, any org) still creates cleanly', async () => {
    const org = orgFor('fresh');
    await seedOrg(org);
    const artifactId = artifactIdFor('kpi-fresh');

    const created = await evidence.upsertEnvelope({
      organizationId: org,
      artifactType: 'kpi',
      artifactId,
      sources: [{ type: 'interview', ref: 'brand-new' }],
    });
    expect(created.organizationId).toBe(org);
    expect(created.sources[0]?.ref).toBe('brand-new');
  });
});
