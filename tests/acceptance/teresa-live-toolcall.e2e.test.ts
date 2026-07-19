/**
 * TERESA LIVE TOOL-CALL PROOF — the missing link that `teresa-six.e2e.test.ts`
 * and `docs-teresa.e2e.test.ts` do NOT cover, and that
 * `tests/e2e/tools/teresa-create-deliverables.spec.ts` documents as
 * `test.skip(true)` ("generate_deliverable is never invoked… needs live
 * AI_PROVIDER_MODE").
 *
 * Those tests call `generateDeliverable()` DIRECTLY — they prove the handler +
 * DB write, but they BYPASS the model's decision to call the tool. The open
 * question (critic A) is the function-calling link itself:
 *
 *     user writes "Zrób notatkę: …"  →  LIVE LLM emits a tool_use for
 *     `generate_deliverable`  →  handler writes a real artifact row.
 *
 * This test exercises the REAL tool-dispatch path used by the chat pipeline —
 * `llmService.call({ tools, context })` → `callWithTools` → ai-sdk
 * `generateText` against a LIVE Anthropic model (claude-sonnet-4-6, the repo's
 * premium tier) → `mcpServer.execute('generate_deliverable', args, context)` →
 * the real handler → real Postgres (parity :5443). Zero business-logic mocks.
 *
 * The tool DEFINITION and the CONTEXT plumbing (onDeliverable, org/user/role/
 * language) are taken from exactly what `AIPipeline.ts` passes on the chat
 * stream (mcpServer.getToolDefinitions() filtered to the chat-creation tool,
 * context carrying onDeliverable). The system prompt is the real Teresa persona
 * (`server/src/ai/persona.ts`). For the `table` axis we ALSO append the same
 * per-turn directive AIPipeline injects for a "zrób tabelę" intent (the model's
 * global persona otherwise answers a table request with an inline markdown
 * table instead of a tool call — that nudge is part of the real runtime, not a
 * test crutch).
 *
 * REQUIRES: a live ANTHROPIC_API_KEY in env, Postgres parity on :5443,
 * ENABLE_DELIVERABLES_LIGHT=true. Isolation prefix `odbior--tlv--`, afterAll
 * cleanup. NIE push.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--tlv--';
const MODEL = { provider: 'anthropic', id: 'claude-sonnet-4-6' };

type LlmCall = (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };

let llmCall: LlmCall;
let genDeliverableDef: ToolDef;
let personaPl: string;

const createdNoteIds: string[] = []; // note -> notebook_pages
const createdIdeaIds: string[] = []; // mindmap/table -> my_ideas + my_idea_maps

type DeliverablePayload = { kind?: string; noteId?: string; draftId?: string; title?: string };

beforeAll(async () => {
  // Master flag: OFF by default, must be ON before the FIRST import of
  // generateDeliverable.ts / FeatureFlags.ts in this process (frozen once).
  process.env.ENABLE_DELIVERABLES_LIGHT = 'true';

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('This proof requires a live ANTHROPIC_API_KEY in env.');
  }

  await seed(); // idempotent org/user/membership

  // Register the real tool handlers (side-effect import — tools/index.ts calls
  // registerAllTools() at module load, exactly as the server does).
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
    if (createdNoteIds.length) {
      await client
        .query('DELETE FROM notebook_pages WHERE id = ANY($1)', [createdNoteIds])
        .catch(() => {});
    }
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
  } finally {
    await client.end();
  }
});

/**
 * Drive one real chat turn through the live tool-dispatch pipeline and return
 * both the emitted tool call(s) and whatever onDeliverable fired.
 */
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
// 1) NOTE — the exact scenario from the task: "Zrób notatkę: podsumowanie ryzyk"
// ===========================================================================
describe('Acceptance: TERESA live tool-call — note (real LLM decides to call generate_deliverable)', () => {
  it('LIVE model emits generate_deliverable(type=note) and a real notebook_pages row lands with real content', async () => {
    const { toolCalls, delivered } = await runChatTurn(
      'Zrób notatkę: podsumowanie ryzyk projektu X (harmonogram, budżet, zależności).',
      personaPl
    );

    // (a) the LIVE model actually called the tool
    const gd = toolCalls.find((t) => t.name === 'generate_deliverable');
    console.log(`[NOTE] tool-calls=${JSON.stringify(toolCalls.map((t) => t.name))}`);
    expect(gd, 'live model must emit a generate_deliverable tool_use').toBeTruthy();
    console.log(`[NOTE] tool args=${JSON.stringify(gd!.args)}`);
    expect(gd!.args?.type).toBe('note');
    // handler ran and returned ok
    expect(gd!.result?.data?.ok ?? gd!.result?.ok).toBe(true);

    // side-channel fired with the real note id
    const payload = delivered.find((d) => d.kind === 'note');
    expect(payload?.noteId, 'onDeliverable must carry a real note id').toBeTruthy();
    const noteId = String(payload!.noteId);
    createdNoteIds.push(noteId);

    // (b) real row in the parity DB with real (non-placeholder) content
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, organization_id, title, content_text FROM notebook_pages WHERE id = $1`,
        [noteId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organization_id).toBe(SEED.ORG_ID);
      const body = String(rows[0].content_text || '');
      expect(body.length, 'note body must be real prose, not an empty shell').toBeGreaterThan(120);
      console.log(
        `[NOTE] GREEN notebook_pages.id=${noteId} title="${rows[0].title}" content_text.length=${body.length}`
      );
      console.log(`[NOTE] body-head="${body.slice(0, 160).replace(/\s+/g, ' ')}"`);
    } finally {
      await client.end();
    }
  }, 180_000);
});

// ===========================================================================
// 2) MINDMAP — "zrób mapę myśli o X"
// ===========================================================================
describe('Acceptance: TERESA live tool-call — mindmap', () => {
  it('LIVE model emits generate_deliverable(type=mindmap) and a real my_ideas/my_idea_maps row lands', async () => {
    const { toolCalls, delivered } = await runChatTurn(
      'Zrób mapę myśli o barierach adopcji AI w firmie produkcyjnej.',
      personaPl
    );

    const gd = toolCalls.find((t) => t.name === 'generate_deliverable');
    console.log(`[MINDMAP] tool-calls=${JSON.stringify(toolCalls.map((t) => t.name))}`);
    expect(gd, 'live model must emit generate_deliverable').toBeTruthy();
    console.log(`[MINDMAP] tool args=${JSON.stringify(gd!.args)}`);
    expect(gd!.args?.type).toBe('mindmap');
    expect(gd!.result?.data?.ok ?? gd!.result?.ok).toBe(true);

    const payload = delivered.find((d) => d.kind === 'mindmap');
    expect(payload?.draftId).toBeTruthy();
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
      const mapRows = await client.query(
        `SELECT nodes_json, preferred_tool FROM my_idea_maps WHERE idea_id = $1`,
        [draftId]
      );
      expect(mapRows.rows.length).toBeGreaterThan(0);
      expect(mapRows.rows[0].preferred_tool).toBe('mindmap');
      const nodes = JSON.parse(mapRows.rows[0].nodes_json || '[]');
      expect(nodes.length).toBeGreaterThan(0);
      console.log(
        `[MINDMAP] GREEN my_ideas.id=${draftId} preferred_tool=mindmap nodes=${nodes.length}`
      );
    } finally {
      await client.end();
    }
  }, 180_000);
});

// ===========================================================================
// 3) TABLE — "zrób tabelę pomysłów"  (+ the AIPipeline per-turn table directive)
// ===========================================================================
describe('Acceptance: TERESA live tool-call — table', () => {
  it('LIVE model emits generate_deliverable(type=table) and a real my_ideas/my_idea_maps row lands', async () => {
    // Mirror the per-turn directive AIPipeline.ts injects for a 'table' intent
    // (systemPromptStr += [NADPISANIE NA TĘ TURĘ] … MUSISZ wywołać
    // generate_deliverable z type="table"). This is real runtime behavior, not
    // a test crutch — without it the global persona answers with an inline
    // markdown table instead of a tool call.
    const tableDirective =
      '\n\n[NADPISANIE NA TĘ TURĘ] Użytkownik prosi o UTWORZENIE TABELI. ' +
      'MUSISZ wywołać narzędzie generate_deliverable z type="table" (realna Tabela Pomysłów), ' +
      'aby otworzyła się po prawej. NIE odpowiadaj tabelą Markdown w treści. Najpierw wywołaj ' +
      'narzędzie, potem krótko potwierdź.';

    const { toolCalls, delivered } = await runChatTurn(
      'Zrób tabelę pomysłów na usprawnienia w dziale sprzedaży, z oceną wpływu i wysiłku.',
      personaPl + tableDirective
    );

    const gd = toolCalls.find((t) => t.name === 'generate_deliverable');
    console.log(`[TABLE] tool-calls=${JSON.stringify(toolCalls.map((t) => t.name))}`);
    expect(gd, 'live model must emit generate_deliverable').toBeTruthy();
    console.log(`[TABLE] tool args=${JSON.stringify(gd!.args)}`);
    expect(gd!.args?.type).toBe('table');
    expect(gd!.result?.data?.ok ?? gd!.result?.ok).toBe(true);

    const payload = delivered.find((d) => d.kind === 'table');
    expect(payload?.draftId).toBeTruthy();
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
      const mapRows = await client.query(
        `SELECT nodes_json, preferred_tool FROM my_idea_maps WHERE idea_id = $1`,
        [draftId]
      );
      expect(mapRows.rows.length).toBeGreaterThan(0);
      expect(mapRows.rows[0].preferred_tool).toBe('table');
      const nodes = JSON.parse(mapRows.rows[0].nodes_json || '[]');
      expect(nodes.length).toBeGreaterThan(0);
      console.log(
        `[TABLE] GREEN my_ideas.id=${draftId} preferred_tool=table nodes=${nodes.length}`
      );
    } finally {
      await client.end();
    }
  }, 180_000);
});
