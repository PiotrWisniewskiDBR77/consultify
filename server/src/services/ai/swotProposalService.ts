/**
 * swotProposalService — TLS-04 "Teresa-assisted SWOT" generation boundary.
 *
 * Teresa (AI) may PROPOSE SWOT edits, but a proposal must NEVER auto-save.
 * This module ONLY generates and validates candidate proposals; it never
 * touches `tool_sessions` or `swot_proposals` — persistence, the durable
 * audit trail, and the accept/reject gate all live in
 * `server/src/controllers/ToolController.ts` (createSwotProposals /
 * acceptSwotProposal / rejectSwotProposal), which is the ONLY place a
 * proposal's data can ever reach the real SWOT.
 *
 * Provider boundary mirrors `canvasGraphLlm.ts` exactly (same `getLLM()` /
 * `llm.call({type:'structured', ...})` shape, same lazy-import pattern) so
 * tests can `vi.mock('.../llmService.js')` and control the return value or
 * make it throw without any other mocking seam. Retry policy: ONE retry on
 * either a transport error (llm.call throws) or a soft failure (llm
 * returned nothing usable / the shape never validates against
 * `SwotProposalsLlmSchema`) — mirrors `callStructured`'s single-retry
 * wrapper in canvasGraphLlm.ts. NEVER a third attempt, and NEVER a
 * fabricated/fallback proposal on failure: the caller (ToolController) only
 * ever sees `{ok:true, proposals}` with real, schema-validated proposals or
 * an explicit `{ok:false, code}`.
 */

import { z } from 'zod';

import logger from '../../utils/Logger.js';

// ── Provider access (lazy, mirrors canvasGraphLlm.ts / initiativeGenerationService.ts) ──
let _llmServiceInstance: any = null;
async function getLLM(): Promise<any | null> {
  if (_llmServiceInstance) return _llmServiceInstance;
  try {
    const mod = await import('./llmService.js');
    _llmServiceInstance = mod.llmService || mod.default;
    return _llmServiceInstance;
  } catch (err) {
    logger.warn(
      `[swotProposalService] llmService unavailable: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

const LLM_TIMEOUT_MS = 45000;

export type SwotQuadrant = 'strengths' | 'weaknesses' | 'opportunities' | 'threats';
export type SwotOperation = 'add' | 'update' | 'remove';

export interface GeneratedProposal {
  quadrant: SwotQuadrant;
  operation: SwotOperation;
  /** required (non-null) for update/remove, null for add */
  targetItemId?: string | null;
  /** the new/changed item text; null for remove */
  proposedText?: string | null;
  rationale: string;
  /** null/omitted when isAssumption is true */
  sourceRefs?: string[] | null;
  isAssumption: boolean;
  /** 0..1 */
  confidence: number;
}

export type GenerateSwotProposalsResult =
  | { ok: true; proposals: GeneratedProposal[] }
  | { ok: false; code: 'PROVIDER_ERROR' | 'INVALID_MODEL_RESPONSE' };

export interface GenerateSwotProposalsInput {
  toolSessionId: string;
  organizationId: string;
  currentItems: Array<{ id?: unknown; text?: unknown; quadrant?: unknown }>;
  quadrantFocus?: SwotQuadrant;
}

// ── Zod schema for the LLM's raw JSON output ─────────────────────────────────
const GeneratedProposalSchema = z
  .object({
    quadrant: z.enum(['strengths', 'weaknesses', 'opportunities', 'threats']),
    operation: z.enum(['add', 'update', 'remove']),
    targetItemId: z.string().min(1).nullish(),
    proposedText: z.string().min(1).nullish(),
    rationale: z.string().min(1),
    sourceRefs: z.array(z.string().min(1)).nullish(),
    isAssumption: z.boolean(),
    confidence: z.number().min(0).max(1),
  })
  .refine((p) => p.operation !== 'add' || !p.targetItemId, {
    message: 'operation "add" must not carry a targetItemId',
    path: ['targetItemId'],
  })
  .refine((p) => p.operation === 'add' || !!p.targetItemId, {
    message: 'operation "update"/"remove" requires a targetItemId',
    path: ['targetItemId'],
  })
  .refine((p) => p.operation === 'remove' || !!p.proposedText, {
    message: 'operation "add"/"update" requires proposedText',
    path: ['proposedText'],
  })
  .refine((p) => p.isAssumption || (Array.isArray(p.sourceRefs) && p.sourceRefs.length > 0), {
    message: 'a non-assumption proposal requires a non-empty sourceRefs array',
    path: ['sourceRefs'],
  });

const SwotProposalsLlmSchema = z.array(GeneratedProposalSchema).min(1).max(5);

// ── Prompt ────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Teresa, a McKinsey/BCG-grade strategy consultant assisting with a client's SWOT
analysis. You are given the CURRENT state of the four SWOT quadrants (each existing item with its id
and text). Propose 1-5 concrete, high-value changes: NEW items to add, EXISTING items to update
(sharper wording, corrected framing), or EXISTING items to remove (redundant, contradicted, or
no longer relevant).

For EVERY proposal:
- "quadrant": one of strengths | weaknesses | opportunities | threats.
- "operation": "add" (new item, no targetItemId) | "update" (existing item, targetItemId REQUIRED,
  MUST be one of the ids you were given) | "remove" (existing item, targetItemId REQUIRED).
- "proposedText": the new/changed item text for add/update. Omit for remove.
- "rationale": ONE crisp sentence explaining WHY this change matters (not a restatement of the text).
- "isAssumption": true ONLY when you have NO concrete evidence for this claim and are inferring/
  hypothesizing from general reasoning. false when the claim is grounded in something stated in the
  current SWOT context you were given.
- "sourceRefs": when isAssumption is false, a short array of 1-3 strings naming WHERE the grounding
  comes from (e.g. an existing item's id, or a fact explicitly present in the context you were given).
  Omit entirely when isAssumption is true — never invent a source to look grounded.
- "confidence": your calibrated confidence in this specific proposal, 0..1. An assumption should
  virtually never exceed 0.6.

Never invent facts, numbers, or evidence that were not in the context you were given. A proposal you
cannot ground should be marked isAssumption:true with an honest, moderate confidence — never faked
certainty. Return ONLY the JSON array, no prose.`;

function buildUserPrompt(
  byQuadrant: Record<SwotQuadrant, Array<{ id: unknown; text: unknown }>>,
  quadrantFocus?: SwotQuadrant
): string {
  const focusLine = quadrantFocus
    ? `\n\nFocus primarily on the "${quadrantFocus}" quadrant, but propose changes elsewhere too if clearly warranted.`
    : '';
  return `Current SWOT state (quadrant → existing items with id + text):\n${JSON.stringify(
    byQuadrant,
    null,
    2
  )}${focusLine}\n\nPropose 1-5 additions, updates, or removals per the rules above.`;
}

// ── Single structured attempt ────────────────────────────────────────────────
type AttemptResult =
  | { kind: 'success'; value: GeneratedProposal[] }
  | { kind: 'transport_error' }
  | { kind: 'invalid_response' };

async function attempt(
  llm: any,
  userPrompt: string,
  temperature: number
): Promise<AttemptResult> {
  let result: unknown;
  try {
    result = await llm.call({
      type: 'structured',
      modelConfig: { id: 'premium' },
      schema: SwotProposalsLlmSchema,
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 2048,
      temperature,
      cache: false,
      timeoutMs: LLM_TIMEOUT_MS,
    });
  } catch (err) {
    logger.warn(
      `[swotProposalService] structured call failed (transport): ${err instanceof Error ? err.message : String(err)}`
    );
    return { kind: 'transport_error' };
  }

  const obj = (result as { object?: unknown } | undefined)?.object;
  if (!obj) {
    logger.warn('[swotProposalService] llm returned no object');
    return { kind: 'invalid_response' };
  }

  const parsed = SwotProposalsLlmSchema.safeParse(obj);
  if (!parsed.success) {
    logger.warn(
      `[swotProposalService] schema validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`
    );
    return { kind: 'invalid_response' };
  }

  return {
    kind: 'success',
    value: parsed.data.map((p) => ({
      quadrant: p.quadrant,
      operation: p.operation,
      targetItemId: p.targetItemId ?? null,
      proposedText: p.proposedText ?? null,
      rationale: p.rationale,
      sourceRefs: p.sourceRefs ?? null,
      isAssumption: p.isAssumption,
      confidence: p.confidence,
    })),
  };
}

/**
 * Generate 1-5 candidate SWOT proposals for a tool session's current items.
 * NEVER writes anything — pure generate+validate. On any failure after the
 * single retry, returns an explicit `ok:false` (never a fabricated fallback).
 */
export async function generateSwotProposals(
  input: GenerateSwotProposalsInput
): Promise<GenerateSwotProposalsResult> {
  const llm = await getLLM();
  if (!llm) return { ok: false, code: 'PROVIDER_ERROR' };

  const byQuadrant: Record<SwotQuadrant, Array<{ id: unknown; text: unknown }>> = {
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: [],
  };
  for (const item of Array.isArray(input.currentItems) ? input.currentItems : []) {
    const q = item?.quadrant as SwotQuadrant | undefined;
    if (q && byQuadrant[q]) {
      byQuadrant[q].push({ id: item.id, text: item.text });
    }
  }
  const userPrompt = buildUserPrompt(byQuadrant, input.quadrantFocus);

  const first = await attempt(llm, userPrompt, 0.4);
  if (first.kind === 'success') return { ok: true, proposals: first.value };

  // Retry once — a transient timeout or a one-off malformed shape must not
  // sink straight to failure. Slightly lower temperature to reduce drift.
  const second = await attempt(llm, userPrompt, 0.2);
  if (second.kind === 'success') return { ok: true, proposals: second.value };

  // Both attempts failed. If EITHER was a transport/availability failure,
  // report PROVIDER_ERROR (retryable, transient); only when BOTH failures
  // were "got a response but it never validated" do we report
  // INVALID_MODEL_RESPONSE (the model is reachable but not cooperating).
  if (first.kind === 'transport_error' || second.kind === 'transport_error') {
    return { ok: false, code: 'PROVIDER_ERROR' };
  }
  return { ok: false, code: 'INVALID_MODEL_RESPONSE' };
}
