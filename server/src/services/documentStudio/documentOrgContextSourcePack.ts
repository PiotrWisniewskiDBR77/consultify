/**
 * Consultify Document Studio — Automatic Org-Context Grounding (P0 URODZINOWE).
 *
 * PROBLEM (2026-07-27, live incident): Document Studio generates documents
 * with ZERO organizational context. The frontend intake form
 * (`DocumentStudioIntakeForm.tsx`) never sends `sourceRefs` / `sourcePackId`
 * at all, so every document is generated from the bare `intake.description`
 * the user typed — no facts about the organization, its active projects, or
 * initiatives. This breaks the core product promise ("AI zamienia kontekst
 * organizacji w materiały") and trips the QA gate: `runSourceQa`
 * (documentQaService.ts) marks every substantive section `document_no_sources`
 * / `section_no_sources` (high severity, -25 each) because `schema.sourceRefs`
 * and `section.sourceRefs` are empty, driving the Sources QA score to 0 and
 * blocking export.
 *
 * SCOPE — DELIBERATELY MINIMAL. This is NOT the real retrieval / grounding
 * engine described in `docs/product/MATERIALS_MODULE_MASTER_SPEC.md` §2/§5
 * (ranked, content-matched, multi-source evidence). It is a fail-open bridge
 * that closes the "0 → something" gap for the common case (org already has
 * some active projects/initiatives) while making zero regression for brand
 * new organizations with no data yet (returns `null`, caller falls back to
 * the pre-existing behaviour byte-for-byte).
 *
 * What it reuses instead of re-inventing:
 *   - `AIContextBuilder._buildOrganizationContext` (aiContextBuilder.ts) —
 *     the SAME organization-context layer Teresa's 6-layer AI context uses
 *     (org name, industry, resolved profile). We call the layer function
 *     directly rather than the full `buildContext()` because that requires
 *     a `userId` and builds four unrelated layers (platform/project/
 *     execution/knowledge) we don't need here.
 *   - Two small, org-scoped SQL reads (active projects, active initiatives)
 *     via the same `DbPromise` (`all`) helper `aiContextBuilder.ts` already
 *     uses for the same tables — no new DB abstraction introduced.
 *
 * What is explicitly DEFERRED to a real retrieval fala (not built here):
 *   - Ranking / relevance matching between the document's topic and the
 *     org's data (this pack is "everything recent", not "everything
 *     relevant").
 *   - Pulling in assessment findings, interview transcripts, RAID items,
 *     financial models, etc. (aiContextBuilder's other layers already model
 *     some of this — a follow-up slice can widen this pack to include them).
 *   - Persisting the pack as a `SourcePack` (documentSourcePackService.ts)
 *     so the consultant can review/curate it before generation. Today the
 *     pack is built fresh, in-memory, per generate call — good enough to
 *     stop "0 sources", not good enough for a reviewable evidence trail.
 */

import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import AIContextBuilder from '../aiContextBuilder.js';
import type { DocumentIntake, DocumentSourceRef } from './documentStudioTypes.js';

const MAX_PROJECTS = 8;
const MAX_INITIATIVES = 8;

export interface OrgContextSourcePack {
  /** Reference the generation pipeline can attach as a real `DocumentSourceRef`. */
  sourceRef: DocumentSourceRef;
  /** Plain-language (PL) summary injected into the generation prompt/description. */
  contextSummaryPl: string;
  organizationName: string;
  activeProjectNames: string[];
  activeInitiativeNames: string[];
}

interface NameRow {
  name?: unknown;
}

function toNames(rows: unknown, max: number): string[] {
  if (!Array.isArray(rows)) return [];
  const names: string[] = [];
  for (const row of rows as NameRow[]) {
    const name = typeof row?.name === 'string' ? row.name.trim() : '';
    if (name) names.push(name);
    if (names.length >= max) break;
  }
  return names;
}

/**
 * Builds a minimal org-context grounding pack, or `null` when there is
 * nothing worth attaching (brand-new organization / lookup failure). Never
 * throws — every failure path degrades to `null` so callers can fall back
 * to the pre-existing "no sources" behaviour without regressing.
 */
export async function buildOrgContextSourcePack(
  organizationId: string
): Promise<OrgContextSourcePack | null> {
  if (!organizationId) return null;

  let organizationName = '';
  let industry: string | null = null;
  try {
    const orgContext = await AIContextBuilder._buildOrganizationContext(organizationId);
    organizationName = String(orgContext?.organizationName || '').trim();
    if (organizationName === 'Unknown') organizationName = '';
    industry = orgContext?.industry ? String(orgContext.industry) : null;
  } catch (err) {
    logger.warn('[DocumentOrgContextSourcePack] organization context lookup failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // NOTE: `projects` (000_initdb_core_tables.sql) only ever gained a
  // `created_at` column — no `updated_at` was added by later migrations —
  // so we order by `created_at`, matching `aiContextBuilder._buildOrganizationContext`'s
  // own `is_closed = 0` filter for "active" projects.
  let activeProjectNames: string[] = [];
  try {
    const rows = await dbAll(
      `SELECT name FROM projects
        WHERE organization_id = ? AND is_closed = 0
        ORDER BY created_at DESC LIMIT ?`,
      [organizationId, MAX_PROJECTS]
    );
    activeProjectNames = toNames(rows, MAX_PROJECTS);
  } catch (err) {
    logger.warn('[DocumentOrgContextSourcePack] active projects lookup failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // `initiatives` carries `organization_id` directly (no join needed).
  let activeInitiativeNames: string[] = [];
  try {
    const rows = await dbAll(
      `SELECT name FROM initiatives
        WHERE organization_id = ?
          AND status NOT IN ('COMPLETED', 'CANCELLED')
        ORDER BY updated_at DESC LIMIT ?`,
      [organizationId, MAX_INITIATIVES]
    );
    activeInitiativeNames = toNames(rows, MAX_INITIATIVES);
  } catch (err) {
    logger.warn('[DocumentOrgContextSourcePack] active initiatives lookup failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const hasAnyContext =
    Boolean(organizationName) || activeProjectNames.length > 0 || activeInitiativeNames.length > 0;
  if (!hasAnyContext) {
    // New / empty organization — no regression: caller keeps today's
    // "no sources" behaviour instead of fabricating a hollow reference.
    return null;
  }

  const lines: string[] = [];
  lines.push(
    `Organizacja: ${organizationName || 'nieznana'}${industry ? ` (branża: ${industry})` : ''}.`
  );
  if (activeProjectNames.length > 0) {
    lines.push(
      `Aktywne projekty (${activeProjectNames.length}): ${activeProjectNames.join('; ')}.`
    );
  }
  if (activeInitiativeNames.length > 0) {
    lines.push(
      `Aktywne inicjatywy (${activeInitiativeNames.length}): ${activeInitiativeNames.join('; ')}.`
    );
  }
  const contextSummaryPl = lines.join(' ');

  const sourceRef: DocumentSourceRef = {
    sourceType: 'organization_context',
    sourceId: `org-context-${organizationId}`,
    sourceTitle: organizationName
      ? `Kontekst organizacji: ${organizationName}`
      : 'Kontekst organizacji (automatyczny)',
  };

  return {
    sourceRef,
    contextSummaryPl,
    organizationName,
    activeProjectNames,
    activeInitiativeNames,
  };
}

/**
 * Pure merge step — separated from `buildOrgContextSourcePack` so the
 * "when do we apply auto-grounding, and how do we splice it into the
 * request" decision is unit-testable without touching the database.
 *
 * Rule: ONLY auto-grounds when the caller (frontend) did not already supply
 * any `sourceRefs` — an explicit, curator-picked source pack always wins and
 * is never silently mixed with the auto-built one.
 */
export function applyOrgContextGrounding(
  intake: DocumentIntake,
  sourceRefs: DocumentSourceRef[],
  pack: OrgContextSourcePack | null
): { intake: DocumentIntake; sourceRefs: DocumentSourceRef[]; autoGrounded: boolean } {
  if (!pack || sourceRefs.length > 0) {
    return { intake, sourceRefs, autoGrounded: false };
  }
  // An explicit quantitative brief is itself the authoritative source for
  // generation. Mixing the organization's broad context into it changes the
  // user's source boundary (and can legitimize unrelated initiatives/markets).
  // Keep it isolated and attach a synthetic intake ref so Sources QA remains
  // honest without importing facts the caller did not provide.
  const explicitDescription = String(intake.description || '').trim();
  if (/\d/.test(explicitDescription)) {
    return {
      intake,
      sourceRefs: [
        {
          sourceType: 'intake',
          sourceId: 'explicit-user-brief',
          sourceTitle: `Jawny brief użytkownika: ${explicitDescription}`,
        },
      ],
      autoGrounded: false,
    };
  }
  const groundedDescription = intake.description
    ? `${pack.contextSummaryPl}\n\n${intake.description}`
    : pack.contextSummaryPl;
  return {
    intake: { ...intake, description: groundedDescription },
    sourceRefs: [pack.sourceRef],
    autoGrounded: true,
  };
}
