/**
 * Łańcuch zarządzania inicjatywą (DEC-424 / DEC-453) — kontrakt podglądu przejść.
 *
 * Trzy warunki właściciela, każdy przybity osobnym testem:
 *   1. ROLA decyduje o widoczności: `roleAllowed=false` ⇒ UI nie rysuje przycisku.
 *      Ten sam wynik daje pisarz (403) — obie ścieżki liczą tę samą `canExecuteGate`.
 *   2. WARUNEK widać przed kliknięciem: `conditionSatisfied=false` + `blockingRule`.
 *   3. Gotowość bramki (`getBlockingReadinessItems` → `GATE_BLOCKED`) też jest w
 *      podglądzie — bez tego przycisk byłby aktywny, a pisarz odmawiałby po fakcie.
 *
 * MUTACJE (każda ma zaświecić ten plik na czerwono):
 *   • usuń `.filter(roleAllowed)` z podglądu albo `canExecuteGate` z pisarza → test 1,
 *   • usuń `evaluateInitiativeTransitionCondition` z podglądu → test 2,
 *   • usuń `getBlockingReadinessItems` z podglądu → test 3.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, withPgTransactionMock, queryOneMock, queryAllMock, readinessMock, goDecisionMock, capabilityContextMock } =
  vi.hoisted(() => ({
    queryMock: vi.fn(),
    withPgTransactionMock: vi.fn(),
    queryOneMock: vi.fn(),
    queryAllMock: vi.fn(),
    readinessMock: vi.fn(),
    goDecisionMock: vi.fn(),
    capabilityContextMock: vi.fn(),
  }));

vi.mock('../../../utils/queryHelpers.js', () => ({
  getTableColumns: vi.fn().mockResolvedValue([]),
  queryAll: queryAllMock,
  queryOne: queryOneMock,
  queryRun: vi.fn(),
  withPgTransaction: withPgTransactionMock,
}));

vi.mock('../initiativeCapabilityMatrix.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../initiativeCapabilityMatrix.js')>();
  return { ...actual, resolveInitiativeCapabilityContext: capabilityContextMock };
});

vi.mock('../initiativeLifecycleGateDecisionService.js', () => ({
  assertCurrentApprovedInitiativeLifecycleGateDecision: goDecisionMock,
}));
vi.mock('../initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: readinessMock,
}));
vi.mock('../initiativeGateAiConfig.js', () => ({
  isInitiativeGateAiEnabled: vi.fn().mockResolvedValue(false),
}));

import { getInitiativeTransitionPreflight } from '../initiativeTransitionPreflightService.js';
import { executeInitiativeTransition } from '../initiativeTransitionService.js';

const ORG = 'org-1';
const INI = 'ini-1';
const AUTHOR = 'user-author';
const STRANGER = 'user-stranger';

const draftRow = (over: Record<string, unknown> = {}) => ({
  id: INI,
  organization_id: ORG,
  status: 'DRAFT',
  name: 'Próba',
  title: 'Próba',
  description: 'Opis',
  created_by: AUTHOR,
  owner_business_id: null,
  owner_execution_id: null,
  scope_in: null,
  scope_out: null,
  on_hold: false,
  archived: false,
  ...over,
});

const context = (roles: string[]) => ({
  effectiveRoles: roles,
  steeringBoardEnabled: false,
  access: {},
  raciRoles: [],
  projectId: null,
});

beforeEach(() => {
  queryOneMock.mockReset();
  queryAllMock.mockReset().mockResolvedValue([]);
  readinessMock.mockReset().mockResolvedValue([]);
  goDecisionMock.mockReset().mockRejectedValue(new Error('no decision'));
  capabilityContextMock.mockReset();
  queryMock.mockReset();
  withPgTransactionMock.mockReset().mockImplementation(async (fn) => fn({ query: queryMock }));
});

describe('podgląd przejść — rola decyduje o widoczności (warunek 1)', () => {
  it('nie-autor bez roli CONSULTANT: roleAllowed=false dla „Prześlij do zatwierdzenia"', async () => {
    queryOneMock.mockResolvedValue(draftRow());
    capabilityContextMock.mockResolvedValue(context(['TEAM_MEMBER']));
    const preflight = await getInitiativeTransitionPreflight({
      orgId: ORG,
      initiativeId: INI,
      actorId: STRANGER,
    });
    expect(preflight).not.toBeNull();
    const submit = preflight!.transitions.find((t) => t.gate === 'SUBMIT_FOR_REVIEW');
    expect(submit).toBeDefined();
    expect(submit!.roleAllowed).toBe(false);
    expect(submit!.allowed).toBe(false);
    expect(preflight!.isAuthor).toBe(false);
  });

  it('autor z rolą CONSULTANT: roleAllowed=true (ten sam kod, który przepuszcza pisarz)', async () => {
    queryOneMock.mockResolvedValue(draftRow());
    capabilityContextMock.mockResolvedValue(context(['CONSULTANT']));
    const preflight = await getInitiativeTransitionPreflight({
      orgId: ORG,
      initiativeId: INI,
      actorId: AUTHOR,
    });
    const submit = preflight!.transitions.find((t) => t.gate === 'SUBMIT_FOR_REVIEW');
    expect(submit!.roleAllowed).toBe(true);
    expect(preflight!.isAuthor).toBe(true);
  });

  it('pisarz odmawia 403 tej samej osobie, której podgląd nie pokazał przycisku', async () => {
    // Karta kompletna, żeby jedynym powodem odmowy była ROLA.
    const row = draftRow({ owner_business_id: 'owner-1', scope_in: ['x'] });
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM initiatives')) return { rows: [row], rowCount: 1 };
      throw new Error(`nieoczekiwany zapis mimo braku roli: ${sql}`);
    });
    capabilityContextMock.mockResolvedValue(context(['TEAM_MEMBER']));
    const result = await executeInitiativeTransition({
      orgId: ORG,
      initiativeId: INI,
      actorId: AUTHOR,
      actorRole: 'MEMBER',
      nextStatusInput: 'PENDING_APPROVAL',
    });
    expect(result.ok).toBe(false);
    expect((result as { statusCode: number }).statusCode).toBe(403);
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes('UPDATE initiatives'))).toBe(false);
  });
});

describe('podgląd przejść — warunek widać przed kliknięciem (warunek 2)', () => {
  it('szkic bez właściciela i zakresu: przycisk nieaktywny z INITIATIVE_CARD_INCOMPLETE', async () => {
    queryOneMock.mockResolvedValue(draftRow());
    capabilityContextMock.mockResolvedValue(context(['CONSULTANT']));
    const preflight = await getInitiativeTransitionPreflight({
      orgId: ORG,
      initiativeId: INI,
      actorId: AUTHOR,
    });
    const submit = preflight!.transitions.find((t) => t.gate === 'SUBMIT_FOR_REVIEW')!;
    expect(submit.roleAllowed).toBe(true);
    expect(submit.conditionSatisfied).toBe(false);
    expect(submit.blockingRule).toBe('INITIATIVE_CARD_INCOMPLETE');
    expect(submit.allowed).toBe(false);
  });

  it('do zatwierdzenia bez aktualnej decyzji GO: „Zatwierdź" nieaktywne z GATE_DECISION_REQUIRED, zwrot/odrzucenie wymagają powodu', async () => {
    queryOneMock.mockResolvedValue(draftRow({ status: 'PENDING_APPROVAL', owner_business_id: 'o', scope_in: ['x'] }));
    capabilityContextMock.mockResolvedValue(context(['PROJECT_SPONSOR']));
    const preflight = await getInitiativeTransitionPreflight({
      orgId: ORG,
      initiativeId: INI,
      actorId: STRANGER,
    });
    const byGate = Object.fromEntries(preflight!.transitions.map((t) => [t.gate, t]));
    expect(byGate.APPROVE.roleAllowed).toBe(true);
    expect(byGate.APPROVE.conditionSatisfied).toBe(false);
    expect(byGate.APPROVE.blockingRule).toBe('GATE_DECISION_REQUIRED');
    expect(byGate.SEND_BACK.requiresReason).toBe(true);
    expect(byGate.SEND_BACK.conditionSatisfied).toBe(true);
    expect(byGate.REJECT.requiresReason).toBe(true);
  });

  it('w realizacji: flaga HOLD dostępna tylko gdy nie wstrzymana, RESUME tylko gdy wstrzymana', async () => {
    capabilityContextMock.mockResolvedValue(context(['PMO', 'PROJECT_SPONSOR']));
    queryOneMock.mockResolvedValue(draftRow({ status: 'IN_EXECUTION', on_hold: false }));
    const active = await getInitiativeTransitionPreflight({ orgId: ORG, initiativeId: INI, actorId: STRANGER });
    const activeFlags = Object.fromEntries(active!.flags.map((f) => [f.operation, f]));
    expect(activeFlags.HOLD.stateAllowed).toBe(true);
    expect(activeFlags.HOLD.requiresReason).toBe(true);
    expect(activeFlags.RESUME.stateAllowed).toBe(false);

    queryOneMock.mockResolvedValue(draftRow({ status: 'IN_EXECUTION', on_hold: true }));
    const held = await getInitiativeTransitionPreflight({ orgId: ORG, initiativeId: INI, actorId: STRANGER });
    const heldFlags = Object.fromEntries(held!.flags.map((f) => [f.operation, f]));
    expect(heldFlags.HOLD.stateAllowed).toBe(false);
    expect(heldFlags.RESUME.stateAllowed).toBe(true);
    expect(held!.onHold).toBe(true);
  });
});

describe('podgląd przejść — gotowość bramki liczona jak u pisarza (warunek 3)', () => {
  it('brak właściciela w gotowości: GATE_BLOCKED z listą braków, chociaż warunek macierzy przeszedł', async () => {
    queryOneMock.mockResolvedValue(draftRow({ status: 'PENDING_APPROVAL', owner_business_id: 'o', scope_in: ['x'] }));
    capabilityContextMock.mockResolvedValue(context(['PROJECT_SPONSOR']));
    goDecisionMock.mockResolvedValue({ decisionId: 'go-1' });
    readinessMock.mockResolvedValue([
      { key: 'owner', label: 'Owner assigned', section: 'ownership', field: 'ownerBusinessId', requirement: '', suggestedAction: '' },
    ]);
    const preflight = await getInitiativeTransitionPreflight({ orgId: ORG, initiativeId: INI, actorId: STRANGER });
    const approve = preflight!.transitions.find((t) => t.gate === 'APPROVE')!;
    expect(approve.blockingRule).toBe('GATE_BLOCKED');
    expect(approve.blockingItems).toEqual([{ key: 'owner', label: 'Owner assigned' }]);
    expect(approve.allowed).toBe(false);
    expect(readinessMock).toHaveBeenCalledWith(ORG, INI);
  });

  it('gotowość spełniona + decyzja GO: „Zatwierdź" wolno kliknąć', async () => {
    queryOneMock.mockResolvedValue(draftRow({ status: 'PENDING_APPROVAL', owner_business_id: 'o', scope_in: ['x'] }));
    capabilityContextMock.mockResolvedValue(context(['PROJECT_SPONSOR']));
    goDecisionMock.mockResolvedValue({ decisionId: 'go-1' });
    const preflight = await getInitiativeTransitionPreflight({ orgId: ORG, initiativeId: INI, actorId: STRANGER });
    const approve = preflight!.transitions.find((t) => t.gate === 'APPROVE')!;
    expect(approve.blockingRule).toBeNull();
    expect(approve.blockingItems).toEqual([]);
    expect(approve.allowed).toBe(true);
  });

  it('warunek macierzy ma pierwszeństwo przed gotowością (ta sama kolejność co u pisarza)', async () => {
    queryOneMock.mockResolvedValue(draftRow());
    capabilityContextMock.mockResolvedValue(context(['CONSULTANT']));
    readinessMock.mockResolvedValue([
      { key: 'owner', label: 'Owner assigned', section: 'ownership', field: 'ownerBusinessId', requirement: '', suggestedAction: '' },
    ]);
    const preflight = await getInitiativeTransitionPreflight({ orgId: ORG, initiativeId: INI, actorId: AUTHOR });
    const submit = preflight!.transitions.find((t) => t.gate === 'SUBMIT_FOR_REVIEW')!;
    expect(submit.blockingRule).toBe('INITIATIVE_CARD_INCOMPLETE');
    expect(submit.blockingItems).toEqual([]);
  });
});
