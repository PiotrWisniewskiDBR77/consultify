/**
 * Case Workspace — CAPABILITY ADAPTERS, proved against a REAL PostgreSQL.
 * Exercises server/src/services/caseWorkspace/capabilityAdapterService.ts
 * against the registry owned by capabilityRegistryService.ts
 * (doc 05 §5 "Adapter and module ownership contract", doc 06 §8).
 *
 * ===========================================================================
 * GATE — this suite touches a real database, never a mock
 * ===========================================================================
 * `NODE_ENV=test` ALONE is a trap (Database.ts returns an in-memory MOCK unless
 * RUN_DB_TESTS=1 and MOCK_DB=false). Same gate and same loud skip as every
 * other `*.pg.test.ts` here.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://<user>@localhost:5432/<db> \
 *   npx vitest run server/src/services/caseWorkspace/__tests__/capabilityAdapterService.pg.test.ts \
 *   --environment node
 *
 * ===========================================================================
 * WHAT THESE TESTS TRY TO DISPROVE
 * ===========================================================================
 * 1. That the taxonomy actually LEAKS NOTHING — the HTTP adapter is fed a
 *    provider error body containing a bearer token and a client name, and the
 *    ENTIRE returned result plus the durable audit event are searched for
 *    those strings. A stable code that still carries the vendor's prose would
 *    pass a code-only assertion; this one would not.
 * 2. That the timeout is enforced by US, not hoped for — the fake transport
 *    never resolves, and the call must still return a mapped CAPABILITY_TIMEOUT
 *    well inside the test's own budget.
 * 3. That idempotency runs BEFORE dispatch — the duplicate call must not reach
 *    the handler at all (asserted by counting invocations), because a check
 *    that runs afterwards merely labels a double effect instead of preventing it.
 * 4. That an UNKNOWN outcome is not silently marked retryable — TIMEOUT and
 *    TRANSPORT_ERROR must demand readback reconciliation (doc 06 §8) unless the
 *    binding declares a provider idempotency header.
 *
 * No network is ever touched: the HTTP adapter takes an injected `fetchImpl`.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import * as capabilityAdapterService from '../capabilityAdapterService.js';
import type { CapabilityExecutionEnvelope } from '../capabilityAdapterService.js';

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
    const idem = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_capability_idempotency_keys'
          AND column_name IN ('idempotency_record_id', 'capability_registry_id',
                              'idempotency_key', 'request_digest')`
    );
    return (
      Number(capabilities.rows[0]?.present ?? 0) === 6 && Number(idem.rows[0]?.present ?? 0) === 4
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
    `[capabilityAdapterService pg suite SKIPPED — clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL, ` +
      `and the case workspace capability-registry migration applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

/** The two strings that must never survive anywhere. */
const LEAK_TOKEN = 'Bearer sk-live-ABC123SECRET';
const LEAK_CLIENT = 'Acme Manufacturing Sp. z o.o.';

suite('capabilityAdapterService — InternalCommand + HttpApi adapters against a real PostgreSQL (doc 05 §5)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  afterEach(() => {
    capabilityAdapterService.clearCapabilityBindings();
  });

  // -------------------------------------------------------------------------
  // Fixtures — registerCapability requires an ADMIN member of the caller org.
  // -------------------------------------------------------------------------

  async function seedAdminOrg(label: string): Promise<{ orgId: string; adminId: string }> {
    const suffix = randomUUID();
    const orgId = `case-adapter-org-${label}-${suffix}`;
    await control.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [orgId, `Adapter test org (${label})`]
    );
    const adminId = `case-adapter-admin-${label}-${suffix}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      adminId,
      orgId,
      `${adminId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE')`,
      [`case-adapter-member-${randomUUID()}`, orgId, adminId]
    );
    return { orgId, adminId };
  }

  function registrationInput(params: {
    capabilityId: string;
    providerType: 'INTERNAL' | 'HTTP_API';
    adminId: string;
  }) {
    return {
      capabilityId: params.capabilityId,
      capabilityVersion: '1.0.0',
      ownerModule: 'case-workspace',
      providerType: params.providerType,
      operation: 'testOperation',
      owningCommandRef: 'command:test',
      inputSchemaRef: 'schema:test-input@1',
      outputSchemaRef: 'schema:test-output@1',
      operationClass: 'MUTATE' as const,
      effectClass: 'SAFE_ADDITIVE' as const,
      dataClassification: 'INTERNAL',
      idempotencyStrategy: 'CLIENT_KEY',
      reversibility: 'REVERSIBLE',
      // ApprovalClassValues from server/src/types/executionSpine.ts — the
      // registry validates against that shared vocabulary, not a local one.
      approvalRecommendation: 'auto_executable' as const,
      timeoutDefaults: { defaultMs: 5_000 },
      // ACTIVE + HEALTHY, so the lifecycle/health gate is not what is being
      // measured in the tests that follow.
      lifecycle: 'ACTIVE' as const,
      health: 'HEALTHY' as const,
      createdByActorId: params.adminId,
    };
  }

  function envelope(params: {
    capabilityId: string;
    orgId: string;
    actorId: string;
    idempotencyKey?: string;
    payload?: Record<string, unknown>;
    timeoutMs?: number;
  }): CapabilityExecutionEnvelope {
    return {
      capabilityId: params.capabilityId,
      capabilityVersion: '1.0.0',
      organizationId: params.orgId,
      actor: { type: 'SYSTEM', actorId: params.actorId },
      idempotencyKey: params.idempotencyKey ?? `idem-${randomUUID()}`,
      payload: params.payload ?? { input: 'value' },
      timeoutMs: params.timeoutMs,
    };
  }

  async function teardown(orgId: string, capabilityIds: string[]): Promise<void> {
    for (const capabilityId of capabilityIds) {
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
      .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId])
      .catch(() => undefined);
    await control
      .query(`DELETE FROM users WHERE organization_id = $1`, [orgId])
      .catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
  }

  /**
   * INVOCATION events only. capabilityRegistryService.registerCapability emits
   * its own `capability.registered` against the SAME aggregate id, so an
   * unfiltered read would count the registration as an invocation and make
   * "exactly one audit row per call" untestable.
   */
  async function readOutboxForCapability(capabilityId: string): Promise<
    Array<{ event_type: string; redacted_summary: Record<string, unknown>; payload_ref: string | null }>
  > {
    const result = await control.query(
      `SELECT o.event_type, o.redacted_summary, o.payload_ref
         FROM case_workspace_event_outbox o
         JOIN case_workspace_capabilities c
           ON c.capability_registry_id = o.aggregate_id
        WHERE c.capability_id = $1 AND o.aggregate_type = 'CAPABILITY'
          AND o.event_type IN ('capability.invoked', 'capability.invocation_failed')
        ORDER BY o.created_at ASC`,
      [capabilityId]
    );
    return result.rows as Array<{
      event_type: string;
      redacted_summary: Record<string, unknown>;
      payload_ref: string | null;
    }>;
  }

  // =========================================================================
  // 1. InternalCommandAdapter — happy path, registration through the public
  //    registry API, and an audit event.
  // =========================================================================
  it('registers an INTERNAL capability through capabilityRegistryService and executes it through the shared envelope', async () => {
    const { orgId, adminId } = await seedAdminOrg('internal-ok');
    const capabilityId = `cap-internal-${randomUUID()}`;
    try {
      let seenPayload: Record<string, unknown> | null = null;
      const entry = await capabilityAdapterService.registerCapabilityWithAdapter(
        registrationInput({ capabilityId, providerType: 'INTERNAL', adminId }),
        {
          kind: 'INTERNAL',
          handler: async (payload) => {
            seenPayload = payload;
            return { output: { ok: true, echoed: payload.input }, resultRef: 'artifact:result-1' };
          },
        },
        orgId
      );
      // The row really is in the registry's own table — no shadow store.
      const registryRow = await control.query(
        `SELECT capability_registry_id, provider_type FROM case_workspace_capabilities
          WHERE capability_id = $1`,
        [capabilityId]
      );
      expect(registryRow.rows).toHaveLength(1);
      expect(registryRow.rows[0].capability_registry_id).toBe(entry.capabilityRegistryId);
      expect(registryRow.rows[0].provider_type).toBe('INTERNAL');

      const result = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId, orgId, actorId: adminId, payload: { input: 'hello' } })
      );

      expect(result.outcome).toBe('SUCCEEDED');
      expect(result.errorCode).toBeNull();
      expect(result.errorDetailRef).toBeNull();
      expect(result.output).toEqual({ ok: true, echoed: 'hello' });
      expect(result.resultRef).toBe('artifact:result-1');
      expect(seenPayload).toEqual({ input: 'hello' });

      const events = await readOutboxForCapability(capabilityId);
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('capability.invoked');
      expect(events[0].redacted_summary.outcome).toBe('SUCCEEDED');
    } finally {
      await teardown(orgId, [capabilityId]);
    }
  }, 90_000);

  // =========================================================================
  // 2. Idempotency runs BEFORE dispatch.
  // =========================================================================
  it('suppresses a replayed idempotency key WITHOUT invoking the handler a second time', async () => {
    const { orgId, adminId } = await seedAdminOrg('idem');
    const capabilityId = `cap-idem-${randomUUID()}`;
    try {
      let invocations = 0;
      await capabilityAdapterService.registerCapabilityWithAdapter(
        registrationInput({ capabilityId, providerType: 'INTERNAL', adminId }),
        {
          kind: 'INTERNAL',
          handler: async () => {
            invocations += 1;
            return { output: { done: true } };
          },
        },
        orgId
      );

      const idempotencyKey = `idem-${randomUUID()}`;
      const first = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId, orgId, actorId: adminId, idempotencyKey })
      );
      expect(first.outcome).toBe('SUCCEEDED');
      expect(invocations).toBe(1);

      const second = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId, orgId, actorId: adminId, idempotencyKey })
      );
      expect(second.outcome).toBe('DUPLICATE_SUPPRESSED');
      // The whole point: the provider was never reached the second time.
      expect(invocations).toBe(1);

      // Same key, DIFFERENT payload is a caller bug, not a duplicate — it must
      // not silently suppress genuinely different work.
      const conflicting = await capabilityAdapterService.executeCapability(
        envelope({
          capabilityId,
          orgId,
          actorId: adminId,
          idempotencyKey,
          payload: { input: 'different' },
        })
      );
      expect(conflicting.outcome).toBe('FAILED');
      expect(conflicting.errorCode).toBe('CAPABILITY_INPUT_INVALID');
      expect(invocations).toBe(1);
    } finally {
      await teardown(orgId, [capabilityId]);
    }
  }, 90_000);

  // =========================================================================
  // 3. HTTP adapter — a provider error is mapped to a stable code and its body
  //    NEVER leaves this process.
  // =========================================================================
  it('maps an HTTP 500 to a stable code and leaks no part of the provider body into the result or the audit event', async () => {
    const { orgId, adminId } = await seedAdminOrg('http-error');
    const capabilityId = `cap-http-err-${randomUUID()}`;
    try {
      const poisonBody = JSON.stringify({
        message: `upstream failure while authorizing ${LEAK_TOKEN} for ${LEAK_CLIENT}`,
        stack: 'at Vendor.handler (/srv/vendor/app.js:42)',
      });
      await capabilityAdapterService.registerCapabilityWithAdapter(
        registrationInput({ capabilityId, providerType: 'HTTP_API', adminId }),
        {
          kind: 'HTTP_API',
          method: 'POST',
          url: 'https://vendor.invalid/api/do',
          fetchImpl: (async () =>
            new Response(poisonBody, { status: 500 })) as unknown as typeof fetch,
        },
        orgId
      );

      const result = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId, orgId, actorId: adminId })
      );

      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_REMOTE_ERROR');
      // The detail is a digest, and only a digest.
      expect(result.errorDetailRef).toMatch(/^sha256:[0-9a-f]{32}$/);
      expect(result.output).toEqual({});

      // Search the ENTIRE serialized result — not just the fields we expected
      // to be dangerous.
      const serializedResult = JSON.stringify(result);
      expect(serializedResult).not.toContain(LEAK_TOKEN);
      expect(serializedResult).not.toContain(LEAK_CLIENT);
      expect(serializedResult).not.toContain('vendor/app.js');
      expect(serializedResult).not.toContain('upstream failure');

      // And search what actually landed in the durable audit row.
      const events = await readOutboxForCapability(capabilityId);
      expect(events).toHaveLength(1);
      expect(events[0].event_type).toBe('capability.invocation_failed');
      expect(events[0].redacted_summary.errorCode).toBe('CAPABILITY_REMOTE_ERROR');
      const serializedEvent = JSON.stringify(events[0]);
      expect(serializedEvent).not.toContain(LEAK_TOKEN);
      expect(serializedEvent).not.toContain(LEAK_CLIENT);
      expect(serializedEvent).not.toContain('upstream failure');
      // The event's pointer is the same digest, never the text.
      expect(events[0].payload_ref).toBe(result.errorDetailRef);
    } finally {
      await teardown(orgId, [capabilityId]);
    }
  }, 90_000);

  // =========================================================================
  // 4. HTTP adapter — the timeout is enforced HERE, and the outcome is UNKNOWN.
  // =========================================================================
  it('aborts a hung HTTP call at the configured timeout and reports CAPABILITY_TIMEOUT requiring readback before retry', async () => {
    const { orgId, adminId } = await seedAdminOrg('http-timeout');
    const capabilityId = `cap-http-timeout-${randomUUID()}`;
    try {
      // A transport that NEVER resolves on its own — only the adapter's own
      // AbortController can end this call.
      const hangingFetch = ((_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        })) as unknown as typeof fetch;

      await capabilityAdapterService.registerCapabilityWithAdapter(
        registrationInput({ capabilityId, providerType: 'HTTP_API', adminId }),
        {
          kind: 'HTTP_API',
          method: 'POST',
          url: 'https://vendor.invalid/api/slow',
          fetchImpl: hangingFetch,
        },
        orgId
      );

      const startedAt = Date.now();
      const result = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId, orgId, actorId: adminId, timeoutMs: 250 })
      );
      const elapsed = Date.now() - startedAt;

      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_TIMEOUT');
      // Enforced, not hoped for: it returned, and it returned quickly.
      expect(elapsed).toBeLessThan(5_000);
      expect(elapsed).toBeGreaterThanOrEqual(200);

      // doc 06 §8 — the outcome is UNKNOWN, so a blind retry is forbidden.
      expect(result.retryable).toBe(false);
      expect(result.requiresReadbackBeforeRetry).toBe(true);
      expect(result.errorDetailRef).toMatch(/^sha256:[0-9a-f]{32}$/);

      const events = await readOutboxForCapability(capabilityId);
      expect(events).toHaveLength(1);
      expect(events[0].redacted_summary.requiresReadbackBeforeRetry).toBe(true);
    } finally {
      await teardown(orgId, [capabilityId]);
    }
  }, 90_000);

  // =========================================================================
  // 5. A provider idempotency header makes the unknown outcome safe to retry;
  //    the header is actually sent.
  // =========================================================================
  it('sends the provider idempotency header and, when one is declared, stops demanding readback before retry', async () => {
    const { orgId, adminId } = await seedAdminOrg('http-idem-header');
    const capabilityId = `cap-http-idemhdr-${randomUUID()}`;
    try {
      let seenHeaders: Record<string, string> = {};
      const failingFetch = ((_url: string, init?: { headers?: Record<string, string> }) => {
        seenHeaders = init?.headers ?? {};
        const error = new Error('socket hang up');
        error.name = 'FetchError';
        return Promise.reject(error);
      }) as unknown as typeof fetch;

      await capabilityAdapterService.registerCapabilityWithAdapter(
        registrationInput({ capabilityId, providerType: 'HTTP_API', adminId }),
        {
          kind: 'HTTP_API',
          method: 'POST',
          url: 'https://vendor.invalid/api/idem',
          idempotencyHeader: 'idempotency-key',
          fetchImpl: failingFetch,
        },
        orgId
      );

      const idempotencyKey = `idem-${randomUUID()}`;
      const result = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId, orgId, actorId: adminId, idempotencyKey })
      );

      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_TRANSPORT_ERROR');
      // The header actually went out — otherwise the claim below would be false.
      expect(seenHeaders['idempotency-key']).toBe(idempotencyKey);
      // Because the provider dedupes, the unknown outcome is safe to retry.
      expect(result.requiresReadbackBeforeRetry).toBe(false);
    } finally {
      await teardown(orgId, [capabilityId]);
    }
  }, 90_000);

  // =========================================================================
  // 6. Input/output validation and the lifecycle/health gate.
  // =========================================================================
  it('rejects invalid input and invalid output with distinct stable codes, and refuses to execute an unbound capability', async () => {
    const { orgId, adminId } = await seedAdminOrg('validation');
    const capabilityId = `cap-validate-${randomUUID()}`;
    const unboundCapabilityId = `cap-unbound-${randomUUID()}`;
    try {
      let invocations = 0;
      await capabilityAdapterService.registerCapabilityWithAdapter(
        registrationInput({ capabilityId, providerType: 'INTERNAL', adminId }),
        {
          kind: 'INTERNAL',
          handler: async () => {
            invocations += 1;
            return { output: { unexpected: true } };
          },
          validateInput: (payload) => typeof payload.required === 'string',
          validateOutput: (output) => typeof output.expected === 'string',
        },
        orgId
      );

      const badInput = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId, orgId, actorId: adminId, payload: { wrong: 1 } })
      );
      expect(badInput.outcome).toBe('FAILED');
      expect(badInput.errorCode).toBe('CAPABILITY_INPUT_INVALID');
      // Input validation must precede the handler — otherwise it is not a gate.
      expect(invocations).toBe(0);

      const badOutput = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId, orgId, actorId: adminId, payload: { required: 'yes' } })
      );
      expect(badOutput.outcome).toBe('FAILED');
      expect(badOutput.errorCode).toBe('CAPABILITY_OUTPUT_INVALID');
      expect(badOutput.output).toEqual({});
      expect(invocations).toBe(1);

      // A registered capability whose adapter binding was never installed is a
      // configuration error (doc 05 §4: "active only when its adapter … is
      // present"), not a 404.
      await capabilityAdapterService.registerCapabilityWithAdapter(
        registrationInput({ capabilityId: unboundCapabilityId, providerType: 'INTERNAL', adminId }),
        { kind: 'INTERNAL', handler: async () => ({ output: {} }) },
        orgId
      );
      capabilityAdapterService.clearCapabilityBindings();

      const unbound = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId: unboundCapabilityId, orgId, actorId: adminId })
      );
      expect(unbound.outcome).toBe('FAILED');
      expect(unbound.errorCode).toBe('CAPABILITY_UNAVAILABLE');

      // An entirely unregistered capability is a different, equally stable code.
      const missing = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId: `cap-never-registered-${randomUUID()}`, orgId, actorId: adminId })
      );
      expect(missing.outcome).toBe('FAILED');
      expect(missing.errorCode).toBe('CAPABILITY_NOT_FOUND');
    } finally {
      await teardown(orgId, [capabilityId, unboundCapabilityId]);
    }
  }, 90_000);

  // =========================================================================
  // 7. The INTERNAL adapter is timed out too — "it's in-process" is not a
  //    liveness guarantee.
  // =========================================================================
  it('times out a hung INTERNAL handler instead of pinning the worker', async () => {
    const { orgId, adminId } = await seedAdminOrg('internal-timeout');
    const capabilityId = `cap-internal-timeout-${randomUUID()}`;
    try {
      await capabilityAdapterService.registerCapabilityWithAdapter(
        registrationInput({ capabilityId, providerType: 'INTERNAL', adminId }),
        {
          kind: 'INTERNAL',
          // Never resolves — models an internal handler awaiting a hung client.
          handler: () => new Promise(() => undefined) as Promise<{ output: Record<string, unknown> }>,
        },
        orgId
      );

      const startedAt = Date.now();
      const result = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId, orgId, actorId: adminId, timeoutMs: 200 })
      );
      const elapsed = Date.now() - startedAt;

      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('CAPABILITY_TIMEOUT');
      expect(elapsed).toBeLessThan(5_000);
      expect(result.requiresReadbackBeforeRetry).toBe(true);
    } finally {
      await teardown(orgId, [capabilityId]);
    }
  }, 90_000);

  // =========================================================================
  // 8. Registration refuses a binding that contradicts the declared provider.
  // =========================================================================
  it('refuses to register a capability whose binding kind contradicts its providerType', async () => {
    const { orgId, adminId } = await seedAdminOrg('mismatch');
    const capabilityId = `cap-mismatch-${randomUUID()}`;
    try {
      await expect(
        capabilityAdapterService.registerCapabilityWithAdapter(
          registrationInput({ capabilityId, providerType: 'HTTP_API', adminId }),
          { kind: 'INTERNAL', handler: async () => ({ output: {} }) },
          orgId
        )
      ).rejects.toThrow('capability_binding_provider_type_mismatch');

      // And nothing was written — the refusal precedes registration.
      const rows = await control.query(
        `SELECT count(*)::int AS n FROM case_workspace_capabilities WHERE capability_id = $1`,
        [capabilityId]
      );
      expect(Number(rows.rows[0].n)).toBe(0);

      expect(capabilityAdapterService.getRegisteredAdapterKinds().sort()).toEqual([
        'HTTP_API',
        'INTERNAL',
      ]);
    } finally {
      await teardown(orgId, [capabilityId]);
    }
  }, 90_000);

  // =========================================================================
  // 9. CapabilityHandlerError lets an INTERNAL handler report a PRECISE
  //    taxonomy code instead of the generic CAPABILITY_INTERNAL_ERROR every
  //    other throw collapses to (added for the module adapters in
  //    server/src/services/caseWorkspace/adapters/** — Strumień C).
  // =========================================================================
  it('maps a thrown CapabilityHandlerError to its OWN code, and a plain throw still falls back to CAPABILITY_INTERNAL_ERROR', async () => {
    const { orgId, adminId } = await seedAdminOrg('handler-error');
    const capabilityId = `cap-handler-error-${randomUUID()}`;
    try {
      await capabilityAdapterService.registerCapabilityWithAdapter(
        registrationInput({ capabilityId, providerType: 'INTERNAL', adminId }),
        {
          kind: 'INTERNAL',
          handler: async (payload) => {
            if (payload.mode === 'typed') {
              throw new capabilityAdapterService.CapabilityHandlerError(
                'CAPABILITY_UNAUTHORIZED',
                'no_standing_on_this_case'
              );
            }
            throw new Error('some_untyped_bug');
          },
        },
        orgId
      );

      const typed = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId, orgId, actorId: adminId, payload: { mode: 'typed' } })
      );
      expect(typed.outcome).toBe('FAILED');
      expect(typed.errorCode).toBe('CAPABILITY_UNAUTHORIZED');

      const untyped = await capabilityAdapterService.executeCapability(
        envelope({ capabilityId, orgId, actorId: adminId, payload: { mode: 'untyped' } })
      );
      expect(untyped.outcome).toBe('FAILED');
      expect(untyped.errorCode).toBe('CAPABILITY_INTERNAL_ERROR');
    } finally {
      await teardown(orgId, [capabilityId]);
    }
  }, 90_000);
});
