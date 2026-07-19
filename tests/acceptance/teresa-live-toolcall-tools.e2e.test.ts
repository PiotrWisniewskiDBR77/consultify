/**
 * TERESA LIVE TOOL-CALL PROOF — EXTENSION to the remaining engine-supported
 * artifact types.
 *
 * `teresa-live-toolcall.e2e.test.ts` (batch 3) proved the live function-calling
 * link for note / mindmap / table. This file extends the SAME real
 * tool-dispatch path to the FOUR other kinds the `generate_deliverable` engine
 * (`server/src/services/ai/tools/generateDeliverable.ts`) actually handles:
 *
 *   whiteboard     → my_ideas + my_idea_maps (preferred_tool='whiteboard')
 *   process_flow   → my_ideas + my_idea_maps (preferred_tool='process_flow')  +evidence
 *   presentation   → presentation_decks row (deck plan, status='draft')
 *   document (word)→ work_canvas_drafts row  (doc plan, kind='document')
 *
 * Same pipeline as the reference: `llmService.call({ tools, context })` →
 * `callWithTools` → ai-sdk `generateText` against a LIVE Anthropic model →
 * `mcpServer.execute('generate_deliverable', …)` → the real handler → real
 * Postgres (parity :5443). Zero business-logic mocks.
 *
 * FIDELITY NOTE — unlike the `table` axis in the reference, AIPipeline injects a
 * per-turn `[NADPISANIE]` directive ONLY for a classified 'table' intent
 * (`chatCreationIntent.ts` has no process_flow/whiteboard/presentation intent).
 * So for these four the REAL runtime steers the model with the persona + the
 * tool DESCRIPTION alone (which explicitly maps "zrób diagram procesu"→
 * process_flow, "zrób tablicę"→whiteboard, "presentation"→deck, prose→document).
 * This test therefore uses the bare persona — no test-only nudge — which is the
 * honest replica of production behaviour.
 *
 * deck/doc generate their BODY in the background (generateDeck / startDoc run
 * detached); the DB ROW itself lands SYNCHRONOUSLY in the plan step, so the
 * proof asserts the real row + a non-trivial skeleton, not the finished prose.
 *
 * AI-SDK v6 NOTE — the vendored ai-sdk (v6) renamed the tool-call fields to
 * `input`/`output`; `llmService.callWithTools` still maps `args: tc.args` /
 * `result: tc.result`, so the returned `toolCalls[].args`/`.result` are
 * `undefined` on this stack (harmless in prod — the chat pipeline consumes the
 * `onDeliverable` SSE side-channel, not `toolCalls[].args`). This proof
 * therefore verifies the CHOSEN TYPE and the handler execution through that
 * SAME side-channel (`onDeliverable({kind,draftId,…})` — exactly what
 * `ai.routes.ts` forwards to the FE) plus the real DB row, which is a stronger
 * end-to-end signal than the model's raw arg echo. (The sibling
 * `teresa-live-toolcall.e2e.test.ts` still asserts the now-undefined
 * `gd.args.type` and is red on this commit for the same field-rename reason.)
 *
 * REQUIRES: live ANTHROPIC_API_KEY, Postgres parity :5443,
 * ENABLE_DELIVERABLES_LIGHT=true. Isolation prefix `odbior--tlt--`, afterAll
 * cleanup (rows + M17 registry back-refs). NIE push.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--tlt--';
const MODEL = { provider: 'anthropic', id: 'claude-sonnet-4-6' };

type LlmCall = (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };

let llmCall: LlmCall;
let genDeliverableDef: ToolDef;
let personaPl: string;

const createdIdeaIds: string[] = []; // whiteboard/process_flow -> my_ideas + my_idea_maps
const createdDeckIds: string[] = []; // presentation -> presentation_decks
const createdDocIds: string[] = []; // document -> work_canvas_drafts

type DeliverablePayload = {
  kind?: string;
  noteId?: string;
  draftId?: string;
  generationId?: string;
  title?: string;
};

beforeAll(async () => {
  process.env.ENABLE_DELIVERABLES_LIGHT = 'true';

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('This proof requires a live ANTHROPIC_API_KEY in env.');
  }

  await seed();

  await import('../../server/src/services/ai/tools/index.js');

  const mcpMod = await import('../../server/src/services/ai/mcpServer.js');
  const mcp = (mcpMod.mcpServer || (mcpMod as any).default) as {
    getToolDefinitions: () => ToolDef[];
  };
  const def = mcp.getToolDefinitions().find((d) => d.name === 'generate_deliverable');
  if (!def) throw new Error('generate_deliverable not registered');
  genDeliverableDef = def;

  const llmMod = await import('../../server/src/services/ai/llmService.js');
  const svc = (llmMod.llmService || (llmMod as any).default) as { call: LlmCall };
  llmCall = svc.call.bind(svc);

  const personaMod = await import('../../server/src/ai/persona.js');
  personaPl = personaMod.buildPersonaPrompt('chat', 'pl');
}, 120_000);

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
      await client
        .query('DELETE FROM my_ideas WHERE id = ANY($1)', [createdIdeaIds])
        .catch(() => {});
    }
    if (createdDeckIds.length) {
      await client
        .query('DELETE FROM presentation_decks WHERE id = ANY($1)', [createdDeckIds])
        .catch(() => {});
    }
    if (createdDocIds.length) {
      await client
        .query('DELETE FROM work_canvas_drafts WHERE id = ANY($1)', [createdDocIds])
        .catch(() => {});
    }
    // M17 origin registry back-refs (fire-and-forget in the handler for
    // deck/doc). Clean by origin_record_id so the demo library stays pristine.
    // Order matters: resolve the artifact_ids FROM the links first, delete the
    // v8_output_artifacts rows (PK = artifact_id), THEN drop the links.
    const originIds = [...createdDeckIds, ...createdDocIds];
    if (originIds.length) {
      const linked = await client
        .query('SELECT artifact_id FROM v8_artifact_origin_links WHERE origin_record_id = ANY($1)', [
          originIds,
        ])
        .catch(() => ({ rows: [] as Array<{ artifact_id: string }> }));
      const artifactIds = (linked.rows || []).map((r) => r.artifact_id).filter(Boolean);
      if (artifactIds.length) {
        await client
          .query('DELETE FROM v8_output_artifacts WHERE artifact_id = ANY($1)', [artifactIds])
          .catch(() => {});
      }
      await client
        .query('DELETE FROM v8_artifact_origin_links WHERE origin_record_id = ANY($1)', [originIds])
        .catch(() => {});
    }
  } finally {
    await client.end();
  }
});

async function runChatTurn(
  userText: string,
  systemPrompt: string
): Promise<{
  toolCalls: Array<{ name: string; args: any; result: any }>;
  delivered: DeliverablePayload[];
}> {
  const delivered: DeliverablePayload[] = [];
  const context = {
    organizationId: SEED.ORG_ID,
    userId: SEED.USER_ID,
    role: SEED.ROLE,
    language: 'pl',
    conversationId: `${PREFIX}conv-${Date.now()}`,
    onDeliverable: (p: DeliverablePayload) => {
      delivered.push(p);
    },
  };

  const result = await llmCall({
    type: 'text',
    stream: false,
    modelConfig: MODEL,
    systemPrompt,
    messages: [{ role: 'user', content: userText }],
    tools: [genDeliverableDef],
    context,
    maxIterations: 3,
    cache: false,
  });

  const toolCalls = ((result.toolCalls as any[]) || []).map((tc) => ({
    name: tc.name,
    args: tc.args,
    result: tc.result,
  }));
  return { toolCalls, delivered };
}

// ===========================================================================
// 4) WHITEBOARD — "zrób tablicę o X"
// ===========================================================================
describe('Acceptance: TERESA live tool-call — whiteboard', () => {
  it('LIVE model emits generate_deliverable(type=whiteboard) and a real my_ideas/my_idea_maps row lands', async () => {
    const { toolCalls, delivered } = await runChatTurn(
      'Zrób tablicę (whiteboard) z pomysłami na usprawnienie onboardingu nowych pracowników — pogrupuj w bloki tematyczne.',
      personaPl
    );

    const gd = toolCalls.find((t) => t.name === 'generate_deliverable');
    console.log(`[WHITEBOARD] tool-calls=${JSON.stringify(toolCalls.map((t) => t.name))}`);
    expect(gd, 'live model must emit generate_deliverable').toBeTruthy();

    // Chosen type + handler execution are proven via the onDeliverable side-
    // channel (see AI-SDK v6 NOTE): kind:'whiteboard' means the model called the
    // tool with type="whiteboard" AND the handler ran and materialized a row.
    const payload = delivered.find((d) => d.kind === 'whiteboard');
    console.log(`[WHITEBOARD] delivered kinds=${JSON.stringify(delivered.map((d) => d.kind))}`);
    expect(
      payload,
      'live model must call generate_deliverable(type=whiteboard) → onDeliverable(kind=whiteboard)'
    ).toBeTruthy();
    expect(payload?.draftId, 'onDeliverable must carry a real draft id').toBeTruthy();
    const draftId = String(payload!.draftId);
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
        `SELECT nodes_json, preferred_tool FROM my_idea_maps WHERE idea_id = $1`,
        [draftId]
      );
      expect(mapRows.rows.length).toBeGreaterThan(0);
      expect(mapRows.rows[0].preferred_tool).toBe('whiteboard');
      const nodes = JSON.parse(mapRows.rows[0].nodes_json || '[]');
      expect(nodes.length, 'whiteboard must have real blocks, not an empty canvas').toBeGreaterThan(
        0
      );
      console.log(
        `[WHITEBOARD] GREEN my_ideas.id=${draftId} preferred_tool=whiteboard nodes=${nodes.length}`
      );
    } finally {
      await client.end();
    }
  }, 180_000);
});

// ===========================================================================
// 5) PROCESS_FLOW — "zrób diagram procesu X"
// ===========================================================================
describe('Acceptance: TERESA live tool-call — process_flow', () => {
  it('LIVE model emits generate_deliverable(type=process_flow) and a real my_ideas/my_idea_maps row lands', async () => {
    const { toolCalls, delivered } = await runChatTurn(
      'Zrób diagram procesu obsługi reklamacji klienta: od zgłoszenia przez weryfikację po decyzję i zamknięcie.',
      personaPl
    );

    const gd = toolCalls.find((t) => t.name === 'generate_deliverable');
    console.log(`[PROCESS_FLOW] tool-calls=${JSON.stringify(toolCalls.map((t) => t.name))}`);
    expect(gd, 'live model must emit generate_deliverable').toBeTruthy();

    const payload = delivered.find((d) => d.kind === 'process_flow');
    console.log(`[PROCESS_FLOW] delivered kinds=${JSON.stringify(delivered.map((d) => d.kind))}`);
    expect(
      payload,
      'live model must call generate_deliverable(type=process_flow) → onDeliverable(kind=process_flow)'
    ).toBeTruthy();
    expect(payload?.draftId, 'onDeliverable must carry a real draft id').toBeTruthy();
    const draftId = String(payload!.draftId);
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
        `SELECT nodes_json, preferred_tool FROM my_idea_maps WHERE idea_id = $1`,
        [draftId]
      );
      expect(mapRows.rows.length).toBeGreaterThan(0);
      expect(mapRows.rows[0].preferred_tool).toBe('process_flow');
      const nodes = JSON.parse(mapRows.rows[0].nodes_json || '[]');
      expect(nodes.length, 'process flow must have real steps').toBeGreaterThan(0);
      console.log(
        `[PROCESS_FLOW] GREEN my_ideas.id=${draftId} preferred_tool=process_flow nodes=${nodes.length}`
      );
    } finally {
      await client.end();
    }
  }, 180_000);
});

// ===========================================================================
// 6) PRESENTATION (deck) — "zrób prezentację o X"
// ===========================================================================
describe('Acceptance: TERESA live tool-call — presentation (deck)', () => {
  it('LIVE model emits generate_deliverable(type=presentation) and a real presentation_decks row lands', async () => {
    const { toolCalls, delivered } = await runChatTurn(
      'Zrób prezentację dla zarządu o strategii wejścia na rynek niemiecki: kontekst, szanse, ryzyka, plan i rekomendacja.',
      personaPl
    );

    const gd = toolCalls.find((t) => t.name === 'generate_deliverable');
    console.log(`[PRESENTATION] tool-calls=${JSON.stringify(toolCalls.map((t) => t.name))}`);
    expect(gd, 'live model must emit generate_deliverable').toBeTruthy();

    // presentation → engine format 'deck' → onDeliverable(kind='deck'). Its
    // presence proves the model called generate_deliverable(type=presentation)
    // and the deck plan materialized a presentation_decks row.
    const payload = delivered.find((d) => d.kind === 'deck');
    console.log(`[PRESENTATION] delivered kinds=${JSON.stringify(delivered.map((d) => d.kind))}`);
    expect(
      payload,
      'live model must call generate_deliverable(type=presentation) → onDeliverable(kind=deck)'
    ).toBeTruthy();
    const deckId = String(payload?.draftId || payload?.generationId || '');
    expect(deckId, 'onDeliverable must carry a real deck id').toBeTruthy();
    createdDeckIds.push(deckId);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, organization_id, title, status, outline_json FROM presentation_decks WHERE id = $1`,
        [deckId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);
      expect(String(rows[0].title || '').length, 'deck must have a real title').toBeGreaterThan(3);
      const outline = JSON.parse(rows[0].outline_json || '{}');
      // outline_json is a rich object (deckIntentSummary/createMode/…) — proof
      // it is not an empty shell.
      expect(Object.keys(outline).length, 'deck outline must be materialized').toBeGreaterThan(0);
      console.log(
        `[PRESENTATION] GREEN presentation_decks.id=${deckId} status=${rows[0].status} title="${rows[0].title}"`
      );
    } finally {
      await client.end();
    }
  }, 180_000);
});

// ===========================================================================
// 7) DOCUMENT (word) — "zrób dokument o X"
// ===========================================================================
describe('Acceptance: TERESA live tool-call — document (word)', () => {
  it('LIVE model emits generate_deliverable(type=document) and a real work_canvas_drafts row lands', async () => {
    const { toolCalls, delivered } = await runChatTurn(
      'Zrób dokument — notatkę strategiczną (brief) o wdrożeniu polityki bezpieczeństwa informacji ISO 27001 w firmie produkcyjnej: cel, zakres, etapy, ryzyka.',
      personaPl
    );

    const gd = toolCalls.find((t) => t.name === 'generate_deliverable');
    console.log(`[DOCUMENT] tool-calls=${JSON.stringify(toolCalls.map((t) => t.name))}`);
    expect(gd, 'live model must emit generate_deliverable').toBeTruthy();

    // document → engine format 'doc' → onDeliverable(kind='doc'). Its presence
    // proves the model called generate_deliverable(type=document) and the doc
    // plan materialized a work_canvas_drafts row.
    const payload = delivered.find((d) => d.kind === 'doc');
    console.log(`[DOCUMENT] delivered kinds=${JSON.stringify(delivered.map((d) => d.kind))}`);
    expect(
      payload,
      'live model must call generate_deliverable(type=document) → onDeliverable(kind=doc)'
    ).toBeTruthy();
    const docId = String(payload?.draftId || payload?.generationId || '');
    expect(docId, 'onDeliverable must carry a real doc id').toBeTruthy();
    createdDocIds.push(docId);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, organization_id, kind, title, content_json FROM work_canvas_drafts WHERE id = $1`,
        [docId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);
      expect(rows[0].kind).toBe('document');
      expect(String(rows[0].title || '').length, 'doc must have a real title').toBeGreaterThan(3);
      // content_json holds the JSON-stringified outline-skeleton markdown (the
      // rich body is generated in the background by startDoc). Proof it is a
      // real multi-section skeleton, not an empty shell.
      const skeleton = String(rows[0].content_json || '');
      expect(skeleton.length, 'doc skeleton must be a real outline').toBeGreaterThan(80);
      console.log(
        `[DOCUMENT] GREEN work_canvas_drafts.id=${docId} kind=document title="${rows[0].title}" skeleton.len=${skeleton.length}`
      );
    } finally {
      await client.end();
    }
  }, 180_000);
});
