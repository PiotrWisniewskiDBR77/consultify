/**
 * ORG-BVP-001 / ORG-OPS-001 (Lane C closure) — governed organization-context
 * snapshot spine, against a REAL Postgres database (no mocks).
 *
 * Proves the flow the closure task actually asked for: claim -> human
 * approval -> IMMUTABLE, versioned, hash-bound snapshot -> pinned read ->
 * reopen -> source-deletion detectability -> tenant isolation ->
 * confidentiality filtering -> exactly-one-decision under concurrency.
 *
 * Pattern follows `tests/integration/tools-links-org-scope.realdb.test.ts`
 * (raw `pg` client for fixtures/schema assertions + the shared
 * `assertRealPostgresTestEnvironment()` guard — ABSOLUTE RULE for this
 * workstream: fail, never skip, never mock) and
 * `tests/integration/mw010-vault-versioning.golden-flow.realdb.test.ts`
 * (env vars forced BEFORE any dynamic import of application code).
 *
 * HOW TO RUN LOCALLY:
 *   export DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:55432/consultinity"
 *   export DB_TYPE=postgres CI=true
 *   npx tsx server/scripts/migrate.postgres.ts
 *   npx vitest run tests/organization-context-closure --no-file-parallelism --maxWorkers=1
 */

import { createHash, randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

// ---------------------------------------------------------------------------
// Force the real Postgres target BEFORE any application module is imported.
// `DatabaseConfig.ts` reads these at module-load time, not lazily — see
// `mw010-vault-versioning.golden-flow.realdb.test.ts` header for the same
// requirement. Per this lane's mandate: `CI=true`, NEVER `NODE_ENV=test`
// (the latter alone does not defeat `tests/setup.ts`'s `MOCK_DB` default).
// ---------------------------------------------------------------------------
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://consultinity:consultinity@127.0.0.1:55432/consultinity';
process.env.DB_TYPE = 'postgres';
process.env.CI = 'true';
process.env.RUN_DB_TESTS = '1';
process.env.MOCK_DB = 'false';

const {
  organizationContextService,
  computeContentHash,
  canonicalizeForHash,
} = await import('../../server/src/services/organizationContext/OrganizationContextService.js');

describe('ORG-BVP-001/ORG-OPS-001 — governed organization-context snapshot spine (real Postgres)', () => {
  const suffix = randomUUID().slice(0, 8);
  const p = (s: string) => `claude_c_${s}_${suffix}`;

  const orgA = p('org_a');
  const orgB = p('org_b');
  const orgEmpty = p('org_empty');
  const userA = p('user_a');
  const userB = p('user_b');
  const userEmpty = p('user_empty');
  const docId = p('doc');
  const docHashV1 = createHash('sha256').update('claude_c fixture bytes v1').digest('hex');
  const docHashV2 = createHash('sha256').update('claude_c fixture bytes v2 (edited)').digest('hex');

  const itemA = p('item_a');
  const itemB = p('item_b');

  // Claims (org A):
  const claimLegacyAccepted = p('claim_legacy_accepted'); // review_status='accepted', no review row
  const claimPendingPlain = p('claim_pending_plain'); // review_status='pending', no review row
  const claimRestricted = p('claim_restricted'); // visibility_scope='restricted', legacy-accepted
  const claimWithDoc = p('claim_with_doc'); // evidence.documentExtraction citing knowledge_docs
  const claimForRace = p('claim_for_race'); // used only by the concurrency test
  // Claim (org B) — tenant isolation:
  const claimOrgB = p('claim_org_b');

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  let connected = false;

  beforeAll(async () => {
    // ABSOLUTE RULE for this workstream: fail, never skip, never mock.
    await assertRealPostgresTestEnvironment();
    await client.connect();
    connected = true;

    for (const [id, name] of [
      [orgA, 'Claude C org A'],
      [orgB, 'Claude C org B'],
      [orgEmpty, 'Claude C empty org'],
    ]) {
      await client.query(
        `INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'enterprise','active')
         ON CONFLICT (id) DO NOTHING`,
        [id, name]
      );
    }
    for (const [uid, oid] of [
      [userA, orgA],
      [userB, orgB],
      [userEmpty, orgEmpty],
    ]) {
      await client.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
         VALUES ($1,$2,$3,'x','ADMIN','active','Claude','C')
         ON CONFLICT (id) DO NOTHING`,
        [uid, oid, `${uid}@local.test`]
      );
    }

    await client.query(
      `INSERT INTO knowledge_docs (id, filename, file_hash, version, organization_id, status)
       VALUES ($1,'claude_c_fixture.txt',$2,1,$3,'ready')`,
      [docId, docHashV1, orgA]
    );

    await client.query(
      `INSERT INTO organization_context_items
         (id, organization_id, source_type, source_id, author_user_id, channel, source_label, content_json, metadata_json, is_explicit, visibility_scope, created_at, updated_at)
       VALUES
         ($1,$2,'organization_profile',$2,$3,'admin','Claude C fixture item','{}','{}',1,'organization',NOW(),NOW()),
         ($4,$5,'organization_profile',$5,$6,'admin','Claude C fixture item (org B)','{}','{}',1,'organization',NOW(),NOW())`,
      [itemA, orgA, userA, itemB, orgB, userB]
    );

    const claimRows: Array<[string, string, string, unknown, string, string]> = [
      // [id, itemId, claimPath, valueJson, orgId, reviewStatus]
      [claimLegacyAccepted, itemA, 'profile.industry', 'Consulting', orgA, 'accepted'],
      [claimPendingPlain, itemA, 'profile.companySize', 'SMB', orgA, 'pending'],
      [claimRestricted, itemA, 'notes.manualContext', { content: 'secret note' }, orgA, 'accepted'],
      [
        claimWithDoc,
        itemA,
        'evidence.documentExtraction',
        { docId, filename: 'claude_c_fixture.txt', snippet: 'fixture snippet' },
        orgA,
        'pending',
      ],
      [claimForRace, itemA, 'strategic.mission', 'Claude C race fixture', orgA, 'pending'],
      [claimOrgB, itemB, 'profile.industry', 'Org B Industry', orgB, 'accepted'],
    ];

    for (const [id, itemId, claimPath, value, orgId, reviewStatus] of claimRows) {
      await client.query(
        `INSERT INTO organization_context_claims
           (id, organization_id, item_id, claim_path, value_json, confidence, claim_type, status, review_status, created_at)
         VALUES ($1,$2,$3,$4,$5,1,'fact','active',$6,NOW())`,
        [id, orgId, itemId, claimPath, JSON.stringify(value), reviewStatus]
      );
    }

    // The restricted-visibility claim's item needs its own item row with
    // visibility_scope='restricted' so the confidentiality filter has
    // something real to filter on (claimRestricted references itemA above,
    // which is 'organization'-scoped — give it a dedicated restricted item).
    const restrictedItem = p('item_restricted');
    await client.query(
      `INSERT INTO organization_context_items
         (id, organization_id, source_type, source_id, author_user_id, channel, source_label, content_json, metadata_json, is_explicit, visibility_scope, created_at, updated_at)
       VALUES ($1,$2,'ai_context',$2,$3,'admin','Claude C restricted item','{}','{}',1,'restricted',NOW(),NOW())`,
      [restrictedItem, orgA, userA]
    );
    await client.query(
      `UPDATE organization_context_claims SET item_id = $1 WHERE id = $2`,
      [restrictedItem, claimRestricted]
    );
  });

  afterAll(async () => {
    if (!connected) return; // beforeAll threw before connecting — nothing to clean up.
    await client
      .query(`DELETE FROM organization_context_snapshot_versions WHERE organization_id = ANY($1)`, [
        [orgA, orgB, orgEmpty],
      ])
      .catch(() => {});
    await client
      .query(`DELETE FROM organization_context_claim_reviews WHERE organization_id = ANY($1)`, [
        [orgA, orgB, orgEmpty],
      ])
      .catch(() => {});
    await client
      .query(`DELETE FROM organization_context_claims WHERE organization_id = ANY($1)`, [[orgA, orgB, orgEmpty]])
      .catch(() => {});
    await client
      .query(`DELETE FROM organization_context_items WHERE organization_id = ANY($1)`, [[orgA, orgB, orgEmpty]])
      .catch(() => {});
    await client.query(`DELETE FROM knowledge_docs WHERE id = $1`, [docId]).catch(() => {});
    await client.query(`DELETE FROM users WHERE id = ANY($1)`, [[userA, userB, userEmpty]]).catch(() => {});
    await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB, orgEmpty]]).catch(() => {});

    // Test-hygiene proof: zero leftovers for every fixture id, across every
    // table this suite touched.
    const leftovers = await client.query<{ n: string }>(
      `SELECT
         (SELECT COUNT(*) FROM organization_context_snapshot_versions WHERE organization_id = ANY($1)) +
         (SELECT COUNT(*) FROM organization_context_claim_reviews WHERE organization_id = ANY($1)) +
         (SELECT COUNT(*) FROM organization_context_claims WHERE organization_id = ANY($1)) +
         (SELECT COUNT(*) FROM organization_context_items WHERE organization_id = ANY($1)) +
         (SELECT COUNT(*) FROM knowledge_docs WHERE id = $2) +
         (SELECT COUNT(*) FROM users WHERE id = ANY($3)) +
         (SELECT COUNT(*) FROM organizations WHERE id = ANY($1))
         AS n`,
      [[orgA, orgB, orgEmpty], docId, [userA, userB, userEmpty]]
    );
    expect(Number(leftovers.rows[0].n)).toBe(0);

    await client.end();
  });

  // ── Schema / migration structural checks ─────────────────────────────────
  it('migration created the append-only snapshot table with its DB-level guarantees', async () => {
    const uniqueIndex = await client.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'organization_context_snapshot_versions' AND indexname = 'uq_ocsv_org_version'`
    );
    expect(uniqueIndex.rows).toHaveLength(1);

    const trigger = await client.query(
      `SELECT tgname FROM pg_trigger WHERE tgrelid = 'organization_context_snapshot_versions'::regclass AND tgname = 'trg_ocsv_block_update'`
    );
    expect(trigger.rows).toHaveLength(1);

    const check = await client.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'organization_context_snapshot_versions'::regclass AND conname = 'ck_ocsv_content_hash_present'`
    );
    expect(check.rows).toHaveLength(1);
  });

  // ── Legacy backward-compatibility + pending-by-default ────────────────────
  it('treats a pre-governance accepted claim as approved (legacy_auto_accept), and a plain-pending claim as NOT approved', async () => {
    const claims = await organizationContextService.listGovernedClaims(orgA, { includeRestricted: true });
    const legacy = claims.find((c: any) => c.claimId === claimLegacyAccepted);
    const pending = claims.find((c: any) => c.claimId === claimPendingPlain);

    expect(legacy?.approved).toBe(true);
    expect(legacy?.approvalSource).toBe('legacy_auto_accept');
    expect(legacy?.reviewState).toBe('approved');

    expect(pending?.approved).toBe(false);
    expect(pending?.reviewState).toBe('pending');
  });

  // ── Confidentiality: visibility_scope actually filters a read ─────────────
  it('excludes a restricted-visibility claim from the default (non-admin) governed claims read, includes it when includeRestricted=true', async () => {
    const defaultRead = await organizationContextService.listGovernedClaims(orgA, {});
    expect(defaultRead.some((c: any) => c.claimId === claimRestricted)).toBe(false);

    const privilegedRead = await organizationContextService.listGovernedClaims(orgA, {
      includeRestricted: true,
    });
    expect(privilegedRead.some((c: any) => c.claimId === claimRestricted)).toBe(true);
  });

  // ── Tenant isolation ────────────────────────────────────────────────────
  it('tenant negative: org A cannot approve org B claims, and org B never sees org A claims', async () => {
    const crossOrgApprove = await organizationContextService.approveClaim(orgA, claimOrgB, userA);
    expect(crossOrgApprove).toBeNull();

    const orgBClaims = await organizationContextService.listGovernedClaims(orgB, { includeRestricted: true });
    expect(orgBClaims.map((c: any) => c.claimId)).toEqual([claimOrgB]);
    expect(orgBClaims.some((c: any) => c.claimId === claimLegacyAccepted)).toBe(false);
  });

  // ── Approval + publish + exact refs ────────────────────────────────────
  let publishedV1ContentHash = '';
  let publishedV1SnapshotRaw = '';

  it('rejects a direct empty publish before writing a snapshot version', async () => {
    await expect(
      organizationContextService.publishSnapshotVersion(orgEmpty, userEmpty)
    ).rejects.toMatchObject({ code: 'NO_APPROVED_GOVERNED_CLAIMS' });
    const rows = await client.query(
      `SELECT id FROM organization_context_snapshot_versions WHERE organization_id = $1`,
      [orgEmpty]
    );
    expect(rows.rows).toHaveLength(0);
  });

  it('approves pending claims, then publishes v1 excluding still-unapproved claims and carrying exact refs (claim id + file_hash + version)', async () => {
    const approveDoc = await organizationContextService.approveClaim(orgA, claimWithDoc, userA, 'looks correct');
    expect(approveDoc?.reviewState).toBe('approved');
    expect(approveDoc?.wonDecision).toBe(true);

    // claimPendingPlain and claimForRace are deliberately left undecided —
    // they must NOT appear in the published snapshot.
    const version = await organizationContextService.publishSnapshotVersion(orgA, userA);
    expect(version.version).toBe(1);
    expect(version.contentHash).toMatch(/^[0-9a-f]{64}$/);
    publishedV1ContentHash = version.contentHash;

    const pinned = await organizationContextService.getSnapshotVersion(orgA, 1, { includeRestricted: true });
    expect(pinned).not.toBeNull();
    const claimIds = pinned!.claims.map((c: any) => c.claimId).sort();
    expect(claimIds).toContain(claimLegacyAccepted);
    expect(claimIds).toContain(claimWithDoc);
    expect(claimIds).toContain(claimRestricted);
    expect(claimIds).not.toContain(claimPendingPlain);
    expect(claimIds).not.toContain(claimForRace);
    expect(claimIds).not.toContain(claimOrgB);

    const docRef = pinned!.sourceRefs.find((r: any) => r.claimId === claimWithDoc);
    expect(docRef?.sourceDocId).toBe(docId);
    expect(docRef?.fileHash).toBe(docHashV1);
    expect(docRef?.docVersion).toBe(1);
    expect(docRef?.dangling).toBe(false);

    // Independent re-derivation of the hash from the raw DB row (not via
    // the service) — proves `content_hash` is really the sha256 of the
    // canonicalized stored payload, not an unrelated/opaque value.
    const raw = await client.query(
      `SELECT snapshot_json, content_hash FROM organization_context_snapshot_versions WHERE organization_id = $1 AND version = 1`,
      [orgA]
    );
    publishedV1SnapshotRaw = raw.rows[0].snapshot_json;
    const recomputed = computeContentHash(JSON.parse(publishedV1SnapshotRaw));
    expect(recomputed).toBe(raw.rows[0].content_hash);
    expect(recomputed).toBe(publishedV1ContentHash);
  });

  it('immutability: a direct UPDATE against a published snapshot version is rejected by the DB trigger', async () => {
    await expect(
      client.query(
        `UPDATE organization_context_snapshot_versions SET snapshot_json = '{"tampered":true}' WHERE organization_id = $1 AND version = 1`,
        [orgA]
      )
    ).rejects.toThrow(/append-only/);

    const stillOriginal = await client.query(
      `SELECT content_hash FROM organization_context_snapshot_versions WHERE organization_id = $1 AND version = 1`,
      [orgA]
    );
    expect(stillOriginal.rows[0].content_hash).toBe(publishedV1ContentHash);
  });

  it('reopen: publishing v2 does not change v1 — same content_hash, byte-identical snapshot_json', async () => {
    const approvePending = await organizationContextService.approveClaim(orgA, claimPendingPlain, userA);
    expect(approvePending?.reviewState).toBe('approved');

    const v2 = await organizationContextService.publishSnapshotVersion(orgA, userA);
    expect(v2.version).toBe(2);
    expect(v2.contentHash).not.toBe(publishedV1ContentHash);

    const v2Claims = (
      await organizationContextService.getSnapshotVersion(orgA, 2, { includeRestricted: true })
    )!.claims.map((c: any) => c.claimId);
    expect(v2Claims).toContain(claimPendingPlain);

    // Reopen v1 AFTER v2 exists.
    const reopened = await organizationContextService.getSnapshotVersion(orgA, 1, { includeRestricted: true });
    expect(reopened!.contentHash).toBe(publishedV1ContentHash);

    const rawAfter = await client.query(
      `SELECT snapshot_json FROM organization_context_snapshot_versions WHERE organization_id = $1 AND version = 1`,
      [orgA]
    );
    expect(rawAfter.rows[0].snapshot_json).toBe(publishedV1SnapshotRaw);
  });

  it('tenant negative: org B cannot read org A pinned snapshot versions', async () => {
    const crossOrgRead = await organizationContextService.getSnapshotVersion(orgB, 1);
    expect(crossOrgRead).toBeNull();
  });

  // ── Concurrency: exactly one decision ──────────────────────────────────
  it('two simultaneous approve/reject calls on the same claim resolve to exactly one decision', async () => {
    const [resultApprove, resultReject] = await Promise.all([
      organizationContextService.approveClaim(orgA, claimForRace, userA),
      organizationContextService.rejectClaim(orgA, claimForRace, userB),
    ]);

    expect(resultApprove).not.toBeNull();
    expect(resultReject).not.toBeNull();
    // Both calls must report the SAME final, persisted state.
    expect(resultApprove!.reviewState).toBe(resultReject!.reviewState);
    expect(resultApprove!.decidedBy).toBe(resultReject!.decidedBy);
    // Exactly one of the two calls actually performed the transition.
    expect([resultApprove!.wonDecision, resultReject!.wonDecision].filter(Boolean)).toHaveLength(1);

    const rows = await client.query(
      `SELECT review_state FROM organization_context_claim_reviews WHERE claim_id = $1`,
      [claimForRace]
    );
    expect(rows.rows).toHaveLength(1);
    expect(['approved', 'rejected']).toContain(rows.rows[0].review_state);
  });

  // ── Source deletion negative (detectability, not silent corruption) ────
  it('hard-deleting the cited source document is DETECTABLE on the pinned read, and does not alter the stored snapshot content', async () => {
    const before = await organizationContextService.getSnapshotVersion(orgA, 1, { includeRestricted: true });
    const refBefore = before!.sourceRefs.find((r: any) => r.claimId === claimWithDoc);
    expect(refBefore?.dangling).toBe(false);

    await client.query(`DELETE FROM knowledge_docs WHERE id = $1`, [docId]);

    const after = await organizationContextService.getSnapshotVersion(orgA, 1, { includeRestricted: true });
    // The stored content itself is untouched — same hash as always.
    expect(after!.contentHash).toBe(publishedV1ContentHash);
    const refAfter = after!.sourceRefs.find((r: any) => r.claimId === claimWithDoc);
    expect(refAfter?.dangling).toBe(true);
    expect(refAfter?.danglingReason).toBe('deleted');
    // The frozen ref still carries what it was built from — a reproducible
    // citation of bytes that no longer exist, not a silently vanished one.
    expect(refAfter?.fileHash).toBe(docHashV1);

    // Re-create the fixture row so afterAll's cleanup (which also deletes
    // by id) is a no-op rather than an error, and so canonicalizeForHash
    // stays exercised above without leaving this suite's own teardown
    // dependent on ordering.
    await client.query(
      `INSERT INTO knowledge_docs (id, filename, file_hash, version, organization_id, status)
       VALUES ($1,'claude_c_fixture.txt',$2,1,$3,'ready')
       ON CONFLICT (id) DO NOTHING`,
      [docId, docHashV2, orgA]
    );
  });

  it('canonicalizeForHash sorts object keys recursively (order-independent hashing)', () => {
    const a = canonicalizeForHash({ b: 1, a: { d: 2, c: 3 } });
    const b = canonicalizeForHash({ a: { c: 3, d: 2 }, b: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
