/**
 * Discovery Tools Agent Registry — HP-3 (Harvey-Parity Blok A)
 *
 * Read-only registry mapping the 31 Discovery Tool types (audited from
 * `CONSULTING_TOOL_ROLLOUT_PRIORITY` in `consultingToolsStandard.ts`, wave-1
 * through wave-3, plus the reference tool `dynamic-swot`) to `AgentManifest`s.
 *
 * 19/31 tool types have a real `src/config/<dir>` today (grep-verified, not
 * guessed) — those get `status: 'built'` manifests with `steps` introspected
 * from the tool's own deepening-ladder/question-bank Record. The remaining
 * 12/31 are wave-3 rollout items with NO config dir yet (confirmed via
 * `find src/config -maxdepth 1 -type d`) — those get `status: 'planned'`
 * manifests with empty steps/sources/outputs (no fabricated content).
 *
 * dir -> toolType mapping was verified via `src/hooks/discovery/useToolAI.ts`
 * (`OPERATIONAL_AI_TOOLS`/`OPERATIONAL_AI_TOOL_NAMES` + the `toolType ===`
 * branches for the strategic tools), not assumed from directory names.
 */
import { A3_DEEPENING_LADDER } from '../a3problemsolving/deepeningLadder';
import { AI_DEEPENING_LADDER } from '../aidiscovery/deepeningLadder';
import { AMBITION_DEEPENING_LADDER } from '../ambitiondecomposer/deepeningLadder';
import { ANSOFF_DEEPENING_LADDER } from '../ansoff/deepeningLadder';
import { CAPABILITY_DEEPENING_LADDER } from '../capabilitymapper/deepeningLadder';
import {
  CONSULTING_TOOL_ROLLOUT_PRIORITY,
  DYNAMIC_SWOT_REFERENCE_CONTRACT,
} from '../consultingToolsStandard';
import { DMS_DEEPENING_LADDER } from '../dmsbuilder/deepeningLadder';
import { FOCUS_DEEPENING_LADDER } from '../focustradeoffs/deepeningLadder';
import { INVENTORY_DEEPENING_LADDER } from '../inventoryautopilot/deepeningLadder';
import { NARRATIVE_DEEPENING_LADDER } from '../narrativeengine/deepeningLadder';
import { PAIN_DEEPENING_LADDER } from '../painexplorer/deepeningLadder';
import { PORTER_QUESTION_BANK } from '../porter/porterQuestionBank';
import { PORTFOLIO_QUESTION_BANK } from '../portfolio/portfolioQuestionBank';
import { AUTOMATION_DEEPENING_LADDER } from '../processautomation/deepeningLadder';
import { RISK_DEEPENING_LADDER } from '../riskuncertainty/deepeningLadder';
import { RPA_DEEPENING_LADDER } from '../rpascanner/deepeningLadder';
import { SMED_DEEPENING_LADDER } from '../smedplanner/deepeningLadder';
import { SOP_DEEPENING_LADDER } from '../sopbuilder/deepeningLadder';
import { DYNAMIC_SWOT_QUESTION_BANK } from '../swot/dynamicSwotQuestionBank';
import { VALUE_CHAIN_ACTIVITIES } from '../valuechain/valueChainQuestionBank';
import { buildBuiltToolManifest, buildPlannedToolManifest } from './discoveryToolManifestMapper';
import type { AgentManifest, AgentManifestDisplayName } from './types';

const NAMES: Record<string, AgentManifestDisplayName> = {
  // wave-1
  'market-forces': { en: 'Market Forces (Porter 5 Forces)', pl: 'Siły Rynkowe (5 Sił Portera)' },
  'growth-paths': { en: 'Growth Paths (Ansoff)', pl: 'Ścieżki Wzrostu (Ansoff)' },
  'portfolio-priority': { en: 'Portfolio Priority', pl: 'Priorytetyzacja Portfela' },
  'risk-uncertainty': { en: 'Risk & Uncertainty', pl: 'Ryzyko i Niepewność' },
  // wave-2
  'value-chain': { en: 'Value Chain', pl: 'Łańcuch Wartości' },
  'ambition-decomposer': { en: 'Ambition Decomposer', pl: 'Dekompozycja Ambicji' },
  'focus-tradeoff': { en: 'Focus Trade-offs', pl: 'Kompromisy Fokusu' },
  'capability-mapper': { en: 'Capability Mapper', pl: 'Mapowanie Kompetencji' },
  'narrative-engine': { en: 'Narrative Engine', pl: 'Silnik Narracji' },
  // wave-3 — built
  'sop-builder': { en: 'SOP Builder', pl: 'Konstruktor SOP' },
  'a3-problem-solving': { en: 'A3 Problem Solving', pl: 'Rozwiązywanie Problemów A3' },
  'smed-planner': { en: 'SMED Planner', pl: 'Planer SMED' },
  'dms-builder': { en: 'Daily Management System', pl: 'System Zarządzania Dziennego' },
  'inventory-autopilot': { en: 'Inventory Autopilot', pl: 'Autopilot Zapasów' },
  'rpa-scanner': { en: 'RPA Scanner', pl: 'Skaner RPA' },
  'ai-discovery': { en: 'AI Discovery', pl: 'Discovery AI' },
  'pain-explorer': { en: 'Pain Explorer', pl: 'Eksplorator Bolączek' },
  'process-automation': { en: 'Process Automation', pl: 'Automatyzacja Procesów' },
  // wave-3 — planned (no src/config/<dir> yet)
  'vsm-builder': { en: 'VSM Builder', pl: 'Konstruktor VSM' },
  'constraint-control': { en: 'Constraint Control (TOC)', pl: 'Kontrola Ograniczeń (TOC)' },
  'decision-engine': { en: 'Decision Engine', pl: 'Silnik Decyzyjny' },
  'control-tower': { en: 'Control Tower', pl: 'Wieża Kontrolna' },
  'automation-pipeline': { en: 'Automation Pipeline', pl: 'Potok Automatyzacji' },
  'robotics-feasibility': { en: 'Robotics Feasibility', pl: 'Wykonalność Robotyzacji' },
  'logistics-automation': { en: 'Logistics Automation', pl: 'Automatyzacja Logistyki' },
  'integration-diagnostic': { en: 'Integration Diagnostic', pl: 'Diagnostyka Integracji' },
  'digital-value-pool': { en: 'Digital Value Pool', pl: 'Pula Wartości Cyfrowej' },
  'legacy-analyzer': { en: 'Legacy Analyzer', pl: 'Analiza Systemów Legacy' },
  'data-inventory': { en: 'Data Inventory', pl: 'Inwentaryzacja Danych' },
  'pain-to-solution': { en: 'Pain to Solution', pl: 'Od Bolączki do Rozwiązania' },
  // reference tool
  'dynamic-swot': { en: 'Dynamic SWOT', pl: 'Dynamiczny SWOT' },
};

function nameFor(id: string): AgentManifestDisplayName {
  return (
    NAMES[id] || {
      en: id
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' '),
      pl: id,
    }
  );
}

/** wave-1/2/3 lookup, derived from the doctrine list (not re-typed by hand). */
const WAVE_BY_TOOL_TYPE: Record<string, string> = {};
for (const w of CONSULTING_TOOL_ROLLOUT_PRIORITY) {
  for (const t of w.toolTypes) WAVE_BY_TOOL_TYPE[t] = w.wave;
}

/** The 19 tool types with a real `src/config/<dir>` today (grep-verified). */
const BUILT_TOOL_IDS = [
  'market-forces',
  'growth-paths',
  'portfolio-priority',
  'risk-uncertainty',
  'value-chain',
  'ambition-decomposer',
  'focus-tradeoff',
  'capability-mapper',
  'narrative-engine',
  'sop-builder',
  'a3-problem-solving',
  'smed-planner',
  'dms-builder',
  'inventory-autopilot',
  'rpa-scanner',
  'ai-discovery',
  'pain-explorer',
  'process-automation',
  'dynamic-swot',
] as const;

/** The 12 wave-3 tool types with no `src/config/<dir>` yet (rollout not started). */
const PLANNED_TOOL_IDS = [
  'vsm-builder',
  'constraint-control',
  'decision-engine',
  'control-tower',
  'automation-pipeline',
  'robotics-feasibility',
  'logistics-automation',
  'integration-diagnostic',
  'digital-value-pool',
  'legacy-analyzer',
  'data-inventory',
  'pain-to-solution',
] as const;

const BUILT_MANIFESTS: AgentManifest[] = [
  buildBuiltToolManifest({
    id: 'market-forces',
    configDir: 'src/config/porter',
    displayName: nameFor('market-forces'),
    wave: WAVE_BY_TOOL_TYPE['market-forces'] ?? null,
    stepsSource: PORTER_QUESTION_BANK,
  }),
  buildBuiltToolManifest({
    id: 'growth-paths',
    configDir: 'src/config/ansoff',
    displayName: nameFor('growth-paths'),
    wave: WAVE_BY_TOOL_TYPE['growth-paths'] ?? null,
    stepsSource: ANSOFF_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'portfolio-priority',
    configDir: 'src/config/portfolio',
    displayName: nameFor('portfolio-priority'),
    wave: WAVE_BY_TOOL_TYPE['portfolio-priority'] ?? null,
    stepsSource: PORTFOLIO_QUESTION_BANK,
    // Portfolio can seed itself from the org's existing initiatives (portfolioOrgImport.ts).
    extraSources: ['org-initiatives'],
  }),
  buildBuiltToolManifest({
    id: 'risk-uncertainty',
    configDir: 'src/config/riskuncertainty',
    displayName: nameFor('risk-uncertainty'),
    wave: WAVE_BY_TOOL_TYPE['risk-uncertainty'] ?? null,
    stepsSource: RISK_DEEPENING_LADDER,
    // raidHandoff.ts hands findings off as RAID log items to Initiatives/Risk.
    extraOutputs: ['raid-log'],
  }),
  buildBuiltToolManifest({
    id: 'value-chain',
    configDir: 'src/config/valuechain',
    displayName: nameFor('value-chain'),
    wave: WAVE_BY_TOOL_TYPE['value-chain'] ?? null,
    stepsSource: VALUE_CHAIN_ACTIVITIES.map((a) => a.id),
  }),
  buildBuiltToolManifest({
    id: 'ambition-decomposer',
    configDir: 'src/config/ambitiondecomposer',
    displayName: nameFor('ambition-decomposer'),
    wave: WAVE_BY_TOOL_TYPE['ambition-decomposer'] ?? null,
    stepsSource: AMBITION_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'focus-tradeoff',
    configDir: 'src/config/focustradeoffs',
    displayName: nameFor('focus-tradeoff'),
    wave: WAVE_BY_TOOL_TYPE['focus-tradeoff'] ?? null,
    stepsSource: FOCUS_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'capability-mapper',
    configDir: 'src/config/capabilitymapper',
    displayName: nameFor('capability-mapper'),
    wave: WAVE_BY_TOOL_TYPE['capability-mapper'] ?? null,
    stepsSource: CAPABILITY_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'narrative-engine',
    configDir: 'src/config/narrativeengine',
    displayName: nameFor('narrative-engine'),
    wave: WAVE_BY_TOOL_TYPE['narrative-engine'] ?? null,
    stepsSource: NARRATIVE_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'sop-builder',
    configDir: 'src/config/sopbuilder',
    displayName: nameFor('sop-builder'),
    wave: WAVE_BY_TOOL_TYPE['sop-builder'] ?? null,
    stepsSource: SOP_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'a3-problem-solving',
    configDir: 'src/config/a3problemsolving',
    displayName: nameFor('a3-problem-solving'),
    wave: WAVE_BY_TOOL_TYPE['a3-problem-solving'] ?? null,
    stepsSource: A3_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'smed-planner',
    configDir: 'src/config/smedplanner',
    displayName: nameFor('smed-planner'),
    wave: WAVE_BY_TOOL_TYPE['smed-planner'] ?? null,
    stepsSource: SMED_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'dms-builder',
    configDir: 'src/config/dmsbuilder',
    displayName: nameFor('dms-builder'),
    wave: WAVE_BY_TOOL_TYPE['dms-builder'] ?? null,
    stepsSource: DMS_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'inventory-autopilot',
    configDir: 'src/config/inventoryautopilot',
    displayName: nameFor('inventory-autopilot'),
    wave: WAVE_BY_TOOL_TYPE['inventory-autopilot'] ?? null,
    stepsSource: INVENTORY_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'rpa-scanner',
    configDir: 'src/config/rpascanner',
    displayName: nameFor('rpa-scanner'),
    wave: WAVE_BY_TOOL_TYPE['rpa-scanner'] ?? null,
    stepsSource: RPA_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'ai-discovery',
    configDir: 'src/config/aidiscovery',
    displayName: nameFor('ai-discovery'),
    wave: WAVE_BY_TOOL_TYPE['ai-discovery'] ?? null,
    stepsSource: AI_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'pain-explorer',
    configDir: 'src/config/painexplorer',
    displayName: nameFor('pain-explorer'),
    wave: WAVE_BY_TOOL_TYPE['pain-explorer'] ?? null,
    stepsSource: PAIN_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'process-automation',
    configDir: 'src/config/processautomation',
    displayName: nameFor('process-automation'),
    wave: WAVE_BY_TOOL_TYPE['process-automation'] ?? null,
    stepsSource: AUTOMATION_DEEPENING_LADDER,
  }),
  buildBuiltToolManifest({
    id: 'dynamic-swot',
    configDir: 'src/config/swot',
    displayName: nameFor('dynamic-swot'),
    wave: DYNAMIC_SWOT_REFERENCE_CONTRACT.toolType === 'dynamic-swot' ? 'reference' : null,
    stepsSource: DYNAMIC_SWOT_QUESTION_BANK,
  }),
];

const PLANNED_MANIFESTS: AgentManifest[] = PLANNED_TOOL_IDS.map((id) =>
  buildPlannedToolManifest({
    id,
    displayName: nameFor(id),
    wave: WAVE_BY_TOOL_TYPE[id] ?? null,
  })
);

/** Full 31-entry read-only registry (19 built + 12 planned). */
export const DISCOVERY_TOOL_AGENT_MANIFESTS: readonly AgentManifest[] = Object.freeze([
  ...BUILT_MANIFESTS,
  ...PLANNED_MANIFESTS,
]);

export function getDiscoveryToolAgentManifest(id: string): AgentManifest | null {
  return DISCOVERY_TOOL_AGENT_MANIFESTS.find((m) => m.id === id) || null;
}

export { BUILT_TOOL_IDS, PLANNED_TOOL_IDS };
