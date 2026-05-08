/**
 * Level 2: Record Edit (Block C · EPIC-T10 · Sprint C-S1 stub)
 *
 * Real handler (C-S2) will:
 *   - Insert / update / delete entire `tp_records` rows.
 *   - LLM produces `op_record_create | op_record_update | op_record_delete`
 *     envelopes with field-level diffs scoped to one record.
 *   - Validates the resulting record against the active table schema and
 *     active validation rules (Block B provenance pipeline reused).
 */

import type { LevelHandler, LevelStubOutput } from './index.js';

export const proposeRecordEdit: LevelHandler = async ({ prompt }) => {
  const out: LevelStubOutput = {
    handlerStatus: 'stub',
    summary: `[stub:record] ${prompt.slice(0, 200)}`,
    operations: [],
    warnings: ['handler_is_stub_c_s1'],
    confidence: 0,
  };
  return out;
};
