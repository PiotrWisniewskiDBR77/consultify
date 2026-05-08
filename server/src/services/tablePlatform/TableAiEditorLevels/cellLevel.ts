/**
 * Level 1: Cell Edit (Block C · EPIC-T10 · Sprint C-S1 stub)
 *
 * Real handler (C-S2) will:
 *   - Resolve target record + field from natural-language prompt.
 *   - Run an LLM call producing an `op_cell_set` envelope: `{recordId,
 *     fieldId, oldValue, newValue, manualOverride: false}`.
 *   - Validate value against `FieldType` rules via PlatformCellValidator.
 *   - Emit the operation array; orchestrator persists pending proposal.
 */

import type { LevelHandler, LevelStubOutput } from './index.js';

export const proposeCellEdit: LevelHandler = async ({ prompt }) => {
  const out: LevelStubOutput = {
    handlerStatus: 'stub',
    summary: `[stub:cell] ${prompt.slice(0, 200)}`,
    operations: [],
    warnings: ['handler_is_stub_c_s1'],
    confidence: 0,
  };
  return out;
};
