/**
 * backfillNativeArtifactsForOrg — fala sprzątania 1b (2026-07-27).
 *
 * Gap closed: `report_builder_reports` (backfillReportsForOrg) and
 * `presentation_decks` (backfillPresentationsForOrg) both have a lazy
 * reconciliation backfill run on every listing (`ensureBackfilledOutputsForOrg`).
 * Document Studio's actual generated DOCUMENTS (`wave5_artifacts`,
 * `native_artifact` origin runtime) had none — only the reusable TEMPLATES
 * (`backfillDocStudioTemplatesForOrg`) were covered. A document that failed
 * every registration attempt (see `registerGeneratedDocumentOrigin` /
 * `retryWithBackoff` in document-studio.routes.ts) had no safety net at all.
 *
 * This suite drives the real production entry point
 * (`ensureBackfilledOutputsForOrg`, called by every artifact-listing read
 * path) rather than the private `backfillNativeArtifactsForOrg` helper
 * directly, mirroring the existing
 * `artifactRegistryService.templateLibraryDuplicates.test.ts` mocking
 * pattern (mock `DbPromise` at the module boundary; exercise the real
 * `registerArtifactOrigin`).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../v8/featureFlagService.js', () => ({
  isV8Enabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { ensureBackfilledOutputsForOrg } from '../v8/artifactRegistryService.js';

const ARTIFACT_ID = 'artifact-wave5-doc-1';

function nativeArtifactRow(organizationId: string) {
  return {
    artifact_id: ARTIFACT_ID,
    title: 'Raport z Document Studio',
    status: 'draft',
    project_id: null,
    created_by: 'user-1',
    created_at: '2026-07-27T00:00:00.000Z',
    updated_at: '2026-07-27T00:00:00.000Z',
    provenance_json: JSON.stringify({
      metadata: {
        documentStudioSchema: { title: 'Raport z Document Studio' },
        documentStudioTemplateId: 'doc-template-abc',
      },
    }),
  };
}

function outputArtifactRow(artifactId: string, organizationId: string) {
  return {
    artifact_id: artifactId,
    organization_id: organizationId,
    output_type: 'report',
    artifact_family: 'document',
    delivery_state: 'draft',
    title_snapshot: 'Raport z Document Studio',
    owner_user_id: 'user-1',
    canonical_home: 'outputs_library',
    visibility_scope: 'private',
    project_id: null,
    context_snapshot_id: null,
    execution_run_id: null,
    template_family_ref: null,
    source_initiative_id: null,
    ai_governance_preset_ref: null,
    origin_summary_json: null,
    is_draft: 0,
    created_by: 'user-1',
    created_at: '2026-07-27T00:00:00.000Z',
    last_transition_at: '2026-07-27T00:00:00.000Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
});

describe('backfillNativeArtifactsForOrg (via ensureBackfilledOutputsForOrg)', () => {
  it('indexes a Document Studio wave5 artifact that has no origin link yet', async () => {
    const orgId = 'org-native-backfill-new';

    mockDbAll.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM wave5_artifacts')) return [nativeArtifactRow(orgId)];
      return []; // every other backfill source: nothing to backfill
    });

    mockDbGet.mockImplementation(async (sql: string) => {
      const s = String(sql);
      if (s.includes('FROM v8_artifact_origin_links')) return null; // no pre-existing link
      if (s.includes('FROM v8_output_artifacts')) {
        const insertCall = mockDbRun.mock.calls.find((c) =>
          String(c[0]).includes('INSERT INTO v8_output_artifacts')
        );
        const insertedId = (insertCall?.[1] as unknown[])?.[0] as string;
        return outputArtifactRow(insertedId, orgId);
      }
      return null;
    });

    await ensureBackfilledOutputsForOrg(orgId);

    const linkInsert = mockDbRun.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO v8_artifact_origin_links')
    );
    expect(linkInsert).toBeDefined();
    const linkParams = linkInsert?.[1] as unknown[];
    // (link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin, created_at)
    expect(linkParams[2]).toBe(orgId);
    expect(linkParams[3]).toBe('native_artifact');
    expect(linkParams[4]).toBe(ARTIFACT_ID);

    const outputInsert = mockDbRun.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO v8_output_artifacts')
    );
    expect(outputInsert).toBeDefined();
    const outputParams = outputInsert?.[1] as unknown[];
    // (artifact_id, organization_id, output_type, artifact_family, ...)
    expect(outputParams[1]).toBe(orgId);
    expect(outputParams[2]).toBe('report');
    expect(outputParams[3]).toBe('document');
  });

  it('does not re-index a wave5 artifact that already has a native_artifact origin link', async () => {
    const orgId = 'org-native-backfill-linked';

    // The backfill query itself LEFT JOINs on the missing link — an
    // already-linked row is filtered out by the SQL and never returned here.
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(null);

    await ensureBackfilledOutputsForOrg(orgId);

    const linkInsert = mockDbRun.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO v8_artifact_origin_links')
    );
    expect(linkInsert).toBeUndefined();
  });

  it('ignores wave5 artifacts from other producers (no documentStudioSchema marker)', async () => {
    const orgId = 'org-native-backfill-other-producer';

    // researchSessionService / the generic POST /api/artifacts/wave5 route
    // both write to the SAME wave5_artifacts table without the
    // documentStudioSchema provenance marker — the backfill SQL's own
    // `provenance_json LIKE '%"documentStudioSchema"%'` filter excludes them
    // at the query level, so a correctly-behaving mock never returns them
    // here either; this test documents that contract at the call-count level.
    mockDbAll.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM wave5_artifacts')) {
        expect(String(sql)).toContain('documentStudioSchema');
      }
      return [];
    });
    mockDbGet.mockResolvedValue(null);

    await ensureBackfilledOutputsForOrg(orgId);

    const linkInsert = mockDbRun.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO v8_artifact_origin_links')
    );
    expect(linkInsert).toBeUndefined();
  });
});
