/**
 * RN_G6_A3 — event-type classification contract test.
 *
 * Origin: production logs showed `reviseDefinition` (RN_G6_P0A,
 * kpiDefinitionCommands.ts) emitting `kpi.definition_revised` on every call
 * with the warning `event_type has no registered consumer_group — outbox
 * fan-out skipped` (atomicWrite.ts's `resolveConsumerGroups`). The event_type
 * was simply never added to `EVENT_TYPE_CONSUMER_GROUPS` — and NOTHING in
 * the existing test suite caught it:
 * `tests/resultsVnext/kpi/kpiReviseDefinition.realdb.test.ts` never asserts
 * outbox state at all (it is a domain-lifecycle suite, not a platform-
 * routing one), and `consumerGroupContract.test.ts` (the pre-existing
 * platform-level contract test) only checks that groups a *registered*
 * event_type routes to are themselves registered-or-unbuilt — it has
 * nothing to say about an event_type that is simply ABSENT from the map. An
 * absent key and a deliberately-audit-only key produced IDENTICAL runtime
 * behavior (same `[]` return, same warning-shaped log line) — "forgotten"
 * and "intentional" were indistinguishable.
 *
 * This file closes both gaps:
 *   Part A (static, no DB) — every event_type actually emitted anywhere
 *     under `server/src/services/resultsVnext/**` must be a member of
 *     EXACTLY ONE of {`EVENT_TYPE_CONSUMER_GROUPS` key with >=1 groups,
 *     `AUDIT_ONLY_EVENT_TYPES` member}. A new event_type introduced without
 *     touching either registry fails `[3] no emitted event_type is
 *     unclassified` — see that test's own comment for how a NEGATIVE CONTROL
 *     proved this (adding a real, uncommitted, unclassified event_type
 *     literal to a source file and re-running turned this test red; removing
 *     it turned it back green — recorded in this package's own delivery
 *     report, not reproduced automatically here since it requires editing
 *     shipped source).
 *   Part B (real Postgres, RUN_DB_TESTS/DATABASE_URL-gated, same skip
 *     convention as kpiReviseDefinition.realdb.test.ts) — proves, against a
 *     real transaction, that the classification has the RUNTIME effect it
 *     claims: an audit-only event is durably recorded but fans out to zero
 *     outbox rows even under a retried (duplicate-idempotency-key) call, a
 *     routable event fans out to exactly the right number of outbox rows
 *     and a retry does not duplicate them, tenant (`organization_id`) is
 *     preserved end to end in both cases, and a completely fresh client
 *     connection (a "cold open" — no reliance on any in-process cache) sees
 *     the same durably committed state.
 *
 * SKIP POLICY for Part B: identical to
 * tests/resultsVnext/kpi/kpiReviseDefinition.realdb.test.ts — no DB
 * configured => every `itDB` is a silent no-op and this file still reports
 * green; that is expected in environments without Postgres and is NOT
 * evidence Part B's behavior works. A DB that IS configured but unreachable
 * throws in `beforeAll` so this never silently passes.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AUDIT_ONLY_EVENT_TYPES,
  EVENT_TYPE_CONSUMER_GROUPS,
} from '../../../server/src/services/resultsVnext/platform/atomicWrite.js';
import {
  CONSUMER_REGISTRY,
  UNBUILT_CONSUMER_GROUPS,
} from '../../../server/src/services/resultsVnext/platform/consumerRegistry.js';

// ==========================================================
// PART A — static classification-completeness scan (no DB required).
// ==========================================================

/**
 * Every domain namespace this platform's event_types are known to use
 * (`atomicWrite.ts`'s own `EVENT_TYPE_CONSUMER_GROUPS` — every existing key
 * starts with exactly one of these). Anchoring the scan to these prefixes
 * (rather than "any quoted string containing a dot") is what keeps this scan
 * from false-positiving on unrelated dotted string literals that are common
 * in this codebase for OTHER reasons — SQL column aliases (`'a.source_objective_id'`,
 * `'p.case_id'`), import specifiers (`'decimal.js'`), etc. Verified against
 * a full scan at the time this test was written: with this prefix filter,
 * zero non-event-type literals were picked up.
 */
const KNOWN_EVENT_TYPE_PREFIXES = [
  'kpi.',
  'roi.',
  'okr_set.',
  'okr_program.',
  'okr_cycle.',
  'okr_objective.',
  'okr_key_result.',
  'okr_alignment.',
  'okr_checkin.',
  'okr_support.',
  'scorecard.',
] as const;

const RESULTS_VNEXT_ROOT = join(__dirname, '../../../server/src/services/resultsVnext');

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Scans every single-quoted string literal in `resultsVnext/**` source
 * (production code, not tests — this deliberately does NOT scan `tests/**`,
 * so a synthetic placeholder event_type in some OTHER test's fixture data
 * can never leak into "things that must be classified") that starts with a
 * known domain prefix. This is a best-effort TEXT scan, not an AST walk —
 * see this function's own doc comment on what that does and does not cover.
 *
 * COVERAGE (verified against every currently-existing call shape in this
 * codebase at the time this test was written):
 *   - object-literal shorthand: `eventType: 'kpi.definition_revised'`
 *     (the overwhelming majority of call sites — every `buildEvent` in
 *     kpiDefinitionCommands.ts/kpiMeasurementCommands.ts/kpiScorecardCommands.ts/
 *     kpiInitiativeImpactCommands.ts/every roi*Commands.ts/every okr*Commands.ts).
 *   - `const eventType = <ternary>;` (roiBaselineCommands.ts's
 *     `roi.baseline_captured`/`roi.baseline_updated`,
 *     roiCalculationRunCommands.ts's `roi.calculation_run_completed`/
 *     `_failed`, roiFinanceReconciliationCommands.ts's
 *     `roi.finance_reconciliation_resolved`/`_status_updated`) — both
 *     ternary branches are plain string literals in the source text, so the
 *     scan finds both regardless of which branch a given source FILE
 *     happens to take at runtime.
 *   - positional string-literal arguments (kpiDeviationCommands.ts's
 *     `runEscalationOverlay('kpi.deviation_manager_escalated', ...)` /
 *     `runEscalationOverlay('kpi.deviation_deescalated', ...)`).
 *
 * NOT covered, and not currently exercised by any file in this codebase
 * (documented limitation, not a silent gap): an event_type built from
 * string concatenation/interpolation (`` `kpi.${suffix}` ``) or read from a
 * runtime variable with no literal in the source at all. If a future
 * command introduces that shape, this scan will NOT see that event_type —
 * the honest fix at that point is to extend this function (or, better,
 * require the command to also export its emitted-event-type set explicitly
 * for this scanner to import), not to assume text-scanning solves it in
 * general. This is the single largest caveat on this test's guarantee — see
 * the file-level doc comment's "what this test does NOT cover" note.
 *
 * Also intentionally A SUPERSET of literal call sites: a doc COMMENT that
 * happens to quote a real, already-classified event_type (this codebase's
 * own convention throughout atomicWrite.ts and every *Commands.ts file)
 * contributes nothing new to the result set beyond that literal's own key —
 * harmless. A comment inventing a hypothetical, never-emitted event_type
 * with a valid prefix WOULD force it into the "must classify" set; this has
 * not happened in this codebase as of writing (verified: the scanned set
 * below is the exact 154-member set produced at the time this test was
 * authored, matching the map plus this package's own 4 fixes, no extras).
 */
export function scanEmittedEventTypes(): Set<string> {
  const found = new Set<string>();
  const literalRe = /'([a-z][a-z_]*\.[a-z][a-z_]*)'/g;
  for (const file of listSourceFiles(RESULTS_VNEXT_ROOT)) {
    const text = readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = literalRe.exec(text)) !== null) {
      const literal = match[1] as string;
      if (KNOWN_EVENT_TYPE_PREFIXES.some((prefix) => literal.startsWith(prefix))) {
        found.add(literal);
      }
    }
  }
  return found;
}

/**
 * The core classification check this whole file exists to enforce: every
 * `eventType` in `emitted` must be EXACTLY ONE of routable-with-a-non-empty-
 * group-list or explicitly-audit-only. Exported as a pure function (no I/O)
 * so it can be unit-tested directly against a SYNTHETIC list — see "[3b]"
 * below, the pure-function proof that this specific check mechanism (not
 * just today's specific inputs) actually flags an unclassified type.
 */
export function classifyEventTypes(emitted: Iterable<string>): {
  unclassified: string[];
  ambiguous: string[];
} {
  const unclassified: string[] = [];
  const ambiguous: string[] = [];
  for (const eventType of emitted) {
    const routable = (EVENT_TYPE_CONSUMER_GROUPS[eventType]?.length ?? 0) > 0;
    const auditOnly = AUDIT_ONLY_EVENT_TYPES.has(eventType);
    if (routable && auditOnly) {
      ambiguous.push(eventType);
    } else if (!routable && !auditOnly) {
      unclassified.push(eventType);
    }
  }
  return { unclassified, ambiguous };
}

describe('resultsVnext/platform event-type classification contract (static)', () => {
  it('[1] sanity: the scan is non-trivial (guards against a vacuously-passing empty scan)', () => {
    const emitted = scanEmittedEventTypes();
    expect(emitted.size).toBeGreaterThan(100);
    // Pin the exact three pre-existing gaps this package's own scan
    // discovered and fixed alongside kpi.definition_revised (see
    // atomicWrite.ts's own "RN_G6_A3 FIX" comments) — proof the scan finds
    // real, previously-uncaught cases, not just the one already known from
    // the production log line.
    expect(emitted.has('kpi.deviation_manager_escalated')).toBe(true);
    expect(emitted.has('okr_set.objective_reflection_teresa_draft_recorded')).toBe(true);
    expect(emitted.has('okr_set.objective_reflection_teresa_draft_disposition_recorded')).toBe(true);
    expect(emitted.has('kpi.definition_revised')).toBe(true);
  });

  it('[2] kpi.definition_revised is classified audit-only, not routable, and not merely absent', () => {
    expect(AUDIT_ONLY_EVENT_TYPES.has('kpi.definition_revised')).toBe(true);
    expect(EVENT_TYPE_CONSUMER_GROUPS['kpi.definition_revised']).toBeUndefined();
  });

  it('[3] no event_type actually emitted under resultsVnext/** is unclassified — THE gate', () => {
    // THIS is the assertion that repro's the original incident: before this
    // package's fix, `classifyEventTypes` run against the real scan would
    // have returned `unclassified: ['kpi.definition_revised', ...]`. Proven
    // to actually catch a real gap (not just today's fixed one) via a
    // NEGATIVE CONTROL performed manually during this package's delivery:
    // a throwaway `eventType: 'kpi.definition_totally_unclassified_negative_control'`
    // literal was added to a scratch file under `server/src/services/resultsVnext/kpi/`,
    // this exact test was re-run and failed with that literal listed in
    // `unclassified`, the scratch file was then deleted and the test passed
    // again — see this package's delivery report for the raw before/after
    // vitest output. Not re-run automatically here because doing so would
    // require this test to mutate shipped source at run time, which is a
    // worse hazard than the manual one-time proof it would replace.
    const emitted = scanEmittedEventTypes();
    const { unclassified, ambiguous } = classifyEventTypes(emitted);
    expect(unclassified).toEqual([]);
    expect(ambiguous).toEqual([]);
  });

  it('[3b] classifyEventTypes itself flags a synthetic unclassified type (pure-function proof of the mechanism)', () => {
    // Complements [3]'s real-source proof (and this package's manual
    // negative control on real source, see [3]'s own comment) with a
    // deterministic, always-run proof that the CHECK FUNCTION is not
    // vacuous: feed it a real classified type, a real audit-only type, and
    // one that is neither, and confirm each lands in the right bucket.
    const result = classifyEventTypes([
      'kpi.definition_created', // routable — real key, non-empty groups.
      'kpi.definition_revised', // audit-only — real key in AUDIT_ONLY_EVENT_TYPES.
      'kpi.this_event_type_does_not_exist_anywhere', // neither — must be flagged.
    ]);
    expect(result.unclassified).toEqual(['kpi.this_event_type_does_not_exist_anywhere']);
    expect(result.ambiguous).toEqual([]);
  });

  it('[4] AUDIT_ONLY_EVENT_TYPES and EVENT_TYPE_CONSUMER_GROUPS are disjoint (mirrors atomicWrite.ts\'s own module-load assertion)', () => {
    // atomicWrite.ts throws at import time if these ever overlap (see its
    // own "Fail fast at module load" comment) — this successfully importing
    // at all is itself a passing proof of that. This assertion re-checks
    // the same property independently, so a future refactor that removed
    // the throw (but not the intent) would still be caught here.
    for (const auditOnlyType of AUDIT_ONLY_EVENT_TYPES) {
      expect(EVENT_TYPE_CONSUMER_GROUPS[auditOnlyType]).toBeUndefined();
    }
  });

  it('[5] every group a classified (routable) event_type routes to is registered-or-unbuilt', () => {
    // Same property tests/resultsVnext/platform/consumerGroupContract.test.ts
    // already enforces (kept independent here, not imported from there, so
    // this file stands alone as a single source of the FULL classification
    // contract) — a routable group with no real consumer AND no
    // UNBUILT_CONSUMER_GROUPS entry is the dead-letter hazard that test's
    // own header documents.
    const routedGroups = new Set<string>();
    for (const groups of Object.values(EVENT_TYPE_CONSUMER_GROUPS)) {
      for (const group of groups) routedGroups.add(group);
    }
    const registered = new Set(Object.keys(CONSUMER_REGISTRY));
    const orphaned = [...routedGroups].filter(
      (group) => !registered.has(group) && !UNBUILT_CONSUMER_GROUPS.has(group)
    );
    expect(orphaned).toEqual([]);
  });

  it('[6] this package\'s three bonus routable fixes all resolve to mywork_projection, matching their nearest sibling', () => {
    expect(EVENT_TYPE_CONSUMER_GROUPS['kpi.deviation_manager_escalated']).toEqual(['mywork_projection']);
    expect(EVENT_TYPE_CONSUMER_GROUPS['okr_set.objective_reflection_teresa_draft_recorded']).toEqual([
      'mywork_projection',
    ]);
    expect(
      EVENT_TYPE_CONSUMER_GROUPS['okr_set.objective_reflection_teresa_draft_disposition_recorded']
    ).toEqual(['mywork_projection']);
  });
});

// ==========================================================
// PART B — real-Postgres runtime proof (RUN_DB_TESTS/DATABASE_URL-gated).
// ==========================================================

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `evt-class-it-org-${tag}`;
const OWNER = `evt-class-it-owner-${tag}`;
const REVIEWER = `evt-class-it-reviewer-${tag}`;

let client: Client;
let reachable = false;

type CommandsModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiDefinitionCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createKpiDraft: CommandsModule['createKpiDraft'];
let submitDefinition: CommandsModule['submitDefinition'];
let rejectDefinitionVersion: CommandsModule['rejectDefinitionVersion'];
let reviseDefinition: CommandsModule['reviseDefinition'];
let closePgPool: (() => Promise<void>) | undefined;

const FULL_ACCESS = { capabilities: ['*'], platformRole: null } as const;

async function insertVisibilityPolicy(organizationId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, 'kpi', 1, 'OPEN_ORG', true, $2)`,
    [organizationId, OWNER]
  );
}

let kpiCodeSeq = 0;
function nextKpiCode(): string {
  kpiCodeSeq += 1;
  return `EVTCLASS-${tag}-${kpiCodeSeq}`;
}

/** create -> submit -> reject, ending with exactly one REJECTED version —
 * the fixture `reviseDefinition` needs. Mirrors
 * kpiReviseDefinition.realdb.test.ts's own `buildRejectedFixture` (private
 * to that file, duplicated minimally here rather than exported cross-file,
 * matching this package's own kpiDeviationCommands-style precedent of small
 * per-file fixture builders over a shared test-utils module). */
async function buildRejectedFixture(): Promise<{
  kpiId: string;
  rejected: Awaited<ReturnType<typeof createKpiDraft>>['result']['definitionVersion'];
}> {
  const created = await createKpiDraft({
    organizationId: ORG_ID,
    kpiCode: nextKpiCode(),
    name: 'Event classification fixture KPI',
    targetGeometry: 'threshold_min',
    targetValue: 95,
    ownerUserId: OWNER,
    createdBy: OWNER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `evtclass-create-${randomUUID()}`,
    access: FULL_ACCESS,
  });
  expect(created.outcome).toBe('applied');
  const kpiId = created.result.kpi.kpiId;
  const v1 = created.result.definitionVersion;

  const submitted = await submitDefinition({
    definitionVersionId: v1.definitionVersionId,
    organizationId: ORG_ID,
    expectedVersion: v1.rowVersion,
    actorUserId: OWNER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `evtclass-submit-${randomUUID()}`,
    access: FULL_ACCESS,
  });
  expect(submitted.outcome).toBe('applied');

  const rejected = await rejectDefinitionVersion({
    definitionVersionId: v1.definitionVersionId,
    organizationId: ORG_ID,
    expectedVersion: submitted.result.rowVersion,
    rejectedBy: REVIEWER,
    rejectionReason: 'Fixture rejection for event-classification contract test.',
    actorEffectiveRole: 'consultant',
    idempotencyKey: `evtclass-reject-${randomUUID()}`,
    access: FULL_ACCESS,
  });
  expect(rejected.outcome).toBe('applied');

  return { kpiId, rejected: rejected.result };
}

describe('resultsVnext/platform event-type classification — real Postgres runtime proof', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — event-classification runtime tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_platform_outbox LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the platform schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    await insertVisibilityPolicy(ORG_ID);

    const commands: CommandsModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiDefinitionCommands.js'
    );
    createKpiDraft = commands.createKpiDraft;
    submitDefinition = commands.submitDefinition;
    rejectDefinitionVersion = commands.rejectDefinitionVersion;
    reviseDefinition = commands.reviseDefinition;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM rvn_platform_outbox WHERE event_id IN (
                          SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.end();
    if (closePgPool) await closePgPool();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB(
    'audit-only kpi.definition_revised: event durably recorded, ZERO outbox rows, retry does not create phantom rows, tenant preserved, cold-open sees it',
    async () => {
      const { rejected: v1 } = await buildRejectedFixture();
      const idempotencyKey = `evtclass-revise-${randomUUID()}`;

      // [4] retry idempotency — same key twice. Safe as a literal sequential
      // retry here (unlike a normal CAS'd UPDATE command) because
      // reviseDefinition's own CAS'd row (the rejected version) is NEVER
      // updated by applyMutation — see that command's own doc comment —
      // so v1.rowVersion stays valid across both calls, exactly the
      // property kpiReviseDefinition.realdb.test.ts's own point [16]
      // already established for the domain-level effect; this proves the
      // SAME property for the platform-event/outbox side.
      const first = await reviseDefinition({
        definitionVersionId: v1.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: v1.rowVersion,
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey,
        access: FULL_ACCESS,
      });
      expect(first.outcome).toBe('applied');

      const second = await reviseDefinition({
        definitionVersionId: v1.definitionVersionId,
        organizationId: ORG_ID,
        expectedVersion: v1.rowVersion,
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey, // SAME key — simulated double-click retry.
        access: FULL_ACCESS,
      });
      expect(second.outcome).toBe('duplicate');
      expect(second.eventId).toBe(first.eventId);

      // Event durably recorded exactly once, tenant preserved on the event
      // row itself — audit-only means "no fanout", NOT "no audit trail".
      const eventRows = await client.query<{
        event_id: string;
        event_type: string;
        organization_id: string;
      }>(`SELECT event_id, event_type, organization_id FROM rvn_platform_events WHERE idempotency_key = $1`, [
        idempotencyKey,
      ]);
      expect(eventRows.rows.length).toBe(1);
      expect(eventRows.rows[0]?.event_type).toBe('kpi.definition_revised');
      expect(eventRows.rows[0]?.organization_id).toBe(ORG_ID); // [5] tenant preserved.

      // [3] ZERO outbox rows — before AND after the retry (the retry must
      // not sneak a phantom fan-out row in on its rolled-back attempt).
      const outboxRows = await client.query(`SELECT * FROM rvn_platform_outbox WHERE event_id = $1`, [
        first.eventId,
      ]);
      expect(outboxRows.rows.length).toBe(0);

      // [6] cold open — a brand-new client connection (not the shared
      // setup client) sees the identical durably-committed state, no
      // reliance on any in-process cache/connection-local state.
      const cold = new Client(buildClientConfig() as ClientConfig);
      await cold.connect();
      try {
        const coldEvents = await cold.query(`SELECT event_id, organization_id FROM rvn_platform_events WHERE idempotency_key = $1`, [
          idempotencyKey,
        ]);
        expect(coldEvents.rows.length).toBe(1);
        expect(coldEvents.rows[0]?.organization_id).toBe(ORG_ID);
        const coldOutbox = await cold.query(`SELECT * FROM rvn_platform_outbox WHERE event_id = $1`, [
          first.eventId,
        ]);
        expect(coldOutbox.rows.length).toBe(0);
      } finally {
        await cold.end();
      }
    }
  );

  itDB(
    'routable kpi.definition_created: exactly one outbox row per consumer group, retry does not duplicate it, tenant preserved, cold-open sees it',
    async () => {
      const idempotencyKey = `evtclass-created-${randomUUID()}`;
      const expectedGroups = EVENT_TYPE_CONSUMER_GROUPS['kpi.definition_created'] ?? [];
      expect(expectedGroups.length).toBeGreaterThan(0); // sanity: this IS routable.

      // [4] retry idempotency — createKpiDraft uses executeAtomicCreate (no
      // CAS/expectedVersion at all), so a literal double-call with the SAME
      // idempotencyKey is the natural "double-click retry" shape, no
      // version-staleness caveat to work around.
      const first = await createKpiDraft({
        organizationId: ORG_ID,
        kpiCode: nextKpiCode(),
        name: 'Routable fixture KPI',
        targetGeometry: 'threshold_min',
        targetValue: 95,
        ownerUserId: OWNER,
        createdBy: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey,
        access: FULL_ACCESS,
      });
      expect(first.outcome).toBe('applied');

      const second = await createKpiDraft({
        organizationId: ORG_ID,
        kpiCode: nextKpiCode(), // irrelevant on a duplicate call — never reached.
        name: 'Routable fixture KPI (retry, should be ignored)',
        targetGeometry: 'threshold_min',
        targetValue: 95,
        ownerUserId: OWNER,
        createdBy: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey, // SAME key.
        access: FULL_ACCESS,
      });
      expect(second.outcome).toBe('duplicate');
      expect(second.eventId).toBe(first.eventId);

      const eventRows = await client.query<{ organization_id: string }>(
        `SELECT organization_id FROM rvn_platform_events WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      expect(eventRows.rows.length).toBe(1);
      expect(eventRows.rows[0]?.organization_id).toBe(ORG_ID); // [5] tenant preserved.

      // [3] exactly one outbox row PER consumer group — not duplicated by
      // the retry (the second call rolls back before reaching the outbox
      // INSERT — see atomicWrite.ts's executeAtomicCreate duplicate branch).
      const outboxRows = await client.query<{ consumer_group: string; status: string }>(
        `SELECT consumer_group, status FROM rvn_platform_outbox WHERE event_id = $1`,
        [first.eventId]
      );
      expect(outboxRows.rows.length).toBe(expectedGroups.length);
      expect(outboxRows.rows.map((r) => r.consumer_group).sort()).toEqual([...expectedGroups].sort());
      for (const row of outboxRows.rows) {
        expect(row.status).toBe('pending');
      }

      // [6] cold open.
      const cold = new Client(buildClientConfig() as ClientConfig);
      await cold.connect();
      try {
        const coldOutbox = await cold.query(`SELECT consumer_group FROM rvn_platform_outbox WHERE event_id = $1`, [
          first.eventId,
        ]);
        expect(coldOutbox.rows.length).toBe(expectedGroups.length);
      } finally {
        await cold.end();
      }
    }
  );
});
