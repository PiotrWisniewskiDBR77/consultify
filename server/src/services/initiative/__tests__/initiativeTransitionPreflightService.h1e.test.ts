/**
 * H1e — START (APPROVED→IN_EXECUTION) preflight musi zgadzać się z pisarzem
 * pod flagą `ENABLE_LIFECYCLE_GO_GATE` (H1d).
 *
 * Rozjazd, który ten test przybija: wiersz macierzy APPROVED→IN_EXECUTION ma
 * warunek `HANDOFF_AND_START_DATE` — sam z siebie preflight raportował START
 * jako DOZWOLONY, podczas gdy pisarz (`requireCurrentGateDecision` w
 * `initiativeTransitionService`, za flagą `ENABLE_LIFECYCLE_GO_GATE`) odmawiał
 * 409-ką `GATE_DECISION_REQUIRED`. Przycisk aktywny + serwer odmawiający =
 * dokładnie to, czego DEC-424 zabrania.
 *
 * MUTACJA, która ma zaświecić ten plik na czerwono: usuń warstwę
 * `CURRENT_GO_DECISION` dodaną w `initiativeTransitionPreflightService` dla
 * gate === START pod flagą ON.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const ORG = 'org-1';
const INI = 'ini-1';
const STRANGER = 'user-stranger';

const approvedRow = (over: Record<string, unknown> = {}) => ({
  id: INI,
  organization_id: ORG,
  status: 'APPROVED',
  name: 'Próba',
  title: 'Próba',
  description: 'Opis',
  created_by: null,
  owner_business_id: 'owner-1',
  owner_execution_id: null,
  scope_in: ['x'],
  scope_out: null,
  planned_start_date: '2026-10-01',
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

const ORIGINAL_FLAG = process.env.ENABLE_LIFECYCLE_GO_GATE;

beforeEach(() => {
  queryOneMock.mockReset();
  // Warunek macierzy `HANDOFF_AND_START_DATE` spełniony na starcie każdego
  // testu — jedyną zmienną, którą testy przełączają, jest decyzja GO.
  queryAllMock.mockReset().mockImplementation(async (sql: string) => {
    if (String(sql).includes('initiative_handoffs')) return [{ ok: true }];
    return [];
  });
  readinessMock.mockReset().mockResolvedValue([]);
  goDecisionMock.mockReset().mockRejectedValue(new Error('no decision'));
  capabilityContextMock.mockReset();
  queryMock.mockReset();
  withPgTransactionMock.mockReset().mockImplementation(async (fn: (client: unknown) => unknown) => fn({ query: queryMock }));
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.ENABLE_LIFECYCLE_GO_GATE;
  else process.env.ENABLE_LIFECYCLE_GO_GATE = ORIGINAL_FLAG;
});

describe('podgląd START (APPROVED→IN_EXECUTION) vs flaga ENABLE_LIFECYCLE_GO_GATE', () => {
  it('flaga OFF: brak decyzji GO nie blokuje — preflight = linia (macierz bez zmian)', async () => {
    delete process.env.ENABLE_LIFECYCLE_GO_GATE;
    queryOneMock.mockResolvedValue(approvedRow());
    capabilityContextMock.mockResolvedValue(context(['PMO']));

    const preflight = await getInitiativeTransitionPreflight({ orgId: ORG, initiativeId: INI, actorId: STRANGER });
    const start = preflight!.transitions.find((t) => t.gate === 'START')!;

    expect(start.conditionSatisfied).toBe(true);
    expect(start.blockingRule).toBeNull();
    expect(start.allowed).toBe(true);
    // Bez GO-decyzji w bazie w ogóle — flaga OFF nie ma powodu jej sprawdzać.
    expect(goDecisionMock).not.toHaveBeenCalled();
  });

  it('flaga ON, brak aktualnej decyzji GO: „Start" nieaktywny z GATE_DECISION_REQUIRED (ten sam kod co pisarz)', async () => {
    process.env.ENABLE_LIFECYCLE_GO_GATE = 'true';
    queryOneMock.mockResolvedValue(approvedRow());
    capabilityContextMock.mockResolvedValue(context(['PMO']));
    goDecisionMock.mockRejectedValue(new Error('no decision'));

    const preflight = await getInitiativeTransitionPreflight({ orgId: ORG, initiativeId: INI, actorId: STRANGER });
    const start = preflight!.transitions.find((t) => t.gate === 'START')!;

    expect(start.conditionSatisfied).toBe(false);
    expect(start.blockingRule).toBe('GATE_DECISION_REQUIRED');
    expect(start.allowed).toBe(false);
  });

  it('flaga ON, decyzja GO aktualna: „Start" wolno kliknąć', async () => {
    process.env.ENABLE_LIFECYCLE_GO_GATE = 'true';
    queryOneMock.mockResolvedValue(approvedRow());
    capabilityContextMock.mockResolvedValue(context(['PMO']));
    goDecisionMock.mockResolvedValue({ decisionId: 'go-1' });

    const preflight = await getInitiativeTransitionPreflight({ orgId: ORG, initiativeId: INI, actorId: STRANGER });
    const start = preflight!.transitions.find((t) => t.gate === 'START')!;

    expect(start.conditionSatisfied).toBe(true);
    expect(start.blockingRule).toBeNull();
    expect(start.allowed).toBe(true);
  });
});
