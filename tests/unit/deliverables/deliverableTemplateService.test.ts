// @vitest-environment node
/**
 * Unit tests — deliverableTemplateService
 *
 * Mockuje queryAll, weryfikuje SQL routing, mapowanie isBlank i fail-open.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock queryHelpers ---
const queryAllMock = vi.fn();
const queryOneMock = vi.fn();

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: any[]) => queryAllMock(...args),
  queryOne: (...args: any[]) => queryOneMock(...args),
  queryRun: vi.fn(),
}));

// --- Mock artifact registry (split-brain fix under test) ---
const registerArtifactOriginMock = vi.fn();

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...args: any[]) => registerArtifactOriginMock(...args),
}));

describe('deliverableTemplateService', () => {
  let listDeliverableTemplates: (type: any, orgId: string) => Promise<any[]>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import serwisu by pobrać świeże zależności
    vi.resetModules();
    const mod = await import('../../../server/src/services/deliverableTemplateService.js');
    listDeliverableTemplates = mod.listDeliverableTemplates;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // FT-1.1 — deck wywołuje właściwy SQL
  it('queries presentation_templates for type=deck', async () => {
    queryAllMock.mockResolvedValue([
      { id: 'd1', name: 'Corporate', description: null, is_system: true, theme: 'corporate', organization_id: null, outline_json: '[]' },
    ]);
    const result = await listDeliverableTemplates('deck', 'org-x');
    expect(queryAllMock).toHaveBeenCalledOnce();
    const [sql, params] = queryAllMock.mock.calls[0];
    expect(sql).toContain('presentation_templates');
    expect(params).toContain('org-x');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('deck');
    expect(result[0].isSystem).toBe(true);
  });

  // FT-1.2 — doc wywołuje właściwy SQL
  it('queries report_builder_templates for type=doc', async () => {
    queryAllMock.mockResolvedValue([
      { id: 'r1', name: 'Audit Report', description: 'Full audit', is_system: true, is_public: false, report_type: 'ASSESSMENT_DRD', sections_json: '[{"id":1}]', organization_id: null },
    ]);
    const result = await listDeliverableTemplates('doc', 'org-x');
    expect(queryAllMock).toHaveBeenCalledOnce();
    const [sql, params] = queryAllMock.mock.calls[0];
    expect(sql).toContain('report_builder_templates');
    expect(params).toContain('org-x');
    expect(result[0].type).toBe('doc');
    expect(result[0].meta).toHaveProperty('sections_json');
  });

  // FT-1.3 — fail-open: błąd DB zwraca []
  it('returns [] when DB throws (fail-open)', async () => {
    queryAllMock.mockRejectedValue(new Error('relation "presentation_templates" does not exist'));
    const result = await listDeliverableTemplates('deck', 'org-x');
    expect(result).toEqual([]);
  });

  // FT-1.4 — isBlank = true gdy name zawiera 'blank'
  it('sets isBlank=true when name contains "blank"', async () => {
    queryAllMock.mockResolvedValue([
      { id: 'b1', name: 'Blank Deck', description: null, is_system: true, theme: null, organization_id: null, outline_json: null },
    ]);
    const result = await listDeliverableTemplates('deck', 'org-x');
    expect(result[0].isBlank).toBe(true);
  });

  // FT-1.5 — isBlank = true gdy name zawiera 'pusty'
  it('sets isBlank=true when name contains "pusty"', async () => {
    queryAllMock.mockResolvedValue([
      { id: 'b2', name: 'Pusty raport', description: null, is_system: false, is_public: false, report_type: null, sections_json: '[]', organization_id: null },
    ]);
    const result = await listDeliverableTemplates('doc', 'org-x');
    expect(result[0].isBlank).toBe(true);
  });

  // FT-1.6 — table: isSystem=true gdy created_by IS NULL
  it('sets isSystem=true for table templates with created_by=null', async () => {
    queryAllMock.mockResolvedValue([
      { id: 'tpl-uuid', name: 'Risk Register', description: null, is_featured: true, category: 'risk', schema_snapshot: {}, created_by: null },
    ]);
    const result = await listDeliverableTemplates('table', 'org-x');
    expect(result[0].isSystem).toBe(true);
    expect(result[0].organizationId).toBeNull();
  });

  // FT-1.7 — doc fail-open
  it('returns [] when report_builder_templates query fails', async () => {
    queryAllMock.mockRejectedValue(new Error('column sections_json does not exist'));
    const result = await listDeliverableTemplates('doc', 'org-x');
    expect(result).toEqual([]);
  });
});

// FT-3.x — Template Library visibility unification (System/Organizacja/Prywatny).
// deliverableTemplateService now applies a single 3-level rule across all
// 3 legacy tables (presentation_templates/report_builder_templates/
// tp_base_templates): System (is_system=true, or created_by IS NULL for
// table) is visible everywhere; Organization (visibility<>'private' AND
// organization_id = orgId) is visible org-wide; Private (visibility='private'
// AND created_by = userId) is owner-only. Because `visibility` may not exist
// yet on a given DB (migration 918 is additive/manual, not auto-applied),
// each list* function falls back to the pre-existing 2-level query when the
// DB throws "column visibility does not exist" — this is the backward
// compatibility guarantee under test here.
describe('deliverableTemplateService — 3-level visibility (System/Organization/Private)', () => {
  let listDeliverableTemplates: (
    type: any,
    orgId: string,
    userId?: string
  ) => Promise<any[]>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../../../server/src/services/deliverableTemplateService.js');
    listDeliverableTemplates = mod.listDeliverableTemplates;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // FT-3.1 — deck: SQL passes both orgId and userId so 'private' rows can be
  // matched by owner, and encodes all 3 levels.
  it('deck: query encodes system/organization/private and passes [orgId, userId]', async () => {
    queryAllMock.mockResolvedValue([]);
    await listDeliverableTemplates('deck', 'org-x', 'user-1');
    expect(queryAllMock).toHaveBeenCalledOnce();
    const [sql, params] = queryAllMock.mock.calls[0];
    expect(sql).toContain('is_system = true');
    expect(sql).toContain("visibility, 'organization') <> 'private'");
    expect(sql).toContain("visibility = 'private' AND created_by = $2");
    expect(params).toEqual(['org-x', 'user-1']);
  });

  // FT-3.2 — doc: same 3-level shape, plus legacy is_public bypass preserved.
  it('doc: query preserves is_public bypass alongside the 3-level rule', async () => {
    queryAllMock.mockResolvedValue([]);
    await listDeliverableTemplates('doc', 'org-x', 'user-1');
    const [sql, params] = queryAllMock.mock.calls[0];
    expect(sql).toContain('is_public = true');
    expect(sql).toContain("visibility = 'private' AND created_by = $2");
    expect(params).toEqual(['org-x', 'user-1']);
  });

  // FT-3.3 — table: org-scoping is NEW (legacy query had none at all) — this
  // is the actual gap-close. Verify it's now present in the live query.
  it('table: query now org-scopes (gap-close vs legacy unscoped SELECT *)', async () => {
    queryAllMock.mockResolvedValue([]);
    await listDeliverableTemplates('table', 'org-x', 'user-1');
    const [sql, params] = queryAllMock.mock.calls[0];
    expect(sql).toContain('created_by IS NULL');
    expect(sql).toContain('organization_id = $1');
    expect(params).toEqual(['org-x', 'user-1']);
  });

  // FT-3.4 — private row (visibility='private') IS returned when the caller
  // is the owner (userId matches created_by) — end-to-end row shape check.
  it('deck: maps a private row through when returned by the DB (owner path)', async () => {
    queryAllMock.mockResolvedValue([
      {
        id: 'd-priv',
        name: 'My Private Deck',
        description: null,
        is_system: false,
        theme: null,
        organization_id: 'org-x',
        outline_json: '[]',
      },
    ]);
    const result = await listDeliverableTemplates('deck', 'org-x', 'user-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('d-priv');
    expect(result[0].isSystem).toBe(false);
  });

  // FT-3.5 — backward compatibility: when the DB doesn't have the
  // `visibility` column yet (migration 918 not applied), the service must
  // NOT go fail-open→[] (that would hide every template until the manual
  // migration runs) — it must fall back to the legacy 2-level query and
  // still return rows.
  it('deck: falls back to the legacy 2-level query when `visibility` column is missing', async () => {
    queryAllMock
      .mockRejectedValueOnce(new Error('column "visibility" does not exist'))
      .mockResolvedValueOnce([
        {
          id: 'd-legacy',
          name: 'Legacy Deck',
          description: null,
          is_system: true,
          theme: null,
          organization_id: null,
          outline_json: '[]',
        },
      ]);
    const result = await listDeliverableTemplates('deck', 'org-x', 'user-1');
    expect(queryAllMock).toHaveBeenCalledTimes(2);
    const [legacySql, legacyParams] = queryAllMock.mock.calls[1];
    expect(legacySql).not.toContain('visibility');
    expect(legacyParams).toEqual(['org-x']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('d-legacy');
  });

  // FT-3.6 — same backward-compat guarantee for doc.
  it('doc: falls back to the legacy 2-level query when `visibility` column is missing', async () => {
    queryAllMock
      .mockRejectedValueOnce(new Error('column visibility does not exist'))
      .mockResolvedValueOnce([
        {
          id: 'r-legacy',
          name: 'Legacy Report',
          description: null,
          is_system: false,
          is_public: true,
          report_type: 'custom',
          sections_json: '[]',
          organization_id: null,
        },
      ]);
    const result = await listDeliverableTemplates('doc', 'org-x', 'user-1');
    expect(queryAllMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r-legacy');
  });

  // FT-3.7 — same backward-compat guarantee for table, AND confirms the
  // legacy fallback SQL is truly unscoped (matches today's exact behaviour,
  // not the new org-scoped rule) — i.e. nothing regresses before the manual
  // migration is applied.
  it('table: falls back to the legacy unscoped query when `visibility` column is missing', async () => {
    queryAllMock
      .mockRejectedValueOnce(new Error('column "visibility" does not exist'))
      .mockResolvedValueOnce([
        {
          id: 't-legacy',
          name: 'Legacy Table Template',
          description: null,
          is_featured: false,
          category: 'custom',
          schema_snapshot: {},
          created_by: 'some-other-user',
          organization_id: null,
        },
      ]);
    const result = await listDeliverableTemplates('table', 'org-x', 'user-1');
    expect(queryAllMock).toHaveBeenCalledTimes(2);
    const [legacySql, legacyParams] = queryAllMock.mock.calls[1];
    expect(legacySql).not.toContain('visibility');
    expect(legacySql).not.toContain('organization_id = $1');
    expect(legacyParams).toEqual([]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t-legacy');
  });

  // FT-3.8 — orphan safety net: a legacy tp_base_templates row created via
  // the OTHER save-as-template path (tablePlatform/TemplateService.ts —
  // organization_id is never set there) must not silently vanish once the
  // org-scoping gap-close ships. The runtime query carries an explicit
  // `organization_id IS NULL AND created_by IS NOT NULL` branch for this;
  // here we just assert the branch text is present (row-level DB filtering
  // can't be exercised against a mock).
  it('table: query keeps a safety-net branch for org_id-NULL orphan rows (no silent disappearance)', async () => {
    queryAllMock.mockResolvedValue([]);
    await listDeliverableTemplates('table', 'org-x', 'user-1');
    const [sql] = queryAllMock.mock.calls[0];
    expect(sql).toContain('organization_id IS NULL AND created_by IS NOT NULL');
  });
});

// FT-2.x — createDeliverableTemplate split-brain fix: builder-created templates
// must be registered in the canonical Outputs artifact registry
// (registerArtifactOrigin) so they show up in the Template Library tab
// (GET /api/artifacts?artifactFamily=template), not just in
// GET /api/deliverables/templates.
describe('deliverableTemplateService — createDeliverableTemplate registry registration', () => {
  let createDeliverableTemplate: (
    type: any,
    name: string,
    description: string | undefined,
    meta: Record<string, unknown> | undefined,
    orgId: string,
    userId: string
  ) => Promise<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../../../server/src/services/deliverableTemplateService.js');
    createDeliverableTemplate = mod.createDeliverableTemplate;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // FT-2.1 — doc: INSERT into report_builder_templates then registerArtifactOrigin
  // is called with artifactFamily='template', originRuntime='report_template'.
  it('registers a doc template in the artifact registry after insert', async () => {
    queryOneMock
      .mockResolvedValueOnce({ id: 'tpl-doc-1' }) // INSERT ... RETURNING id
      .mockResolvedValueOnce(null) // getDeliverableTemplate: deck lookup miss
      .mockResolvedValueOnce({
        // getDeliverableTemplate: doc lookup hit
        id: 'tpl-doc-1',
        name: 'My Doc Template',
        description: 'desc',
        is_system: false,
        is_public: false,
        report_type: 'custom',
        sections_json: '[]',
        organization_id: 'org-x',
      });
    registerArtifactOriginMock.mockResolvedValue({ artifactId: 'artifact-1' });

    const result = await createDeliverableTemplate(
      'doc',
      'My Doc Template',
      'desc',
      { sections_json: [] },
      'org-x',
      'user-1'
    );

    expect(result.id).toBe('tpl-doc-1');
    expect(registerArtifactOriginMock).toHaveBeenCalledOnce();
    const call = registerArtifactOriginMock.mock.calls[0][0];
    expect(call).toMatchObject({
      organizationId: 'org-x',
      outputType: 'report',
      artifactFamily: 'template',
      originRuntime: 'report_template',
      originRecordId: 'tpl-doc-1',
      titleSnapshot: 'My Doc Template',
      ownerUserId: 'user-1',
      createdBy: 'user-1',
      visibilityScope: 'organization',
    });
  });

  // FT-2.2 — deck: INSERT into presentation_templates then registerArtifactOrigin
  // is called with originRuntime='presentation_template'.
  it('registers a deck template in the artifact registry after insert', async () => {
    queryOneMock
      .mockResolvedValueOnce({ id: 'tpl-deck-1' }) // INSERT ... RETURNING id
      .mockResolvedValueOnce({
        // getDeliverableTemplate: deck lookup hit
        id: 'tpl-deck-1',
        name: 'My Deck Template',
        description: null,
        is_system: false,
        theme: null,
        organization_id: 'org-x',
        outline_json: '[]',
      });
    registerArtifactOriginMock.mockResolvedValue({ artifactId: 'artifact-2' });

    const result = await createDeliverableTemplate(
      'deck',
      'My Deck Template',
      undefined,
      { outline_json: [] },
      'org-x',
      'user-1'
    );

    expect(result.id).toBe('tpl-deck-1');
    expect(registerArtifactOriginMock).toHaveBeenCalledOnce();
    const call = registerArtifactOriginMock.mock.calls[0][0];
    expect(call).toMatchObject({
      organizationId: 'org-x',
      outputType: 'presentation',
      artifactFamily: 'template',
      originRuntime: 'presentation_template',
      originRecordId: 'tpl-deck-1',
      visibilityScope: 'organization',
    });
  });

  // FT-2.3 — table: no ArtifactOriginRuntime mapping exists yet → registry is
  // skipped (not called), but the template row is still created successfully.
  it('does not call registerArtifactOrigin for table templates (no mapping)', async () => {
    queryOneMock
      .mockResolvedValueOnce({ id: 'tpl-table-1' }) // INSERT ... RETURNING id
      .mockResolvedValueOnce(null) // getDeliverableTemplate: deck miss
      .mockResolvedValueOnce(null) // getDeliverableTemplate: doc miss
      .mockResolvedValueOnce({
        // getDeliverableTemplate: table hit
        id: 'tpl-table-1',
        name: 'My Table Template',
        description: null,
        is_featured: false,
        category: 'custom',
        schema_snapshot: {},
        created_by: 'user-1',
        organization_id: 'org-x',
      });

    const result = await createDeliverableTemplate(
      'table',
      'My Table Template',
      undefined,
      {},
      'org-x',
      'user-1'
    );

    expect(result.id).toBe('tpl-table-1');
    expect(registerArtifactOriginMock).not.toHaveBeenCalled();
  });

  // FT-2.4 — fail-soft: registry throwing must NOT break template creation.
  it('still returns the created template when registerArtifactOrigin throws', async () => {
    queryOneMock
      .mockResolvedValueOnce({ id: 'tpl-doc-2' }) // INSERT ... RETURNING id
      .mockResolvedValueOnce(null) // deck lookup miss
      .mockResolvedValueOnce({
        id: 'tpl-doc-2',
        name: 'Resilient Doc',
        description: null,
        is_system: false,
        is_public: false,
        report_type: 'custom',
        sections_json: '[]',
        organization_id: 'org-x',
      });
    registerArtifactOriginMock.mockRejectedValue(new Error('registry unavailable'));

    const result = await createDeliverableTemplate(
      'doc',
      'Resilient Doc',
      undefined,
      {},
      'org-x',
      'user-1'
    );

    expect(result.id).toBe('tpl-doc-2');
    expect(registerArtifactOriginMock).toHaveBeenCalledOnce();
  });
});
