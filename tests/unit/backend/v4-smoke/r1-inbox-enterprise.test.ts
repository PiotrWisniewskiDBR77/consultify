/**
 * R1 Smoke: V4-INBX-01..07 — Inbox Enterprise + Focus Board
 * Verifies: connectors, routing rules, triage, focus boards, inbox table
 */

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue({ changes: 1 }),
}));
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { inboxEnterpriseService } from '../../../../server/src/services/inboxEnterpriseService.js';

describe('V4-INBX: Inbox Enterprise Service', () => {
  it('exports ingestConnectorItem', () => {
    expect(typeof inboxEnterpriseService.ingestConnectorItem).toBe('function');
  });
  it('exports routeConnectorItem', () => {
    expect(typeof inboxEnterpriseService.routeConnectorItem).toBe('function');
  });
  it('exports createRoutingRule', () => {
    expect(typeof inboxEnterpriseService.createRoutingRule).toBe('function');
  });
  it('exports listRoutingRules', () => {
    expect(typeof inboxEnterpriseService.listRoutingRules).toBe('function');
  });
  it('exports createFocusBoard', () => {
    expect(typeof inboxEnterpriseService.createFocusBoard).toBe('function');
  });
  it('exports getFocusBoards', () => {
    expect(typeof inboxEnterpriseService.getFocusBoards).toBe('function');
  });
  it('exports triageInboxItem', () => {
    expect(typeof inboxEnterpriseService.triageInboxItem).toBe('function');
  });
  it('exports getInboxTable', () => {
    expect(typeof inboxEnterpriseService.getInboxTable).toBe('function');
  });
  it('exports getInboxItemPreview', () => {
    expect(typeof inboxEnterpriseService.getInboxItemPreview).toBe('function');
  });

  it('listRoutingRules() returns an array', async () => {
    const result = await inboxEnterpriseService.listRoutingRules('org-1');
    expect(Array.isArray(result)).toBe(true);
  });
  it('getFocusBoards() returns an array', async () => {
    const result = await inboxEnterpriseService.getFocusBoards('user-1', 'org-1');
    expect(Array.isArray(result)).toBe(true);
  });
});
