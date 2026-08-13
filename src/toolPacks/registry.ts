/**
 * Rejestr Tool Packów — pokrywa DOKŁADNIE 31 kanonicznych narzędzi z
 * `TOOLS_CANONICAL_ROSTER.md` (Gate T0, żywa baza demo `public.tools`).
 *
 * Nie dodajemy i nie usuwamy narzędzi. Test kontraktowy pilnuje, że rejestr
 * pokrywa się 1:1 z `ToolType`.
 *
 * STANY TREŚCI (uczciwie rozdzielone):
 * - PACK_COMPLETE      — pack spisany i kompletny.
 * - PACK_NOT_AUTHORED  — silnik metody ISTNIEJE w `src/config/<tool>/`
 *                        (zweryfikowane), ale pack nie został jeszcze spisany.
 * - EVIDENCE_MISSING   — brak potwierdzonej merytoryki w repo.
 *
 * STANY RUNTIME: żadne narzędzie nie jest RUNTIME_ACTIVE. Status zdejmowany
 * pojedynczo, dopiero po pełnym DoD (decyzja właściciela 2026-08-13).
 */

import { evidenceMissingPack, type Bilingual, type SignatureArchetype, type ToolPack } from './contract';
import { dynamicSwotPack } from './packs/dynamicSwot.pack';
import type { ToolType } from '@/store/useToolStore';

const bi = (pl: string, en: string): Bilingual => ({ pl, en });

/**
 * 18 narzędzi z ZWERYFIKOWANYM silnikiem metody w `src/config/<katalog>/`,
 * dla których pack nie został jeszcze spisany (dynamic-swot jest 19. i już ma pack).
 */
const ENGINE_BACKED: Array<{
  toolType: ToolType;
  name: Bilingual;
  category: ToolPack['category'];
  archetype: SignatureArchetype;
  configDir: string;
}> = [
  { toolType: 'market-forces', name: bi('Siły rynkowe (Porter)', 'Market Forces (Porter)'), category: 'strategic', archetype: 'force-radial', configDir: 'porter' },
  { toolType: 'growth-paths', name: bi('Ścieżki wzrostu (Ansoff)', 'Growth Paths (Ansoff)'), category: 'strategic', archetype: 'quadrant-strategic-field', configDir: 'ansoff' },
  { toolType: 'value-chain', name: bi('Analiza łańcucha wartości', 'Value Chain Analysis'), category: 'strategic', archetype: 'flow-value-stream', configDir: 'valuechain' },
  { toolType: 'portfolio-priority', name: bi('Priorytetyzacja portfela', 'Portfolio Prioritization'), category: 'strategic', archetype: 'decision-matrix-portfolio', configDir: 'portfolio' },
  { toolType: 'risk-uncertainty', name: bi('Ryzyko i niepewność', 'Risk & Uncertainty'), category: 'strategic', archetype: 'decision-matrix-portfolio', configDir: 'riskuncertainty' },
  { toolType: 'capability-mapper', name: bi('Mapa zdolności', 'Capability Mapper'), category: 'strategic', archetype: 'architecture-capability', configDir: 'capabilitymapper' },
  { toolType: 'ambition-decomposer', name: bi('Dekompozycja ambicji', 'Ambition Decomposer'), category: 'strategic', archetype: 'architecture-capability', configDir: 'ambitiondecomposer' },
  { toolType: 'focus-tradeoff', name: bi('Fokus i kompromisy', 'Focus & Trade-offs'), category: 'strategic', archetype: 'decision-matrix-portfolio', configDir: 'focustradeoffs' },
  { toolType: 'narrative-engine', name: bi('Narracja i spójność', 'Narrative & Alignment'), category: 'strategic', archetype: 'architecture-capability', configDir: 'narrativeengine' },
  { toolType: 'a3-problem-solving', name: bi('Rozwiązywanie problemów A3', 'A3 Problem Solving'), category: 'operational', archetype: 'causal-problem-solving', configDir: 'a3problemsolving' },
  { toolType: 'sop-builder', name: bi('Kreator SOP', 'SOP Builder'), category: 'operational', archetype: 'operating-model-standard', configDir: 'sopbuilder' },
  { toolType: 'smed-planner', name: bi('Planer SMED', 'SMED Planner'), category: 'operational', archetype: 'flow-value-stream', configDir: 'smedplanner' },
  { toolType: 'dms-builder', name: bi('System zarządzania dziennego', 'Daily Management System'), category: 'operational', archetype: 'operating-model-standard', configDir: 'dmsbuilder' },
  { toolType: 'inventory-autopilot', name: bi('Autopilot zapasów', 'Inventory Autopilot'), category: 'operational', archetype: 'decision-matrix-portfolio', configDir: 'inventoryautopilot' },
  // Trzy poniżej: silnik JEST, brakuje gałęzi w ToolCanvas (L4 — podłączenie UI).
  { toolType: 'rpa-scanner', name: bi('Skaner RPA', 'RPA Scanner'), category: 'digital', archetype: 'discovery-candidate-funnel', configDir: 'rpascanner' },
  { toolType: 'ai-discovery', name: bi('Odkrywanie zastosowań AI', 'AI Discovery'), category: 'digital', archetype: 'discovery-candidate-funnel', configDir: 'aidiscovery' },
  { toolType: 'pain-explorer', name: bi('Eksplorator problemów', 'Pain Explorer'), category: 'digital', archetype: 'causal-problem-solving', configDir: 'painexplorer' },
  { toolType: 'process-automation', name: bi('Automatyzacja procesu', 'Process Automation'), category: 'automation', archetype: 'flow-value-stream', configDir: 'processautomation' },
];

/**
 * 12 narzędzi bez potwierdzonej merytoryki w repo. Pokrywają się CO DO JEDNEGO
 * z oznaczonymi `is_coming_soon=1` w bazie — flaga jest uczciwa.
 */
const NO_EVIDENCE: Array<{
  toolType: ToolType;
  name: Bilingual;
  category: ToolPack['category'];
  archetype: SignatureArchetype;
}> = [
  { toolType: 'vsm-builder', name: bi('Kreator VSM', 'VSM Builder'), category: 'operational', archetype: 'flow-value-stream' },
  { toolType: 'constraint-control', name: bi('Sterowanie ograniczeniem (TOC)', 'Constraint Control (TOC)'), category: 'operational', archetype: 'flow-value-stream' },
  { toolType: 'decision-engine', name: bi('Silnik decyzyjny', 'Decision Engine'), category: 'operational', archetype: 'decision-matrix-portfolio' },
  { toolType: 'control-tower', name: bi('Wieża kontrolna', 'Control Tower'), category: 'operational', archetype: 'operating-model-standard' },
  { toolType: 'automation-pipeline', name: bi('Pipeline automatyzacji', 'Automation Pipeline'), category: 'operational', archetype: 'discovery-candidate-funnel' },
  { toolType: 'robotics-feasibility', name: bi('Wykonalność robotyzacji', 'Robotics Feasibility'), category: 'digital', archetype: 'discovery-candidate-funnel' },
  { toolType: 'logistics-automation', name: bi('Automatyzacja logistyki', 'Logistics Automation'), category: 'digital', archetype: 'flow-value-stream' },
  { toolType: 'integration-diagnostic', name: bi('Diagnostyka integracji', 'Integration Diagnostic'), category: 'digital', archetype: 'architecture-capability' },
  { toolType: 'digital-value-pool', name: bi('Pula wartości cyfrowej', 'Digital Value Pool'), category: 'digital', archetype: 'decision-matrix-portfolio' },
  { toolType: 'legacy-analyzer', name: bi('Analizator legacy', 'Legacy Analyzer'), category: 'digital', archetype: 'architecture-capability' },
  { toolType: 'data-inventory', name: bi('Inwentaryzacja danych', 'Data Inventory'), category: 'digital', archetype: 'architecture-capability' },
  { toolType: 'pain-to-solution', name: bi('Od problemu do rozwiązania', 'Pain-to-Solution Mapper'), category: 'digital', archetype: 'causal-problem-solving' },
];

/** Pack-zaślepka dla narzędzia, którego silnik istnieje, ale pack nie jest spisany. */
function notAuthoredPack(entry: (typeof ENGINE_BACKED)[number]): ToolPack {
  const base = evidenceMissingPack(
    entry.toolType,
    entry.name,
    entry.category,
    entry.archetype,
    'RUNTIME_PENDING'
  );
  return {
    ...base,
    contentStatus: 'PACK_NOT_AUTHORED',
    provenance: [
      { source: `src/config/${entry.configDir}/`, verifiableInRepo: true, note: 'Silnik metody istnieje; pack do spisania.' },
    ],
  };
}

export const TOOL_PACKS: ToolPack[] = [
  dynamicSwotPack,
  ...ENGINE_BACKED.map(notAuthoredPack),
  ...NO_EVIDENCE.map((e) =>
    evidenceMissingPack(e.toolType, e.name, e.category, e.archetype, 'COMING_SOON')
  ),
];

const byToolType = new Map<string, ToolPack>(TOOL_PACKS.map((p) => [p.toolType, p]));

export function getToolPack(toolType: string): ToolPack | undefined {
  return byToolType.get(toolType);
}

export function listToolPacks(): ToolPack[] {
  return [...TOOL_PACKS];
}
