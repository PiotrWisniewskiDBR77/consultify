/**
 * Case Workspace — packet E1: proves `bootstrapCaseWorkspaceCapabilities`
 * (server/src/services/caseWorkspace/capabilityBootstrap.ts) is a SAFE config
 * loader for OD-CW-BOOTSTRAP-20260812, against a REAL PostgreSQL.
 *
 * This is deliberately NOT a rewrite of `capabilityBootWiring.pg.test.ts`
 * (which proves `registerBuiltinCapabilityAdapters` itself is idempotent
 * across boots and still ADMIN-gated). This file proves the layer ABOVE
 * that: the env-var loader + pre-flight authorization gate that decides
 * WHETHER `registerBuiltinCapabilityAdapters` gets called at all, and with
 * whose identity — the actual subject of OD-CW-BOOTSTRAP-20260812's "fail
 * closed, never fall back to the first ADMIN in the database" mandate.
 *
 * GATE — real database only, same convention as every other *.pg.test.ts:
 *   cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
 *   npx vitest run src/services/caseWorkspace/adapters/__tests__/capabilityBootstrap.pg.test.ts \
 *   --environment node --testTimeout=90000
 *
 * TEST MAP (packet brief's numbered list -> `it()` blocks below):
 *   1 + 2 + 10 -> "boot 1 registers... boot 2 re-registers... a real Decision
 *                  command's effect is verified via native-module readback"
 *                  (folded into ONE test, same convention
 *                  capabilityBootWiring.pg.test.ts already established, to
 *                  avoid THREE separate full 8-capability boot cycles against
 *                  a shared, contended Postgres).
 *   3  -> "missing actor id -> zero registrations (asserted on the database)"
 *   4  -> "missing org id -> zero registrations (asserted on the database)"
 *   5  -> "actor from a different organization -> refused"
 *   6  -> "actor with MEMBER role -> refused"
 *   7  -> "actor with REVOKED membership -> refused"
 *   8  -> "registry row without a binding -> not executable"
 *   9  -> "binding without a registry row -> not executable"
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as capabilityAdapterService from '../../capabilityAdapterService.js';
import type { InternalCommandBinding } from '../../capabilityAdapterService.js';
import * as capabilityRegistryService from '../../capabilityRegistryService.js';
import { getDecision } from '../../../decisionService.js';
import {
  bootstrapCaseWorkspaceCapabilities,
  CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID_ENV_VAR,
  CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID_ENV_VAR,
  loadCapabilityBootstrapConfig,
  type CapabilityBootstrapEnv,
} from '../../capabilityBootstrap.js';
import { DECISION_CREATE_CAPABILITY_ID, DECISION_CREATE_CAPABILITY_VERSION } from '../decisionAdapter.js';
import { INITIATIVE_CREATE_CAPABILITY_ID, INITIATIVE_CREATE_CAPABILITY_VERSION } from '../initiativeAdapter.js';
import { KPI_CREATE_CAPABILITY_ID, KPI_CREATE_CAPABILITY_VERSION } from '../kpiAdapter.js';
import { FINANCE_MODEL_CREATE_CAPABILITY_ID, FINANCE_MODEL_CREATE_CAPABILITY_VERSION } from '../financeAdapter.js';
import { ASSESSMENT_CREATE_CAPABILITY_ID, ASSESSMENT_CREATE_CAPABILITY_VERSION } from '../assessmentAdapter.js';
import {
  RESULTS_SCORECARD_CREATE_CAPABILITY_ID,
  RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
} from '../resultsAdapter.js';
import {
  DOCUMENT_CREATE_CAPABILITY_ID,
  DOCUMENT_CREATE_CAPABILITY_VERSION,
  PRESENTATION_CREATE_CAPABILITY_ID,
  PRESENTATION_CREATE_CAPABILITY_VERSION,
} from '../documentsAdapter.js';
import {
  buildEnvelope,
  seedCaseFixture,
  seedMemberedUser,
  seedUser,
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
          AND column_name IN ('capability_registry_id', 'capability_id', 'capability_version',
                              'provider_type', 'lifecycle', 'health')`
    );
    const decisions = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'decisions'
          AND column_name IN ('id', 'organization_id', 'decision_maker_id', 'title')`
    );
    return (
      Number(capabilities.rows[0]?.present ?? 0) === 6 &&
      Number(decisions.rows[0]?.present ?? 0) === 4
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
    `[capabilityBootstrap pg suite SKIPPED — clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, ` +
      `and the case workspace + decisions schema applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

// All 8 physical capability rows the 7 `register*Capability` calls inside
// `registerBuiltinCapabilityAdapters` produce (documentsAdapter's single
// combined call registers TWO rows: document + presentation).
const BUILTIN_CAPABILITIES: ReadonlyArray<{ id: string; version: string; label: string }> = [
  { id: DECISION_CREATE_CAPABILITY_ID, version: DECISION_CREATE_CAPABILITY_VERSION, label: 'decision' },
  { id: INITIATIVE_CREATE_CAPABILITY_ID, version: INITIATIVE_CREATE_CAPABILITY_VERSION, label: 'initiative' },
  { id: KPI_CREATE_CAPABILITY_ID, version: KPI_CREATE_CAPABILITY_VERSION, label: 'kpi' },
  { id: FINANCE_MODEL_CREATE_CAPABILITY_ID, version: FINANCE_MODEL_CREATE_CAPABILITY_VERSION, label: 'finance' },
  { id: ASSESSMENT_CREATE_CAPABILITY_ID, version: ASSESSMENT_CREATE_CAPABILITY_VERSION, label: 'assessment' },
  {
    id: RESULTS_SCORECARD_CREATE_CAPABILITY_ID,
    version: RESULTS_SCORECARD_CREATE_CAPABILITY_VERSION,
    label: 'results',
  },
  { id: DOCUMENT_CREATE_CAPABILITY_ID, version: DOCUMENT_CREATE_CAPABILITY_VERSION, label: 'document' },
  { id: PRESENTATION_CREATE_CAPABILITY_ID, version: PRESENTATION_CREATE_CAPABILITY_VERSION, label: 'presentation' },
];

suite('capabilityBootstrap — safe config loader for OD-CW-BOOTSTRAP-20260812', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // ---------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------

  async function deleteBuiltinCapabilityRows(): Promise<void> {
    for (const cap of BUILTIN_CAPABILITIES) {
      // eslint-disable-next-line no-await-in-loop
      await control
        .query(
          `DELETE FROM case_workspace_capability_idempotency_keys
            WHERE capability_registry_id IN (
              SELECT capability_registry_id FROM case_workspace_capabilities WHERE capability_id = $1)`,
          [cap.id]
        )
        .catch(() => undefined);
      // eslint-disable-next-line no-await-in-loop
      await control
        .query(`DELETE FROM case_workspace_capabilities WHERE capability_id = $1`, [cap.id])
        .catch(() => undefined);
    }
  }

  async function builtinCapabilityRowCount(id: string, version: string): Promise<number> {
    const result = await control.query(
      `SELECT count(*)::int AS n FROM case_workspace_capabilities WHERE capability_id = $1 AND capability_version = $2`,
      [id, version]
    );
    return Number(result.rows[0]?.n ?? 0);
  }

  async function builtinCapabilityRowState(
    id: string,
    version: string
  ): Promise<{ lifecycle: string; health: string } | null> {
    const result = await control.query<{ lifecycle: string; health: string }>(
      `SELECT lifecycle, health FROM case_workspace_capabilities WHERE capability_id = $1 AND capability_version = $2`,
      [id, version]
    );
    return result.rows[0] ?? null;
  }

  async function deleteOrg(orgId: string): Promise<void> {
    await control.query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId]).catch(() => undefined);
    await control.query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId]).catch(() => undefined);
    await control.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]).catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
  }

  async function seedOrg(label: string): Promise<string> {
    const orgId = `cwtest-e1-loader-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      orgId,
      `E1 loader test org (${label})`,
    ]);
    return orgId;
  }

  // ===========================================================================
  // 1 + 2 + 10 — happy path across two boots, with a real, verified effect.
  // ===========================================================================
  it(
    '1: correct bootstrap registers all 8 builtin capability rows and each is genuinely ' +
      'reachable; 10: a real Decision command lands, proven via native-module readback; ' +
      '2: a second boot against the same database produces zero duplicate rows and stays reachable',
    async () => {
      const registrarOrgId = await seedOrg('registrar');
      const registrarActorId = await seedMemberedUser(control, registrarOrgId, 'registrar', 'ADMIN');
      const fixture = await seedCaseFixture(control, 'e1-loader-happy');
      const env: CapabilityBootstrapEnv = {
        [CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID_ENV_VAR]: registrarActorId,
        [CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID_ENV_VAR]: registrarOrgId,
      };

      async function assertAllReachableViaInputRejection(): Promise<void> {
        for (const cap of BUILTIN_CAPABILITIES) {
          // eslint-disable-next-line no-await-in-loop
          const result = await capabilityAdapterService.executeCapability(
            buildEnvelope({
              capabilityId: cap.id,
              capabilityVersion: cap.version,
              orgId: fixture.orgId,
              actorId: fixture.actorId,
              payload: {}, // deliberately empty — proves the call reached the
              // adapter's OWN input validation (CAPABILITY_INPUT_INVALID),
              // not "capability not found"/"capability unavailable", which is
              // exactly what "genuinely reachable" means at the registry+
              // binding layer this packet is responsible for.
            })
          );
          expect(result.outcome, `${cap.label} reachability`).toBe('FAILED');
          expect(result.errorCode, `${cap.label} reachability`).toBe('CAPABILITY_INPUT_INVALID');
        }
      }

      try {
        // Defensive pre-cleanup: a previous crashed run of this file, or of
        // capabilityBootWiring.pg.test.ts, could have left these
        // platform-global rows behind.
        await deleteBuiltinCapabilityRows();
        capabilityAdapterService.clearCapabilityBindings();

        // ---- BOOT 1 -----------------------------------------------------
        const boot1 = await bootstrapCaseWorkspaceCapabilities(env);
        expect(boot1.status).toBe('REGISTERED');
        expect(boot1.attempted).toBe(true);

        for (const cap of BUILTIN_CAPABILITIES) {
          // eslint-disable-next-line no-await-in-loop
          expect(await builtinCapabilityRowCount(cap.id, cap.version), cap.label).toBe(1);
          // eslint-disable-next-line no-await-in-loop
          const state = await builtinCapabilityRowState(cap.id, cap.version);
          expect(state?.lifecycle, cap.label).toBe('ACTIVE');
          expect(state?.health, cap.label).toBe('HEALTHY');
        }

        // Requirement 1: all eight are genuinely reachable.
        await assertAllReachableViaInputRejection();

        // Requirement 10: ONE real, successful command, verified against the
        // native module directly (not merely "an id came back").
        const createResult = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DECISION_CREATE_CAPABILITY_ID,
            capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: {
              caseId: fixture.caseId,
              title: 'E1 loader boot 1: go/no-go on pilot expansion',
              type: 'GO_NO_GO',
              decisionMakerId: fixture.actorId,
            },
          })
        );
        expect(createResult.outcome).toBe('SUCCEEDED');
        const firstDecisionId = createResult.output.decisionId as string;
        expect(typeof firstDecisionId).toBe('string');
        const firstNative = await getDecision(firstDecisionId);
        expect(firstNative?.title).toBe('E1 loader boot 1: go/no-go on pilot expansion');
        expect(firstNative?.organizationId).toBe(fixture.orgId);

        // ---- Simulate a real process restart -----------------------------
        capabilityAdapterService.clearCapabilityBindings();
        const betweenBoots = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DECISION_CREATE_CAPABILITY_ID,
            capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: {
              caseId: fixture.caseId,
              title: 'Should not be reachable between boots',
              type: 'GO_NO_GO',
              decisionMakerId: fixture.actorId,
            },
          })
        );
        expect(betweenBoots.outcome).toBe('FAILED');
        expect(betweenBoots.errorCode).toBe('CAPABILITY_UNAVAILABLE');

        // ---- BOOT 2, same database, same configured identity ------------
        const boot2 = await bootstrapCaseWorkspaceCapabilities(env);
        expect(boot2.status).toBe('REGISTERED');
        expect(boot2.attempted).toBe(true);

        // Requirement 2: zero duplicate rows.
        for (const cap of BUILTIN_CAPABILITIES) {
          // eslint-disable-next-line no-await-in-loop
          expect(await builtinCapabilityRowCount(cap.id, cap.version), `${cap.label} after boot 2`).toBe(1);
        }

        // Requirement 2: still reachable, dispatching through the binding
        // BOOT 2 itself re-established.
        await assertAllReachableViaInputRejection();

        const secondCreateResult = await capabilityAdapterService.executeCapability(
          buildEnvelope({
            capabilityId: DECISION_CREATE_CAPABILITY_ID,
            capabilityVersion: DECISION_CREATE_CAPABILITY_VERSION,
            orgId: fixture.orgId,
            actorId: fixture.actorId,
            payload: {
              caseId: fixture.caseId,
              title: 'E1 loader boot 2: go/no-go on pilot expansion',
              type: 'GO_NO_GO',
              decisionMakerId: fixture.actorId,
            },
          })
        );
        expect(secondCreateResult.outcome).toBe('SUCCEEDED');
        const secondDecisionId = secondCreateResult.output.decisionId as string;
        expect(secondDecisionId).not.toBe(firstDecisionId);
        const secondNative = await getDecision(secondDecisionId);
        expect(secondNative?.title).toBe('E1 loader boot 2: go/no-go on pilot expansion');
      } finally {
        await teardownCaseFixture(control, fixture);
        await deleteBuiltinCapabilityRows();
        await deleteOrg(registrarOrgId);
        capabilityAdapterService.clearCapabilityBindings();
      }
    },
    240_000
  );

  // ===========================================================================
  // 3 — missing actor id.
  // ===========================================================================
  it('3: missing actor id -> bootstrap skips, zero registrations (asserted on the database)', async () => {
    await deleteBuiltinCapabilityRows();
    capabilityAdapterService.clearCapabilityBindings();

    const env: CapabilityBootstrapEnv = {
      [CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID_ENV_VAR]: `cwtest-e1-loader-missing-actor-${randomUUID()}`,
      // ACTOR_ID_ENV_VAR deliberately absent.
    };

    // Sanity on the pure loader itself.
    const config = loadCapabilityBootstrapConfig(env);
    expect(config.actorId).toBeNull();

    const result = await bootstrapCaseWorkspaceCapabilities(env);
    expect(result.status).toBe('SKIPPED_MISSING_CONFIG');
    expect(result.attempted).toBe(false);

    for (const cap of BUILTIN_CAPABILITIES) {
      // eslint-disable-next-line no-await-in-loop
      expect(await builtinCapabilityRowCount(cap.id, cap.version), cap.label).toBe(0);
    }
  });

  // ===========================================================================
  // 4 — missing org id.
  // ===========================================================================
  it('4: missing org id -> bootstrap skips, zero registrations (asserted on the database)', async () => {
    await deleteBuiltinCapabilityRows();
    capabilityAdapterService.clearCapabilityBindings();

    const env: CapabilityBootstrapEnv = {
      [CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID_ENV_VAR]: `cwtest-e1-loader-missing-org-${randomUUID()}`,
      // ORG_ID_ENV_VAR deliberately absent.
    };

    const config = loadCapabilityBootstrapConfig(env);
    expect(config.orgId).toBeNull();

    const result = await bootstrapCaseWorkspaceCapabilities(env);
    expect(result.status).toBe('SKIPPED_MISSING_CONFIG');
    expect(result.attempted).toBe(false);

    for (const cap of BUILTIN_CAPABILITIES) {
      // eslint-disable-next-line no-await-in-loop
      expect(await builtinCapabilityRowCount(cap.id, cap.version), cap.label).toBe(0);
    }
  });

  // ===========================================================================
  // 5 — actor from a DIFFERENT organization.
  // ===========================================================================
  it('5: actor from a different organization is refused, zero registrations', async () => {
    const targetOrgId = await seedOrg('mismatch-target');
    const otherOrgId = await seedOrg('mismatch-other');
    const actorId = await seedMemberedUser(control, otherOrgId, 'admin-elsewhere', 'ADMIN');

    try {
      await deleteBuiltinCapabilityRows();
      capabilityAdapterService.clearCapabilityBindings();

      const env: CapabilityBootstrapEnv = {
        [CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID_ENV_VAR]: actorId,
        [CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID_ENV_VAR]: targetOrgId, // actor has NO membership here
      };

      const result = await bootstrapCaseWorkspaceCapabilities(env);
      expect(result.status).toBe('REFUSED_NOT_ORG_MEMBER');
      expect(result.attempted).toBe(false);

      for (const cap of BUILTIN_CAPABILITIES) {
        // eslint-disable-next-line no-await-in-loop
        expect(await builtinCapabilityRowCount(cap.id, cap.version), cap.label).toBe(0);
      }
    } finally {
      await deleteOrg(targetOrgId);
      await deleteOrg(otherOrgId);
      capabilityAdapterService.clearCapabilityBindings();
    }
  });

  // ===========================================================================
  // 6 — actor with MEMBER role (below ADMIN).
  // ===========================================================================
  it('6: actor with MEMBER role is refused, zero registrations', async () => {
    const orgId = await seedOrg('member-role');
    const actorId = await seedMemberedUser(control, orgId, 'plain-member', 'MEMBER');

    try {
      await deleteBuiltinCapabilityRows();
      capabilityAdapterService.clearCapabilityBindings();

      const env: CapabilityBootstrapEnv = {
        [CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID_ENV_VAR]: actorId,
        [CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID_ENV_VAR]: orgId,
      };

      const result = await bootstrapCaseWorkspaceCapabilities(env);
      expect(result.status).toBe('REFUSED_INSUFFICIENT_ROLE');
      expect(result.attempted).toBe(false);

      for (const cap of BUILTIN_CAPABILITIES) {
        // eslint-disable-next-line no-await-in-loop
        expect(await builtinCapabilityRowCount(cap.id, cap.version), cap.label).toBe(0);
      }
    } finally {
      await deleteOrg(orgId);
      capabilityAdapterService.clearCapabilityBindings();
    }
  });

  // ===========================================================================
  // 7 — actor with REVOKED membership.
  // ===========================================================================
  it('7: actor with REVOKED membership is refused, zero registrations', async () => {
    const orgId = await seedOrg('revoked');
    const userId = await seedUser(control, orgId, 'revoked-admin');
    // Deliberately NOT seedMember (which always inserts status='ACTIVE') —
    // insert directly with status='REVOKED', role='ADMIN', so the only thing
    // wrong with this actor is the membership status.
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'ADMIN', 'REVOKED')`,
      [`cwtest-e1-loader-revoked-member-${randomUUID()}`, orgId, userId]
    );

    try {
      await deleteBuiltinCapabilityRows();
      capabilityAdapterService.clearCapabilityBindings();

      const env: CapabilityBootstrapEnv = {
        [CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID_ENV_VAR]: userId,
        [CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID_ENV_VAR]: orgId,
      };

      const result = await bootstrapCaseWorkspaceCapabilities(env);
      // caseWorkspaceAuthContext.ts's own design collapses "no row" and "row
      // present but not ACTIVE" into the same not_org_member refusal — this
      // loader mirrors that verbatim rather than inventing a new distinction.
      expect(result.status).toBe('REFUSED_NOT_ORG_MEMBER');
      expect(result.attempted).toBe(false);

      for (const cap of BUILTIN_CAPABILITIES) {
        // eslint-disable-next-line no-await-in-loop
        expect(await builtinCapabilityRowCount(cap.id, cap.version), cap.label).toBe(0);
      }
    } finally {
      await deleteOrg(orgId);
      capabilityAdapterService.clearCapabilityBindings();
    }
  });

  // ===========================================================================
  // 8 — a registry row WITHOUT a binding is not executable.
  // ===========================================================================
  it('8: a registry row without a binding is not executable', async () => {
    const orgId = await seedOrg('row-only');
    const adminActorId = await seedMemberedUser(control, orgId, 'row-only-admin', 'ADMIN');
    const capabilityId = `cwtest-e1-loader-row-only-${randomUUID()}`;
    const capabilityVersion = '1.0.0';

    try {
      capabilityAdapterService.clearCapabilityBindings();

      // Registry row created directly via capabilityRegistryService — NEVER
      // through registerCapabilityWithAdapter, so NO binding is ever set for
      // this capability id.
      await capabilityRegistryService.registerCapability(
        {
          capabilityId,
          capabilityVersion,
          ownerModule: 'case-workspace',
          providerType: 'INTERNAL',
          operation: 'testRowOnlyOperation',
          owningCommandRef: 'command:test-row-only',
          inputSchemaRef: 'schema:test-row-only-input@1',
          outputSchemaRef: 'schema:test-row-only-output@1',
          operationClass: 'MUTATE',
          effectClass: 'SAFE_ADDITIVE',
          dataClassification: 'INTERNAL',
          idempotencyStrategy: 'CLIENT_KEY',
          reversibility: 'REVERSIBLE',
          approvalRecommendation: 'auto_executable',
          timeoutDefaults: { defaultMs: 5_000 },
          lifecycle: 'ACTIVE',
          health: 'HEALTHY',
          createdByActorId: adminActorId,
        },
        orgId
      );

      expect(await builtinRowCountFor(capabilityId, capabilityVersion)).toBe(1);

      const execResult = await capabilityAdapterService.executeCapability({
        capabilityId,
        capabilityVersion,
        organizationId: orgId,
        actor: { type: 'HUMAN', actorId: adminActorId },
        idempotencyKey: `idem-${randomUUID()}`,
        payload: {},
      });
      expect(execResult.outcome).toBe('FAILED');
      expect(execResult.errorCode).toBe('CAPABILITY_UNAVAILABLE');
    } finally {
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
      await deleteOrg(orgId);
      capabilityAdapterService.clearCapabilityBindings();
    }

    async function builtinRowCountFor(id: string, version: string): Promise<number> {
      const result = await control.query(
        `SELECT count(*)::int AS n FROM case_workspace_capabilities WHERE capability_id = $1 AND capability_version = $2`,
        [id, version]
      );
      return Number(result.rows[0]?.n ?? 0);
    }
  });

  // ===========================================================================
  // 9 — a binding WITHOUT a registry row is not executable.
  // ===========================================================================
  it('9: a binding without a registry row is not executable', async () => {
    const orgId = await seedOrg('binding-only');
    const adminActorId = await seedMemberedUser(control, orgId, 'binding-only-admin', 'ADMIN');
    const capabilityId = `cwtest-e1-loader-binding-only-${randomUUID()}`;
    const capabilityVersion = '1.0.0';

    try {
      capabilityAdapterService.clearCapabilityBindings();

      const binding: InternalCommandBinding = {
        kind: 'INTERNAL',
        async handler() {
          return { output: { shouldNeverRun: true } };
        },
      };
      // Bind-only primitive — deliberately never followed by
      // registerCapability, so NO registry row exists for this capability id.
      capabilityAdapterService.registerCapabilityBinding(capabilityId, capabilityVersion, binding);

      const rowCount = await control.query(
        `SELECT count(*)::int AS n FROM case_workspace_capabilities WHERE capability_id = $1`,
        [capabilityId]
      );
      expect(Number(rowCount.rows[0]?.n ?? 0)).toBe(0);

      const execResult = await capabilityAdapterService.executeCapability({
        capabilityId,
        capabilityVersion,
        organizationId: orgId,
        actor: { type: 'HUMAN', actorId: adminActorId },
        idempotencyKey: `idem-${randomUUID()}`,
        payload: {},
      });
      expect(execResult.outcome).toBe('FAILED');
      expect(execResult.errorCode).toBe('CAPABILITY_NOT_FOUND');
    } finally {
      await deleteOrg(orgId);
      capabilityAdapterService.clearCapabilityBindings();
    }
  });
});
