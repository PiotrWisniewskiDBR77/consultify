/**
 * Tool: create_decision (Teresa routing-N · naprawa-rN-routing)
 *
 * Gives Teresa a REAL tool to create a Decision OBJECT (a `decisions` row) from
 * chat — instead of asking the user for data or falling back to a document. Before
 * this tool existed the chat pipeline only exposed generate_deliverable +
 * generate_initiative, so "stwórz decyzję" had no decision tool to call.
 *
 * READ/auto tool (mirrors generate_initiative): a decision record is a low-risk,
 * reversible personal/org entity — the same one the /decision slash command and
 * the AI_TOOLS create_decision already persist. No approval gate.
 *
 * Persistence reuses the column-defensive INSERT the AI_TOOLS create_decision path
 * already uses (getTableColumns guard → only existing columns). After the row is
 * created the handler emits a `deliverable` event (kind:'decision') so the FE
 * navigates to My Work → Decisions.
 */

import { featureFlags } from '../../../config/FeatureFlags.js';
import logger from '../../../utils/Logger.js';

type CreateDecisionParams = {
  title?: string;
  description?: string;
};

type CreateDecisionContext = {
  organizationId?: string;
  userId?: string;
  language?: string;
  role?: string;
  onDeliverable?: (payload: Record<string, unknown>) => void;
};

/**
 * BUG B fix (Teresa obiekty-N): after a decision row is created, generate the
 * STRUCTURAL BCG cards (§2) — alternatives (≥2 MECE options + "do nothing"),
 * risk/impact, consequences-of-inaction + recommendation — via the existing
 * `decisionService.generateSection` prompts, instead of leaving only a rewritten
 * `description`.
 *
 * The `decisions` table has NO durable columns for alternatives/risks/
 * consequences (verified: schema has only description/options/criteria/
 * decision_rationale). So we persist DURABLY where the schema allows:
 *   - decision_rationale ← "Consequences of inaction + Recommendation" (this is
 *     literally where "the consultant says what to do" — a real, surfaced column)
 *   - ai_generated_sections (lazy-ALTER'd JSON sink, parity with initiatives) ←
 *     the FULL structured cards {alternatives[], risks[], consequencesOfInaction}
 *     so nothing is lost and a future FE read can hydrate them.
 *
 * ADDITIVE + FAIL-SOFT: any error is logged and never affects the created row.
 */
async function fillDecisionStructuralFields(
  decisionId: string,
  orgId: string,
  language: 'pl' | 'en',
): Promise<void> {
  try {
    const [{ default: decisionService }, queryHelpers] = await Promise.all([
      import('../../decisionService.js'),
      import('../../../utils/queryHelpers.js'),
    ]);

    // Generate the three structural cards. Each is independently fail-soft so one
    // failing does not lose the others. (description card is skipped — the create
    // already set a description.)
    const [altRes, riskRes, consRes] = await Promise.allSettled([
      decisionService.generateSection(decisionId, 'alternatives', { language }),
      decisionService.generateSection(decisionId, 'risk', { language }),
      decisionService.generateSection(decisionId, 'consequencesOfInaction', { language }),
    ]);

    const sink: Record<string, unknown> = {};
    let anything = false;

    if (altRes.status === 'fulfilled') {
      const alternatives = (altRes.value.parsedContent as any)?.alternatives;
      if (Array.isArray(alternatives) && alternatives.length) {
        sink.alternatives = alternatives;
        anything = true;
      }
    } else {
      logger.error(
        `[create_decision] alternatives fill failed id=${decisionId}: ${
          altRes.reason instanceof Error ? altRes.reason.message : String(altRes.reason)
        }`,
      );
    }

    if (riskRes.status === 'fulfilled') {
      const risks = (riskRes.value.parsedContent as any)?.risks;
      if (Array.isArray(risks) && risks.length) {
        sink.risks = risks;
        anything = true;
      }
    } else {
      logger.error(
        `[create_decision] risk fill failed id=${decisionId}: ${
          riskRes.reason instanceof Error ? riskRes.reason.message : String(riskRes.reason)
        }`,
      );
    }

    let recommendation = '';
    if (consRes.status === 'fulfilled') {
      recommendation = String(consRes.value.content || '').trim();
      if (recommendation) {
        sink.consequencesOfInaction = recommendation;
        anything = true;
      }
    } else {
      logger.error(
        `[create_decision] consequences fill failed id=${decisionId}: ${
          consRes.reason instanceof Error ? consRes.reason.message : String(consRes.reason)
        }`,
      );
    }

    if (!anything) {
      logger.warn(`[create_decision] structural fill produced NO content id=${decisionId}`);
      return;
    }

    // (1) Durable, SURFACED column: decision_rationale ← recommendation (only if empty).
    if (recommendation) {
      await queryHelpers.queryRun(
        `UPDATE decisions SET decision_rationale = ?
         WHERE id = ? AND organization_id = ? AND (decision_rationale IS NULL OR decision_rationale = '')`,
        [recommendation, decisionId, orgId],
      );
    }

    // (2) Durable JSON sink for the full structured cards (lazy-ALTER, parity with
    // initiatives.ai_generated_sections). Best-effort; ADD COLUMN is idempotent.
    try {
      await queryHelpers.queryRun(`ALTER TABLE decisions ADD COLUMN ai_generated_sections TEXT`);
    } catch (err: any) {
      const m = String(err?.message || err).toLowerCase();
      if (!m.includes('already exists') && !m.includes('duplicate column')) {
        logger.warn(
          `[create_decision] ai_generated_sections ALTER skipped id=${decisionId}: ${m.slice(0, 120)}`,
        );
      }
    }
    await queryHelpers.queryRun(
      `UPDATE decisions SET ai_generated_sections = ? WHERE id = ? AND organization_id = ?`,
      [JSON.stringify(sink), decisionId, orgId],
    );

    logger.info(
      `[create_decision] structural fields filled id=${decisionId} (${Object.keys(sink).join(', ')})`,
    );
  } catch (err) {
    logger.error(
      `[create_decision] structural fill FAILED id=${decisionId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

export async function createDecision(
  params: CreateDecisionParams,
  context: CreateDecisionContext = {}
): Promise<Record<string, unknown>> {
  const orgId = String(context.organizationId || '').trim();
  const userId = String(context.userId || '').trim();
  const language: 'pl' | 'en' = context.language === 'en' ? 'en' : 'pl';

  // Defense in depth — mirrors AIPipeline's CHAT_CREATION_TOOLS gate.
  if (!featureFlags.ENABLE_TERESA_RECORD_CREATE) {
    return {
      ok: false,
      error: 'feature_disabled',
      message:
        language === 'en'
          ? 'Decision creation from chat is disabled in this environment — point the user to My Work → Decisions.'
          : 'Tworzenie decyzji z czatu jest wyłączone w tym środowisku — skieruj użytkownika do Moja praca → Decyzje.',
    };
  }

  if (!orgId) {
    return {
      ok: false,
      error: 'missing_context',
      message:
        language === 'en'
          ? 'I cannot create a decision without an organization context.'
          : 'Nie mogę utworzyć decyzji bez kontekstu organizacji.',
    };
  }

  const title = String(params?.title || '').trim();
  if (!title) {
    return {
      ok: false,
      error: 'missing_title',
      message:
        language === 'en'
          ? 'A decision record needs a title — what decision are we tracking?'
          : 'Decyzja potrzebuje tytułu — jaką decyzję zapisujemy?',
    };
  }

  try {
    const { v4: uuidv4 } = await import('uuid');
    const { getTableColumns } = await import('../../../utils/dbSchema.js');
    const queryHelpers = await import('../../../utils/queryHelpers.js');

    const id = uuidv4();
    const cols = await getTableColumns('decisions');
    const insertCols: string[] = ['id'];
    const insertVals: string[] = ['?'];
    const insertParams: any[] = [id];
    const add = (col: string, val: any) => {
      if (!cols.has(col)) return;
      insertCols.push(col);
      insertVals.push('?');
      insertParams.push(val);
    };
    add('organization_id', orgId);
    add('title', title.slice(0, 500));
    add('description', params?.description || null);
    add('status', 'pending');
    add('created_by', userId || null);
    add('decision_maker_id', userId || null);

    await queryHelpers.queryRun(
      `INSERT INTO decisions (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
      insertParams
    );

    // BUG B: fill structural cards (alternatives/risk/consequences+recommendation)
    // in the BACKGROUND — fire-and-forget so the chat stream returns immediately;
    // the decision row already exists and the AI-fill only enriches it. Fail-soft
    // (logs its own errors).
    void fillDecisionStructuralFields(id, orgId, language);

    try {
      context.onDeliverable?.({
        draftId: id,
        generationId: id,
        kind: 'decision',
        format: 'decision',
        title,
        decisionId: id,
        // BUG2 — scorer gets the decision's own scope, not the confirmation line.
        scorerContent: `${title}\n\n${String(params?.description || '')}`.trim(),
      });
    } catch (emitErr) {
      logger.warn(
        `[create_decision] onDeliverable emit failed id=${id}: ${
          emitErr instanceof Error ? emitErr.message : String(emitErr)
        }`
      );
    }

    logger.info(`[create_decision] created id=${id} title="${title.slice(0, 80)}"`);

    return {
      ok: true,
      kind: 'decision',
      id,
      title,
      message:
        language === 'en'
          ? `Created a decision record "${title}" in your My Work → Decisions.`
          : `Utworzyłem decyzję „${title}" w Moja praca → Decyzje.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[create_decision] error: ${message}`);
    return {
      ok: false,
      error: 'creation_failed',
      message:
        language === 'en'
          ? `I could not create the decision. ${message}`
          : `Nie udało się utworzyć decyzji. ${message}`,
    };
  }
}

export default { createDecision };
