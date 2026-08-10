/**
 * Idea confidentiality gate — epic E12 (collaboration/security), DoD 10.4:
 * "confidential/restricted Ideas do not leak content through AI prompts,
 * exports or telemetry".
 *
 * Backed by `my_ideas.confidentiality` (server/migrations/20260810_idea_confidentiality.sql
 * — ADDITIVE, NOT APPLIED to any database by this change). Before that
 * column exists in a given environment this module is a deliberate no-op —
 * `isRestricted()` always resolves false — matching every other optional-
 * column pattern in this file (`is_canonical`, `preferred_tool`, …): an
 * unmigrated environment must never 500 or silently misbehave, it just
 * hasn't adopted the feature yet.
 *
 * Enforcement wired so far (see 02_EXECUTION_LEDGER.csv / the E12 report):
 *   - POST /my-work/my-ideas/:id/map/ai-suggestions
 *   - POST /my-work/my-ideas/:id/map/gap-analysis
 *   - POST /my-work/my-ideas/:id/map/expand
 *   - POST /my-work/my-ideas/:id/mindmap-export (PPTX)
 * Each of the above sends idea title/seed-text/node-labels into an LLM
 * prompt or an exported document; a 'restricted' idea must refuse rather
 * than silently degrade. There is deliberately NO UI yet to set this value
 * — see the E12 report for what remains (whiteboard/table/process-flow
 * export paths, a settable UI control, propagating the level into Teresa's
 * "discuss this idea" handoff).
 */
import { getTableColumns } from '../utils/dbSchema.js';
import * as queryHelpers from '../utils/queryHelpers.js';

export type IdeaConfidentiality = 'standard' | 'confidential' | 'restricted';

// Single source of truth for the closed value set — mirrors the CHECK
// constraint in server/migrations/20260810_idea_confidentiality.sql. Routes
// that accept `confidentiality` on write should validate against this array
// (not re-declare their own list) so the two can never drift.
export const IDEA_CONFIDENTIALITY_LEVELS: readonly IdeaConfidentiality[] = [
  'standard',
  'confidential',
  'restricted',
];

const VALID: ReadonlySet<string> = new Set(IDEA_CONFIDENTIALITY_LEVELS);

/**
 * Reads `my_ideas.confidentiality` for one idea, org-scoped. Returns
 * 'standard' (today's implicit default) whenever the column doesn't exist
 * yet, the idea can't be found, or the stored value isn't one of the three
 * known levels — never throws, never blocks a caller that doesn't check it.
 */
export async function getIdeaConfidentiality(
  ideaId: string,
  organizationId: string
): Promise<IdeaConfidentiality> {
  if (!ideaId || !organizationId) return 'standard';
  try {
    const cols = await getTableColumns('my_ideas');
    if (!cols.has('confidentiality')) return 'standard';
    const row = await queryHelpers.queryOne<{ confidentiality?: string | null }>(
      `SELECT confidentiality FROM my_ideas WHERE id = ? AND organization_id = ? LIMIT 1`,
      [ideaId, organizationId]
    );
    const value = String(row?.confidentiality || 'standard').toLowerCase();
    return VALID.has(value) ? (value as IdeaConfidentiality) : 'standard';
  } catch {
    // Fail open on the READ (matches the rest of this file's optional-column
    // handling) — a broken confidentiality lookup must not 500 every AI call.
    // Callers that need fail-CLOSED semantics for a specific surface should
    // treat a thrown/unexpected error from their own call site accordingly.
    return 'standard';
  }
}

export async function isIdeaRestricted(ideaId: string, organizationId: string): Promise<boolean> {
  return (await getIdeaConfidentiality(ideaId, organizationId)) === 'restricted';
}

export const IDEA_CONFIDENTIALITY_BLOCKED_RESPONSE = {
  status: 403,
  body: {
    error: 'This Idea is marked restricted and cannot be sent to an AI model.',
    code: 'IDEA_CONFIDENTIALITY_BLOCKED',
  },
} as const;
