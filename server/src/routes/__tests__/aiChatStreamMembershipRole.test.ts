import { describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({ all: dbAll, get: dbGet, run: dbRun }));

describe('/chat/stream authoritative membership role', () => {
  it('uses a current MEMBER downgrade instead of a stale ADMIN JWT for Teresa grounding', async () => {
    dbGet.mockResolvedValue({ status: 'ACTIVE', role: 'MEMBER' });
    dbAll.mockResolvedValue([]);

    const [{ default: router }, { buildModuleContextGrounding }] = await Promise.all([
      import('../ai.routes.js'),
      import('../../services/ai/moduleContextGrounding.js'),
    ]);
    const layer = (router as unknown as {
      stack: Array<{
        route?: {
          path?: string;
          stack: Array<{
            handle: (
              request: Record<string, unknown>,
              response: Record<string, unknown>,
              next: (error?: unknown) => void
            ) => Promise<unknown>;
          }>;
        };
      }>;
    }).stack.find((entry) => entry.route?.path === '/chat/stream');
    const membershipHandler = layer?.route?.stack[1]?.handle;
    expect(membershipHandler).toBeTypeOf('function');

    const request = {
      userId: 'user-downgraded',
      organizationId: 'org-downgraded',
      userRole: 'ADMIN',
      user: {
        id: 'user-downgraded',
        organizationId: 'org-downgraded',
        role: 'ADMIN',
      },
    };
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await membershipHandler?.(request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(request.userRole).toBe('MEMBER');
    expect(dbGet).toHaveBeenCalledWith(
      expect.stringContaining('SELECT status, role FROM organization_members'),
      ['user-downgraded', 'org-downgraded'],
      { fallback: false }
    );

    const queryFn = vi.fn(async (sql: string) => {
      if (sql.includes('FROM feature_flags')) {
        return [
          { flag_key: 'MODULE_AUDITS', enabled: true },
          { flag_key: 'MODULE_BENEFITS', enabled: true },
          { flag_key: 'MODULE_ECONOMICS', enabled: true },
          { flag_key: 'MODULE_PRESENTATIONS', enabled: true },
          { flag_key: 'MODULE_MEETING', enabled: true },
        ];
      }
      return [];
    });
    const grounding = await buildModuleContextGrounding({
      organizationId: request.organizationId,
      userId: request.userId,
      userRole: request.userRole,
      language: 'en',
      screenContext: { currentScreen: '/admin' },
      runtimeFlags: { VITE_MODULE_MEETINGS: true, VITE_PMO_PROJECTS: false },
      queryFn,
    });

    expect(grounding?.systemInstructionAddon).not.toContain('Administration');
    expect(grounding?.systemInstructionAddon).not.toContain('/admin');
    expect(grounding?.citations.some((citation) => citation.reference.startsWith('admin/'))).toBe(false);
    expect(grounding?.systemInstructionAddon).not.toContain('Projects');
    expect(grounding?.systemInstructionAddon).not.toContain('/projects');
    expect(grounding?.citations.some((citation) => citation.reference.includes('projects'))).toBe(false);
    expect(queryFn.mock.calls.some(([sql]) => String(sql).includes('FROM organizations'))).toBe(false);
    expect(queryFn.mock.calls.some(([sql]) => String(sql).includes('FROM organization_members'))).toBe(false);
  });
});
