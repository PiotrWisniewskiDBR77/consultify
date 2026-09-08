/**
 * DEC-453 — bramka `authorOnly` (np. SUBMIT_FOR_REVIEW, "Szkic → Do zatwierdzenia")
 * nie może odmawiać ADMIN/OWNER-owi organizacji, ani NIKOMU dla szkicu bez
 * zapisanego autora.
 *
 * Zmierzone na kopii danych właściciela (DBR77, `consultify_kopia_ini`): 52 z 69
 * szkiców inicjatyw ma puste `created_by` — poprzednia reguła
 * (`!createdBy || createdBy !== actorId`) traktowała pusty rekord jako
 * "nie-autor" i blokowała KAŻDEGO, ADMIN-a włącznie, komunikatem „Nie masz
 * uprawnień".
 *
 * Reguła docelowa (jedna funkcja, `evaluateInitiativeAuthorOnly`, wołana z
 * dwóch miejsc): warunek autorstwa spełniony, gdy
 *   (a) aktor === created_by, LUB
 *   (b) created_by puste, LUB
 *   (c) aktor ma rolę ADMIN/OWNER w organizacji (effectiveRoles zawiera
 *       ADMIN albo SUPERADMIN — resolver mapuje org OWNER na SUPERADMIN
 *       zanim rola trafi do effectiveRoles, więc oba warianty muszą przejść).
 * MEMBER nie będący autorem CUDZEGO, podpisanego szkicu nadal dostaje 403 —
 * (c) nie zmienia tego przypadku.
 *
 * Ten plik ma DWIE warstwy:
 *   1. Testy jednostkowe czystej funkcji `evaluateInitiativeAuthorOnly` —
 *      każdy przypadek z instrukcji, osobno.
 *   2. Test kontraktu: podgląd (`getInitiativeTransitionPreflight`) i pisarz
 *      (`executeInitiativeTransition`) dają TEN SAM wynik dla TYCH SAMYCH
 *      danych — dokładnie tak, jak wymaga docstring
 *      `initiativeTransitionConditions.ts` ("Rozjazd między przyciskiem a
 *      pisarzem jest więc niemożliwy z konstrukcji").
 *
 * MUTACJA (ma zaświecić na czerwono): usuń warunek (c) z
 * `evaluateInitiativeAuthorOnly` (initiativeTransitionConditions.ts) →
 * test „ADMIN nie-autor OK" i test „OWNER OK" czerwone, przywróć.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  evaluateInitiativeAuthorOnly,
  INITIATIVE_AUTHOR_ONLY_RULE,
} from '../initiativeTransitionConditions.js';

const AUTHOR = 'user-author';
const STRANGER = 'user-stranger';

const rowWith = (createdBy: string | null) => ({
  id: 'ini-1',
  organization_id: 'org-1',
  created_by: createdBy,
});

describe('evaluateInitiativeAuthorOnly (DEC-453) — funkcja czysta', () => {
  it('autor: created_by === aktor → OK, bez potrzeby żadnej roli', () => {
    const result = evaluateInitiativeAuthorOnly(rowWith(AUTHOR), AUTHOR, []);
    expect(result).toBeNull();
  });

  it('ADMIN nie-autor: effectiveRoles zawiera ADMIN → OK mimo cudzego created_by', () => {
    const result = evaluateInitiativeAuthorOnly(rowWith(AUTHOR), STRANGER, ['ADMIN']);
    expect(result).toBeNull();
  });

  it('OWNER organizacji (resolver mapuje na SUPERADMIN) → OK mimo cudzego created_by', () => {
    // initiativeAccessResolver.ts normalizuje org-owy `OWNER` do systemRole
    // SUPERADMIN i tylko WTEDY wypycha 'ADMIN' do effectiveRoles (patrz
    // `initiativeAccessResolver.ts` linia ~216) — ale sama funkcja warunku nie
    // wie nic o resolverze, więc sprawdzamy oba tokeny pasma admina wprost:
    // ADMIN (to, co resolver faktycznie emituje) i SUPERADMIN (surowy token
    // pasma), żeby nie było ukrytej zależności od jednej etykiety.
    expect(evaluateInitiativeAuthorOnly(rowWith(AUTHOR), STRANGER, ['ADMIN'])).toBeNull();
    expect(evaluateInitiativeAuthorOnly(rowWith(AUTHOR), STRANGER, ['SUPERADMIN'])).toBeNull();
  });

  it('MEMBER nie-autor cudzego, PODPISANEGO szkicu → 403 z kodem AUTHOR_ONLY', () => {
    const result = evaluateInitiativeAuthorOnly(rowWith(AUTHOR), STRANGER, ['MEMBER']);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe(INITIATIVE_AUTHOR_ONLY_RULE);
  });

  it('MEMBER nie-autor cudzego szkicu, BRAK roli w ogóle → też 403 (domyślny parametr [])', () => {
    const result = evaluateInitiativeAuthorOnly(rowWith(AUTHOR), STRANGER);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe(INITIATIVE_AUTHOR_ONLY_RULE);
  });

  it('created_by puste + MEMBER → OK (nie ma kogo chronić — to jest 52/69 szkiców DBR77)', () => {
    const result = evaluateInitiativeAuthorOnly(rowWith(null), STRANGER, ['MEMBER']);
    expect(result).toBeNull();
  });

  it('created_by puste + BRAK jakiejkolwiek roli → OK (ten sam przypadek, bez roli)', () => {
    const result = evaluateInitiativeAuthorOnly(rowWith(''), STRANGER, []);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Warstwa 2: preflight i serwis (pisarz) dają ten sam wynik dla tych samych
// danych — mocking wzorowany na initiativeTransitionPreflightService.dec453.test.ts
// (ten sam plik testuje kontrakt podglądu; ten test dokłada DEC-453 do tego
// samego kontraktu zamiast tworzyć trzecią, niezależną kopię mocków).
// ---------------------------------------------------------------------------

const { queryMock, withPgTransactionMock, queryOneMock, queryAllMock, capabilityContextMock } =
  vi.hoisted(() => ({
    queryMock: vi.fn(),
    withPgTransactionMock: vi.fn(),
    queryOneMock: vi.fn(),
    queryAllMock: vi.fn(),
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

vi.mock('../initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: vi.fn().mockResolvedValue([]),
}));
vi.mock('../initiativeGateAiConfig.js', () => ({
  isInitiativeGateAiEnabled: vi.fn().mockResolvedValue(false),
}));

import { getInitiativeTransitionPreflight } from '../initiativeTransitionPreflightService.js';
import { executeInitiativeTransition } from '../initiativeTransitionService.js';

const ORG = 'org-1';
const INI = 'ini-1';

// Karta kompletna (CARD_COMPLETE spełniony), żeby jedynym powodem
// ewentualnej odmowy SUBMIT_FOR_REVIEW był `authorOnly`, nie karta.
const completeDraftRow = (over: Record<string, unknown> = {}) => ({
  id: INI,
  organization_id: ORG,
  status: 'DRAFT',
  name: 'Próba DEC-453',
  title: 'Próba DEC-453',
  description: 'Opis wystarczający',
  created_by: AUTHOR,
  owner_business_id: 'owner-1',
  owner_execution_id: null,
  scope_in: ['x'],
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
  capabilityContextMock.mockReset();
  queryMock.mockReset();
  withPgTransactionMock.mockReset().mockImplementation(async (fn: (client: unknown) => unknown) =>
    fn({ query: queryMock })
  );
});

describe('DEC-453 — podgląd i pisarz zgodni dla ADMIN na cudzym szkicu bez autora', () => {
  it('szkic BEZ autora (created_by puste): ADMIN widzi aktywny przycisk I pisarz go przepuszcza', async () => {
    const row = completeDraftRow({ created_by: null });

    // --- podgląd ---
    queryOneMock.mockResolvedValue(row);
    capabilityContextMock.mockResolvedValue(context(['ADMIN']));
    const preflight = await getInitiativeTransitionPreflight({
      orgId: ORG,
      initiativeId: INI,
      actorId: STRANGER,
    });
    const submit = preflight!.transitions.find((t) => t.gate === 'SUBMIT_FOR_REVIEW')!;
    expect(submit.roleAllowed).toBe(true);
    expect(submit.conditionSatisfied).toBe(true);
    expect(submit.allowed).toBe(true);
    expect(preflight!.isAuthor).toBe(true);

    // --- pisarz: ta sama inicjatywa, ten sam aktor, ta sama rola ---
    let updated = false;
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM initiatives')) return { rows: [row], rowCount: 1 };
      if (sql.includes('UPDATE initiatives')) {
        updated = true;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    capabilityContextMock.mockResolvedValue(context(['ADMIN']));
    const result = await executeInitiativeTransition({
      orgId: ORG,
      initiativeId: INI,
      actorId: STRANGER,
      actorRole: 'ADMIN',
      nextStatusInput: 'PENDING_APPROVAL',
    });
    expect(result.ok).toBe(true);
    expect(updated).toBe(true);
  });

  it('ten sam szkic BEZ autora: MEMBER (bez ADMIN) — podgląd i pisarz zgodnie ODMAWIAJĄ, bo brak roli bramki', () => {
    // Kontrolna strona: (b) samo "brak autora" nie zwalnia z wymogu ROLI —
    // MEMBER nie ma roli CONSULTANT/ADMIN wymaganej przez SUBMIT_FOR_REVIEW,
    // więc roleAllowed pozostaje false z innego powodu (macierz ról), a nie z
    // authorOnly. Ten test pilnuje, żeby fix (b)/(c) nie stał się "każdy może
    // wszystko".
    return (async () => {
      const row = completeDraftRow({ created_by: null });
      queryOneMock.mockResolvedValue(row);
      capabilityContextMock.mockResolvedValue(context(['MEMBER']));
      const preflight = await getInitiativeTransitionPreflight({
        orgId: ORG,
        initiativeId: INI,
        actorId: STRANGER,
      });
      const submit = preflight!.transitions.find((t) => t.gate === 'SUBMIT_FOR_REVIEW')!;
      expect(submit.roleAllowed).toBe(false);
      expect(submit.allowed).toBe(false);

      queryMock.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT * FROM initiatives')) return { rows: [row], rowCount: 1 };
        throw new Error(`nieoczekiwany zapis mimo braku roli: ${sql}`);
      });
      capabilityContextMock.mockResolvedValue(context(['MEMBER']));
      const result = await executeInitiativeTransition({
        orgId: ORG,
        initiativeId: INI,
        actorId: STRANGER,
        actorRole: 'MEMBER',
        nextStatusInput: 'PENDING_APPROVAL',
      });
      expect(result.ok).toBe(false);
      expect((result as { statusCode: number }).statusCode).toBe(403);
    })();
  });

  it('szkic Z autorem: MEMBER-nie-autor — podgląd i pisarz zgodnie ODMAWIAJĄ z kodem AUTHOR_ONLY', async () => {
    const row = completeDraftRow(); // created_by = AUTHOR
    queryOneMock.mockResolvedValue(row);
    capabilityContextMock.mockResolvedValue(context(['CONSULTANT']));
    const preflight = await getInitiativeTransitionPreflight({
      orgId: ORG,
      initiativeId: INI,
      actorId: STRANGER,
    });
    const submit = preflight!.transitions.find((t) => t.gate === 'SUBMIT_FOR_REVIEW')!;
    // CONSULTANT przechodzi rolę bramki, ale NIE jest autorem — authorOnly blokuje.
    expect(submit.roleAllowed).toBe(false);
    expect(preflight!.isAuthor).toBe(false);

    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM initiatives')) return { rows: [row], rowCount: 1 };
      throw new Error(`nieoczekiwany zapis mimo authorOnly: ${sql}`);
    });
    capabilityContextMock.mockResolvedValue(context(['CONSULTANT']));
    const result = await executeInitiativeTransition({
      orgId: ORG,
      initiativeId: INI,
      actorId: STRANGER,
      actorRole: 'MEMBER',
      nextStatusInput: 'PENDING_APPROVAL',
    });
    expect(result.ok).toBe(false);
    expect((result as { statusCode: number }).statusCode).toBe(403);
    expect((result as { body: { rule: string } }).body.rule).toBe(INITIATIVE_AUTHOR_ONLY_RULE);
  });
});
