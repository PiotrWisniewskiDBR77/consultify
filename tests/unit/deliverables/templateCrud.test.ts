// @vitest-environment node
/**
 * Unit tests — T3: CRUD serwis szablonów użytkownika
 *
 * FT-1: ≥4 pokrycia logiki serwisu (walidacja, INSERT SQL, system-guard).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock queryHelpers ---
const queryAllMock = vi.fn();
const queryOneMock = vi.fn();
const queryRunMock = vi.fn();
const registerArtifactOriginMock = vi.fn();
const persistDocStudioTemplateMock = vi.fn();
const draftDocStudioTemplateMock = vi.fn();
const approveDocStudioTemplateMock = vi.fn();

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: any[]) => queryAllMock(...args),
  queryOne: (...args: any[]) => queryOneMock(...args),
  queryRun: (...args: any[]) => queryRunMock(...args),
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...args: any[]) => registerArtifactOriginMock(...args),
  removeTemplateArtifactByOrigin: vi.fn(),
}));

vi.mock('../../../server/src/services/documentStudio/documentTemplateRegistryDao.js', () => ({
  persistTemplate: (...args: any[]) => persistDocStudioTemplateMock(...args),
}));

vi.mock('../../../server/src/services/documentStudio/documentTemplateService.js', () => ({
  draftTemplate: (...args: any[]) => draftDocStudioTemplateMock(...args),
  reviseTemplateStructure: vi.fn(),
  approveTemplate: (...args: any[]) => approveDocStudioTemplateMock(...args),
  deprecateTemplate: vi.fn(),
  ensureTemplateRegistryHydrated: vi.fn(),
  getTemplate: vi.fn(),
  updateTemplateContent: vi.fn(),
}));

describe('deliverableTemplateService — CRUD (T3)', () => {
  let createDeliverableTemplate: any;
  let updateDeliverableTemplate: any;
  let deleteDeliverableTemplate: any;
  let getDeliverableTemplate: any;
  let TemplateForbiddenError: any;
  let TemplateNotFoundError: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    registerArtifactOriginMock.mockResolvedValue({ id: 'artifact-1' });
    persistDocStudioTemplateMock.mockResolvedValue({ ok: true });
    draftDocStudioTemplateMock.mockReturnValue({
      template: {
        templateId: 'new-doc-id',
        organizationId: 'org-A',
        name: 'My Doc',
        purpose: 'Szablon: My Doc',
        notes: undefined,
        documentType: 'custom',
        sectionBlueprint: [],
        status: 'draft',
      },
    });
    approveDocStudioTemplateMock.mockReturnValue({
      templateId: 'new-doc-id',
      organizationId: 'org-A',
      name: 'My Doc',
      purpose: 'Szablon: My Doc',
      notes: undefined,
      documentType: 'custom',
      sectionBlueprint: [],
      status: 'approved',
    });
    vi.resetModules();
    const mod = await import('../../../server/src/services/deliverableTemplateService.js');
    createDeliverableTemplate = mod.createDeliverableTemplate;
    updateDeliverableTemplate = mod.updateDeliverableTemplate;
    deleteDeliverableTemplate = mod.deleteDeliverableTemplate;
    getDeliverableTemplate = mod.getDeliverableTemplate;
    TemplateForbiddenError = mod.TemplateForbiddenError;
    TemplateNotFoundError = mod.TemplateNotFoundError;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // FT-1.U1 — doc uses the canonical Document Studio lifecycle, not legacy SQL.
  it('createDeliverableTemplate(doc) uses canonical Document Studio lifecycle', async () => {
    const result = await createDeliverableTemplate(
      'doc',
      'My Doc',
      undefined,
      undefined,
      'org-A',
      'user-1'
    );

    expect(draftDocStudioTemplateMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-A', userId: 'user-1' })
    );
    expect(approveDocStudioTemplateMock).toHaveBeenCalledOnce();
    expect(persistDocStudioTemplateMock).toHaveBeenCalledOnce();
    expect(queryOneMock).not.toHaveBeenCalled();
    expect(result.id).toBe('new-doc-id');
    expect(result.type).toBe('doc');
    expect(result.isSystem).toBe(false);
  });

  // FT-1.U2 — createDeliverableTemplate(type='deck') trafia w presentation_templates
  it('createDeliverableTemplate(deck) targets presentation_templates', async () => {
    queryOneMock
      .mockResolvedValueOnce({ id: 'new-deck-id' }) // INSERT RETURNING
      .mockResolvedValueOnce({
        // deck lookup (getDeliverableTemplate)
        id: 'new-deck-id',
        name: 'My Deck',
        description: null,
        is_system: false,
        theme: null,
        organization_id: 'org-A',
        outline_json: '[]',
      });

    const result = await createDeliverableTemplate(
      'deck',
      'My Deck',
      undefined,
      undefined,
      'org-A',
      'user-1'
    );

    const insertSql: string = queryOneMock.mock.calls[0][0];
    expect(insertSql).toContain('INSERT INTO presentation_templates');
    expect(insertSql).toContain('false'); // is_system=false
    expect(result.type).toBe('deck');
  });

  // FT-1.U3 — deleteDeliverableTemplate z system template → rzuca TemplateForbiddenError
  it('deleteDeliverableTemplate throws TemplateForbiddenError for system templates', async () => {
    // getDeliverableTemplate: deck is_system=true
    queryOneMock.mockResolvedValueOnce({
      id: 'sys-deck',
      name: 'Corporate Deck',
      description: null,
      is_system: true,
      theme: null,
      organization_id: null,
      outline_json: '[]',
    });

    await expect(deleteDeliverableTemplate('sys-deck', 'org-A')).rejects.toThrow(
      TemplateForbiddenError
    );
  });

  // FT-1.U4 — updateDeliverableTemplate z system template → rzuca TemplateForbiddenError
  it('updateDeliverableTemplate throws TemplateForbiddenError for system templates', async () => {
    // getDeliverableTemplate: doc is_system=true
    queryOneMock
      .mockResolvedValueOnce(null) // deck lookup
      .mockResolvedValueOnce({
        // doc lookup
        id: 'sys-doc',
        name: 'System Doc',
        description: null,
        is_system: true,
        is_public: true,
        report_type: 'audit_report',
        sections_json: '[]',
        organization_id: null,
      });

    await expect(
      updateDeliverableTemplate('sys-doc', { name: 'Hacked Name' }, 'org-A')
    ).rejects.toThrow(TemplateForbiddenError);
  });

  // FT-1.U5 — getDeliverableTemplate zwraca null gdy template nie istnieje
  it('getDeliverableTemplate returns null when template not found in any table', async () => {
    queryOneMock.mockResolvedValue(null); // wszystkie 3 tabele zwracają null

    const result = await getDeliverableTemplate('nonexistent-id', 'org-A');
    expect(result).toBeNull();
    expect(queryOneMock).toHaveBeenCalledTimes(3); // deck, doc, table
  });

  // FT-1.U6 — createDeliverableTemplate(type='table') trafia w tp_base_templates z org_scope
  it('createDeliverableTemplate(table) inserts with organization_id', async () => {
    queryOneMock
      .mockResolvedValueOnce({ id: 'uuid-table-1' }) // INSERT RETURNING
      .mockResolvedValueOnce(null) // deck lookup
      .mockResolvedValueOnce(null) // doc lookup
      .mockResolvedValueOnce({
        // table lookup
        id: 'uuid-table-1',
        name: 'My Table',
        description: null,
        is_featured: false,
        category: 'custom',
        schema_snapshot: {},
        created_by: 'user-1',
        organization_id: 'org-A',
      });

    const result = await createDeliverableTemplate(
      'table',
      'My Table',
      undefined,
      undefined,
      'org-A',
      'user-1'
    );

    const insertSql: string = queryOneMock.mock.calls[0][0];
    expect(insertSql).toContain('INSERT INTO tp_base_templates');
    // org_id przekazany jako parametr
    expect(queryOneMock.mock.calls[0][1]).toContain('org-A');
    expect(result.type).toBe('table');
    expect(result.isSystem).toBe(false); // created_by nie jest null → nie-system
  });

  // FT-1.U7 — cross-org update → TemplateForbiddenError
  it('updateDeliverableTemplate throws TemplateForbiddenError for cross-org update', async () => {
    // getDeliverableTemplate zwraca template innej org
    queryOneMock.mockResolvedValueOnce({
      id: 'other-org-deck',
      name: 'Other Org Deck',
      description: null,
      is_system: false,
      theme: null,
      organization_id: 'org-DIFFERENT',
      outline_json: '[]',
    });

    await expect(
      updateDeliverableTemplate('other-org-deck', { name: 'Hacked' }, 'org-A')
    ).rejects.toThrow(TemplateForbiddenError);
  });
});
