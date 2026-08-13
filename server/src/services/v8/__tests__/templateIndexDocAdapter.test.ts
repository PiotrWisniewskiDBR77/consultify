/**
 * R11 (doc slice) — Document Studio templates in the Template Library index.
 *
 * Deterministic: every DB call is routed through a mocked `DbPromise`, so the
 * suite never touches a live database. Fixtures mirror the REAL column shapes
 * (`document_studio_templates` — migration 769; `report_builder_templates` —
 * migration 503 + `is_active` from 569; `presentation_templates` — 568).
 *
 * ★ The orphan machinery is MEASUREMENT ONLY: the suite asserts that no
 *   DELETE/UPDATE is ever issued against `v8_artifact_origin_links`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

// Keep the context/flag side-effects of registerArtifactOrigin out of the way —
// they are fire-and-forget and irrelevant to the index contract.
vi.mock('../featureFlagService.js', () => ({
  isV8Enabled: vi.fn().mockResolvedValue(false),
}));

// Orphan telemetry is emitted through the logger, so the logger is the seam
// that proves the MEASUREMENT actually runs inside the production backfill
// path (correction #5) — not merely that the counting function exists.
const mockLogWarn = vi.fn();
const mockLogInfo = vi.fn();
vi.mock('../../../utils/Logger.js', () => ({
  default: {
    warn: (...args: unknown[]) => mockLogWarn(...args),
    info: (...args: unknown[]) => mockLogInfo(...args),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import type { ArtifactListItem } from '../../../types/artifactRegistry.js';
import {
  buildTemplateOriginSummaryFields,
  countOrphanedTemplateLinks,
  enrichTemplateOriginSummaries,
  ensureBackfilledOutputsForOrg,
} from '../artifactRegistryService.js';

// --- Fixtures ---------------------------------------------------------------

/** `document_studio_templates` — PK is `template_id`, blueprint is `section_blueprint`. */
const DOC_STUDIO_ROW = {
  template_id: 'dst-status-report-001',
  organization_id: 'org-alpha',
  name: 'Project status report',
  purpose: 'Weekly status for the steering committee',
  category: 'report',
  document_type: 'project_status_report',
  section_blueprint: JSON.stringify([
    { key: 'summary', title: 'Executive summary' },
    { key: 'progress', title: 'Progress' },
  ]),
  status: 'approved',
  version: '1.0',
  is_system: false,
  created_by: 'user-1',
  created_at: '2026-07-01T10:00:00.000Z',
  updated_at: '2026-07-02T10:00:00.000Z',
};

const SHEET_TEMPLATE_ROW = {
  id: '7d5126c4-4cd8-47da-8e97-b5d1584c11d1',
  organization_id: null,
  name: 'Dashboard KPI',
  description: 'Executive KPI workbook',
  category: 'kpi',
  schema_snapshot: {
    fields: [
      { name: 'Wskaźnik', type: 'text' },
      { name: 'Wynik', type: 'number' },
    ],
  },
  status: 'approved',
  version: '1.0.0',
  visibility: 'system',
  created_by: null,
  created_at: '2026-08-01T10:00:00.000Z',
};

function templateListItem(overrides: Partial<ArtifactListItem> = {}): ArtifactListItem {
  return {
    artifactId: 'art-1',
    organizationId: 'org-alpha',
    outputType: 'report',
    artifactFamily: 'template',
    deliveryState: 'ready',
    titleSnapshot: 'Project status report',
    ownerUserId: null,
    canonicalHome: 'outputs_library',
    visibilityScope: 'organization',
    projectId: null,
    contextSnapshotId: null,
    executionRunId: null,
    templateFamilyRef: null,
    sourceInitiativeId: null,
    aiGovernancePresetRef: null,
    originSummary: { template: { description: 'legacy snapshot' } },
    isDraft: false,
    createdBy: 'user-1',
    createdAt: '2026-07-01T10:00:00.000Z',
    lastTransitionAt: '2026-07-01T10:00:00.000Z',
    originRuntime: 'document_template',
    originRecordId: 'dst-status-report-001',
    resolvedTitle: 'Project status report',
    originTitle: null,
    originStatus: null,
    reportType: null,
    presentationMode: null,
    slideCount: null,
    exportFormat: null,
    sourceRefs: [],
    publishState: null,
    publishReviewers: [],
    reviewGateCount: 0,
    ownerName: null,
    duplicateCount: 1,
    duplicateArtifactIds: [],
    ...overrides,
  } as ArtifactListItem;
}

/** Every SQL string the service handed to the DB layer during a test. */
function allSql(): string[] {
  return [...mockDbAll.mock.calls, ...mockDbGet.mock.calls, ...mockDbRun.mock.calls]
    .map((call) => String(call[0] ?? ''))
    .filter(Boolean);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbAll.mockResolvedValue([]);
  mockDbGet.mockResolvedValue(null);
  mockDbRun.mockResolvedValue({ success: true });
});

describe('originSummary.template identity block', () => {
  it('marks Document Studio templates canonical and report templates legacy', () => {
    const canonical = buildTemplateOriginSummaryFields({
      canonicalTemplateId: 'dst-1',
      originRuntime: 'document_template',
      orphaned: false,
      scope: 'organization',
      status: 'approved',
    });
    expect(canonical).toEqual({
      canonicalTemplateId: 'dst-1',
      originRuntime: 'document_template',
      source: 'canonical',
      legacy: false,
      orphaned: false,
      scope: 'organization',
      status: 'approved',
    });

    const legacy = buildTemplateOriginSummaryFields({
      canonicalTemplateId: 'rbt-1',
      originRuntime: 'report_template',
      orphaned: false,
      scope: 'system',
      status: 'published',
    });
    expect(legacy.source).toBe('legacy');
    expect(legacy.legacy).toBe(true);

    const workbookBuilder = buildTemplateOriginSummaryFields({
      canonicalTemplateId: 'workbook-template-1',
      originRuntime: 'sheet_template',
      orphaned: false,
      scope: 'organization',
      status: 'draft',
    });
    // `source` is derived from `originRuntime` inside the builder — passing it in
    // was dead input, the assertion below is what actually proves the derivation.
    expect(workbookBuilder.source).toBe('canonical');
    expect(workbookBuilder.legacy).toBe(false);

    // The forbidden 'application' spelling never appears in the contract.
    expect(JSON.stringify([canonical, legacy, workbookBuilder])).not.toContain('application');
  });
});

describe('backfill adapter — document_studio_templates → document_template', () => {
  it('indexes an approved Document Studio template under origin_runtime document_template', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM document_studio_templates')) return [DOC_STUDIO_ROW];
      return [];
    });
    mockDbGet.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM v8_output_artifacts WHERE artifact_id')) {
        return {
          artifact_id: 'art-new',
          organization_id: 'org-alpha',
          output_type: 'report',
          artifact_family: 'template',
          delivery_state: 'ready',
          title_snapshot: DOC_STUDIO_ROW.name,
          owner_user_id: null,
          canonical_home: 'outputs_library',
          visibility_scope: 'organization',
          project_id: null,
          context_snapshot_id: null,
          execution_run_id: null,
          template_family_ref: null,
          source_initiative_id: null,
          ai_governance_preset_ref: null,
          origin_summary_json: null,
          is_draft: 0,
          created_by: 'user-1',
          created_at: DOC_STUDIO_ROW.created_at,
          last_transition_at: DOC_STUDIO_ROW.created_at,
        };
      }
      return null; // no pre-existing origin link → the template is not indexed yet
    });

    await ensureBackfilledOutputsForOrg('org-alpha');

    const linkInsert = mockDbRun.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO v8_artifact_origin_links')
    );
    expect(linkInsert).toBeDefined();
    const linkParams = linkInsert![1] as unknown[];
    expect(linkParams).toContain('document_template');
    // origin_record_id is the CANONICAL registry id (template_id), not the artifact id.
    expect(linkParams).toContain('dst-status-report-001');

    const artifactInsert = mockDbRun.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO v8_output_artifacts')
    );
    expect(artifactInsert).toBeDefined();
    const summaryJson = String(
      (artifactInsert![1] as unknown[]).find(
        (param) => typeof param === 'string' && param.includes('"template"')
      )
    );
    const summary = JSON.parse(summaryJson).template;
    expect(summary.canonicalTemplateId).toBe('dst-status-report-001');
    expect(summary.originRuntime).toBe('document_template');
    expect(summary.source).toBe('canonical');
    expect(summary.legacy).toBe(false);
    expect(summary.orphaned).toBe(false);
    expect(summary.scope).toBe('organization');
    expect(summary.status).toBe('approved');
  });

  it('reads all lifecycle states visible to the org (own rows + __system__ catalogue)', async () => {
    mockDbAll.mockResolvedValue([]);
    await ensureBackfilledOutputsForOrg('org-visibility-probe');

    const docQuery = mockDbAll.mock.calls.find((call) =>
      String(call[0]).includes('FROM document_studio_templates')
    );
    expect(docQuery).toBeDefined();
    const sql = String(docQuery![0]);
    // Drafts must be indexed too; otherwise Submit for review has no visible row.
    expect(sql).not.toContain("t.status = 'approved'");
    expect(sql).toContain('is_system = TRUE');
    // Idempotency guard: only rows without an existing link are inserted.
    expect(sql).toContain('l.link_id IS NULL');
    expect(docQuery![1]).toContain('__system__');
  });

  it('indexes tp_base_templates as canonical sheet templates', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM tp_base_templates') && sql.includes('LEFT JOIN')) {
        return [SHEET_TEMPLATE_ROW];
      }
      return [];
    });

    await ensureBackfilledOutputsForOrg('org-with-sheets');

    const sheetQuery = mockDbAll.mock.calls.find(
      (call) =>
        String(call[0]).includes('FROM tp_base_templates') &&
        String(call[0]).includes('LEFT JOIN v8_artifact_origin_links')
    );
    expect(sheetQuery).toBeDefined();
    expect(String(sheetQuery![0])).toContain("t.visibility = 'private'");
    expect(String(sheetQuery![0])).toContain('t.organization_id = ?');

    const linkInsert = mockDbRun.mock.calls.find(
      (call) =>
        String(call[0]).includes('INSERT INTO v8_artifact_origin_links') &&
        (call[1] as unknown[]).includes('sheet_template')
    );
    expect(linkInsert).toBeDefined();
    expect(linkInsert![1]).toContain(SHEET_TEMPLATE_ROW.id);

    const artifactInsert = mockDbRun.mock.calls.find((call) => {
      if (!String(call[0]).includes('INSERT INTO v8_output_artifacts')) return false;
      return (call[1] as unknown[]).some(
        (param) => typeof param === 'string' && param.includes(SHEET_TEMPLATE_ROW.id)
      );
    });
    expect(artifactInsert).toBeDefined();
    const summaryJson = String(
      (artifactInsert![1] as unknown[]).find(
        (param) => typeof param === 'string' && param.includes('"structureBlueprint"')
      )
    );
    const summary = JSON.parse(summaryJson).template;
    expect(summary.canonicalTemplateId).toBe(SHEET_TEMPLATE_ROW.id);
    expect(summary.originRuntime).toBe('sheet_template');
    expect(summary.source).toBe('canonical');
    expect(summary.legacy).toBe(false);
    expect(summary.scope).toBe('system');
    expect(summary.status).toBe('approved');
    expect(summary.structureBlueprint.columns).toEqual([
      { key: 'Wskaźnik', header: 'Wskaźnik', type: 'text' },
      { key: 'Wynik', header: 'Wynik', type: 'number' },
    ]);
  });
});

describe('orphan detection (measurement only)', () => {
  it('projects presentation lifecycle instead of treating every active row as published', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM presentation_templates')) {
        return [
          {
            canonical_id: 'deck-draft',
            organization_id: 'org-alpha',
            is_system: true,
            status_value: 'draft',
            active_value: true,
          },
          {
            canonical_id: 'deck-approved',
            organization_id: 'org-alpha',
            is_system: true,
            status_value: 'approved',
            active_value: true,
          },
          {
            canonical_id: 'deck-deprecated',
            organization_id: 'org-alpha',
            is_system: true,
            status_value: 'deprecated',
            active_value: false,
          },
        ];
      }
      return [];
    });

    const makeDeck = (artifactId: string, originRecordId: string) =>
      templateListItem({
        artifactId,
        outputType: 'presentation',
        originRuntime: 'presentation_template',
        originRecordId,
      });
    const results = await enrichTemplateOriginSummaries('org-alpha', [
      makeDeck('art-draft', 'deck-draft'),
      makeDeck('art-approved', 'deck-approved'),
      makeDeck('art-deprecated', 'deck-deprecated'),
    ]);

    expect(results.map((item) => (item.originSummary as any).template.status)).toEqual([
      'draft',
      'published',
      'deprecated',
    ]);
    expect(allSql().find((sql) => sql.includes('FROM presentation_templates'))).toContain(
      't.lifecycle_state'
    );
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('flags a template whose canonical record is gone and keeps a live one clean', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM document_studio_templates')) {
        return [
          {
            canonical_id: 'dst-live',
            organization_id: 'org-alpha',
            is_system: false,
            status_value: 'approved',
            active_value: null,
          },
        ];
      }
      return [];
    });

    const [live, orphan] = await enrichTemplateOriginSummaries('org-alpha', [
      templateListItem({ artifactId: 'art-live', originRecordId: 'dst-live' }),
      templateListItem({ artifactId: 'art-orphan', originRecordId: 'dst-deleted' }),
    ]);

    const liveTemplate = (live.originSummary as any).template;
    expect(liveTemplate.orphaned).toBe(false);
    expect(liveTemplate.scope).toBe('organization');
    expect(liveTemplate.status).toBe('approved');
    expect(liveTemplate.canonicalTemplateId).toBe('dst-live');
    // Pre-existing snapshot keys survive the enrichment.
    expect(liveTemplate.description).toBe('legacy snapshot');

    const orphanTemplate = (orphan.originSummary as any).template;
    expect(orphanTemplate.orphaned).toBe(true);

    // ★ Nothing was deleted or updated.
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('leaves non-template artifacts untouched', async () => {
    const report = templateListItem({
      artifactFamily: 'document',
      originRuntime: 'report',
      originRecordId: 'rep-1',
      originSummary: { nativeStatus: 'ready' },
    });
    const [result] = await enrichTemplateOriginSummaries('org-alpha', [report]);
    expect(result).toBe(report);
    expect(mockDbAll).not.toHaveBeenCalled();
  });

  it('countOrphanedTemplateLinks counts per runtime and never mutates the links table', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM v8_artifact_origin_links')) {
        return [
          { origin_runtime: 'document_template', origin_record_id: 'dst-live' },
          { origin_runtime: 'document_template', origin_record_id: 'dst-gone-1' },
          { origin_runtime: 'document_template', origin_record_id: 'dst-gone-2' },
          { origin_runtime: 'report_template', origin_record_id: 'rbt-live' },
          { origin_runtime: 'sheet_template', origin_record_id: 'bt-sheet-1' },
        ];
      }
      if (sql.includes('FROM document_studio_templates')) {
        return [{ canonical_id: 'dst-live', organization_id: 'org-alpha', is_system: false }];
      }
      if (sql.includes('FROM report_builder_templates')) {
        return [{ canonical_id: 'rbt-live', organization_id: 'org-alpha', is_system: false }];
      }
      return [];
    });

    const counts = await countOrphanedTemplateLinks('org-alpha');

    expect(counts.byRuntime.document_template).toBe(2);
    expect(counts.byRuntime.report_template).toBe(0);
    expect(counts.byRuntime.presentation_template).toBe(0);
    // tp_base_templates is the canonical workbook registry, so a missing row
    // is measurable just like the other template runtimes.
    expect(counts.unverifiable).toEqual([]);
    expect(counts.byRuntime.sheet_template).toBe(1);
    expect(counts.total).toBe(3);

    // ★ Measurement only — zero writes.
    expect(mockDbRun).not.toHaveBeenCalled();
    expect(allSql().some((sql) => /DELETE|UPDATE/i.test(sql))).toBe(false);
  });
});

/**
 * ★ WIRING PROOF (architect review P1, second instance).
 *
 * `countOrphanedTemplateLinks` was exported and unit-tested but had NO
 * production caller — so correction #5's "measure their number" was satisfied
 * only on paper. A unit test of the counter cannot catch that: it passes
 * whether or not anything ever invokes it.
 *
 * This suite therefore drives the PRODUCTION entry point
 * (`ensureBackfilledOutputsForOrg`) and asserts the measurement is emitted,
 * and that measuring still writes nothing.
 */
describe('orphan measurement is wired into the production backfill path', () => {
  beforeEach(() => {
    mockLogWarn.mockReset();
    mockLogInfo.mockReset();
  });

  // `ensureBackfilledOutputsForOrg` throttles per organization via a
  // module-level watermark, so every invocation needs its own org id —
  // otherwise a vitest retry silently short-circuits and the assertion
  // flips for a reason that has nothing to do with the code under test.
  let orgSeq = 0;
  const freshOrg = (label: string) => `org-${label}-${++orgSeq}`;

  it('emits the orphan count while backfilling', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      // One indexed template link whose canonical record no longer exists.
      if (sql.includes('FROM v8_artifact_origin_links')) {
        return [{ origin_runtime: 'document_template', origin_record_id: 'dst-gone' }];
      }
      return [];
    });
    mockDbGet.mockResolvedValue(undefined);

    const org = freshOrg('orphan-telemetry');
    await ensureBackfilledOutputsForOrg(org);

    const warned = mockLogWarn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(warned).toContain('Orphaned template links');
    expect(warned).toContain(org);
    expect(warned).toContain('document_template=1');
  });

  it('never issues a write against the links table while measuring', async () => {
    mockDbAll.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM v8_artifact_origin_links')) {
        return [{ origin_runtime: 'document_template', origin_record_id: 'dst-gone' }];
      }
      return [];
    });
    mockDbGet.mockResolvedValue(undefined);

    await ensureBackfilledOutputsForOrg(freshOrg('orphan-nowrite'));

    // Scoped deliberately: the backfill itself legitimately INSERTs artifacts
    // and UPDATEs the draft flag. What must never happen is a DELETE/UPDATE
    // touching `v8_artifact_origin_links` — cleanup is a separate decision.
    const writesOnLinks = mockDbRun.mock.calls
      .map((c) => String(c[0] ?? ''))
      .filter((sql) => /v8_artifact_origin_links/i.test(sql))
      .filter((sql) => /\bDELETE\b|\bUPDATE\b/i.test(sql));
    expect(writesOnLinks).toEqual([]);
  });

  it('stays silent when there is nothing orphaned', async () => {
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(undefined);

    await ensureBackfilledOutputsForOrg(freshOrg('orphan-clean'));

    const warned = mockLogWarn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(warned).not.toContain('Orphaned template links');
  });
});
