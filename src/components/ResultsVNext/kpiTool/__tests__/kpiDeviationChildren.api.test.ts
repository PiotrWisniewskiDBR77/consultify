/** @vitest-environment jsdom
 *
 * Dyżur 173 — pins the client↔server contract for the two deviation-case
 * child reads that the KPI tool went months without calling.
 *
 * Why this test exists: the routes below were shipped server-side by the
 * RN-G6-SRV / B3 pass and the client was never wired to them, so the screen
 * displayed a warning banner about a gap that no longer existed. Nothing
 * failed — no test, no type, no lint caught it, because "a live route with
 * no caller" is invisible to all three. These assertions make the URL and
 * the response envelope load-bearing: rename the route or the `{ actions }`
 * / `{ verifications }` wrapper server-side and this test goes red instead
 * of the UI silently going empty again.
 *
 * Contract source (read, not guessed):
 *   server/src/routes/resultsVnext/kpiDeviation.routes.ts
 *     :542 GET /:caseId/corrective-actions          -> res.json({ actions })
 *     :797 GET /:caseId/effectiveness-verifications -> res.json({ verifications })
 *     :143 ListCorrectiveActionsQuerySchema         -> status?/limit?/offset?
 *     :149 ListEffectivenessVerificationsQuerySchema-> limit?/offset?
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({ Api: { get: vi.fn() } }));

import { Api } from '@/services/api';
import {
  listCorrectiveActionsForCase,
  listEffectivenessVerificationsForCase,
} from '../kpiDeviationApi';

const ACTION = {
  actionId: 'act-1',
  deviationCaseId: 'case-1',
  organizationId: 'org-1',
  title: 'Wymiana czujnika pozycji',
  description: null,
  ownerUserId: 'user-marek',
  dueDate: '2026-08-12',
  status: 'completed' as const,
  expectedEffect: null,
  actualEffect: null,
  rowVersion: 4,
  createdBy: 'user-marek',
  createdAt: '2026-08-09T10:00:00Z',
  updatedAt: '2026-08-13T07:30:00Z',
};

const VERIFICATION = {
  verificationId: 'ver-1',
  deviationCaseId: 'case-1',
  verificationWindowStart: '2026-08-13T00:00:00Z',
  verificationWindowEnd: '2026-08-20T23:59:59Z',
  status: 'effective' as const,
  rationale: 'Poniżej progu przez 7 kolejnych dni.',
  verifiedBy: 'user-anna',
  verifiedAt: '2026-08-21T09:00:00Z',
};

describe('KPI deviation case — child reads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hits the real corrective-actions route and unwraps { actions }', async () => {
    vi.mocked(Api.get).mockResolvedValueOnce({ actions: [ACTION] } as never);

    await expect(listCorrectiveActionsForCase('case-1')).resolves.toEqual([ACTION]);

    const url = vi.mocked(Api.get).mock.calls[0]![0] as string;
    expect(url.split('?')[0]).toBe('/vnext/results/kpi/deviation-cases/case-1/corrective-actions');
  });

  it('hits the real effectiveness-verifications route and unwraps { verifications }', async () => {
    vi.mocked(Api.get).mockResolvedValueOnce({ verifications: [VERIFICATION] } as never);

    await expect(listEffectivenessVerificationsForCase('case-1')).resolves.toEqual([VERIFICATION]);

    const url = vi.mocked(Api.get).mock.calls[0]![0] as string;
    expect(url.split('?')[0]).toBe(
      '/vnext/results/kpi/deviation-cases/case-1/effectiveness-verifications'
    );
  });

  it('sends only query params the server validators accept', async () => {
    vi.mocked(Api.get).mockResolvedValue({ actions: [], verifications: [] } as never);

    await listCorrectiveActionsForCase('case-1', { status: 'active', limit: 10, offset: 5 });
    const actionQuery = new URLSearchParams(
      (vi.mocked(Api.get).mock.calls[0]![0] as string).split('?')[1]
    );
    expect(Object.fromEntries(actionQuery)).toEqual({ status: 'active', limit: '10', offset: '5' });

    await listEffectivenessVerificationsForCase('case-1', { limit: 3 });
    const verificationQuery = new URLSearchParams(
      (vi.mocked(Api.get).mock.calls[1]![0] as string).split('?')[1]
    );
    // `status` is NOT part of ListEffectivenessVerificationsQuerySchema (:149)
    // — sending it would be rejected by validateQuery, so it must never appear.
    expect(Object.fromEntries(verificationQuery)).toEqual({ limit: '3', offset: '0' });
  });

  it('encodes the caseId rather than interpolating it raw', async () => {
    vi.mocked(Api.get).mockResolvedValueOnce({ actions: [] } as never);
    await listCorrectiveActionsForCase('case/1 2');
    expect(vi.mocked(Api.get).mock.calls[0]![0]).toContain('case%2F1%202/corrective-actions');
  });

  it('treats a missing envelope key as an empty list, never undefined', async () => {
    // The routes always send the key, but a proxy/error page that returns a
    // bodyless 200 must not crash the screen with `undefined.map`.
    vi.mocked(Api.get).mockResolvedValueOnce({} as never);
    await expect(listCorrectiveActionsForCase('case-1')).resolves.toEqual([]);
  });
});
