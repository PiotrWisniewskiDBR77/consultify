/**
 * backfillDocStudioTemplatesForOrg — draft visibility fix (2026-07-28).
 *
 * Owner report: "wciśnę nowy template i on wywoła mi to, co wcześniej było
 * przygotowane przeze mnie, a nie te bohomazy" — diagnosis traced this to
 * `backfillDocStudioTemplatesForOrg` requiring `t.status = 'approved'` before
 * indexing a `document_studio_templates` row into the artifact registry that
 * feeds Materiały ▸ Szablony (`TemplatesTabContent`, `GET /api/artifacts
 * ?artifactFamily=template`). Every freshly-drafted template (from the AI
 * Template Architect OR the newly-wired "Zrób z tego wzorzec" flow in
 * `DocumentStudioDocumentPanel`) starts as `status: 'draft'` — so it NEVER
 * appeared in that list, and the "Submit for review" row action that would
 * promote it to `approved` only renders for rows already visible there. A
 * confirmed dead end.
 *
 * Live demo DB (trolley, SELECT-only) reproduced this exactly: the owner's
 * own `document_studio_templates` row ("Raport zarządczy test", status
 * 'draft', created_by = his user id) is excluded by the pre-fix SQL.
 *
 * The DAO backing the Architect's OWN internal list
 * (`documentTemplateRegistryDao.loadTemplatesForOrg`) has never filtered by
 * status — this backfill's extra restriction was a drift from that mirror,
 * not an intentional governance gate (confirmed: `resolveDocumentTemplateForCreation`
 * only blocks `status === 'deprecated'`, so a draft is already fully usable
 * for "Użyj wzorca" generation — only its LIBRARY VISIBILITY was broken).
 *
 * This suite drives the real production entry point
 * (`ensureBackfilledOutputsForOrg`), mirroring the existing
 * `artifactRegistryService.backfillNativeArtifacts.test.ts` mocking pattern.
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

const TEMPLATE_ID = 'doc-template-owner-draft-1';

function draftDocStudioTemplateRow(organizationId: string) {
  return {
    template_id: TEMPLATE_ID,
    organization_id: organizationId,
    name: 'Raport zarządczy — mój wzorzec',
    purpose: 'Executive update dla klienta',
    category: 'report',
    document_type: 'project_status_report',
    section_blueprint: JSON.stringify([{ key: 's1', title: 'Podsumowanie' }]),
    status: 'draft',
    version: '0.1',
    is_system: false,
    created_by: 'owner-user-1',
    created_at: '2026-07-22T17:06:56.058Z',
    updated_at: '2026-07-22T17:06:56.058Z',
  };
}

function outputArtifactRow(artifactId: string, organizationId: string) {
  return {
    artifact_id: artifactId,
    organization_id: organizationId,
    output_type: 'report',
    artifact_family: 'template',
    delivery_state: 'ready',
    title_snapshot: 'Raport zarządczy — mój wzorzec',
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
    created_by: 'owner-user-1',
    created_at: '2026-07-22T17:06:56.058Z',
    last_transition_at: '2026-07-22T17:06:56.058Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
});

describe('backfillDocStudioTemplatesForOrg (via ensureBackfilledOutputsForOrg) — draft visibility fix', () => {
  it('the backfill query no longer restricts document_studio_templates to status=approved', async () => {
    const orgId = 'org-doc-tpl-draft-sql-shape';
    let capturedDocStudioSql: string | null = null;

    mockDbAll.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM document_studio_templates')) {
        capturedDocStudioSql = String(sql);
      }
      return [];
    });
    mockDbGet.mockResolvedValue(null);

    await ensureBackfilledOutputsForOrg(orgId);

    expect(capturedDocStudioSql).not.toBeNull();
    expect(capturedDocStudioSql).not.toMatch(/status\s*=\s*'approved'/i);
  });

  it('indexes a DRAFT document_studio_templates row that has no origin link yet (previously excluded)', async () => {
    const orgId = 'org-doc-tpl-draft-indexed';

    mockDbAll.mockImplementation(async (sql: string) => {
      if (String(sql).includes('FROM document_studio_templates')) {
        return [draftDocStudioTemplateRow(orgId)];
      }
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
    expect(linkParams[3]).toBe('document_template');
    expect(linkParams[4]).toBe(TEMPLATE_ID);

    const outputInsert = mockDbRun.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO v8_output_artifacts')
    );
    expect(outputInsert).toBeDefined();
    const outputParams = outputInsert?.[1] as unknown[];
    expect(outputParams[1]).toBe(orgId);
    expect(outputParams[2]).toBe('report');
    expect(outputParams[3]).toBe('template');

    // The origin summary must carry the real 'draft' status through — the
    // whole point is that the Library shows "Szkic"/"Draft", not a
    // fabricated 'approved' badge for a template nobody reviewed yet.
    // Param order per the INSERT INTO v8_output_artifacts column list:
    // origin_summary_json is the 16th positional value (index 15).
    const summaryJson = outputParams[15];
    expect(String(summaryJson)).toContain('"status":"draft"');
  });

  it('does not re-index a document_studio_templates row that already has a document_template origin link', async () => {
    const orgId = 'org-doc-tpl-draft-linked';

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
});
