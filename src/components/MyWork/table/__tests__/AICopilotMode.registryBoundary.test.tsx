/**
 * AICopilotMode — registry boundary test (N-inventory-b-medium, 2026-08-10).
 *
 * `04_ACTION_COVERAGE_INVENTORY.csv` flagged `AICopilotMode.tsx`'s
 * `handleSend` (the chat "Send" button, ~L431) as a lower-confidence class-b
 * ("intentional non-command") row. Fail-closed re-analysis: `handleSend` is a
 * genuinely internal conversational turn — it appends to LOCAL `messages`
 * state and calls `Api.getIdeaAISuggestions` (a read-only suggestion fetch,
 * no persisted proposal object), never touching the Idea's actual Table data
 * directly. The real, already-covered-by-the-"open panel"-registry-entry
 * convention (`idea.ai.table_copilot`, `mutates: false`) holds ONLY as long
 * as `handleSend` stays a pure "ask a question, show an answer" turn and the
 * ACTUAL row mutation stays confined to the separate, explicit
 * `handleAddSuggestion` → `onAddRows(...)` click.
 *
 * This test enforces that boundary mechanically: if `handleSend` ever starts
 * calling `onAddRows`/`onUpdateNode` directly (i.e. becomes a real,
 * standalone mutating command hiding inside "just chat"), this test breaks —
 * that is the trigger to register a real `mutates: true` action for it
 * instead of leaving it uncovered. Static source scan (not a full render):
 * `handleSend`'s async streaming (`simulateStreaming`, random-interval
 * `setInterval`) makes a rendered end-to-end test slow/flaky for what is a
 * pure "does this function call that prop" boundary check.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE_PATH = path.resolve(__dirname, '../AICopilotMode.tsx');
const SOURCE = readFileSync(SOURCE_PATH, 'utf-8');

/**
 * Extracts the body of a top-level `const <name> = useCallback(` (or
 * `useCallback(async ...`) declaration by brace-matching from its opening
 * `{` to the matching closing `}`, so the check only inspects that one
 * handler — not the whole file (which legitimately calls `onAddRows` inside
 * `handleAddSuggestion`).
 */
function extractCallbackBody(source: string, constName: string): string {
  const declMatch = source.match(
    new RegExp(`const ${constName} = useCallback\\(\\s*(?:async\\s*)?\\([^)]*\\)\\s*(?::[^{]*)?=>\\s*{`)
  );
  if (!declMatch || declMatch.index === undefined) {
    throw new Error(
      `Could not find "const ${constName} = useCallback(...) => {" in ${SOURCE_PATH} — ` +
        'AICopilotMode.tsx was restructured; update this boundary test to match.'
    );
  }
  const bodyStart = declMatch.index + declMatch[0].length;
  let depth = 1;
  let i = bodyStart;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
  }
  return source.slice(bodyStart, i - 1);
}

describe('AICopilotMode registry boundary (idea.ai.table_copilot decline)', () => {
  it('handleSend never calls onAddRows or onUpdateNode directly', () => {
    const handleSendBody = extractCallbackBody(SOURCE, 'handleSend');
    expect(handleSendBody).not.toMatch(/\bonAddRows\s*\(/);
    expect(handleSendBody).not.toMatch(/\bonUpdateNode\s*\(/);
  });

  it('the real row mutation still lives in the separate handleAddSuggestion handler', () => {
    // Confirms the seam this decline relies on still exists — if
    // handleAddSuggestion is ever removed/inlined, the "mutation is a
    // separate, explicit click" argument no longer holds either.
    const handleAddSuggestionBody = extractCallbackBody(SOURCE, 'handleAddSuggestion');
    expect(handleAddSuggestionBody).toMatch(/\bonAddRows\s*\(/);
  });
});
