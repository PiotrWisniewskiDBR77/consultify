/**
 * Initiative Gate AI — shared contract types (M13 Depth · Fala 1).
 * SSOT spec: docs/product/INITIATIVE_GATE_AI_SPEC.md §5.
 *
 * These types are the contract between G2 (readiness rollup), G3 (timeline),
 * G4 (endpoint + telemetry) and G5 (UI). The FE mirror is `src/types/gateAi.ts`
 * — keep both in sync.
 */

/** One under-target section in the substantive rollup. */
export interface GateAiGap {
  /** registry section key (e.g. 'financialImpact') */
  section: string;
  /** reviewer score 0–100 for that section */
  score: number;
  /** concrete deficiencies from the reviewer */
  issues: string[];
}

/** Substantive (merytoryczny) readiness rollup for a gate. */
export interface GateAiReadiness {
  /** weighted rollup score 0–100 across the gate's required sections */
  score: number;
  /** per-org pass threshold in effect */
  threshold: number;
  verdict: 'ready' | 'below';
  /** sections under threshold + their issues */
  gaps: GateAiGap[];
  /** actionable fixes (deduped across gaps) */
  fixes: string[];
  /**
   * DEC-104 (2026-08-26, Initiatives expert panel): true when at least one
   * of the section reviews feeding this rollup came from the deterministic
   * word-count heuristic (no LLM configured, or LLM output unparseable) —
   * see `SectionReviewResult.degraded` in initiativeGenerationService.ts —
   * rather than a real adversarial LLM pass. The UI MUST surface this: a
   * "74/100" score that no model actually computed is a false precision
   * claim if shown identically to a real AI-reviewed score.
   */
  degraded?: boolean;
}

/** One timeline finding (na linii czasu). */
export interface TimelineFlag {
  /** 'block' counts toward soft-block; 'warn' only informs */
  severity: 'block' | 'warn';
  kind: 'dependency' | 'date_conflict' | 'resource_conflict';
  message: string;
  /** referenced ids (dependency initiative ids, conflicting initiative ids, …) */
  refs?: string[];
}

/** Timeline analyzer output (only on planning gates: SCHEDULE, START). */
export interface GateAiTimeline {
  flags: TimelineFlag[];
}

/**
 * Response of POST /api/initiatives/:id/gate-ai-check.
 * `enabled=false` when the org flag is OFF or AI failed open — in that case
 * aiReadiness/timeline are null and the caller must NOT soft-block.
 */
export interface GateAiCheckResponse {
  enabled: boolean;
  gate: string;
  aiReadiness: GateAiReadiness | null;
  timeline: GateAiTimeline | null;
}

/** True when soft-block applies (caller must require an override reason). */
export function gateAiSoftBlocks(resp: GateAiCheckResponse): boolean {
  if (!resp.enabled) return false;
  const belowThreshold = resp.aiReadiness ? resp.aiReadiness.verdict === 'below' : false;
  const timelineBlock = resp.timeline
    ? resp.timeline.flags.some((f) => f.severity === 'block')
    : false;
  return belowThreshold || timelineBlock;
}
