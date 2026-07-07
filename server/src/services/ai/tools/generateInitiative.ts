/**
 * generate_initiative tool handler (M13 Depth · Seria C · C2 → F1 upgrade).
 *
 * READ/auto tool (mirrors generate_deliverable): lets Teresa create a DRAFT
 * initiative directly from chat — no approval gate, because a draft is fully
 * reversible and never promotes (governance gates still apply later). Reuses
 * the canonical, Postgres-correct create path (initiativeGenerationService →
 * initiativeService) rather than the legacy create_initiative handler, which
 * uses SQLite `datetime('now')` and is broken on Postgres.
 *
 * F1 UPGRADE (2026-06-28) — full-fill + lineage, both additive & fail-soft:
 *  1. LINEAGE STAMP: after the DRAFT is created, a schema-safe post-create
 *     UPDATE sets `source_type` + `source_id` on the new row (the canonical
 *     create path only takes `source:'teresa_chat'` and DROPS lineage). Mirrors
 *     the post-create UPDATE pattern in assessmentInitiativeService.ts /
 *     auditInitiativeService.ts (getTableColumns guard → only existing cols).
 *  2. FULL-FILL: kicks off `generateFullInitiative` (the F1 brain) so the 6 core
 *     cards are generated, auto-healed, and (best-effort) persisted to a
 *     schema-safe lazy-ALTER'd `ai_generated_sections` JSON column — mirroring
 *     the `section_completions` lazy-ALTER pattern in InitiativeController.
 *
 * Every enrichment step is wrapped so a failure NEVER breaks the tool: the DRAFT
 * is always returned once created.
 */
import logger from '../../../utils/Logger.js';
import * as queryHelpers from '../../../utils/queryHelpers.js';
import { createInitiative as createInitiativeRecord } from '../../initiativeGenerationService.js';
import {
  generateFullInitiative,
  defaultDeps,
} from '../../initiative/initiativeGeneratorBrain.js';
import {
  buildTypedColumnUpdates,
  toUpdateSql,
} from '../../initiative/cardColumnHydration.js';

type ToolContext = {
  userId?: string;
  organizationId?: string;
  /** Optional originating artifact type (e.g. 'idea','notebook') if Teresa knows it. */
  sourceType?: string;
  /** Optional originating artifact id, paired with sourceType. */
  sourceId?: string;
  /** UI language for the generated cards. */
  language?: 'en' | 'pl' | string;
  /**
   * Teresa routing-N — same deliverable side-channel generate_deliverable uses.
   * When present, we emit a `{kind:'initiative'}` event after the DRAFT is
   * created so the FE deep-links into the Initiatives module (previously the
   * initiative was created but the user had to open it manually).
   */
  onDeliverable?: (payload: Record<string, unknown>) => void;
};

/**
 * Best-effort, schema-safe lineage stamp on a freshly-created initiative.
 * Mirrors the post-create UPDATE pattern in assessment/audit services: read the
 * live columns, only set the ones that exist, swallow any error.
 */
async function stampLineage(
  initiativeId: string,
  organizationId: string,
  sourceType: string,
  sourceId: string,
): Promise<void> {
  try {
    const cols = await queryHelpers.getTableColumns('initiatives').catch(() => null);
    const colSet = cols
      ? new Set((cols || []).map((c) => c.name).filter(Boolean) as string[])
      : null;
    if (colSet === null) return; // unknown schema → skip optional columns

    const upCols: string[] = [];
    const upVals: unknown[] = [];
    const setIf = (col: string, value: unknown) => {
      if (!colSet.has(col)) return;
      upCols.push(`${col} = ?`);
      upVals.push(value);
    };
    setIf('source_type', sourceType);
    setIf('source_id', sourceId);
    if (upCols.length === 0) return;

    await queryHelpers.queryRun(
      `UPDATE initiatives SET ${upCols.join(', ')} WHERE id = ? AND organization_id = ?`,
      [...upVals, initiativeId, organizationId],
    );
  } catch (e: any) {
    logger.warn('[teresa] generate_initiative lineage stamp failed (ignored):', e?.message || e);
  }
}

/**
 * Best-effort persist of the brain's card output into a schema-safe lazy-ALTER'd
 * `ai_generated_sections` TEXT(JSON) column on `initiatives`. Mirrors the
 * `section_completions` lazy-ALTER pattern in InitiativeController so content is
 * NOT lost. See the PERSIST NOTE in the module doc / report for the FE read step
 * that turns this into typed-column hydration.
 */
async function persistCards(
  initiativeId: string,
  organizationId: string,
  cards: Record<string, string>,
): Promise<void> {
  if (!cards || Object.keys(cards).length === 0) return;
  try {
    const cols = await queryHelpers.getTableColumns('initiatives').catch(() => null);
    const colSet = cols
      ? new Set((cols || []).map((c) => c.name).filter(Boolean) as string[])
      : null;
    if (colSet === null) return; // unknown schema → do not ALTER/insert blindly

    if (!colSet.has('ai_generated_sections')) {
      try {
        await queryHelpers.queryRun(
          `ALTER TABLE initiatives ADD COLUMN ai_generated_sections TEXT`,
        );
      } catch (err: any) {
        const m = String(err?.message || err).toLowerCase();
        if (!m.includes('already exists') && !m.includes('duplicate column')) throw err;
      }
    }

    await queryHelpers.queryRun(
      `UPDATE initiatives SET ai_generated_sections = ? WHERE id = ? AND organization_id = ?`,
      [JSON.stringify(cards), initiativeId, organizationId],
    );

    // R3 — HYDRATE TYPED COLUMNS (non-destructive): so generated cards land in the
    // authoritative columns (problem_statement/scope_in/…), not just the JSON sink.
    // Best-effort & additive — never overwrites a non-empty column, never throws.
    await hydrateTypedColumns(initiativeId, organizationId, cards, colSet);
  } catch (e: any) {
    logger.warn('[teresa] generate_initiative card persist failed (ignored):', e?.message || e);
  }
}

/**
 * R3 — map generated cards → authoritative typed columns, filling ONLY empty
 * columns (read-before-write). Fail-soft: any error is swallowed (the JSON sink
 * already holds the content). Mirrors FIELD_MAP/JSON_FIELDS formats.
 */
export async function hydrateTypedColumns(
  initiativeId: string,
  organizationId: string,
  cards: Record<string, string>,
  colSet: Set<string>,
): Promise<void> {
  try {
    // Candidate target columns we know how to hydrate.
    const TARGETS = [
      'problem_statement',
      'scope_in',
      'scope_out',
      'kill_criteria',
      'success_criteria',
      'deliverables',
      'business_value',
      'cost_capex',
      'cost_opex',
      'expected_roi',
    ].filter((c) => colSet.has(c));
    if (TARGETS.length === 0) return;

    // Read current values so hydration is non-destructive (only fills empties).
    let existingRow: Record<string, unknown> = {};
    try {
      const row = await queryHelpers.queryOne<Record<string, unknown>>(
        `SELECT ${TARGETS.join(', ')} FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, organizationId],
      );
      if (row) existingRow = row;
    } catch {
      // If the read fails, fall back to treating all as empty (fresh DRAFT).
      existingRow = {};
    }

    const updates = buildTypedColumnUpdates(cards, new Set(TARGETS), existingRow);
    if (updates.length === 0) return;

    const { setClause, params } = toUpdateSql(updates);
    await queryHelpers.queryRun(
      `UPDATE initiatives SET ${setClause} WHERE id = ? AND organization_id = ?`,
      [...params, initiativeId, organizationId],
    );
    logger.info(
      `[teresa] hydrated ${updates.length} typed column(s) for initiative ${initiativeId}: ${updates
        .map((u) => u.column)
        .join(', ')}`,
    );
  } catch (e: any) {
    logger.warn('[teresa] typed-column hydration failed (ignored):', e?.message || e);
  }
}

export async function generateInitiative(
  params: { title?: string; problem?: string },
  context: ToolContext = {},
): Promise<Record<string, unknown>> {
  const orgId = context.organizationId;
  if (!orgId) {
    return { ok: false, message: 'No organization context to create an initiative in.' };
  }

  // TURN IDEMPOTENCY — generate_initiative has a CREATE side-effect, but one chat
  // turn can invoke it MANY times: (a) the SDK maxSteps loop, and (b) AIPipeline's
  // candidate-model fallback — when the model calls the tool but then streams no
  // text, the pipeline reports EMPTY_STREAM and retries callStream with the next
  // model, re-running the tool. All of these share the SAME `context` object
  // reference (AIPipeline passes `deliverableTools.context` to every callStream),
  // so we memoize the first successful result on it and return it for any repeat
  // in the same turn. Verified on demo 2026-06-28: without this, a single "stwórz
  // inicjatywę" message created up to 4 duplicate DRAFT initiatives. A per-
  // callStream guard could NOT fix this (the dupes come from cross-callStream
  // retries), so the dedup must live on the turn-scoped context.
  const turn = context as Record<string, unknown>;
  const memoized = turn.__generatedInitiative as Record<string, unknown> | undefined;
  if (memoized) return memoized;

  const title = String(params?.title || '').trim() || 'New initiative';
  const problem = String(params?.problem || '');

  // Lineage: prefer an originating artifact type the caller passed, else default
  // to the chat source. source_id is the paired artifact id, else the initiative
  // id itself (self-reference) so the column is never left null.
  const sourceType = String(context.sourceType || '').trim() || 'teresa_chat';
  const language: 'en' | 'pl' = context.language === 'en' ? 'en' : 'pl';

  try {
    const { id } = await createInitiativeRecord({
      organizationId: orgId,
      title,
      description: problem,
      source: 'teresa_chat',
    });
    if (!id) {
      return { ok: false, message: 'Could not create the initiative.' };
    }

    const sourceId = String(context.sourceId || '').trim() || id;

    // (1) LINEAGE STAMP — best-effort, never breaks the tool.
    await stampLineage(id, orgId, sourceType, sourceId);

    // (2) FULL-FILL — kick off the F1 brain in the BACKGROUND (fire-and-forget).
    // Generating 6 cards is ~6 LLM calls (30-90s); awaiting it here blocked the
    // chat stream for the whole duration (the tool runs INSIDE callStream), so
    // Teresa appeared to hang / time out. The DRAFT is already created, so we
    // return immediately and let the cards populate asynchronously. Railway runs
    // a persistent process, so the detached promise completes. Fail-soft: any
    // error is logged and never affects the (already-created) DRAFT.
    void (async () => {
      try {
        const fill = await generateFullInitiative(defaultDeps(), {
          initiativeId: id,
          brief: problem,
          sourceType: 'teresa_chat',
          language,
          organizationId: orgId,
        });
        const cards = fill?.cards ?? {};
        await persistCards(id, orgId, cards);
        const n = Object.keys(cards).length;
        if (n === 0) {
          // LOUD: an empty fill is the "cicho pada" bug — surface it at ERROR so
          // it is never invisible again. The brain already logged per-card errors.
          logger.error(
            `[teresa] generate_initiative background full-fill produced ZERO cards for ${id} ` +
              `— all core sections came back empty (see [GeneratorBrain] errors above).`,
          );
        } else {
          logger.info(
            `[teresa] generate_initiative background full-fill done for ${id} (${n} cards)`,
          );
        }
      } catch (fillErr: any) {
        // LOUD: a thrown full-fill is a real defect, not routine noise → ERROR.
        logger.error(
          '[teresa] generate_initiative background full-fill FAILED:',
          fillErr?.message || fillErr,
        );
      }
    })();

    // Teresa routing-N — emit the deliverable event so the FE opens the new
    // initiative in the Initiatives module (parity with generate_deliverable /
    // create_task / create_decision). Fires once per real create (the memoized
    // early-return above short-circuits retries before reaching here). Fail-soft.
    try {
      context.onDeliverable?.({
        draftId: id,
        generationId: id,
        kind: 'initiative',
        format: 'initiative',
        title,
        initiativeId: id,
        // BUG2 — scorer gets the initiative's own scope (title + problem brief),
        // not the thin "Utworzyłem inicjatywę…" chat-confirmation.
        scorerContent: `${title}\n\n${problem || ''}`.trim(),
      });
    } catch (emitErr: any) {
      logger.warn(
        '[teresa] generate_initiative onDeliverable emit failed (ignored):',
        emitErr?.message || emitErr
      );
    }

    const result = {
      ok: true,
      // naprawa-r2Narr · Problem 1 — expose the REAL kind so the confirmation the
      // user reads is derived from it (single source of truth == deliverable event).
      kind: 'initiative' as const,
      id,
      title,
      sourceType,
      filledCards: 0,
      message:
        `Created a draft initiative "${title}" and started filling its sections with AI ` +
        `in the background — I'm opening it in Initiatives now.`,
    };
    // Memoize on the turn context so any retry in this turn returns this exact
    // result instead of creating a duplicate (see TURN IDEMPOTENCY above).
    turn.__generatedInitiative = result;
    return result;
  } catch (e: any) {
    logger.warn('[teresa] generate_initiative failed:', e?.message);
    return { ok: false, message: 'Failed to create the initiative.' };
  }
}
