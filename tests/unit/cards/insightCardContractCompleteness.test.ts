import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INSIGHT_CARD_RENDER_IDS, INSIGHT_CARD_SPEC } from '../../../src/components/Interview/insightCardContract';
import { getCardSpec } from '../../../src/components/shared/NModeLayout/cardSets';

describe('DEC-387 — kontrakt karty Insight zachowuje komplet sekcji', () => {
  it('M1: katalog pokrywa wszystkie id kontraktu renderu', () => expect(INSIGHT_CARD_SPEC.catalog.map((c) => c.id).sort()).toEqual([...INSIGHT_CARD_RENDER_IDS].sort()));
  it('M2: domyślny zestaw zachowuje widoczność starego kontraktu i jego extras', () => {
    const legacy = getCardSpec('insight')!;
    const legacyCatalog = new Set(legacy.catalog.map((c) => c.id));
    const legacyVisible = new Set(legacy.sets[0].cards);
    const expected = INSIGHT_CARD_RENDER_IDS.filter((id) => legacyVisible.has(id) || !legacyCatalog.has(id));
    expect([...INSIGHT_CARD_SPEC.sets[0].cards].sort()).toEqual([...expected].sort());
  });
  it('M3: domyślny zestaw nie ma duplikatów', () => expect(new Set(INSIGHT_CARD_SPEC.sets[0].cards).size).toBe(INSIGHT_CARD_SPEC.sets[0].cards.length));
  it('M4: realny widok przekazuje kontrakt do useCardLayout', () => expect(fs.readFileSync(path.resolve(__dirname, '../../../src/components/Interview/InsightViewer.tsx'), 'utf8')).toMatch(/spec: insightCardContractEnabled \? INSIGHT_CARD_SPEC : undefined/));
});
