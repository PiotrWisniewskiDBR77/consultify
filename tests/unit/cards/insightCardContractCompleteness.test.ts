import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INSIGHT_CARD_RENDER_IDS, INSIGHT_CARD_SPEC } from '../../../src/components/Interview/insightCardContract';

describe('DEC-387 — kontrakt karty Insight zachowuje komplet sekcji', () => {
  it('M1: katalog pokrywa wszystkie id kontraktu renderu', () => expect(INSIGHT_CARD_SPEC.catalog.map((c) => c.id).sort()).toEqual([...INSIGHT_CARD_RENDER_IDS].sort()));
  it('M2: domyślny zestaw jest permutacją id kontraktu renderu', () => expect([...INSIGHT_CARD_SPEC.sets[0].cards].sort()).toEqual([...INSIGHT_CARD_RENDER_IDS].sort()));
  it('M3: domyślny zestaw nie ma duplikatów', () => expect(new Set(INSIGHT_CARD_SPEC.sets[0].cards).size).toBe(INSIGHT_CARD_SPEC.sets[0].cards.length));
  it('M4: realny widok przekazuje kontrakt do useCardLayout', () => expect(fs.readFileSync(path.resolve(__dirname, '../../../src/components/Interview/InsightViewer.tsx'), 'utf8')).toMatch(/spec: insightCardContractEnabled \? INSIGHT_CARD_SPEC : undefined/));
});
