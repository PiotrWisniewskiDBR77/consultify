/**
 * SIDE_EFFECT_TOOLS — direct SSOT coverage (2026-07-26).
 *
 * Decyzja właściciela: `create_task`, `update_task`, `create_decision` mają
 * być objęte tą samą bramką akceptu co pozostałe narzędzia mutujące
 * (create_initiative_draft, generate_report_section, schedule_meeting,
 * create_notebook_entry, query_structured_data) — Harvey benchmark: agent
 * proponuje, człowiek zatwierdza. Ten test istnieje żeby przyszła zmiana Setu
 * (np. przypadkowe usunięcie jednego z tych trzech) padła na czerwono zamiast
 * cicho odblokować natychmiastowy zapis — patrz `agentPlannerService.ts:106`
 * i `planBuilderService.ts:61`, które czytają ten Set jako jedyne źródło
 * prawdy o `requiresApproval`.
 */
import { describe, expect, it } from 'vitest';

import { SIDE_EFFECT_TOOLS } from '../../../server/src/services/ai/sideEffectTools.js';

describe('SIDE_EFFECT_TOOLS', () => {
  it('gates the three My Work writers added 2026-07-26 (decyzja właściciela)', () => {
    expect(SIDE_EFFECT_TOOLS.has('create_task')).toBe(true);
    expect(SIDE_EFFECT_TOOLS.has('update_task')).toBe(true);
    expect(SIDE_EFFECT_TOOLS.has('create_decision')).toBe(true);
  });

  it('still gates the five pre-existing side-effect tools (no regression)', () => {
    expect(SIDE_EFFECT_TOOLS.has('create_initiative_draft')).toBe(true);
    expect(SIDE_EFFECT_TOOLS.has('generate_report_section')).toBe(true);
    expect(SIDE_EFFECT_TOOLS.has('schedule_meeting')).toBe(true);
    expect(SIDE_EFFECT_TOOLS.has('create_notebook_entry')).toBe(true);
    expect(SIDE_EFFECT_TOOLS.has('query_structured_data')).toBe(true);
  });

  it('does not gate pure read/calculation tools (unaffected by this change)', () => {
    expect(SIDE_EFFECT_TOOLS.has('search_web')).toBe(false);
    expect(SIDE_EFFECT_TOOLS.has('search_knowledge_base')).toBe(false);
    expect(SIDE_EFFECT_TOOLS.has('calculate_financial')).toBe(false);
  });

  it('has exactly 8 entries (drift guard — bump this deliberately, not by accident)', () => {
    expect(SIDE_EFFECT_TOOLS.size).toBe(8);
  });
});
