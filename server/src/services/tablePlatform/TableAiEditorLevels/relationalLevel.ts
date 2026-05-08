/**
 * Level 6: Relational Edit (Block C · EPIC-T10 · Sprint C-S3 stub)
 *
 * Real handler (C-S3) will:
 *   - Create / repair links between tables (`tp_record_links`, lookup,
 *     rollup, formula chains).
 *   - LLM produces `op_link_create | op_link_repair | op_lookup_define`.
 *   - Cross-tenant ACL: must verify both ends of the link belong to the
 *     same workspace + organization (rule reused from RelationService).
 */

import type { LevelHandler, LevelStubOutput } from './index.js';

export const proposeRelationalEdit: LevelHandler = async ({ prompt }) => {
  const out: LevelStubOutput = {
    handlerStatus: 'stub',
    summary: `[stub:relational] ${prompt.slice(0, 200)}`,
    operations: [],
    warnings: ['handler_is_stub_c_s1'],
    confidence: 0,
  };
  return out;
};
