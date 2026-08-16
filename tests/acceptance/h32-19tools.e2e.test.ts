/**
 * Acceptance E2E — H3.2 mechanics for owner-approved Active Discovery Tools.
 *
 * REALNY runtime, zero mocków logiki biznesowej, zero LLM:
 *  - The list comes from the owner-approved runtime registry consumed by
 *    `KnownToolsService`, so this acceptance test cannot resurrect built but
 *    commercially/provenance-unapproved tools.
 *  - REALNY router `server/src/routes/tools.routes.ts`
 *    (ToolController.createToolSession/updateToolSession/getToolSession) za
 *    REALNYM verifyToken.
 *  - Dla KAŻDEGO z 19 toolType: CREATE (POST) -> SAVE minimalnej odpowiedzi
 *    (PUT, accepted item + W2 finishing block w answers.summary) -> RELOAD
 *    (GET, dowód persist). Bridge `toolConclusionBridge.ts` jest tool-agnostyczny
 *    ("All 19 discovery tools generate a W2 finishing block" — komentarz w
 *    źródle) więc DLA KAŻDEGO toola sprawdzamy też że wniosek W2 wylądował w
 *    tabeli `conclusions` (CONCLUSION_LAYER).
 *  - Mechanika, nie treść: brak wywołań LLM — odpowiedzi są zaszyte inline,
 *    tekst werdyktu bez liczb i bez fraz z filler-listy walidatora
 *    (`conclusionValidators.ts` FILLER_PHRASES_PL / numbers_from_engine), żeby
 *    nie wpaść na lekką bramkę jakości w `toolConclusionBridge.ts` z innego
 *    powodu niż faktyczny bug mechaniki.
 *
 * Izolacja: prefiks `odbior--h32--`. Sprzątanie w afterAll. NIE push.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { APPROVED_MVP_TOOL_TYPES } from '../../server/src/services/toolCatalog/approvedMvpToolTypes';
import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--h32--';

function evidence(line: string): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

type RowResult = {
  toolType: string;
  create: '✅' | '❌';
  save: '✅' | '❌';
  reload: '✅' | '❌';
  conclusion: '✅' | '❌' | '—';
  error?: string;
};

const RESULTS: RowResult[] = [];

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
  toolsApp = await buildToolsApp();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  // ---- Summary table -------------------------------------------------------
  evidence('\n[h32] === REJESTR H3.2 — checklista mechaniki 19 toolType ===');
  evidence(
    '[h32] ' +
      'toolType'.padEnd(22) +
      'create'.padEnd(8) +
      'save'.padEnd(8) +
      'reload'.padEnd(8) +
      'conclusion'.padEnd(12) +
      'error'
  );
  for (const r of RESULTS) {
    evidence(
      `[h32] ${r.toolType.padEnd(22)}${r.create.padEnd(8)}${r.save.padEnd(8)}${r.reload.padEnd(8)}${r.conclusion.padEnd(12)}${r.error || ''}`
    );
  }
  const allGreen = RESULTS.every(
    (r) => r.create === '✅' && r.save === '✅' && r.reload === '✅' && r.conclusion === '✅'
  );
  evidence(`[h32] BILANS: ${RESULTS.filter((r) => r.create === '✅').length}/${RESULTS.length} create, ` +
    `${RESULTS.filter((r) => r.save === '✅').length}/${RESULTS.length} save, ` +
    `${RESULTS.filter((r) => r.reload === '✅').length}/${RESULTS.length} reload, ` +
    `${RESULTS.filter((r) => r.conclusion === '✅').length}/${RESULTS.length} conclusion — all-green=${allGreen}`);

  // ---- Cleanup ---------------------------------------------------------------
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
  } finally {
    await client.end();
  }
}, 30_000);

// ===========================================================================
// H3.2 — jedna sesja per toolType: create -> save -> reload -> W2 conclusion
// ===========================================================================
describe.each([...APPROVED_MVP_TOOL_TYPES].map((toolType) => ({ toolType })))(
  'H3.2 — $toolType tool-sesja e2e (real router + auth + DB)',
  ({ toolType }) => {
    it(`creates, saves a minimal accepted item + W2 verdict, reloads, and the conclusion lands in conclusions (${toolType})`, async () => {
      const row: RowResult = { toolType, create: '❌', save: '❌', reload: '❌', conclusion: '—' };
      RESULTS.push(row);

      // 1) CREATE — POST /api/tools (real ToolController.createToolSession).
      let sessionId = '';
      try {
        const createRes = await request(toolsApp)
          .post('/api/tools')
          .set('Authorization', `Bearer ${token}`)
          .send({ toolType, name: `${PREFIX}${toolType}-session` });

        expect(createRes.status).toBe(200);
        sessionId = createRes.body?.id;
        expect(sessionId).toBeTruthy();
        expect(createRes.body?.status).toBe('DRAFT');
        createdToolSessionIds.push(sessionId);
        row.create = '✅';
        evidence(
          `[h32] [${toolType}] created tool_sessions.id=${sessionId} version=${createRes.body?.version}`
        );
      } catch (err) {
        row.error = `create: ${(err as Error).message}`;
        throw err;
      }

      // 2) SAVE — PUT /api/tools/:id with a minimal accepted item + a W2
      //    finishing block (summary.verdict/executiveSummary — the shape the
      //    tool-agnostic bridge reads, per toolConclusionBridge.ts). Text is
      //    inline (no LLM), non-numeric, and avoids the validator filler list.
      //
      //    G4 fix (2026-08-13): `expectedVersion` is now REQUIRED by
      //    ToolController.updateToolSession's CAS gate (Sprint S1, optimistic
      //    concurrency added after this test was authored — missing field is
      //    428 Precondition Required, not a business-logic failure). A real
      //    client always round-trips the `version` returned by create/GET, so
      //    this test does the same rather than special-casing the harness.
      const verdict = `Sesja narzędzia ${toolType} wskazuje jeden zaakceptowany element wymagający dalszej walidacji przed przejściem do realizacji.`;
      const executiveSummary = `Analiza w narzędziu ${toolType} zidentyfikowała priorytetowy obszar interwencji potwierdzony przez zaakceptowany dowód sesji.`;
      try {
        const updateRes = await request(toolsApp)
          .put(`/api/tools/${sessionId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            status: 'IN_PROGRESS',
            completionPercent: 80,
            confidenceAvg: 4,
            expectedVersion: 1,
            answers: {
              items: [
                {
                  id: 'item-1',
                  text: `Zaakceptowany dowód sesji dla narzędzia ${toolType}`,
                  proposalStatus: 'accepted',
                },
              ],
              summary: {
                verdict,
                executiveSummary,
              },
            },
          });

        expect(updateRes.status).toBe(200);
        expect(updateRes.body?.id).toBe(sessionId);
        row.save = '✅';
        evidence(`[h32] [${toolType}] PUT answers ok, status=${updateRes.body?.status}`);
      } catch (err) {
        row.error = `save: ${(err as Error).message}`;
        throw err;
      }

      // 3) RELOAD — GET /api/tools/:id: proves answers PERSISTED + reload.
      try {
        const getRes = await request(toolsApp)
          .get(`/api/tools/${sessionId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body?.toolType).toBe(toolType);
        expect(getRes.body?.answers?.summary?.verdict).toBe(verdict);
        expect(getRes.body?.answers?.items).toHaveLength(1);
        row.reload = '✅';
        evidence(
          `[h32] [${toolType}] reload OK — toolType=${getRes.body?.toolType} verdict="${getRes.body?.answers?.summary?.verdict}"`
        );
      } catch (err) {
        row.error = `reload: ${(err as Error).message}`;
        throw err;
      }

      // 4) CONCLUSION (W2) — the update triggers safePersistToolSessionConclusion
      //    fire-and-forget; poll `conclusions` briefly (same-process async write).
      //    Bridge is tool-agnostic (comment in toolConclusionBridge.ts: "All 19
      //    discovery tools generate a W2 finishing block") — expected for all 19.
      const client = pgClient();
      await client.connect();
      try {
        let convRow: any = null;
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
            convRow = res.rows[0];
            break;
          }
          await new Promise((r) => setTimeout(r, 150));
        }

        if (convRow) {
          createdConclusionIds.push(convRow.id);
          row.conclusion = '✅';
          evidence(
            `[h32] [${toolType}] W2 conclusion persisted — conclusions.id=${convRow.id} status=${convRow.status} statement.length=${String(convRow.statement || '').length}`
          );
        } else {
          row.conclusion = '❌';
          evidence(`[h32] [${toolType}] W2 conclusion NOT found in conclusions after polling`);
        }

        expect(convRow).not.toBeNull();
        expect(String(convRow.statement || '').length).toBeGreaterThan(0);
        expect(convRow.statement).toContain(verdict);
      } catch (err) {
        row.error = `conclusion: ${(err as Error).message}`;
        throw err;
      } finally {
        await client.end();
      }
    });
  }
);
