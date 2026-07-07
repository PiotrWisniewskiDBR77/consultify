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
 * Map a low/medium/high probability|impact string to a 1-5 numeric score, so the
 * risk/impact matrix carries NUMBERS (BCG §2: matrix, not words) that the FE and
 * the judge can actually rank. Falsy/unknown → 3 (neutral middle) so a partial
 * model output never poisons a column with null.
 */
function levelToScore(level: unknown): number {
  const v = String(level || '').trim().toLowerCase();
  if (v === 'low' || v === 'niskie' || v === 'niski') return 2;
  if (v === 'high' || v === 'wysokie' || v === 'wysoki') return 5;
  if (v === 'medium' || v === 'średnie' || v === 'sredni' || v === 'średni') return 3;
  return 3;
}

/**
 * Split the "Consequences of inaction + Recommendation" prose card into its two
 * answer-first parts. The card prompt (decisionService) asks for: (1) consequences
 * of inaction, (2) ONE recommendation, (3) horizon. We keep the whole prose as the
 * consequences body (durable, surfaced) and lift the recommendation sentence into
 * its OWN field so the FE/judge see an answer-first recommendation, not buried text.
 */
function splitConsequencesAndRecommendation(prose: string): {
  consequences: string;
  recommendation: string;
} {
  const text = String(prose || '').trim();
  if (!text) return { consequences: '', recommendation: '' };
  // Prefer an explicit "Rekomendacja"/"Recommendation" marker if present.
  const markerMatch = text.match(/(?:^|\n)\s*(?:\*\*)?\s*(?:rekomendacja|recommendation)\b[:.\s-]*/i);
  if (markerMatch && markerMatch.index !== undefined) {
    const recStart = markerMatch.index + markerMatch[0].length;
    const recommendation = text.slice(recStart).trim();
    const consequences = text.slice(0, markerMatch.index).trim() || text;
    if (recommendation) return { consequences, recommendation };
  }
  return { consequences: text, recommendation: '' };
}

/**
 * BUG B fix (Teresa obiekty-N) — now DURABLE (naprawa-r2Decision): after a decision
 * row is created, generate the STRUCTURAL BCG cards (§2) — MECE alternatives (≥2 +
 * "do nothing"), a risk/impact MATRIX, consequences-of-inaction + an answer-first
 * recommendation — via `decisionService.generateSection`, and persist them into the
 * REAL structured columns added by migration 902 (alternatives, risk_impact,
 * consequences_of_inaction, recommendation, assumptions). The read API surfaces
 * these (SELECT d.*) so the structure is finally VISIBLE and SCOREABLE — not buried
 * in `description` or an unread sink.
 *
 * Column-defensive: writes only to columns that exist (getTableColumns), so on an
 * under-migrated env the create still succeeds. ADDITIVE + FAIL-SOFT: any error is
 * logged and never affects the created row.
 */
async function fillDecisionStructuralFields(
  decisionId: string,
  orgId: string,
  language: 'pl' | 'en',
): Promise<void> {
  try {
    const [{ default: decisionService }, queryHelpers, { getTableColumns }] = await Promise.all([
      import('../../decisionService.js'),
      import('../../../utils/queryHelpers.js'),
      import('../../../utils/dbSchema.js'),
    ]);

    // Generate the three structural cards. Each is independently fail-soft so one
    // failing does not lose the others. (description card is skipped — the create
    // already set a description.)
    const [altRes, riskRes, consRes] = await Promise.allSettled([
      decisionService.generateSection(decisionId, 'alternatives', { language }),
      decisionService.generateSection(decisionId, 'risk', { language }),
      decisionService.generateSection(decisionId, 'consequencesOfInaction', { language }),
    ]);

    let alternatives: any[] | null = null;
    let riskImpact: any[] | null = null;
    let consequences = '';
    let recommendation = '';
    const assumptions: Array<{ assumption: string; confidence: string; whatWouldChangeIt: string }> = [];

    if (altRes.status === 'fulfilled') {
      const alts = (altRes.value.parsedContent as any)?.alternatives;
      if (Array.isArray(alts) && alts.length) alternatives = alts;
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
        // BCG §2: risk/impact as a MATRIX with 1-5 scores, not just words.
        riskImpact = risks.map((r: any) => ({
          ...r,
          riskScore: levelToScore(r?.probability),
          impactScore: levelToScore(r?.impact),
        }));
      }
    } else {
      logger.error(
        `[create_decision] risk fill failed id=${decisionId}: ${
          riskRes.reason instanceof Error ? riskRes.reason.message : String(riskRes.reason)
        }`,
      );
    }

    if (consRes.status === 'fulfilled') {
      const split = splitConsequencesAndRecommendation(String(consRes.value.content || ''));
      consequences = split.consequences;
      recommendation = split.recommendation;
    } else {
      logger.error(
        `[create_decision] consequences fill failed id=${decisionId}: ${
          consRes.reason instanceof Error ? consRes.reason.message : String(consRes.reason)
        }`,
      );
    }

    // Grounding / falsifiability (§5): a recommendation carries confidence + what
    // would change it, and — when the model gave us no structured alternatives — an
    // explicit "insufficient data" assumption instead of a silent empty.
    if (recommendation) {
      assumptions.push({
        assumption:
          language === 'en'
            ? 'Recommendation derived from the decision context supplied at creation; not yet validated against live data.'
            : 'Rekomendacja wywiedziona z kontekstu decyzji podanego przy utworzeniu; niezweryfikowana na danych na żywo.',
        confidence: 'medium',
        whatWouldChangeIt:
          language === 'en'
            ? 'New quantified evidence on cost/benefit of the alternatives, or a changed deadline/constraint.'
            : 'Nowe skwantyfikowane dowody kosztu/korzyści opcji lub zmiana terminu/ograniczenia.',
      });
    }
    if (!alternatives) {
      assumptions.push({
        assumption:
          language === 'en'
            ? 'Structured alternatives could not be generated automatically — options need to be filled in.'
            : 'Nie udało się automatycznie wygenerować ustrukturyzowanych opcji — do uzupełnienia.',
        confidence: 'low',
        whatWouldChangeIt:
          language === 'en'
            ? 'Providing more decision context, then re-running alternative generation.'
            : 'Podanie szerszego kontekstu decyzji i ponowne wygenerowanie opcji.',
      });
    }

    if (!alternatives && !riskImpact && !consequences && !recommendation) {
      logger.warn(`[create_decision] structural fill produced NO content id=${decisionId}`);
      return;
    }

    // Persist into the REAL structured columns (migration 902). Column-defensive:
    // only write columns that exist so an under-migrated env still succeeds.
    const cols = await getTableColumns('decisions');
    const sets: string[] = [];
    const vals: any[] = [];
    const setCol = (col: string, jsonVal: any, isJson: boolean) => {
      if (!cols.has(col)) return;
      // Only fill when currently empty, so a later human edit is never clobbered.
      sets.push(`${col} = COALESCE(${col}, ?)`);
      vals.push(isJson ? JSON.stringify(jsonVal) : jsonVal);
    };

    if (alternatives) setCol('alternatives', alternatives, true);
    if (riskImpact) setCol('risk_impact', riskImpact, true);
    if (consequences) setCol('consequences_of_inaction', consequences, false);
    if (recommendation) setCol('recommendation', recommendation, false);
    if (assumptions.length) setCol('assumptions', assumptions, true);

    // decision_rationale is the legacy surfaced "outcome" column — keep it in sync
    // with the recommendation for adopters that still read it (only if empty).
    if (recommendation && cols.has('decision_rationale')) {
      await queryHelpers.queryRun(
        `UPDATE decisions SET decision_rationale = ?
         WHERE id = ? AND organization_id = ? AND (decision_rationale IS NULL OR decision_rationale = '')`,
        [recommendation, decisionId, orgId],
      );
    }

    if (sets.length) {
      vals.push(decisionId, orgId);
      await queryHelpers.queryRun(
        `UPDATE decisions SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
        vals,
      );
    }

    logger.info(
      `[create_decision] structural columns filled id=${decisionId} (` +
        [
          alternatives && `alternatives(${alternatives.length})`,
          riskImpact && `risk_impact(${riskImpact.length})`,
          consequences && 'consequences',
          recommendation && 'recommendation',
          assumptions.length && `assumptions(${assumptions.length})`,
        ]
          .filter(Boolean)
          .join(', ') +
        ')',
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
