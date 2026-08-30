/**
 * FIX-174 (ERRATA ODBIOR_174 pkt 2): exhaustive, per-tool cost table.
 *
 * Every tool name registered in `toolDefinitions.ts` — both the OpenAI
 * function-calling entries in `AI_TOOLS` AND the internal `wait_until`
 * pause step handled by the same `executeToolCall` switch — MUST appear
 * here explicitly, priced or zeroed WITH a reason. The previous version
 * fell back to a silent `?? 0` for any name not in a short allow-list,
 * which meant a newly registered tool (or a typo'd tool name) cost
 * nothing by default instead of failing loudly. `estimateAgentToolCostUsd`
 * now throws `unknown_tool_cost` for anything not on this list, so a new
 * tool is a compile-time-adjacent reminder to price it here, not a silent
 * free ride through `agentResourceGovernanceService`'s cost-limit gate.
 */
const TOOL_COST_USD: Readonly<Record<string, number>> = Object.freeze({
  // ---- Priced: real external / model-backed calls ----------------------
  // External web lookup (Tavily/equivalent). Conservative fixed admission
  // estimate, independent of input/output size.
  search_web: 0.02,
  // Text-to-SQL invokes the governed structured-query operator and its
  // model-backed translation (runStructuredQueryOperator).
  query_structured_data: 0.01,
  // executeKBSearch (ragService.hybridSearch) calls embeddingService's
  // generateEmbedding — a real, billed embedding-model call — before it
  // can run the vector search. ERRATA pkt 2: previously fell through the
  // catch-all and cost nothing.
  search_knowledge_base: 0.01,
  // executeSearchEnterpriseConnector calls out to a Wave7 external
  // connector (wave7ConnectorRuntimeService.executeWave7ConnectorTool) —
  // an actual third-party API call, priced higher than an in-house
  // embedding lookup. ERRATA pkt 2: previously fell through the catch-all
  // and cost nothing.
  search_enterprise_connector: 0.05,

  // ---- Explicit zero: read-only / local / no-op, no billed call --------
  // Lists registered Wave7 connectors from local state
  // (listWave7Connectors) — no external call, unlike the search above.
  list_enterprise_connectors: 0,
  // Local Postgres/SQLite read of maturity_assessments/assessment_scores.
  get_assessment_data: 0,
  // Pure in-process arithmetic (ROI/NPV/payback) on caller-supplied
  // parameters — no external call.
  calculate_financial: 0,
  // Local CPU-bound Monte Carlo simulation (advancedFeatures.js) — no
  // external call.
  run_monte_carlo: 0,
  // Local Postgres/SQLite read of the initiatives table.
  get_initiative_status: 0,
  // Reads from the local/static industryBenchmarkService — no external
  // call.
  compare_benchmarks: 0,
  // decisionMemoryService.findSimilarDecisions is a local keyword-overlap
  // heuristic today (see that file's own comment: "embeddings would be
  // better") — not a billed model call.
  find_similar_decisions: 0,
  // multiStakeholderService.analyzeFromMultiplePerspectives is local
  // heuristic analysis — no external/model call.
  get_stakeholder_analysis: 0,
  // Builds a proposal envelope from caller-supplied args
  // (teresaToolOperatorService.proposeInitiativeDraftOperator) — no model
  // call; requires human approval before anything is created.
  create_initiative_draft: 0,
  // Pure local JSON envelope construction from caller-supplied args — no
  // external call.
  generate_report_section: 0,
  // Pure local JSON proposal envelope from caller-supplied args — no
  // external call; requires approval before scheduling.
  schedule_meeting: 0,
  // Builds a proposal envelope from caller-supplied args
  // (teresaToolOperatorService.proposeNotebookEntryOperator) — no model
  // call.
  create_notebook_entry: 0,
  // Local Postgres/SQLite write via TaskExecutor.
  create_task: 0,
  // Local Postgres/SQLite write (dynamic UPDATE ... tasks).
  update_task: 0,
  // Local Postgres/SQLite write via decision creation path.
  create_decision: 0,
  // Internal pause/checkpoint step (agentPlanSchedulerJob auto-resume) —
  // no tool call at all, just a no-op envelope so the step has a result.
  wait_until: 0,
});

export class UnknownToolCostError extends Error {
  readonly code = 'unknown_tool_cost';

  constructor(toolName: string) {
    super(`unknown_tool_cost: no cost estimate registered for tool "${toolName}"`);
    this.name = 'UnknownToolCostError';
  }
}

export function estimateAgentToolCostUsd(toolName: string): number {
  if (!Object.prototype.hasOwnProperty.call(TOOL_COST_USD, toolName)) {
    throw new UnknownToolCostError(toolName);
  }
  return TOOL_COST_USD[toolName];
}
