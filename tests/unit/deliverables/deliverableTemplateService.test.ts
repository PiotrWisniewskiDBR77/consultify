// @vitest-environment node
/**
 * Unit tests — deliverableTemplateService
 *
 * Mockuje queryAll, weryfikuje SQL routing, mapowanie isBlank i fail-open.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock queryHelpers ---
const queryAllMock = vi.fn();

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: any[]) => queryAllMock(...args),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
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
