/**
 * Teresa chat "create X" -> generate_deliverable tool-call -> artifact creation.
 *
 * HONEST STATUS: SKIPPED BY DESIGN under this mock-AI harness. Verified directly
 * (not inferred) against server/src/services/ai/llmService.ts:637-661:
 *
 *   if (isQaAiMode()) {
 *     const content = buildQaAiText(params);
 *     ... return canned text/stream/structured object ...
 *   }
 *   ... (tool-dispatch branch, `if (tools && tools.length > 0)`, is at line 696 --
 *        AFTER the mock short-circuit, so it is never reached in QA/mock mode)
 *
 * `isQaAiMode()` is true whenever QA_AI_MODE / AI_PROVIDER_MODE=mock /
 * CONSULTIFY_MOCK_AI is set (server/src/services/ai/qaAiRuntime.ts:7-17) --
 * exactly the mode this harness runs under (QA_AI_MODE=true AI_PROVIDER_MODE=mock
 * per the task's required env). `buildQaAiText` (qaAiRuntime.ts:42-57) always
 * returns a fixed "QA MOCK RESPONSE" text block; it never inspects `params.tools`,
 * so `generate_deliverable` (server/src/services/ai/tools/generateDeliverable.ts,
 * registered in mcpServer.ts:134 and wired into AIPipeline.ts:337-361 /
 * ai.routes.ts:1420-4253) is never invoked, no SSE `{type:'deliverable'}` event
 * is ever emitted, and `seedGraph` (consumed client-side in
 * IdeaMapWorkspace.tsx:1387-1400/1841 via UnifiedChatPanel.tsx:1742-1760) is
 * never populated from a real chat turn.
 *
 * Practical effect: asking Teresa "create a process flow / idea table /
 * whiteboard / note" in QA_AI_MODE returns plain canned text -- NO artifact is
 * created, no navigation happens, no deliverable card renders. There is
 * currently no server-side mock branch that simulates a tool-call return when
 * `tools` is present. Faking this assertion (e.g. by intercepting
 * /api/*chat/stream and injecting a client-side fake SSE event) would test
 * nothing about the real generate_deliverable pipeline, so per the task's
 * explicit instruction ("honesty > green"), every scenario below is a
 * documented test.skip with the artifact type it targets, so this file can be
 * turned into real assertions the moment either:
 *   (a) qaAiRuntime.ts gains a tool-call-aware mock branch, or
 *   (b) these are re-run against a live LLM provider (staging/demo, not
 *       QA_AI_MODE).
 *
 * Manual verification path for Piotr on live demo: open /chat, send each
 * prompt below, and confirm the SSE `deliverable` event fires + the canvas
 * panel mounts the matching tool (see UnifiedChatPanel.tsx handlers around
 * lines 2415-2498, 2637-2749, 2885-2956, 4471).
 */
import { test } from '@playwright/test';

const DELIVERABLE_PROMPTS: Array<{ label: string; prompt: string; expectedType: string }> = [
  { label: 'process flow', prompt: 'Stwórz proces wdrożenia klienta krok po kroku.', expectedType: 'process_flow' },
  { label: 'idea table', prompt: 'Stwórz tabelę pomysłów na usprawnienia w dziale sprzedaży.', expectedType: 'table' },
  { label: 'whiteboard', prompt: 'Stwórz tablicę do burzy mózgów dla nowego produktu.', expectedType: 'whiteboard' },
  { label: 'note', prompt: 'Stwórz notatkę z podsumowaniem tej rozmowy.', expectedType: 'note' },
];

test.describe('Teresa chat — generate_deliverable artifact creation [@module:ai-chat]', () => {
  for (const { label, prompt, expectedType } of DELIVERABLE_PROMPTS) {
    test(`"create ${label}" would create a ${expectedType} artifact (requires live AI)`, async () => {
      test.skip(
        true,
        `QA_AI_MODE mock short-circuits before tool-dispatch (llmService.ts:637 isQaAiMode() ` +
          `returns canned text at line 638, tool-call branch at line 696 is unreachable) -- ` +
          `generate_deliverable is never invoked, so prompt "${prompt}" cannot produce a real ` +
          `${expectedType} artifact under this harness. Verified by reading llmService.ts + ` +
          `qaAiRuntime.ts directly (no keyword-routing to artifact types exists in mock mode). ` +
          `Needs live AI_PROVIDER_MODE (real LLM) on staging/demo for a genuine assertion -- ` +
          `flag for Piotr's live-demo acceptance pass.`
      );
    });
  }
});
