/**
 * R1 Smoke: V4-DECK-01..07 — Presentation Enterprise Service
 * Verifies: bindings, layout rules, export QA, template governance, PPTX import, collab, media
 */

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue({ changes: 1 }),
}));
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import presentationEnterpriseService from '../../../../server/src/services/presentationEnterpriseService.js';

describe('V4-DECK: Presentation Enterprise Service', () => {
  it('exports createBinding', () => {
    expect(typeof presentationEnterpriseService.createBinding).toBe('function');
  });
  it('exports getBindings', () => {
    expect(typeof presentationEnterpriseService.getBindings).toBe('function');
  });
  it('exports createLayoutRule', () => {
    expect(typeof presentationEnterpriseService.createLayoutRule).toBe('function');
  });
  it('exports createExportQA', () => {
    expect(typeof presentationEnterpriseService.createExportQA).toBe('function');
  });
  it('exports createTemplateGovernance', () => {
    expect(typeof presentationEnterpriseService.createTemplateGovernance).toBe('function');
  });
  it('exports createPPTXImport', () => {
    expect(typeof presentationEnterpriseService.createPPTXImport).toBe('function');
  });
  it('exports joinCollabSession', () => {
    expect(typeof presentationEnterpriseService.joinCollabSession).toBe('function');
  });
  it('exports addMedia', () => {
    expect(typeof presentationEnterpriseService.addMedia).toBe('function');
  });

  it('getBindings() returns an array', async () => {
    const result = await presentationEnterpriseService.getBindings('org-1', 'deck-1');
    expect(Array.isArray(result)).toBe(true);
  });
});
