import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { closedBetaModuleGate } from '../../../../server/src/middleware/betaGate.middleware';

function invoke(role: string) {
  const req = { user: { role } } as any;
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  closedBetaModuleGate(req, response, next);
  return { response, next };
}

describe('Meeting closed-beta API boundary', () => {
  it.each(['OWNER', 'ADMIN', 'administrator', 'SUPERADMIN'])(
    'keeps the client admin exemption for the post-auth role %s',
    (role) => {
      const { response, next } = invoke(role);
      expect(next).toHaveBeenCalledOnce();
      expect(response.status).not.toHaveBeenCalled();
    }
  );

  it.each(['MEMBER', 'USER', ''])('denies a direct API caller with role %s', (role) => {
    const { response, next } = invoke(role);
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BETA_LOCKED' }));
  });

  it('mounts authentication and the closed gate exactly once inside the Meeting router', () => {
    const gateway = fs.readFileSync(path.resolve(process.cwd(), 'server/src/Gateway.ts'), 'utf8');
    const router = fs.readFileSync(
      path.resolve(process.cwd(), 'server/src/routes/meeting.routes.ts'),
      'utf8'
    );
    expect(gateway).toContain("app.use('/api/meeting', meetingRoutes)");
    expect(router).toContain(
      'router.use(verifyToken);\nrouter.use(isAuthenticated);\nrouter.use(closedBetaModuleGate);'
    );
  });
});
