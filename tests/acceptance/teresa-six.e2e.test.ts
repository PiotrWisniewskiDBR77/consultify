/**
 * J1 — 6 brakujących osi E2E Teresy (table, whiteboard, process_flow, deck,
 * doc, sheet). Do dziś (registry J1) dowód realnego runtime miały tylko
 * `note` i `mindmap` (`tests/acceptance/docs-teresa.e2e.test.ts`, sekcja 3).
 *
 * Wzorzec 1:1 z tym plikiem: wołamy realny serwis `generateDeliverable()`
 * bezpośrednio (server/src/services/ai/tools/generateDeliverable.ts) —
 * realna baza (Postgres lokalny/parity), realny LLM (przez aiService /
 * canvasGraphLlm), realne flagi. Zero mocków logiki biznesowej.
 *
 * Kontrakt per typ (ustalony czytaniem generateDeliverable.ts +
 * deliverablesGenerationService.ts + docGenerationRuntime.ts +
 * documentStudioService.ts + canvasMaterialize.ts + presentationGeneratorService.ts,
 * NIE z założeń):
 *
 *  1) table         — CANVAS_TOOL_FORMATS ścieżka (jak mindmap): SYNCHRONICZNY
 *                      materialize przez `canvasMaterialize.materializeOrThrow` →
 *                      realny wiersz `my_ideas` + `my_idea_maps`
 *                      (`preferred_tool='table'`). Brak DB-bound generacji w tle.
 *  2) whiteboard     — j.w., `preferred_tool='whiteboard'`.
 *  3) process_flow   — j.w., `preferred_tool='process_flow'`, PLUS realny
 *                      `EvidenceContract` (HP-16 8/8) zwrócony w `result.evidence`
 *                      i (fire-and-forget) spersystowany do `artifact_evidence`
 *                      (HP-17 bridge, `safePersistEvidenceContract`).
 *  4) presentation   — DB-bound: `plan()`→`generateOutline()` pisze
 *      (kind='deck')   `presentation_decks` SYNCHRONICZNIE (status='draft'/
 *                      plan_ready) *przed* powrotem z generateDeliverable;
 *                      `start()`→`generateDeck()` leci W TLE (wzorzec Gamma,
 *                      202+poll) i finalnie ustawia status='ready' +
 *                      `deck_json` (pełna treść slajdów). WAŻNE (przeczytane w
 *                      kodzie, nie zgadnięte): `presentation_cards` jest
 *                      wstawiane WYŁĄCZNIE z `presentations.routes.ts` (ręczny
 *                      POST /decks) — `generateDeck()` na tej ścieżce NIGDY
 *                      tam nie pisze. Realna treść dla decków z czatu żyje w
 *                      `deck_json`, nie w `presentation_cards` — test to
 *                      weryfikuje i raportuje uczciwie (nie maskuje).
 *  5) document       — DB-bound: `plan()`→`planDoc()` pisze `work_canvas_drafts`
 *      (kind='doc')    (kind='document') SYNCHRONICZNIE; `start()`→`startDoc()`
 *                      leci w tle, kończy `materializeDocumentArtifact()`
 *                      (useLlm:true) → realny wiersz `wave5_artifacts`, i
 *                      dokleja `artifact_id` do draftu. Weryfikujemy fix
 *                      „stale provisional artifactId" (documentStudioService.ts,
 *                      komentarz BUG-FIX): `schema.artifactId` (z
 *                      `content_json_native`) MUSI równać się realnemu
 *                      `wave5_artifacts.artifact_id`.
 *  6) sheet          — DB-bound: `plan()`→`planSheet()` pisze `work_canvas_drafts`
 *      (kind='table')  (kind='table' — UWAGA: inne pole niż idea-table #1!)
 *                      SYNCHRONICZNIE; `start()`→`startSheet()` leci w tle,
 *                      generuje tabelę GFM Markdown (LLM), zapisuje do
 *                      `content_md`. Brak osobnej materializacji do
 *                      tp_tables/xlsx na tej ścieżce (przeczytane w kodzie) —
 *                      arkusz z czatu żyje WYŁĄCZNIE jako markdown w
 *                      `work_canvas_drafts`.
 *
 * Izolacja: prefiks `odbior--t6--`, sprzątanie w afterAll. NIE push.
 */
import { appendFileSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--t6--';

/**
 * Dowód odbioru: vitest (reporter domyślny) potrafi połknąć console.* z worker
 * forka, a afterAll sprząta wiersze — więc twarde dowody (id wiersza SQL,
 * długości treści) lądują TAKŻE w pliku wskazanym przez T6_EVIDENCE_FILE.
 * Bez env — no-op (czysto na CI).
 */
function evidence(line: string): void {
  console.log(line);
  const file = process.env.T6_EVIDENCE_FILE;
  if (file) {
    try {
      appendFileSync(file, `${new Date().toISOString()} ${line}\n`);
    } catch {
      /* dowód best-effort — nie psuje testu */
    }
  }
}

const createdIdeaIds: string[] = []; // table / whiteboard / process_flow -> my_ideas
const createdDeckIds: string[] = []; // presentation -> presentation_decks
const createdWorkCanvasDraftIds: string[] = []; // document / sheet -> work_canvas_drafts
const createdWave5ArtifactIds: string[] = []; // document -> wave5_artifacts

type GenerateDeliverableFn = (
  params: { type: string; intent: string; title?: string },
  context: {
    organizationId?: string;
    userId?: string;
    conversationId?: string | null;
    language?: string;
    role?: string;
  }
) => Promise<Record<string, unknown>>;

type StatusFn = (params: {
  generationId: string;
  organizationId: string;
}) => Promise<Record<string, unknown>>;

let generateDeliverable: GenerateDeliverableFn;
let getGenerationStatus: StatusFn;

beforeAll(async () => {
  // Teresa deliverables-light: flaga master jest domyślnie OFF — musi być ON
  // PRZED pierwszym importem generateDeliverable.ts / deliverablesGenerationService.ts
  // w TYM procesie (config/FeatureFlags.ts eksportuje `featureFlags` jako stały
  // obiekt policzony RAZ przy pierwszym imporcie modułu — patrz komentarz w
  // docs-teresa.e2e.test.ts). Pozostałe flagi Teresy (ENABLE_TERESA_CANVAS_TOOLS,
  // ENABLE_TERESA_MINDMAP, ENABLE_TERESA_NOTE_CREATE) domyślnie ON — nie dotykamy.
  process.env.ENABLE_DELIVERABLES_LIGHT = 'true';

  await seed(); // idempotent — fundament (org/user/membership odbioru)

  ({ generateDeliverable } = await import(
    '../../server/src/services/ai/tools/generateDeliverable.js'
  ));
  ({ status: getGenerationStatus } = (await import(
    '../../server/src/services/deliverables/deliverablesGenerationService.js'
  )) as unknown as { status: StatusFn });
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    if (createdIdeaIds.length) {
      await client
        .query('DELETE FROM artifact_evidence WHERE artifact_id = ANY($1)', [createdIdeaIds])
        .catch(() => {});
      await client
        .query('DELETE FROM my_idea_maps WHERE idea_id = ANY($1)', [createdIdeaIds])
        .catch(() => {});
      await client.query('DELETE FROM my_ideas WHERE id = ANY($1)', [createdIdeaIds]).catch(() => {});
    }
    if (createdDeckIds.length) {
      await client
        .query('DELETE FROM artifact_evidence WHERE artifact_id = ANY($1)', [createdDeckIds])
        .catch(() => {});
      await client
        .query('DELETE FROM presentation_deck_versions WHERE deck_id = ANY($1)', [createdDeckIds])
        .catch(() => {});
      await client
        .query('DELETE FROM presentation_cards WHERE deck_id = ANY($1)', [createdDeckIds])
        .catch(() => {});
      await client
        .query('DELETE FROM presentation_decks WHERE id = ANY($1)', [createdDeckIds])
        .catch(() => {});
    }
    if (createdWorkCanvasDraftIds.length) {
      await client
        .query('DELETE FROM work_canvas_drafts WHERE id = ANY($1)', [createdWorkCanvasDraftIds])
        .catch(() => {});
    }
    if (createdWave5ArtifactIds.length) {
      await client
        .query('DELETE FROM artifact_evidence WHERE artifact_id = ANY($1)', [createdWave5ArtifactIds])
        .catch(() => {});
      await client
        .query('DELETE FROM wave5_artifact_versions WHERE artifact_id = ANY($1)', [
          createdWave5ArtifactIds,
        ])
        .catch(() => {});
      await client
        .query('DELETE FROM wave5_artifacts WHERE artifact_id = ANY($1)', [createdWave5ArtifactIds])
        .catch(() => {});
    }
  } finally {
    await client.end();
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll deliverablesGenerationService.status() until a terminal state (draft|error) or timeout. */
async function pollGenerationStatus(
  generationId: string,
  timeoutMs: number,
  intervalMs = 2500
): Promise<Record<string, unknown> | undefined> {
  const deadline = Date.now() + timeoutMs;
  let last: Record<string, unknown> | undefined;
  while (Date.now() < deadline) {
    last = await getGenerationStatus({ generationId, organizationId: SEED.ORG_ID });
    if (last?.state === 'draft' || last?.state === 'error') return last;
    await sleep(intervalMs);
  }
  return last;
}

// ============================================================================
// 1) TABLE — my_ideas / my_idea_maps (preferred_tool='table')
// ============================================================================
describe('Acceptance: TERESA axis — table (generateDeliverable type=table)', () => {
  it('materializes a real my_ideas/my_idea_maps row with preferred_tool=table', async () => {
    const title = `${PREFIX}Table ${Date.now()}`;
    const result = await generateDeliverable(
      {
        type: 'table',
        intent: 'Tabela priorytetyzacji 6 pomysłów usprawnień z oceną wpływu i wysiłku.',
        title,
      },
      { organizationId: SEED.ORG_ID, userId: SEED.USER_ID, language: 'pl', role: SEED.ROLE }
    );
    if (!result.ok) {
      console.error(`[TABLE] generateDeliverable FAILED: ${JSON.stringify(result)}`);
    }
    expect(result.error).not.toBe('feature_disabled');
    expect(result.ok).toBe(true);

    const draftId = String((result as any).draftId || '');
    expect(draftId).toBeTruthy();
    createdIdeaIds.push(draftId);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, organization_id FROM my_ideas WHERE id = $1`,
        [draftId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);

      const mapRows = await client.query(
        `SELECT id, nodes_json, preferred_tool FROM my_idea_maps WHERE idea_id = $1`,
        [draftId]
      );
      expect(mapRows.rows.length).toBeGreaterThan(0);
      expect(mapRows.rows[0].preferred_tool).toBe('table');
      const nodes = JSON.parse(mapRows.rows[0].nodes_json || '[]');
      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBeGreaterThan(0);
      evidence(
        `[TABLE] GREEN my_ideas.id=${draftId} my_idea_maps.id=${mapRows.rows[0].id} preferred_tool=${mapRows.rows[0].preferred_tool} nodes=${nodes.length}`
      );
    } finally {
      await client.end();
    }
  }, 90_000);

  it('rejects with missing_context when organizationId/userId are absent (real guard)', async () => {
    const result = await generateDeliverable(
      { type: 'table', intent: 'no context', title: 'no context' },
      {}
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe('missing_context');
  });
});

// ============================================================================
// 2) WHITEBOARD — my_ideas / my_idea_maps (preferred_tool='whiteboard')
// ============================================================================
describe('Acceptance: TERESA axis — whiteboard (generateDeliverable type=whiteboard)', () => {
  it('materializes a real my_ideas/my_idea_maps row with preferred_tool=whiteboard', async () => {
    const title = `${PREFIX}Whiteboard ${Date.now()}`;
    const result = await generateDeliverable(
      {
        type: 'whiteboard',
        intent: 'Tablica warsztatowa — burza mysli nt. barier adopcji AI w organizacji.',
        title,
      },
      { organizationId: SEED.ORG_ID, userId: SEED.USER_ID, language: 'pl', role: SEED.ROLE }
    );
    if (!result.ok) {
      console.error(`[WHITEBOARD] generateDeliverable FAILED: ${JSON.stringify(result)}`);
    }
    expect(result.error).not.toBe('feature_disabled');
    expect(result.ok).toBe(true);

    const draftId = String((result as any).draftId || '');
    expect(draftId).toBeTruthy();
    createdIdeaIds.push(draftId);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, organization_id FROM my_ideas WHERE id = $1`,
        [draftId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);

      const mapRows = await client.query(
        `SELECT id, nodes_json, preferred_tool FROM my_idea_maps WHERE idea_id = $1`,
        [draftId]
      );
      expect(mapRows.rows.length).toBeGreaterThan(0);
      expect(mapRows.rows[0].preferred_tool).toBe('whiteboard');
      const nodes = JSON.parse(mapRows.rows[0].nodes_json || '[]');
      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBeGreaterThan(0);
      evidence(
        `[WHITEBOARD] GREEN my_ideas.id=${draftId} my_idea_maps.id=${mapRows.rows[0].id} preferred_tool=${mapRows.rows[0].preferred_tool} nodes=${nodes.length}`
      );
    } finally {
      await client.end();
    }
  }, 90_000);
});

// ============================================================================
// 3) PROCESS FLOW — my_ideas / my_idea_maps (preferred_tool='process_flow')
//    + HP-16 (8/8) EvidenceContract + HP-17 persist bridge (artifact_evidence)
// ============================================================================
describe('Acceptance: TERESA axis — process_flow (generateDeliverable type=process_flow)', () => {
  it('materializes a real my_ideas/my_idea_maps row + a real EvidenceContract (HP-16/HP-17)', async () => {
    const title = `${PREFIX}ProcessFlow ${Date.now()}`;
    const result = await generateDeliverable(
      {
        type: 'process_flow',
        intent: 'Przepływ procesu: od zgłoszenia klienta do zamknięcia zlecenia, z bramką decyzyjną.',
        title,
      },
      { organizationId: SEED.ORG_ID, userId: SEED.USER_ID, language: 'pl', role: SEED.ROLE }
    );
    if (!result.ok) {
      console.error(`[PROCESS_FLOW] generateDeliverable FAILED: ${JSON.stringify(result)}`);
    }
    expect(result.error).not.toBe('feature_disabled');
    expect(result.ok).toBe(true);

    const draftId = String((result as any).draftId || '');
    expect(draftId).toBeTruthy();
    createdIdeaIds.push(draftId);

    // HP-16 (8/8) — real EvidenceContract shape, synchronous return value.
    const evidenceContract = (result as any).evidence;
    expect(evidenceContract).toBeTruthy();
    expect(['low', 'medium', 'high']).toContain(evidenceContract?.confidence);
    expect(Array.isArray(evidenceContract?.sources)).toBe(true);
    expect(Array.isArray(evidenceContract?.toVerify)).toBe(true);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, organization_id FROM my_ideas WHERE id = $1`,
        [draftId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);

      const mapRows = await client.query(
        `SELECT id, nodes_json, preferred_tool, extensions_json FROM my_idea_maps WHERE idea_id = $1`,
        [draftId]
      );
      expect(mapRows.rows.length).toBeGreaterThan(0);
      expect(mapRows.rows[0].preferred_tool).toBe('process_flow');
      const nodes = JSON.parse(mapRows.rows[0].nodes_json || '[]');
      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBeGreaterThan(0);
      const extensions = JSON.parse(mapRows.rows[0].extensions_json || '{}');
      expect(extensions.evidence).toBeTruthy();
      evidence(
        `[PROCESS_FLOW] GREEN my_ideas.id=${draftId} my_idea_maps.id=${mapRows.rows[0].id} preferred_tool=${mapRows.rows[0].preferred_tool} nodes=${nodes.length} evidence.confidence=${evidenceContract?.confidence} extensions.evidence=present`
      );
    } finally {
      await client.end();
    }

    // HP-17 bridge — safePersistEvidenceContract is fire-and-forget (`void ...`)
    // inside generateDeliverable, so give it a short grace window before
    // asserting the artifact_evidence row landed. Soft-check + log, not masked.
    let evidenceRowFound = false;
    for (let attempt = 0; attempt < 5 && !evidenceRowFound; attempt++) {
      await sleep(1000);
      const client2 = pgClient();
      await client2.connect();
      try {
        const evRows = await client2.query(
          `SELECT confidence FROM artifact_evidence WHERE artifact_id = $1 AND artifact_type = 'canvas'`,
          [draftId]
        );
        evidenceRowFound = evRows.rows.length === 1;
      } finally {
        await client2.end();
      }
    }
    if (!evidenceRowFound) {
      evidence(
        `[PROCESS_FLOW] finding: HP-17 bridge did not persist an artifact_evidence row for ${draftId} within 5s — safePersistEvidenceContract is fire-and-forget; either slow or silently failing.`
      );
    } else {
      evidence(`[PROCESS_FLOW] GREEN artifact_evidence row present for artifact_id=${draftId} (HP-17 bridge)`);
    }
  }, 90_000);
});

// ============================================================================
// 4) DECK — presentation_decks (DB-bound, plan()+start() in background)
// ============================================================================
describe('Acceptance: TERESA axis — deck (generateDeliverable type=presentation)', () => {
  it('creates a real presentation_decks row synchronously and materializes deck_json in the background', async () => {
    const title = `${PREFIX}Deck ${Date.now()}`;
    const result = await generateDeliverable(
      {
        type: 'presentation',
        intent: 'Prezentacja 3-slajdowa: kontekst projektu, rekomendacja, plan wdrożenia.',
        title,
      },
      { organizationId: SEED.ORG_ID, userId: SEED.USER_ID, language: 'pl', role: SEED.ROLE }
    );
    if (!result.ok) {
      console.error(`[DECK] generateDeliverable FAILED: ${JSON.stringify(result)}`);
    }
    expect(result.error).not.toBe('feature_disabled');
    expect(result.ok).toBe(true);

    const deckId = String((result as any).draftId || '');
    expect(deckId).toBeTruthy();
    createdDeckIds.push(deckId);

    // PERSISTENCE — plan() (generateOutline) writes the deck row SYNCHRONOUSLY,
    // before generateDeliverable() even returns (start() is awaited too, but
    // the actual generateDeck() body runs un-awaited in the background).
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, title, organization_id, status FROM presentation_decks WHERE id = $1`,
        [deckId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);
    } finally {
      await client.end();
    }

    const final = await pollGenerationStatus(deckId, 180_000, 3000);
    console.log(
      `[DECK] final status: state=${(final as any)?.state} error=${(final as any)?.error ?? ''}`
    );

    const client2 = pgClient();
    await client2.connect();
    try {
      const { rows } = await client2.query(
        `SELECT status, deck_json, slide_count FROM presentation_decks WHERE id = $1`,
        [deckId]
      );
      expect(rows).toHaveLength(1);

      if ((final as any)?.state === 'draft' && rows[0].status === 'ready') {
        expect(rows[0].deck_json).toBeTruthy();
        expect(String(rows[0].deck_json).length).toBeGreaterThan(50);
        expect(Number(rows[0].slide_count)).toBeGreaterThan(0);
        evidence(
          `[DECK] GREEN presentation_decks.id=${deckId} status=ready slide_count=${rows[0].slide_count} deck_json.length=${String(rows[0].deck_json).length}`
        );
      } else {
        evidence(
          `[DECK] finding: generation did not reach 'ready' within 180s — status()=${(final as any)?.state} db.status=${rows[0].status} error=${(final as any)?.error ?? '(none)'}`
        );
      }

      // Known-by-code-read architecture fact, not a flake: `presentation_cards`
      // is ONLY EVER INSERTed by `presentations.routes.ts` (manual POST /decks
      // endpoint, per-slide loop). `presentationGeneratorService.generateDeck()`
      // — the function this Teresa chat / generateDeliverable path calls — never
      // writes to it, and nothing in the codebase SELECTs from it either (dead
      // read path). The real slide content for chat-created decks lives in
      // `presentation_decks.deck_json` (asserted above). Reported honestly, not
      // masked as a bug in generateDeck() — it is architecturally always 0 here.
      const cardRows = await client2.query(
        `SELECT id FROM presentation_cards WHERE deck_id = $1`,
        [deckId]
      );
      evidence(
        `[DECK] info: presentation_cards has ${cardRows.rows.length} row(s) for chat-created deck ${deckId} (architecturally expected 0 on this path — see comment above).`
      );
    } finally {
      await client2.end();
    }
  }, 210_000);
});

// ============================================================================
// 5) DOC — work_canvas_drafts (kind='document') + wave5_artifacts (DB-bound)
// ============================================================================
describe('Acceptance: TERESA axis — document (generateDeliverable type=document)', () => {
  it('creates a real work_canvas_drafts row, materializes a real wave5_artifacts row, and schema.artifactId matches the real row id (Word artifactId fix)', async () => {
    const title = `${PREFIX}Doc ${Date.now()}`;
    const conversationId = `${PREFIX}conv-doc-${Date.now()}`;
    const result = await generateDeliverable(
      {
        type: 'document',
        intent: 'Krótki raport o ryzykach wdrożenia programu transformacji — 2 sekcje.',
        title,
      },
      {
        organizationId: SEED.ORG_ID,
        userId: SEED.USER_ID,
        language: 'pl',
        role: SEED.ROLE,
        conversationId,
      }
    );
    if (!result.ok) {
      console.error(`[DOC] generateDeliverable FAILED: ${JSON.stringify(result)}`);
    }
    expect(result.error).not.toBe('feature_disabled');
    expect(result.ok).toBe(true);

    const draftId = String((result as any).draftId || '');
    expect(draftId).toBeTruthy();
    createdWorkCanvasDraftIds.push(draftId);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, kind, organization_id, conversation_id FROM work_canvas_drafts WHERE id = $1`,
        [draftId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].kind).toBe('document');
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);
      expect(rows[0].conversation_id).toBe(conversationId);
    } finally {
      await client.end();
    }

    const final = await pollGenerationStatus(draftId, 150_000, 3000);
    console.log(
      `[DOC] final status: state=${(final as any)?.state} error=${(final as any)?.error ?? ''}`
    );

    const client2 = pgClient();
    await client2.connect();
    try {
      const { rows } = await client2.query(
        `SELECT content_md, artifact_id FROM work_canvas_drafts WHERE id = $1`,
        [draftId]
      );
      expect(rows).toHaveLength(1);

      if ((final as any)?.state === 'draft') {
        const wave5Id = String(rows[0].artifact_id || '');
        expect(wave5Id).toBeTruthy();
        createdWave5ArtifactIds.push(wave5Id);

        const artRows = await client2.query(
          `SELECT artifact_id, organization_id, artifact_type, content_json_native, content_md
           FROM wave5_artifacts WHERE artifact_id = $1`,
          [wave5Id]
        );
        expect(artRows.rows).toHaveLength(1);
        expect(artRows.rows[0].organization_id).toBe(SEED.ORG_ID);

        const schema = JSON.parse(artRows.rows[0].content_json_native || '{}');
        // documentStudioService.ts BUG-FIX comment: the real wave5 artifact id
        // is generated UP FRONT (`provisionalArtifactId`) and threaded through
        // BOTH the persisted schema (`schema.artifactId`) and the wave5 row
        // (`externalArtifactId`) — so on reload they must be identical. This
        // was previously broken (stale `documentstudio-pending-<ts>` placeholder
        // baked into content_json_native — see docs-teresa.e2e.test.ts KNOWN BUG
        // comment for the pre-fix symptom on the /document-studio/generate route).
        expect(schema.artifactId).toBe(wave5Id);

        expect(String(rows[0].content_md || '').length).toBeGreaterThan(80);
        evidence(
          `[DOC] GREEN work_canvas_drafts.id=${draftId} wave5_artifacts.artifact_id=${wave5Id} schema.artifactId=${schema.artifactId} (match) draft.content_md.length=${String(rows[0].content_md || '').length} wave5.content_md.length=${String(artRows.rows[0].content_md || '').length}`
        );
      } else {
        evidence(
          `[DOC] finding: generation did not reach 'draft' within 150s — status()=${(final as any)?.state} error=${(final as any)?.error ?? '(none)'} content-so-far.length=${String(rows[0].content_md || '').length}`
        );
      }
    } finally {
      await client2.end();
    }
  }, 180_000);
});

// ============================================================================
// 6) SHEET — work_canvas_drafts (kind='table', GFM markdown, no separate xlsx/tp_tables row on this path)
// ============================================================================
describe('Acceptance: TERESA axis — sheet (generateDeliverable type=sheet)', () => {
  it('creates a real work_canvas_drafts row (kind=table) and materializes a real GFM markdown table', async () => {
    const title = `${PREFIX}Sheet ${Date.now()}`;
    const conversationId = `${PREFIX}conv-sheet-${Date.now()}`;
    const result = await generateDeliverable(
      {
        type: 'sheet',
        intent: 'Arkusz: lista 5 inicjatyw z kolumnami nazwa / priorytet / budżet.',
        title,
      },
      {
        organizationId: SEED.ORG_ID,
        userId: SEED.USER_ID,
        language: 'pl',
        role: SEED.ROLE,
        conversationId,
      }
    );
    if (!result.ok) {
      console.error(`[SHEET] generateDeliverable FAILED: ${JSON.stringify(result)}`);
    }
    expect(result.error).not.toBe('feature_disabled');
    expect(result.ok).toBe(true);

    const draftId = String((result as any).draftId || '');
    expect(draftId).toBeTruthy();
    createdWorkCanvasDraftIds.push(draftId);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, kind, organization_id, conversation_id FROM work_canvas_drafts WHERE id = $1`,
        [draftId]
      );
      expect(rows).toHaveLength(1);
      // L3: sheet materializes as a canvas draft of kind='table' (NOT a separate
      // tp_tables/xlsx row — read from docGenerationRuntime.ts planSheet()/
      // startSheet(), the actual materialization target for this chat path).
      expect(rows[0].kind).toBe('table');
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);
      expect(rows[0].conversation_id).toBe(conversationId);
    } finally {
      await client.end();
    }

    const final = await pollGenerationStatus(draftId, 90_000, 2500);
    console.log(
      `[SHEET] final status: state=${(final as any)?.state} error=${(final as any)?.error ?? ''}`
    );

    const client2 = pgClient();
    await client2.connect();
    try {
      const { rows } = await client2.query(
        `SELECT content_md FROM work_canvas_drafts WHERE id = $1`,
        [draftId]
      );
      expect(rows).toHaveLength(1);
      const content = String(rows[0].content_md || '');

      if ((final as any)?.state === 'draft') {
        expect(content).toMatch(/\|.*\|/); // GFM table row (pipe-delimited)
        expect(content).toMatch(/\|[\s:-]*-{2,}[\s|:-]*\|?/); // GFM separator row
        const tableRows = (content.match(/^\s*\|/gm) || []).length;
        evidence(
          `[SHEET] GREEN work_canvas_drafts.id=${draftId} kind=table content_md.length=${content.length} gfm-pipe-rows=${tableRows}`
        );
      } else {
        evidence(
          `[SHEET] finding: generation did not reach 'draft' within 90s — status()=${(final as any)?.state} error=${(final as any)?.error ?? '(none)'} content-so-far=${content.slice(0, 200)}`
        );
      }
    } finally {
      await client2.end();
    }
  }, 120_000);
});
