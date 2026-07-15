/**
 * Discovery Agent Manifest Catalog — server-side mirror (HP-2/HP-3 wiring, M01).
 *
 * SSOT for the full manifests (steps/sources/outputs) is the FRONTEND registry:
 * `src/config/agentManifests/discoveryToolsRegistry.ts` (HP-3). That file cannot
 * be imported here — `server/tsconfig.json` scopes `rootDir` to `server/`, so a
 * cross-tree import of frontend `src/` would break the server build (this is the
 * explicit architecture note left in the frontend file's header comment).
 *
 * This module is a deliberate, SUMMARY-ONLY mirror (id/displayName/status/wave/
 * configDir — no steps/sources/outputs, which are larger and more likely to
 * drift). It exists so Teresa's backend (server/src/routes/ai.routes.ts) can
 * answer "what discovery-tool agents exist" without a cross-tree import.
 *
 * Drift guard: `tests/unit/discovery/discoveryAgentManifestCatalog.test.ts`
 * cross-checks this list's ids/status/wave 1:1 against the frontend registry
 * (that test CAN import both trees — vitest.config.ts aliases both `@/` and
 * `server/src/`). If you add/remove/rename a Discovery Tool, update BOTH files
 * — the test will fail loudly if they diverge.
 *
 * Read-only, non-executing — same posture as the frontend registry. No agent
 * here can be "run" via this catalog; it is metadata for a future Plan-mode UI
 * (see HP-4, not yet built). Do not wire this into function-calling / tool-use
 * without a real execution target (see the wiring-plan note in the M01 audit
 * report this file's commit is attached to).
 */

export type DiscoveryAgentManifestStatus = 'built' | 'planned';

export interface DiscoveryAgentManifestDisplayName {
  pl: string;
  en: string;
}

export interface DiscoveryAgentManifestSummary {
  /** Canonical tool type id (matches `ToolType` / `CONSULTING_TOOL_ROLLOUT_PRIORITY`). */
  id: string;
  sourceType: 'discovery_tool';
  status: DiscoveryAgentManifestStatus;
  displayName: DiscoveryAgentManifestDisplayName;
  /** Rollout wave ('wave-1'|'wave-2'|'wave-3'|'reference'). */
  wave: string;
  /** `src/config/<dir>` this tool's config lives in (frontend tree), or null when planned. */
  configDir: string | null;
}

export const DISCOVERY_AGENT_MANIFEST_CATALOG: readonly DiscoveryAgentManifestSummary[] =
  Object.freeze([
    // wave-1 — built
    {
      id: 'market-forces',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Market Forces (Porter 5 Forces)', pl: 'Siły Rynkowe (5 Sił Portera)' },
      wave: 'wave-1',
      configDir: 'src/config/porter',
    },
    {
      id: 'growth-paths',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Growth Paths (Ansoff)', pl: 'Ścieżki Wzrostu (Ansoff)' },
      wave: 'wave-1',
      configDir: 'src/config/ansoff',
    },
    {
      id: 'portfolio-priority',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Portfolio Priority', pl: 'Priorytetyzacja Portfela' },
      wave: 'wave-1',
      configDir: 'src/config/portfolio',
    },
    {
      id: 'risk-uncertainty',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Risk & Uncertainty', pl: 'Ryzyko i Niepewność' },
      wave: 'wave-1',
      configDir: 'src/config/riskuncertainty',
    },
    // wave-2 — built
    {
      id: 'value-chain',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Value Chain', pl: 'Łańcuch Wartości' },
      wave: 'wave-2',
      configDir: 'src/config/valuechain',
    },
    {
      id: 'ambition-decomposer',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Ambition Decomposer', pl: 'Dekompozycja Ambicji' },
      wave: 'wave-2',
      configDir: 'src/config/ambitiondecomposer',
    },
    {
      id: 'focus-tradeoff',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Focus Trade-offs', pl: 'Kompromisy Fokusu' },
      wave: 'wave-2',
      configDir: 'src/config/focustradeoffs',
    },
    {
      id: 'capability-mapper',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Capability Mapper', pl: 'Mapowanie Kompetencji' },
      wave: 'wave-2',
      configDir: 'src/config/capabilitymapper',
    },
    {
      id: 'narrative-engine',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Narrative Engine', pl: 'Silnik Narracji' },
      wave: 'wave-2',
      configDir: 'src/config/narrativeengine',
    },
    // wave-3 — built
    {
      id: 'sop-builder',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'SOP Builder', pl: 'Konstruktor SOP' },
      wave: 'wave-3',
      configDir: 'src/config/sopbuilder',
    },
    {
      id: 'a3-problem-solving',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'A3 Problem Solving', pl: 'Rozwiązywanie Problemów A3' },
      wave: 'wave-3',
      configDir: 'src/config/a3problemsolving',
    },
    {
      id: 'smed-planner',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'SMED Planner', pl: 'Planer SMED' },
      wave: 'wave-3',
      configDir: 'src/config/smedplanner',
    },
    {
      id: 'dms-builder',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Daily Management System', pl: 'System Zarządzania Dziennego' },
      wave: 'wave-3',
      configDir: 'src/config/dmsbuilder',
    },
    {
      id: 'inventory-autopilot',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Inventory Autopilot', pl: 'Autopilot Zapasów' },
      wave: 'wave-3',
      configDir: 'src/config/inventoryautopilot',
    },
    {
      id: 'rpa-scanner',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'RPA Scanner', pl: 'Skaner RPA' },
      wave: 'wave-3',
      configDir: 'src/config/rpascanner',
    },
    {
      id: 'ai-discovery',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'AI Discovery', pl: 'Discovery AI' },
      wave: 'wave-3',
      configDir: 'src/config/aidiscovery',
    },
    {
      id: 'pain-explorer',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Pain Explorer', pl: 'Eksplorator Bolączek' },
      wave: 'wave-3',
      configDir: 'src/config/painexplorer',
    },
    {
      id: 'process-automation',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Process Automation', pl: 'Automatyzacja Procesów' },
      wave: 'wave-3',
      configDir: 'src/config/processautomation',
    },
    // wave-3 — planned (no src/config/<dir> yet)
    {
      id: 'vsm-builder',
      sourceType: 'discovery_tool',
      status: 'planned',
      displayName: { en: 'VSM Builder', pl: 'Konstruktor VSM' },
      wave: 'wave-3',
      configDir: null,
    },
    {
      id: 'constraint-control',
      sourceType: 'discovery_tool',
      status: 'planned',
      displayName: { en: 'Constraint Control (TOC)', pl: 'Kontrola Ograniczeń (TOC)' },
      wave: 'wave-3',
      configDir: null,
    },
    {
      id: 'decision-engine',
      sourceType: 'discovery_tool',
      status: 'planned',
      displayName: { en: 'Decision Engine', pl: 'Silnik Decyzyjny' },
      wave: 'wave-3',
      configDir: null,
    },
    {
      id: 'control-tower',
      sourceType: 'discovery_tool',
      status: 'planned',
      displayName: { en: 'Control Tower', pl: 'Wieża Kontrolna' },
      wave: 'wave-3',
      configDir: null,
    },
    {
      id: 'automation-pipeline',
      sourceType: 'discovery_tool',
      status: 'planned',
      displayName: { en: 'Automation Pipeline', pl: 'Potok Automatyzacji' },
      wave: 'wave-3',
      configDir: null,
    },
    {
      id: 'robotics-feasibility',
      sourceType: 'discovery_tool',
      status: 'planned',
      displayName: { en: 'Robotics Feasibility', pl: 'Wykonalność Robotyzacji' },
      wave: 'wave-3',
      configDir: null,
    },
    {
      id: 'logistics-automation',
      sourceType: 'discovery_tool',
      status: 'planned',
      displayName: { en: 'Logistics Automation', pl: 'Automatyzacja Logistyki' },
      wave: 'wave-3',
      configDir: null,
    },
    {
      id: 'integration-diagnostic',
      sourceType: 'discovery_tool',
      status: 'planned',
      displayName: { en: 'Integration Diagnostic', pl: 'Diagnostyka Integracji' },
      wave: 'wave-3',
      configDir: null,
    },
    {
      id: 'digital-value-pool',
      sourceType: 'discovery_tool',
      status: 'planned',
      displayName: { en: 'Digital Value Pool', pl: 'Pula Wartości Cyfrowej' },
      wave: 'wave-3',
      configDir: null,
    },
    {
      id: 'legacy-analyzer',
      sourceType: 'discovery_tool',
      status: 'planned',
      displayName: { en: 'Legacy Analyzer', pl: 'Analiza Systemów Legacy' },
      wave: 'wave-3',
      configDir: null,
    },
    {
      id: 'data-inventory',
      sourceType: 'discovery_tool',
      status: 'planned',
      displayName: { en: 'Data Inventory', pl: 'Inwentaryzacja Danych' },
      wave: 'wave-3',
      configDir: null,
    },
    {
      id: 'pain-to-solution',
      sourceType: 'discovery_tool',
      status: 'planned',
      displayName: { en: 'Pain to Solution', pl: 'Od Bolączki do Rozwiązania' },
      wave: 'wave-3',
      configDir: null,
    },
    // reference tool — built
    {
      id: 'dynamic-swot',
      sourceType: 'discovery_tool',
      status: 'built',
      displayName: { en: 'Dynamic SWOT', pl: 'Dynamiczny SWOT' },
      wave: 'reference',
      configDir: 'src/config/swot',
    },
  ]);

export function listDiscoveryAgentManifests(filters?: {
  status?: DiscoveryAgentManifestStatus;
  wave?: string;
}): DiscoveryAgentManifestSummary[] {
  let out = [...DISCOVERY_AGENT_MANIFEST_CATALOG];
  if (filters?.status) out = out.filter((m) => m.status === filters.status);
  if (filters?.wave) out = out.filter((m) => m.wave === filters.wave);
  return out;
}

export function getDiscoveryAgentManifest(id: string): DiscoveryAgentManifestSummary | null {
  return DISCOVERY_AGENT_MANIFEST_CATALOG.find((m) => m.id === id) || null;
}
