/**
 * S1.14b / B1 — Idea·Notes → Initiative was dead for EVERY organization.
 *
 * Measured on staging 13.09: `POST /api/initiatives` answered 400
 * INITIATIVE_PROJECT_REQUIRED for the conversion path because the front never
 * sends `projectId` (`src/services/conversionService.ts`) and the conversion
 * popover has no project picker to show. Zwornik Delta C (§5.2.1/§5.2.3) splits
 * the anchoring policy in two: interactive creation hard-blocks so the human
 * names a project, derived/background creation auto-anchors to the org's system
 * "Portfel" project. The controller was applying the hard half to both.
 *
 * These tests pin BOTH halves so the interactive requirement cannot be dropped
 * by accident while fixing the derived one.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const funnelCreateInitiative = vi.fn();
vi.mock('../../services/initiative/createInitiativeService.js', () => ({
  createInitiative: (...args: unknown[]) => funnelCreateInitiative(...args),
  duplicateInitiative: vi.fn(),
}));

import { InitiativeController } from '../InitiativeController';

const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() }) as any;
const request = (body: Record<string, unknown>) =>
  ({
    user: { organizationId: 'org-s114b', id: 'user-s114b', role: 'ADMIN' },
    params: {},
    body,
    ip: '127.0.0.1',
    get: vi.fn(() => 'vitest'),
    headers: {},
  }) as any;

describe('S1.14b/B1 — anchoring policy splits interactive vs derived creation', () => {
  beforeEach(() => {
    funnelCreateInitiative.mockReset();
    funnelCreateInitiative.mockResolvedValue({ id: 'ini-1', name: 'Converted idea' });
    delete process.env.REQUIRE_INITIATIVE_PROJECT;
    delete process.env.INITIATIVE_FUNNEL_ENABLED;
  });

  it('derived creation (Idea→Initiative, sourceType=tool_session) without projectId reaches the funnel', async () => {
    const res = response();
    await (InitiativeController.createInitiative as any)(
      request({
        title: 'Order-to-Cash Diagnostic',
        name: 'Order-to-Cash Diagnostic',
        description: 'Converted from MyWork session',
        sourceType: 'tool_session',
        sourceId: 'session-abc',
      }),
      res,
      vi.fn()
    );

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(funnelCreateInitiative).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'ini-1' }));
  });

  it('interactive creation (no source) without projectId still hard-blocks with 400', async () => {
    const res = response();
    await (InitiativeController.createInitiative as any)(
      request({ title: 'Manual wizard initiative' }),
      res,
      vi.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INITIATIVE_PROJECT_REQUIRED' })
    );
    expect(funnelCreateInitiative).not.toHaveBeenCalled();
  });

  it('sourceType=manual is interactive, not derived — still hard-blocks', async () => {
    const res = response();
    await (InitiativeController.createInitiative as any)(
      request({ title: 'Manual initiative', sourceType: 'manual' }),
      res,
      vi.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(funnelCreateInitiative).not.toHaveBeenCalled();
  });
});
