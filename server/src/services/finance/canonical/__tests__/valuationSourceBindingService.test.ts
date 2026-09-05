/**
 * `valuationSourceBindingService` — the rule set behind
 * `POST /api/v8/finance-v2/valuation/variants/:businessVersionId/source`
 * (decyzja właściciela 2026-09-05, „wycena musi umieć wskazać swoje źródło").
 *
 * DB-free by construction: every collaborator this service uses is an existing canonical service
 * whose own DB behaviour is covered by the `*.pg.test.ts` suites. What is NOT covered anywhere
 * else, and therefore what this file exists to pin, is the DECISION LOGIC this package adds:
 *   · a source version that is not APPROVED must be refused (the whole point of OWN-FIN-021 §1 —
 *     „musi wskazywać dokładną, ZATWIERDZONĄ wersję Baseline/Scenario, nigdy »najnowszą«");
 *   · a source version belonging to ANOTHER organization must be indistinguishable from a
 *     nonexistent one (tenant isolation, refused before any write is attempted);
 *   · re-posting the SAME source must write nothing (`finance_lineage_edges` is append-only, so an
 *     idempotent replay is the only sane answer to a double-click);
 *   · posting a DIFFERENT source must be refused rather than silently ignored or "replaced" —
 *     the append-only triggers make replacement physically impossible.
 *
 * Each mock is deliberately faithful to the real signature it stands in for (org-scoped reads that
 * return `null` for a foreign tenant), so deleting a guard in the service makes a test fail on the
 * ASSERTION, not on a mock detail.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getVariant = vi.fn();
const getBusinessVersion = vi.fn();
const getArtifact = vi.fn();
const getAncestors = vi.fn();
const insertEdge = vi.fn();

vi.mock('../valuationVariantService.js', () => ({ getVariant: (...a: unknown[]) => getVariant(...a) }));
vi.mock('../artifactVersionService.js', () => ({
  getBusinessVersion: (...a: unknown[]) => getBusinessVersion(...a),
  getArtifact: (...a: unknown[]) => getArtifact(...a),
}));
vi.mock('../lineageService.js', () => ({
  getAncestors: (...a: unknown[]) => getAncestors(...a),
  insertEdge: (...a: unknown[]) => insertEdge(...a),
}));

const { bindValuationSource, getValuationSource } = await import('../valuationSourceBindingService.js');

const ORG = 'org-alpha';
const OTHER_ORG = 'org-beta';
const VALUATION_BV = 'bv-valuation-1';
const BASELINE_BV = 'bv-baseline-approved';
const AUTHOR = 'user-1';

/** Mirrors the org-scoped `getBusinessVersion(organizationId, id)` contract: a foreign row reads as `null`. */
function versionRow(overrides: Record<string, unknown> = {}) {
  return {
    business_version_id: BASELINE_BV,
    artifact_id: 'artifact-baseline',
    organization_id: ORG,
    version_no: 3,
    status: 'APPROVED',
    engine_manifest_id: 'engine-1',
    content_semantic_hash: 'sha256:baseline-content',
    approved_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function edgeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'edge-1',
    organization_id: ORG,
    source_version_id: BASELINE_BV,
    source_artifact_type: 'BASELINE_MODEL',
    target_version_id: VALUATION_BV,
    target_artifact_type: 'VALUATION_CASE',
    edge_type: 'MODEL_TO_VALUATION',
    transformation_kind: 'MANUAL_LINK',
    assumption_snapshot_hash: 'sha256:baseline-content',
    assumption_snapshot_id: null,
    compute_run_id: null,
    author_id: AUTHOR,
    created_at: '2026-09-05T10:00:00Z',
    ...overrides,
  };
}

function bindParams(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: ORG,
    valuationBusinessVersionId: VALUATION_BV,
    sourceKind: 'baseline' as const,
    sourceVersionId: BASELINE_BV,
    authorId: AUTHOR,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getVariant.mockResolvedValue({ business_version_id: VALUATION_BV, organization_id: ORG, status: 'APPROVED' });
  getBusinessVersion.mockResolvedValue(versionRow());
  getArtifact.mockResolvedValue({ artifact_id: 'artifact-baseline', organization_id: ORG, artifact_type: 'BASELINE_MODEL' });
  getAncestors.mockResolvedValue([]);
  insertEdge.mockResolvedValue({ ok: true, edge: edgeRow() });
});

describe('bindValuationSource — walidacja', () => {
  it('writes the MODEL_TO_VALUATION edge for an APPROVED baseline source', async () => {
    const result = await bindValuationSource(bindParams());
    expect(result).toMatchObject({ ok: true, created: true });
    expect(insertEdge).toHaveBeenCalledTimes(1);
    expect(insertEdge.mock.calls[0][0]).toMatchObject({
      organizationId: ORG,
      sourceVersionId: BASELINE_BV,
      sourceArtifactType: 'BASELINE_MODEL',
      targetVersionId: VALUATION_BV,
      targetArtifactType: 'VALUATION_CASE',
      edgeType: 'MODEL_TO_VALUATION',
      transformationKind: 'MANUAL_LINK',
      // chk_finance_lineage_assumption_hash demands a non-null hash on this edge type; it must be
      // the SOURCE's own content pin, not a placeholder.
      assumptionSnapshotHash: 'sha256:baseline-content',
    });
  });

  it('refuses a source version that is not APPROVED, without attempting any write', async () => {
    for (const status of ['DRAFT', 'READY_FOR_REVIEW', 'IN_REVIEW', 'NEEDS_CHANGES', 'SUPERSEDED']) {
      insertEdge.mockClear();
      getBusinessVersion.mockResolvedValue(versionRow({ status }));
      const result = await bindValuationSource(bindParams());
      expect(result).toMatchObject({ ok: false, code: 'SOURCE_VERSION_NOT_APPROVED' });
      expect(insertEdge).not.toHaveBeenCalled();
    }
  });

  it("refuses another organization's source version as NOT_FOUND (tenant isolation)", async () => {
    // Faithful to the real service: an org-scoped read of a foreign row returns null.
    getBusinessVersion.mockImplementation(async (organizationId: string) =>
      organizationId === OTHER_ORG ? versionRow({ organization_id: OTHER_ORG }) : null
    );
    const result = await bindValuationSource(bindParams());
    expect(result).toMatchObject({ ok: false, code: 'SOURCE_VERSION_NOT_FOUND' });
    expect(insertEdge).not.toHaveBeenCalled();
    expect(getBusinessVersion).toHaveBeenCalledWith(ORG, BASELINE_BV);
  });

  it("refuses another organization's valuation as NOT_FOUND before reading the source at all", async () => {
    getVariant.mockResolvedValue(null);
    const result = await bindValuationSource(bindParams());
    expect(result).toMatchObject({ ok: false, code: 'VALUATION_NOT_FOUND' });
    expect(getBusinessVersion).not.toHaveBeenCalled();
    expect(insertEdge).not.toHaveBeenCalled();
  });

  it('refuses a source whose artifact type contradicts the declared sourceKind', async () => {
    getArtifact.mockResolvedValue({ artifact_id: 'artifact-baseline', organization_id: ORG, artifact_type: 'STATEMENT_PACK' });
    const result = await bindValuationSource(bindParams());
    expect(result).toMatchObject({ ok: false, code: 'SOURCE_KIND_MISMATCH' });
    expect(insertEdge).not.toHaveBeenCalled();
  });

  it('falls back to a LABELLED identity hash when the source has no content_semantic_hash', async () => {
    getBusinessVersion.mockResolvedValue(versionRow({ content_semantic_hash: null }));
    const result = await bindValuationSource(bindParams());
    expect(result).toMatchObject({ ok: true, assumptionSnapshotHashOrigin: 'SOURCE_VERSION_IDENTITY' });
    const hash = insertEdge.mock.calls[0][0].assumptionSnapshotHash;
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});

describe('bindValuationSource — idempotencja i append-only', () => {
  it('re-posting the SAME source writes nothing and returns the existing edge', async () => {
    getAncestors.mockResolvedValue([edgeRow()]);
    const result = await bindValuationSource(bindParams());
    expect(result).toMatchObject({ ok: true, created: false });
    expect(result.ok && result.source.edgeId).toBe('edge-1');
    expect(insertEdge).not.toHaveBeenCalled();
  });

  it('posting a DIFFERENT source is refused — finance_lineage_edges cannot be rewritten', async () => {
    getAncestors.mockResolvedValue([edgeRow()]);
    const result = await bindValuationSource(bindParams({ sourceVersionId: 'bv-baseline-other' }));
    expect(result).toMatchObject({ ok: false, code: 'VALUATION_SOURCE_ALREADY_SET' });
    expect(insertEdge).not.toHaveBeenCalled();
  });

  it('ignores transitive ancestors when deciding whether a source already exists', async () => {
    // Statement -> Baseline edge: a legitimate ancestor of the chain, but NOT this version's own
    // source edge. Treating it as one would wrongly report the valuation as already bound.
    getAncestors.mockResolvedValue([
      edgeRow({
        id: 'edge-upstream',
        target_version_id: BASELINE_BV,
        source_version_id: 'bv-statement',
        edge_type: 'STATEMENT_TO_MODEL',
      }),
    ]);
    const result = await bindValuationSource(bindParams());
    expect(result).toMatchObject({ ok: true, created: true });
    expect(insertEdge).toHaveBeenCalledTimes(1);
  });

  it('refuses a terminal (ARCHIVED/SUPERSEDED/INVALIDATED) valuation version', async () => {
    for (const status of ['SUPERSEDED', 'ARCHIVED', 'INVALIDATED']) {
      insertEdge.mockClear();
      getVariant.mockResolvedValue({ business_version_id: VALUATION_BV, organization_id: ORG, status });
      const result = await bindValuationSource(bindParams());
      expect(result).toMatchObject({ ok: false, code: 'VALUATION_VERSION_TERMINAL' });
      expect(insertEdge).not.toHaveBeenCalled();
    }
  });
});

describe('getValuationSource', () => {
  it('returns null for a valuation that has no source edge yet', async () => {
    const result = await getValuationSource(ORG, VALUATION_BV);
    expect(result).toEqual({ ok: true, source: null });
  });

  it('returns the direct source edge, not an upstream ancestor', async () => {
    getAncestors.mockResolvedValue([
      edgeRow({ id: 'edge-upstream', target_version_id: BASELINE_BV, edge_type: 'STATEMENT_TO_MODEL' }),
      edgeRow(),
    ]);
    const result = await getValuationSource(ORG, VALUATION_BV);
    expect(result).toMatchObject({ ok: true, source: { edgeId: 'edge-1', sourceKind: 'baseline' } });
  });

  it("refuses another organization's valuation", async () => {
    getVariant.mockResolvedValue(null);
    const result = await getValuationSource(OTHER_ORG, VALUATION_BV);
    expect(result).toMatchObject({ ok: false, code: 'VALUATION_NOT_FOUND' });
  });
});
