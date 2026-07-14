/**
 * DOWÓD FIXA stale-regen 2026-07-14 — PRZED vs PO.
 *
 * PRZED: stara projekcja (intent zachowany + content spłaszczony do key_messages)
 *        → oczekiwane 8/12 slajdów "Render Error".
 * PO:    deckDocumentToRenderableUnifiedJson (merge unified_json + edycje z deck_json)
 *        → oczekiwane 0 błędów, edycje obecne w treści.
 *
 * Deck = 12 intentów jak w server/scripts/proof-deck-pptx.ts (branch proof-deck-pptx),
 * ale deck_json budowany PRODUKCYJNIE przez deckDocumentFromUnifiedJson (realne bloki,
 * jak w bazie), potem symulowana edycja jak autosave.
 */
import fs from 'fs';
import path from 'path';

import { PptxPipelineService } from '../src/services/report/pptx/PptxPipelineService.js';
import type { UnifiedReportJSON, UnifiedSlide } from '../src/services/report/pptx/types.js';
import {
  deckDocumentFromUnifiedJson,
  deckDocumentToUnifiedJson,
  deckDocumentToRenderableUnifiedJson,
  type DeckDocument,
} from '../src/services/presentationDeckDocumentService.js';

const outDir = process.argv[2] || process.cwd();
fs.mkdirSync(outDir, { recursive: true });

import { report } from './proof-deck-pptx.js';

function simulateEdits(deck: DeckDocument): DeckDocument {
  const edited: DeckDocument = JSON.parse(JSON.stringify(deck));
  // 1. Edycja tytułu karty exec summary (heading block + card.title)
  const exec = edited.cards.find((c) => c.intent === 'executive_summary')!;
  exec.title = 'EDITED HEADLINE: margins first, growth second';
  const execHeading = exec.blocks.find((b) => b.type === 'heading');
  if (execHeading) (execHeading.content as any).text = exec.title;
  // 2. Edycja bulleta w exec summary
  const execBullets = exec.blocks.find((b) => b.type === 'bullet_list');
  if (execBullets) (execBullets.content as any).items[0] = 'EDITED FINDING: pipeline grew 61% YoY';
  // 3. Edycja wiersza tabeli ryzyk
  const risk = edited.cards.find((c) => c.intent === 'risk_management')!;
  const riskTable = risk.blocks.find((b) => b.type === 'table');
  if (riskTable) (riskTable.content as any).rows[0][3] = 'EDITED MITIGATION: hire shadow engineers';
  // 4. Reorder: zamiana kolejności roadmap i risk_management
  const roadmap = edited.cards.find((c) => c.intent === 'roadmap')!;
  const tmp = roadmap.order_index;
  roadmap.order_index = risk.order_index;
  risk.order_index = tmp;
  // 5. Usunięcie karty comparison
  edited.cards = edited.cards.filter((c) => c.intent !== 'comparison');
  // 6. Dodanie nowej karty (jak dodany slajd w edytorze)
  edited.cards.push({
    card_id: 'card-added-by-user',
    deck_id: edited.deck_id,
    order_index: 99,
    intent: 'key_messages',
    layout_id: 'content_full',
    title: 'ADDED SLIDE: open questions',
    key_message: 'ADDED SLIDE: open questions',
    blocks: [
      {
        block_id: 'b-added-h', card_id: 'card-added-by-user', type: 'heading',
        content: { text: 'ADDED SLIDE: open questions' },
        is_refreshable: false, position: { area: 'full', order: 0 }, ai_editable: true,
      },
      {
        block_id: 'b-added-1', card_id: 'card-added-by-user', type: 'bullet_list',
        content: { items: ['Budget ceiling: PLN 1.2M or 1.5M?', 'Configurator vendor: build vs buy?'] },
        is_refreshable: false, position: { area: 'full', order: 1 }, ai_editable: true,
      },
    ],
    source_refs: [], has_refreshable_data: false,
    background: { type: 'theme' }, animations: { entrance: 'none', block_stagger: false },
    is_locked: false,
  } as any);
  return edited;
}

async function renderAndCount(label: string, unified: UnifiedReportJSON, file: string, skipValidation: boolean) {
  const pipeline = new PptxPipelineService();
  const result = await pipeline.generateFromUnifiedJson(unified, {
    template: 'corporate', language: 'en', confidentiality: 'confidential',
    ...(skipValidation ? { skipValidation: true } : {}),
  });
  const outPath = path.join(outDir, file);
  fs.writeFileSync(outPath, result.buffer);
  const failures = result.warnings.filter((w) => w.includes('render failed'));
  console.log(`\n=== ${label} ===`);
  console.log(`file: ${outPath} (${result.buffer.length} B, ${result.slideCount} slides)`);
  console.log(`render-failed slides: ${failures.length}`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  return { result, failures, outPath };
}

async function main() {
  // deck_json jak w bazie po generacji (realne bloki)
  const deckDoc = deckDocumentFromUnifiedJson({
    deckId: 'proof-deck', organizationId: 'org-proof',
    title: report.meta.project, unifiedJson: report,
    setup: { language: 'en', confidentiality: 'confidential', theme: 'corporate' },
    status: 'ready',
  });
  const editedDeck = simulateEdits(deckDoc);

  // ── PRZED: stara ścieżka = intent oryginalny + content spłaszczony ──
  const flattened = deckDocumentToUnifiedJson(editedDeck);
  const oldBehavior: UnifiedReportJSON = {
    meta: flattened.meta,
    slides: flattened.slides.map((s) => ({
      ...s,
      intent: ((s as any).source_intent || s.intent) as UnifiedSlide['intent'], // stary kod NIE koercował intentu
    })),
  };
  const before = await renderAndCount('PRZED (stary flatten, skipValidation:true)', oldBehavior, 'proof-before.pptx', true);

  // ── PO: merge unified_json + deck_json ──
  const merged = deckDocumentToRenderableUnifiedJson(editedDeck, report);
  const after = await renderAndCount('PO (merge, walidacja ON)', merged, 'proof-after.pptx', false);

  // Twarde asercje treściowe na scalonym JSON
  const mergedStr = JSON.stringify(merged);
  const checks: Array<[string, boolean]> = [
    ['edycja tytułu obecna', mergedStr.includes('EDITED HEADLINE')],
    ['edycja bulleta obecna', mergedStr.includes('EDITED FINDING')],
    ['edycja komórki tabeli obecna', mergedStr.includes('EDITED MITIGATION')],
    ['dodany slajd obecny', mergedStr.includes('ADDED SLIDE')],
    ['usunięty slajd (comparison) nieobecny', !merged.slides.some((s) => (s.content as any)?.type === 'comparison')],
    ['bogaty content zachowany: chart', merged.slides.some((s) => (s.content as any)?.chart_data)],
    ['bogaty content zachowany: maturity axes', merged.slides.some((s) => Array.isArray((s.content as any)?.axes))],
    ['bogaty content zachowany: kpis', merged.slides.some((s) => (s.content as any)?.type === 'performance_overview' && Array.isArray((s.content as any)?.kpis))],
    ['reorder: risk przed roadmap', merged.slides.findIndex((s) => (s.content as any)?.type === 'risk_management') < merged.slides.findIndex((s) => (s.content as any)?.type === 'roadmap')],
    ['budżet inicjatywy (pole tracone przez bloki) zachowany z bazy', mergedStr.includes('PLN 850k')],
  ];
  console.log('\n=== ASERCJE TREŚCIOWE (PO) ===');
  let allOk = true;
  for (const [name, ok] of checks) { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) allOk = false; }

  console.log('\n=== WYNIK ===');
  console.log(`PRZED: ${before.failures.length} Render Error | PO: ${after.failures.length} Render Error | asercje: ${allOk ? 'OK' : 'FAIL'}`);
  if (after.failures.length > 0 || !allOk) process.exit(1);
}

main().catch((err) => { console.error('PROOF FAILED:', err); process.exit(1); });
