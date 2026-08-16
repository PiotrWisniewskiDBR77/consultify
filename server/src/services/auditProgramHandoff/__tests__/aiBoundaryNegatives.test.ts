/**
 * aiBoundaryNegatives — AUD-MVP-AI-HANDOFF-001 DoD item 6.
 *
 * Independent corroboration that Teresa (the AI actor) cannot commit
 * `proposal.register` (the exact capability this task's headline fix is
 * about) nor any other capability in `AI_NEVER_COMMITS`
 * (server/src/services/audits/permissions.ts, read-only for this lane).
 * The kernel already has its own, more exhaustive
 * server/src/services/audits/__tests__/aiBoundaries.test.ts (iterates ALL of
 * AI_NEVER_COMMITS dynamically) — this file does not replace or modify it,
 * it is a second, independent witness asserting the EXACT denial message
 * for two named capabilities.
 *
 * Run (from repo root):
 *   DATABASE_URL=postgresql://... DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run server/src/services/auditProgramHandoff/__tests__/aiBoundaryNegatives.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0
 */
import { describe, expect, it } from 'vitest';

import { AI_NEVER_COMMITS, assertAiMayCommit } from '../../audits/permissions.js';

describe('assertAiMayCommit — Teresa cannot commit proposal.register (or any AI_NEVER_COMMITS capability)', () => {
  it('refuses proposal.register — the capability this task\'s exactly-once fix protects downstream of', () => {
    expect(() => assertAiMayCommit('proposal.register')).toThrowError(
      /Teresa nie może wykonać tej czynności \(proposal\.register\) — wymaga jawnej decyzji uprawnionej osoby/,
    );
  });

  it('refuses a second, unrelated blocked capability — verification.perform', () => {
    expect(() => assertAiMayCommit('verification.perform')).toThrowError(
      /Teresa nie może wykonać tej czynności \(verification\.perform\) — wymaga jawnej decyzji uprawnionej osoby/,
    );
  });

  it('sanity: proposal.register is actually present in AI_NEVER_COMMITS (would silently pass above if the list were emptied)', () => {
    expect(AI_NEVER_COMMITS).toContain('proposal.register');
    expect(AI_NEVER_COMMITS).toContain('verification.perform');
  });

  it('positive control: does NOT block a capability Teresa legitimately commits (finding.draft)', () => {
    expect(() => assertAiMayCommit('finding.draft')).not.toThrow();
  });
});
