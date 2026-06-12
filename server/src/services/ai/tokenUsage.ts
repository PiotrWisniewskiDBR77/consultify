/**
 * Normalize AI SDK usage objects to the repo-wide TokenUsage shape.
 *
 * AI SDK v4 reported { promptTokens, completionTokens }; v5/v6 report
 * { inputTokens, outputTokens } — consumers (AIPipeline.logRequest →
 * ai_usage_logs.prompt_tokens/completion_tokens) read the v4 names, so raw
 * v6 usage silently degrades to 0/0. Accept both (plus snake_case from raw
 * provider payloads) and return undefined when there is no signal at all.
 */
export interface NormalizedTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export function normalizeTokenUsage(raw: unknown): NormalizedTokenUsage | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const u = raw as Record<string, unknown>;
  const pick = (...vals: unknown[]) => {
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  };
  const promptTokens = pick(u.promptTokens, u.inputTokens, u.prompt_tokens, u.input_tokens);
  const completionTokens = pick(
    u.completionTokens,
    u.outputTokens,
    u.completion_tokens,
    u.output_tokens
  );
  const totalTokens = pick(u.totalTokens, u.total_tokens) || promptTokens + completionTokens;
  if (promptTokens <= 0 && completionTokens <= 0 && totalTokens <= 0) return undefined;
  return { promptTokens, completionTokens, totalTokens };
}

/**
 * Fallback estimation when a provider does not surface usage on a stream:
 * ~4 chars/token, the same heuristic preflightCostService uses.
 */
export function estimateTokenUsage(inputChars: number, outputChars: number): NormalizedTokenUsage {
  const promptTokens = Math.ceil(Math.max(0, inputChars) / 4);
  const completionTokens = Math.ceil(Math.max(0, outputChars) / 4);
  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
}
