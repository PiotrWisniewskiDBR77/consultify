/**
 * P4 BEZPIECZENSTWO (2026-09-10): izolacja organizacji na podtrasach projektu.
 *
 * ZMIERZONY DEFEKT (zywy serwer, baza staging): konto organizacji B odczytalo
 * `GET /api/projects/<projekt-organizacji-A>/notification-settings` i dostalo
 * wiersz z bazy organizacji A (kontrolny escalation_days=4242). Handler robil
 * `SELECT * FROM project_notification_settings WHERE project_id = ?` bez
 * filtra po organizacji, a router miał straznika tylko na PUT, nie na GET.
 * Rodzenstwo o tym samym ksztalcie: /:id/ai-role, /:id/regulatory-mode.
 *
 * Test pilnuje obu kierunkow: cudzy projekt = 404, wlasny = obsluzony dalej.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
  dbAll: (...a: unknown[]) => mockQueryAll(...a),
  dbGet: (...a: unknown[]) => mockQueryOne(...a),
  dbRun: (...a: unknown[]) => mockQueryRun(...a),
}));

vi.mock('../../../../server/src/utils/asyncHandler.js', () => ({
  asyncHandler: (fn: Function) => fn,
}));

import { ProjectController } from '../../../../server/src/controllers/ProjectController';

function mocks(projectId: string) {
  const req: any = {
    user: { id: 'user-1', organizationId: 'org-A' },
    params: { id: projectId },
    query: {},
    body: {},
    headers: {},
  };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return { req, res };
}

describe('podtrasy projektu respektuja granice organizacji', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([['getNotificationSettings'], ['getAIRole'], ['getRegulatoryMode']])(
    '%s zwraca 404 dla projektu spoza organizacji wolajacego',
    async (handler) => {
      // Straznik nie znajduje projektu w organizacji wolajacego.
      mockQueryOne.mockResolvedValue(undefined);

      const { req, res } = mocks('projekt-organizacji-B');
      await (ProjectController as any)[handler](req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    }
  );

  it('getNotificationSettings przepuszcza wlasny projekt organizacji', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: 'projekt-wlasny' }) // straznik: projekt nalezy do org-A
      .mockResolvedValueOnce(undefined); // brak zapisanych ustawien -> domyslne

    const { req, res } = mocks('projekt-wlasny');
    await (ProjectController as any).getNotificationSettings(req, res, vi.fn());

    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalled();
  });

  it('straznik pyta baze o projekt ORAZ organizacje, nie o sam projekt', async () => {
    mockQueryOne.mockResolvedValue(undefined);
    const { req, res } = mocks('projekt-organizacji-B');
    await (ProjectController as any).getNotificationSettings(req, res, vi.fn());

    const [sql, params] = mockQueryOne.mock.calls[0];
    expect(String(sql)).toMatch(/organization_id/);
    expect(params).toEqual(['projekt-organizacji-B', 'org-A']);
  });
});
