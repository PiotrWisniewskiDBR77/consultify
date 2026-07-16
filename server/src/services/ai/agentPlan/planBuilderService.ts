/**
 * PlanBuilder — manifest -> executable step list (HP-4 koncept, zadanie F1).
 *
 * SSOT koncepcyjne: Harvard/wdrozenie-100/_KONCEPT_HP4_AGENT_W_TERESIE.md
 * §2/§4 (tabela zadań, wiersz F1). Problem, który ten plik rozwiązuje:
 * `discoveryAgentManifestCatalog.ts` jest CELOWO summary-only (id/displayName/
 * status/wave/configDir — bez `steps`, patrz nagłówek tego pliku). Bez
 * PlanBuildera, `AgentManifestLauncher.tsx` (frontend) tworzyła plan z JEDNYM
 * krokiem "kickoff" (search_knowledge_base) niezależnie od wybranego agenta —
 * czyli agent NIGDY nie wykonywał realnej wieloetapowej pracy. Ten moduł
 * zastępuje ten placeholder deterministycznym tłumaczeniem
 * `manifestId -> lista kroków {toolName, toolInput, rationale}`, gdzie każdy
 * krok jest realnym wywołaniem z rejestru `toolDefinitions.ts` (ten sam
 * rejestr, którego używa czat Teresy i `agentPlannerService.executePlan`).
 *
 * Dlaczego deterministyczne mapowanie, nie LLM: katalog manifestów nie
 * niesie pól `tools`/`capabilities` (SUMMARY-ONLY z rozmysłem — patrz komentarz
 * w discoveryAgentManifestCatalog.ts), więc nie ma z czego wyciągnąć realnego
 * zestawu narzędzi przez prompt bez zgadywania. Kuszący LLM-planner (koncept
 * §1 pkt 2, "PlanBuilder woła LLM") jest odłożony — ryzyko flaky (patrz
 * finding_demo_llm_tier_glm_flaky_2026-07-07) i koszt tokenów na coś, co da
 * się rozstrzygnąć jawną, audytowalną tabelą. Ten plik jest tą tabelą: per
 * manifest-id kurowany playbook (3-4 kroki, dobrany do faktycznego znaczenia
 * narzędzia Discovery), z bezpiecznym fallbackiem per `wave` (wave-1/2/3/
 * reference) dla manifestów bez kuracji (w tym 12 wpisów `status: 'planned'`
 * w katalogu) oraz generycznym fallbackiem dla ID spoza katalogu w ogóle.
 *
 * Mutacja i aprobata: krok, którego `toolName` należy do
 * `agentPlannerService.SIDE_EFFECT_TOOLS` (np. `generate_report_section`,
 * `create_notebook_entry`, `query_structured_data`), zostanie automatycznie
 * zatrzymany na `awaiting_approval` przez `agentPlannerService.createPlan`
 * (ono, nie ten plik, liczy `requiresApproval`). Ten moduł DODATKOWO wystawia
 * `requiresApproval` na każdym zwróconym kroku (czytając ten sam
 * `SIDE_EFFECT_TOOLS`, zaimportowany — nie zduplikowany) — wyłącznie do
 * podglądu/testów/audytu przed zapisem do bazy; źródłem prawdy pozostaje
 * `agentPlannerService`.
 *
 * Limit: każdy playbook <= 8 kroków (koncept F1 kryterium odbioru: "3-8
 * kroków"), dobrze poniżej twardego `MAX_STEPS_PER_PLAN = 12` z routera.
 */
import {
  type DiscoveryAgentManifestSummary,
  getDiscoveryAgentManifest,
} from '../agentRuntime/discoveryAgentManifestCatalog.js';
import { SIDE_EFFECT_TOOLS } from '../sideEffectTools.js';

export interface PlanBuilderStep {
  toolName: string;
  toolInput: Record<string, unknown>;
  /** Human-readable reason this step is in the plan — for the panel/audit trail, not persisted by createPlan. */
  rationale: string;
  /** Mirrors agentPlannerService.SIDE_EFFECT_TOOLS — read-only preview of what createPlan will compute. */
  requiresApproval: boolean;
}

function step(
  toolName: string,
  toolInput: Record<string, unknown>,
  rationale: string
): PlanBuilderStep {
  return { toolName, toolInput, rationale, requiresApproval: SIDE_EFFECT_TOOLS.has(toolName) };
}

/**
 * Curated per-manifest playbooks — one entry per Discovery Tool with
 * `status: 'built'` in the catalog (18 built manifests + 1 reference =
 * 19 entries below). Each sequence: 1-2 read/analysis steps that gather the
 * inputs the tool conceptually needs, followed by one synthesis/output step
 * (report section, or a direct My Work write for the operational wave-3
 * tools whose output is an actionable artifact rather than a narrative).
 */
const CURATED_PLAYBOOKS: Record<string, (label: string) => PlanBuilderStep[]> = {
  // wave-1 — strategic discovery
  'market-forces': (label) => [
    step(
      'search_knowledge_base',
      { query: 'competitive forces: suppliers, buyers, substitutes, new entrants, rivalry' },
      `${label}: gather internal evidence on the five competitive forces`
    ),
    step(
      'compare_benchmarks',
      { industry: 'general', metric_type: 'operational' },
      `${label}: compare competitive position against industry benchmarks`
    ),
    step(
      'generate_report_section',
      {
        section_title: 'Market Forces Analysis',
        section_type: 'analysis',
        data_sources: ['knowledge_base', 'benchmarks'],
        format: 'mixed',
      },
      `${label}: synthesize findings into a Porter Five Forces analysis`
    ),
  ],
  'growth-paths': (label) => [
    step(
      'search_knowledge_base',
      {
        query:
          'growth strategy: market penetration, market development, product development, diversification',
      },
      `${label}: gather context on current growth strategy options`
    ),
    step(
      'get_initiative_status',
      { include_tasks: false, include_risks: false },
      `${label}: review initiatives already in flight for each growth path`
    ),
    step(
      'calculate_financial',
      { calculation_type: 'roi' },
      `${label}: size the ROI of the strongest growth path`
    ),
    step(
      'generate_report_section',
      {
        section_title: 'Growth Path Options (Ansoff)',
        section_type: 'recommendations',
        data_sources: ['initiatives', 'financials'],
      },
      `${label}: recommend a prioritized growth path`
    ),
  ],
  'portfolio-priority': (label) => [
    step(
      'get_initiative_status',
      { include_tasks: false, include_risks: true },
      `${label}: pull the full initiative portfolio with risk flags`
    ),
    step(
      'calculate_financial',
      { calculation_type: 'scenario_comparison' },
      `${label}: compare initiatives on a common financial basis`
    ),
    step(
      'generate_report_section',
      {
        section_title: 'Portfolio Priority Ranking',
        section_type: 'recommendations',
        data_sources: ['initiatives', 'financials'],
      },
      `${label}: produce a ranked priority list`
    ),
  ],
  'risk-uncertainty': (label) => [
    step(
      'get_initiative_status',
      { include_risks: true },
      `${label}: pull initiatives with their current risk register`
    ),
    step(
      'run_monte_carlo',
      { base_roi: 100, capex: 100000, uncertainty: 0.3 },
      `${label}: model outcome uncertainty via Monte Carlo simulation`
    ),
    step(
      'generate_report_section',
      { section_title: 'Risk & Uncertainty Assessment', section_type: 'risk' },
      `${label}: write up the risk-adjusted outlook`
    ),
  ],
  // wave-2 — strategic synthesis
  'value-chain': (label) => [
    step(
      'search_knowledge_base',
      { query: 'value chain primary and support activities' },
      `${label}: gather documented activity descriptions`
    ),
    step(
      'get_assessment_data',
      { include_benchmarks: true },
      `${label}: pull maturity scores per activity area`
    ),
    step(
      'generate_report_section',
      { section_title: 'Value Chain Analysis', section_type: 'analysis' },
      `${label}: map strengths/weaknesses across the chain`
    ),
  ],
  'ambition-decomposer': (label) => [
    step(
      'get_initiative_status',
      {},
      `${label}: inventory initiatives that already serve the stated ambition`
    ),
    step(
      'get_stakeholder_analysis',
      { topic: 'Ambition decomposition into strategic priorities' },
      `${label}: pressure-test the ambition from multiple executive angles`
    ),
    step(
      'generate_report_section',
      { section_title: 'Ambition Decomposition', section_type: 'executive_summary' },
      `${label}: decompose the ambition into concrete priorities`
    ),
  ],
  'focus-tradeoff': (label) => [
    step(
      'get_initiative_status',
      { include_risks: false },
      `${label}: see what is currently competing for resources`
    ),
    step(
      'find_similar_decisions',
      { description: 'Focus / resource trade-off decision', decision_type: 'strategic' },
      `${label}: check how similar trade-offs were resolved before`
    ),
    step(
      'generate_report_section',
      { section_title: 'Focus Trade-offs', section_type: 'recommendations' },
      `${label}: recommend where to focus and what to deprioritize`
    ),
  ],
  'capability-mapper': (label) => [
    step(
      'get_assessment_data',
      { include_benchmarks: true },
      `${label}: pull current capability/maturity scores`
    ),
    step(
      'search_knowledge_base',
      { query: 'organizational capability gaps and maturity' },
      `${label}: gather qualitative evidence of capability gaps`
    ),
    step(
      'generate_report_section',
      { section_title: 'Capability Map', section_type: 'analysis' },
      `${label}: produce the capability map with gaps highlighted`
    ),
  ],
  'narrative-engine': (label) => [
    step(
      'get_initiative_status',
      {},
      `${label}: gather the initiatives the narrative needs to explain`
    ),
    step(
      'get_stakeholder_analysis',
      { topic: 'Strategic narrative for the change program' },
      `${label}: check the narrative lands with each stakeholder lens`
    ),
    step(
      'generate_report_section',
      { section_title: 'Narrative Draft', section_type: 'executive_summary' },
      `${label}: draft the narrative`
    ),
  ],
  // wave-3 — operational execution (output = actionable artifact, not just narrative)
  'sop-builder': (label) => [
    step(
      'search_knowledge_base',
      { query: 'existing standard operating procedures' },
      `${label}: check for prior SOP documentation`
    ),
    step(
      'query_structured_data',
      { question: 'Which active processes have no documented SOP?', data_domain: 'tasks' },
      `${label}: find undocumented processes to prioritize`
    ),
    step(
      'create_notebook_entry',
      {
        title: 'SOP Draft',
        content: 'Draft SOP generated by the SOP Builder agent — review before publishing.',
        entry_type: 'action_item',
      },
      `${label}: propose an SOP draft for review`
    ),
  ],
  'a3-problem-solving': (label) => [
    step(
      'search_knowledge_base',
      { query: 'problem background and current condition' },
      `${label}: gather background on the reported problem`
    ),
    step(
      'find_similar_decisions',
      {
        description: 'Root cause analysis for a recurring operational problem',
        decision_type: 'process',
      },
      `${label}: check how similar root causes were tackled before`
    ),
    step(
      'create_notebook_entry',
      {
        title: 'A3 Problem Solving Draft',
        content:
          'Draft A3 (background, current condition, root cause, countermeasures) — review before finalizing.',
        entry_type: 'research',
      },
      `${label}: draft the A3 for review`
    ),
  ],
  'smed-planner': (label) => [
    step(
      'search_knowledge_base',
      { query: 'changeover and setup time reduction current state' },
      `${label}: gather current changeover documentation`
    ),
    step(
      'query_structured_data',
      { question: 'Current changeover/setup times by line', data_domain: 'tasks' },
      `${label}: pull current setup-time data`
    ),
    step(
      'generate_report_section',
      { section_title: 'SMED Setup Reduction Plan', section_type: 'recommendations' },
      `${label}: propose an internal/external setup split plan`
    ),
  ],
  'dms-builder': (label) => [
    step('get_initiative_status', {}, `${label}: see initiatives the daily system should track`),
    step(
      'query_structured_data',
      { question: 'Where are daily KPI tracking gaps?', data_domain: 'kpis' },
      `${label}: find KPIs missing a daily cadence`
    ),
    step(
      'create_notebook_entry',
      {
        title: 'Daily Management System Draft',
        content:
          'Draft daily management routine (tiered huddles, KPI boards) — review before rollout.',
        entry_type: 'action_item',
      },
      `${label}: propose a daily management routine`
    ),
  ],
  'inventory-autopilot': (label) => [
    step(
      'query_structured_data',
      { question: 'Inventory levels vs targets by SKU/category', data_domain: 'financials' },
      `${label}: pull current inventory position`
    ),
    step(
      'calculate_financial',
      { calculation_type: 'scenario_comparison' },
      `${label}: compare replenishment scenarios financially`
    ),
    step(
      'generate_report_section',
      { section_title: 'Inventory Autopilot Plan', section_type: 'recommendations' },
      `${label}: recommend a replenishment policy`
    ),
  ],
  'rpa-scanner': (label) => [
    step(
      'search_knowledge_base',
      { query: 'manual, repetitive process candidates for automation' },
      `${label}: gather documented manual workflows`
    ),
    step(
      'query_structured_data',
      { question: 'Tasks with high repetition or manual effort', data_domain: 'tasks' },
      `${label}: find high-repetition task candidates`
    ),
    step(
      'generate_report_section',
      { section_title: 'RPA Candidate Shortlist', section_type: 'recommendations' },
      `${label}: shortlist and rank automation candidates`
    ),
  ],
  'ai-discovery': (label) => [
    step(
      'search_knowledge_base',
      { query: 'AI use case candidates and data readiness' },
      `${label}: gather existing AI use-case notes`
    ),
    step(
      'get_assessment_data',
      { axis: 'data_analytics', include_benchmarks: true },
      `${label}: check data/analytics maturity for feasibility`
    ),
    step(
      'generate_report_section',
      { section_title: 'AI Discovery Findings', section_type: 'analysis' },
      `${label}: summarize viable AI use cases`
    ),
  ],
  'pain-explorer': (label) => [
    step(
      'search_knowledge_base',
      { query: 'reported pain points and friction across processes' },
      `${label}: gather documented pain points`
    ),
    step(
      'find_similar_decisions',
      {
        description: 'Prioritizing operational pain points for resolution',
        decision_type: 'process',
      },
      `${label}: check how similar pain points were prioritized before`
    ),
    step(
      'generate_report_section',
      { section_title: 'Pain Point Exploration', section_type: 'analysis' },
      `${label}: rank pain points by impact and effort`
    ),
  ],
  'process-automation': (label) => [
    step(
      'search_knowledge_base',
      { query: 'process automation opportunities' },
      `${label}: gather documented process descriptions`
    ),
    step(
      'query_structured_data',
      { question: 'Process steps with manual handoffs', data_domain: 'tasks' },
      `${label}: find manual handoff points`
    ),
    step(
      'generate_report_section',
      { section_title: 'Process Automation Roadmap', section_type: 'recommendations' },
      `${label}: propose an automation roadmap`
    ),
  ],
  // reference
  'dynamic-swot': (label) => [
    step(
      'search_knowledge_base',
      { query: 'internal strengths and weaknesses' },
      `${label}: gather internal SWOT evidence`
    ),
    step(
      'compare_benchmarks',
      { industry: 'general', metric_type: 'maturity' },
      `${label}: benchmark against peers for external context`
    ),
    step(
      'generate_report_section',
      { section_title: 'Dynamic SWOT', section_type: 'analysis' },
      `${label}: synthesize into a SWOT`
    ),
  ],
};

/** Fallback playbooks per rollout wave — used for catalog entries without a curated playbook above (mainly the 12 `status: 'planned'` manifests, all wave-3 today). */
const WAVE_DEFAULT_PLAYBOOKS: Record<string, (label: string) => PlanBuilderStep[]> = {
  'wave-1': (label) => [
    step(
      'search_knowledge_base',
      { query: `${label}: relevant internal context` },
      `${label}: gather internal context`
    ),
    step('get_assessment_data', { include_benchmarks: true }, `${label}: pull maturity scores`),
    step(
      'compare_benchmarks',
      { industry: 'general', metric_type: 'operational' },
      `${label}: benchmark against peers`
    ),
    step(
      'generate_report_section',
      { section_title: label, section_type: 'analysis' },
      `${label}: synthesize into an analysis section`
    ),
  ],
  'wave-2': (label) => [
    step(
      'search_knowledge_base',
      { query: `${label}: relevant internal context` },
      `${label}: gather internal context`
    ),
    step('get_initiative_status', {}, `${label}: review related initiatives`),
    step(
      'get_stakeholder_analysis',
      { topic: label },
      `${label}: check the recommendation from multiple stakeholder angles`
    ),
    step(
      'generate_report_section',
      { section_title: label, section_type: 'recommendations' },
      `${label}: synthesize into recommendations`
    ),
  ],
  'wave-3': (label) => [
    step(
      'search_knowledge_base',
      { query: `${label}: relevant internal context` },
      `${label}: gather internal context`
    ),
    step(
      'query_structured_data',
      { question: `Data relevant to: ${label}`, data_domain: 'tasks' },
      `${label}: pull relevant structured data`
    ),
    step(
      'find_similar_decisions',
      { description: label, decision_type: 'process' },
      `${label}: check precedent from similar past decisions`
    ),
    step(
      'generate_report_section',
      { section_title: label, section_type: 'recommendations' },
      `${label}: synthesize into a recommendation`
    ),
  ],
  reference: (label) => [
    step(
      'search_knowledge_base',
      { query: `${label}: relevant internal context` },
      `${label}: gather internal context`
    ),
    step(
      'compare_benchmarks',
      { industry: 'general', metric_type: 'maturity' },
      `${label}: benchmark against peers`
    ),
    step(
      'generate_report_section',
      { section_title: label, section_type: 'analysis' },
      `${label}: synthesize into an analysis section`
    ),
  ],
};

/** Ultimate fallback for a manifestId that is not in the catalog at all (never expected in normal use — the route validates manifestId before calling this). */
const GENERIC_UNKNOWN_PLAYBOOK: PlanBuilderStep[] = [
  step(
    'search_knowledge_base',
    { query: 'general context for an unrecognized agent request' },
    'Unrecognized agent — fall back to a generic knowledge-base lookup'
  ),
  step(
    'generate_report_section',
    { section_title: 'Findings', section_type: 'analysis' },
    'Unrecognized agent — summarize whatever was found'
  ),
];

/**
 * Translate a Discovery Tool manifest into an ordered list of executable
 * steps. Accepts either the manifest id (looked up against the catalog) or
 * an already-resolved manifest object (callers that already fetched it, e.g.
 * the route handler, can skip the double lookup).
 */
export function buildPlanFromManifest(
  manifestOrId: string | DiscoveryAgentManifestSummary | null | undefined
): PlanBuilderStep[] {
  const manifest: DiscoveryAgentManifestSummary | null =
    typeof manifestOrId === 'string'
      ? getDiscoveryAgentManifest(manifestOrId)
      : manifestOrId || null;

  if (!manifest) {
    return GENERIC_UNKNOWN_PLAYBOOK;
  }

  const label = manifest.displayName?.en || manifest.id;
  const curated = CURATED_PLAYBOOKS[manifest.id];
  if (curated) {
    return curated(label);
  }

  const waveDefault = WAVE_DEFAULT_PLAYBOOKS[manifest.wave] || WAVE_DEFAULT_PLAYBOOKS['wave-3'];
  return waveDefault(label);
}

export default buildPlanFromManifest;
