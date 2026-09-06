import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeInitiativeTransition = vi.fn();
vi.mock('../../services/initiative/initiativeTransitionService.js', () => ({
  executeInitiativeTransition: (...args: unknown[]) => executeInitiativeTransition(...args),
  getColumnNameSet: vi.fn(() => new Set()),
  getInitiativeNotificationRecipients: vi.fn(),
  normalizeStatus: (value: unknown) => String(value ?? '').toUpperCase(),
  pushOptionalColumnUpdate: vi.fn(),
}));

import { InitiativeController } from '../InitiativeController';

const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() }) as any;
const request = (body: Record<string, unknown> = {}) => ({
  user: { organizationId: 'org-p12', id: 'user-p12', role: 'ADMIN', email: 'p12@example.test' },
  params: { id: 'initiative-p12' }, body, ip: '127.0.0.1', get: vi.fn(() => 'vitest'),
}) as any;

describe('DEC-424 — kontrolery są adapterami silnika', () => {
  beforeEach(() => executeInitiativeTransition.mockReset());

  it.each([
    ['submitForReview', InitiativeController.submitForReview, {}, { nextStatusInput: 'PENDING_APPROVAL', expectedCurrentStatus: 'DRAFT' }],
    ['blockInitiative', InitiativeController.blockInitiative, { reason: 'Blokada' }, { nextStatusInput: 'IN_EXECUTION', flagOperation: 'HOLD' }],
    ['archiveInitiative', InitiativeController.archiveInitiative, {}, { nextStatusInput: 'CLOSED', flagOperation: 'ARCHIVE' }],
    // P12-int-b: dwa ostatnie adaptery na starych literałach. 'PROMOTED'
    // normalizowało się do PENDING_APPROVAL, więc silnik dostawał przejście
    // PENDING_APPROVAL -> PENDING_APPROVAL (nieistniejące w macierzy) i
    // /approve odmawiał ZAWSZE. 'EXECUTING' było tylko mylące (normalizuje się
    // do IN_EXECUTION), ale czytelnik widział martwy kod.
    ['approveInitiative', InitiativeController.approveInitiative, {}, { nextStatusInput: 'APPROVED' }],
    ['startExecution', InitiativeController.startExecution, {}, { nextStatusInput: 'IN_EXECUTION' }],
  ])('%s woła silnik i zwraca jego błąd', async (_name, handler, body, expected) => {
    executeInitiativeTransition.mockResolvedValue({
      ok: false, statusCode: 409, body: { code: 'P12_ENGINE_DENIED', error: 'Odmowa silnika' },
    });
    const res = response();
    await (handler as any)(request(body), res, vi.fn());
    expect(executeInitiativeTransition).toHaveBeenCalledWith(expect.objectContaining(expected));
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'P12_ENGINE_DENIED' }));
  });
});
