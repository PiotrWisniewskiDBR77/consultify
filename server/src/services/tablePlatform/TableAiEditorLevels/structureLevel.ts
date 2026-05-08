/**
 * Level 4: Structure Edit (Block C · EPIC-T10 · Sprint C-S1 stub)
 *
 * Real handler (C-S2) will:
 *   - Reorder columns, group columns into "sections", apply table-wide
 *     formatting passes.
 *   - Bulk merges/splits at the table level (e.g. "merge duplicate rows").
 *   - LLM produces composite operations validated against tenant ACL.
 */

import type { LevelHandler, LevelStubOutput } from './index.js';

export const proposeStructureEdit: LevelHandler = async ({ prompt }) => {
  const out: LevelStubOutput = {
    handlerStatus: 'stub',
    summary: `[stub:structure] ${prompt.slice(0, 200)}`,
    operations: [],
    warnings: ['handler_is_stub_c_s1'],
    confidence: 0,
  };
  return out;
};
