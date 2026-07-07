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
