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

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: any[]) => queryAllMock(...args),
  queryOne: (...args: any[]) => queryOneMock(...args),
  queryRun: (...args: any[]) => queryRunMock(...args),
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

  // FT-1.U1 — createDeliverableTemplate(type='doc') wywołuje INSERT z is_system=false
  it('createDeliverableTemplate(doc) inserts with is_system=false', async () => {
    // Pierwsza queryOne = RETURNING id po INSERT
    queryOneMock
      .mockResolvedValueOnce({ id: 'new-doc-id' }) // INSERT RETURNING
      .mockResolvedValueOnce(null)                  // deck lookup (getDeliverableTemplate)
      .mockResolvedValueOnce({                      // doc lookup
        id: 'new-doc-id',
        name: 'My Doc',
        description: null,
        is_system: false,
        is_public: false,
        report_type: 'custom',
        sections_json: '[]',
        organization_id: 'org-A',
      })
      .mockResolvedValueOnce(null);                 // table lookup (nie trafia)

    const result = await createDeliverableTemplate('doc', 'My Doc', undefined, undefined, 'org-A', 'user-1');

    // Sprawdź INSERT SQL
    expect(queryOneMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO report_builder_templates'),
      expect.arrayContaining(['My Doc', 'org-A', 'user-1'])
    );
    // Sprawdź że is_system=false wbudowane w SQL
    const insertSql: string = queryOneMock.mock.calls[0][0];
    expect(insertSql).toContain('false');
    expect(result.id).toBe('new-doc-id');
    expect(result.type).toBe('doc');
    expect(result.isSystem).toBe(false);
  });

  // FT-1.U2 — createDeliverableTemplate(type='deck') trafia w presentation_templates
  it('createDeliverableTemplate(deck) targets presentation_templates', async () => {
    queryOneMock
      .mockResolvedValueOnce({ id: 'new-deck-id' }) // INSERT RETURNING
      .mockResolvedValueOnce({                       // deck lookup (getDeliverableTemplate)
        id: 'new-deck-id',
        name: 'My Deck',
        description: null,
        is_system: false,
        theme: null,
        organization_id: 'org-A',
        outline_json: '[]',
      });

    const result = await createDeliverableTemplate('deck', 'My Deck', undefined, undefined, 'org-A', 'user-1');

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

    await expect(
      deleteDeliverableTemplate('sys-deck', 'org-A')
    ).rejects.toThrow(TemplateForbiddenError);
  });

  // FT-1.U4 — updateDeliverableTemplate z system template → rzuca TemplateForbiddenError
  it('updateDeliverableTemplate throws TemplateForbiddenError for system templates', async () => {
    // getDeliverableTemplate: doc is_system=true
    queryOneMock
      .mockResolvedValueOnce(null)     // deck lookup
      .mockResolvedValueOnce({         // doc lookup
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
      .mockResolvedValueOnce({ id: 'uuid-table-1' })  // INSERT RETURNING
      .mockResolvedValueOnce(null)                      // deck lookup
      .mockResolvedValueOnce(null)                      // doc lookup
      .mockResolvedValueOnce({                          // table lookup
        id: 'uuid-table-1',
        name: 'My Table',
        description: null,
        is_featured: false,
        category: 'custom',
        schema_snapshot: {},
        created_by: 'user-1',
        organization_id: 'org-A',
      });

    const result = await createDeliverableTemplate('table', 'My Table', undefined, undefined, 'org-A', 'user-1');

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
