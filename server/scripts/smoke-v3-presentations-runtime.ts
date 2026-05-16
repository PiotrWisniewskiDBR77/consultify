#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean };

function read(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((needle) => content.includes(needle));
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const routes = read(root, 'server/src/routes/presentations.routes.ts');
  const deckBuilder = read(root, 'src/components/Presentations/DeckBuilder/DeckBuilder.tsx');
  const exportService = read(root, 'src/services/presentationExport.ts');
  const agentPanel = read(root, 'src/components/Presentations/DeckBuilder/AgentPanel.tsx');
  const mediaBrowser = read(root, 'src/components/Presentations/DeckBuilder/MediaLibraryBrowser.tsx');

  checks.push({
    name: 'Presentations backend exposes deck PDF export and agent edit endpoints',
    pass: includesAll(routes, [
      "'/decks/:deckId/export/pdf'",
      "'/decks/:deckId/agent-edit'",
      "'/decks/:deckId/agent-edit/:operationId/accept'",
      'deck_json = ?',
    ]),
  });

  checks.push({
    name: 'Deck builder export buttons hit real deck endpoints with correct formats',
    pass:
      includesAll(deckBuilder, ['exportPresentationDeck({ deckId: deck.deck_id, title: deck.title, format })']) &&
      includesAll(exportService, [
        '/api/presentations/decks/${deckId}/download',
        '/api/presentations/decks/${deckId}/export/png',
        '/api/presentations/decks/${deckId}/export/${format}',
        "extension: 'zip'",
      ]),
  });

  checks.push({
    name: 'Deck AI panel exposes runtime activity feed without local chat stub',
    pass:
      includesAll(agentPanel, [
        'AgentActivityPanel',
        'events = []',
        'degraded = false',
      ]) &&
      !agentPanel.includes('AI deck editing is coming soon. This feature is not yet connected to a backend.'),
  });

  checks.push({
    name: 'Media library remains wired to presentation media endpoints',
    pass: includesAll(mediaBrowser, [
      '/api/presentations/media?',
      '/api/presentations/media/upload',
      'Upload images',
    ]),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-v3-presentations-runtime] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-v3-presentations-runtime] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error(
    '[smoke-v3-presentations-runtime] Failed:',
    (error as Error)?.message || error
  );
  process.exit(1);
}
