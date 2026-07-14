/**
 * Portfolio Priority — org-initiative import (OXFORD O3, tool #5, bonus coherence).
 *
 * When a session has access to the organization's real initiatives (a
 * `portfolioSummary` in the tool context), the consultant should be able to pull
 * them in as portfolio ELEMENTS instead of retyping them. This is a PURE adapter:
 * it maps whatever loosely-shaped initiative summaries the context carries onto the
 * `PortfolioElement` contract used by the matrix engine, mapping existing
 * impact/effort language onto the value/feasibility axes and preserving any
 * declared dependencies. It never invents scores — missing scores land on the
 * neutral midpoint and inherit "declared" evidence downstream.
 */

import type { PortfolioElement } from './portfolioMatrixEngine';
import { AXIS_MIDPOINT } from './portfolioMatrixEngine';
import type { PortfolioDependency } from './portfolioValueStaircase';

/** The loose shape an org initiative summary tends to arrive in (all optional). */
export interface OrgInitiativeSummary {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  /** Either numeric 1..5 or the qualitative high/medium/low the app uses elsewhere. */
  estimatedImpact?: number | 'high' | 'medium' | 'low';
  estimatedEffort?: number | 'high' | 'medium' | 'low';
  impact?: number | 'high' | 'medium' | 'low';
  effort?: number | 'high' | 'medium' | 'low';
  /** Ids of other initiatives this one depends on. */
  dependsOn?: string[];
  dependencies?: string[];
  cost?: number;
}

export interface PortfolioSummaryContext {
  initiatives?: OrgInitiativeSummary[];
  items?: OrgInitiativeSummary[];
}

const QUALITATIVE_TO_SCORE: Record<string, number> = { high: 5, medium: 3, low: 1 };

function toScore(v: number | 'high' | 'medium' | 'low' | undefined): number {
  if (typeof v === 'number' && v >= 1 && v <= 5) return v;
  if (typeof v === 'string' && v in QUALITATIVE_TO_SCORE) return QUALITATIVE_TO_SCORE[v];
  return AXIS_MIDPOINT;
}

/**
 * Effort maps INVERSELY to feasibility: high effort => low feasibility.
 * (value axis = impact directly; feasibility axis = ease of delivery.)
 */
function effortToFeasibility(v: number | 'high' | 'medium' | 'low' | undefined): number {
  const effort = toScore(v);
  return 6 - effort; // 5->1, 3->3, 1->5
}

/**
 * Convert an org `portfolioSummary` context into portfolio elements, ready for the
 * matrix engine. Elements pulled this way are marked `status: 'proposed'` so the
 * evidence/staircase gates still require the consultant to source the scores —
 * importing does not confer confirmation.
 */
export function importOrgInitiativesAsElements(
  context: PortfolioSummaryContext | undefined
): PortfolioElement[] {
  const raw = context?.initiatives ?? context?.items ?? [];
  return raw
    .filter((it) => it && (it.title || it.name))
    .map((it, i) => {
      const depIds = it.dependsOn ?? it.dependencies ?? [];
      const dependencies: PortfolioDependency[] = depIds.filter(Boolean).map((depId) => ({
        dependsOnElementId: String(depId),
        reason: 'imported dependency from org portfolio',
        kind: 'hard' as const,
      }));
      return {
        id: it.id ? String(it.id) : `org-elem-${i}`,
        title: String(it.title ?? it.name),
        valueScore: toScore(it.estimatedImpact ?? it.impact),
        feasibilityScore: effortToFeasibility(it.estimatedEffort ?? it.effort),
        cost: typeof it.cost === 'number' ? it.cost : 1,
        dependencies,
        status: 'proposed', // must be accepted (and sourced) before it counts
      } satisfies PortfolioElement;
    });
}
