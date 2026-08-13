/**
 * @vitest-environment node
 *
 * DRD — pełna ścieżka end-to-end przez PRAWDZIWY HTTP na PRAWDZIWEJ Postgres
 * (T3, 2026-08-13).
 *
 * Cel (zlecenie T3): udowodnić Library → sesja → uczestnicy → wpis ręczny →
 * dowód → autosave → Live Matrix → freeze przez approvera → immutable
 * Output → send back → nowa rewizja → approval → Report → Presentation →
 * Initiative Proposal → RESTART → odnalezienie i otwarcie wszystkich
 * artefaktów → lineage → odrzucenie dostępu z innej organizacji — BEZ ani
 * jednego ręcznie wpisanego SQL poza (a) fixture bootstrap organizacji/
 * użytkowników/paczki metody (dokładnie ten sam wzorzec co
 * `httpDownstreamListing.integration.test.ts`) i (b) asercjami odczytu wprost
 * z tabeli, tam gdzie zadanie explicite to dopuszcza ("porównaj hash/treść z
 * tabelą, nie z wcześniejszej odpowiedzi HTTP").
 *
 * Wzorzec mountowania aplikacji skopiowany 1:1 z
 * `httpDownstreamListing.integration.test.ts` (ten sam katalog, ten sam
 * moduł method-core) — `express()` + `method-core.routes.ts` bezpośrednio,
 * BEZ `listen()` na porcie. To jest prawdziwy HTTP: trasy, middleware
 * (verifyToken/isAuthenticated), serwisy, SQL.
 *
 * "RESTART" — druga, NIEZALEŻNA instancja `express()` z tym samym routerem
 * zamontowanym od nowa, budowana W TYM SAMYM pliku testu, PO całej ścieżce
 * tworzenia. Każdy odczyt po "restarcie" idzie WYŁĄCZNIE przez identyfikatory
 * (stringi) zapisane wcześniej — nigdy przez obiekty/referencje z pierwszej
 * instancji. UCZCIWA GRANICA tego dowodu: `sessionService` /
 * `methodEventStore` / `methodPackRegistry` / `methodOutputService` /
 * `outputBridge` w `method-core.routes.ts` są modułowymi singletonami —
 * druga `express()` w tym samym procesie Node dzieli je z pierwszą (import
 * ESM jest cache'owany raz na proces). Prawdziwy restart procesu (nowy PID)
 * nie jest tu wykonywany. Co TO dowodzi mimo to: żaden z tych singletonów
 * nie trzyma stanu SESJI/OUTPUTU/ARTEFAKTU w pamięci — każda operacja czyta
 * na nowo z Postgres po samym `id` (patrz `getSessionRow`, `getOutput`,
 * `listBySession` — zawsze `SELECT ... WHERE id = ?`), więc druga instancja
 * odnajdująca wszystko wyłącznie po id nadal dowodzi braku zależności od
 * stanu per-request/per-response — tylko NIE dowodzi braku globalnego
 * cache'u w pamięci procesu (bo takiego cache'u kernel i tak nie ma —
 * zweryfikowane czytaniem kodu, nie tylko testem).
 *
 * Run (z korzenia worktree):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_asm_t3" \
 *   npx vitest run server/src/method-core/__tests__/drdVerticalSlice.e2e.test.ts --no-file-parallelism
 *
 * `describe.skipIf(!REAL_DB)` — strukturalny no-op (każdy przypadek raportuje
 * "skipped", nigdy "passed") dopóki RUN_DB_TESTS=1, MOCK_DB=false i postgres
 * DATABASE_URL nie są jednocześnie ustawione.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)('DRD vertical slice — pełna ścieżka E2E przez prawdziwy HTTP (real PostgreSQL, T3)', () => {
  let app: Express; // pierwsza instancja — cała ścieżka tworzenia
  let restartedApp: Express; // druga, niezależna instancja — "restart"
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-t3-${SUFFIX}`;
  const OTHER_ORG = `org-t3-other-${SUFFIX}`;
  const OWNER = `user-t3-owner-${SUFFIX}`;
  const APPROVER = `user-t3-approver-${SUFFIX}`;
  const PARTICIPANT = `user-t3-participant-${SUFFIX}`;
  const OTHER_ORG_USER = `user-t3-otherorg-${SUFFIX}`;

  const PACK_ID = `t3-drd-pack-${SUFFIX}`;
  const PACK_VERSION = 'v1';
  const PROJECT_ID = `proj-t3-drd-${SUFFIX}`;

  let ownerToken = '';
  let approverToken = '';
  let otherOrgToken = '';

  // Znajdowane / wypełniane w kolejnych krokach ścieżki (dzielone między `it`)
  let rootSessionId = '';
  let revisionSessionId = '';
  let v1OutputId = '';
  let v1ContentHash = '';
  let v1VersionAtFreeze = 0;
  let v2OutputId = '';
  let v2ContentHash = '';
  let reportId = '';
  let presentationId = '';
  let draftId = '';

  // brakujące ogniwa odkryte podczas budowy testu — zbierane tutaj i
  // wypisane w raporcie końcowym (nie w assercjach — to jest dokumentacja,
  // nie test).
  const MISSING_LINKS: string[] = [];

  beforeAll(async () => {
    if (!REAL_DB) {
      throw new Error('Requires NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false and a real postgres DATABASE_URL.');
    }

    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ORG,
      'T3 DRD vertical slice org',
    ]);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      OTHER_ORG,
      'T3 DRD vertical slice org (other tenant)',
    ]);
    for (const [id, org] of [
      [OWNER, ORG],
      [APPROVER, ORG],
      [PARTICIPANT, ORG],
      [OTHER_ORG_USER, OTHER_ORG],
    ] as const) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [id, org, `${id}@example.test`, 'user']
      );
    }

    const { default: config } = await import('../../config/Config.js');
    const sign = (id: string, organizationId: string) =>
      jwt.sign({ id, organizationId, role: 'user' }, config.JWT_SECRET, {
        expiresIn: '30m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      });
    ownerToken = sign(OWNER, ORG);
    approverToken = sign(APPROVER, ORG);
    otherOrgToken = sign(OTHER_ORG_USER, OTHER_ORG);

    // Rejestracja paczki metody (Library) — przez serwis kernela, nie SQL
    // (dokładnie ten sam wzorzec co S1's httpDownstreamListing test; nie ma
    // HTTP endpointu do rejestrowania paczek — patrz MISSING_LINKS niżej).
    const { methodPackRegistry } = await import('../MethodPackRegistry.js');
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: PACK_ID,
      version: PACK_VERSION,
      name: 'T3 DRD test pack (released)',
      readiness: 'released',
    });
    MISSING_LINKS.push(
      'Brak HTTP endpointu do rejestracji Method Pack (np. POST /api/method/packs) — Library jest ' +
        'wyłącznie do odczytu (GET /packs); wpis do biblioteki musi powstać przez ' +
        'MethodPackRegistry.register() bezpośrednio (fixture w tym teście), nie przez klienta HTTP.'
    );

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
  });

  afterAll(async () => {
    // Additive-only cleanup, kaskadowo od organizacji (każdy FK method_* jest
    // ON DELETE CASCADE). users.organization_id nie ma cascade, więc users
    // muszą pójść pierwsze, inaczej DELETE na organizations dostaje 23503.
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[OWNER, APPROVER, PARTICIPANT, OTHER_ORG_USER]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG, OTHER_ORG]]);
    await pool.end();

    if (MISSING_LINKS.length > 0) {
      // eslint-disable-next-line no-console
      console.log('\n[drdVerticalSlice] Brakujące ogniwa odkryte podczas testu:\n- ' + MISSING_LINKS.join('\n- '));
    }
  });

  // ===========================================================================
  // 1. Library — GET /packs
  // ===========================================================================
  it('1. Library: GET /packs pokazuje zarejestrowaną, wydaną (released) paczkę metody', async () => {
    const res = await request(app).get('/api/method/packs').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    const pack = res.body.packs.find((p: { packId: string; version: string }) => p.packId === PACK_ID && p.version === PACK_VERSION);
    expect(pack).toBeTruthy();
    expect(pack.readiness).toBe('released');
  });

  // ===========================================================================
  // 2. Utworzenie sesji — POST /sessions
  // ===========================================================================
  it('2. Utworzenie sesji: POST /sessions tworzy sesję w stanie draft, twórca dostaje rolę owner automatycznie', async () => {
    const res = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `create:${randomUUID()}`)
      .send({
        module: 'assessment',
        methodPackId: PACK_ID,
        methodPackVersion: PACK_VERSION,
        mode: 'guided_manual',
        projectId: PROJECT_ID,
      });
    expect(res.status).toBe(201);
    expect(res.body.session.state).toBe('draft');
    expect(res.body.session.version).toBe(1);
    rootSessionId = res.body.session.id as string;

    // "twórca = owner automatycznie" zweryfikowane przez HTTP, nie SQL.
    const roles = await request(app)
      .get(`/api/method/sessions/${rootSessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(roles.status).toBe(200);
    expect(roles.body.roles).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: OWNER, role: 'owner' })])
    );
  });

  // ===========================================================================
  // 3. Przypisanie uczestników — POST /sessions/:id/roles (HTTP, nie INSERT)
  // ===========================================================================
  it('3. Przypisanie uczestników przez HTTP: lead_assessor (self), approver, evidence_owner; guardy S2 działają', async () => {
    // Owner self-przypisuje lead_assessor — legalne (rola robocza, nie POWER_ROLE).
    const selfLead = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: OWNER, role: 'lead_assessor' });
    expect(selfLead.status).toBe(201);
    expect(selfLead.body.inserted).toBe(true);

    // Guard S2#1: self-elevation do roli z uprawnieniem freeze — zablokowane.
    const selfApprover = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: OWNER, role: 'approver' });
    expect(selfApprover.status).toBe(403);
    expect(selfApprover.body.error).toBe('self_elevation_forbidden');

    // Owner przypisuje approver innej osobie — legalne.
    const grantApprover = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: APPROVER, role: 'approver' });
    expect([200, 201]).toContain(grantApprover.status);

    // Owner przypisuje evidence_owner uczestnikowi.
    const grantParticipant = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: PARTICIPANT, role: 'evidence_owner' });
    expect(grantParticipant.status).toBe(201);

    // Guard S2#6: przypisanie roli użytkownikowi z INNEJ organizacji — zablokowane.
    const crossOrg = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: OTHER_ORG_USER, role: 'observer' });
    expect(crossOrg.status).toBe(403);
    expect(crossOrg.body.error).toBe('cross_org_assignment_forbidden');

    const roster = await request(app)
      .get(`/api/method/sessions/${rootSessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(roster.status).toBe(200);
    const rosterPairs = roster.body.roles.map((r: { userId: string; role: string }) => `${r.userId}:${r.role}`);
    expect(rosterPairs).toEqual(
      expect.arrayContaining([`${OWNER}:owner`, `${OWNER}:lead_assessor`, `${APPROVER}:approver`, `${PARTICIPANT}:evidence_owner`])
    );

    // ★ ZNANA LUKA (już opisana w kodzie route'a, nie odkryta przeze mnie) —
    // przypisanie roli NIE jest ograniczone do owner/lead_assessor sesji;
    // każdy uwierzytelniony członek organizacji może nadać rolę nie-władczą
    // w cudzej sesji. Zapisane w raporcie, nie naprawiane (jednolinijkowa
    // naprawa była próbowana przez S2 i wywróciła 12 testów kernela — patrz
    // server/src/routes/method-core.routes.ts linie ~631-640).
  });

  // ===========================================================================
  // 4. draft -> prepared -> active (HTTP transitions)
  // ===========================================================================
  it('4. Sesja przechodzi draft -> prepared -> active przez POST /transition', async () => {
    for (const to of ['prepared', 'active']) {
      const res = await request(app)
        .post(`/api/method/sessions/${rootSessionId}/transition`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('Idempotency-Key', `transition:${to}:${randomUUID()}`)
        .send({ to });
      expect(res.status, `transition to ${to}`).toBe(200);
      expect(res.body.session.state).toBe(to);
    }
  });

  // ===========================================================================
  // 5. Wpis ręczny + dowód + autosave — POST /sessions/:id/events
  // ===========================================================================
  it('5. Wpis ręczny (ANSWER_DRAFTED/REVISED/CONFIRMED) + dowód (EVIDENCE_ATTACHED) na dwóch osiach', async () => {
    // --- oś 1A: draft -> evidence -> confirm ---------------------------------
    const draft1A = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'ANSWER_DRAFTED',
        unitId: '1A',
        level: 2,
        payload: { questionId: 'q1A', answerText: 'Wersja robocza — poziom 2', answerState: 'draft' },
      });
    expect(draft1A.status).toBe(201);

    const evidence1A = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'EVIDENCE_ATTACHED',
        unitId: '1A',
        payload: { evidenceId: `ev-1a-${randomUUID()}`, evidenceType: 'document', strength: 'E2' },
      });
    expect(evidence1A.status).toBe(201);

    const confirm1A = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'ANSWER_CONFIRMED',
        unitId: '1A',
        level: 3,
        payload: { questionId: 'q1A', answerState: 'confirmed' },
      });
    expect(confirm1A.status).toBe(201);

    // --- oś 1B: draft -> evidence -> confirm ---------------------------------
    const draft1B = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'ANSWER_DRAFTED',
        unitId: '1B',
        level: 1,
        payload: { questionId: 'q1B', answerText: 'Wersja robocza — poziom 1', answerState: 'draft' },
      });
    expect(draft1B.status).toBe(201);

    const evidence1B = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'EVIDENCE_ATTACHED',
        unitId: '1B',
        payload: { evidenceId: `ev-1b-${randomUUID()}`, evidenceType: 'interview', strength: 'E1' },
      });
    expect(evidence1B.status).toBe(201);

    const confirm1B = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'ANSWER_CONFIRMED',
        unitId: '1B',
        level: 2,
        payload: { questionId: 'q1B', answerState: 'confirmed' },
      });
    expect(confirm1B.status).toBe(201);

    const events = await request(app)
      .get(`/api/method/sessions/${rootSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(events.status).toBe(200);
    expect(events.body.events).toHaveLength(6);
  });

  // ===========================================================================
  // 6. Autosave — replay tego samego Idempotency-Key nie tworzy duplikatu
  // ===========================================================================
  it('6. Autosave-safe replay: ten sam Idempotency-Key dwa razy = JEDEN wpis, nie dwa', async () => {
    const autosaveKey = `autosave:${randomUUID()}`;
    const body = {
      type: 'ANSWER_DRAFTED' as const,
      unitId: '1A',
      level: 3,
      payload: { questionId: 'q1A', answerText: 'Autosave draft', answerState: 'draft' },
    };

    const first = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', autosaveKey)
      .send(body);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', autosaveKey)
      .send(body);
    expect(second.status).toBe(201);

    // Ten sam wiersz — nie dwa różne id.
    expect(second.body.event.id).toBe(first.body.event.id);

    const events = await request(app)
      .get(`/api/method/sessions/${rootSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const matching = events.body.events.filter((e: { id: string }) => e.id === first.body.event.id);
    expect(matching).toHaveLength(1); // dokładnie jeden wiersz w bazie, replay nie zduplikował
  });

  // ===========================================================================
  // 7. Live Matrix — brak dedykowanego endpointu; dowód przez GET /events (HTTP)
  //    + `deriveFindingsFromEvents` (ta sama CZYSTA funkcja kernela, której
  //    freeze użyje wewnętrznie — nie reimplementacja, nie SQL).
  // ===========================================================================
  it('7. Live Matrix (pre-freeze): macierz wyliczona z HTTP-owych /events pasuje do ostatnich potwierdzonych poziomów', async () => {
    const { deriveFindingsFromEvents } = await import('../outputs/index.js');

    const eventsRes = await request(app)
      .get(`/api/method/sessions/${rootSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(eventsRes.status).toBe(200);

    const { current } = deriveFindingsFromEvents(eventsRes.body.events);
    // Ostatni ANSWER_CONFIRMED wygrywa: 1A=3 (confirm1A), 1B=2 (confirm1B) —
    // ANSWER_DRAFTED z kroku 6 (poziom 3, bez CONFIRMED) nie zmienia current.
    expect(current['1A']).toBe(3);
    expect(current['1B']).toBe(2);

    MISSING_LINKS.push(
      'Brak dedykowanego HTTP endpointu na "Live Matrix" (np. GET /sessions/:id/matrix) — jedyny ' +
        'sposób na pre-freeze macierz to pobranie GET /events i policzenie jej lokalnie tą samą czystą ' +
        'funkcją co freeze (deriveFindingsFromEvents), co ten test właśnie robi. Serwer nigdy nie zwraca ' +
        'gotowej macierzy przed freeze.'
    );
  });

  // ===========================================================================
  // 8. active -> in_review
  // ===========================================================================
  it('8. Sesja przechodzi active -> in_review (wymaga roli lead_assessor/assessor)', async () => {
    const res = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/transition`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `transition:in_review:${randomUUID()}`)
      .send({ to: 'in_review' });
    expect(res.status).toBe(200);
    expect(res.body.session.state).toBe('in_review');
  });

  // ===========================================================================
  // 9. Freeze przez approvera — POST /sessions/:id/approvals { decision: approved }
  // ===========================================================================
  it('9. Freeze przez approvera: POST /approvals { decision: "approved" } zamraża sesję i tworzy Output', async () => {
    const res = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/approvals`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `approve:${randomUUID()}`)
      .send({ decision: 'approved' });
    expect(res.status).toBe(201);
    expect(res.body.approval.decision).toBe('approved');
    expect(res.body.session.state).toBe('frozen');
    v1VersionAtFreeze = res.body.approval.revision as number;

    // Nieuprawniony (owner, bez roli approver) nie może zamrozić — dowód, że
    // to naprawdę approver-only, nie przypadkowy sukces.
    // (Sesja jest już frozen, więc to sprawdzamy NA INNEJ świeżej sesji byłoby
    // czystsze, ale odtworzenie całej ścieżki tylko dla tej asercji jest
    // nieproporcjonalne — pomijamy tu i polegamy na TRANSITION_AUTHORITY
    // being covered by rolesAndApprovals.http.pg.test.ts, które T3 nie
    // duplikuje).

    const outputs = await request(app)
      .get(`/api/method/outputs?sessionId=${rootSessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(outputs.status).toBe(200);
    expect(outputs.body.outputs).toHaveLength(1);
    v1OutputId = outputs.body.outputs[0].id as string;
    v1ContentHash = outputs.body.outputs[0].contentHash as string;
    expect(v1OutputId).toBeTruthy();
    expect(v1ContentHash).toBeTruthy();
  });

  // ===========================================================================
  // 10. Immutable Output — dwa odczyty identyczne; ponowny freeze idempotentny
  // ===========================================================================
  it('10. Immutable Output: dwa GET /outputs/:id identyczne; powtórny freeze nie tworzy nowego Outputu', async () => {
    const first = await request(app)
      .get(`/api/method/outputs/${v1OutputId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const second = await request(app)
      .get(`/api/method/outputs/${v1OutputId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.output).toEqual(second.body.output);

    const replayFreeze = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/freeze`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `freeze-replay:${randomUUID()}`)
      .send({});
    expect(replayFreeze.status).toBe(200);
    expect(replayFreeze.body.output.id).toBe(v1OutputId);
    expect(replayFreeze.body.output.contentHash).toBe(v1ContentHash);
    expect(replayFreeze.body.selfHealed).toBe(false);
  });

  // ===========================================================================
  // 11. Send back — POST /approvals { decision: sent_back } reopen'uje frozen -> active
  // ===========================================================================
  it('11. Send back: POST /approvals { decision: "sent_back", comment } odsyła zamrożoną sesję do korekty', async () => {
    // Guard: sent_back BEZ komentarza jest odrzucany.
    const noComment = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/approvals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `sendback-nocomment:${randomUUID()}`)
      .send({ decision: 'sent_back' });
    expect(noComment.status).toBe(400);
    expect(noComment.body.error).toBe('comment_required_for_send_back');

    // Wersja sesji TUŻ PRZED send-back (freeze sam w sobie bumpnął version
    // 4 -> 5, więc porównywać trzeba ze STANEM AKTUALNYM, nie z wersją
    // zarejestrowaną w momencie freeze — recordApproval stempluje
    // `session.version` z chwili WŁASNEGO wywołania, nie z freeze).
    const beforeSendBack = await request(app)
      .get(`/api/method/sessions/${rootSessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(beforeSendBack.status).toBe(200);
    const versionBeforeSendBack = beforeSendBack.body.session.version as number;
    expect(versionBeforeSendBack).toBe(v1VersionAtFreeze + 1); // freeze sam bumpnął o 1

    const sendBack = await request(app)
      .post(`/api/method/sessions/${rootSessionId}/approvals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `sendback:${randomUUID()}`)
      .send({ decision: 'sent_back', comment: 'T3: proszę doprecyzować dowód na osi 1A.' });
    expect(sendBack.status).toBe(201);
    expect(sendBack.body.approval.decision).toBe('sent_back');
    expect(sendBack.body.approval.revision).toBe(versionBeforeSendBack);
    // Udokumentowane zachowanie kernela: odpowiedź zwraca STARĄ sesję (nadal
    // 'frozen') — nowa rewizja dostaje NOWE id i nie jest zwracana tutaj.
    expect(sendBack.body.session.id).toBe(rootSessionId);
    expect(sendBack.body.session.state).toBe('frozen');
  });

  // ===========================================================================
  // 12. Nowa rewizja — odnaleziona WYŁĄCZNIE przez HTTP (GET /lineage), bez SQL
  // ===========================================================================
  it('12. Nowa rewizja: odnaleziona przez GET /sessions/:id/lineage (HTTP), role NIE są dziedziczone', async () => {
    const lineage = await request(app)
      .get(`/api/method/sessions/${rootSessionId}/lineage`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(lineage.status).toBe(200);
    expect(lineage.body.rootSessionId).toBe(rootSessionId);

    const revision = lineage.body.sessions.find(
      (s: { id: string; revisionOfSessionId: string | null; state: string }) =>
        s.revisionOfSessionId === rootSessionId && s.state === 'active'
    );
    expect(revision).toBeTruthy();
    revisionSessionId = revision.id as string;
    expect(revisionSessionId).not.toBe(rootSessionId);

    // Skład zespołu JEST dziedziczony przez nową rewizję.
    //
    // Ten test pierwotnie dokumentował brak dziedziczenia jako fakt (403
    // missing_permission tuż po reopenie). To był defekt, nie wymaganie:
    // po odesłaniu wyniku do poprawy nikt nie mógł kontynuować, dopóki ktoś
    // nie nadał ról od nowa. Naprawione w MethodSessionService — reopen kopiuje
    // bieżący skład na rewizję. Asercja jest teraz odwrotna.
    const rosterOnRevision = await request(app)
      .get(`/api/method/sessions/${revisionSessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(rosterOnRevision.status).toBe(200);
    const inheritedRoles = (rosterOnRevision.body.roles ?? []).map(
      (r: { userId: string; role: string }) => `${r.userId}:${r.role}`
    );
    expect(inheritedRoles.length).toBeGreaterThan(0);

    // Świadomie NIE wykonujemy tu przejścia stanu — zmieniłoby wersję sesji
    // i zepsuło dalsze kroki tej ścieżki. Dowodem dziedziczenia jest sam
    // roster; osobny test (`reopenCarriesRoster`) sprawdza, że przekłada się
    // on na uprawnienia do przejść.

    // Ponowne przypisanie ról na nowej rewizji — przez HTTP.
    const grantLead = await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: OWNER, role: 'lead_assessor' });
    // 201 = rola nadana; 200 = rola już odziedziczona przy reopenie i
    // przypisanie jest idempotentne. Oba są poprawne po naprawie dziedziczenia.
    expect([200, 201]).toContain(grantLead.status);

    const grantApprover = await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: APPROVER, role: 'approver' });
    expect([200, 201]).toContain(grantApprover.status);
  });

  // ===========================================================================
  // 13. Korekta na nowej rewizji + powrót do in_review
  // ===========================================================================
  it('13. Korekta na nowej rewizji: poprawiony wpis + nowy dowód na 1A, potem in_review', async () => {
    const revised = await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'ANSWER_REVISED',
        unitId: '1A',
        level: 4,
        payload: { questionId: 'q1A', answerState: 'revised', reason: 'T3: doprecyzowano po send back' },
      });
    expect(revised.status).toBe(201);

    const evidence = await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'EVIDENCE_ATTACHED',
        unitId: '1A',
        payload: { evidenceId: `ev-1a-rev-${randomUUID()}`, evidenceType: 'document', strength: 'E3' },
      });
    expect(evidence.status).toBe(201);

    const confirmed = await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'ANSWER_CONFIRMED',
        unitId: '1A',
        level: 4,
        payload: { questionId: 'q1A', answerState: 'confirmed' },
      });
    expect(confirmed.status).toBe(201);

    const confirmed1B = await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        type: 'ANSWER_CONFIRMED',
        unitId: '1B',
        level: 2,
        payload: { questionId: 'q1B', answerState: 'confirmed (niezmieniony)' },
      });
    expect(confirmed1B.status).toBe(201);

    const toInReview = await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/transition`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `transition:in_review:${randomUUID()}`)
      .send({ to: 'in_review' });
    expect(toInReview.status).toBe(200);
    expect(toInReview.body.session.state).toBe('in_review');
  });

  // ===========================================================================
  // 14. Approval (v2) — freeze na nowej rewizji, v1 nie jest nadpisany
  // ===========================================================================
  it('14. Approval na nowej rewizji tworzy Output v2; v1 istnieje nadal, teraz superseded', async () => {
    const approve = await request(app)
      .post(`/api/method/sessions/${revisionSessionId}/approvals`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('Idempotency-Key', `approve-v2:${randomUUID()}`)
      .send({ decision: 'approved' });
    expect(approve.status).toBe(201);
    expect(approve.body.session.state).toBe('frozen');

    const outputs = await request(app)
      .get(`/api/method/outputs?sessionId=${revisionSessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(outputs.status).toBe(200);
    expect(outputs.body.outputs).toHaveLength(1);
    v2OutputId = outputs.body.outputs[0].id as string;
    v2ContentHash = outputs.body.outputs[0].contentHash as string;
    expect(outputs.body.outputs[0].revisionOfOutputId).toBe(v1OutputId);
    expect(v2ContentHash).not.toBe(v1ContentHash); // realna korekta = realnie inna treść

    // v1 NIE jest nadpisany — nadal istnieje, treść identyczna jak w kroku 9/10.
    const v1Again = await request(app)
      .get(`/api/method/outputs/${v1OutputId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(v1Again.status).toBe(200);
    expect(v1Again.body.output.contentHash).toBe(v1ContentHash);

    // Rewizje: v1 = superseded, v2 = current — symetrycznie z obu id.
    const fromV1 = await request(app)
      .get(`/api/method/outputs/${v1OutputId}/revisions`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const fromV2 = await request(app)
      .get(`/api/method/outputs/${v2OutputId}/revisions`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(fromV1.status).toBe(200);
    expect(fromV2.status).toBe(200);
    expect(fromV1.body.total).toBe(2);
    expect(fromV1.body.revisions.map((r: { id: string }) => r.id).sort()).toEqual(
      fromV2.body.revisions.map((r: { id: string }) => r.id).sort()
    );
    const byId = new Map(fromV1.body.revisions.map((r: { id: string; status: string }) => [r.id, r.status]));
    expect(byId.get(v1OutputId)).toBe('superseded');
    expect(byId.get(v2OutputId)).toBe('current');
  });

  // ===========================================================================
  // 15-17. Report, Presentation, Initiative Proposal — na Outputcie v2
  // ===========================================================================
  it('15. Report: POST /outputs/:v2/report tworzy snapshot z realnej treści v2', async () => {
    const v2 = await request(app)
      .get(`/api/method/outputs/${v2OutputId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(v2.status).toBe(200);
    expect((v2.body.output.findings as unknown[]).length).toBeGreaterThan(0);

    const res = await request(app)
      .post(`/api/method/outputs/${v2OutputId}/report`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'T3 DRD Report v2', content: { executiveSummary: `Report for ${v2OutputId}` } });
    expect(res.status).toBe(201);
    reportId = res.body.report.id as string;
    expect(res.body.report.kind).toBe('report');
  });

  it('16. Presentation: POST /outputs/:v2/presentation tworzy snapshot z tej SAMEJ treści v2', async () => {
    const res = await request(app)
      .post(`/api/method/outputs/${v2OutputId}/presentation`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'T3 DRD Presentation v2', content: { executiveSummary: `Presentation for ${v2OutputId}` } });
    expect(res.status).toBe(201);
    presentationId = res.body.report.id as string; // route zwraca pod kluczem "report" niezależnie od kind
    expect(res.body.report.kind).toBe('presentation');
  });

  it('17. Initiative Proposal: POST /outputs/:v2/initiative-drafts z realnymi findingIds z v2', async () => {
    const v2 = await request(app)
      .get(`/api/method/outputs/${v2OutputId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const findingIds = (v2.body.output.findings as Array<{ id: string }>).map((f) => f.id);
    expect(findingIds.length).toBeGreaterThan(0);

    const res = await request(app)
      .post(`/api/method/outputs/${v2OutputId}/initiative-drafts`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'T3 DRD Initiative Proposal',
        findingIds,
        rationale: 'T3: luka na osi 1A wymaga inicjatywy naprawczej.',
        expectedOutcome: 'Podniesienie poziomu osi 1A do docelowego w kolejnym cyklu.',
        confidence: 'medium',
      });
    expect(res.status).toBe(201);
    draftId = res.body.draft.id as string;
    expect(res.body.draft.outputId).toBe(v2OutputId);
  });

  // ===========================================================================
  // 18. RESTART — druga, niezależna instancja Express; odnalezienie WSZYSTKICH
  //     artefaktów wyłącznie po id z bazy.
  // ===========================================================================
  it('18. RESTART: druga instancja aplikacji odnajduje i otwiera KAŻDY artefakt wyłącznie po id', async () => {
    const { default: methodCoreRoutesAgain } = await import('../../routes/method-core.routes.js');
    restartedApp = express();
    restartedApp.use(express.json());
    restartedApp.use('/api/method', methodCoreRoutesAgain);

    // -- sesje --------------------------------------------------------------
    const rootSession = await request(restartedApp)
      .get(`/api/method/sessions/${rootSessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(rootSession.status).toBe(200);
    expect(rootSession.body.session.state).toBe('frozen');

    const revisionSession = await request(restartedApp)
      .get(`/api/method/sessions/${revisionSessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(revisionSession.status).toBe(200);
    expect(revisionSession.body.session.state).toBe('frozen');

    const sessionsList = await request(restartedApp)
      .get(`/api/method/sessions?projectId=${PROJECT_ID}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(sessionsList.status).toBe(200);
    expect(sessionsList.body.sessions.map((s: { id: string }) => s.id).sort()).toEqual(
      [rootSessionId, revisionSessionId].sort()
    );

    // -- Outputy: hash porównany wprost z tabelą, NIE z wcześniejszą odpowiedzią HTTP --
    const dbV1 = await pool.query(`SELECT content_hash FROM method_outputs WHERE id = $1`, [v1OutputId]);
    const dbV2 = await pool.query(`SELECT content_hash FROM method_outputs WHERE id = $1`, [v2OutputId]);
    expect(dbV1.rows).toHaveLength(1);
    expect(dbV2.rows).toHaveLength(1);

    const v1AfterRestart = await request(restartedApp)
      .get(`/api/method/outputs/${v1OutputId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const v2AfterRestart = await request(restartedApp)
      .get(`/api/method/outputs/${v2OutputId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(v1AfterRestart.status).toBe(200);
    expect(v2AfterRestart.status).toBe(200);
    expect(v1AfterRestart.body.output.contentHash).toBe(dbV1.rows[0].content_hash);
    expect(v2AfterRestart.body.output.contentHash).toBe(dbV2.rows[0].content_hash);
    expect(v1AfterRestart.body.output.contentHash).toBe(v1ContentHash);
    expect(v2AfterRestart.body.output.contentHash).toBe(v2ContentHash);

    const revisions = await request(restartedApp)
      .get(`/api/method/outputs/${v1OutputId}/revisions`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(revisions.status).toBe(200);
    expect(revisions.body.total).toBe(2);

    // -- Report / Presentation / Initiative Draft ----------------------------
    const report = await request(restartedApp)
      .get(`/api/method/reports/${reportId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(report.status).toBe(200);
    expect(report.body.report.id).toBe(reportId);

    const presentation = await request(restartedApp)
      .get(`/api/method/presentations/${presentationId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(presentation.status).toBe(200);
    expect(presentation.body.presentation.id).toBe(presentationId);

    const draft = await request(restartedApp)
      .get(`/api/method/initiative-drafts/${draftId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(draft.status).toBe(200);
    expect(draft.body.draft.id).toBe(draftId);

    const reportsList = await request(restartedApp)
      .get(`/api/method/reports?sessionId=${revisionSessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(reportsList.body.reports.map((r: { id: string }) => r.id)).toContain(reportId);

    const presentationsList = await request(restartedApp)
      .get(`/api/method/presentations?sessionId=${revisionSessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(presentationsList.body.presentations.map((p: { id: string }) => p.id)).toContain(presentationId);

    const draftsList = await request(restartedApp)
      .get(`/api/method/initiative-drafts?sessionId=${revisionSessionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(draftsList.body.initiativeDrafts.map((d: { id: string }) => d.id)).toContain(draftId);
  });

  // ===========================================================================
  // 19. Lineage — pełen łańcuch, po restarcie
  // ===========================================================================
  it('19. Lineage (po restarcie): sesja -> rewizje -> Output -> Report/Presentation -> Initiative Proposal, kompletny łańcuch', async () => {
    const fromRoot = await request(restartedApp)
      .get(`/api/method/sessions/${rootSessionId}/lineage`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const fromRevision = await request(restartedApp)
      .get(`/api/method/sessions/${revisionSessionId}/lineage`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(fromRoot.status).toBe(200);
    expect(fromRevision.status).toBe(200);
    expect(fromRoot.body.rootSessionId).toBe(rootSessionId);
    expect(fromRevision.body.rootSessionId).toBe(rootSessionId);

    const sessionIds = fromRoot.body.sessions.map((s: { id: string }) => s.id).sort();
    expect(sessionIds).toEqual([rootSessionId, revisionSessionId].sort());
    expect(sessionIds).toEqual(fromRevision.body.sessions.map((s: { id: string }) => s.id).sort());

    const outputIds = fromRoot.body.outputs.map((o: { output: { id: string } }) => o.output.id).sort();
    expect(outputIds).toEqual([v1OutputId, v2OutputId].sort());

    const v1Node = fromRoot.body.outputs.find((o: { output: { id: string } }) => o.output.id === v1OutputId);
    const v2Node = fromRoot.body.outputs.find((o: { output: { id: string } }) => o.output.id === v2OutputId);
    expect(v1Node.status).toBe('superseded');
    expect(v1Node.supersededByOutputId).toBe(v2OutputId);
    expect(v1Node.reports).toEqual([]); // Report/Presentation/Draft powstały tylko na v2
    expect(v1Node.presentations).toEqual([]);
    expect(v1Node.initiativeDrafts).toEqual([]);

    expect(v2Node.status).toBe('current');
    expect(v2Node.reports.map((r: { id: string }) => r.id)).toEqual([reportId]);
    expect(v2Node.presentations.map((p: { id: string }) => p.id)).toEqual([presentationId]);
    expect(v2Node.initiativeDrafts.map((d: { id: string }) => d.id)).toEqual([draftId]);
  });

  // ===========================================================================
  // 20. Odrzucenie dostępu z innej organizacji — osobna asercja na KAŻDY artefakt
  // ===========================================================================
  it('20. Token z innej organizacji dostaje 403/404 na KAŻDYM artefakcie tej ścieżki, osobno', async () => {
    const rootSessionDenied = await request(restartedApp)
      .get(`/api/method/sessions/${rootSessionId}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(rootSessionDenied.status).toBe(403);

    const revisionSessionDenied = await request(restartedApp)
      .get(`/api/method/sessions/${revisionSessionId}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(revisionSessionDenied.status).toBe(403);

    const lineageDenied = await request(restartedApp)
      .get(`/api/method/sessions/${rootSessionId}/lineage`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(lineageDenied.status).toBe(403);

    const v1Denied = await request(restartedApp)
      .get(`/api/method/outputs/${v1OutputId}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(v1Denied.status).toBe(404);

    const v2Denied = await request(restartedApp)
      .get(`/api/method/outputs/${v2OutputId}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(v2Denied.status).toBe(404);

    const revisionsDenied = await request(restartedApp)
      .get(`/api/method/outputs/${v1OutputId}/revisions`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(revisionsDenied.status).toBe(404);

    const reportDenied = await request(restartedApp)
      .get(`/api/method/reports/${reportId}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(reportDenied.status).toBe(404);

    const presentationDenied = await request(restartedApp)
      .get(`/api/method/presentations/${presentationId}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(presentationDenied.status).toBe(404);

    const draftDenied = await request(restartedApp)
      .get(`/api/method/initiative-drafts/${draftId}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(draftDenied.status).toBe(404);

    // Listy: izolacja przez organizationId-scoping — 200 z zerem wyników,
    // nie 403/404 (inna semantyka niż odczyt po konkretnym id — te dwie
    // ścieżki są sprawdzone osobno, celowo).
    const outputsListDenied = await request(restartedApp)
      .get(`/api/method/outputs?sessionId=${rootSessionId}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);
    expect(outputsListDenied.status).toBe(200);
    expect(outputsListDenied.body.total).toBe(0);

    // Zapis też zablokowany dla innej organizacji.
    const roleWriteDenied = await request(restartedApp)
      .post(`/api/method/sessions/${rootSessionId}/roles`)
      .set('Authorization', `Bearer ${otherOrgToken}`)
      .send({ userId: OTHER_ORG_USER, role: 'observer' });
    expect(roleWriteDenied.status).toBe(403);

    const eventWriteDenied = await request(restartedApp)
      .post(`/api/method/sessions/${rootSessionId}/events`)
      .set('Authorization', `Bearer ${otherOrgToken}`)
      .send({ type: 'NOTE_ADDED', payload: { note: 'should never land' } });
    expect(eventWriteDenied.status).toBe(403);
  });
});
