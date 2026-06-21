/**
 * generate_initiative tool handler (M13 Depth · Seria C · C2).
 *
 * READ/auto tool (mirrors generate_deliverable): lets Teresa create a DRAFT
 * initiative directly from chat — no approval gate, because a draft is fully
 * reversible and never promotes (governance gates still apply later). Reuses
 * the canonical, Postgres-correct create path (initiativeGenerationService →
 * initiativeService) rather than the legacy create_initiative handler, which
 * uses SQLite `datetime('now')` and is broken on Postgres.
 */
import logger from '../../../utils/Logger.js';
import { createInitiative as createInitiativeRecord } from '../../initiativeGenerationService.js';

type ToolContext = { userId?: string; organizationId?: string };

export async function generateInitiative(
  params: { title?: string; problem?: string },
  context: ToolContext = {}
): Promise<Record<string, unknown>> {
  const orgId = context.organizationId;
  if (!orgId) {
    return { ok: false, message: 'No organization context to create an initiative in.' };
  }
  const title = String(params?.title || '').trim() || 'New initiative';
  try {
    const { id } = await createInitiativeRecord({
      organizationId: orgId,
      title,
      description: String(params?.problem || ''),
      source: 'teresa_chat',
    });
    if (!id) {
      return { ok: false, message: 'Could not create the initiative.' };
    }
    return {
      ok: true,
      id,
      title,
      message: `Created a draft initiative "${title}". Open it from Initiatives to flesh it out.`,
    };
  } catch (e: any) {
    logger.warn('[teresa] generate_initiative failed:', e?.message);
    return { ok: false, message: 'Failed to create the initiative.' };
  }
}
