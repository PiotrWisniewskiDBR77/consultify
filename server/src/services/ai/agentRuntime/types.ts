import type { ZodTypeAny } from 'zod';

/**
 * Generic Agent Runtime — HP-2 (Harvey-Parity Blok A)
 *
 * Extracted from `agentAudit/orchestratorService.ts` (the only plan/adapt/interact
 * precedent in the codebase before this file existed). The audit orchestrator is now
 * ONE INSTANCE of this generic definition — see `agentAudit/orchestratorService.ts`
 * for the adapter that preserves its exact external behaviour (same exports, same
 * emitted event shapes, same gates).
 *
 * Pipeline (plan -> adapt -> interact -> aggregate), generalized:
 *   plan       = resolve the set of agentIds -> agent role metadata (resolveAgent)
 *   adapt      = gather per-role evidence (KB/web/etc.)          (gatherSources)
 *   interact   = build prompt, call the LLM, parse+post-process   (buildPrompt/postProcess)
 *   validate   = deterministic policy checks on the LLM output    (validators/applyValidation)
 *   aggregate  = combine all per-role reviews into a final verdict (aggregate)
 */

export type AgentRuntimeIntent = string;

export type AgentRuntimeStep =
  | 'plan'
  | 'gather_sources'
  | 'build_prompt'
  | 'interact_llm'
  | 'validate'
  | 'aggregate';

export interface AgentRuntimeEmit {
  (payload: Record<string, unknown>): void;
}

/** Wire event "type" strings — kept per-definition so existing consumers (SSE/UI)
 *  keep receiving byte-identical event shapes after the generic extraction. */
export interface AgentRuntimeEventTypes {
  /** Run-level lifecycle transitions, e.g. reviewing/aggregating/done */
  state: string;
  /** Per-agent stage transitions, e.g. start/kb_retrieval/llm_review/done/rejected/error */
  reviewProgress: string;
  /** Per-agent source-retrieval payloads (kb/web) */
  sources: string;
}

export interface AgentRuntimeGatherContext<TArgs> {
  runArgs: TArgs;
  agentId: string;
  agentMeta: unknown;
  orchestratorRunId: string;
  emit: AgentRuntimeEmit;
}

export interface AgentRuntimeGatherResult {
  kb: unknown[];
  web: unknown[];
  allowedWebUrls: Set<string>;
}

export interface AgentRuntimePromptArgs<TArgs> {
  runArgs: TArgs;
  agentId: string;
  agentMeta: unknown;
  kbSources: unknown[];
  webSources: unknown[];
}

export interface AgentRuntimeValidationResult {
  ok: boolean;
  reason?: string;
}

export interface AgentRuntimeValidatorArgs<TArgs, TReview> {
  review: TReview;
  allowedWebUrls: Set<string>;
  runArgs: TArgs;
}

export interface AgentRuntimePostProcessArgs<TArgs> {
  /** Raw structured-output object returned by the LLM, not yet parsed/validated. */
  raw: unknown;
  agentId: string;
  agentMeta: unknown;
  runArgs: TArgs;
}

export interface AgentRuntimeBaseArgs {
  organizationId?: string | null;
  userId?: string | null;
  agentIds: string[];
  selectedTier?: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
  selectedModelId?: string | null;
  emit?: AgentRuntimeEmit;
}

/**
 * Parametrizes the generic runtime for one agent TYPE (e.g. "audit"). Distinct from an
 * agent ROLE/id (e.g. "function.cfo_finance") which is resolved via `resolveAgent`.
 */
export interface AgentRuntimeDefinition<TArgs extends AgentRuntimeBaseArgs, TReview, TVerdict> {
  /** Stable identifier for this agent type. */
  type: string;
  /** Supported user intents (metadata — not enforced by the runtime itself). */
  intents: readonly AgentRuntimeIntent[];
  /** Ordered pipeline steps this runtime executes (metadata/introspection). */
  steps: readonly AgentRuntimeStep[];
  /** modelRouter capability used to select a model for the LLM call. Default: 'chat_simple'. */
  capability?: string;
  /** Log line prefix, kept per-definition so existing log greps keep matching. */
  logPrefix?: string;
  eventTypes: AgentRuntimeEventTypes;

  /** Resolve a per-role agent definition (registry lookup). Null/undefined => skip role. */
  resolveAgent(agentId: string): unknown | null | undefined;
  /** Gather context/evidence for one role before calling the LLM (kb/web/etc.). */
  gatherSources(ctx: AgentRuntimeGatherContext<TArgs>): Promise<AgentRuntimeGatherResult>;
  /** Build system+user prompt for the LLM call for one role. */
  buildPrompt(args: AgentRuntimePromptArgs<TArgs>): { system: string; user: string };
  /** Schema handed to the structured LLM call (shape hint for the provider). */
  schema: ZodTypeAny;
  /** Parse the raw LLM output into the final per-role review (fills defaults/fallbacks). */
  postProcess(args: AgentRuntimePostProcessArgs<TArgs>): TReview;
  /** Deterministic policy validators run after postProcess. */
  validators: Array<
    (args: AgentRuntimeValidatorArgs<TArgs, TReview>) => AgentRuntimeValidationResult
  >;
  /** Combine validator results into the final review + a hard-reject flag. */
  applyValidation(args: { review: TReview; results: AgentRuntimeValidationResult[] }): {
    review: TReview;
    hard: boolean;
  };
  /** Aggregate all per-role reviews into a final verdict. */
  aggregate(args: { runArgs: TArgs; reviews: TReview[]; orchestratorRunId: string }): TVerdict;
  /** Extra fields merged into the run-level "done" event payload. */
  describeVerdictForEmit?(verdict: TVerdict): Record<string, unknown>;

  /** Lifecycle hooks (metrics/logging). Optional — generic runtime does not assume any. */
  onRunStart?(args: { runArgs: TArgs; orchestratorRunId: string }): void;
  onRunDone?(args: { runArgs: TArgs; orchestratorRunId: string; verdict: TVerdict }): void;
}

export interface AgentRuntimeResult<TReview, TVerdict> {
  orchestratorRunId: string;
  reviews: TReview[];
  verdict: TVerdict;
}
