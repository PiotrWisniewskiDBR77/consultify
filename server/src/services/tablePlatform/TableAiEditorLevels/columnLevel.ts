/**
 * Level 3: Column Edit (Block C · EPIC-T10 · Sprint C-S1 stub)
 *
 * Real handler (C-S2) will:
 *   - Add / rename / retype / drop a column (`tp_fields` row).
 *   - LLM produces `op_field_add | op_field_rename | op_field_retype |
 *     op_field_drop`.
 *   - Cross-checks specialized field-type contracts (risk_score, priority,
 *     ai_generated_summary, ai_classification, source_reference) before
 *     proposing a retype that would lose data.
 */

import type { LevelHandler, LevelStubOutput } from './index.js';

export const proposeColumnEdit: LevelHandler = async ({ prompt }) => {
  const out: LevelStubOutput = {
    handlerStatus: 'stub',
    summary: `[stub:column] ${prompt.slice(0, 200)}`,
    operations: [],
    warnings: ['handler_is_stub_c_s1'],
    confidence: 0,
  };
  return out;
};
