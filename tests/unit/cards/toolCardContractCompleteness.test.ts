import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOL_CARD_RENDER_IDS, TOOL_CARD_SPEC } from '../../../src/components/DiscoveryTools/toolCards.contract';

describe('DEC-387 — kontrakt karty Tool zachowuje komplet sekcji', () => {
  it('M1: katalog pokrywa wszystkie renderowane sekcje', () => expect(TOOL_CARD_SPEC.catalog.map((c) => c.id).sort()).toEqual([...TOOL_CARD_RENDER_IDS].sort()));
  it('M2: domyślny zestaw jest permutacją renderowanych sekcji', () => expect([...TOOL_CARD_SPEC.sets[0].cards].sort()).toEqual([...TOOL_CARD_RENDER_IDS].sort()));
  it('M3: domyślny zestaw nie ma duplikatów', () => expect(new Set(TOOL_CARD_SPEC.sets[0].cards).size).toBe(TOOL_CARD_SPEC.sets[0].cards.length));
  it('M4: realny widok przekazuje kontrakt do useCardLayout', () => expect(fs.readFileSync(path.resolve(__dirname, '../../../src/components/DiscoveryTools/KnownToolDetailView.tsx'), 'utf8')).toMatch(/spec: toolCardContractEnabled \? TOOL_CARD_SPEC : TOOL_CARD_SPEC_ALL_VISIBLE/));
});
