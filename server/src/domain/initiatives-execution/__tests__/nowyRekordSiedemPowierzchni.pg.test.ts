/** @vitest-environment node */

/**
 * §0.2e — pułapki (a)–(e), rozstrzygnięte i zmierzone w odbiorze
 * (`docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX1_INICJATYWY/96_ODBIOR_C2_E3_E5.md`
 * §1.5). Bez tego akapitu pomiar tego pliku NIE liczy się jako dowód —
 * zapisane tu jawnie, plus twarde asercje w `beforeAll` poniżej.
 *
 * (a) `ENABLE_V8_GLOBAL=true` — zmierzone w OBU przebiegach (ON i OFF):
 *     powierzchnie 4 i 6 (kokpit Realizacji, Wyniki) DALEJ dają 404, treść to
 *     `{"error":"Initiative <id> not found","code":"INITIATIVE_NOT_FOUND"}` —
 *     czyli bramka DOMENOWA (jedna z 50 pytających tabelę zastaną), nie
 *     `v8FeatureGate` (ten odcina przed uwierzytelnieniem i nie zna id).
 *     Pułapka (a) NIE fałszuje wyniku tego testu.
 * (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` — ustawione.
 *     Wynik powierzchni „Wyniki" bez zmian (404 domenowe). Nie fałszuje.
 * (c) `DB_TYPE='sqlite'` w `vitest.config.ts` jest DOMYŚLNE i omijane przez
 *     `MOCK_DB=false DB_TYPE=postgres` w env wywołania (config czyta
 *     `process.env.DB_TYPE || 'sqlite'`) — pilnowane asercją poniżej.
 * (d) `ENABLE_TEST_AUTH_BYPASS` — jawnie NIEUSTAWIONE/`false`; test podpisuje
 *     realny JWT `config.JWT_SECRET`, a `/api/auth/me` na tym tokenie zwraca
 *     200 z realnym użytkownikiem. Nie dotyczy tej ścieżki (brak obejścia).
 * (e) `409` z middleware zapisu — NIE DOTYCZY tego pakietu: test nie robi
 *     równoległych zapisów do tras zastanych, więc konflikt wersji (409) nie
 *     jest tu mierzony. To znana, jawnie nazwana luka — nie jest to jedna z
 *     siedmiu powierzchni czytania.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../../config/Config.js';
import { ApiGateway } from '../../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;

describe('CODEX1 E5 — nowy rekord z UI widoczny na siedmiu powierzchniach', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const initiativeId = `initiative-${randomUUID()}`;
  const proposalId = `proposal-${randomUUID()}`;
  const title = `CODEX1 E5 ${randomUUID()}`;
  let app: Express;
  let sql: Client | undefined;
  let authorization: string;

  beforeAll(async () => {
    // §0.2e (c): DB_TYPE musi być realnie 'postgres', nie fallback 'sqlite'.
    expect(process.env.DB_TYPE).toBe('postgres');
    // §0.2e (a): flaga globalna V8 musi być ustawiona zgodnie z macierzą zmierzoną w odbiorze.
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    // §0.2e (b): tryb widoczności Wyników musi być jawnie 'enforce'.
    expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce');
    // §0.2e (d): brak obejścia uwierzytelnienia — test polega na realnym JWT.
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(`INSERT INTO organizations(id,name,status) VALUES($1,'CODEX1 E5 org','active')`, [organizationId]);
    await sql.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'local-only','OWNER','active')`, [userId, organizationId, `${userId}@test.invalid`]);
    await sql.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`, [randomUUID(), organizationId, userId]);
    await sql.query(`INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,'CODEX1 E5 project',$3)`, [projectId, organizationId, userId]);
    authorization = `Bearer ${jwt.sign({ id: userId, userId, email: `${userId}@test.invalid`, organizationId, organization_id: organizationId, role: 'OWNER' }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' })}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  // FIX-E5-4 [96_ODBIOR_C2_E3_E5.md §3 poz. 10]: sprzątanie musi biec
  // BEZWARUNKOWO po `organizationId`, także gdy `beforeAll` padł w połowie
  // (np. po INSERT organizations, przed INSERT users). Przed tym FIX-em brak
  // try/finally zostawiał śmieci w bazie na każdym przerwanym setupie — na
  // kopii nieszkodliwe, na bazie współdzielonej to dane demo, które nie
  // znikają. Każdy DELETE ma teraz własny `.catch` (kolejny krok sprząta,
  // nawet gdy poprzedni padnie), a `sql.end()` jest w `finally`.
  afterAll(async () => {
    if (!sql) return;
    const client = sql;
    try {
      await client.query(`DELETE FROM ie_outbox_events WHERE organization_id=$1`, [organizationId]).catch(() => undefined);
      await client.query(`DELETE FROM ie_audit_events WHERE organization_id=$1`, [organizationId]).catch(() => undefined);
      await client.query(`DELETE FROM ie_command_receipts WHERE organization_id=$1`, [organizationId]).catch(() => undefined);
      await client.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]).catch(() => undefined);
      await client.query(`DELETE FROM projects WHERE id=$1`, [projectId]).catch(() => undefined);
      await client.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]).catch(() => undefined);
      await client.query(`DELETE FROM users WHERE id=$1`, [userId]).catch(() => undefined);
      await client.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]).catch(() => undefined);
    } finally {
      await client.end().catch(() => undefined);
    }
  });

  it('tworzy rekord droga API uzywana przez zapis UI i potwierdza SQL kanon=1 zastany=0', async () => {
    if (!sql) throw new Error('beforeAll nie ustanowił połączenia SQL.');
    const sourceId = `manual-hub-${randomUUID()}`;
    const submit = await request(app).post('/api/initiatives/runtime-v1/source-proposals').set('Authorization', authorization).send({
      proposalId, expectedVersion: 0, clientRequestId: `submit-${randomUUID()}`, sourceType: 'MANUAL_HUB', sourceId, sourceVersion: 1,
      provenance: { system: 'consultify.initiatives-hub', recordType: 'manual-initiative-proposal', capturedAt: new Date().toISOString(), evidenceRefs: [`consultify://initiatives/source-proposals/${proposalId}`] },
      title, problem: 'Dowod E5', proposedOutcome: null, priority: 'MEDIUM', projectId, initiativeOwnerId: userId, visibility: 'PROJECT',
    });
    expect(submit.status, JSON.stringify(submit.body)).toBe(201);
    const register = await request(app).post('/api/initiatives/runtime-v1/registrations').set('Authorization', authorization).send({
      initiativeId, expectedVersion: 0, clientRequestId: `register-${randomUUID()}`, proposalId, proposalVersion: 1,
      sourceType: 'MANUAL_HUB', sourceId, sourceVersion: 1, title, problem: 'Dowod E5', proposedOutcome: null,
      priority: 'MEDIUM', projectId, visibility: 'PROJECT', initiativeOwnerId: userId,
    });
    expect(register.status, JSON.stringify(register.body)).toBe(201);
    const counts = await sql.query(`SELECT (SELECT count(*)::int FROM ie_aggregate_state WHERE aggregate_type='initiative' AND aggregate_id=$1) kanon, (SELECT count(*)::int FROM initiatives WHERE id=$1) zastany`, [initiativeId]);
    expect(counts.rows[0]).toEqual({ kanon: 1, zastany: 0 });
  });

  it('mierzy tresc siedmiu tras powierzchni bez zaliczania pustej koperty', async () => {
    const calls = [
      ['lista', '/api/initiatives'],
      ['karta', `/api/initiatives/${initiativeId}`],
      ['KPI', `/api/initiatives/${initiativeId}/kpis`],
      ['kokpit Realizacji', `/api/v8/execution-control/capacity/timeline?initiativeId=${initiativeId}`],
      ['Moja Praca', '/api/my-work/executive-analytics'],
      ['Wyniki', `/api/v8/results/dashboard?initiativeId=${initiativeId}`],
      ['raporty', `/api/report-builder/backlinks/initiative/${initiativeId}`],
    ] as const;
    // FIX-E5-3 [96_ODBIOR_C2_E3_E5.md §3 poz. 9]: kontrakt przypisał kryterium
    // "treść" (id+tytuł w ciele) do sześciu tras, ale kontrakt nazywał
    // powierzchnię KPI kryterium SŁABYM ("Wyniki" w instrukcji, nie KPI) —
    // odpowiedź `{"kpis":[]}` dziś nie niesie ani id, ani tytułu. Każdy
    // wiersz macierzy niesie odtąd jawną etykietę `kryterium`, a liczenie
    // "widoczne" jest rozbite na dwie kategorie zamiast jednego myślącego
    // razem wskaźnika.
    const matrix: Array<{
      surface: string;
      route: string;
      status: number;
      containsId: boolean;
      containsTitle: boolean;
      visible: boolean;
      kryterium: 'tresc' | 'brak-404';
      error?: string;
    }> = [];
    for (const [surface, route] of calls) {
      const kryterium: 'tresc' | 'brak-404' = surface === 'KPI' ? 'brak-404' : 'tresc';
      try {
        const response = await request(app).get(route).set('Authorization', authorization).timeout({ response: 5_000, deadline: 7_000 });
        const body = JSON.stringify(response.body);
        const containsId = body.includes(initiativeId);
        const containsTitle = body.includes(title);
        const visible = kryterium === 'brak-404'
          ? response.status === 200 && !body.includes('INITIATIVE_NOT_FOUND')
          : response.status === 200 && containsTitle;
        matrix.push({ surface, route, status: response.status, containsId, containsTitle, visible, kryterium });
      } catch (error) {
        matrix.push({ surface, route, status: 0, containsId: false, containsTitle: false, visible: false, kryterium, error: error instanceof Error ? error.message : String(error) });
      }
    }
    console.log(`CODEX1_E5_MATRIX=${JSON.stringify(matrix)}`);
    if (process.env.CODEX1_E5_MATRIX_OUTPUT) {
      fs.writeFileSync(process.env.CODEX1_E5_MATRIX_OUTPUT, JSON.stringify(matrix, null, 2) + '\n');
    }
    const visibleByContent = matrix.filter((row) => row.kryterium === 'tresc' && row.visible).map((row) => row.surface);
    const visibleWeak = matrix.filter((row) => row.kryterium === 'brak-404' && row.visible).map((row) => row.surface);
    const visible = matrix.filter((row) => row.visible).map((row) => row.surface);
    console.log(
      `CODEX1_E5_SUMMARY=${visibleByContent.length}/7 po tresci + ${visibleWeak.length}/7 po kryterium slabym (KPI) — surowa suma ${visible.length}/7`
    );

    // FIX-E5-1 (BLOKUJE) [96_ODBIOR_C2_E3_E5.md §3 poz. 7]: PRZED tym FIX-em
    // `expect(visible).toEqual(ON ? ['lista','karta','KPI'] : [])` przybijał
    // STAN ZASTANY — test był zielony DZIŚ i zrobiłby się CZERWONY dokładnie
    // wtedy, gdy ktoś podłączy powierzchnię 4/5/6/7 (karze za postęp). Plik
    // jest zbierany przez domyślną suitę (`vitest.config.ts` glob
    // `server/src/**/__tests__/*.{test,spec}.*`), więc trafiał do bramki CI.
    //
    // Naprawa: asercja CELU sprawdza WYŁĄCZNIE podzbiór — "co najmniej te
    // trzy widoczne przy ON" — więc podłączenie kolejnej powierzchni (4-7)
    // NIE czerwieni suity. Dług jest widoczny osobno w `it.todo` poniżej,
    // nie w tej asercji.
    if (process.env.ENABLE_INITIATIVE_UNIFIED_READ === 'true') {
      expect(visibleByContent, JSON.stringify(matrix)).toEqual(expect.arrayContaining(['lista', 'karta']));
      expect(visibleWeak, JSON.stringify(matrix)).toEqual(expect.arrayContaining(['KPI']));
      expect(visible, JSON.stringify(matrix)).toEqual(expect.arrayContaining(['lista', 'karta', 'KPI']));
    } else {
      // OFF jest linią bazową PRODUKTOWĄ (flaga wyłączona = czytnik unified
      // nic nie pokazuje), nie stanem zastanym do odmrożenia — dlatego tu
      // zostaje równość ścisła, w przeciwieństwie do gałęzi ON powyżej.
      expect(visible, JSON.stringify(matrix)).toEqual([]);
    }
  });

  // FIX-E5-1: dług jawnie nazwany i widoczny w raporcie testów (status
  // "todo"), zamiast być ukryty w przybitej asercji, którą trzeba by
  // rozbroić ręcznie przy każdym podłączeniu kolejnej powierzchni.
  it.todo(
    'powierzchnie 4-7: kokpit Realizacji, Moja Praca, Wyniki, raporty — NIEPODŁĄCZONE (dług, blok część zapisowa)'
  );
});
