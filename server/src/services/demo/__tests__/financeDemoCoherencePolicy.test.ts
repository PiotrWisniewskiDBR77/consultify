/**
 * FIN-005 — the rules that decide what may stay in the demo Finance tenant,
 * which database may be touched, and whether a rollback plan is still valid.
 *
 * The cleanup script moves rows between tenants based on this policy, so an
 * error here either leaves foreign records on a client demo, hides a legitimate
 * one, or — the case these tests exist for — points the whole thing at the
 * wrong database. The cases below are the ones the 2026-08-01 staging probe
 * actually produced, plus the near-misses that would make a naive rule unsafe.
 */

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { getAtelierFinanceCanonicalIds } from '../atelierFinanceSeed.js';
import {
  assertApprovedDemoTarget,
  assertCanonicalFixtureMaterialized,
  assertCanonicalFixtureUnchanged,
  assertDemoOrganizationMarker,
  assertManifestEntriesConsistent,
  assertManifestIntegrity,
  assertNoCrossOrgDependencies,
  assertQuarantineOrganizationReusable,
  assertRecordUnchangedSinceQuarantine,
  assertStatementPackRestorable,
  buildQuarantineOrgId,
  buildQuarantineOrgName,
  CANONICAL_FIXTURE_READY_STATE,
  type CanonicalFixtureReadback,
  canonicalJson,
  classifyFinanceDemoRows,
  type CleanupManifest,
  computeCanonicalFixtureDigest,
  computeRowFingerprint,
  type DependencyGraph,
  describeDemoMarkerProblem,
  FIN005_APPROVED_DEMO_TARGETS,
  financeDemoNameFlags,
  findCrossOrgDependencyViolations,
  isCanonicalDemoRowId,
  MANIFEST_VERSION,
  type ManifestEntry,
  manifestSignaturePayload,
  projectQuarantinedRow,
  QUARANTINE_ORG_MARKER,
  type QuarantineOrganizationRow,
  resolveRollbackEntries,
  signManifest,
  verifyCanonicalFixture,
} from '../financeDemoCoherencePolicy.js';
import {
  computeManifestHmac,
  MANIFEST_HMAC_KEY_ENV,
  MANIFEST_HMAC_KEY_ID_ENV,
  type ManifestSigningKey,
  resolveManifestSigningKey,
} from '../financeDemoManifestSignature.js';

/** A key for the tests. Never a real one, and never printed by the code. */
const KEY: ManifestSigningKey = resolveManifestSigningKey({
  [MANIFEST_HMAC_KEY_ENV]: 'fin005-unit-test-key-0123456789abcdef',
  [MANIFEST_HMAC_KEY_ID_ENV]: 'test-key-a',
});
const OTHER_KEY: ManifestSigningKey = resolveManifestSigningKey({
  [MANIFEST_HMAC_KEY_ENV]: 'fin005-unit-test-key-ROTATED-9876543210',
  [MANIFEST_HMAC_KEY_ID_ENV]: 'test-key-b',
});

const ORG = 'demo-org';
const CANONICAL = getAtelierFinanceCanonicalIds(ORG);
/** The state phase 2 of the seed writes; anything else is an unfinished seed. */
const READY = CANONICAL_FIXTURE_READY_STATE;

// ---------------------------------------------------------------------------
// P1 — canonical ownership by EXACT whitelist
// ---------------------------------------------------------------------------

describe('isCanonicalDemoRowId — exact whitelist, never a prefix', () => {
  it('accepts the exact ids of the canonical Atelier fixture', () => {
    expect(isCanonicalDemoRowId(CANONICAL.packId, ORG)).toBe(true);
    expect(isCanonicalDemoRowId(CANONICAL.analysisId, ORG)).toBe(true);
    expect(isCanonicalDemoRowId(CANONICAL.modelId, ORG)).toBe(true);
    for (const id of CANONICAL.statementIds) {
      expect(isCanonicalDemoRowId(id, ORG)).toBe(true);
    }
  });

  it('classifies OLD technical fixtures carrying the canonical prefix as FOREIGN', () => {
    // This is the whole point of the change: every one of these was minted with
    // `makeId(orgId, …)`, so `id.startsWith('<org>--')` protected them.
    expect(isCanonicalDemoRowId(`${ORG}--financial-model--m16-seed`, ORG)).toBe(false);
    expect(isCanonicalDemoRowId(`${ORG}--statement--staging-probe`, ORG)).toBe(false);
    expect(isCanonicalDemoRowId(`${ORG}--analysis--fixture-01`, ORG)).toBe(false);
    expect(isCanonicalDemoRowId(`${ORG}--statement-pack--dbr77-manufacturing`, ORG)).toBe(false);
  });

  it('scopes the whitelist per table', () => {
    expect(isCanonicalDemoRowId(CANONICAL.modelId, ORG, 'financial_models')).toBe(true);
    // The same id found in another table is NOT canonical there.
    expect(isCanonicalDemoRowId(CANONICAL.modelId, ORG, 'financial_analyses')).toBe(false);
    expect(isCanonicalDemoRowId(CANONICAL.packId, ORG, 'financial_statement_packs')).toBe(true);
    expect(isCanonicalDemoRowId(CANONICAL.packId, ORG, 'financial_statements')).toBe(false);
  });

  it('rejects rows that did not come from the seed at all', () => {
    expect(isCanonicalDemoRowId('7c9d2f11-4c11-4d6b-9a2e-1f0a2b3c4d5e', ORG)).toBe(false);
    expect(isCanonicalDemoRowId('staging-finance-pl-01', ORG)).toBe(false);
  });

  it('does not treat another tenant’s seeded row as canonical here', () => {
    expect(isCanonicalDemoRowId('dbr77--financial-model--transformation-2015-roi', ORG)).toBe(
      false
    );
    // …and the same id IS canonical for its own tenant.
    expect(isCanonicalDemoRowId(getAtelierFinanceCanonicalIds('dbr77').modelId, 'dbr77')).toBe(
      true
    );
  });

  it('is safe on empty input instead of matching everything', () => {
    expect(isCanonicalDemoRowId('', ORG)).toBe(false);
    expect(isCanonicalDemoRowId(null, ORG)).toBe(false);
    expect(isCanonicalDemoRowId(CANONICAL.modelId, '')).toBe(false);
  });
});

describe('financeDemoNameFlags — advisory only', () => {
  it('flags the exact names found in the demo tenant on 2026-08-01', () => {
    expect(financeDemoNameFlags('DBR77 Manufacturing')).toContain('DBR77');
    expect(financeDemoNameFlags('DBR77 Staging Financial Analysis')).toEqual(
      expect.arrayContaining(['DBR77', 'staging'])
    );
    expect(financeDemoNameFlags('DBR77 Staging Finance Model (kopia)')).toEqual(
      expect.arrayContaining(['DBR77', 'staging', 'ui-duplicate'])
    );
    expect(financeDemoNameFlags('Grupa Apator FY25-FY27 3Y Forecast')).toContain('Apator');
    expect(financeDemoNameFlags('M16 seed model')).toContain('technical-seed');
  });

  it('leaves the canonical Atelier names unflagged', () => {
    expect(financeDemoNameFlags('Atelier Toys')).toEqual([]);
    expect(financeDemoNameFlags('Atelier Toys — Transformation 2015 ROI')).toEqual([]);
  });

  it('returns no flags for empty names rather than throwing', () => {
    expect(financeDemoNameFlags('')).toEqual([]);
    expect(financeDemoNameFlags(null)).toEqual([]);
  });
});

describe('classifyFinanceDemoRows', () => {
  it('splits the observed staging tenant into canonical and foreign', () => {
    const { canonical, foreign } = classifyFinanceDemoRows(
      [
        { table: 'financial_statement_packs', id: CANONICAL.packId, displayName: 'Atelier Toys' },
        { table: 'financial_statements', id: 'uuid-dbr77-pl', displayName: 'DBR77 Manufacturing' },
        {
          table: 'financial_analyses',
          id: 'uuid-dbr77-analysis',
          displayName: 'DBR77 Staging Financial Analysis',
        },
        {
          table: 'financial_models',
          id: 'uuid-copy-1',
          displayName: 'DBR77 Staging Finance Model (kopia)',
        },
        {
          table: 'financial_models',
          id: CANONICAL.modelId,
          displayName: 'Atelier Toys — Transformation 2015 ROI',
        },
      ],
      ORG
    );

    expect(canonical.map((row) => row.displayName)).toEqual([
      'Atelier Toys',
      'Atelier Toys — Transformation 2015 ROI',
    ]);
    expect(foreign).toHaveLength(3);
  });

  it('marks a prefix-carrying old fixture as foreign AND reports the prefix for the operator', () => {
    const { canonical, foreign } = classifyFinanceDemoRows(
      [
        {
          table: 'financial_models',
          id: `${ORG}--financial-model--m16-seed`,
          displayName: 'M16 seed model',
        },
      ],
      ORG
    );
    expect(canonical).toEqual([]);
    expect(foreign).toHaveLength(1);
    expect(foreign[0].legacyPrefixed).toBe(true);
    // The name flag is corroboration only — the whitelist already decided.
    expect(foreign[0].flags).toContain('technical-seed');
  });

  it('classifies an unnamed leftover as foreign even with no name flags', () => {
    const { foreign } = classifyFinanceDemoRows(
      [{ table: 'financial_models', id: 'uuid-unnamed', displayName: 'Untitled' }],
      ORG
    );
    expect(foreign).toHaveLength(1);
    expect(foreign[0].flags).toEqual([]);
    expect(foreign[0].legacyPrefixed).toBe(false);
  });

  it('keeps a canonical row even if its name contains a flagged word', () => {
    const { canonical, foreign } = classifyFinanceDemoRows(
      [
        {
          table: 'financial_models',
          id: CANONICAL.modelId,
          displayName: 'Atelier Toys — seed scenario',
        },
      ],
      ORG
    );
    expect(foreign).toEqual([]);
    expect(canonical).toHaveLength(1);
    expect(canonical[0].flags).toContain('technical-seed');
  });

  it('tolerates an empty tenant', () => {
    const result = classifyFinanceDemoRows([], ORG);
    expect(result.all).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P1 — environment guard, hard allowlist
// ---------------------------------------------------------------------------

const APPROVED = FIN005_APPROVED_DEMO_TARGETS[0];
const approvedActual = {
  host: APPROVED.host,
  port: APPROVED.port,
  database: APPROVED.database,
};

describe('assertApprovedDemoTarget', () => {
  it('accepts exactly the approved Railway demo fingerprint', () => {
    const result = assertApprovedDemoTarget({
      declared: { ...APPROVED },
      actual: approvedActual,
    });
    expect(result.organizationId).toBe(APPROVED.organizationId);
  });

  it('refuses when the target is not declared explicitly — no silent defaults', () => {
    expect(() =>
      assertApprovedDemoTarget({ declared: { host: APPROVED.host }, actual: approvedActual })
    ).toThrow(/must be declared explicitly/i);
  });

  it('refuses an unknown host even when everything else is declared correctly', () => {
    expect(() =>
      assertApprovedDemoTarget({
        declared: { ...APPROVED, host: 'shuttle.proxy.rlwy.net' },
        actual: { ...approvedActual, host: 'shuttle.proxy.rlwy.net' },
      })
    ).toThrow(/not on the FIN-005 allowlist/i);
  });

  it('REFUSES production by fingerprint, regardless of the organization found there', () => {
    // A `DEMO`-typed organization exists in production (DEMO_ORG_ID is a
    // documented production setting) — the org row therefore cannot be the
    // check. The fingerprint is.
    expect(() =>
      assertApprovedDemoTarget({
        declared: { ...APPROVED, host: 'centerbeam.proxy.rlwy.net' },
        actual: { ...approvedActual, host: 'centerbeam.proxy.rlwy.net' },
      })
    ).toThrow(/forbidden production database host/i);

    expect(() =>
      assertApprovedDemoTarget({
        declared: { ...APPROVED, railwayEnvironment: 'production' },
        actual: approvedActual,
      })
    ).toThrow(/forbidden production identifier/i);
  });

  it('refuses production even if somebody adds it to the allowlist', () => {
    const poisoned = [
      { ...APPROVED, railwayEnvironment: 'production', host: 'centerbeam.proxy.rlwy.net' },
    ];
    expect(() =>
      assertApprovedDemoTarget({
        declared: poisoned[0],
        actual: { ...approvedActual, host: 'centerbeam.proxy.rlwy.net' },
        allowlist: poisoned,
      })
    ).toThrow(/forbidden/i);
  });

  it('refuses when the declaration does not match the connection actually opened', () => {
    expect(() =>
      assertApprovedDemoTarget({
        declared: { ...APPROVED },
        actual: { ...approvedActual, host: 'somewhere-else.rlwy.net' },
      })
    ).toThrow(/declared host .* but the connection resolves to/i);

    expect(() =>
      assertApprovedDemoTarget({
        declared: { ...APPROVED },
        actual: { ...approvedActual, database: 'other' },
      })
    ).toThrow(/declared database .* but the connection resolves to/i);

    expect(() =>
      assertApprovedDemoTarget({
        declared: { ...APPROVED },
        actual: { ...approvedActual, port: 5432 },
      })
    ).toThrow(/declared port .* but the connection resolves to/i);
  });

  // -- P1: the observed port must EXIST and match EXACTLY -------------------
  describe('observed port', () => {
    it('accepts only an exact match', () => {
      expect(
        assertApprovedDemoTarget({
          declared: { ...APPROVED },
          actual: { ...approvedActual, port: APPROVED.port },
        }).port
      ).toBe(APPROVED.port);
    });

    it('REFUSES a connection string with no port instead of assuming the default', () => {
      // `postgres://trolley.proxy.rlwy.net/railway` has no port; the driver
      // would silently use 5432 — a different server from the approved 28146.
      for (const missing of [null, undefined]) {
        expect(() =>
          assertApprovedDemoTarget({
            declared: { ...APPROVED },
            actual: { ...approvedActual, port: missing },
          })
        ).toThrow(/carries no port/i);
      }
    });

    it('refuses a NaN or nonsense observed port', () => {
      for (const bogus of [Number.NaN, 0, -1, 70000, 5432.5]) {
        expect(() =>
          assertApprovedDemoTarget({
            declared: { ...APPROVED },
            actual: { ...approvedActual, port: bogus },
          })
        ).toThrow(/port/i);
      }
      expect(() =>
        assertApprovedDemoTarget({
          declared: { ...APPROVED },
          actual: { ...approvedActual, port: Number.NaN },
        })
      ).toThrow(/not a valid TCP port/i);
    });

    it('refuses a different port on the very same approved host', () => {
      expect(() =>
        assertApprovedDemoTarget({
          declared: { ...APPROVED },
          actual: { ...approvedActual, port: 5432 },
        })
      ).toThrow(/declared port 28146 but the connection resolves to 5432/);
    });

    it('refuses a declared port that is not a valid TCP port', () => {
      expect(() =>
        assertApprovedDemoTarget({
          declared: { ...APPROVED, port: 'not-a-port' },
          actual: approvedActual,
        })
      ).toThrow(/not a valid TCP port/i);
    });

    it('parses the DECLARED port strictly — digits only, no Number() exotica', () => {
      // `Number()` happily turns all three of these into the approved port
      // (0x6DA2 = 28066, 2.8146e4 = 28146, '28146.0' = 28146). None is a port an
      // operator typed on purpose, and "exactly this port" must mean exactly.
      for (const exotic of ['0x6DA2', '2.8146e4', '28146.0', ' 28146 x', '+28146', '28146e0']) {
        expect(() =>
          assertApprovedDemoTarget({
            declared: { ...APPROVED, port: exotic },
            actual: { ...approvedActual, port: 28146 },
          })
        ).toThrow(/not a valid TCP port/i);
      }
      // The plain decimal string still works — this is a tightening, not a break.
      expect(
        assertApprovedDemoTarget({
          declared: { ...APPROVED, port: '28146' },
          actual: { ...approvedActual, port: 28146 },
        }).port
      ).toBe(28146);
    });
  });

  it('refuses a mismatched project, environment, service or organization id', () => {
    for (const override of [
      { railwayProject: 'consultify-sandbox' },
      { railwayEnvironment: 'staging' },
      { railwayService: 'Postgres-copy' },
      { organizationId: 'acme-corp' },
    ]) {
      expect(() =>
        assertApprovedDemoTarget({ declared: { ...APPROVED, ...override }, actual: approvedActual })
      ).toThrow(/not on the FIN-005 allowlist/i);
    }
  });
});

// ---------------------------------------------------------------------------
// P1 — the demo marker must EXIST and equal exactly 'DEMO'
// ---------------------------------------------------------------------------

describe('demo organization marker', () => {
  const check = (observed: { columnPresent: boolean; value: string | null | undefined }) => () =>
    assertDemoOrganizationMarker({ organizationId: ORG, observed, role: 'demo organization' });

  it('accepts exactly "DEMO"', () => {
    expect(check({ columnPresent: true, value: 'DEMO' })).not.toThrow();
    expect(describeDemoMarkerProblem({ columnPresent: true, value: 'DEMO' })).toBeNull();
  });

  it('REFUSES when the column does not exist in this schema', () => {
    // No column ⇒ no evidence. "Unknown" must never read as "demo".
    expect(check({ columnPresent: false, value: null })).toThrow(/no organization_type column/i);
    expect(check({ columnPresent: false, value: 'DEMO' })).toThrow(/no organization_type column/i);
  });

  it('REFUSES a NULL value', () => {
    expect(check({ columnPresent: true, value: null })).toThrow(/organization_type is NULL/);
    expect(check({ columnPresent: true, value: undefined })).toThrow(/organization_type is NULL/);
  });

  it('REFUSES an empty string', () => {
    expect(check({ columnPresent: true, value: '' })).toThrow(/empty string/i);
  });

  it('REFUSES every other value, including a lower-case or padded near-miss', () => {
    expect(check({ columnPresent: true, value: 'TRIAL' })).toThrow(/is "TRIAL"/);
    expect(check({ columnPresent: true, value: 'PAID' })).toThrow(/is "PAID"/);
    expect(check({ columnPresent: true, value: 'CUSTOMER' })).toThrow(/is "CUSTOMER"/);
    // Case-sensitive by decision (packet §11.6: "równać się dokładnie DEMO").
    expect(check({ columnPresent: true, value: 'demo' })).toThrow(/case-sensitive on purpose/);
    expect(check({ columnPresent: true, value: 'Demo' })).toThrow(/case-sensitive on purpose/);
    expect(check({ columnPresent: true, value: ' DEMO ' })).toThrow(/case-sensitive on purpose/);
    expect(check({ columnPresent: true, value: 'DEMO_ORG' })).toThrow(/is "DEMO_ORG"/);
  });

  it('refuses a missing observation altogether', () => {
    expect(() => assertDemoOrganizationMarker({ organizationId: ORG, observed: null })).toThrow(
      /no organization_type column/i
    );
  });
});

// ---------------------------------------------------------------------------
// P1 — run-specific quarantine organization, fail closed
// ---------------------------------------------------------------------------

describe('quarantine organization', () => {
  it('derives a RUN-SPECIFIC id so two runs never share a tenant', () => {
    const a = buildQuarantineOrgId(ORG, '2026-08-01T10-00-00-000Z');
    const b = buildQuarantineOrgId(ORG, '2026-08-01T11-30-00-000Z');
    expect(a).not.toBe(b);
    expect(a.startsWith(`${ORG}-fin005-quarantine-`)).toBe(true);
  });

  it('refuses to build an id without a run id', () => {
    expect(() => buildQuarantineOrgId(ORG, '')).toThrow(/run id is required/i);
    expect(() => buildQuarantineOrgId(ORG, '   ')).toThrow(/run id is required/i);
  });

  it('creates the tenant when it does not exist yet', () => {
    expect(
      assertQuarantineOrganizationReusable(null, { id: 'x', name: buildQuarantineOrgName('r1') })
    ).toBe('create');
  });

  const okRow = (
    overrides: Partial<QuarantineOrganizationRow> = {}
  ): QuarantineOrganizationRow => ({
    id: `${ORG}-fin005-quarantine-r1`,
    name: buildQuarantineOrgName('r1'),
    organizationTypeColumnPresent: true,
    organizationType: 'DEMO',
    status: 'inactive',
    isActive: false,
    userCount: 0,
    memberCount: 0,
    ...overrides,
  });

  const expected = {
    id: `${ORG}-fin005-quarantine-r1`,
    name: buildQuarantineOrgName('r1'),
  };

  it('reuses an existing tenant only when it is inactive, DEMO, marked and EMPTY', () => {
    expect(assertQuarantineOrganizationReusable(okRow(), expected)).toBe('reuse');
    expect(okRow().name).toContain(QUARANTINE_ORG_MARKER);
  });

  it('NEVER moves rows into an existing customer tenant', () => {
    // The exact catastrophic case: an active, real organization with people in it.
    expect(() =>
      assertQuarantineOrganizationReusable(
        okRow({
          organizationType: 'CUSTOMER',
          status: 'active',
          isActive: true,
          name: 'Elkomtech S.A.',
          userCount: 26,
          memberCount: 26,
        }),
        expected
      )
    ).toThrow(/rows must never be moved into a tenant with users/i);
  });

  it('fails closed on each individual deviation', () => {
    expect(() => assertQuarantineOrganizationReusable(okRow({ userCount: 1 }), expected)).toThrow(
      /1 user/
    );
    expect(() => assertQuarantineOrganizationReusable(okRow({ memberCount: 3 }), expected)).toThrow(
      /3 organization_member/
    );
    expect(() =>
      assertQuarantineOrganizationReusable(okRow({ organizationType: 'TRIAL' }), expected)
    ).toThrow(/organization_type is "TRIAL"/);
    // The SAME strict marker as the target tenant applies to the reuse check.
    expect(() =>
      assertQuarantineOrganizationReusable(okRow({ organizationType: null }), expected)
    ).toThrow(/organization_type is NULL/);
    expect(() =>
      assertQuarantineOrganizationReusable(okRow({ organizationType: '' }), expected)
    ).toThrow(/empty string/i);
    expect(() =>
      assertQuarantineOrganizationReusable(okRow({ organizationType: 'demo' }), expected)
    ).toThrow(/case-sensitive on purpose/);
    expect(() =>
      assertQuarantineOrganizationReusable(
        okRow({ organizationTypeColumnPresent: false }),
        expected
      )
    ).toThrow(/no organization_type column/i);
    expect(() => assertQuarantineOrganizationReusable(okRow({ isActive: true }), expected)).toThrow(
      /is_active is true/
    );
    expect(() =>
      assertQuarantineOrganizationReusable(okRow({ status: 'active' }), expected)
    ).toThrow(/status is "active"/);
    expect(() =>
      assertQuarantineOrganizationReusable(okRow({ name: 'Some other org' }), expected)
    ).toThrow(/expected the run marker/);
  });

  it('matches the status EXACTLY, like the organization_type marker', () => {
    // Case-folding here while `organization_type` is compared case-sensitively
    // was an inconsistency, not a policy: this script only ever writes the
    // literal 'inactive'.
    for (const drift of ['INACTIVE', 'Inactive', 'inActive', '']) {
      expect(() =>
        assertQuarantineOrganizationReusable(okRow({ status: drift }), expected)
      ).toThrow(/expected exactly "inactive"/);
    }
    // NULL is the one accepted alternative and means exactly one thing: this
    // schema has no `status` column, so the create path never set it.
    expect(assertQuarantineOrganizationReusable(okRow({ status: null }), expected)).toBe('reuse');
  });
});

// ---------------------------------------------------------------------------
// P1 — seed-before-quarantine precondition
// ---------------------------------------------------------------------------

/** A fixture the finished seed would leave behind: complete, coherent AND READY. */
function completeFixture(): CanonicalFixtureReadback {
  return {
    packs: [
      {
        id: CANONICAL.packId,
        organizationId: ORG,
        packStatus: READY.packStatus,
        packReadinessStatus: READY.packReadinessStatus,
      },
    ],
    statements: CANONICAL.statementIds.map((id) => ({
      id,
      organizationId: ORG,
      statementPackId: CANONICAL.packId,
      status: READY.statementStatus,
      readinessStatus: READY.statementReadinessStatus,
    })),
    values: CANONICAL.statementValueIds.map((id) => ({
      id,
      // Value ids embed their statement slug, so map each back to its statement.
      statementId:
        CANONICAL.statementIds.find((statementId) =>
          id.startsWith(`${statementId.replace('--statement--', '--statement-value--')}--`)
        ) || CANONICAL.statementIds[0],
    })),
    analyses: [
      {
        id: CANONICAL.analysisId,
        organizationId: ORG,
        sourceStatementPackId: CANONICAL.packId,
        sourceStatementIds: [...CANONICAL.statementIds],
        status: READY.analysisStatus,
      },
    ],
    models: [
      { id: CANONICAL.modelId, organizationId: ORG, sourceStatementPackId: CANONICAL.packId },
    ],
  };
}

describe('seed-before-quarantine precondition', () => {
  it('passes on a fully materialized golden flow', () => {
    const result = verifyCanonicalFixture(completeFixture(), ORG);
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
    expect(() => assertCanonicalFixtureMaterialized(completeFixture(), ORG)).not.toThrow();
  });

  it('REFUSES a fixture that is COMPLETE but not READY — a crashed seed', () => {
    // The exact state a seed that died between phase 1 and phase 2 leaves: every
    // canonical id present, every lineage rule satisfied, nothing promoted.
    const crashed = completeFixture();
    crashed.packs[0].packStatus = 'draft';
    crashed.packs[0].packReadinessStatus = 'pending';
    for (const statement of crashed.statements) {
      statement.status = 'imported';
      statement.readinessStatus = 'pending';
    }
    crashed.analyses[0].status = 'DRAFT';

    // Complete, and still not something to quarantine around.
    expect(() => assertCanonicalFixtureMaterialized(crashed, ORG)).toThrow(
      /the seed did not finish/
    );
    expect(() => assertCanonicalFixtureMaterialized(crashed, ORG)).toThrow(
      /materialized and READY/
    );
    const { violations } = verifyCanonicalFixture(crashed, ORG);
    // Pack (2) + 3 statements × 2 + analysis (1).
    expect(violations).toHaveLength(9);
  });

  it('REFUSES each promotion column on its own, NULL included', () => {
    const cases: Array<[(fixture: CanonicalFixtureReadback) => void, RegExp]> = [
      [(f) => (f.packs[0].packReadinessStatus = 'pending'), /pack_readiness_status/],
      [(f) => (f.packs[0].packStatus = null), /"pack_status" is NULL/],
      [(f) => (f.statements[1].readinessStatus = 'recoverable'), /readiness_status/],
      [(f) => (f.statements[0].status = null), /"status" is NULL/],
      [(f) => (f.analyses[0].status = 'REVIEW'), /analysis .*"status" is "REVIEW"/],
    ];
    for (const [mutate, expected] of cases) {
      const fixture = completeFixture();
      mutate(fixture);
      expect(() => assertCanonicalFixtureMaterialized(fixture, ORG)).toThrow(expected);
    }
  });

  it('REFUSES when a promotion column does not exist in this schema at all', () => {
    // Schema drift: no column ⇒ no evidence ⇒ READY cannot be proven.
    const drifted = completeFixture();
    drifted.packs[0].packReadinessStatus = undefined;
    expect(() => assertCanonicalFixtureMaterialized(drifted, ORG)).toThrow(
      /column "pack_readiness_status" does not exist in this schema/
    );
  });

  it('is case-sensitive about the promotion literals', () => {
    const fixture = completeFixture();
    fixture.statements[0].readinessStatus = 'READY';
    expect(() => assertCanonicalFixtureMaterialized(fixture, ORG)).toThrow(
      /is "READY", expected exactly "ready"/
    );
  });

  it('REFUSES when nothing is seeded at all — quarantine would empty the demo', () => {
    const empty: CanonicalFixtureReadback = {
      packs: [],
      statements: [],
      values: [],
      analyses: [],
      models: [],
    };
    expect(() => assertCanonicalFixtureMaterialized(empty, ORG)).toThrow(
      /Run the demo seed FIRST/i
    );
  });

  it('refuses a missing statement', () => {
    const fixture = completeFixture();
    fixture.statements = fixture.statements.slice(0, 2);
    // The read-back is id-filtered to the canonical set, so it can only ever be
    // MISSING rows — the message must not imply extras were found.
    expect(() => assertCanonicalFixtureMaterialized(fixture, ORG)).toThrow(
      /1 of the 3 canonical statements .* are missing from the read-back/
    );
  });

  it('refuses an incomplete statement-value set', () => {
    const fixture = completeFixture();
    fixture.values = fixture.values.slice(0, fixture.values.length - 1);
    expect(() => assertCanonicalFixtureMaterialized(fixture, ORG)).toThrow(
      /canonical statement values/
    );
  });

  it('refuses broken lineage: statement not linked to the canonical pack', () => {
    const fixture = completeFixture();
    fixture.statements[0].statementPackId = null;
    expect(() => assertCanonicalFixtureMaterialized(fixture, ORG)).toThrow(
      /not linked to the canonical pack/
    );
  });

  it('refuses broken lineage: analysis or model not sourced from the pack', () => {
    const noAnalysisLink = completeFixture();
    noAnalysisLink.analyses[0].sourceStatementPackId = 'some-other-pack';
    expect(() => assertCanonicalFixtureMaterialized(noAnalysisLink, ORG)).toThrow(
      /analysis .* is not sourced from the canonical pack/
    );

    const noModelLink = completeFixture();
    noModelLink.models[0].sourceStatementPackId = null;
    expect(() => assertCanonicalFixtureMaterialized(noModelLink, ORG)).toThrow(
      /model .* is not sourced from the canonical pack/
    );
  });

  it('refuses an analysis that does not reference all three statements', () => {
    const fixture = completeFixture();
    fixture.analyses[0].sourceStatementIds = [CANONICAL.statementIds[0]];
    expect(() => assertCanonicalFixtureMaterialized(fixture, ORG)).toThrow(
      /does not reference all 3 canonical statements/
    );
  });

  it('refuses a canonical row that sits in the wrong organization', () => {
    const fixture = completeFixture();
    fixture.models[0].organizationId = 'someone-else';
    expect(() => assertCanonicalFixtureMaterialized(fixture, ORG)).toThrow(
      /belongs to "someone-else"/
    );
  });
});

// ---------------------------------------------------------------------------
// P1 — the fixture must be the SAME fixture at COMMIT time
// ---------------------------------------------------------------------------

describe('canonical fixture digest — transactional guard', () => {
  const unchanged = (after: CanonicalFixtureReadback) =>
    assertCanonicalFixtureUnchanged({
      before: completeFixture(),
      after,
      organizationId: ORG,
      phase: 'pre-COMMIT',
    });

  it('is stable across two identical readbacks, whatever the row order', () => {
    const shuffled = completeFixture();
    shuffled.statements.reverse();
    shuffled.values.reverse();
    expect(computeCanonicalFixtureDigest(shuffled)).toBe(
      computeCanonicalFixtureDigest(completeFixture())
    );
    expect(() => unchanged(shuffled)).not.toThrow();
  });

  it('REFUSES when a statement disappeared between the precondition and COMMIT', () => {
    const after = completeFixture();
    after.statements = after.statements.slice(0, 2);
    expect(() => unchanged(after)).toThrow(/CHANGED between the precondition and pre-COMMIT/);
    expect(() => unchanged(after)).toThrow(/nothing was moved/i);
  });

  it('REFUSES when a statement value disappeared', () => {
    const after = completeFixture();
    after.values = after.values.slice(0, after.values.length - 1);
    expect(() => unchanged(after)).toThrow(/CHANGED between the precondition/);
  });

  it('REFUSES a lineage re-point that would still pass the completeness check', () => {
    // This is the case a completeness-only re-check misses: every id is still
    // there, every rule still holds, but the value now hangs off a different
    // canonical statement — it is not the fixture the operator approved.
    const after = completeFixture();
    after.values[0] = { ...after.values[0], statementId: CANONICAL.statementIds[2] };
    expect(verifyCanonicalFixture(after, ORG).ok).toBe(true);
    expect(() => unchanged(after)).toThrow(/CHANGED between the precondition/);
  });

  it('REFUSES a readiness demotion that leaves the ID GRAPH identical', () => {
    // THE HOLE THIS CLOSES: digesting ids and links only, a concurrent demotion
    // of the pack from `ready` to `pending` — exactly what a crashed re-seed
    // leaves — produced the SAME digest and sailed through both guards.
    const after = completeFixture();
    after.packs[0].packReadinessStatus = 'pending';

    expect(computeCanonicalFixtureDigest(after)).not.toBe(
      computeCanonicalFixtureDigest(completeFixture())
    );
    expect(() => unchanged(after)).toThrow(/CHANGED between the precondition/);
    // The row counts are identical, so the message must say what actually moved.
    expect(() => unchanged(after)).toThrow(/row counts are identical/);
  });

  it('sees a demotion of every promotion column, on every canonical row', () => {
    const mutations: Array<(fixture: CanonicalFixtureReadback) => void> = [
      (f) => (f.packs[0].packStatus = 'draft'),
      (f) => (f.packs[0].packReadinessStatus = 'pending'),
      (f) => (f.statements[2].status = 'imported'),
      (f) => (f.statements[1].readinessStatus = 'recoverable'),
      (f) => (f.analyses[0].status = 'DRAFT'),
    ];
    const baseline = computeCanonicalFixtureDigest(completeFixture());
    for (const mutate of mutations) {
      const after = completeFixture();
      mutate(after);
      expect(computeCanonicalFixtureDigest(after)).not.toBe(baseline);
      expect(() => unchanged(after)).toThrow(/CHANGED between the precondition/);
    }
  });

  it('distinguishes "column is NULL" from "column does not exist"', () => {
    // `canonicalJson` maps undefined to null, so without an explicit token a
    // column DISAPPEARING would hash the same as a column set to NULL.
    const nulled = completeFixture();
    nulled.packs[0].packStatus = null;
    const absent = completeFixture();
    absent.packs[0].packStatus = undefined;
    expect(computeCanonicalFixtureDigest(nulled)).not.toBe(computeCanonicalFixtureDigest(absent));
  });

  it('REFUSES when the analysis lineage moved', () => {
    const after = completeFixture();
    after.analyses[0].sourceStatementIds = [CANONICAL.statementIds[0]];
    expect(() => unchanged(after)).toThrow(/CHANGED between the precondition/);
  });

  it('reports both row counts so the operator can see what moved', () => {
    const after = completeFixture();
    after.models = [];
    expect(() => unchanged(after)).toThrow(/models=1[\s\S]*models=0/);
  });
});

// ---------------------------------------------------------------------------
// P2 — dependency postconditions
// ---------------------------------------------------------------------------

const QUAR = `${ORG}-fin005-quarantine-r1`;

function coherentGraph(): DependencyGraph {
  return {
    packs: [{ id: CANONICAL.packId, organizationId: ORG }],
    statements: CANONICAL.statementIds.map((id) => ({
      id,
      organizationId: ORG,
      statementPackId: CANONICAL.packId,
    })),
    values: [{ id: 'v1', statementId: CANONICAL.statementIds[0] }],
    ingestRuns: [{ id: 'run-1', organizationId: ORG, statementId: CANONICAL.statementIds[0] }],
    analyses: [
      {
        id: CANONICAL.analysisId,
        organizationId: ORG,
        sourceStatementPackId: CANONICAL.packId,
        sourceStatementIds: [...CANONICAL.statementIds],
      },
    ],
    models: [
      {
        id: CANONICAL.modelId,
        organizationId: ORG,
        sourceStatementPackId: CANONICAL.packId,
        sourceAnalysisId: CANONICAL.analysisId,
      },
    ],
  };
}

describe('dependency postconditions', () => {
  it('passes on a coherent two-tenant graph', () => {
    expect(findCrossOrgDependencyViolations(coherentGraph())).toEqual([]);
    expect(() => assertNoCrossOrgDependencies(coherentGraph(), 'pre-COMMIT')).not.toThrow();
  });

  it('catches a statement quarantined while still pointing at a demo pack', () => {
    const graph = coherentGraph();
    graph.statements.push({
      id: 'uuid-foreign-statement',
      organizationId: QUAR,
      statementPackId: CANONICAL.packId,
    });
    const violations = findCrossOrgDependencyViolations(graph);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ kind: 'cross-org', from: 'uuid-foreign-statement' });
    expect(() => assertNoCrossOrgDependencies(graph, 'pre-COMMIT')).toThrow(
      /Dependency postcondition failed \(pre-COMMIT\)/
    );
  });

  it('catches an ingest run separated from its statement', () => {
    const graph = coherentGraph();
    graph.ingestRuns.push({
      id: 'run-foreign',
      organizationId: QUAR,
      statementId: CANONICAL.statementIds[1],
    });
    expect(findCrossOrgDependencyViolations(graph)[0].detail).toMatch(/ingest-run→statement/);
  });

  it('catches an analysis or model left sourced from the other tenant', () => {
    const graph = coherentGraph();
    graph.analyses.push({
      id: 'uuid-foreign-analysis',
      organizationId: QUAR,
      sourceStatementPackId: CANONICAL.packId,
      sourceStatementIds: [CANONICAL.statementIds[0]],
    });
    graph.models.push({
      id: 'uuid-foreign-model',
      organizationId: QUAR,
      sourceStatementPackId: CANONICAL.packId,
      sourceAnalysisId: CANONICAL.analysisId,
    });
    const details = findCrossOrgDependencyViolations(graph).map((v) => v.detail);
    expect(details.some((d) => d.includes('analysis→pack'))).toBe(true);
    expect(details.some((d) => d.includes('analysis→statement'))).toBe(true);
    expect(details.some((d) => d.includes('model→pack'))).toBe(true);
    expect(details.some((d) => d.includes('model→analysis'))).toBe(true);
  });

  it('catches a reference into a THIRD organization that was never scanned', () => {
    const graph = coherentGraph();
    graph.models[0].sourceStatementPackId = 'pack-of-some-customer';
    const violations = findCrossOrgDependencyViolations(graph);
    expect(violations[0].kind).toBe('dangling');
  });

  it('ignores null links', () => {
    const graph = coherentGraph();
    graph.statements.forEach((statement) => {
      statement.statementPackId = null;
    });
    graph.analyses[0].sourceStatementPackId = null;
    graph.analyses[0].sourceStatementIds = [];
    graph.models[0].sourceStatementPackId = null;
    graph.models[0].sourceAnalysisId = null;
    expect(findCrossOrgDependencyViolations(graph)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P2 — manifest integrity
// ---------------------------------------------------------------------------

const PRIOR_ROW = {
  id: 'uuid-dbr77-statement',
  organization_id: ORG,
  entity_name: 'DBR77 Manufacturing',
  statement_pack_id: CANONICAL.packId,
  created_at: new Date('2026-07-01T10:00:00.000Z'),
};

function manifestEntry(): ManifestEntry {
  const clearedColumns = ['statement_pack_id'];
  return {
    table: 'financial_statements',
    id: PRIOR_ROW.id,
    fromOrganizationId: ORG,
    toOrganizationId: QUAR,
    displayName: 'DBR77 Manufacturing',
    statementPackId: CANONICAL.packId,
    clearedLinks: { statement_pack_id: CANONICAL.packId },
    priorState: PRIOR_ROW,
    priorFingerprint: computeRowFingerprint(PRIOR_ROW),
    expectedQuarantinedFingerprint: computeRowFingerprint(
      projectQuarantinedRow(PRIOR_ROW, { toOrganizationId: QUAR, clearedColumns })
    ),
  };
}

function unsignedManifest(overrides: Partial<CleanupManifest> = {}): CleanupManifest {
  return {
    label: 'finance-demo-cleanup',
    version: MANIFEST_VERSION,
    runId: 'r1',
    status: 'COMMITTED',
    demoOrgId: ORG,
    quarantineOrgId: QUAR,
    host: 'trolley.proxy.rlwy.net',
    database: 'railway',
    preparedAt: '2026-08-01T10:00:00.000Z',
    completedAt: '2026-08-01T10:00:01.000Z',
    plannedEntries: [manifestEntry()],
    entries: [manifestEntry()],
    ...overrides,
  };
}

function baseManifest(overrides: Partial<CleanupManifest> = {}): CleanupManifest {
  return signManifest(unsignedManifest(overrides), KEY);
}

describe('manifest integrity — HMAC-SHA256, not an unkeyed digest', () => {
  it('accepts a manifest it signed itself', () => {
    const manifest = baseManifest();
    expect(manifest.signature).toMatchObject({ algorithm: 'HMAC-SHA256', keyId: KEY.keyId });
    expect(manifest.signature?.value).toMatch(/^[0-9a-f]{64}$/);
    expect(() => assertManifestIntegrity(manifest, KEY)).not.toThrow();
  });

  it('refuses a manifest with no signature at all — files are untrusted input', () => {
    expect(() => assertManifestIntegrity(unsignedManifest(), KEY)).toThrow(/no HMAC signature/i);
    const emptied = { ...baseManifest(), signature: undefined } as CleanupManifest;
    expect(() => assertManifestIntegrity(emptied, KEY)).toThrow(/no HMAC signature/i);
  });

  it('refuses a hand-edited manifest', () => {
    const tampered = baseManifest();
    tampered.entries[0].toOrganizationId = 'acme-corp';
    expect(() => assertManifestIntegrity(tampered, KEY)).toThrow(/HMAC does not verify/i);
  });

  it('refuses a manifest re-signed with the OLD unkeyed SHA-256 scheme', () => {
    // The exact forgery the previous implementation allowed: an attacker edits
    // the body and recomputes the digest, because no key was involved.
    const forged = baseManifest();
    forged.entries[0].toOrganizationId = 'acme-corp';
    forged.signature = {
      algorithm: 'HMAC-SHA256',
      keyId: KEY.keyId,
      // Plain SHA-256 over the same payload the old `computeManifestChecksum` used.
      value: createHash('sha256').update(manifestSignaturePayload(forged)).digest('hex'),
    };
    expect(() => assertManifestIntegrity(forged, KEY)).toThrow(/HMAC does not verify/i);

    // …and the same forgery on an UNMODIFIED body is refused too.
    const honestBody = baseManifest();
    honestBody.signature = {
      algorithm: 'HMAC-SHA256',
      keyId: KEY.keyId,
      value: createHash('sha256').update(manifestSignaturePayload(honestBody)).digest('hex'),
    };
    expect(() => assertManifestIntegrity(honestBody, KEY)).toThrow(/HMAC does not verify/i);
  });

  it('refuses a legacy v2 manifest carrying the unkeyed `checksum` field', () => {
    const legacy = {
      ...unsignedManifest(),
      checksum: createHash('sha256').update(canonicalJson(unsignedManifest())).digest('hex'),
    } as CleanupManifest;
    expect(() => assertManifestIntegrity(legacy, KEY)).toThrow(/legacy unkeyed `checksum`/);
    // Even if somebody bolts a valid HMAC onto it, the legacy field is refused.
    const both = signManifest(legacy, KEY);
    both.checksum = 'deadbeef';
    expect(() => assertManifestIntegrity(both, KEY)).toThrow(/legacy unkeyed `checksum`/);
  });

  it('refuses a signature made with a DIFFERENT key, and names the key rotation', () => {
    const signedElsewhere = signManifest(unsignedManifest(), OTHER_KEY);
    expect(() => assertManifestIntegrity(signedElsewhere, KEY)).toThrow(/signed with key id/i);

    // Same key id claimed, different key material ⇒ the HMAC itself refuses.
    const spoofedKeyId = signManifest(unsignedManifest(), OTHER_KEY);
    spoofedKeyId.signature = { ...spoofedKeyId.signature!, keyId: KEY.keyId };
    expect(() => assertManifestIntegrity(spoofedKeyId, KEY)).toThrow(/HMAC does not verify/i);
  });

  it('refuses an unknown algorithm', () => {
    const manifest = baseManifest();
    manifest.signature = { ...manifest.signature!, algorithm: 'SHA-256' };
    expect(() => assertManifestIntegrity(manifest, KEY)).toThrow(/is not HMAC-SHA256/);
  });

  it('never puts key material in the manifest or in a refusal message', () => {
    const secret = KEY.secret.toString('utf8');
    const manifest = baseManifest();
    expect(JSON.stringify(manifest)).not.toContain(secret);

    const tampered = baseManifest();
    tampered.runId = 'r2';
    let message = '';
    try {
      assertManifestIntegrity(tampered, KEY);
    } catch (error) {
      message = String((error as Error).message);
    }
    expect(message).toBeTruthy();
    expect(message).not.toContain(secret);

    let rotationMessage = '';
    try {
      assertManifestIntegrity(signManifest(unsignedManifest(), OTHER_KEY), KEY);
    } catch (error) {
      rotationMessage = String((error as Error).message);
    }
    expect(rotationMessage).not.toContain(secret);
    expect(rotationMessage).not.toContain(OTHER_KEY.secret.toString('utf8'));
  });

  it('signs the payload the verifier checks — no field is silently excluded', () => {
    const manifest = baseManifest();
    expect(manifest.signature!.value).toBe(
      computeManifestHmac(manifestSignaturePayload(manifest), KEY)
    );
  });

  it('refuses entries that disagree with the manifest header', () => {
    const manifest = baseManifest();
    const rogue = { ...manifestEntry(), toOrganizationId: 'elkomtech' };
    expect(() =>
      assertManifestEntriesConsistent(manifest, [rogue], new Set(['financial_statements']))
    ).toThrow(/differs from the manifest header/);
  });

  it('refuses an entry naming an unknown table', () => {
    const manifest = baseManifest();
    const rogue = { ...manifestEntry(), table: 'users' };
    expect(() =>
      assertManifestEntriesConsistent(manifest, [rogue], new Set(['financial_statements']))
    ).toThrow(/unknown table "users"/);
  });

  it('refuses an entry claiming a CANONICAL row was quarantined', () => {
    const manifest = baseManifest();
    const rogue = { ...manifestEntry(), table: 'financial_models', id: CANONICAL.modelId };
    expect(() =>
      assertManifestEntriesConsistent(manifest, [rogue], new Set(['financial_models']))
    ).toThrow(/is a CANONICAL row/);
  });
});

describe('rollback refuses on drift', () => {
  const entry = manifestEntry();
  const quarantinedRow = projectQuarantinedRow(PRIOR_ROW, {
    toOrganizationId: QUAR,
    clearedColumns: ['statement_pack_id'],
  });

  it('accepts a row untouched since quarantine', () => {
    expect(() => assertRecordUnchangedSinceQuarantine(entry, quarantinedRow)).not.toThrow();
  });

  it('REFUSES a row that changed after quarantine', () => {
    const edited = { ...quarantinedRow, entity_name: 'Renamed by an operator' };
    expect(() => assertRecordUnchangedSinceQuarantine(entry, edited)).toThrow(
      /changed after it was quarantined/
    );
  });

  it('refuses when the row is gone', () => {
    expect(() => assertRecordUnchangedSinceQuarantine(entry, null)).toThrow(
      /no longer in the quarantine tenant/
    );
  });

  it('refuses a v1 manifest entry with no fingerprint rather than rolling back blind', () => {
    const legacy = { ...entry, expectedQuarantinedFingerprint: undefined };
    expect(() => assertRecordUnchangedSinceQuarantine(legacy, quarantinedRow)).toThrow(
      /no post-quarantine fingerprint/
    );
  });
});

describe('statement_pack_id validation on restore', () => {
  it('accepts a pack that exists and belongs to the demo tenant', () => {
    expect(() =>
      assertStatementPackRestorable({
        entryId: 'x',
        recordedPackId: CANONICAL.packId,
        packRow: { id: CANONICAL.packId, organizationId: ORG },
        demoOrgId: ORG,
      })
    ).not.toThrow();
  });

  it('accepts a null prior link (nothing to restore)', () => {
    expect(() =>
      assertStatementPackRestorable({
        entryId: 'x',
        recordedPackId: null,
        packRow: null,
        demoOrgId: ORG,
      })
    ).not.toThrow();
  });

  it('refuses a pack that vanished', () => {
    expect(() =>
      assertStatementPackRestorable({
        entryId: 'x',
        recordedPackId: CANONICAL.packId,
        packRow: null,
        demoOrgId: ORG,
      })
    ).toThrow(/no longer exists/);
  });

  it('refuses a pack that now belongs to another tenant', () => {
    expect(() =>
      assertStatementPackRestorable({
        entryId: 'x',
        recordedPackId: CANONICAL.packId,
        packRow: { id: CANONICAL.packId, organizationId: 'elkomtech' },
        demoOrgId: ORG,
      })
    ).toThrow(/belongs to\s*\n?\s*"elkomtech"/);
  });
});

describe('resolveRollbackEntries — crash recovery', () => {
  it('uses the committed entries when they exist', () => {
    const result = resolveRollbackEntries(baseManifest());
    expect(result.recoveredFromPlan).toBe(false);
    expect(result.entries).toHaveLength(1);
  });

  it('falls back to plannedEntries after a crash between COMMIT and the final write', () => {
    const prepared = baseManifest({ status: 'PREPARED', entries: [], completedAt: undefined });
    const result = resolveRollbackEntries(prepared);
    expect(result.recoveredFromPlan).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].priorState).toBeDefined();
    expect(result.entries[0].expectedQuarantinedFingerprint).toBeTruthy();
  });

  it('reports nothing to do for an empty manifest', () => {
    const empty = baseManifest({ entries: [], plannedEntries: [] });
    expect(resolveRollbackEntries(empty)).toEqual({ entries: [], recoveredFromPlan: false });
  });
});
