import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INTERVIEW_CARD_RENDER_IDS, INTERVIEW_CARD_SPEC } from '../../../src/components/Interview/interviewCardContract';

describe('DEC-387 — kontrakt karty Interview zachowuje komplet sekcji', () => {
  it('M1: katalog pokrywa wszystkie renderowane sekcje', () => expect(INTERVIEW_CARD_SPEC.catalog.map((c) => c.id).sort()).toEqual([...INTERVIEW_CARD_RENDER_IDS].sort()));
  it('M2: domyślny zestaw jest permutacją renderowanych sekcji', () => expect([...INTERVIEW_CARD_SPEC.sets[0].cards].sort()).toEqual([...INTERVIEW_CARD_RENDER_IDS].sort()));
  it('M3: domyślny zestaw nie ma duplikatów', () => expect(new Set(INTERVIEW_CARD_SPEC.sets[0].cards).size).toBe(INTERVIEW_CARD_SPEC.sets[0].cards.length));
  it('M4: realny widok przekazuje kontrakt do useCardLayout', () => expect(fs.readFileSync(path.resolve(__dirname, '../../../src/components/Interview/InterviewWorkspace.tsx'), 'utf8')).toMatch(/spec: interviewCardContractEnabled \? INTERVIEW_CARD_SPEC : undefined/));
});
