import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DECISION_CARD_RENDER_IDS, DECISION_CARD_SPEC } from '../../../src/components/MyWork/decisionCardContract';

describe('DEC-387 — kontrakt karty Decision zachowuje komplet sekcji', () => {
  it('M1: katalog pokrywa wszystkie renderowane sekcje', () => expect(DECISION_CARD_SPEC.catalog.map((c) => c.id).sort()).toEqual([...DECISION_CARD_RENDER_IDS].sort()));
  it('M2: domyślny zestaw jest permutacją renderowanych sekcji', () => expect([...DECISION_CARD_SPEC.sets[0].cards].sort()).toEqual([...DECISION_CARD_RENDER_IDS].sort()));
  it('M3: domyślny zestaw nie ma duplikatów', () => expect(new Set(DECISION_CARD_SPEC.sets[0].cards).size).toBe(DECISION_CARD_SPEC.sets[0].cards.length));
  it('M4: realny widok jest stale sterowany kontraktem', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../src/components/MyWork/DecisionDetailView.tsx'), 'utf8');
    expect(source).toMatch(/spec: DECISION_CARD_SPEC/);
    expect(source).toMatch(/sekcjeZKontraktu\(DECISION_CARDS, 'decision'\)/);
    expect(source).not.toContain('VITE_VF1_DECISION_CARD_CONTRACT');
  });
});
