/**
 * @vitest-environment node
 *
 * Regression contract for the manual Deck Builder rename path. The builder
 * sends the complete Deck document to the autosave endpoint; the route must
 * atomically update both deck_json and the presentation_decks.title projection
 * used by GET /decks/:id on a cold reopen.
 */
import { describe, expect, it } from 'vitest';

async function readRouterSource(): Promise<string> {
  const fs = await import('node:fs');
  const url = await import('node:url');
  const path = url.fileURLToPath(new URL('../presentations.routes.ts', import.meta.url));
  return fs.readFileSync(path, 'utf8');
}

function autosaveHandler(source: string): string {
  const start = source.indexOf("'/decks/:deckId/autosave'");
  expect(start).toBeGreaterThan(-1);
  const after = source.slice(start);
  const end = after.indexOf("router.post(\n  '/decks/:deckId/agent-edit'");
  expect(end).toBeGreaterThan(-1);
  return after.slice(0, end);
}

describe('presentation autosave title persistence', () => {
  it('reads the existing title and writes the edited title in the CAS update', async () => {
    const handler = autosaveHandler(await readRouterSource());

    expect(handler).toContain('SELECT id, title, version, deck_json');
    expect(handler).toContain('canonicalizePresentationAutosaveDeck(req.body)');
    expect(handler).toContain("typeof canonicalBody.title === 'string'");
    expect(handler).toMatch(
      /UPDATE presentation_decks SET title = \?, deck_json = \?, slide_count = \?, version = \?/
    );
    expect(handler).toContain('[canonicalTitle, bodyStr, canonicalSlideCount, newVersion');
    expect(handler).toContain('AND organization_id = ? AND version = ?');
  });
});
