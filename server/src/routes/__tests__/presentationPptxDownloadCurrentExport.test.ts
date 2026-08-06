/** @vitest-environment node */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

async function downloadHandlerSource(): Promise<string> {
  const routePath = fileURLToPath(new URL('../presentations.routes.ts', import.meta.url));
  const source = fs.readFileSync(routePath, 'utf8');
  const start = source.indexOf("'/decks/:id/download',");
  expect(start).toBeGreaterThan(-1);
  const rest = source.slice(start);
  const end = rest.indexOf("'/decks/:deckId/export/pdf',");
  expect(end).toBeGreaterThan(-1);
  return rest.slice(0, end).replace(/\s+/g, ' ');
}

describe('GET /decks/:id/download — current PPTX contract', () => {
  it('attempts current-version rendering even when export_path is absent', async () => {
    const handler = await downloadHandlerSource();
    expect(handler).toContain('freshDeck = await ensureCurrentPptxExport(deck)');
    expect(handler).not.toMatch(/!deck\s*\|\|\s*!deck\.export_path/);
    expect(handler).not.toMatch(/fs\.existsSync\(deck\.export_path\)/);
  });

  it('fails closed with a stable code and sends only the ensured current path', async () => {
    const handler = await downloadHandlerSource();
    expect(handler).toContain("code: 'PPTX_CURRENT_RENDER_FAILED'");
    expect(handler).toContain('res.sendFile(path.resolve(freshDeck.export_path))');
    expect(handler).not.toContain('res.sendFile(path.resolve(deck.export_path))');
  });

  it('records an export rejected by limits as failed, never completed', async () => {
    const handler = await downloadHandlerSource();
    const limitStart = handler.indexOf('if (!limitCheck.ok)');
    const limitBranch = handler.slice(limitStart, handler.indexOf('const filename', limitStart));
    expect(limitBranch).toContain("status: 'failed'");
    expect(limitBranch).not.toContain("status: 'completed'");
  });
});
