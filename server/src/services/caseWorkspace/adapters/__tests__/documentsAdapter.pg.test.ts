/**
 * Case Workspace — Documents / Presentation capability adapters, proved
 * against a REAL PostgreSQL (Strumień C, packet D1c).
 *
 * Exercises server/src/services/caseWorkspace/adapters/documentsAdapter.ts
 * end-to-end through capabilityAdapterService.executeCapability for BOTH
 * capabilities this file owns:
 *   - case-workspace.documents.document.create
 *       -> documentStudio/documentStudioService.materializeDocumentArtifact
 *          + getDocumentArtifact
 *   - case-workspace.presentation.deck.create
 *       -> presentationGeneratorService.createNativeDeck + a raw
 *          `presentation_decks` readback (see documentsAdapter.ts's header
 *          for why no exported "getNativeDeck" exists)
 *
 * Nothing here calls either binding's internal handler directly; every
 * assertion goes through the same public entry point a real caller (a future
 * NodeRun dispatcher, or Teresa) would use. Same structure and shared
 * fixtures as financeAdapter.pg.test.ts / resultsAdapter.pg.test.ts.
 *
 * NOTE ON FILE LOCATION: per this packet's task brief allowlist, this file
 * lives at server/src/services/caseWorkspace/adapters/__tests__/
 * (like resultsAdapter.pg.test.ts / assessmentAdapter.pg.test.ts), not at
 * server/src/services/caseWorkspace/__tests__/adapters/ where the OLDER
 * sibling suites (decisionAdapter/initiativeAdapter/kpiAdapter/financeAdapter)
 * live — reaches the same shared `_fixtures.ts` via a relative import into
 * that other directory rather than duplicating it.
 *
 * ===========================================================================
 * GATE — real database only, same convention as every other *.pg.test.ts
 * ===========================================================================
 *   cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
 *   npx vitest run src/services/caseWorkspace/adapters/__tests__/documentsAdapter.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT EACH SECTION PROVES
 * ===========================================================================
 * Documents (`describe` block 1):
 *   1. success       — a real `wave5_artifacts` row lands (artifact_type
 *                       'report'), a real ACTIVE artifact link points at it,
 *                       and getDocumentArtifact's OWN readback (never this
 *                       suite's SELECT) shows REAL rendered block text
 *                       containing the exact description this test supplied
 *                       — not merely a non-null schema.
 *   2. denial         — blank description, and case-access-denied, both
 *                       refused with the right taxonomy code, writing
 *                       nothing.
 *   3. retry          — a replayed idempotency key is suppressed without a
 *                       second wave5 row; a fresh key after a rejected
 *                       attempt still recovers.
 *   4. partial failure — the artifact-link step is made to fail; the document
 *                       is still real, addressable, and re-linkable.
 *   5. cross-tenant    — envelope/Case org mismatch, and a genuine stranger,
 *                       both refused before any write.
 *   6. stable deep link — resultRef + deepLink + the artifact link all
 *                       resolve to the SAME object on repeated reads.
 *   7. BONUS negative control — this adapter's OWN readback defense: when
 *                       the wrapped `materializeDocumentArtifact` is made to
 *                       return an artifactId that was never actually
 *                       persisted (documentStudioService.ts has no reachable
 *                       DB-level CHECK/type constraint for a caller to
 *                       violate — see documentsAdapter.ts's header — so this
 *                       is simulated via dependency injection rather than a
 *                       real SQL type error), the capability must surface
 *                       FAILED, never a lying SUCCEEDED.
 *
 * Presentation (`describe` block 2):
 *   1. success       — a real `presentation_decks` row lands, a real ACTIVE
 *                       artifact link points at it, and a fresh SELECT (this
 *                       suite's own, since no service-level getter exists)
 *                       shows the cover card's rendered text containing the
 *                       exact subtitle this test supplied.
 *   2. denial / 3. retry / 4. partial failure / 5. cross-tenant / 6. stable
 *      deep link — same shape as Documents above.
 *   7. BONUS negative control — a REAL Postgres CHECK-constraint violation
 *                       (`presentation_decks.status` is
 *                       `CHECK (status IN ('draft','generating','ready',
 *                       'exported','failed'))`) driven through the REAL
 *                       `createNativeDeck`, proving the exact silent-INSERT-
 *                       failure defect documentsAdapter.ts's header documents
 *                       (createNativeDeck does NOT re-read its own INSERT the
 *                       way createWave5Artifact/materializeDocumentArtifact
 *                       do) — this adapter's own readback is the entire
 *                       defense, and this test is the proof.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as capabilityAdapterService from '../../capabilityAdapterService.js';
import * as artifactLinkService from '../../artifactLinkService.js';
import { getDocumentArtifact } from '../../../documentStudio/documentStudioService.js';
import { createNativeDeck as realCreateNativeDeck } from '../../../presentationGeneratorService.js';
import {
  DOCUMENT_CREATE_CAPABILITY_ID,
  DOCUMENT_CREATE_CAPABILITY_VERSION,
  PRESENTATION_CREATE_CAPABILITY_ID,
  PRESENTATION_CREATE_CAPABILITY_VERSION,
  buildDocumentCreateBinding,
  buildPresentationCreateBinding,
  documentCreateRegistrationInput,
  presentationCreateRegistrationInput,
  type DocumentsAdapterDeps,
  type PresentationAdapterDeps,
} from '../documentsAdapter.js';
import {
  buildEnvelope,
  seedCaseFixture,
  seedMember,
  seedMemberedUser,
  teardownCaseFixture,
} from '../../__tests__/adapters/_fixtures.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    const capabilities = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_capabilities'
          AND column_name IN ('capability_registry_id', 'capability_id', 'capability_version')`
    );
    const links = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_artifact_links'
          AND column_name IN ('link_id', 'case_id', 'artifact_type', 'artifact_id')`
    );
    const wave5 = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'wave5_artifacts'
          AND column_name IN ('artifact_id', 'organization_id', 'artifact_type', 'title')`
    );
    const decks = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'presentation_decks'
          AND column_name IN ('id', 'organization_id', 'title', 'status')`
    );
    return (
      Number(capabilities.rows[0]?.present ?? 0) === 3 &&
      Number(links.rows[0]?.present ?? 0) === 4 &&
      Number(wave5.rows[0]?.present ?? 0) === 4 &&
      Number(decks.rows[0]?.present ?? 0) === 4
    );
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[documentsAdapter pg suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres ` +
      `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, and the case ` +
      `workspace + wave5_artifacts + presentation_decks schema applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

// ---------------------------------------------------------------------------
// PRIVATE, per-run-unique capability ids — NOT the platform-global
// DOCUMENT_CREATE_CAPABILITY_ID / PRESENTATION_CREATE_CAPABILITY_ID
// constants.
//
// Cross-file collision proven (packet H1, 2026-08-12): `case_workspace_
// capabilities` is UNIQUE on (capability_id, capability_version) with NO
// organization scoping (capabilityRegistryService.ts:496). Vitest runs test
// FILES concurrently by default (server/vitest.config.ts sets no
// fileParallelism:false). `capabilityBootstrap.pg.test.ts`'s
// `deleteBuiltinCapabilityRows()` (its tests 1, 3-7) issues
// `DELETE FROM case_workspace_capabilities WHERE capability_id = $1` for
// BOTH `DOCUMENT_CREATE_CAPABILITY_ID` and `PRESENTATION_CREATE_CAPABILITY_ID`
// as pre-cleanup — a genuinely necessary step for ITS OWN "zero
// registrations" assertions against the REAL builtin ids
// `registerBuiltinCapabilityAdapters` uses at real process boot. When that
// delete lands between this file's `beforeAll` registering its row and this
// file's own tests reading it, this file's dispatch fails with
// `CAPABILITY_NOT_FOUND` (measured, reproduced 3/3 runs; DB readback showed
// the row's count flip 0->1 at registration then straight back to 0 mid-run,
// well before this file's own `afterAll` cleanup). `--no-file-parallelism`
// across all three files turns the suite green, confirming concurrency (not
// a product defect) is the vector.
//
// Fix: this file registers its OWN test rows under these private ids
// instead, so no other file's cleanup — targeted at the real, fixed builtin
// ids — can ever delete them, and this file's own dispatch never collides
// with another file's "zero registrations for the real id" assertion
// either. The registry/binding PLUMBING (registerCapabilityWithAdapter,
// registerCapabilityBinding) and the HANDLER code under test
// (buildDocumentCreateBinding/buildPresentationCreateBinding, both exported,
// unmodified production functions from documentsAdapter.ts) are identical to
// what the real ids use — only the capability_id STRING used as the
// registry/dispatch key is test-private. Same isolation shape as this
// program's already-fixed F2 defect (RESUME_HANDOFF_2026-08-12.md §5.1): two
// independent test files sharing one mutable, platform-global row, one of
// them mutating it while the other is mid-flight — fixed there by giving the
// mutating test its own disposable identity instead of the shared one.
const DOCUMENTS_ADAPTER_PG_TEST_RUN_ID = randomUUID();
const DOCUMENT_TEST_CAPABILITY_ID = `${DOCUMENT_CREATE_CAPABILITY_ID}.pgtest.${DOCUMENTS_ADAPTER_PG_TEST_RUN_ID}`;
const PRESENTATION_TEST_CAPABILITY_ID = `${PRESENTATION_CREATE_CAPABILITY_ID}.pgtest.${DOCUMENTS_ADAPTER_PG_TEST_RUN_ID}`;

function resetDocumentTestBinding(deps: DocumentsAdapterDeps = {}): void {
  capabilityAdapterService.registerCapabilityBinding(
    DOCUMENT_TEST_CAPABILITY_ID,
    DOCUMENT_CREATE_CAPABILITY_VERSION,
    buildDocumentCreateBinding(deps)
  );
}

function resetPresentationTestBinding(deps: PresentationAdapterDeps = {}): void {
  capabilityAdapterService.registerCapabilityBinding(
    PRESENTATION_TEST_CAPABILITY_ID,
    PRESENTATION_CREATE_CAPABILITY_VERSION,
    buildPresentationCreateBinding(deps)
  );
}

// ---------------------------------------------------------------------------
// Shared control pool + cleanup helpers (both capabilities write to tables
// `_fixtures.ts`'s `teardownCaseFixture` does not know about).
// ---------------------------------------------------------------------------

let control: Pool;

async function wave5CountForOrg(orgId: string): Promise<number> {
  const result = await control.query(`SELECT count(*)::int AS n FROM wave5_artifacts WHERE organization_id = $1`, [
    orgId,
  ]);
  return Number(result.rows[0]?.n ?? 0);
}

async function deckCountForOrg(orgId: string): Promise<number> {
  const result = await control.query(
    `SELECT count(*)::int AS n FROM presentation_decks WHERE organization_id = $1`,
    [orgId]
  );
  return Number(result.rows[0]?.n ?? 0);
}

async function cleanupDocumentsAndDecks(orgId: string): Promise<void> {
  await control.query(`DELETE FROM wave5_artifact_versions WHERE organization_id = $1`, [orgId]).catch(() => undefined);
  await control.query(`DELETE FROM wave5_artifacts WHERE organization_id = $1`, [orgId]).catch(() => undefined);
  await control
    .query(`DELETE FROM v8_artifact_origin_links WHERE organization_id = $1`, [orgId])
    .catch(() => undefined);
  await control.query(`DELETE FROM v8_output_artifacts WHERE organization_id = $1`, [orgId]).catch(() => undefined);
  await control.query(`DELETE FROM presentation_cards WHERE deck_id IN (
      SELECT id FROM presentation_decks WHERE organization_id = $1
    )`, [orgId]).catch(() => undefined);
  await control.query(`DELETE FROM presentation_decks WHERE organization_id = $1`, [orgId]).catch(() => undefined);
}

suite('documentsAdapter — Documents + Presentation create capabilities, dispatched end-to-end through executeCapability', () => {
  let registrarOrgId: string;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    registrarOrgId = `cwtest-adapter-registrar-docs-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      registrarOrgId,
      'Documents/Presentation adapter registrar org',
    ]);
    const registrarActorId = await seedMemberedUser(control, registrarOrgId, 'registrar', 'ADMIN');
    // Private test ids (see the block above this describe) — NOT
    // registerDocumentCreateCapability/registerPresentationCreateCapability,
    // which hard-code the platform-global DOCUMENT_CREATE_CAPABILITY_ID /
    // PRESENTATION_CREATE_CAPABILITY_ID. registerCapabilityWithAdapter is the
    // same production registration primitive those two helpers call
    // internally; only the capabilityId field of the input is overridden.
    await capabilityAdapterService.registerCapabilityWithAdapter(
      { ...documentCreateRegistrationInput(registrarActorId), capabilityId: DOCUMENT_TEST_CAPABILITY_ID },
      buildDocumentCreateBinding(),
      registrarOrgId
    );
    await capabilityAdapterService.registerCapabilityWithAdapter(
      { ...presentationCreateRegistrationInput(registrarActorId), capabilityId: PRESENTATION_TEST_CAPABILITY_ID },
      buildPresentationCreateBinding(),
      registrarOrgId
    );
  }, 60_000);

  afterAll(async () => {
    for (const capabilityId of [DOCUMENT_TEST_CAPABILITY_ID, PRESENTATION_TEST_CAPABILITY_ID]) {
      await control
        .query(
          `DELETE FROM case_workspace_capability_idempotency_keys
            WHERE capability_registry_id IN (
              SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_id = $1)`,
          [capabilityId]
        )
        .catch(() => undefined);
      await control
        .query(`DELETE FROM case_workspace_capabilities WHERE capability_id = $1`, [capabilityId])
        .catch(() => undefined);
    }
    await control
      .query(`DELETE FROM organization_members WHERE organization_id = $1`, [registrarOrgId])
      .catch(() => undefined);
    await control.query(`DELETE FROM users WHERE organization_id = $1`, [registrarOrgId]).catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [registrarOrgId]).catch(() => undefined);
    await control?.end().catch(() => undefined);
  }, 60_000);

  afterEach(() => {
    // Reset to the real, production bindings (rebound at THIS file's private
    // test ids — see the block above this describe) after any test that
    // injected a custom one — never let a stubbed dependency leak into the
    // next test.
    resetDocumentTestBinding();
    resetPresentationTestBinding();
  });

  // =========================================================================
  // DOCUMENTS
  // =========================================================================
  describe('case-workspace.documents.document.create', () => {
    function validPayload(caseId: string, overrides: Record<string, unknown> = {}) {
      return {
        caseId,
        title: 'Pilot expansion — Region B kickoff memo',
        description:
          'Region B pilot expansion approved for Q4. Scope covers three workstreams: pricing, ' +
          'logistics and local hiring. Steering committee expects a go/no-go decision by the ' +
          'end of the quarter based on the pilot store results.',
        documentType: 'executive_memo',
        // Documented finding: documentContentGenerator.enforceDocumentSchemaGrounding
        // localizes/redacts any "obviously English"-looking string when the
        // schema's own `language` is 'pl' (documentContentGenerator.ts's
        // `obviousEnglish` regex + `localizePolishValue`) — a genuine
        // language-CONSISTENCY guard, not a bug this adapter needs to defend
        // against. This test's description is English, so the payload's
        // language must agree with it for the content to survive un-redacted.
        language: 'en',
        ...overrides,
      };
    }

    it('creates a real wave5_artifacts row with real content and a real ACTIVE artifact link, readback agrees', async () => {
      const fixture = await seedCaseFixture(control, 'documents-success');
      try {
        const result = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DOCUMENT_TEST_CAPABILITY_ID,
            capabilityVersion: DOCUMENT_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: validPayload(fixture.caseId),
          })
        );

        expect(result.outcome).toBe('SUCCEEDED');
        expect(result.errorCode).toBeNull();
        const artifactId = result.output.artifactId as string;
        expect(typeof artifactId).toBe('string');
        expect(result.resultRef).toBe(`document:${artifactId}`);
        expect(result.output.deepLink).toBe(`/wordy?artifactId=${artifactId}`);
        expect((result.output.artifactLink as { linked: boolean }).linked).toBe(true);

        // Real row, read by the module's OWN service — not this suite's SELECT.
        const schema = await getDocumentArtifact(artifactId, fixture.orgId);
        expect(schema).not.toBeNull();
        expect(schema?.title).toBe('Pilot expansion — Region B kickoff memo');
        const serializedContent = JSON.stringify(schema?.sections ?? []);
        // The REAL content this test supplied, not a placeholder.
        expect(serializedContent).toContain('Region B pilot expansion');
        expect(await wave5CountForOrg(fixture.orgId)).toBe(1);

        const links = await artifactLinkService.listArtifactLinksForCase(
          fixture.caseId,
          { artifactType: 'document', linkStatus: 'ACTIVE' },
          fixture.actorId
        );
        expect(links).toHaveLength(1);
        expect(links[0].artifactId).toBe(artifactId);
        expect(links[0].relation).toBe('OUTPUT');
      } finally {
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);

    it('refuses a blank description and an actor with no case access, writing nothing', async () => {
      const fixture = await seedCaseFixture(control, 'documents-denial');
      const strangerOrgId = `cwtest-adapter-stranger-docs-${randomUUID()}`;
      let strangerActorId: string | null = null;
      try {
        const badInput = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DOCUMENT_TEST_CAPABILITY_ID,
            capabilityVersion: DOCUMENT_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: validPayload(fixture.caseId, { description: '   ' }),
          })
        );
        expect(badInput.outcome).toBe('FAILED');
        expect(badInput.errorCode).toBe('CAPABILITY_INPUT_INVALID');
        expect(await wave5CountForOrg(fixture.orgId)).toBe(0);

        await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
          strangerOrgId,
          'Documents adapter stranger org',
        ]);
        strangerActorId = await seedMemberedUser(control, strangerOrgId, 'stranger');

        const noAccess = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DOCUMENT_TEST_CAPABILITY_ID,
            capabilityVersion: DOCUMENT_CREATE_CAPABILITY_VERSION,
            orgId: strangerOrgId,
            actorId: strangerActorId,
            payload: validPayload(fixture.caseId),
          })
        );
        expect(noAccess.outcome).toBe('FAILED');
        expect(noAccess.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
        expect(await wave5CountForOrg(fixture.orgId)).toBe(0);
        expect(await wave5CountForOrg(strangerOrgId)).toBe(0);
      } finally {
        await control
          .query(`DELETE FROM organization_members WHERE organization_id = $1`, [strangerOrgId])
          .catch(() => undefined);
        await control.query(`DELETE FROM users WHERE organization_id = $1`, [strangerOrgId]).catch(() => undefined);
        await control.query(`DELETE FROM organizations WHERE id = $1`, [strangerOrgId]).catch(() => undefined);
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);

    it('suppresses a replayed idempotency key and still lets a fresh key recover after a rejected attempt', async () => {
      const fixture = await seedCaseFixture(control, 'documents-retry');
      try {
        const key1 = `idem-${randomUUID()}`;
        const first = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DOCUMENT_TEST_CAPABILITY_ID,
            capabilityVersion: DOCUMENT_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            idempotencyKey: key1,
            payload: validPayload(fixture.caseId),
          })
        );
        expect(first.outcome).toBe('SUCCEEDED');
        expect(await wave5CountForOrg(fixture.orgId)).toBe(1);

        const replay = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DOCUMENT_TEST_CAPABILITY_ID,
            capabilityVersion: DOCUMENT_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            idempotencyKey: key1,
            payload: validPayload(fixture.caseId),
          })
        );
        expect(replay.outcome).toBe('DUPLICATE_SUPPRESSED');
        expect(await wave5CountForOrg(fixture.orgId)).toBe(1);

        const key2 = `idem-${randomUUID()}`;
        const rejected = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DOCUMENT_TEST_CAPABILITY_ID,
            capabilityVersion: DOCUMENT_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            idempotencyKey: key2,
            payload: validPayload(fixture.caseId, { description: '' }),
          })
        );
        expect(rejected.outcome).toBe('FAILED');
        expect(await wave5CountForOrg(fixture.orgId)).toBe(1);

        const key3 = `idem-${randomUUID()}`;
        const second = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DOCUMENT_TEST_CAPABILITY_ID,
            capabilityVersion: DOCUMENT_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            idempotencyKey: key3,
            payload: validPayload(fixture.caseId, { title: 'A second, distinct memo' }),
          })
        );
        expect(second.outcome).toBe('SUCCEEDED');
        expect(second.output.artifactId).not.toBe(first.output.artifactId);
        expect(await wave5CountForOrg(fixture.orgId)).toBe(2);
      } finally {
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);

    it('still creates the document when the artifact-link step fails, surfaces it, and stays re-linkable', async () => {
      const fixture = await seedCaseFixture(control, 'documents-partial');
      try {
        resetDocumentTestBinding({
          linkArtifactToCase: async () => {
            throw new Error('injected_link_failure');
          },
        });

        const result = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DOCUMENT_TEST_CAPABILITY_ID,
            capabilityVersion: DOCUMENT_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: validPayload(fixture.caseId),
          })
        );

        expect(result.outcome).toBe('SUCCEEDED');
        const artifactId = result.output.artifactId as string;
        const artifactLink = result.output.artifactLink as { linked: boolean; error: string | null };
        expect(artifactLink.linked).toBe(false);
        expect(artifactLink.error).toBeTruthy();
        expect(JSON.stringify(artifactLink)).not.toContain('injected_link_failure');

        const schema = await getDocumentArtifact(artifactId, fixture.orgId);
        expect(schema).not.toBeNull();

        const linksBefore = await artifactLinkService.listArtifactLinksForCase(
          fixture.caseId,
          { artifactType: 'document', linkStatus: 'ACTIVE' },
          fixture.actorId
        );
        expect(linksBefore).toHaveLength(0);

        await artifactLinkService.linkArtifactToCase({
          caseId: fixture.caseId,
          artifactType: 'document',
          artifactId,
          relation: 'OUTPUT',
          linkedByActorId: fixture.actorId,
        });
        const linksAfter = await artifactLinkService.listArtifactLinksForCase(
          fixture.caseId,
          { artifactType: 'document', linkStatus: 'ACTIVE' },
          fixture.actorId
        );
        expect(linksAfter).toHaveLength(1);
        expect(linksAfter[0].artifactId).toBe(artifactId);
      } finally {
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);

    it('refuses when the envelope organizationId does not match the Case tenant, writing nothing', async () => {
      const fixture = await seedCaseFixture(control, 'documents-crosstenant');
      const otherOrgId = `cwtest-adapter-other-docs-${randomUUID()}`;
      try {
        await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
          otherOrgId,
          'Documents adapter other org',
        ]);
        await seedMember(control, otherOrgId, fixture.actorId, 'MEMBER');

        const result = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DOCUMENT_TEST_CAPABILITY_ID,
            capabilityVersion: DOCUMENT_CREATE_CAPABILITY_VERSION,
            orgId: otherOrgId,
            actorId: fixture.actorId,
            payload: validPayload(fixture.caseId),
          })
        );

        expect(result.outcome).toBe('FAILED');
        expect(result.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
        expect(await wave5CountForOrg(fixture.orgId)).toBe(0);
        expect(await wave5CountForOrg(otherOrgId)).toBe(0);
      } finally {
        await control
          .query(`DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`, [
            otherOrgId,
            fixture.actorId,
          ])
          .catch(() => undefined);
        await control.query(`DELETE FROM organizations WHERE id = $1`, [otherOrgId]).catch(() => undefined);
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);

    it('produces a resultRef and an artifact link that both resolve to the SAME object on repeated reads', async () => {
      const fixture = await seedCaseFixture(control, 'documents-deeplink');
      try {
        const result = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DOCUMENT_TEST_CAPABILITY_ID,
            capabilityVersion: DOCUMENT_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: validPayload(fixture.caseId),
          })
        );
        expect(result.outcome).toBe('SUCCEEDED');
        const artifactId = result.output.artifactId as string;
        expect(result.resultRef).toBe(`document:${artifactId}`);

        const readback1 = await getDocumentArtifact(artifactId, fixture.orgId);
        const readback2 = await getDocumentArtifact(artifactId, fixture.orgId);
        expect(readback1?.artifactId).toBe(artifactId);
        expect(readback2?.artifactId).toBe(artifactId);
        expect(readback1?.title).toBe(readback2?.title);

        const linksRead1 = await artifactLinkService.listArtifactLinksForCase(
          fixture.caseId,
          { artifactType: 'document', linkStatus: 'ACTIVE' },
          fixture.actorId
        );
        const linksRead2 = await artifactLinkService.listArtifactLinksForCase(
          fixture.caseId,
          { artifactType: 'document', linkStatus: 'ACTIVE' },
          fixture.actorId
        );
        expect(linksRead1).toHaveLength(1);
        expect(linksRead2).toHaveLength(1);
        expect(linksRead1[0].linkId).toBe(linksRead2[0].linkId);
      } finally {
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);

    it('[negative control] surfaces a failure instead of a false success when the create step reports an artifactId nothing wrote', async () => {
      const fixture = await seedCaseFixture(control, 'documents-negctrl');
      try {
        // documentStudioService.ts has no reachable CHECK/typed-column constraint
        // a caller value can violate (see documentsAdapter.ts's header) — every
        // wave5_artifacts column is untyped TEXT. So this simulates the exact
        // failure SHAPE (a "successful" create pointing at an id nothing wrote)
        // via dependency injection instead, proving THIS adapter's own second,
        // independent readback (not documentStudioService.ts's internal one)
        // actually gates the outcome.
        resetDocumentTestBinding({
          materializeDocumentArtifact: async () =>
            ({
              artifactId: `artifact-phantom-${randomUUID()}`,
              schema: {} as any,
            }) as any,
        });

        const result = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DOCUMENT_TEST_CAPABILITY_ID,
            capabilityVersion: DOCUMENT_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: validPayload(fixture.caseId),
          })
        );

        expect(result.outcome).toBe('FAILED');
        expect(result.errorCode).toBe('CAPABILITY_INTERNAL_ERROR');
        expect(await wave5CountForOrg(fixture.orgId)).toBe(0);
      } finally {
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);
  });

  // =========================================================================
  // PRESENTATION
  // =========================================================================
  describe('case-workspace.presentation.deck.create', () => {
    function validPayload(caseId: string, overrides: Record<string, unknown> = {}) {
      return {
        caseId,
        title: 'Region B pilot — steering committee kickoff',
        subtitle: 'Pricing, logistics and local hiring workstreams for the Q4 go/no-go decision',
        language: 'pl',
        confidentiality: 'confidential',
        theme: 'corporate',
        ...overrides,
      };
    }

    it('creates a real presentation_decks row with real content and a real ACTIVE artifact link, readback agrees', async () => {
      const fixture = await seedCaseFixture(control, 'presentation-success');
      try {
        const result = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: PRESENTATION_TEST_CAPABILITY_ID,
            capabilityVersion: PRESENTATION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: validPayload(fixture.caseId),
          })
        );

        expect(result.outcome).toBe('SUCCEEDED');
        expect(result.errorCode).toBeNull();
        const deckId = result.output.deckId as string;
        expect(typeof deckId).toBe('string');
        expect(result.resultRef).toBe(`presentation:${deckId}`);
        expect(result.output.deepLink).toBe(`/prezentacje?artifactId=${deckId}`);
        expect((result.output.artifactLink as { linked: boolean }).linked).toBe(true);
        expect(result.output.status).toBe('ready');

        const row = await control.query(
          `SELECT id, organization_id, title, status, deck_json FROM presentation_decks WHERE id = $1`,
          [deckId]
        );
        expect(row.rows).toHaveLength(1);
        expect(row.rows[0].organization_id).toBe(fixture.orgId);
        expect(row.rows[0].title).toBe('Region B pilot — steering committee kickoff');
        // The REAL subtitle text this test supplied, persisted into the
        // cover card's paragraph block — not a placeholder, not merely a
        // non-null deck_json.
        expect(String(row.rows[0].deck_json)).toContain('Q4 go/no-go decision');
        expect(await deckCountForOrg(fixture.orgId)).toBe(1);

        const links = await artifactLinkService.listArtifactLinksForCase(
          fixture.caseId,
          { artifactType: 'presentation', linkStatus: 'ACTIVE' },
          fixture.actorId
        );
        expect(links).toHaveLength(1);
        expect(links[0].artifactId).toBe(deckId);
        expect(links[0].relation).toBe('OUTPUT');
      } finally {
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);

    it('refuses a blank title and an actor with no case access, writing nothing', async () => {
      const fixture = await seedCaseFixture(control, 'presentation-denial');
      const strangerOrgId = `cwtest-adapter-stranger-pres-${randomUUID()}`;
      let strangerActorId: string | null = null;
      try {
        const badInput = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: PRESENTATION_TEST_CAPABILITY_ID,
            capabilityVersion: PRESENTATION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: validPayload(fixture.caseId, { title: '' }),
          })
        );
        expect(badInput.outcome).toBe('FAILED');
        expect(badInput.errorCode).toBe('CAPABILITY_INPUT_INVALID');
        expect(await deckCountForOrg(fixture.orgId)).toBe(0);

        await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
          strangerOrgId,
          'Presentation adapter stranger org',
        ]);
        strangerActorId = await seedMemberedUser(control, strangerOrgId, 'stranger');

        const noAccess = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: PRESENTATION_TEST_CAPABILITY_ID,
            capabilityVersion: PRESENTATION_CREATE_CAPABILITY_VERSION,
            orgId: strangerOrgId,
            actorId: strangerActorId,
            payload: validPayload(fixture.caseId),
          })
        );
        expect(noAccess.outcome).toBe('FAILED');
        expect(noAccess.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
        expect(await deckCountForOrg(fixture.orgId)).toBe(0);
        expect(await deckCountForOrg(strangerOrgId)).toBe(0);
      } finally {
        await control
          .query(`DELETE FROM organization_members WHERE organization_id = $1`, [strangerOrgId])
          .catch(() => undefined);
        await control.query(`DELETE FROM users WHERE organization_id = $1`, [strangerOrgId]).catch(() => undefined);
        await control.query(`DELETE FROM organizations WHERE id = $1`, [strangerOrgId]).catch(() => undefined);
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);

    it('suppresses a replayed idempotency key and still lets a fresh key recover after a rejected attempt', async () => {
      const fixture = await seedCaseFixture(control, 'presentation-retry');
      try {
        const key1 = `idem-${randomUUID()}`;
        const first = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: PRESENTATION_TEST_CAPABILITY_ID,
            capabilityVersion: PRESENTATION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            idempotencyKey: key1,
            payload: validPayload(fixture.caseId),
          })
        );
        expect(first.outcome).toBe('SUCCEEDED');
        expect(await deckCountForOrg(fixture.orgId)).toBe(1);

        const replay = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: PRESENTATION_TEST_CAPABILITY_ID,
            capabilityVersion: PRESENTATION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            idempotencyKey: key1,
            payload: validPayload(fixture.caseId),
          })
        );
        expect(replay.outcome).toBe('DUPLICATE_SUPPRESSED');
        expect(await deckCountForOrg(fixture.orgId)).toBe(1);

        const key2 = `idem-${randomUUID()}`;
        const rejected = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: PRESENTATION_TEST_CAPABILITY_ID,
            capabilityVersion: PRESENTATION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            idempotencyKey: key2,
            payload: validPayload(fixture.caseId, { title: '' }),
          })
        );
        expect(rejected.outcome).toBe('FAILED');
        expect(await deckCountForOrg(fixture.orgId)).toBe(1);

        const key3 = `idem-${randomUUID()}`;
        const second = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: PRESENTATION_TEST_CAPABILITY_ID,
            capabilityVersion: PRESENTATION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            idempotencyKey: key3,
            payload: validPayload(fixture.caseId, { title: 'A second, distinct deck' }),
          })
        );
        expect(second.outcome).toBe('SUCCEEDED');
        expect(second.output.deckId).not.toBe(first.output.deckId);
        expect(await deckCountForOrg(fixture.orgId)).toBe(2);
      } finally {
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);

    it('still creates the deck when the artifact-link step fails, surfaces it, and stays re-linkable', async () => {
      const fixture = await seedCaseFixture(control, 'presentation-partial');
      try {
        resetPresentationTestBinding({
          linkArtifactToCase: async () => {
            throw new Error('injected_link_failure');
          },
        });

        const result = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: PRESENTATION_TEST_CAPABILITY_ID,
            capabilityVersion: PRESENTATION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: validPayload(fixture.caseId),
          })
        );

        expect(result.outcome).toBe('SUCCEEDED');
        const deckId = result.output.deckId as string;
        const artifactLink = result.output.artifactLink as { linked: boolean; error: string | null };
        expect(artifactLink.linked).toBe(false);
        expect(artifactLink.error).toBeTruthy();
        expect(JSON.stringify(artifactLink)).not.toContain('injected_link_failure');

        const row = await control.query(`SELECT id FROM presentation_decks WHERE id = $1`, [deckId]);
        expect(row.rows).toHaveLength(1);

        const linksBefore = await artifactLinkService.listArtifactLinksForCase(
          fixture.caseId,
          { artifactType: 'presentation', linkStatus: 'ACTIVE' },
          fixture.actorId
        );
        expect(linksBefore).toHaveLength(0);

        await artifactLinkService.linkArtifactToCase({
          caseId: fixture.caseId,
          artifactType: 'presentation',
          artifactId: deckId,
          relation: 'OUTPUT',
          linkedByActorId: fixture.actorId,
        });
        const linksAfter = await artifactLinkService.listArtifactLinksForCase(
          fixture.caseId,
          { artifactType: 'presentation', linkStatus: 'ACTIVE' },
          fixture.actorId
        );
        expect(linksAfter).toHaveLength(1);
        expect(linksAfter[0].artifactId).toBe(deckId);
      } finally {
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);

    it('refuses when the envelope organizationId does not match the Case tenant, writing nothing', async () => {
      const fixture = await seedCaseFixture(control, 'presentation-crosstenant');
      const otherOrgId = `cwtest-adapter-other-pres-${randomUUID()}`;
      try {
        await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
          otherOrgId,
          'Presentation adapter other org',
        ]);
        await seedMember(control, otherOrgId, fixture.actorId, 'MEMBER');

        const result = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: PRESENTATION_TEST_CAPABILITY_ID,
            capabilityVersion: PRESENTATION_CREATE_CAPABILITY_VERSION,
            orgId: otherOrgId,
            actorId: fixture.actorId,
            payload: validPayload(fixture.caseId),
          })
        );

        expect(result.outcome).toBe('FAILED');
        expect(result.errorCode).toBe('CAPABILITY_UNAUTHORIZED');
        expect(await deckCountForOrg(fixture.orgId)).toBe(0);
        expect(await deckCountForOrg(otherOrgId)).toBe(0);
      } finally {
        await control
          .query(`DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`, [
            otherOrgId,
            fixture.actorId,
          ])
          .catch(() => undefined);
        await control.query(`DELETE FROM organizations WHERE id = $1`, [otherOrgId]).catch(() => undefined);
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);

    it('produces a resultRef and an artifact link that both resolve to the SAME object on repeated reads', async () => {
      const fixture = await seedCaseFixture(control, 'presentation-deeplink');
      try {
        const result = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: PRESENTATION_TEST_CAPABILITY_ID,
            capabilityVersion: PRESENTATION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: validPayload(fixture.caseId),
          })
        );
        expect(result.outcome).toBe('SUCCEEDED');
        const deckId = result.output.deckId as string;
        expect(result.resultRef).toBe(`presentation:${deckId}`);

        const read1 = await control.query(`SELECT id, title FROM presentation_decks WHERE id = $1`, [deckId]);
        const read2 = await control.query(`SELECT id, title FROM presentation_decks WHERE id = $1`, [deckId]);
        expect(read1.rows[0].id).toBe(deckId);
        expect(read2.rows[0].id).toBe(deckId);
        expect(read1.rows[0].title).toBe(read2.rows[0].title);

        const linksRead1 = await artifactLinkService.listArtifactLinksForCase(
          fixture.caseId,
          { artifactType: 'presentation', linkStatus: 'ACTIVE' },
          fixture.actorId
        );
        const linksRead2 = await artifactLinkService.listArtifactLinksForCase(
          fixture.caseId,
          { artifactType: 'presentation', linkStatus: 'ACTIVE' },
          fixture.actorId
        );
        expect(linksRead1).toHaveLength(1);
        expect(linksRead2).toHaveLength(1);
        expect(linksRead1[0].linkId).toBe(linksRead2[0].linkId);
      } finally {
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);

    // =======================================================================
    // BONUS negative control — a REAL Postgres CHECK-constraint violation.
    // `presentation_decks.status` is `CHECK (status IN ('draft','generating',
    // 'ready','exported','failed'))` (server/migrations/750_presentation_decks
    // _00base.sql). Driving `createNativeDeck` with a `status` value outside
    // that set makes the REAL `INSERT INTO presentation_decks` reject at the
    // database level. `createNativeDeck`'s own `dbRun` call has NO
    // `{fallback:false}` override and never inspects the write's returned
    // `{success}` before proceeding — so with the platform's default
    // `fallback:true`, that genuine failure is normally swallowed into
    // `{success:false}` with no throw, and `createNativeDeck` would return a
    // completely normal-looking result for a deck NOTHING wrote (see
    // documentsAdapter.ts's header for the full analysis — this is a WORSE,
    // less-defended instance of the same bug class financeAdapter.ts
    // documents for `financialModelingService.createModel`). This test
    // proves this adapter's own readback is the only thing standing between
    // that silent failure and a lying SUCCEEDED.
    //
    // The invalid status is injected via `deps.createNativeDeck` (a thin
    // wrapper around the REAL, imported `createNativeDeck`) rather than
    // through the adapter's public payload, because this adapter deliberately
    // does not expose `status` as caller input (Case-created decks are always
    // 'ready' — a correct design choice, not a gap) — see documentsAdapter.ts.
    // =======================================================================
    it('[negative control] surfaces a failure instead of a false success when the real INSERT violates the status CHECK constraint', async () => {
      const fixture = await seedCaseFixture(control, 'presentation-negctrl');
      try {
        resetPresentationTestBinding({
          createNativeDeck: (params) =>
            realCreateNativeDeck({
              ...params,
              // Not a member of presentation_decks' own CHECK (status IN (...)).
              status: 'definitely_not_a_real_status' as unknown as 'ready',
            }),
        });

        const result = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: PRESENTATION_TEST_CAPABILITY_ID,
            capabilityVersion: PRESENTATION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: validPayload(fixture.caseId),
          })
        );

        // MUST NOT be a lying SUCCEEDED — this is the whole point of the
        // adapter's post-create re-read guard.
        expect(result.outcome).toBe('FAILED');
        expect(result.errorCode).toBe('CAPABILITY_INTERNAL_ERROR');
        expect(await deckCountForOrg(fixture.orgId)).toBe(0);
      } finally {
        await cleanupDocumentsAndDecks(fixture.orgId);
        await teardownCaseFixture(control, fixture);
      }
    }, 90_000);
  });
});
