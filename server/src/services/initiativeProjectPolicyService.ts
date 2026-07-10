/**
 * Initiative Project Anchoring Policy (Zwornik Delta C).
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_ZWORNIK_2026-07-10.md, §5.2. Decyzja
 * Piotra (D-J): every initiative MUST resolve to a project_id — no more
 * silent `project_id IS NULL` sierotas.
 *
 * Two callers, two postures:
 *  - InitiativeController.createInitiative (interactive/wizard path) HARD
 *    BLOCKS when projectId is missing — the human picks a project (§5.2.1).
 *  - createInitiativeService.ts (the canonical funnel — every AI/background
 *    caller: candidate accept, Teresa handoff, onboarding, report import, …)
 *    auto-anchors to the org's system "Portfel — inicjatywy bezpośrednie"
 *    project instead of hard-failing, because those callers are fail-soft
 *    pipelines that cannot show a UI picker (§5.2.3). Both paths funnel
 *    through the SAME table (`projects`, `is_system=TRUE` marker) so a
 *    "Nieprzypisane" bulk-assign later moves them out of the container.
 *
 * `REQUIRE_INITIATIVE_PROJECT` follows the codebase's established
 * "default-ON unless explicitly disabled" convention (see
 * ALERT_EMAIL_ENABLED / AUDIT_LOGGING_ENABLED) — flip it to 'false' to fully
 * restore pre-zwornik behaviour (nullable project_id, no anchoring) e.g. for
 * an environment mid-migration.
 */
import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../utils/queryHelpers.js';
import logger from '../utils/Logger.js';

export const SYSTEM_PORTFOLIO_PROJECT_NAME = 'Portfel — inicjatywy bezpośrednie';

/** Real, grep-able flag check — NOT a phantom. Default ON per D-J. */
export function isRequireInitiativeProjectEnabled(): boolean {
  return process.env.REQUIRE_INITIATIVE_PROJECT !== 'false';
}

/**
 * Resolve the org's system "Portfel" project id, lazy-creating it on first
 * use. Race-safe: a concurrent double-create is caught by the partial unique
 * index `uq_projects_org_system_portfolio` (migration 912) and resolved by a
 * re-SELECT rather than surfacing the constraint error to the caller.
 *
 * Fail-soft by design (mirrors the rest of the funnel): a DB error here logs
 * and returns null so the initiative still gets created with project_id NULL
 * rather than the whole creation failing because of container bookkeeping.
 */
export async function resolveOrCreateSystemPortfolioProject(
  orgId: string,
  opts: { createdBy?: string | null } = {}
): Promise<string | null> {
  if (!orgId) return null;

  try {
    const existing = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM projects WHERE organization_id = ? AND is_system = TRUE LIMIT 1`,
      [orgId]
    );
    if (existing?.id) return existing.id;
  } catch (err) {
    logger.warn(
      `[initiativeProjectPolicyService] system portfolio lookup failed (ignored): ${
        (err as Error)?.message || err
      }`
    );
    return null;
  }

  const id = uuidv4();
  try {
    await queryHelpers.queryRun(
      `INSERT INTO projects (id, organization_id, name, description, status, owner_id, is_system, created_at)
       VALUES (?, ?, ?, ?, 'active', ?, TRUE, CURRENT_TIMESTAMP)`,
      [
        id,
        orgId,
        SYSTEM_PORTFOLIO_PROJECT_NAME,
        'Kontener systemowy dla inicjatyw utworzonych bez przypisanego projektu (Zwornik Delta C). Przenieś je do właściwego projektu przez „Nieprzypisane” → przypisz.',
        opts.createdBy ?? null,
      ]
    );
    return id;
  } catch (err) {
    // Most likely the partial unique index caught a concurrent lazy-create —
    // re-select rather than treat this as a hard failure.
    try {
      const raced = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM projects WHERE organization_id = ? AND is_system = TRUE LIMIT 1`,
        [orgId]
      );
      if (raced?.id) return raced.id;
    } catch {
      /* fall through to null below */
    }
    logger.warn(
      `[initiativeProjectPolicyService] system portfolio lazy-create failed (ignored): ${
        (err as Error)?.message || err
      }`
    );
    return null;
  }
}

export default {
  SYSTEM_PORTFOLIO_PROJECT_NAME,
  isRequireInitiativeProjectEnabled,
  resolveOrCreateSystemPortfolioProject,
};
