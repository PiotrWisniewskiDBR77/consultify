/**
 * Level 8: Source Edit (Block C · EPIC-T10 · Sprint C-S3 stub)
 *
 * Real handler (C-S3) will:
 *   - Operate on `source_reference` columns: re-attach citations, refresh
 *     stale URLs, propose new internal links.
 *   - Coordinates with C-S6 SourcePackBuilderService when producing source
 *     bundles for downstream artifacts (Doc/Deck conversions in Block D).
 */

import type { LevelHandler, LevelStubOutput } from './index.js';

export const proposeSourceEdit: LevelHandler = async ({ prompt }) => {
  const out: LevelStubOutput = {
    handlerStatus: 'stub',
    summary: `[stub:source] ${prompt.slice(0, 200)}`,
    operations: [],
    warnings: ['handler_is_stub_c_s1'],
    confidence: 0,
  };
  return out;
};
