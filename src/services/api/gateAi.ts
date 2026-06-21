/**
 * Initiative Gate AI — FE API client (M13 Depth · Fala 1, sub-module G5).
 * SSOT spec: docs/product/INITIATIVE_GATE_AI_SPEC.md §5.
 *
 * Lazy, fail-open client for the gate readiness endpoint. Per spec the AI
 * layer must NEVER hard-break the UI: on any failure (network, missing body,
 * flag OFF, LLM down) we resolve to a safe disabled response so the gate bar
 * simply behaves as if the feature were off.
 */

import { Api } from '@/services/api';
import type { GateAiCheckResponse } from '@/types/gateAi';

/** Safe disabled response used whenever the call cannot be trusted (fail-open). */
function disabledResponse(gate: string): GateAiCheckResponse {
  return { enabled: false, gate, aiReadiness: null, timeline: null };
}

/**
 * Ask the server to score an initiative's readiness for a given progress gate.
 *
 * POST /initiatives/:id/gate-ai-check  body: { gate }
 *
 * Fail-open: resolves to a disabled response instead of throwing so callers
 * never have to guard against rejection.
 */
export async function checkGateAi(
  initiativeId: string,
  gate: string
): Promise<GateAiCheckResponse> {
  try {
    const res = await Api.post(`/initiatives/${initiativeId}/gate-ai-check`, { gate });
    const data = (res?.data ?? res) as Partial<GateAiCheckResponse> | null | undefined;

    if (!data || typeof data !== 'object') {
      return disabledResponse(gate);
    }

    return {
      enabled: data.enabled === true,
      gate: typeof data.gate === 'string' ? data.gate : gate,
      aiReadiness: data.aiReadiness ?? null,
      timeline: data.timeline ?? null,
    };
  } catch {
    // Network error, 4xx/5xx, malformed JSON — never block the UI.
    return disabledResponse(gate);
  }
}
