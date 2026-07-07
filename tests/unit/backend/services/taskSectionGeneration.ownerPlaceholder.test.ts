/**
 * taskSectionGenerationService — owner-placeholder ban (sędzia BCG #2b)
 *
 * Reproduces the reported defect: a generated Task card carried
 * "WŁAŚCICIEL DANYCH: [DO UZUPEŁNIENIA - wskazać osobę…]" — a bracketed
 * placeholder posing as a field, even though the task already has a real
 * assignee (taskExecutor sets assignee_id = the creator's userId).
 *
 * The fix is instruction-level: the task doctrine SYSTEM prompt now bans
 * bracketed fill-in placeholders and tells the model to use the provided
 * owner/assignee or omit the owner field. This test is deterministic (no LLM):
 * it asserts the ban is present in the doctrine text so a future prompt edit
 * that drops it fails CI.
 *
 * @module tests/unit/backend/services/taskSectionGeneration.ownerPlaceholder.test.ts
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  TASK_DOCTRINE_SYSTEM_PROMPT,
  TASK_DOCTRINE_SYSTEM_PROMPT_EN,
} from '../../../../server/src/services/taskSectionGenerationService.js';

describe('task doctrine — owner placeholder ban', () => {
  it('PL doctrine forbids bracketed fill-in placeholders and names [DO UZUPEŁNIENIA]', () => {
    expect(TASK_DOCTRINE_SYSTEM_PROMPT).toContain('DO UZUPEŁNIENIA');
    // It must instruct to OMIT the owner section when the person is unknown.
    expect(TASK_DOCTRINE_SYSTEM_PROMPT).toMatch(/POMIŃ sekcję właściciela/i);
  });

  it('EN doctrine forbids bracketed fill-in placeholders and says to omit the owner', () => {
    expect(TASK_DOCTRINE_SYSTEM_PROMPT_EN).toMatch(/TO BE FILLED/i);
    expect(TASK_DOCTRINE_SYSTEM_PROMPT_EN).toMatch(/OMIT the owner/i);
  });

  it('quotes the defect example only as a NEGATIVE (a banned pattern, not a template)', () => {
    // The rule-9 line must carry a ban verb (NIGDY / ZAKAZ / nie emituj) so the
    // placeholder is presented as forbidden, never as content to output.
    const rule9 = TASK_DOCTRINE_SYSTEM_PROMPT.split('\n').find((l) =>
      l.includes('DO UZUPEŁNIENIA'),
    );
    expect(rule9).toBeDefined();
    expect(rule9 as string).toMatch(/NIGDY|ZAKAZ|nie emituj/i);
  });
});
