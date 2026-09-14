/**
 * P-T15 (uwaga testera XV, Wywiad) — kontrakt AUTORYZACJI kasowania załącznika.
 *
 * P-T15 zgłaszał BRAK USUWANIA w UI; trasa serwera istniała już wcześniej
 * (`interview.routes.ts:470` → `InterviewController.deleteEvidence`). Skoro
 * front zaczyna ją wołać, jej bramki muszą mieć test — inaczej „podłączyliśmy
 * przewód" znaczyłoby też „otworzyliśmy ścieżkę, której nikt nie mierzył".
 *
 * SPROSTOWANIE WOBEC ZLECENIA: zlecenie mówiło „403 dla obcej org, 200 dla
 * właściciela". Kod robi co innego i jest to LEPSZE: pierwsze zapytanie jest
 * org-scope'owane (`WHERE id = ? AND organization_id = ?`,
 * `InterviewController.ts:9645`), więc obca organizacja dostaje **404**, nie
 * 403 — nie potwierdzamy istnienia cudzego dowodu. 403 należy się komuś, kto
 * jest we WŁAŚCIWEJ organizacji, ale nie jest właścicielem sesji
 * (`:9659` → `INTERVIEW_SESSION_FORBIDDEN`). Test mierzy to, co robi kod.
 *
 * Handler wołany wprost na zamockowanym `queryHelpers` (wzór:
 * `interview-template-question-idor.test.ts`) — zero sieci, zero bazy.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  queryFirst: (...a: unknown[]) => mockQueryOne(...a),
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
  // Transakcja bez bazy: wykonaj ciało i oddaj wynik.
  withPgTransaction: async (fn: () => Promise<unknown>) => fn(),
}));

vi.mock('../../services/ai/ingestionPipeline.js', () => ({ IngestionPipeline: class {} }));
vi.mock('../../services/ai/llmService.js', () => ({ llmService: {} }));
vi.mock('../../services/notificationService.js', () => ({ default: { send: vi.fn() } }));
vi.mock('../../services/organizationContext/OrganizationContextService.js', () => ({
  default: { recordInterviewAnswer: vi.fn(), rebuildSnapshot: vi.fn() },
}));
vi.mock('../../services/pdfParserService.js', () => ({ default: {} }));
vi.mock('../../services/workflow/gatePolicy.js', () => ({ evaluateGatePolicy: vi.fn() }));
vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../utils/dbSchema.js', () => ({
  getTableColumns: vi.fn().mockResolvedValue(new Set<string>()),
}));

const ORG_A = 'aaa00000-0000-4000-8000-000000000001';
const WLASCICIEL = 'user-owner-111';
const OBCY = 'user-other-222';
const EVIDENCE_ID = 'ev-1';
const SESSION_ID = 'sess-1';

function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  });
  return res;
}

async function wolajDelete(user: { id: string; role: string; organizationId: string }) {
  const { InterviewController } = await import('../../controllers/InterviewController.js');
  const req: any = { user, params: { evidenceId: EVIDENCE_ID }, body: {} };
  const res = makeRes();
  await (InterviewController as any).deleteEvidence(req, res, vi.fn());
  return res;
}

/** Odpowiedzi `queryOne` sterowane TREŚCIĄ SQL — kolejność wywołań w handlerze
 *  nie może decydować o tym, czy test przechodzi. */
function ustawBaze(opts: { ownerId: string; status?: string }) {
  mockQueryOne.mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (/FROM interview_evidence/.test(s) && /FOR UPDATE/.test(s)) return { id: EVIDENCE_ID };
    if (/FROM interview_evidence/.test(s))
      return { id: EVIDENCE_ID, session_id: SESSION_ID, question_id: null };
    if (/FROM interview_sessions/.test(s))
      return {
        id: SESSION_ID,
        assignment_id: null,
        status: opts.status ?? 'in_progress',
        owner_id: opts.ownerId,
      };
    return null;
  });
  mockQueryAll.mockResolvedValue([]);
  mockQueryRun.mockResolvedValue({ rowCount: 1 });
}

const czyKasowal = () =>
  mockQueryRun.mock.calls.some((c) => /DELETE\s+FROM\s+interview_evidence/i.test(String(c?.[0])));

describe('P-T15 — DELETE /interview/evidence/:id, bramki autoryzacji', () => {
  beforeEach(() => vi.clearAllMocks());

  it('obca organizacja ⇒ 404 i ZERO kasowania (lookup jest org-scope)', async () => {
    // Zapytanie org-scope'owane nie znajduje dowodu innej organizacji.
    mockQueryOne.mockResolvedValue(null);
    mockQueryAll.mockResolvedValue([]);
    mockQueryRun.mockResolvedValue({ rowCount: 0 });

    const res = await wolajDelete({ id: OBCY, role: 'admin', organizationId: ORG_A });

    expect(res.statusCode).toBe(404);
    expect(czyKasowal()).toBe(false);
  });

  it('własna organizacja, ale NIE właściciel sesji ⇒ 403 i ZERO kasowania', async () => {
    ustawBaze({ ownerId: WLASCICIEL });

    const res = await wolajDelete({ id: OBCY, role: 'admin', organizationId: ORG_A });

    expect(res.statusCode).toBe(403);
    expect(res.body?.code).toBe('INTERVIEW_SESSION_FORBIDDEN');
    expect(czyKasowal()).toBe(false);
  });

  it('właściciel sesji ⇒ 200 i realne DELETE org-scope', async () => {
    ustawBaze({ ownerId: WLASCICIEL });

    const res = await wolajDelete({ id: WLASCICIEL, role: 'member', organizationId: ORG_A });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    const del = mockQueryRun.mock.calls.find((c) =>
      /DELETE\s+FROM\s+interview_evidence/i.test(String(c?.[0]))
    );
    expect(del).toBeTruthy();
    // Kasowanie NIGDY bez organizacji w WHERE.
    expect(String(del?.[0])).toMatch(/organization_id\s*=\s*\?/);
    expect(del?.[1]).toEqual([EVIDENCE_ID, ORG_A]);
  });

  it('sesja zamknięta ⇒ 409 i ZERO kasowania', async () => {
    ustawBaze({ ownerId: WLASCICIEL, status: 'completed' });

    const res = await wolajDelete({ id: WLASCICIEL, role: 'member', organizationId: ORG_A });

    expect(res.statusCode).toBe(409);
    expect(czyKasowal()).toBe(false);
  });
});
