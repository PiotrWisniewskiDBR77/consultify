import { describe, expect, it, vi } from 'vitest';

import { createModuleGate } from '../../../server/src/middleware/betaGate.middleware.js';

function exercise(status: 'open' | 'closed', role: string) {
  const next = vi.fn();
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  createModuleGate('MODULE_ECONOMICS', () => status)(
    { user: { role } } as never,
    response as never,
    next
  );
  return { next, response };
}

describe('day43 A.2 — reversible Finance beta gate', () => {
  it.each(['MEMBER', 'ADMIN'])('open permits %s', (role) => {
    const { next, response } = exercise('open', role);
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('closed denies a regular member', () => {
    const { next, response } = exercise('closed', 'MEMBER');
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BETA_LOCKED' }));
  });

  it('closed preserves the administrator exemption', () => {
    const { next, response } = exercise('closed', 'ADMIN');
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });
});
