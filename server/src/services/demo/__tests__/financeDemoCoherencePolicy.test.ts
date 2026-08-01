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

import { describe, expect, it } from 'vitest';

import { getAtelierFinanceCanonicalIds } from '../atelierFinanceSeed.js';
import {
  assertApprovedDemoTarget,
  assertCanonicalFixtureMaterialized,
  assertManifestEntriesConsistent,
  assertManifestIntegrity,
  assertNoCrossOrgDependencies,
  assertQuarantineOrganizationReusable,
  assertRecordUnchangedSinceQuarantine,
  assertStatementPackRestorable,
  buildQuarantineOrgId,
  buildQuarantineOrgName,
  classifyFinanceDemoRows,
  computeManifestChecksum,
  computeRowFingerprint,
  financeDemoNameFlags,
  findCrossOrgDependencyViolations,
  isCanonicalDemoRowId,
  projectQuarantinedRow,
  resolveRollbackEntries,
  signManifest,
  verifyCanonicalFixture,
  FIN005_APPROVED_DEMO_TARGETS,
  MANIFEST_VERSION,
  QUARANTINE_ORG_MARKER,
  type CanonicalFixtureReadback,
  type CleanupManifest,
  type DependencyGraph,
  type ManifestEntry,
  type QuarantineOrganizationRow,
} from '../financeDemoCoherencePolicy.js';

const ORG = 'demo-org';
const CANONICAL = getAtelierFinanceCanonicalIds(ORG);

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
    expect(isCanonicalDemoRowId('dbr77--financial-model--transformation-2015-roi', ORG)).toBe(false);
    // …and the same id IS canonical for its own tenant.
    expect(
      isCanonicalDemoRowId(getAtelierFinanceCanonicalIds('dbr77').modelId, 'dbr77')
    ).toBe(true);
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

  const okRow = (overrides: Partial<QuarantineOrganizationRow> = {}): QuarantineOrganizationRow => ({
    id: `${ORG}-fin005-quarantine-r1`,
    name: buildQuarantineOrgName('r1'),
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
    expect(() => assertQuarantineOrganizationReusable(okRow({ isActive: true }), expected)).toThrow(
      /is_active is true/
    );
    expect(() => assertQuarantineOrganizationReusable(okRow({ status: 'active' }), expected)).toThrow(
      /status is "active"/
    );
    expect(() =>
      assertQuarantineOrganizationReusable(okRow({ name: 'Some other org' }), expected)
    ).toThrow(/expected the run marker/);
  });
});

// ---------------------------------------------------------------------------
// P1 — seed-before-quarantine precondition
// ---------------------------------------------------------------------------

function completeFixture(): CanonicalFixtureReadback {
  return {
    packs: [{ id: CANONICAL.packId, organizationId: ORG }],
    statements: CANONICAL.statementIds.map((id) => ({
      id,
      organizationId: ORG,
      statementPackId: CANONICAL.packId,
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
    expect(() => assertCanonicalFixtureMaterialized(fixture, ORG)).toThrow(
      /expected exactly 3 canonical statements/
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
    expect(() => assertCanonicalFixtureMaterialized(fixture, ORG)).toThrow(/belongs to "someone-else"/);
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
    ingestRuns: [
      { id: 'run-1', organizationId: ORG, statementId: CANONICAL.statementIds[0] },
    ],
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

function baseManifest(overrides: Partial<CleanupManifest> = {}): CleanupManifest {
  return signManifest({
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
  });
}

describe('manifest integrity', () => {
  it('accepts a manifest it signed itself', () => {
    expect(() => assertManifestIntegrity(baseManifest())).not.toThrow();
  });

  it('refuses an unsigned manifest — files are untrusted input', () => {
    const unsigned = { ...baseManifest(), checksum: undefined } as CleanupManifest;
    expect(() => assertManifestIntegrity(unsigned)).toThrow(/no checksum/i);
  });

  it('refuses a hand-edited manifest', () => {
    const tampered = baseManifest();
    tampered.entries[0].toOrganizationId = 'acme-corp';
    expect(() => assertManifestIntegrity(tampered)).toThrow(/checksum mismatch/i);
    expect(computeManifestChecksum(tampered)).not.toBe(tampered.checksum);
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
