const EXTERNAL_TOOL_COST_USD: Readonly<Record<string, number>> = Object.freeze({
  // External web lookup. Conservative fixed admission estimate, independent of input/output size.
  search_web: 0.02,
  // Text-to-SQL invokes the governed structured-query operator and its model-backed translation.
  query_structured_data: 0.01,
});

// All other registered tools currently execute locally or return proposal/no-op JSON. Unknown
// names also cost zero because executeToolCall returns an in-process "Unknown tool" envelope.
export function estimateAgentToolCostUsd(toolName: string): number {
  return EXTERNAL_TOOL_COST_USD[toolName] ?? 0;
}
