/**
 * FIN-005 — policy for deciding what may exist in, and what may be moved out of,
 * the demo Finance tenant.
 *
 * Extracted from the cleanup script on purpose: these are product and safety
 * rules, so they must be readable and unit-tested rather than buried in an
 * operations script. `server/scripts/finance-demo-coherence-cleanup.ts` is the
 * only caller that acts on them.
 *
 * Everything in this module is PURE — no `pg`, no `fs`, no `process.env` reads.
 * The script does the I/O and hands the observed state in, which is what makes
 * the dangerous decisions testable without a database.
 *
 * The module answers six questions, in the order the script asks them:
 *
 *  1. WHICH DATABASE am I allowed to touch?      → `assertApprovedDemoTarget`
 *  2. WHICH ROWS are canonical (never movable)?  → `isCanonicalDemoRowId`
 *  3. IS THE SEED materialized before I move     → `assertCanonicalFixtureMaterialized`
 *     anything out?
 *  4. IS THE QUARANTINE ORG safe to write into?  → `assertQuarantineOrganizationReusable`
 *  5. DID ANYTHING BREAK the object graph?       → `findCrossOrgDependencyViolations`
 *  6. IS THE ROLLBACK PLAN still trustworthy?    → `assertManifestIntegrity`,
 *                                                  `assertRecordUnchangedSinceQuarantine`
 */

import { createHash } from 'node:crypto';

import { getAtelierFinanceCanonicalIds } from './atelierFinanceSeed.js';

export const FIN005_POLICY_LABEL = 'finance-demo-cleanup';

function fail(message: string): never {
  throw new Error(`[${FIN005_POLICY_LABEL}] ${message}`);
}

// ---------------------------------------------------------------------------
// 1. Environment guard — hard allowlist of the approved Railway demo target
// ---------------------------------------------------------------------------

/**
 * The fingerprint of a database this script is allowed to write to.
 *
 * WHY A FINGERPRINT AND NOT AN ORG-TYPE CHECK: `organizations.organization_type
 * = 'DEMO'` says nothing about WHICH database you are connected to.
 * `.env.production.example` documents `DEMO_ORG_ID` as a supported production
 * setting, so a DEMO-typed org can and does exist in production. Detecting the
 * environment by the org row therefore cannot refuse production — only the
 * connection fingerprint can.
 */
export interface DemoTargetFingerprint {
  railwayProject: string;
  railwayEnvironment: string;
  railwayService: string;
  host: string;
  /** `null` means "any port on this host" is NOT accepted — the port must match. */
  port: number | null;
  database: string;
  /** The one organization id this target is approved for. */
  organizationId: string;
}

/**
 * THE allowlist. One entry: the Railway `consultify` / `demo` Postgres behind
 * `demo.consultify.ai`.
 *
 * ⚠ OPERATIONAL NOTE — these values are transcribed from the FIN-005 handoff
 * (project `consultify`, environment `demo`) and from the documented demo proxy
 * host (`trolley.proxy.rlwy.net:28146`, database `railway`). They were NOT
 * verified against a live connection while writing this file, because this
 * branch is forbidden from touching demo/Railway/production. The failure mode is
 * safe in both directions: a wrong value here makes the script REFUSE to run
 * (fail closed), never makes it run somewhere unapproved. Confirm the exact
 * service name and database name in the Railway dashboard before the first live
 * run, and correct this table in a commit of its own.
 */
export const FIN005_APPROVED_DEMO_TARGETS: ReadonlyArray<DemoTargetFingerprint> = Object.freeze([
  Object.freeze({
    railwayProject: 'consultify',
    railwayEnvironment: 'demo',
    railwayService: 'Postgres',
    host: 'trolley.proxy.rlwy.net',
    port: 28146,
    database: 'railway',
    organizationId: 'demo-org',
  }),
]);

/**
 * Substrings that mark a target as production. Checked against every declared
 * and observed identifier BEFORE the allowlist, so a production target is
 * refused even if somebody adds it to the allowlist by mistake, and even if a
 * `DEMO`-typed organization exists there.
 *
 * `centerbeam` is the documented production Postgres proxy host.
 */
export const FIN005_FORBIDDEN_TARGET_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> =
  Object.freeze([
    Object.freeze({ label: 'production database host (centerbeam)', pattern: /centerbeam/i }),
    Object.freeze({ label: 'production identifier', pattern: /(^|[^a-z])prod(uction)?([^a-z]|$)/i }),
    Object.freeze({ label: 'live identifier', pattern: /(^|[^a-z])live([^a-z]|$)/i }),
  ]);

export interface ObservedTarget {
  host: string;
  port: number | null;
  database: string;
}

const DECLARED_FIELDS: Array<keyof DemoTargetFingerprint> = [
  'railwayProject',
  'railwayEnvironment',
  'railwayService',
  'host',
  'port',
  'database',
  'organizationId',
];

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * Refuse unless the declared target is (a) not production-looking, (b) exactly
 * one allowlist entry, and (c) identical to the database actually connected.
 *
 * All three matter. (a) alone is a heuristic; (b) alone can be satisfied by a
 * lying declaration; (c) alone cannot see the Railway project/environment,
 * which is the only place `demo` and `production` are distinguishable by name.
 */
export function assertApprovedDemoTarget(input: {
  declared: Partial<Record<keyof DemoTargetFingerprint, unknown>>;
  actual: ObservedTarget;
  allowlist?: ReadonlyArray<DemoTargetFingerprint>;
}): DemoTargetFingerprint {
  const allowlist = input.allowlist ?? FIN005_APPROVED_DEMO_TARGETS;

  // (0) Every field must be declared explicitly — no silent defaults.
  const declared: Record<string, string | number | null> = {};
  const missing: string[] = [];
  for (const field of DECLARED_FIELDS) {
    const raw = input.declared[field];
    const value = normalizeText(raw);
    if (!value) {
      missing.push(field);
      continue;
    }
    declared[field] = field === 'port' ? Number(value) : value;
  }
  if (missing.length) {
    fail(
      `Refusing to run: the target must be declared explicitly, no defaults. Missing: ${missing.join(', ')}. ` +
        `Pass --railway-project/--railway-environment/--railway-service/--expect-host/--expect-port/--expect-database/--demo-org-id ` +
        `(or the matching FIN005_* environment variables).`
    );
  }
  if (!Number.isFinite(declared.port as number)) {
    fail(`Declared port "${normalizeText(input.declared.port)}" is not a number.`);
  }

  // (1) Denylist first — production is refused before anything else is consulted.
  const scanned: Array<[string, string]> = [
    ['declared railway project', String(declared.railwayProject)],
    ['declared railway environment', String(declared.railwayEnvironment)],
    ['declared railway service', String(declared.railwayService)],
    ['declared host', String(declared.host)],
    ['declared database', String(declared.database)],
    ['connected host', normalizeText(input.actual.host)],
    ['connected database', normalizeText(input.actual.database)],
  ];
  for (const [where, value] of scanned) {
    for (const { label, pattern } of FIN005_FORBIDDEN_TARGET_PATTERNS) {
      if (pattern.test(value)) {
        fail(
          `Refusing to run: ${where} "${value}" matches a forbidden ${label}. ` +
            `This script never runs against production, regardless of which organizations exist there.`
        );
      }
    }
  }

  // (2) The declaration must match the database actually connected.
  const actualHost = normalizeText(input.actual.host);
  const actualDatabase = normalizeText(input.actual.database);
  if (actualHost !== declared.host) {
    fail(
      `Refusing to run: declared host "${declared.host}" but the connection resolves to "${actualHost || '<unknown>'}".`
    );
  }
  if (actualDatabase !== declared.database) {
    fail(
      `Refusing to run: declared database "${declared.database}" but the connection resolves to "${actualDatabase || '<unknown>'}".`
    );
  }
  if (input.actual.port !== null && Number(input.actual.port) !== Number(declared.port)) {
    fail(
      `Refusing to run: declared port ${declared.port} but the connection resolves to ${input.actual.port}.`
    );
  }

  // (3) Exact allowlist match on every field.
  const match = allowlist.find(
    (entry) =>
      entry.railwayProject === declared.railwayProject &&
      entry.railwayEnvironment === declared.railwayEnvironment &&
      entry.railwayService === declared.railwayService &&
      entry.host === declared.host &&
      Number(entry.port) === Number(declared.port) &&
      entry.database === declared.database &&
      entry.organizationId === declared.organizationId
  );
  if (!match) {
    fail(
      `Refusing to run: target ${describeTarget(declared)} is not on the FIN-005 allowlist. ` +
        `Approved: ${allowlist.map((entry) => describeTarget(entry)).join(' | ') || '<none>'}.`
    );
  }
  return match;
}

function describeTarget(
  target: Partial<Record<keyof DemoTargetFingerprint, unknown>> | DemoTargetFingerprint
): string {
  return (
    `${normalizeText(target.railwayProject)}/${normalizeText(target.railwayEnvironment)}/` +
    `${normalizeText(target.railwayService)} ${normalizeText(target.host)}:${normalizeText(
      target.port
    )}/${normalizeText(target.database)} org=${normalizeText(target.organizationId)}`
  );
}

// ---------------------------------------------------------------------------
// 2. Canonical ownership — EXACT whitelist, never a prefix
// ---------------------------------------------------------------------------

/** Name patterns observed in the demo tenant on 2026-08-01. ADVISORY ONLY. */
export const FINANCE_DEMO_NAME_FLAGS: ReadonlyArray<{ flag: string; pattern: RegExp }> = [
  { flag: 'DBR77', pattern: /\bDBR\s*77\b/i },
  { flag: 'Apator', pattern: /\bapator\b/i },
  { flag: 'staging', pattern: /\bstaging\b/i },
  { flag: 'ui-duplicate', pattern: /\((?:kopia|copy)(?:\s+\d+)?\)/i },
  { flag: 'technical-seed', pattern: /\b(?:seed|fixture|m16|smoke|e2e)\b/i },
];

/**
 * True only when the id is one of the EXACT canonical ids for this tenant.
 *
 * WHY NOT `id.startsWith('<org>--')`: the demo tenant has accumulated rows from
 * older technical fixtures — `<org>--financial-model--m16-seed`,
 * `<org>--statement--staging-probe`, `<org>--analysis--fixture-01` — that were
 * ALSO minted with `makeId(orgId, …)` and therefore carry the canonical prefix.
 * A prefix rule blesses every one of them, which is exactly the incoherence
 * FIN-005 exists to end. The whitelist comes from
 * `getAtelierFinanceCanonicalIds`, the shared contract the seed writes against,
 * so the two can never drift.
 *
 * `table` narrows the check further: an id that is canonical for
 * `financial_models` is not canonical when found in `financial_analyses`.
 */
export function isCanonicalDemoRowId(
  id: unknown,
  organizationId: string,
  table?: string
): boolean {
  const normalizedId = normalizeText(id);
  const normalizedOrg = normalizeText(organizationId);
  if (!normalizedId || !normalizedOrg) return false;

  const canonical = getAtelierFinanceCanonicalIds(normalizedOrg);
  if (table) {
    const allowed = canonical.byTable[table];
    return Array.isArray(allowed) && allowed.includes(normalizedId);
  }
  return canonical.all.has(normalizedId);
}

/** Advisory flags for a customer-visible name. Empty when nothing looks off. */
export function financeDemoNameFlags(name: unknown): string[] {
  const value = String(name ?? '');
  if (!value.trim()) return [];
  return FINANCE_DEMO_NAME_FLAGS.filter(({ pattern }) => pattern.test(value)).map(
    ({ flag }) => flag
  );
}

export interface FinanceDemoRow {
  table: string;
  id: string;
  displayName: string;
}

export interface FinanceDemoClassification extends FinanceDemoRow {
  /** On the exact canonical whitelist for this table — must never be quarantined. */
  canonical: boolean;
  /**
   * Carries the seed's id prefix but is NOT canonical: an old technical fixture.
   * Reported so the operator can see why a prefix rule would have missed it.
   */
  legacyPrefixed: boolean;
  /** Advisory name signals; corroboration for a human reviewer, never a decision. */
  flags: string[];
}

/** Classify one tenant's Finance rows into canonical and foreign. */
export function classifyFinanceDemoRows(
  rows: FinanceDemoRow[],
  organizationId: string
): {
  canonical: FinanceDemoClassification[];
  foreign: FinanceDemoClassification[];
  all: FinanceDemoClassification[];
} {
  const org = normalizeText(organizationId);
  const all = (rows || []).map((row) => {
    const canonical = isCanonicalDemoRowId(row.id, org, row.table);
    return {
      ...row,
      canonical,
      legacyPrefixed: !canonical && Boolean(org) && normalizeText(row.id).startsWith(`${org}--`),
      flags: financeDemoNameFlags(row.displayName),
    };
  });

  return {
    all,
    canonical: all.filter((row) => row.canonical),
    foreign: all.filter((row) => !row.canonical),
  };
}

// ---------------------------------------------------------------------------
// 3. Seed-before-quarantine precondition
// ---------------------------------------------------------------------------

export interface CanonicalFixtureReadback {
  packs: Array<{ id: string; organizationId: string }>;
  statements: Array<{ id: string; organizationId: string; statementPackId: string | null }>;
  values: Array<{ id: string; statementId: string }>;
  analyses: Array<{
    id: string;
    organizationId: string;
    sourceStatementPackId: string | null;
    sourceStatementIds: string[];
  }>;
  models: Array<{ id: string; organizationId: string; sourceStatementPackId: string | null }>;
}

/**
 * Read back the EXACT canonical ids and prove the golden flow exists before a
 * single foreign row is moved.
 *
 * The order is not decoration. Quarantine removes everything that is not
 * canonical; if the canonical fixture was never seeded, quarantine leaves the
 * client-facing Finance module EMPTY. This check is the interlock.
 */
export function verifyCanonicalFixture(
  readback: CanonicalFixtureReadback,
  organizationId: string
): { ok: boolean; violations: string[] } {
  const org = normalizeText(organizationId);
  const canonical = getAtelierFinanceCanonicalIds(org);
  const violations: string[] = [];

  const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id).sort();
  const same = (actual: string[], expected: string[]) =>
    actual.length === expected.length && actual.every((value, index) => value === expected[index]);

  // -- pack ------------------------------------------------------------------
  if (!same(ids(readback.packs), [canonical.packId])) {
    violations.push(
      `expected exactly 1 canonical statement pack (${canonical.packId}), found [${ids(readback.packs).join(', ') || 'none'}]`
    );
  }
  for (const pack of readback.packs) {
    if (pack.organizationId !== org) {
      violations.push(`pack ${pack.id} belongs to "${pack.organizationId}", not "${org}"`);
    }
  }

  // -- statements ------------------------------------------------------------
  const expectedStatements = [...canonical.statementIds].sort();
  if (!same(ids(readback.statements), expectedStatements)) {
    violations.push(
      `expected exactly 3 canonical statements [${expectedStatements.join(', ')}], found [${ids(readback.statements).join(', ') || 'none'}]`
    );
  }
  for (const statement of readback.statements) {
    if (statement.organizationId !== org) {
      violations.push(
        `statement ${statement.id} belongs to "${statement.organizationId}", not "${org}"`
      );
    }
    if (statement.statementPackId !== canonical.packId) {
      violations.push(
        `statement ${statement.id} is not linked to the canonical pack (statement_pack_id="${statement.statementPackId ?? '<null>'}")`
      );
    }
  }

  // -- statement values ------------------------------------------------------
  const expectedValues = [...canonical.statementValueIds].sort();
  if (!same(ids(readback.values), expectedValues)) {
    const actual = new Set(readback.values.map((row) => row.id));
    const missingValues = expectedValues.filter((id) => !actual.has(id));
    violations.push(
      `expected ${expectedValues.length} canonical statement values, found ${readback.values.length}` +
        (missingValues.length ? ` (missing ${missingValues.length}, e.g. ${missingValues[0]})` : '')
    );
  }
  const canonicalStatementIds = new Set(canonical.statementIds);
  for (const value of readback.values) {
    if (!canonicalStatementIds.has(value.statementId)) {
      violations.push(
        `statement value ${value.id} hangs off "${value.statementId}", which is not a canonical statement`
      );
    }
  }

  // -- analysis --------------------------------------------------------------
  if (!same(ids(readback.analyses), [canonical.analysisId])) {
    violations.push(
      `expected exactly 1 canonical analysis (${canonical.analysisId}), found [${ids(readback.analyses).join(', ') || 'none'}]`
    );
  }
  for (const analysis of readback.analyses) {
    if (analysis.organizationId !== org) {
      violations.push(`analysis ${analysis.id} belongs to "${analysis.organizationId}", not "${org}"`);
    }
    if (analysis.sourceStatementPackId !== canonical.packId) {
      violations.push(
        `analysis ${analysis.id} is not sourced from the canonical pack (source_statement_pack_id="${analysis.sourceStatementPackId ?? '<null>'}")`
      );
    }
    const referenced = new Set(analysis.sourceStatementIds || []);
    const uncovered = canonical.statementIds.filter((id) => !referenced.has(id));
    if (uncovered.length) {
      violations.push(
        `analysis ${analysis.id} does not reference all 3 canonical statements (missing ${uncovered.join(', ')})`
      );
    }
  }

  // -- model -----------------------------------------------------------------
  if (!same(ids(readback.models), [canonical.modelId])) {
    violations.push(
      `expected exactly 1 canonical model (${canonical.modelId}), found [${ids(readback.models).join(', ') || 'none'}]`
    );
  }
  for (const model of readback.models) {
    if (model.organizationId !== org) {
      violations.push(`model ${model.id} belongs to "${model.organizationId}", not "${org}"`);
    }
    if (model.sourceStatementPackId !== canonical.packId) {
      violations.push(
        `model ${model.id} is not sourced from the canonical pack (source_statement_pack_id="${model.sourceStatementPackId ?? '<null>'}")`
      );
    }
  }

  return { ok: violations.length === 0, violations };
}

/** Throwing wrapper — `--write` calls this and refuses on any violation. */
export function assertCanonicalFixtureMaterialized(
  readback: CanonicalFixtureReadback,
  organizationId: string
): void {
  const { ok, violations } = verifyCanonicalFixture(readback, organizationId);
  if (ok) return;
  fail(
    `Refusing to quarantine: the canonical Atelier Finance fixture is not fully materialized in "${normalizeText(organizationId)}". ` +
      `Run the demo seed FIRST, otherwise the demo Finance module is left empty.\n  - ${violations.join('\n  - ')}`
  );
}

// ---------------------------------------------------------------------------
// 4. Run-specific quarantine organization
// ---------------------------------------------------------------------------

/** Marker written into the quarantine org's name; also required on reuse. */
export const QUARANTINE_ORG_MARKER = 'FIN-005 quarantine';

export function normalizeRunId(runId: unknown): string {
  const normalized = normalizeText(runId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) {
    fail('A run id is required (pass --run-id, or let the CLI derive one from the run timestamp).');
  }
  return normalized;
}

/**
 * A RUN-SPECIFIC quarantine org id.
 *
 * WHY PER RUN: a shared `<org>-fin005-quarantine` accumulates rows from every
 * run, so a rollback of run N can no longer tell its own rows apart from run
 * N-1's, and one bad run poisons the recovery path of every earlier one.
 */
export function buildQuarantineOrgId(demoOrgId: string, runId: unknown): string {
  const org = normalizeText(demoOrgId);
  if (!org) fail('Missing demo organization id.');
  const id = `${org}-fin005-quarantine-${normalizeRunId(runId)}`;
  if (id === org) fail('Demo and quarantine organizations must differ.');
  return id;
}

export function buildQuarantineOrgName(runId: unknown): string {
  return `${QUARANTINE_ORG_MARKER} (run ${normalizeRunId(runId)})`;
}

export interface QuarantineOrganizationRow {
  id: string;
  name: string | null;
  organizationType: string | null;
  status: string | null;
  isActive: boolean | null;
  userCount: number;
  memberCount: number;
}

/**
 * Decide whether an EXISTING organization may be reused as this run's
 * quarantine tenant. Fail closed: anything not exactly right is refused.
 *
 * The user/member count check is the one that matters most. Moving rows into an
 * organization that has users means handing another tenant's members somebody
 * else's financial statements. There is no flag that makes that acceptable.
 */
export function assertQuarantineOrganizationReusable(
  row: QuarantineOrganizationRow | null | undefined,
  expected: { id: string; name: string }
): 'create' | 'reuse' {
  if (!row) return 'create';

  const problems: string[] = [];
  if (row.id !== expected.id) {
    problems.push(`id "${row.id}" is not the expected "${expected.id}"`);
  }
  if (normalizeText(row.organizationType).toUpperCase() !== 'DEMO') {
    problems.push(`organization_type is "${row.organizationType ?? '<null>'}", expected "DEMO"`);
  }
  if (normalizeText(row.name) !== expected.name) {
    problems.push(`name is "${row.name ?? '<null>'}", expected the run marker "${expected.name}"`);
  }
  const status = normalizeText(row.status).toLowerCase();
  if (status && status !== 'inactive') {
    problems.push(`status is "${row.status}", expected "inactive"`);
  }
  if (row.isActive === true) {
    problems.push('is_active is true, expected false');
  }
  if (Number(row.userCount) !== 0) {
    problems.push(`it has ${row.userCount} user(s) — rows must never be moved into a tenant with users`);
  }
  if (Number(row.memberCount) !== 0) {
    problems.push(
      `it has ${row.memberCount} organization_member(s) — rows must never be moved into a tenant with members`
    );
  }

  if (problems.length) {
    fail(
      `Refusing to use "${row.id}" as the quarantine tenant:\n  - ${problems.join('\n  - ')}\n` +
        `Pick a fresh --run-id so the script creates its own empty quarantine organization.`
    );
  }
  return 'reuse';
}

// ---------------------------------------------------------------------------
// 5. Dependency postconditions
// ---------------------------------------------------------------------------

export interface DependencyGraph {
  packs: Array<{ id: string; organizationId: string }>;
  statements: Array<{ id: string; organizationId: string; statementPackId: string | null }>;
  values: Array<{ id: string; statementId: string }>;
  ingestRuns: Array<{ id: string; organizationId: string; statementId: string | null }>;
  analyses: Array<{
    id: string;
    organizationId: string;
    sourceStatementPackId: string | null;
    sourceStatementIds?: string[];
  }>;
  models: Array<{
    id: string;
    organizationId: string;
    sourceStatementPackId: string | null;
    sourceAnalysisId?: string | null;
  }>;
}

export interface DependencyViolation {
  kind: 'cross-org' | 'dangling';
  from: string;
  to: string;
  detail: string;
}

/**
 * Prove that moving rows between tenants left no reference pointing across the
 * boundary.
 *
 * The graph must contain EVERY row of both the demo and quarantine tenants —
 * a reference to an id that is not in the graph therefore points at a third
 * organization (or at nothing), and both are violations.
 *
 * Run before COMMIT (any violation ⇒ ROLLBACK) and again after a rollback.
 */
export function findCrossOrgDependencyViolations(graph: DependencyGraph): DependencyViolation[] {
  const violations: DependencyViolation[] = [];
  const packOrg = new Map(graph.packs.map((row) => [row.id, row.organizationId]));
  const statementOrg = new Map(graph.statements.map((row) => [row.id, row.organizationId]));
  const analysisOrg = new Map(graph.analyses.map((row) => [row.id, row.organizationId]));

  const check = (
    from: string,
    fromOrg: string,
    to: string | null | undefined,
    lookup: Map<string, string>,
    relation: string
  ) => {
    if (to === null || to === undefined || to === '') return;
    const targetOrg = lookup.get(to);
    if (targetOrg === undefined) {
      violations.push({
        kind: 'dangling',
        from,
        to,
        detail: `${relation}: "${to}" is not in either scanned tenant — it points at a third organization or at nothing`,
      });
      return;
    }
    if (targetOrg !== fromOrg) {
      violations.push({
        kind: 'cross-org',
        from,
        to,
        detail: `${relation}: "${from}" is in "${fromOrg}" but "${to}" is in "${targetOrg}"`,
      });
    }
  };

  // pack → statement (the statement carries the FK)
  for (const statement of graph.statements) {
    check(
      statement.id,
      statement.organizationId,
      statement.statementPackId,
      packOrg,
      'statement→pack'
    );
  }

  // statement → values
  for (const value of graph.values) {
    if (!statementOrg.has(value.statementId)) {
      violations.push({
        kind: 'dangling',
        from: value.id,
        to: value.statementId,
        detail: `value→statement: "${value.statementId}" is not in either scanned tenant`,
      });
    }
  }

  // ingest → statement
  for (const run of graph.ingestRuns) {
    check(run.id, run.organizationId, run.statementId, statementOrg, 'ingest-run→statement');
  }

  // analysis → pack / statements
  for (const analysis of graph.analyses) {
    check(
      analysis.id,
      analysis.organizationId,
      analysis.sourceStatementPackId,
      packOrg,
      'analysis→pack'
    );
    for (const statementId of analysis.sourceStatementIds || []) {
      check(analysis.id, analysis.organizationId, statementId, statementOrg, 'analysis→statement');
    }
  }

  // model → analysis / source pack
  for (const model of graph.models) {
    check(model.id, model.organizationId, model.sourceStatementPackId, packOrg, 'model→pack');
    check(model.id, model.organizationId, model.sourceAnalysisId, analysisOrg, 'model→analysis');
  }

  return violations;
}

export function assertNoCrossOrgDependencies(graph: DependencyGraph, phase: string): void {
  const violations = findCrossOrgDependencyViolations(graph);
  if (violations.length === 0) return;
  fail(
    `Dependency postcondition failed (${phase}) — ${violations.length} broken reference(s). Rolling back.\n  - ` +
      violations.map((violation) => violation.detail).join('\n  - ')
  );
}

// ---------------------------------------------------------------------------
// 6. Manifest integrity — checksum, per-record fingerprint, rollback refusal
// ---------------------------------------------------------------------------

/**
 * Columns excluded from a row fingerprint.
 *
 * Deliberately EMPTY. No `updated_at` trigger exists on the Finance tables
 * (checked: `grep "CREATE TRIGGER" server/migrations` has no live trigger on
 * any `financial_*` table), so every difference between the recorded state and
 * the live row is a real edit — which is exactly what the rollback must refuse
 * on. Keep this empty unless a trigger is introduced, and say so here if it is.
 */
export const FINGERPRINT_IGNORED_COLUMNS: ReadonlyArray<string> = Object.freeze([]);

function canonicalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      // Drop undefined-valued keys, exactly as `JSON.stringify` does. Without
      // this a manifest signed in memory and the same manifest read back from
      // disk hash differently, and every rollback would refuse.
      if (source[key] === undefined) continue;
      out[key] = canonicalize(source[key]);
    }
    return out;
  }
  if (typeof value === 'bigint') return value.toString();
  return value;
}

/** Stable JSON — sorted keys, Dates as ISO, `undefined` as `null`. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/** SHA-256 over the row's material columns. */
export function computeRowFingerprint(columns: Record<string, unknown>): string {
  const material: Record<string, unknown> = {};
  for (const key of Object.keys(columns)) {
    if (FINGERPRINT_IGNORED_COLUMNS.includes(key)) continue;
    material[key] = columns[key];
  }
  return createHash('sha256').update(canonicalJson(material)).digest('hex');
}

/**
 * The row as it MUST look after quarantine: same columns, new organization, the
 * link columns cleared. Recorded up front so the rollback can prove nothing
 * touched the row in between.
 */
export function projectQuarantinedRow(
  priorState: Record<string, unknown>,
  params: { toOrganizationId: string; clearedColumns: string[] }
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...priorState, organization_id: params.toOrganizationId };
  for (const column of params.clearedColumns) {
    if (column in next) next[column] = null;
  }
  return next;
}

export interface ManifestEntry {
  table: string;
  id: string;
  fromOrganizationId: string;
  toOrganizationId: string;
  displayName: string;
  /** Prior `statement_pack_id` — kept for backwards compatibility with v1 manifests. */
  statementPackId?: string | null;
  /** Every link column cleared on quarantine, with its prior value. */
  clearedLinks?: Record<string, string | null>;
  /** EVERY column of the row before the move — the full restore payload. */
  priorState?: Record<string, unknown>;
  priorFingerprint?: string;
  /** Fingerprint the row must still have at rollback time. */
  expectedQuarantinedFingerprint?: string;
}

export type ManifestStatus = 'PREPARED' | 'COMMITTED';

export interface CleanupManifest {
  label: string;
  version: number;
  runId: string;
  status: ManifestStatus;
  demoOrgId: string;
  quarantineOrgId: string;
  host: string;
  database: string;
  preparedAt: string;
  completedAt?: string;
  /** Full prior state, written and fsync'd BEFORE the transaction commits. */
  plannedEntries: ManifestEntry[];
  /** Confirmed by `RETURNING` after the UPDATEs; empty in a PREPARED manifest. */
  entries: ManifestEntry[];
  checksum?: string;
}

export const MANIFEST_VERSION = 2;

/** SHA-256 over the whole manifest except the checksum field itself. */
export function computeManifestChecksum(manifest: CleanupManifest): string {
  const { checksum: _ignored, ...rest } = manifest;
  return createHash('sha256').update(canonicalJson(rest)).digest('hex');
}

export function signManifest(manifest: CleanupManifest): CleanupManifest {
  return { ...manifest, checksum: computeManifestChecksum(manifest) };
}

export function assertManifestIntegrity(manifest: CleanupManifest): void {
  if (!manifest || typeof manifest !== 'object') fail('Manifest is not an object.');
  if (!manifest.checksum) {
    fail('Manifest carries no checksum — refusing to trust it. Manifests are untrusted files.');
  }
  const expected = computeManifestChecksum(manifest);
  if (expected !== manifest.checksum) {
    fail(
      `Manifest checksum mismatch (expected ${expected}, found ${manifest.checksum}). ` +
        `The file was edited or truncated — refusing to run.`
    );
  }
}

/**
 * Which entries a rollback must replay.
 *
 * RECOVERY AFTER A CRASH BETWEEN `COMMIT` AND THE FINAL MANIFEST WRITE: the
 * on-disk manifest is still `PREPARED` with an empty `entries`, but its
 * `plannedEntries` already carry the full prior state — they were written and
 * fsync'd before the transaction committed. The rows may or may not have moved;
 * the rollback is idempotent either way because it matches on
 * `organization_id = quarantineOrgId` and refuses on a fingerprint mismatch.
 */
export function resolveRollbackEntries(manifest: CleanupManifest): {
  entries: ManifestEntry[];
  recoveredFromPlan: boolean;
} {
  const committed = Array.isArray(manifest.entries) ? manifest.entries : [];
  if (committed.length > 0) return { entries: committed, recoveredFromPlan: false };
  const planned = Array.isArray(manifest.plannedEntries) ? manifest.plannedEntries : [];
  return { entries: planned, recoveredFromPlan: planned.length > 0 };
}

/** Every entry must agree with the manifest header and name a known table. */
export function assertManifestEntriesConsistent(
  manifest: CleanupManifest,
  entries: ManifestEntry[],
  knownTables: ReadonlySet<string>
): void {
  for (const entry of entries) {
    if (!knownTables.has(entry.table)) {
      fail(`Manifest references unknown table "${entry.table}".`);
    }
    if (
      entry.fromOrganizationId !== manifest.demoOrgId ||
      entry.toOrganizationId !== manifest.quarantineOrgId
    ) {
      fail(
        `Manifest entry "${entry.id}" declares an organization pair that differs from the manifest header. Refusing to run.`
      );
    }
    if (isCanonicalDemoRowId(entry.id, manifest.demoOrgId, entry.table)) {
      fail(`Manifest entry "${entry.id}" is a CANONICAL row — it can never have been quarantined.`);
    }
  }
}

/** Rollback refuses when a record was modified after quarantine. */
export function assertRecordUnchangedSinceQuarantine(
  entry: ManifestEntry,
  currentRow: Record<string, unknown> | null | undefined
): void {
  if (!entry.expectedQuarantinedFingerprint) {
    fail(
      `Manifest entry "${entry.id}" has no post-quarantine fingerprint (v1 manifest). ` +
        `Refusing to roll back blind — restore it by hand after reviewing the row.`
    );
  }
  if (!currentRow) {
    fail(
      `Row "${entry.id}" (${entry.table}) is no longer in the quarantine tenant — refusing to roll back a set that no longer matches the manifest.`
    );
  }
  const actual = computeRowFingerprint(currentRow);
  if (actual !== entry.expectedQuarantinedFingerprint) {
    fail(
      `Row "${entry.id}" (${entry.table}) changed after it was quarantined ` +
        `(fingerprint ${actual} ≠ recorded ${entry.expectedQuarantinedFingerprint}). ` +
        `Rolling back would silently discard that change — refusing.`
    );
  }
}

/**
 * P2 — validate the `statement_pack_id` a rollback is about to restore.
 *
 * The pack must (a) still exist, (b) belong to the demo organization the rows
 * are returning to, and (c) be exactly the pack recorded in the prior state.
 * Without (b) the restore would re-link a statement into a pack in some other
 * tenant.
 */
export function assertStatementPackRestorable(params: {
  entryId: string;
  recordedPackId: string | null | undefined;
  packRow: { id: string; organizationId: string } | null | undefined;
  demoOrgId: string;
}): void {
  const recorded = params.recordedPackId;
  if (recorded === null || recorded === undefined || recorded === '') return;
  if (!params.packRow) {
    fail(
      `Rollback of "${params.entryId}" would restore statement_pack_id="${recorded}", but that pack no longer exists.`
    );
  }
  if (params.packRow.id !== recorded) {
    fail(
      `Rollback of "${params.entryId}": pack lookup returned "${params.packRow.id}" for recorded "${recorded}".`
    );
  }
  if (params.packRow.organizationId !== params.demoOrgId) {
    fail(
      `Rollback of "${params.entryId}" would restore a link to pack "${recorded}", which belongs to ` +
        `"${params.packRow.organizationId}", not to the demo tenant "${params.demoOrgId}".`
    );
  }
}
