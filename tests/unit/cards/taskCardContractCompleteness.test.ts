import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TASK_CARD_RENDER_IDS, TASK_CARD_SPEC } from '../../../src/components/MyWork/taskCardContract';

describe('DEC-387 — kontrakt karty Task zachowuje komplet sekcji', () => {
  it('M1: katalog pokrywa wszystkie renderowane sekcje', () => expect(TASK_CARD_SPEC.catalog.map((c) => c.id).sort()).toEqual([...TASK_CARD_RENDER_IDS].sort()));
  it('M2: domyślny zestaw jest permutacją renderowanych sekcji', () => expect([...TASK_CARD_SPEC.sets[0].cards].sort()).toEqual([...TASK_CARD_RENDER_IDS].sort()));
  it('M3: domyślny zestaw nie ma duplikatów', () => expect(new Set(TASK_CARD_SPEC.sets[0].cards).size).toBe(TASK_CARD_SPEC.sets[0].cards.length));
  it('M4: realny widok przekazuje kontrakt do useCardLayout', () => expect(fs.readFileSync(path.resolve(__dirname, '../../../src/components/MyWork/TaskDetailView.tsx'), 'utf8')).toMatch(/spec: taskCardContractEnabled \? TASK_CARD_SPEC : undefined/));
});
