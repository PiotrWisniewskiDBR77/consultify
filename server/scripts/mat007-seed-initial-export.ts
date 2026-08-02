/**
 * MAT-007/009 test-only helper (NOT part of the app, not imported anywhere) —
 * seeds an initial PPTX export_path for a deck created via the structured
 * `POST /decks` route, whose creation path (unlike the AI `generateDeck()`
 * pipeline) never renders a physical PPTX file. This mirrors exactly the
 * render step `presentationGeneratorService.ts` runs at the tail of
 * `generateDeck()` — same `PptxPipelineService`, same
 * `deckDocumentToUnifiedJson` conversion, same `presentation_decks` UPDATE
 * shape — so the golden-flow proof can exercise the REAL, existing
 * `GET /decks/:id/download` contract (freshness re-render, quality gates,
 * org scope, content-type) against a deck whose content actually reflects
 * the MAT-007/009 fix, instead of inventing a new export path.
 *
 * Run once against the local throwaway Postgres set up for this proof:
 *   DATABASE_URL=... DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *     npx tsx server/scripts/mat007-seed-initial-export.ts <deckId>
 */
import fs from 'fs';
import path from 'path';

import '../src/config/loadEnv.js';
import { get as dbGet, run as dbRun } from '../src/utils/DbPromise.js';
import { deckDocumentToUnifiedJson, normalizeDeckDocument } from '../src/services/presentationDeckDocumentService.js';
import { PptxPipelineService } from '../src/services/report/pptx/PptxPipelineService.js';
import { exportsDir } from '../src/utils/storagePaths.js';

async function main() {
  const deckId = process.argv[2];
  if (!deckId) {
    console.error('Usage: tsx mat007-seed-initial-export.ts <deckId>');
    process.exit(1);
  }
  const row = (await dbGet(`SELECT * FROM presentation_decks WHERE id = ?`, [deckId])) as any;
  if (!row) throw new Error('deck not found: ' + deckId);
  const deckDocument = normalizeDeckDocument(row);
  if (!deckDocument) throw new Error('deck has no canonical content to export');

  const unifiedJson = deckDocumentToUnifiedJson(deckDocument);
  const pipeline = new PptxPipelineService();
  const result = await pipeline.generateFromUnifiedJson(unifiedJson, {
    template: deckDocument.theme_id || 'corporate',
    language: 'en',
    skipValidation: false,
  });

  const exportDir = exportsDir('presentations');
  const exportPath = path.join(exportDir, `${deckId}.pptx`);
  fs.writeFileSync(exportPath, result.buffer);

  await dbRun(
    `UPDATE presentation_decks SET export_path = ?, export_format = 'pptx', exported_at = CURRENT_TIMESTAMP, updated_at = updated_at WHERE id = ?`,
    [exportPath, deckId]
  );
  console.log('seeded export_path:', exportPath, 'bytes:', result.buffer.length, 'slideCount:', result.slideCount);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
