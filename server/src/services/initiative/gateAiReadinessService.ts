/**
 * Initiative Gate AI — substantive (merytoryczny) readiness rollup (M13 Depth ·
 * Fala 1 / sub-moduł G2).
 *
 * SSOT spec: docs/product/INITIATIVE_GATE_AI_SPEC.md §3.
 *
 * For a given gate this service:
 *   1. Resolves the gate's required sections (GATE_REQUIRED_SECTIONS).
 *   2. Fetches the initiative ONCE and maps each required section key → its
 *      stored content (no per-section content getter exists; sections live as
 *      columns / related rows on the initiative — see SECTION_CONTENT_RESOLVERS).
 *   3. Scores each section 0–100 by REUSING the existing adversarial reviewer
 *      `initiativeGenerationService.reviewSectionContent` (server/src/services/
 *      initiativeGenerationService.ts:554; the same reviewer wired to
 *      POST /api/initiatives/review-section at
 *      server/src/routes/pmo/initiatives.routes.ts:2075).
 *   4. Rolls the per-section scores into a single weighted (equal-weight)
 *      average → verdict vs the per-org threshold, plus gaps + deduped fixes.
 *
 * FAIL-OPEN: any reviewer/LLM/DB error → returns null. The caller treats null as
 * "no AI gate" and never soft-blocks. This service NEVER throws into the request
 * path.
 *
 * CACHE: results are memoised per (initiativeId, gate, contentHash) with a short
 * TTL, mirroring initiativeGateAiConfig's in-memory Map. The contentHash is
 * derived from the resolved section contents so an edit to any required section
 * naturally invalidates the entry.
 */
import { GATE_REQUIRED_SECTIONS, isAiGate } from '../../constants/initiativeGateAi.js';
import type { GateTypeValue } from '../../constants/initiativeStatuses.js';
import type { GateAiGap, GateAiReadiness } from '../../types/gateAi.js';
import Logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import initiativeGenerationService from '../initiativeGenerationService.js';
import { getGateAiThreshold } from './initiativeGateAiConfig.js';

const LOG_PREFIX = '[initiative:gateAiReadiness]';
const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { value: GateAiReadiness; expiresAt: number }>();

/** Clear the readiness cache (whole, or just one initiative's entries). */
export function clearGateReadinessCache(initiativeId?: string): void {
  if (!initiativeId) {
    cache.clear();
    return;
  }
  const prefix = `${initiativeId}::`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** A trivially-ready rollup (non-AI gate / no required sections). */
function trivialReady(threshold: number): GateAiReadiness {
  return { score: 100, threshold, verdict: 'ready', gaps: [], fixes: [] };
}

/**
 * Per-section content resolvers. Section keys mirror the canon
 * (GATE_REQUIRED_SECTIONS / registry). Each resolver turns an initiative row
 * (SELECT * FROM initiatives) into the text the reviewer scores. JSON-array
 * columns are flattened to readable lines; multi-field sections are joined.
 * Unknown keys fall back to a best-effort column lookup.
 */
type InitiativeRow = Record<string, unknown>;

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function jsonLines(v: unknown): string {
  if (v === null || v === undefined) return '';
  let parsed: unknown = v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return '';
    try {
      parsed = JSON.parse(t);
    } catch {
      return t;
    }
  }
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => (item && typeof item === 'object' ? JSON.stringify(item) : str(item)))
      .filter(Boolean)
      .join('\n');
  }
  if (parsed && typeof parsed === 'object') return JSON.stringify(parsed);
  return str(parsed);
}

function joinParts(parts: Array<string | undefined>): string {
  return parts
    .map((p) => str(p))
    .filter(Boolean)
    .join('\n\n');
}

const SECTION_CONTENT_RESOLVERS: Record<string, (row: InitiativeRow) => string> = {
  overview: (r) => joinParts([str(r.summary), str(r.description), str(r.market_context)]),
  problemDefinition: (r) => joinParts([str(r.problem_statement), str(r.hypothesis_statement)]),
  targetState: (r) => joinParts([jsonLines(r.target_state), str(r.hypothesis)]),
  scope: (r) =>
    joinParts([
      str(r.description),
      jsonLines(r.scope_in),
      jsonLines(r.scope_out),
      jsonLines(r.deliverables),
      jsonLines(r.success_criteria),
    ]),
  financialImpact: (r) =>
    joinParts([
      str(r.business_value),
      str(r.cost_capex),
      str(r.cost_opex),
      str(r.expected_roi),
      str(r.estimated_budget),
      str(r.value_timing),
    ]),
  raid: (r) => joinParts([jsonLines(r.key_risks), jsonLines(r.kill_criteria)]),
  kpis: (r) => joinParts([jsonLines(r.okrs), jsonLines(r.success_criteria)]),
  gates: (r) => joinParts([str(r.status), str(r.progress)]),
  timeline: (r) => joinParts([str(r.planned_start_date), str(r.planned_end_date)]),
  resources: (r) => joinParts([jsonLines(r.resource_tools), str(r.estimated_budget)]),
  team: (r) => joinParts([str(r.owner_business_id), str(r.owner_execution_id), str(r.sponsor_id)]),
  dependencies: (r) => str(r.dependencies),
  tasks: (r) => joinParts([jsonLines(r.deliverables), str(r.progress)]),
  control: (r) => joinParts([jsonLines(r.okrs), str(r.lessons_learned)]),
};

/** Resolve one section key → text content from the initiative row. */
function resolveSectionContent(sectionKey: string, row: InitiativeRow): string {
  const resolver = SECTION_CONTENT_RESOLVERS[sectionKey];
  if (resolver) return resolver(row);
  // Best-effort fallbacks for keys without a dedicated resolver: try the camel
  // → snake column, then the raw key.
  const snake = sectionKey.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  return jsonLines(row[snake] ?? row[sectionKey]);
}

/** Cheap, stable hash over resolved section contents (cache invalidation key). */
function hashContents(sectionContents: Array<[string, string]>): string {
  let h = 5381;
  const joined = sectionContents.map(([k, v]) => `${k}=${v}`).join('');
  for (let i = 0; i < joined.length; i++) {
    h = (h * 33) ^ joined.charCodeAt(i);
  }
  // >>> 0 → unsigned; base36 for compactness.
  return (h >>> 0).toString(36);
}

function getCached(key: string): GateAiReadiness | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  if (entry) cache.delete(key);
  return null;
}

function setCached(key: string, value: GateAiReadiness): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Produce the substantive readiness rollup for a gate.
 *
 * @returns A GateAiReadiness, or `null` on fail-open (non-AI gate is handled as
 *          a trivially-ready rollup; only reviewer/DB failure → null).
 */
export async function getGateReadiness(
  initiativeId: string,
  gate: GateTypeValue,
  organizationId: string
): Promise<GateAiReadiness | null> {
  const id = str(initiativeId);
  const orgId = str(organizationId);

  let threshold: number;
  try {
    threshold = await getGateAiThreshold(orgId);
  } catch (e: any) {
    Logger.warn(`${LOG_PREFIX} threshold resolve failed, fail-open:`, e?.message);
    return null;
  }

  // Non-AI gate or no required sections → trivially ready (never null here: the
  // caller still gets a definite "nothing to evaluate" verdict).
  const requiredSections = GATE_REQUIRED_SECTIONS[gate] || [];
  if (!isAiGate(gate) || requiredSections.length === 0) {
    return trivialReady(threshold);
  }

  try {
    const row = (await queryHelpers.queryOne(
      `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
      [id, orgId]
    )) as InitiativeRow | null;

    // No such initiative in this org → nothing to score. Fail-open to null so
    // the caller does not soft-block on a missing/cross-org row.
    if (!row) {
      Logger.warn(`${LOG_PREFIX} initiative ${id} not found for org ${orgId}, fail-open`);
      return null;
    }

    // Resolve each required section's content once (drives cache hash + review).
    const sectionContents: Array<[string, string]> = requiredSections.map((key) => [
      key,
      resolveSectionContent(key, row),
    ]);

    const cacheKey = `${id}::${gate}::${hashContents(sectionContents)}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    // Score each section via the EXISTING adversarial reviewer.
    const reviews = await Promise.all(
      sectionContents.map(async ([sectionKey, content]) => {
        const review = await initiativeGenerationService.reviewSectionContent(
          sectionKey,
          content,
          {}
        );
        return { sectionKey, content, review };
      })
    );

    // Equal-weight rollup of section scores.
    let scoreSum = 0;
    const gaps: GateAiGap[] = [];
    const fixSet = new Set<string>();

    for (const { sectionKey, review } of reviews) {
      const score = Math.max(0, Math.min(100, Number(review?.score) || 0));
      scoreSum += score;

      if (score < threshold) {
        const issues = [
          ...(Array.isArray(review?.qualityGaps) ? review.qualityGaps : []),
          ...(Array.isArray(review?.failedValidators) ? review.failedValidators : []),
        ]
          .map((s) => str(s))
          .filter(Boolean);
        gaps.push({ section: sectionKey, score, issues });

        for (const fix of Array.isArray(review?.fixes) ? review.fixes : []) {
          const f = str(fix);
          if (f) fixSet.add(f);
        }
      }
    }

    const overall = Math.round(scoreSum / reviews.length);
    const result: GateAiReadiness = {
      score: overall,
      threshold,
      verdict: overall >= threshold ? 'ready' : 'below',
      gaps,
      fixes: Array.from(fixSet),
    };

    setCached(cacheKey, result);
    return result;
  } catch (e: any) {
    // FAIL-OPEN: reviewer/LLM/DB threw → null, never block the request path.
    Logger.warn(`${LOG_PREFIX} readiness rollup failed, fail-open:`, e?.message || e);
    return null;
  }
}
