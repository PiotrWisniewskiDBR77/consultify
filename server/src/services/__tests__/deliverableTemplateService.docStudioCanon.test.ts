/**
 * Fala sprzątania 1b (2026-07-27) — dokończenie migracji szablonów Word.
 *
 * Kanon (docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md
 * §7): document_studio_templates = kanon dla szablonów 'doc',
 * report_builder_templates = legacy. Przed tą falą createDeliverableTemplate /
 * updateDeliverableTemplate / deleteDeliverableTemplate dla type==='doc'
 * pisały WYŁĄCZNIE do report_builder_templates (legacy). Ten plik weryfikuje
 * że NOWE/EDYTOWANE szablony 'doc' lądują teraz w document_studio_templates
 * (przez documentTemplateService's draft→revise→approve pipeline), a legacy
 * tabela nigdy nie jest dotykana dla tego typu.
 *
 * Mockowana jest tylko WARSTWA PERSYSTENCJI (`documentTemplateRegistryDao.js`
 * — DAO document_studio_templates, i `queryHelpers.js` — legacy SQL) tak by
 * testy działały bez żywej bazy (deterministyczne, per CLAUDE.md regułę o
 * "testy deterministyczne, fixtures, bez żywej bazy"); cała logika biznesowa
 * (draftTemplate/reviseTemplateStructure/approveTemplate/updateTemplateContent
 * /deprecateTemplate w documentTemplateService.ts) jest REALNA.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// The DAO stubs are invoked through the `vi.mock` factory below with the real
// DAO arguments; declare the rest signature so `mock.calls[n][0]` is typed as a
// captured argument rather than as an element of an empty tuple.
const persistTemplateMock = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
const persistAuditEntryMock = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
const loadTemplatesForOrgMock = vi.fn(async (..._args: unknown[]) => [] as never[]);
const loadAuditForTemplateMock = vi.fn(async (..._args: unknown[]) => [] as never[]);

vi.mock('../documentStudio/documentTemplateRegistryDao.js', () => ({
  SYSTEM_ORG_ID: '__system__',
  persistTemplate: (...args: unknown[]) => persistTemplateMock(...(args as [never])),
  persistAuditEntry: (...args: unknown[]) => persistAuditEntryMock(...(args as [never])),
  loadTemplatesForOrg: (...args: unknown[]) =>
    loadTemplatesForOrgMock(...(args as [string])) as never,
  loadAuditForTemplate: (...args: unknown[]) =>
    loadAuditForTemplateMock(...(args as [string, string])) as never,
  loadTemplateById: vi.fn(async () => null),
  __resetTemplateRegistryDaoForTests: async () => undefined,
}));

vi.mock('../documentStudio/documentTemplateSeeder.js', () => ({
  seedSystemDocumentTemplates: vi.fn(async () => ({ inserted: 0, skipped: 0 })),
}));

const queryOneMock = vi.fn();
const queryRunMock = vi.fn();
// `queryAll(sql, params?)` — mirror the real helper signature so the mock
// factory can forward positionally and `mockImplementation` can read `sql`.
const queryAllMock = vi.fn(async (_sql: string, _params?: unknown[]): Promise<unknown[]> => []);

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  queryRun: (...args: unknown[]) => queryRunMock(...args),
  queryAll: (sql: string, params?: unknown[]) => queryAllMock(sql, params),
}));

vi.mock('../v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn(async () => null),
}));

const {
  createDeliverableTemplate,
  updateDeliverableTemplate,
  deleteDeliverableTemplate,
  getDeliverableTemplate,
  listDeliverableTemplates,
} = await import('../deliverableTemplateService.js');
const { __resetTemplateRegistryForTests, getTemplate, isTemplateUsableForGeneration } =
  await import('../documentStudio/documentTemplateService.js');

const ORG_ID = 'org-canon-1';
const USER_ID = 'user-canon-1';

beforeEach(() => {
  __resetTemplateRegistryForTests();
  persistTemplateMock.mockClear();
  persistAuditEntryMock.mockClear();
  loadTemplatesForOrgMock.mockClear();
  queryOneMock.mockClear();
  queryRunMock.mockClear();
  queryAllMock.mockClear();
});

describe('createDeliverableTemplate("doc") — canon rewrite to document_studio_templates', () => {
  it('creates the template in document_studio_templates and never touches report_builder_templates', async () => {
    const template = await createDeliverableTemplate(
      'doc',
      'Raport testowy',
      'Opis testowy',
      {
        sections_json: [
          {
            title: 'Wstęp',
            block: 'heading',
            depth: 'short',
            hint: 'Kontekst projektu',
            ai_filled: true,
          },
          {
            title: 'Analiza',
            block: 'paragraph',
            depth: 'long',
            hint: 'Rozwinięcie',
            ai_filled: true,
          },
        ],
      },
      ORG_ID,
      USER_ID
    );

    expect(template.type).toBe('doc');
    expect(template.name).toBe('Raport testowy');
    expect(template.organizationId).toBe(ORG_ID);
    expect(template.isSystem).toBe(false);
    // Origin tag proves this came from the document_studio_templates federation
    // branch (mapDocStudioRow / mapDocStudioTemplateToDeliverable), not legacy.
    expect(template.meta.source).toBe('document_studio_templates');

    const sections = JSON.parse(String(template.meta.sections_json));
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('Wstęp');
    expect(sections[0].expectedLengthHint).toBe('short');
    expect(sections[1].expectedLengthHint).toBe('long');

    // Durable write landed on the document_studio_templates DAO, in 'approved'
    // status (Library-created templates are immediately visible/usable, no
    // separate review step — see the code comment in deliverableTemplateService.ts).
    expect(persistTemplateMock).toHaveBeenCalled();
    const persisted = persistTemplateMock.mock.calls.at(-1)?.[0] as any;
    expect(persisted.organizationId).toBe(ORG_ID);
    expect(persisted.status).toBe('approved');
    expect(persisted.name).toBe('Raport testowy');

    // The legacy report_builder_templates path (queryOne/queryRun) was never
    // touched for this creation.
    expect(queryOneMock).not.toHaveBeenCalled();
    expect(queryRunMock).not.toHaveBeenCalled();
  });

  it('is immediately gettable, editable, and soft-deletable through the shared CRUD surface', async () => {
    const created = await createDeliverableTemplate(
      'doc',
      'Szablon do edycji',
      'Opis',
      {
        sections_json: [
          { title: 'Sekcja 1', block: 'paragraph', depth: 'medium', hint: '', ai_filled: false },
        ],
      },
      ORG_ID,
      USER_ID
    );

    // GET — must resolve even though it lives in document_studio_templates,
    // not the legacy table getDeliverableTemplate historically only checked.
    const fetched = await getDeliverableTemplate(created.id, ORG_ID);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe('Szablon do edycji');

    // UPDATE — content edit on an already-'approved' template (allowed here;
    // this is the Template Library author-owned path, distinct from the
    // draft-only AI Architect `reviseTemplateStructure` guard).
    const updated = await updateDeliverableTemplate(
      created.id,
      {
        name: 'Szablon po edycji',
        meta: {
          sections_json: [
            {
              title: 'Sekcja zaktualizowana',
              block: 'bullets',
              depth: 'short',
              hint: 'x',
              ai_filled: true,
            },
          ],
        },
      },
      ORG_ID,
      USER_ID
    );
    expect(updated.name).toBe('Szablon po edycji');
    const updatedSections = JSON.parse(String(updated.meta.sections_json));
    expect(updatedSections[0].title).toBe('Sekcja zaktualizowana');

    // DELETE — soft-delete via deprecateTemplate; template then disappears
    // from the shared GET surface (deprecated == not-found from here).
    const deleted = await deleteDeliverableTemplate(created.id, ORG_ID, USER_ID);
    expect(deleted).toBe(true);

    const afterDelete = await getDeliverableTemplate(created.id, ORG_ID);
    expect(afterDelete).toBeNull();
  });

  it('route flow: create → list → resolve (Biblioteka + Mode 3), per T1 acceptance', async () => {
    const created = await createDeliverableTemplate(
      'doc',
      'Szablon widoczny w Bibliotece',
      'Opis',
      {
        sections_json: [
          { title: 'Sekcja', block: 'paragraph', depth: 'medium', hint: '', ai_filled: false },
        ],
      },
      ORG_ID,
      USER_ID
    );

    // LIST — GET /api/deliverables/templates?type=doc federates legacy
    // report_builder_templates (SQL, empty here) with document_studio_templates
    // (SQL, routed below to reflect what the durable persistTemplate call
    // above just wrote — proves the SQL-mapping side of the read path,
    // `mapDocStudioRow`, independently of the in-memory registry already
    // covered by the GET-by-id test above).
    queryAllMock.mockImplementation(async (sql: string) => {
      const s = String(sql);
      if (s.includes('FROM document_studio_templates')) {
        return [
          {
            template_id: created.id,
            name: created.name,
            purpose: 'Opis',
            notes: null,
            is_system: false,
            organization_id: ORG_ID,
            section_blueprint: created.meta.sections_json,
            document_type: 'generic_document',
          },
        ];
      }
      return []; // legacy report_builder_templates: nothing here
    });

    const listed = await listDeliverableTemplates('doc', ORG_ID, USER_ID);
    const match = listed.find((t) => t.id === created.id);
    expect(match).toBeDefined();
    expect(match?.name).toBe(created.name);
    expect(match?.meta.source).toBe('document_studio_templates');

    // RESOLVE — the Mode 3 entry point (documentStudioService.materializeDocumentArtifact)
    // resolves templates via documentTemplateService.getTemplate +
    // isTemplateUsableForGeneration; both must accept what the Library just created.
    const resolved = getTemplate(created.id, ORG_ID);
    expect(resolved).not.toBeNull();
    expect(isTemplateUsableForGeneration(resolved, ORG_ID)).toBe(true);
  });
});
