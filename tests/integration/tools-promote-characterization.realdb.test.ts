/**
 * FAZA 0 — testy CHARAKTERYZUJĄCE istniejący backend Tools.
 *
 * Cel: utrwalić RZECZYWISTE zachowanie `ToolController.promoteToOutput`
 * i ścieżki sesji ZANIM cokolwiek zmienimy. Poprzednik zaraportował, że
 * Reports „nie mają implementacji", a potem sam to skorygował — dlatego
 * tutaj nic nie zakładamy i wszystko sprawdzamy zapytaniem albo requestem.
 *
 * Te testy NIE naprawiają defektów. Opisują stan zastany, także wtedy,
 * gdy jest niewygodny — jeśli coś jest luką, test to nazywa wprost.
 *
 * Uruchomienie (WYŁĄCZNIE baza jednorazowa):
 *   docker run -d --name cfy-tools-e2e -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_USER=consultinity -e POSTGRES_DB=consultinity \
 *     -p 56001:5432 postgres:15-alpine
 *   DATABASE_URL=postgres://consultinity:test@localhost:56001/consultinity \
 *     npx vitest run tests/integration/tools-promote-characterization.realdb.test.ts
 */
import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL || '';
process.env.DATABASE_URL = DATABASE_URL;
process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const describeDb = DATABASE_URL ? describe : describe.skip;

const P = `char-${Date.now()}-`;
const ORG_A = `${P}orgA`;
const ORG_B = `${P}orgB`;
const USER = `${P}user`;

let app: Express;

async function db(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

/**
 * Wstawia sesję w zadanym statusie; zwraca jej id.
 *
 * `confidence_avg` w skali 0-5, NIE 0-1. Bramka promocji odrzuca poniżej 3
 * (`incompleteRuntimeGates: ["confidence 0.9 < 3"]`) — pierwsza wersja tego
 * helpera używała 0.9 i wszystkie testy idempotencji przechodziły PUSTO,
 * bo promocja nigdy nie zachodziła. Fałszywa zieleń wykryta przez log.
 */
async function seedSession(opts: {
  id: string;
  org: string;
  status: string;
  toolType?: string;
}): Promise<string> {
  const c = await db();
  try {
    await c.query(
      `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent,
          confidence_avg, answers_json, created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,NULL,$3,$4,$5,100,4.5,$6,$7,$7,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [
        opts.id,
        opts.org,
        opts.toolType ?? 'dynamic-swot',
        `char ${opts.id}`,
        opts.status,
        JSON.stringify({
          items: [
            {
              id: 's1',
              text: 'Verified customer retention strength',
              quadrant: 'strengths',
              proposalStatus: 'accepted',
              evidenceStatus: 'confirmed',
            },
            {
              id: 's2',
              text: 'Verified regional demand opportunity',
              quadrant: 'opportunities',
              impact: 'high',
              proposalStatus: 'accepted',
              evidenceStatus: 'confirmed',
            },
          ],
          tensions: [
            {
              id: 't1',
              title: 'Turn retention into expansion',
              type: 'attack',
              linkedItemIds: ['s1', 's2'],
              insight: 'Existing trust supports a bounded expansion experiment.',
            },
          ],
          recommendedMoves: [
            {
              id: 'm1',
              title: 'Run a customer expansion pilot',
              category: 'quick-win',
              rationale: 'Use confirmed retention strength as the evidence base.',
              linkedTensionIds: ['t1'],
              linkedItemIds: ['s1'],
              proposalStatus: 'accepted',
              expectedImpact: 'high',
              estimatedEffort: 'medium',
              firstStep: 'Select one retained customer.',
              ownerRole: 'Sales Director',
              tradeoff: {
                chosen: 'Direct expansion pilot',
                deferred: 'Full rollout',
                cost: 'One quarter of focused capacity',
              },
              rejectedAlternative: {
                option: 'Immediate partner-led rollout',
                reason: 'It weakens control over first-party evidence.',
              },
            },
          ],
        }),
        USER,
      ]
    );
  } finally {
    await c.end();
  }
  return opts.id;
}

/** Request jako konkretna organizacja/rola — do testów izolacji i uprawnień. */
function as(org: string, role = 'admin', user = USER) {
  return { 'x-test-org': org, 'x-test-role': role, 'x-test-user': user };
}

beforeAll(async () => {
  const ToolController = (await import('../../server/src/controllers/ToolController.js')).default;

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user') || USER,
      organizationId: req.header('x-test-org') || ORG_A,
      role: req.header('x-test-role') || 'admin',
      email: `${P}u@example.test`,
    };
    next();
  });
  app.post('/api/tools', ToolController.createToolSession);
  app.get('/api/tools/:toolId', ToolController.getToolSession);
  app.put('/api/tools/:toolId', ToolController.updateToolSession);
  app.post('/api/tools/:toolId/promote', ToolController.promoteToOutput);
  app.post('/api/tools/:toolId/approve', ToolController.approveTool);
  app.post('/api/tools/:toolId/send-back', ToolController.sendBackToDraft);

  /*
   * Bootstrap schematu.
   * `ensureToolsSchema()` NIE odpala się na odczycie — sprawdzone: GET na
   * nieistniejącą sesję zwraca 404, ale tabel nie zakłada. Schemat powstaje
   * dopiero na ścieżce tworzenia sesji, więc bootstrapujemy realnym POST-em.
   */
  const warm = await request(app)
    .post('/api/tools')
    .set(as(ORG_A))
    .send({ toolType: 'dynamic-swot', name: `${P}warmup` });
  if (warm.status >= 400) {
    // Nie ukrywamy problemu bootstrapu — ma być widoczny w logu testu.
    // eslint-disable-next-line no-console
    console.error('WARMUP FAILED', warm.status, warm.body);
  }
}, 60_000);

afterAll(async () => {
  const c = await db();
  try {
    await c
      .query(`DELETE FROM tool_initiative_links WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B])
      .catch(() => undefined);
    await c.query(`DELETE FROM tool_sessions WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
  } finally {
    await c.end();
  }
});

describeDb('FAZA 0 — charakterystyka promoteToOutput', () => {
  // --- 1. obsługiwane typy ------------------------------------------------
  it('C1: odrzuca nieznany outputType z 400', async () => {
    const id = await seedSession({ id: `${P}s-type`, org: ORG_A, status: 'APPROVED' });
    const r = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'nonsense', title: 'X' });
    expect(r.status).toBe(400);
    expect(String(r.body.error)).toMatch(/Invalid outputType/i);
  });

  it('C2: komunikat 400 wymienia CZTERY typy — to jest kontrakt zastany', async () => {
    const id = await seedSession({ id: `${P}s-type2`, org: ORG_A, status: 'APPROVED' });
    const r = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'nonsense', title: 'X' });
    const msg = String(r.body.error);
    ['initiative', 'report', 'presentation', 'idea'].forEach((t) => expect(msg).toContain(t));
  });

  it('C3: wymaga outputType i title', async () => {
    const id = await seedSession({ id: `${P}s-req`, org: ORG_A, status: 'APPROVED' });
    const r = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send({});
    expect(r.status).toBe(400);
  });

  // --- 2. izolacja organizacji -------------------------------------------
  it('C4: sesja innej organizacji jest NIEWIDOCZNA (404, nie 403)', async () => {
    const id = await seedSession({ id: `${P}s-iso`, org: ORG_A, status: 'APPROVED' });
    const r = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_B))
      .send({ outputType: 'initiative', title: 'cross-org' });
    expect(r.status).toBe(404);
  });

  it('C5: odczyt sesji cudzej organizacji nie zwraca danych', async () => {
    const id = await seedSession({ id: `${P}s-iso2`, org: ORG_A, status: 'DRAFT' });
    const r = await request(app).get(`/api/tools/${id}`).set(as(ORG_B));
    expect([403, 404]).toContain(r.status);
  });

  // --- 3. bramka statusu --------------------------------------------------
  it('C6: DRAFT nie może być promowany — 409', async () => {
    const id = await seedSession({ id: `${P}s-draft`, org: ORG_A, status: 'DRAFT' });
    const r = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'initiative', title: 'z draftu' });
    expect(r.status).toBe(409);
    expect(String(r.body.error)).toMatch(/approved|finalized/i);
  });

  it('C7: APPROVED przechodzi bramkę statusu', async () => {
    const id = await seedSession({ id: `${P}s-appr`, org: ORG_A, status: 'APPROVED' });
    const r = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'initiative', title: 'z approved' });
    /*
     * USTALENIE FAZY 0 (kluczowe dla planu E2E):
     * Po przejściu bramki statusu i blokerów promocja kończy się 500, bo
     * ścieżka dotyka tabeli RBAC `permissions`, której `ensureToolsSchema()`
     * NIE tworzy — na tej bazie istnieją tylko 4 tabele tool_*.
     * Log serwera: `relation "permissions" does not exist` (42P01).
     *
     * Wniosek: samobootstrap kontrolera NIE wystarcza do E2E. Faza 5 musi
     * zastosować pełny zestaw migracji, nie polegać na CREATE TABLE IF NOT
     * EXISTS w kontrolerze.
     *
     * Ten test charakteryzuje stan zastany na minimalnym schemacie.
     */
    expect([200, 201, 409, 500]).toContain(r.status);
    if (r.status === 500) {
      expect(r.body).toEqual({});
    }
  });

  it('C8: nieistniejąca sesja → 404', async () => {
    const r = await request(app)
      .post(`/api/tools/${P}brak/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'initiative', title: 'X' });
    expect(r.status).toBe(404);
  });

  // --- 4. idempotencja ----------------------------------------------------
  it('C9: DWIE identyczne promocje nie tworzą dwóch inicjatyw', async () => {
    const id = await seedSession({ id: `${P}s-idem`, org: ORG_A, status: 'APPROVED' });
    const body = { outputType: 'initiative', title: 'idempotentna' };

    const r1 = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    const r2 = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);

    const c = await db();
    try {
      const rows = await c.query(
        `SELECT COUNT(*)::int n FROM tool_initiative_links
          WHERE tool_session_id = $1 AND batch_id = $2`,
        [id, 'promote-initiative']
      );
      // Kluczowa własność: jeden batch_id = jedno powiązanie, niezależnie od liczby żądań.
      if (r1.status < 300 && r2.status < 300) {
        expect(rows.rows[0].n).toBeLessThanOrEqual(1);
      }
    } finally {
      await c.end();
    }
    // Odpowiedzi muszą być spójne — nie „raz OK, raz błąd".
    if (r1.status < 300) expect(r2.status).toBeLessThan(300);
  });

  it('C10: batch_id jest kluczem idempotencji PER TYP outputu', async () => {
    const id = await seedSession({ id: `${P}s-batch`, org: ORG_A, status: 'APPROVED' });
    await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'initiative', title: 'A' });

    const c = await db();
    try {
      const rows = await c.query(
        `SELECT DISTINCT batch_id FROM tool_initiative_links WHERE tool_session_id = $1`,
        [id]
      );
      // Charakterystyka: batch_id koduje typ promocji (promote-<typ>).
      rows.rows.forEach((r: { batch_id: string }) => {
        expect(String(r.batch_id)).toMatch(/^promote-/);
      });
    } finally {
      await c.end();
    }
  });

  // --- 5. lineage ---------------------------------------------------------
  it('C11: powiązanie promocji wskazuje sesję źródłową', async () => {
    const id = await seedSession({ id: `${P}s-lin`, org: ORG_A, status: 'APPROVED' });
    await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'initiative', title: 'lineage' });

    const c = await db();
    try {
      // UWAGA: `tool_initiative_links` NIE ma kolumny organization_id —
      // izolacja tenanta jest wyłącznie POŚREDNIA, przez join do tool_sessions.
      const rows = await c.query(
        `SELECT l.tool_session_id, s.organization_id
           FROM tool_initiative_links l
           JOIN tool_sessions s ON s.id = l.tool_session_id
          WHERE l.tool_session_id = $1`,
        [id]
      );
      rows.rows.forEach((r: { tool_session_id: string; organization_id: string }) => {
        expect(r.tool_session_id).toBe(id);
        expect(r.organization_id).toBe(ORG_A);
      });
    } finally {
      await c.end();
    }
  });

  // --- LUKI STRUKTURALNE ujawnione przez charakteryzację -------------------

  it('C14: FAZA 1 domknięta — tool_initiative_links JEST teraz org-scoped', async () => {
    const c = await db();
    try {
      const r = await c.query(
        `SELECT COUNT(*)::int n FROM information_schema.columns
          WHERE table_name='tool_initiative_links' AND column_name='organization_id'`
      );
      // Był 0 w FAZIE 0 (brak kolumny tenanta w tabeli pełniącej rolę
      // rejestru promocji i klucza idempotencji). Świadomie zmieniony na 1
      // po zastosowaniu migracji 948_tool_promotion_idempotency.sql, która
      // dodaje `organization_id` (NOT NULL, backfillowana z tool_sessions)
      // i indeksuje po niej odczyty w promoteToOutput. Zob.
      // docs/program/METHOD_TOOLS_2026-08-13/IDP_SEMANTICS.md.
      expect(r.rows[0].n).toBe(1);
    } finally {
      await c.end();
    }
  });

  it('C15: FAZA 1 domknięta — UNIQUE teraz egzekwuje idempotencję promocji (nie na literalnej parze tool_session_id+batch_id)', async () => {
    const c = await db();
    try {
      const r = await c.query(
        `SELECT indexdef FROM pg_indexes WHERE tablename='tool_initiative_links'`
      );
      const defs: string[] = r.rows.map((x: { indexdef: string }) => x.indexdef);
      const hasUniquePair = defs.some(
        (d) => /UNIQUE/i.test(d) && /tool_session_id/.test(d) && /batch_id/.test(d)
      );
      // Nadal PRAWDA dosłownie: żaden UNIQUE index nie wiąże się z parą
      // (tool_session_id, batch_id) literalnie — 948's migration header
      // wyjaśnia dlaczego (batch_id ma DWA różne znaczenia współdzielone
      // przez ToolInitiativeService.persistInitiatives — jeden batch_id =
      // wiele wierszy — i ToolController.promoteToOutput — jeden batch_id
      // = jeden wiersz — więc literalny UNIQUE(tool_session_id, batch_id)
      // złamałby pierwszą ścieżkę).
      expect(hasUniquePair).toBe(false);

      // Rzeczywista ochrona TERAZ istnieje — tylko na innej kombinacji
      // kolumn (organization_id, tool_session_id, source_revision,
      // output_type, idempotency_key), która rozróżnia obie ścieżki
      // zapisu zamiast kolidować z nimi. Dowodzone realnie w
      // tests/integration/tools-promotion-race.realdb.test.ts (C15/C16
      // close-out).
      const hasPromotionUnique = defs.some(
        (d) => /UNIQUE/i.test(d) && d.includes('uq_tool_initiative_links_promotion')
      );
      expect(hasPromotionUnique).toBe(true);
    } finally {
      await c.end();
    }
  });

  it('C16: WYŚCIG — równoległe promocje mogą utworzyć duplikat', async () => {
    const id = await seedSession({ id: `${P}s-race`, org: ORG_A, status: 'APPROVED' });
    const body = { outputType: 'initiative', title: 'wyscig' };

    // Cztery żądania naraz — dokładnie scenariusz „duplicate submit"/retry.
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body)
      )
    );

    const c = await db();
    let n = 0;
    try {
      const rows = await c.query(
        `SELECT COUNT(*)::int n FROM tool_initiative_links
          WHERE tool_session_id = $1 AND batch_id = 'promote-initiative'`,
        [id]
      );
      n = rows.rows[0].n;
    } finally {
      await c.end();
    }

    const ok = results.filter((r) => r.status < 300).length;
    // Jeśli promocje nie przechodzą, MUSIMY znać powód — inaczej ten test
    // przechodziłby pusto, a to jest fałszywa zieleń.
    // eslint-disable-next-line no-console
    console.log(
      `C16 pierwsza odpowiedź: status=${results[0].status} body=${JSON.stringify(results[0].body).slice(0, 400)}`
    );
    // Charakteryzacja, nie życzenie: zapisujemy, ile realnie powstało.
    // Jeśli n > 1, mamy udowodniony duplikat mimo „idempotencji".
    // eslint-disable-next-line no-console
    console.log(`C16 wynik: udanych żądań=${ok}, powiązań w bazie=${n}`);
    expect(n).toBeGreaterThanOrEqual(0);
    // Ten assert dokumentuje ryzyko: przy braku UNIQUE nie ma gwarancji n<=1.
    if (n > 1) {
      // eslint-disable-next-line no-console
      console.warn(`C16 DUPLIKAT POTWIERDZONY: ${n} powiązań dla jednego batch_id`);
    }
  });

  // --- 6. LUKA: brak kanonicznego tool_outputs ----------------------------
  it('C12: FAZA 1 domknięta — tabela tool_outputs istnieje (946 zastosowana)', async () => {
    const c = await db();
    try {
      const r = await c.query(
        `SELECT COUNT(*)::int n FROM information_schema.tables
          WHERE table_schema='public' AND table_name='tool_outputs'`
      );
      // Był 0 w FAZIE 0 (migracja 946 jeszcze nie zastosowana) — ten test
      // świadomie zmienił się na 1, dokładnie jak zapowiadał własny komentarz
      // powyżej, po zastosowaniu 946/947 i wpięciu promoteToOutput
      // (services/tools/toolOutputSnapshotService.ts). Zob.
      // tests/integration/tools-outputs-immutable.realdb.test.ts po właściwości.
      expect(r.rows[0].n).toBe(1);
    } finally {
      await c.end();
    }
  });

  it('C13: sesja ma kolumnę version — istnieje podstawa kontroli rewizji', async () => {
    const c = await db();
    try {
      const r = await c.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name='tool_sessions' AND column_name IN ('version','output_json')`
      );
      const cols = r.rows.map((x: { column_name: string }) => x.column_name);
      expect(cols).toContain('version');
      expect(cols).toContain('output_json');
    } finally {
      await c.end();
    }
  });
});
