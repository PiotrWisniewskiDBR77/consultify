/**
 * STEP 1b proof — DETERMINISTIC, no browser, no API keys.
 *
 * Runs the REAL renderer decision functions (selectLayout, assignBlocksToRegions
 * from src/components/Presentations/DeckBuilder/layouts/LayoutEngine.ts) over the
 * VTS fixture twice per card:
 *   BEFORE = composition stripped  → today's heuristic
 *   AFTER  = composition present   → Step 1b honours B1's plan
 * and prints, per slide, whether the chosen layout template and/or the block→region
 * assignment CHANGED. This is the load-bearing proof that composition steers layout;
 * the PNG screenshots (render-slides.mts) are the visual dressing of the same fact.
 *
 * RUN:  node --import tsx scripts/deliverables/step1b/_prove-composition-layout.mts
 */
import { VTS_CARDS } from './fixture.vts.js';
import {
  assignBlocksToRegions,
  selectLayout,
} from '../../../src/components/Presentations/DeckBuilder/layouts/LayoutEngine.js';
import type { DeckCard } from '../../../src/components/Presentations/wizard/types.js';

function strip(card: DeckCard): DeckCard {
  return { ...card, composition: null, layout_id: 'auto' };
}

function regionSig(card: DeckCard, withComposition: boolean): { layoutId: string; assignment: string } {
  const c = withComposition ? card : strip(card);
  const layout = selectLayout(c);
  const map = assignBlocksToRegions(c.blocks, layout, withComposition ? c.composition : null);
  const parts: string[] = [];
  for (const region of layout.regions) {
    const blocks = (map.get(region.area) || []).map((b) => b.type);
    parts.push(`${region.area}:[${blocks.join(',')}]`);
  }
  return { layoutId: layout.id, assignment: parts.join(' | ') };
}

let layoutChanged = 0;
let assignChanged = 0;
let anyChanged = 0;

console.log('=== STEP 1b — composition vs heuristic (real renderer functions) ===\n');
for (const card of VTS_CARDS) {
  const before = regionSig(card, false);
  const after = regionSig(card, true);
  const lChanged = before.layoutId !== after.layoutId;
  const aChanged = before.assignment !== after.assignment;
  if (lChanged) layoutChanged++;
  if (aChanged) assignChanged++;
  if (lChanged || aChanged) anyChanged++;

  console.log(`Slide ${card.order_index} — ${card.intent} — "${card.title}"`);
  console.log(`  B1 variant: ${card.composition?.layoutVariantId} (emphasis=${card.composition?.emphasis})`);
  console.log(`  BEFORE layout=${before.layoutId}`);
  console.log(`         regions ${before.assignment}`);
  console.log(`  AFTER  layout=${after.layoutId}`);
  console.log(`         regions ${after.assignment}`);
  console.log(
    `  → layout ${lChanged ? 'CHANGED ✓' : 'same'}  |  assignment ${aChanged ? 'CHANGED ✓' : 'same'}\n`
  );
}

console.log('=== SUMMARY ===');
console.log(`  slides: ${VTS_CARDS.length}`);
console.log(`  layout template changed:   ${layoutChanged}/${VTS_CARDS.length}`);
console.log(`  region assignment changed: ${assignChanged}/${VTS_CARDS.length}`);
console.log(`  ANY visible change:        ${anyChanged}/${VTS_CARDS.length}`);
console.log(
  anyChanged > 0
    ? '  VERDICT: composition DEMONSTRABLY changes the rendered layout ✓'
    : '  VERDICT: no change — investigate wiring'
);
process.exit(anyChanged > 0 ? 0 : 1);
