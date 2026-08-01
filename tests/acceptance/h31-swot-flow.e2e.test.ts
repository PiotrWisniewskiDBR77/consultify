/**
 * Acceptance E2E — H3.1 dowód literalny: pełny cykl SWOT (dynamic-swot) przez
 * REALNY ToolController.
 *
 * REALNY runtime, zero LLM (czysta mechanika):
 *  - CREATE  POST /api/tools (real router `server/src/routes/tools.routes.ts`,
 *            real `verifyToken`, real `ToolController.createToolSession`) —
 *            toolType `dynamic-swot` (kebab-case identyczny jak w
 *            `ACTIVE_KNOWN_TOOL_TYPES` / realnym froncie, NIE camelCase).
 *  - SAVE 1  PUT /api/tools/:id — zapis 4 kwadrantów SWOT (S/W/O/T), 2 realne
 *            itemy na kwadrant, wszystkie `proposalStatus:'accepted'`.
 *  - RELOAD  GET /api/tools/:id — dowód że 8 itemów / 4 kwadranty przetrwały
 *            round-trip przez Postgres.
 *  - SAVE 2  PUT /api/tools/:id — W2 CONCLUSION_LAYER: napięcia SO/WO/ST/WT
 *            (policzone REALNYM `deriveTensionCandidates` z
 *            `src/config/swot/swotTensionEngine.ts`, nie ręcznie wymyślone),
 *            ruchy (moves) z obowiązkowym rationale+tradeoff+rejectedAlternative,
 *            oraz `answers.summary.{verdict,executiveSummary,tradeoffs}` — kształt
 *            czytany przez `toolConclusionBridge.ts`.
 *  - RELOAD  GET /api/tools/:id — dowód że komplet (items+tensions+moves+summary)
 *            wrócił bez strat.
 *  - GATE    Te same zapisane dane przepuszczone przez REALNĄ bramkę narzędzia
 *            (`computeTensionCoverage` / `validateMoveSet`, ten sam moduł co
 *            UI review-gate) — dowód że W2 nie jest tylko poprawnym JSON-em,
 *            tylko faktycznie przechodzi walidację narzędzia.
 *  - DB      CONCLUSION_LAYER bridge (fire-and-forget w `updateToolSession`)
 *            wylądował w tabeli `conclusions` (sourceModule='tool'), z
 *            confidenceLevel='high' (8+4+2=14 zaakceptowanych elementów
 *            evidence, confidenceAvg=4).
 *
 * Izolacja: prefiks `odbior--h31--`. Sprzątanie w afterAll. NIE push.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  computeTensionCoverage,
  deriveTensionCandidates,
  validateMoveSet,
} from '../../src/config/swot/swotTensionEngine';
import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--h31--';
const ORG_B_ID = `${PREFIX}org-b`;
const USER_B_ID = `${PREFIX}user-b`;
const USER_B_EMAIL = `${PREFIX}owner-b@acceptance.local`;

function evidence(line: string): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

async function buildToolsApp(): Promise<Express> {
  const toolsRouter = (await import('../../server/src/routes/tools.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/tools', toolsRouter);
  return app;
}

let toolsApp: Express;
let token: string;

const createdToolSessionIds: string[] = [];
const createdConclusionIds: string[] = [];

beforeAll(async () => {
  await seed(); // idempotent — org/user/membership odbioru
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, $3)
       ON CONFLICT (id) DO NOTHING`,
      [ORG_B_ID, 'H31 cross-tenant org B', now]
    );
    await client.query(
      `INSERT INTO users
         (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'not-used-by-token-auth', 'ADMIN', 'active', 'H31', 'OrgB', $4)
       ON CONFLICT (id) DO NOTHING`,
      [USER_B_ID, ORG_B_ID, USER_B_EMAIL, now]
    );
    await client.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       SELECT $1, $2, $3, 'OWNER', 'ACTIVE', $4
       WHERE NOT EXISTS (
         SELECT 1 FROM organization_members WHERE organization_id = $2 AND user_id = $3
       )`,
      [`${PREFIX}membership-b`, ORG_B_ID, USER_B_ID, now]
    );
  } finally {
    await client.end();
  }
  toolsApp = await buildToolsApp();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    if (createdConclusionIds.length) {
      await client.query('DELETE FROM conclusions WHERE id = ANY($1)', [createdConclusionIds]);
    }
    if (createdToolSessionIds.length) {
      await client
        .query('DELETE FROM tool_initiative_links WHERE tool_session_id = ANY($1)', [
          createdToolSessionIds,
        ])
        .catch(() => {});
      await client
        .query('DELETE FROM tool_decisions WHERE tool_session_id = ANY($1)', [
          createdToolSessionIds,
        ])
        .catch(() => {});
      await client.query('DELETE FROM tool_sessions WHERE id = ANY($1)', [createdToolSessionIds]);
    }
    await client.query('DELETE FROM organization_members WHERE organization_id = $1', [ORG_B_ID]);
    await client.query('DELETE FROM users WHERE id = $1', [USER_B_ID]);
    await client.query('DELETE FROM organizations WHERE id = $1', [ORG_B_ID]);
  } finally {
    await client.end();
  }
}, 30_000);

// ===========================================================================
// H3.1 — pełny cykl SWOT: create → 4 kwadranty → reload → W2 → reload → gate → DB
// ===========================================================================
describe('H3.1 — dynamic-swot pełny cykl e2e (real router + auth + DB + engine gate)', () => {
  it('creates a dynamic-swot session, saves all 4 quadrants, reloads, saves a validated W2 (tensions+moves+summary), reloads complete, passes the real tool gate, and the conclusion lands in `conclusions`', async () => {
    // -------------------------------------------------------------------
    // 1) CREATE — POST /api/tools
    // -------------------------------------------------------------------
    const createRes = await request(toolsApp)
      .post('/api/tools')
      .set('Authorization', `Bearer ${token}`)
      .send({ toolType: 'dynamic-swot', name: `${PREFIX}swot-session` });

    expect(createRes.status).toBe(200);
    const sessionId: string = createRes.body?.id;
    expect(sessionId).toBeTruthy();
    expect(createRes.body?.status).toBe('DRAFT');
    createdToolSessionIds.push(sessionId);
    evidence(`[h31] created tool_sessions.id=${sessionId} toolType=dynamic-swot`);

    // -------------------------------------------------------------------
    // 2) SAVE 1 — PUT: 4 kwadranty, 2 realne itemy każdy, wszystkie accepted.
    // -------------------------------------------------------------------
    const items = [
      {
        id: 'h31-s1',
        text: 'Silna pozycja rynkowa — segment B2B odpowiada za 61% przychodu grupy',
        impact: 'high',
        quadrant: 'strengths',
        source: 'user',
        confidence: 4,
        proposalStatus: 'accepted',
      },
      {
        id: 'h31-s2',
        text: 'Zespół R&D z 12-letnim doświadczeniem branżowym i własnym laboratorium',
        impact: 'medium',
        quadrant: 'strengths',
        source: 'user',
        confidence: 4,
        proposalStatus: 'accepted',
      },
      {
        id: 'h31-w1',
        text: 'Przestarzały system ERP ogranicza raportowanie w czasie rzeczywistym',
        impact: 'high',
        quadrant: 'weaknesses',
        source: 'user',
        confidence: 4,
        proposalStatus: 'accepted',
      },
      {
        id: 'h31-w2',
        text: 'Rotacja w dziale sprzedaży sięga 28% rocznie',
        impact: 'medium',
        quadrant: 'weaknesses',
        source: 'user',
        confidence: 3,
        proposalStatus: 'accepted',
      },
      {
        id: 'h31-o1',
        text: 'Popyt na automatyzację w segmencie MŚP rośnie o 18% rok do roku',
        impact: 'high',
        quadrant: 'opportunities',
        source: 'user',
        confidence: 4,
        proposalStatus: 'accepted',
      },
      {
        id: 'h31-o2',
        text: 'Dotacje UE na transformację cyfrową dostępne do 2027 roku',
        impact: 'medium',
        quadrant: 'opportunities',
        source: 'user',
        confidence: 3,
        proposalStatus: 'accepted',
      },
      {
        id: 'h31-t1',
        text: 'Dwóch nowych konkurentów regionalnych oferuje ceny niższe o 15%',
        impact: 'high',
        quadrant: 'threats',
        source: 'user',
        confidence: 4,
        proposalStatus: 'accepted',
      },
      {
        id: 'h31-t2',
        text: 'Rosnące koszty energii obniżają marżę produkcyjną',
        impact: 'medium',
        quadrant: 'threats',
        source: 'user',
        confidence: 3,
        proposalStatus: 'accepted',
      },
    ] as const;

    const save1Res = await request(toolsApp)
      .put(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'IN_PROGRESS',
        completionPercent: 40,
        confidenceAvg: 3,
        answers: { items },
      });

    expect(save1Res.status).toBe(200);
    expect(save1Res.body?.id).toBe(sessionId);
    evidence(`[h31] SAVE 1 (4 kwadranty, 8 itemów) ok, status=${save1Res.body?.status}`);

    // -------------------------------------------------------------------
    // 3) RELOAD 1 — GET: dowód że 4 kwadranty przetrwały round-trip.
    // -------------------------------------------------------------------
    const reload1Res = await request(toolsApp)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(reload1Res.status).toBe(200);
    const reloadedItems: typeof items extends readonly (infer U)[] ? U[] : never =
      reload1Res.body?.answers?.items || [];
    expect(reloadedItems).toHaveLength(8);
    const byQuadrant: Record<string, number> = {};
    for (const it of reloadedItems) {
      byQuadrant[(it as any).quadrant] = (byQuadrant[(it as any).quadrant] || 0) + 1;
    }
    expect(byQuadrant).toEqual({
      strengths: 2,
      weaknesses: 2,
      opportunities: 2,
      threats: 2,
    });
    evidence(
      `[h31] RELOAD 1 OK — 4 kwadranty potwierdzone: S=${byQuadrant.strengths} W=${byQuadrant.weaknesses} O=${byQuadrant.opportunities} T=${byQuadrant.threats}`
    );

    // -------------------------------------------------------------------
    // 4) W2 — napięcia POLICZONE realnym silnikiem (nie ręcznie wymyślone).
    // -------------------------------------------------------------------
    const tensionCandidates = deriveTensionCandidates(reloadedItems as any, 1);
    expect(tensionCandidates).toHaveLength(4); // dokładnie SO, WO, ST, WT
    expect(tensionCandidates.map((c) => c.type)).toEqual(['SO', 'WO', 'ST', 'WT']);

    const tensions = tensionCandidates.map((c, idx) => ({
      id: `h31-tension-${idx + 1}`,
      title: c.titlePl,
      type: c.posture,
      linkedCorrelationIds: [] as string[],
      linkedItemIds: c.linkedItemIds,
      insight: `Napięcie ${c.type}: elementy ${c.linkedItemIds.join(' + ')} tworzą konkretną implikację strategiczną wymagającą decyzji zarządu.`,
      whyNow: 'Presja konkurencyjna i zbliżający się cykl budżetowy Q3 wymagają decyzji w tym kwartale.',
      confidence: 4,
      proposalStatus: 'accepted',
    }));
    const tensionByType = Object.fromEntries(
      tensionCandidates.map((c, idx) => [c.type, tensions[idx]])
    ) as Record<'SO' | 'WO' | 'ST' | 'WT', (typeof tensions)[number]>;

    const moves = [
      {
        id: 'h31-move-1',
        title: 'Uruchom program retencji top klientów B2B',
        category: 'quick-win',
        rationale:
          'Broni 61% przychodu z segmentu B2B (h31-s1) przed dwoma nowymi konkurentami regionalnymi oferującymi ceny niższe o 15% (h31-t1) — napięcie ST wskazuje obronę siłą jako priorytet.',
        linkedTensionIds: [tensionByType.ST.id],
        linkedItemIds: ['h31-s1', 'h31-t1'],
        expectedImpact: 'high',
        estimatedEffort: 'medium',
        riskLevel: 'low',
        confidence: 4,
        firstStep:
          'Dyrektor Sprzedaży uruchamia program lojalnościowy dla top 20 klientów B2B do końca miesiąca',
        proposalStatus: 'accepted',
        tradeoff: {
          chosen: 'Skupienie zasobów Q3 na retencji obecnych klientów B2B',
          deferred: 'Ekspansja na nowe segmenty rynku w tym samym kwartale',
          cost: 'Wolniejszy przyrost liczby nowych klientów przez jeden kwartał',
        },
        rejectedAlternative: {
          option: 'Obniżka cen w odpowiedzi na konkurencję regionalną',
          reason: 'Erodowałaby marżę bez gwarancji utrzymania klientów — konkurenci mogą przebić każdą obniżkę',
        },
        whyFirst: 'Blokuje największe ryzyko odpływu przychodu, zanim skalujemy inne inicjatywy',
        ownerRole: 'Dyrektor Sprzedaży',
      },
      {
        id: 'h31-move-2',
        title: 'Wymień moduł raportowania ERP przed skalowaniem automatyzacji MŚP',
        category: 'capability-build',
        rationale:
          'Przestarzały ERP (h31-w1) blokuje wykorzystanie rosnącego popytu na automatyzację w MŚP, +18% r/r (h31-o1) — napięcie WO wskazuje naprawę jako warunek sięgnięcia po szansę.',
        linkedTensionIds: [tensionByType.WO.id],
        linkedItemIds: ['h31-w1', 'h31-o1'],
        expectedImpact: 'high',
        estimatedEffort: 'high',
        riskLevel: 'medium',
        confidence: 3,
        firstStep:
          'CTO zamawia wdrożenie modułu raportowania czasu rzeczywistego do końca Q4',
        proposalStatus: 'accepted',
        tradeoff: {
          chosen: 'Naprawa fundamentu raportowania ERP przed nowymi kontraktami MŚP',
          deferred: 'Przyjmowanie nowych kontraktów MŚP w bieżącym kwartale',
          cost: 'Odroczony przychód z segmentu MŚP o jeden kwartał',
        },
        rejectedAlternative: {
          option: 'Ręczne raportowanie tymczasowe zamiast wymiany modułu ERP',
          reason: 'Nie skaluje się przy wzroście +18% r/r i mnoży ryzyko błędów danych klienta',
        },
        whyFirst: 'Bez naprawy ERP każdy nowy kontrakt MŚP pogłębia dług operacyjny',
        ownerRole: 'CTO',
      },
    ];

    // -------------------------------------------------------------------
    // 4a) GATE (pre-save) — te same dane przez REALNĄ bramkę narzędzia.
    // -------------------------------------------------------------------
    const coveragePre = computeTensionCoverage(reloadedItems as any, tensions as any);
    expect(coveragePre.covered.sort()).toEqual(['SO', 'ST', 'WO', 'WT']);
    expect(coveragePre.missing).toHaveLength(0);
    expect(coveragePre.structurallyEmpty).toHaveLength(0);

    const moveGatePre = validateMoveSet(moves as any, reloadedItems as any, tensions as any);
    if (!moveGatePre.ok) {
      evidence(`[h31] RED — pre-save move gate failed: ${JSON.stringify(moveGatePre.perMove)}`);
    }
    expect(moveGatePre.ok).toBe(true);
    evidence(
      `[h31] W2 gate (pre-save) OK — coverage 4/4 (${coveragePre.covered.join(',')}), ${moves.length} moves pass rationale+tradeoff+rejectedAlternative`
    );

    // -------------------------------------------------------------------
    // 5) SAVE 2 — PUT: pełny answers (items + tensions + moves + summary).
    //    Uwaga: PUT zastępuje CAŁE `answers` — items muszą wrócić w tym samym
    //    payloadzie, inaczej zostałyby wyzerowane (partial-update semantyka
    //    dotyczy KOLUMN, nie kluczy wewnątrz answers_json).
    // -------------------------------------------------------------------
    const verdict =
      'Przewaga w segmencie B2B (61% przychodu) wymaga obrony marży, zanim konkurenci regionalni z cenami niższymi o 15% przejmą kontrakty.';
    const executiveSummary =
      'Analiza SWOT pokazuje, że rosnący popyt na automatyzację w MŚP (+18% r/r) otwiera realną szansę wzrostu, ale przestarzały system ERP i rotacja sprzedaży sięgająca 28% rocznie ograniczają zdolność organizacji do jej wykorzystania bez wcześniejszej naprawy fundamentów operacyjnych.';
    const summary = {
      verdict,
      executiveSummary,
      tradeoffs: [
        {
          chosen: 'Obrona segmentu B2B i naprawa ERP przed ekspansją na nowe segmenty',
          rejected: 'Natychmiastowa ekspansja na nowe segmenty rynku',
          why: 'Bez stabilnego raportowania ERP ekspansja pomnożyłaby istniejące błędy operacyjne zamiast skalować przewagę',
        },
      ],
    };

    const save2Res = await request(toolsApp)
      .put(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        completionPercent: 90,
        confidenceAvg: 4,
        answers: { items: reloadedItems, tensions, moves, summary },
      });

    expect(save2Res.status).toBe(200);
    expect(save2Res.body?.id).toBe(sessionId);
    evidence(`[h31] SAVE 2 (W2: tensions+moves+summary) ok`);

    // -------------------------------------------------------------------
    // 6) RELOAD 2 — GET: dowód że komplet wrócił bez strat.
    // -------------------------------------------------------------------
    const reload2Res = await request(toolsApp)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(reload2Res.status).toBe(200);
    const finalAnswers = reload2Res.body?.answers || {};
    expect(finalAnswers.items).toHaveLength(8);
    expect(finalAnswers.tensions).toHaveLength(4);
    expect(finalAnswers.moves).toHaveLength(2);
    expect(finalAnswers.summary?.verdict).toBe(verdict);
    expect(finalAnswers.summary?.executiveSummary).toBe(executiveSummary);
    expect(finalAnswers.summary?.tradeoffs).toHaveLength(1);
    evidence(
      `[h31] RELOAD 2 OK — komplet: items=${finalAnswers.items.length} tensions=${finalAnswers.tensions.length} moves=${finalAnswers.moves.length} summary.verdict="${finalAnswers.summary.verdict.slice(0, 60)}..."`
    );

    // -------------------------------------------------------------------
    // 6a) GATE (post-reload) — dowód że TO CO WRÓCIŁO Z DB nadal przechodzi
    //     realną bramkę narzędzia (nie tylko to co wysłaliśmy).
    // -------------------------------------------------------------------
    const coveragePost = computeTensionCoverage(finalAnswers.items, finalAnswers.tensions);
    expect(coveragePost.covered.sort()).toEqual(['SO', 'ST', 'WO', 'WT']);
    const moveGatePost = validateMoveSet(
      finalAnswers.moves,
      finalAnswers.items,
      finalAnswers.tensions
    );
    if (!moveGatePost.ok) {
      evidence(`[h31] RED — post-reload move gate failed: ${JSON.stringify(moveGatePost.perMove)}`);
    }
    expect(moveGatePost.ok).toBe(true);
    evidence('[h31] W2 gate (post-reload) OK — dane z DB nadal przechodzą realną bramkę narzędzia');

    // -------------------------------------------------------------------
    // 7) CONCLUSION (W2 bridge) — poll `conclusions` (fire-and-forget async).
    // -------------------------------------------------------------------
    const client = pgClient();
    await client.connect();
    try {
      let row: any = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const res = await client.query(
          `SELECT id, title, statement, confidence_level, status
           FROM conclusions
           WHERE organization_id = $1 AND source_module = 'tool'
             AND source_artifact_refs_json LIKE $2
           LIMIT 1`,
          [SEED.ORG_ID, `%${sessionId}%`]
        );
        if (res.rows.length) {
          row = res.rows[0];
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }

      expect(row).not.toBeNull();
      expect(row.id).toBeTruthy();
      expect(row.statement).toContain(verdict);
      expect(row.confidence_level).toBe('high'); // 14 accepted evidence els, confidenceAvg=4
      createdConclusionIds.push(row.id);
      evidence(
        `[h31] W2 conclusion persisted — conclusions.id=${row.id} status=${row.status} confidenceLevel=${row.confidence_level} statement.length=${row.statement.length}`
      );

      // -----------------------------------------------------------------
      // 8) TENANT ISOLATION — a real second org cannot read or overwrite the
      //    session, and cannot see the derived conclusion.
      // -----------------------------------------------------------------
      const tokenB = mintToken({
        id: USER_B_ID,
        email: USER_B_EMAIL,
        organizationId: ORG_B_ID,
        organization_id: ORG_B_ID,
        role: 'OWNER',
      });
      const foreignRead = await request(toolsApp)
        .get(`/api/tools/${sessionId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(foreignRead.status).toBe(404);

      const foreignWrite = await request(toolsApp)
        .put(`/api/tools/${sessionId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ answers: { summary: { verdict: 'FOREIGN OVERWRITE' } } });
      expect(foreignWrite.status).toBe(404);

      const foreignConclusions = await client.query(
        `SELECT id FROM conclusions
         WHERE organization_id = $1 AND source_module = 'tool'
           AND source_artifact_refs_json LIKE $2`,
        [ORG_B_ID, `%${sessionId}%`]
      );
      expect(foreignConclusions.rows).toHaveLength(0);

      const ownerAfterAttack = await request(toolsApp)
        .get(`/api/tools/${sessionId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(ownerAfterAttack.status).toBe(200);
      expect(ownerAfterAttack.body?.answers?.summary?.verdict).toBe(verdict);
      evidence('[h31] tenant isolation OK — org B read/write 404, no conclusion leak, owner data unchanged');
    } finally {
      await client.end();
    }
  });
});
