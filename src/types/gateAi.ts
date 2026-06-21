/**
 * Initiative Gate AI — FE contract types (M13 Depth · Fala 1).
 * Mirror of `server/src/types/gateAi.ts` — keep both in sync.
 * SSOT spec: docs/product/INITIATIVE_GATE_AI_SPEC.md §5/§6.
 */

export interface GateAiGap {
  section: string;
  score: number;
  issues: string[];
}

export interface GateAiReadiness {
  score: number;
  threshold: number;
  verdict: 'ready' | 'below';
  gaps: GateAiGap[];
  fixes: string[];
}

export interface TimelineFlag {
  severity: 'block' | 'warn';
  kind: 'dependency' | 'date_conflict' | 'resource_conflict';
  message: string;
  refs?: string[];
}

export interface GateAiTimeline {
  flags: TimelineFlag[];
}

export interface GateAiCheckResponse {
  enabled: boolean;
  gate: string;
  aiReadiness: GateAiReadiness | null;
  timeline: GateAiTimeline | null;
}

export function gateAiSoftBlocks(resp: GateAiCheckResponse): boolean {
  if (!resp.enabled) return false;
  const belowThreshold = resp.aiReadiness ? resp.aiReadiness.verdict === 'below' : false;
  const timelineBlock = resp.timeline
    ? resp.timeline.flags.some((f) => f.severity === 'block')
    : false;
  return belowThreshold || timelineBlock;
}
