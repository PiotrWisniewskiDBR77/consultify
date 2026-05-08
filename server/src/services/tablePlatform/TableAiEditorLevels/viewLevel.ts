/**
 * Level 5: View Edit (Block C · EPIC-T10 · Sprint C-S3 stub)
 *
 * Real handler (C-S3) will:
 *   - Create / mutate `tp_views` rows (filter, sort, grouping, hidden
 *     columns, kanban boards, calendar views).
 *   - Operates per view — never on table primary data — so safe to apply
 *     without schema review.
 */

import type { LevelHandler, LevelStubOutput } from './index.js';

export const proposeViewEdit: LevelHandler = async ({ prompt }) => {
  const out: LevelStubOutput = {
    handlerStatus: 'stub',
    summary: `[stub:view] ${prompt.slice(0, 200)}`,
    operations: [],
    warnings: ['handler_is_stub_c_s1'],
    confidence: 0,
  };
  return out;
};
