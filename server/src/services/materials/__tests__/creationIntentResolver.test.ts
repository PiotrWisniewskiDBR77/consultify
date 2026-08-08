/**
 * R11 (doc slice) — server-side template resolver.
 *
 * Deterministic: the DB layer and the Document Studio registry are mocked, so
 * nothing here depends on a live database. Fixtures mirror the REAL column
 * shapes (`document_studio_templates` — migration 769; `report_builder_templates`
 * — migration 503 + `is_active` from 569).
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

const mockEnsureHydrated = vi.fn(async () => undefined);
const mockGetTemplate = vi.fn();

vi.mock('../../documentStudio/documentTemplateService.js', () => ({
  ensureTemplateRegistryHydrated: (...args: unknown[]) => mockEnsureHydrated(...(args as [])),
  getTemplate: (...args: unknown[]) => mockGetTemplate(...args),
}));

import {
  isTemplateResolveError,
  resolveDocumentTemplateForCreation,
  resolvePresentationTemplateForCreation,
  type TemplateRef,
  TemplateResolveError,
} from '../creationIntent.js';

const ORG = 'org-alpha';
const OTHER_ORG = 'org-beta';
const SYSTEM_ORG = '__system__';

// --- Fixtures: real column shapes -------------------------------------------

/** `document_studio_templates` (migration 769). PK is `template_id`, NOT `id`. */
function docStudioRow(overrides: Record<string, unknown> = {}) {
  return {
    template_id: 'dst-exec-memo-001',
    organization_id: ORG,
    status: 'approved',
    is_system: false,
    ...overrides,
  };
}

/** `report_builder_templates` (migration 503 + `is_active` from 569). */
function reportTemplateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rbt-assessment-drd',
    organization_id: ORG,
    is_system: false,
    is_active: true,
    is_public: false,
    sections_json: JSON.stringify([
      { key: 'exec_summary', title: 'Executive summary' },
      { key: 'findings', title: 'Findings' },
    ]),
    ...overrides,
  };
}

/** What `documentTemplateService.getTemplate` returns (DocumentTemplate). */
function registeredDocTemplate(overrides: Record<string, unknown> = {}) {
  return {
    templateId: 'dst-exec-memo-001',
    organizationId: ORG,
    name: 'Executive memo',
    // `purpose` is the human description — the blueprint must NOT come from it.
    purpose: 'One-page decision memo for the steering committee',
    status: 'approved',
    sectionBlueprint: [
      { key: 'situation', title: 'Sytuacja', required: true },
      { key: 'options', title: 'Opcje', required: true },
      { key: 'recommendation', title: 'Rekomendacja', required: true },
    ],
    ...overrides,
  };
}

/**
 * `presentation_templates` (migration 568 base + 767 `lifecycle_state`). PK is
 * `id`; system templates seeded with `organization_id IS NULL`.
 */
function presentationTemplateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pt-steering',
    organization_id: null,
    name: 'Steering Committee Update',
    is_system: true,
    is_active: true,
    lifecycle_state: 'approved',
    theme: 'modern',
    layout_policy_json: null,
    outline_json: JSON.stringify([
      { intent: 'cover', title: 'Steering Committee Update' },
      { intent: 'executive_summary', title: 'Executive Summary', keyMessage: 'Q3 on track' },
      { intent: 'next_steps', title: 'Next Steps & Decisions' },
    ]),
    ...overrides,
  };
}

interface DbRoute {
  originLink?: unknown;
  docStudio?: unknown;
  reportTemplate?: unknown;
  presentationTemplate?: unknown;
}

/** Route `dbGet` by the table named in the SQL. Absent route → row not found. */
function routeDb(routes: DbRoute) {
  mockDbGet.mockImplementation(async (sql: string) => {
    if (sql.includes('v8_artifact_origin_links')) return routes.originLink ?? null;
    if (sql.includes('document_studio_templates')) return routes.docStudio ?? null;
    if (sql.includes('report_builder_templates')) return routes.reportTemplate ?? null;
    if (sql.includes('presentation_templates')) return routes.presentationTemplate ?? null;
    return null;
  });
}

async function expectResolveError(
  ref: TemplateRef,
  code: string,
  organizationId: string = ORG
): Promise<TemplateResolveError> {
  try {
    await resolveDocumentTemplateForCreation(ref, { organizationId });
  } catch (err) {
    expect(isTemplateResolveError(err)).toBe(true);
    expect((err as TemplateResolveError).code).toBe(code);
    return err as TemplateResolveError;
  }
  throw new Error(`Expected ${code} but the resolver returned successfully`);
}

async function expectPresentationResolveError(
  ref: TemplateRef,
  code: string,
  organizationId: string = ORG
): Promise<TemplateResolveError> {
  try {
    await resolvePresentationTemplateForCreation(ref, { organizationId });
  } catch (err) {
    expect(isTemplateResolveError(err)).toBe(true);
    expect((err as TemplateResolveError).code).toBe(code);
    return err as TemplateResolveError;
  }
  throw new Error(`Expected ${code} but the resolver returned successfully`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbAll.mockResolvedValue([]);
  mockDbRun.mockResolvedValue({ success: true });
  mockEnsureHydrated.mockResolvedValue(undefined);
  mockGetTemplate.mockReturnValue(null);
});

describe('resolveDocumentTemplateForCreation — canonical Document Studio template', () => {
  it('returns the sectionBlueprint from the registry (not the description) and separated ids', async () => {
    routeDb({
      originLink: { origin_runtime: 'document_template', origin_record_id: 'dst-exec-memo-001' },
      docStudio: docStudioRow(),
    });
    mockGetTemplate.mockReturnValue(registeredDocTemplate());

    const resolved = await resolveDocumentTemplateForCreation(
      { kind: 'library', templateArtifactId: 'art-9f3c-library-card' },
      { organizationId: ORG }
    );

    expect(resolved.originRuntime).toBe('document_template');
    expect(resolved.format).toBe('document');
    expect(resolved.source).toBe('canonical');
    expect(resolved.legacy).toBe(false);
    expect(resolved.status).toBe('approved');
    expect(resolved.scope).toBe('organization');

    // The library card id and the canonical registry id are DIFFERENT things.
    expect(resolved.canonicalTemplateId).toBe('dst-exec-memo-001');
    expect(resolved.canonicalTemplateId).not.toBe('art-9f3c-library-card');

    // Blueprint is the real section structure, not the prose description.
    expect(resolved.sectionBlueprint).toHaveLength(3);
    expect(resolved.sectionBlueprint).toEqual(registeredDocTemplate().sectionBlueprint);
    expect(JSON.stringify(resolved.sectionBlueprint)).not.toContain('steering committee');

    // Blueprint read FRESH from the canonical registry.
    expect(mockEnsureHydrated).toHaveBeenCalledWith(ORG);
    expect(mockGetTemplate).toHaveBeenCalledWith('dst-exec-memo-001', ORG);
  });

  it('resolves a system-scope template for any tenant and reports scope "system"', async () => {
    routeDb({
      docStudio: docStudioRow({ organization_id: SYSTEM_ORG, is_system: true }),
    });
    mockGetTemplate.mockReturnValue(registeredDocTemplate({ organizationId: SYSTEM_ORG }));

    const resolved = await resolveDocumentTemplateForCreation(
      {
        kind: 'internal',
        canonicalTemplateId: 'dst-exec-memo-001',
        originRuntime: 'document_template',
      },
      { organizationId: ORG }
    );

    expect(resolved.scope).toBe('system');
    expect(resolved.source).toBe('canonical');
  });

  it('never writes to the database', async () => {
    routeDb({ docStudio: docStudioRow() });
    mockGetTemplate.mockReturnValue(registeredDocTemplate());

    await resolveDocumentTemplateForCreation(
      {
        kind: 'internal',
        canonicalTemplateId: 'dst-exec-memo-001',
        originRuntime: 'document_template',
      },
      { organizationId: ORG }
    );

    expect(mockDbRun).not.toHaveBeenCalled();
  });
});

describe('resolveDocumentTemplateForCreation — legacy report template', () => {
  it('marks the legacy registry as source:"legacy" and returns its sections', async () => {
    routeDb({
      originLink: { origin_runtime: 'report_template', origin_record_id: 'rbt-assessment-drd' },
      reportTemplate: reportTemplateRow(),
    });

    const resolved = await resolveDocumentTemplateForCreation(
      { kind: 'library', templateArtifactId: 'art-legacy-card' },
      { organizationId: ORG }
    );

    expect(resolved.originRuntime).toBe('report_template');
    expect(resolved.source).toBe('legacy');
    expect(resolved.legacy).toBe(true);
    expect(resolved.format).toBe('document');
    expect(resolved.status).toBe('published');
    expect(resolved.sectionBlueprint).toEqual([
      { key: 'exec_summary', title: 'Executive summary' },
      { key: 'findings', title: 'Findings' },
    ]);
    // The Document Studio registry is NOT consulted for a legacy template.
    expect(mockGetTemplate).not.toHaveBeenCalled();
  });

  it('reads scope "system" from organization_id IS NULL + is_system', async () => {
    routeDb({
      reportTemplate: reportTemplateRow({ organization_id: null, is_system: true }),
    });

    const resolved = await resolveDocumentTemplateForCreation(
      {
        kind: 'internal',
        canonicalTemplateId: 'rbt-assessment-drd',
        originRuntime: 'report_template',
      },
      { organizationId: ORG }
    );

    expect(resolved.scope).toBe('system');
    expect(resolved.legacy).toBe(true);
  });
});

describe('resolveDocumentTemplateForCreation — rejection paths', () => {
  it('TEMPLATE_NOT_INDEXED when the artifact has no origin link', async () => {
    routeDb({});
    await expectResolveError(
      { kind: 'library', templateArtifactId: 'art-missing' },
      'TEMPLATE_NOT_INDEXED'
    );
  });

  it('TEMPLATE_ORPHANED when the link survives but the canonical record is gone', async () => {
    routeDb({
      originLink: { origin_runtime: 'document_template', origin_record_id: 'dst-deleted-001' },
      // document_studio_templates has no such row any more.
    });

    const err = await expectResolveError(
      { kind: 'library', templateArtifactId: 'art-orphan-card' },
      'TEMPLATE_ORPHANED'
    );
    expect(err.details.canonicalTemplateId).toBe('dst-deleted-001');
    // An orphan is NEVER offered as a ready template …
    expect(mockGetTemplate).not.toHaveBeenCalled();
    // … and detecting one must not delete or rewrite anything.
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('TEMPLATE_ORPHANED for a legacy link whose report template row is gone', async () => {
    routeDb({
      originLink: { origin_runtime: 'report_template', origin_record_id: 'rbt-deleted' },
    });
    await expectResolveError(
      { kind: 'library', templateArtifactId: 'art-orphan-legacy' },
      'TEMPLATE_ORPHANED'
    );
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('TEMPLATE_FORBIDDEN when the template belongs to another organization', async () => {
    routeDb({ docStudio: docStudioRow({ organization_id: OTHER_ORG, is_system: false }) });

    await expectResolveError(
      {
        kind: 'internal',
        canonicalTemplateId: 'dst-exec-memo-001',
        originRuntime: 'document_template',
      },
      'TEMPLATE_FORBIDDEN'
    );
    // Access is validated SERVER-SIDE even though the caller supplied the id.
    expect(mockGetTemplate).not.toHaveBeenCalled();
  });

  it('TEMPLATE_FORBIDDEN for a foreign-org legacy template', async () => {
    routeDb({
      reportTemplate: reportTemplateRow({
        organization_id: OTHER_ORG,
        is_system: false,
        is_public: false,
      }),
    });
    await expectResolveError(
      {
        kind: 'internal',
        canonicalTemplateId: 'rbt-assessment-drd',
        originRuntime: 'report_template',
      },
      'TEMPLATE_FORBIDDEN'
    );
  });

  it('TEMPLATE_DEPRECATED when the canonical row is deprecated', async () => {
    routeDb({ docStudio: docStudioRow({ status: 'deprecated' }) });

    await expectResolveError(
      {
        kind: 'internal',
        canonicalTemplateId: 'dst-exec-memo-001',
        originRuntime: 'document_template',
      },
      'TEMPLATE_DEPRECATED'
    );
  });

  it('TEMPLATE_DEPRECATED when a legacy template is deactivated (is_active = false)', async () => {
    routeDb({ reportTemplate: reportTemplateRow({ is_active: false }) });

    await expectResolveError(
      {
        kind: 'internal',
        canonicalTemplateId: 'rbt-assessment-drd',
        originRuntime: 'report_template',
      },
      'TEMPLATE_DEPRECATED'
    );
  });

  it('TEMPLATE_FORMAT_UNSUPPORTED for deck and sheet runtimes (out of this slice)', async () => {
    routeDb({
      originLink: { origin_runtime: 'presentation_template', origin_record_id: 'pt-steering' },
    });
    await expectResolveError(
      { kind: 'library', templateArtifactId: 'art-deck-card' },
      'TEMPLATE_FORMAT_UNSUPPORTED'
    );

    routeDb({ originLink: { origin_runtime: 'sheet_template', origin_record_id: 'bt-sheet-1' } });
    await expectResolveError(
      { kind: 'library', templateArtifactId: 'art-sheet-card' },
      'TEMPLATE_FORMAT_UNSUPPORTED'
    );
  });

  it('rejects an internal ref without originRuntime (the union forbids it at compile time)', async () => {
    // @ts-expect-error — `kind: 'internal'` REQUIRES originRuntime; a loose
    // object with two optional ids would let this through silently.
    const badRef: TemplateRef = { kind: 'internal', canonicalTemplateId: 'dst-exec-memo-001' };

    routeDb({ docStudio: docStudioRow() });
    await expectResolveError(badRef, 'TEMPLATE_NOT_INDEXED');
    // Nothing was even probed in the canonical registry.
    expect(mockGetTemplate).not.toHaveBeenCalled();
  });

  it('rejects an internal ref carrying an unknown originRuntime value', async () => {
    const badRef = {
      kind: 'internal',
      canonicalTemplateId: 'dst-exec-memo-001',
      originRuntime: 'mind_map_template',
    } as unknown as TemplateRef;

    await expectResolveError(badRef, 'TEMPLATE_NOT_INDEXED');
  });

  it('TEMPLATE_FORBIDDEN when no organization context is supplied', async () => {
    await expectResolveError(
      {
        kind: 'internal',
        canonicalTemplateId: 'dst-exec-memo-001',
        originRuntime: 'document_template',
      },
      'TEMPLATE_FORBIDDEN',
      ''
    );
  });
});

// =============================================================================
// R11 DECK SLICE (2026-07-26) — resolvePresentationTemplateForCreation
// =============================================================================

describe('resolvePresentationTemplateForCreation — canonical presentation template', () => {
  it('returns the outline_json blueprint fresh from the registry, matching the fixture row', async () => {
    routeDb({
      originLink: { origin_runtime: 'presentation_template', origin_record_id: 'pt-steering' },
      presentationTemplate: presentationTemplateRow(),
    });

    const resolved = await resolvePresentationTemplateForCreation(
      { kind: 'library', templateArtifactId: 'art-deck-library-card' },
      { organizationId: ORG }
    );

    expect(resolved.originRuntime).toBe('presentation_template');
    expect(resolved.format).toBe('presentation');
    expect(resolved.source).toBe('canonical');
    expect(resolved.legacy).toBe(false);
    expect(resolved.status).toBe('approved');
    expect(resolved.scope).toBe('system');
    expect(resolved.name).toBe('Steering Committee Update');

    // The library card id and the canonical registry id are DIFFERENT things.
    expect(resolved.canonicalTemplateId).toBe('pt-steering');
    expect(resolved.canonicalTemplateId).not.toBe('art-deck-library-card');

    // Blueprint IS the fixture row's outline_json, parsed — not derived from
    // anything else (e.g. not a text description, not AI output).
    expect(resolved.outlineBlueprint).toEqual(
      JSON.parse(presentationTemplateRow().outline_json as string)
    );
    expect(resolved.outlineBlueprint).toHaveLength(3);
  });

  it('resolves an organization-scoped template for its own org and reports scope "organization"', async () => {
    routeDb({
      presentationTemplate: presentationTemplateRow({
        id: 'pt-custom-1',
        organization_id: ORG,
        is_system: false,
      }),
    });

    const resolved = await resolvePresentationTemplateForCreation(
      {
        kind: 'internal',
        canonicalTemplateId: 'pt-custom-1',
        originRuntime: 'presentation_template',
      },
      { organizationId: ORG }
    );

    expect(resolved.scope).toBe('organization');
    expect(resolved.canonicalTemplateId).toBe('pt-custom-1');
  });

  it('carries the custom theme/master contract fresh from the canonical registry', async () => {
    const customTemplate = {
      version: 2,
      theme: { titleFont: 'Aptos Display', primaryColor: '#123456' },
      layouts: { board: { masterName: 'Board Master' } },
      layoutMapping: { cover: 'board' },
    };
    routeDb({
      presentationTemplate: presentationTemplateRow({
        theme: 'board-custom',
        layout_policy_json: JSON.stringify({ customTemplate }),
      }),
    });

    const resolved = await resolvePresentationTemplateForCreation(
      {
        kind: 'internal',
        canonicalTemplateId: 'pt-steering',
        originRuntime: 'presentation_template',
      },
      { organizationId: ORG }
    );

    expect(resolved.theme).toBe('board-custom');
    expect(resolved.customTemplate).toEqual(customTemplate);
  });

  it('never writes to the database', async () => {
    routeDb({ presentationTemplate: presentationTemplateRow() });

    await resolvePresentationTemplateForCreation(
      {
        kind: 'internal',
        canonicalTemplateId: 'pt-steering',
        originRuntime: 'presentation_template',
      },
      { organizationId: ORG }
    );

    expect(mockDbRun).not.toHaveBeenCalled();
  });
});

describe('resolvePresentationTemplateForCreation — rejection paths', () => {
  it('TEMPLATE_NOT_INDEXED when the artifact has no origin link', async () => {
    routeDb({});
    await expectPresentationResolveError(
      { kind: 'library', templateArtifactId: 'art-missing' },
      'TEMPLATE_NOT_INDEXED'
    );
  });

  it('TEMPLATE_ORPHANED when the link survives but the canonical record is gone', async () => {
    routeDb({
      originLink: { origin_runtime: 'presentation_template', origin_record_id: 'pt-deleted' },
      // presentation_templates has no such row any more.
    });

    const err = await expectPresentationResolveError(
      { kind: 'library', templateArtifactId: 'art-orphan-deck-card' },
      'TEMPLATE_ORPHANED'
    );
    expect(err.details.canonicalTemplateId).toBe('pt-deleted');
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('TEMPLATE_FORBIDDEN when the template belongs to another organization', async () => {
    routeDb({
      presentationTemplate: presentationTemplateRow({
        id: 'pt-foreign',
        organization_id: OTHER_ORG,
        is_system: false,
      }),
    });

    await expectPresentationResolveError(
      {
        kind: 'internal',
        canonicalTemplateId: 'pt-foreign',
        originRuntime: 'presentation_template',
      },
      'TEMPLATE_FORBIDDEN'
    );
  });

  it('TEMPLATE_DEPRECATED when lifecycle_state is deprecated', async () => {
    routeDb({
      presentationTemplate: presentationTemplateRow({ lifecycle_state: 'deprecated' }),
    });

    await expectPresentationResolveError(
      {
        kind: 'internal',
        canonicalTemplateId: 'pt-steering',
        originRuntime: 'presentation_template',
      },
      'TEMPLATE_DEPRECATED'
    );
  });

  it('TEMPLATE_DEPRECATED when is_active is false even if lifecycle_state says approved', async () => {
    routeDb({
      presentationTemplate: presentationTemplateRow({
        is_active: false,
        lifecycle_state: 'approved',
      }),
    });

    await expectPresentationResolveError(
      {
        kind: 'internal',
        canonicalTemplateId: 'pt-steering',
        originRuntime: 'presentation_template',
      },
      'TEMPLATE_DEPRECATED'
    );
  });

  it('TEMPLATE_FORMAT_UNSUPPORTED for document and report runtimes (out of this slice)', async () => {
    routeDb({
      originLink: { origin_runtime: 'document_template', origin_record_id: 'dst-exec-memo-001' },
    });
    await expectPresentationResolveError(
      { kind: 'library', templateArtifactId: 'art-doc-card' },
      'TEMPLATE_FORMAT_UNSUPPORTED'
    );

    routeDb({
      originLink: { origin_runtime: 'report_template', origin_record_id: 'rbt-assessment-drd' },
    });
    await expectPresentationResolveError(
      { kind: 'library', templateArtifactId: 'art-report-card' },
      'TEMPLATE_FORMAT_UNSUPPORTED'
    );
  });

  it('TEMPLATE_FORBIDDEN when no organization context is supplied', async () => {
    await expectPresentationResolveError(
      {
        kind: 'internal',
        canonicalTemplateId: 'pt-steering',
        originRuntime: 'presentation_template',
      },
      'TEMPLATE_FORBIDDEN',
      ''
    );
  });
});
