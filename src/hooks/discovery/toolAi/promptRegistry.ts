// NOTE: to jest realny builder promptów narzędzi (wołany przez useToolAI→ToolWorkspace).
// NIE myl z server/src/ai/promptRegistry.ts (indeks meta).
import {
  A3_SECTIONS,
  type A3SectionId,
  type A3StepId,
  assessA3,
  buildA3ConclusionPrompt,
  buildA3DeepenPrompt,
  buildA3StaircasePromptRules,
  buildA3StepLadderPromptBlock,
  buildCountermeasureConclusionPromptRules,
} from '@/config/a3problemsolving';
import {
  AI_PHASES,
  type AiPhaseId,
  buildAiDiscoveryConclusionPrompt,
  buildAiDiscoveryDeepenPrompt,
  toDiscoverySession,
} from '@/config/aidiscovery';
import { buildAmbitionDecomposerConclusionPrompt } from '@/config/ambitiondecomposer/conclusionPrompts';
import { buildCapabilityMapperConclusionPrompt } from '@/config/capabilitymapper/conclusionPrompts';
import { CONSULTING_TOOL_STANDARD_OUTPUTS } from '@/config/consultingToolsStandard';
import {
  buildDmsConclusionPrompt,
  buildDmsDeepenPrompt,
  DMS_LAYERS,
  type DmsLayerId,
  toDmsSession,
} from '@/config/dmsbuilder';
import { buildFocusConclusionPrompt } from '@/config/focustradeoffs';
import {
  buildInventoryConclusionPrompt,
  buildInventoryDeepenPrompt,
  INVENTORY_LEVERS,
  type InventoryLeverId,
  toInventorySession,
} from '@/config/inventoryautopilot';
import { buildNarrativeConclusionPrompt } from '@/config/narrativeengine';
import {
  buildPainConclusionPrompt,
  buildPainDeepenPrompt,
  PAIN_STAGES,
  type PainStageId,
  toPainSession,
} from '@/config/painexplorer';
import { buildPorterConclusionPrompt } from '@/config/porter/conclusionPrompts';
import { buildPortfolioConclusionPrompt } from '@/config/portfolio/conclusionPrompts';
import {
  AUTOMATION_PHASES,
  type AutomationPhaseId,
  buildProcessAutomationConclusionPrompt,
  buildProcessAutomationDeepenPrompt,
  toAutomationSession,
} from '@/config/processautomation';
import { buildRiskConclusionPrompt } from '@/config/riskuncertainty';
import { buildRiskLadderPromptBlock } from '@/config/riskuncertainty/riskQuestionBank';
import {
  buildRpaConclusionPrompt,
  buildRpaDeepenPrompt,
  RPA_GATES,
  type RpaGateId,
  toRpaSession,
} from '@/config/rpascanner';
import {
  buildSmedConclusionPrompt,
  buildSmedDeepenPrompt,
  SMED_PHASES,
  type SmedPhaseId,
  toSmedSession,
} from '@/config/smedplanner';
import {
  assessSop,
  buildSopConclusionPrompt,
  buildSopDeepenPrompt,
  SOP_SECTIONS,
  type SopSectionId,
} from '@/config/sopbuilder';
import { buildStaircasePromptRules } from '@/config/swot/swotInsightStaircase';
import {
  buildMoveConclusionPromptRules,
  deriveTensionCandidates,
} from '@/config/swot/swotTensionEngine';
import { buildValueChainConclusionPrompt } from '@/config/valuechain/conclusionPrompts';
import { buildValueChainStaircasePromptRules } from '@/config/valuechain/valueChainInsightStaircase';
import {
  buildValueChainMovePromptRules,
  deriveLeverCandidates,
} from '@/config/valuechain/valueChainMarginEngine';
import { buildSwotFactsBlock } from '@/hooks/discovery/toolAi/dynamicSwot';
import { GROUNDING_RULES_BOTH } from '@/hooks/discovery/toolAi/groundingRules';
import { pickWeakestRung } from '@/hooks/discovery/toolAi/pickWeakestRung';
import type { OperationalToolData, SWOTData, ToolType } from '@/store/useToolStore';

const OPERATIONAL_TOOL_TYPES: ToolType[] = [
  'sop-builder',
  'a3-problem-solving',
  'smed-planner',
  'dms-builder',
  'inventory-autopilot',
  'vsm-builder',
  'constraint-control',
  'decision-engine',
  'control-tower',
  'automation-pipeline',
  'robotics-feasibility',
  'logistics-automation',
  'rpa-scanner',
  'ai-discovery',
  'integration-diagnostic',
  'digital-value-pool',
  'legacy-analyzer',
  'data-inventory',
  'pain-to-solution',
  'pain-explorer',
  'process-automation',
];

const humanizeStepId = (stepId: string): string =>
  stepId.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Best-effort language detection for the grounded conclusion prompts, mirroring
 * the heuristic in the toolAi handlers (growthPaths etc.): Polish diacritics in
 * the mission goal/scope mean the session — and thus the conclusion — is Polish.
 */
const detectIsPolish = (data: unknown): boolean => {
  const ctx = (data as { context?: { goal?: string; scope?: string } } | undefined)?.context;
  const text = `${ctx?.goal || ''} ${ctx?.scope || ''}`;
  return /[ąćęłńóśźż]/i.test(text);
};

/**
 * K5 (decyzja właściciela 07-19) — poziom szczegółowości generacji Discovery
 * (SWOT itd.). Ten sam SWOT może powstać na trzech poziomach głębokości/ilości:
 *   'short'  — krótka  (najmocniejsze sygnały, zwięźle)
 *   'medium' — średnia (== dzisiejsze, bazowe zachowanie)
 *   'full'   — pełna   (maksimum głębokości i pokrycia)
 * Brak wartości === 'medium'.
 */
export type ToolDetailLevel = 'short' | 'medium' | 'full';

/**
 * Buduje dyrektywę poziomu doklejaną do promptu Discovery. Zwraca PUSTY string
 * dla 'medium'/undefined → prompt pozostaje bajt-w-bajt identyczny jak dziś
 * (pełna kompatybilność wsteczna). Steruje TYLKO głębokością/ilością treści,
 * nie zmienia kontraktu JSON ani reguł grounding.
 */
export function buildDetailLevelDirective(
  level: ToolDetailLevel | undefined,
  isPolish: boolean
): string {
  if (level !== 'short' && level !== 'full') return '';
  if (level === 'short') {
    return isPolish
      ? `POZIOM SZCZEGÓŁOWOŚCI: KRÓTKI — wersja gotowa na jeden slajd zarządu.
- Ogranicz się do NAJMOCNIEJSZYCH sygnałów; utrzymaj minimalną wymaganą liczbę pozycji (dolny kraniec podanych zakresów).
- Każdą pozycję jednym zdaniem; zero rozbudowanych uzasadnień poza tym, co konieczne.
- Zachowaj cały wymagany kontrakt JSON i reguły dowodowe — skracasz treść, nie strukturę.`
      : `DETAIL LEVEL: SHORT — a single board-slide version.
- Keep only the STRONGEST signals; hold to the minimum required count (low end of any stated ranges).
- One sentence per item; no expanded rationale beyond what is strictly necessary.
- Preserve the full required JSON contract and evidence rules — you shorten content, not structure.`;
  }
  return isPolish
    ? `POZIOM SZCZEGÓŁOWOŚCI: PEŁNY — maksymalna głębokość analityczna.
- Wyczerp materiał sesji: górny kraniec podanych zakresów liczby pozycji, pełne pokrycie wątków.
- Rozwiń uzasadnienia (dowód → znaczenie → implikacja) i pokaż powiązania między pozycjami.
- Nie wymyślaj faktów ani liczb spoza dostarczonych danych — pogłębiasz analizę, nie fabrykujesz.`
    : `DETAIL LEVEL: FULL — maximum analytical depth.
- Exhaust the session material: top end of any stated item-count ranges, full coverage of threads.
- Expand rationale (evidence → meaning → implication) and surface links between items.
- Invent no facts or numbers beyond the provided data — you deepen the analysis, not fabricate it.`;
}

/**
 * Per-section / per-step suggestion prompt for every Discovery tool. All
 * branches below return a raw prompt string; `getToolSuggestionPrompt`
 * (the exported wrapper) appends GROUNDING_RULES_BOTH to any non-empty
 * result in one place, so every branch inherits the anti-fabrication rules
 * without needing 30+ individual edits.
 */
function getToolSuggestionPromptInner(
  toolType: ToolType,
  stepId: string,
  inputData: unknown
): string {
  // Grounded deepening overrides for the operational tools that carry a
  // deepening ladder (surface -> evidence -> quantification -> risk/capability).
  // These MUST run BEFORE the generic OPERATIONAL_TOOL_TYPES branch below —
  // every one of these tool types is also a member of that list, so a later
  // check would be unreachable dead code (stepId is a real section id here,
  // never 'context'/'summary', so the generic branch always intercepts first;
  // this is the same class of bug OXFORD #102 fixed for the conclusion prompts
  // in getToolSummaryPromptInner below — see that comment).
  //
  // Rung selection: A3 and SOP have an assess*() readiness score
  // (src/config/<tool>/moveValidator.ts::assessA3/assessSop) with a per-section
  // itemCount + evidence/measurable ratio, so pickWeakestRung derives the
  // actual next rung to deepen from session progress instead of a hardcoded
  // string. The other 7 tools below don't have a compatible assess* shape and
  // keep their previous hardcoded rung — no regression there.
  if (toolType === 'a3-problem-solving' && A3_SECTIONS.includes(stepId as A3SectionId)) {
    const opData = inputData as OperationalToolData | undefined;
    const sectionScore = opData
      ? assessA3(opData).scores.find((s) => s.section === (stepId as A3SectionId))
      : undefined;
    const rung = pickWeakestRung(
      sectionScore
        ? { itemCount: sectionScore.itemCount, coverageRatio: sectionScore.evidenceRatio }
        : undefined,
      'evidence'
    );
    const deepen = buildA3DeepenPrompt(stepId as A3SectionId, rung, false);
    if (deepen) {
      // OXFORD O3: layer the branching question ladder (a3QuestionBank) + the
      // discipline block for the mapped step on top of the legacy deepen prompt,
      // so the AI mentor asks EXACTLY the same laddered questions the wizard shows
      // (single source of truth). Backward compatible: the legacy staircase framing
      // and JSON contract are unchanged; the ladder is additive context.
      const SECTION_TO_STEP: Record<A3SectionId, A3StepId> = {
        problem: 'current-state',
        'root-cause': 'root-cause',
        countermeasures: 'countermeasures',
      };
      const mappedStep = SECTION_TO_STEP[stepId as A3SectionId];
      const ladderBlock = buildA3StepLadderPromptBlock(mappedStep, 'en');
      const disciplineBlock =
        mappedStep === 'root-cause'
          ? 'Symptom vs root: a link with a deeper "why" is a SYMPTOM; a root is terminal, evidenced and classified as process/tools/skills/incentives. Never label a symptom a root.'
          : mappedStep === 'countermeasures'
            ? buildCountermeasureConclusionPromptRules('en')
            : buildA3StaircasePromptRules('en');
      return `Act as an operational-excellence partner running an A3. Propose 3-5 concrete items for the "${stepId}" section, disciplined by the insight staircase (surface → evidence → quantification → risk/capability).

Staircase framing for this section:
${deepen}

Laddered questions for this step (ask these, in order; the answer to one drives the next):
${ladderBlock}

${disciplineBlock}

Rules:
- Every item traces down the staircase: a countermeasure names the root cause it removes; a root cause names the problem gap it explains.
- Prefer measurable items (set target/threshold/durationMinutes where the fact exists); do not invent numbers.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "owner": "...", "target": "...", "threshold": "...", "durationMinutes": 0}]}`;
    }
  }

  if (toolType === 'sop-builder' && SOP_SECTIONS.includes(stepId as SopSectionId)) {
    const opData = inputData as OperationalToolData | undefined;
    const sectionScore = opData
      ? assessSop(opData).scores.find((s) => s.section === (stepId as SopSectionId))
      : undefined;
    const rung = pickWeakestRung(
      sectionScore
        ? { itemCount: sectionScore.itemCount, coverageRatio: sectionScore.measurableRatio }
        : undefined,
      'quantification'
    );
    const deepen = buildSopDeepenPrompt(stepId as SopSectionId, rung, false);
    if (deepen) {
      return `Act as an operational-excellence partner building an SOP. Propose 3-5 concrete items for the "${stepId}" section, disciplined by the insight staircase (surface → evidence → quantification → risk/capability).

Staircase framing for this section:
${deepen}

Rules:
- Standards are pass/fail boundaries with a measurable threshold; checklist items are verifications (pass/fail), not actions.
- Set threshold/target/durationMinutes where a measurable criterion exists; do not invent numbers.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "owner": "...", "target": "...", "threshold": "...", "durationMinutes": 0}]}`;
    }
  }

  if (toolType === 'dms-builder' && DMS_LAYERS.includes(stepId as DmsLayerId)) {
    const deepen = buildDmsDeepenPrompt(stepId as DmsLayerId, 'evidence', false);
    if (deepen) {
      return `Act as an operational-excellence partner building a Daily Management System. Propose 3-5 concrete items for the "${stepId}" control-loop layer, disciplined by the insight staircase (surface → evidence → quantification → risk/capability).

Staircase framing for this section:
${deepen}

Rules:
- Every item ties to the control loop: a KPI must be owned and current (not a laminated poster); an escalation names its trigger threshold and the next tier; a response closes with a verified check.
- Set threshold/target/durationMinutes where a measurable criterion exists; do not invent numbers.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "owner": "...", "target": "...", "threshold": "...", "durationMinutes": 0}]}`;
    }
  }

  if (toolType === 'smed-planner' && SMED_PHASES.includes(stepId as SmedPhaseId)) {
    const deepen = buildSmedDeepenPrompt(stepId as SmedPhaseId, 'evidence', false);
    if (deepen) {
      return `Act as an operational-excellence partner running a SMED changeover reduction. Propose 3-5 concrete items for the "${stepId}" phase, disciplined by the insight staircase (surface → evidence → quantification → risk/capability).

Staircase framing for this section:
${deepen}

Rules:
- Every item is grounded in measured changeover time, not an aspirational estimate; separate/convert/streamline items name the internal or external step they touch.
- Set target/threshold/durationMinutes where the fact exists; do not invent minutes.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "owner": "...", "target": "...", "threshold": "...", "durationMinutes": 0}]}`;
    }
  }

  if (toolType === 'inventory-autopilot' && INVENTORY_LEVERS.includes(stepId as InventoryLeverId)) {
    const deepen = buildInventoryDeepenPrompt(stepId as InventoryLeverId, 'evidence', false);
    if (deepen) {
      return `Act as an operational-excellence partner running Inventory Autopilot. Propose 3-5 concrete items for the "${stepId}" lever, disciplined by the insight staircase (surface → evidence → quantification → risk/capability).

Staircase framing for this section:
${deepen}

Rules:
- Every item ties to a concrete SKU class or service-level lever; do not invent stock, capital, or fill-rate figures.
- Set target/threshold/durationMinutes where the fact exists; do not invent numbers.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "owner": "...", "target": "...", "threshold": "...", "durationMinutes": 0}]}`;
    }
  }

  if (toolType === 'ai-discovery' && AI_PHASES.includes(stepId as AiPhaseId)) {
    const deepen = buildAiDiscoveryDeepenPrompt(stepId as AiPhaseId, 'evidence', false);
    if (deepen) {
      return `Act as an AI transformation partner running AI Discovery. Propose 3-5 concrete items for the "${stepId}" phase, disciplined by the insight staircase (surface → evidence → quantification → risk/capability).

Staircase framing for this section:
${deepen}

Rules:
- Every item names a concrete use case and the evidence for its feasibility or value; do not invent adoption or value figures.
- Set target/threshold/durationMinutes where the fact exists; do not invent numbers.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "owner": "...", "target": "...", "threshold": "...", "durationMinutes": 0}]}`;
    }
  }

  if (toolType === 'pain-explorer' && PAIN_STAGES.includes(stepId as PainStageId)) {
    const deepen = buildPainDeepenPrompt(stepId as PainStageId, 'evidence', false);
    if (deepen) {
      return `Act as an operational-excellence partner running Pain Explorer. Propose 3-5 concrete items for the "${stepId}" stage, disciplined by the insight staircase (surface → evidence → quantification → risk/capability).

Staircase framing for this section:
${deepen}

Rules:
- Every item traces a pain to its measured cost and, once diagnosed, its root cause; do not invent cost figures.
- Set target/threshold/durationMinutes where the fact exists; do not invent numbers.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "owner": "...", "target": "...", "threshold": "...", "durationMinutes": 0}]}`;
    }
  }

  if (toolType === 'rpa-scanner' && RPA_GATES.includes(stepId as RpaGateId)) {
    const deepen = buildRpaDeepenPrompt(stepId as RpaGateId, 'evidence', false);
    if (deepen) {
      return `Act as an automation feasibility partner running RPA Scanner. Propose 3-5 concrete items for the "${stepId}" gate, disciplined by the insight staircase (surface → evidence → quantification → risk/capability).

Staircase framing for this section:
${deepen}

Rules:
- Every item names the process gate it passes (identify/standardize/quantify/feasibility) and the measured volume or ROI behind it; do not invent volume or ROI figures.
- Set target/threshold/durationMinutes where the fact exists; do not invent numbers.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "owner": "...", "target": "...", "threshold": "...", "durationMinutes": 0}]}`;
    }
  }

  if (
    toolType === 'process-automation' &&
    AUTOMATION_PHASES.includes(stepId as AutomationPhaseId)
  ) {
    const deepen = buildProcessAutomationDeepenPrompt(
      stepId as AutomationPhaseId,
      'evidence',
      false
    );
    if (deepen) {
      return `Act as an operational-excellence partner running Process Automation. Propose 3-5 concrete items for the "${stepId}" phase, disciplined by the insight staircase (surface → evidence → quantification → risk/capability).

Staircase framing for this section:
${deepen}

Rules:
- Every item traces from a mapped step to its automation target with a sustain/monitoring owner; do not invent hours or volumes.
- Set target/threshold/durationMinutes where the fact exists; do not invent numbers.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "owner": "...", "target": "...", "threshold": "...", "durationMinutes": 0}]}`;
    }
  }

  if (OPERATIONAL_TOOL_TYPES.includes(toolType)) {
    // The shared OperationalToolData tools: each non-context/summary step is a
    // section. Generate concrete operational items for the current section.
    if (stepId === 'context' || stepId === 'summary') return '';
    const opData = inputData as any;
    const ctx = opData?.context || {};
    const sectionName = humanizeStepId(stepId);
    return `Act as a senior operations consultant. Generate 3-6 concrete, specific items for the "${sectionName}" section of this engagement.

Context:
- Goal: ${ctx.goal || 'not specified'}
- Scope: ${ctx.scope || 'not specified'}
- Success signal: ${ctx.successSignal || 'not specified'}

Each item: clear title, actionable description, impact/effort ratings. Where relevant set category, owner, target, frequency, threshold, or durationMinutes. Ground items in the context; do not invent fake data.

Return JSON. Each item shape (confidence/evidenceType/derivation/rationale/state/requires_evidence are OPTIONAL but REQUIRED whenever the item carries a number or claim not present verbatim in the context — see GROUNDING RULES below):
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "category": "...", "owner": "...", "target": "...", "frequency": "...", "threshold": "...", "durationMinutes": 0, "confidence": 1-5, "evidenceType": "fact|observation|assumption|hypothesis", "derivation": "numerator/denominator behind any number in this item, or omit if none", "rationale": "...", "state": "proposed|confirmed|rejected", "requires_evidence": false}]}`;
  }

  if (toolType === 'market-forces') {
    const porterData = inputData as any;
    if (stepId === 'rivalry') {
      return `Analyze the rivalry force for this market context and provide specific, evidence-based implications for margin and positioning.

Context:
- Industry / market: ${porterData?.context?.industry || 'missing'}
- Geographic scope: ${porterData?.context?.geographicScope || 'missing'}
- Position: ${porterData?.context?.position || 'challenger'}

Return JSON:
{"analysis":{"force":"rivalry","score":3,"trend":"increasing|stable|decreasing","drivers":["..."],"evidence":["..."],"implication":"...","confidence":1-5}}`;
    }
    if (stepId === 'mission') {
      return `Act as an AI strategy mentor. Improve the market brief for this Porter Five Forces session.

Current market context:
- Industry / market: ${porterData?.context?.industry || 'missing'}
- Geographic scope: ${porterData?.context?.geographicScope || 'missing'}
- Position: ${porterData?.context?.position || 'challenger'}

Return JSON:
{"mission": {"industry": "...", "geographicScope": "...", "position": "leader|challenger|follower|niche", "goal": "...", "successSignal": "...", "constraints": "...", "assumptions": "...", "kpiTarget": "..."}}`;
    }
    if (stepId === 'input') {
      return `Act as an AI strategy mentor. Based on the market brief and organization context, propose 4-6 high-value market signals for a Porter Five Forces analysis.

Market:
- Industry / market: ${porterData?.context?.industry || 'missing'}
- Geographic scope: ${porterData?.context?.geographicScope || 'missing'}
- Position: ${porterData?.context?.position || 'challenger'}

Return JSON:
{"signals": [{"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["rivalry|newEntrants|substitutes|buyerPower|supplierPower"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}]}`;
    }
    if (stepId === 'forces') {
      const signalsSummary = (porterData?.signals || [])
        .slice(0, 20)
        .map((signal: any) => `- [${signal.type}] ${signal.content}`)
        .join('\n');
      return `Act as an AI strategy mentor. Turn the following market signals into a Porter Five Forces scorecard.

${signalsSummary || '- no explicit signals provided yet'}

Rules:
- score each force 1-5, where 5 means stronger pressure on the company
- separate drivers from evidence
- make implications concrete for margin, growth, and positioning

Return JSON:
{"forces": {"rivalry": {"score": 3, "trend": "increasing|stable|decreasing", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}, "newEntrants": {"score": 3, "trend": "increasing|stable|decreasing", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}, "substitutes": {"score": 3, "trend": "increasing|stable|decreasing", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}, "buyerPower": {"score": 3, "trend": "increasing|stable|decreasing", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}, "supplierPower": {"score": 3, "trend": "increasing|stable|decreasing", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}}}`;
    }
    return '';
  }

  if (toolType === 'value-chain') {
    const vcData = inputData as any;
    if (stepId === 'mission') {
      return `Act as an AI strategy mentor. Improve the brief for this Value Chain analysis.

Current context:
- Industry: ${vcData?.context?.industry || 'missing'}
- Value chain scope: ${vcData?.context?.valueChainScope || 'missing'}
- Positioning: ${vcData?.context?.position || 'undefined'}

Return JSON:
{"mission": {"industry": "...", "valueChainScope": "...", "position": "cost-leader|differentiator|hybrid|undefined", "goal": "...", "successSignal": "...", "constraints": "...", "assumptions": "...", "kpiTarget": "..."}}`;
    }
    if (stepId === 'input') {
      return `Act as an AI strategy mentor. Based on the brief and organization context, propose 4-6 high-value signals about cost structure, operations, and differentiation for a Value Chain analysis.

Context:
- Industry: ${vcData?.context?.industry || 'missing'}
- Value chain scope: ${vcData?.context?.valueChainScope || 'missing'}
- Positioning: ${vcData?.context?.position || 'undefined'}

Return JSON:
{"signals": [{"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["inboundLogistics|operations|outboundLogistics|marketingSales|service|infrastructure|hrManagement|technology|procurement"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}]}`;
    }
    if (stepId === 'activities') {
      const signalsSummary = (vcData?.signals || [])
        .slice(0, 20)
        .map((signal: any) => `- [${signal.type}] ${signal.content}`)
        .join('\n');
      return `Act as an AI strategy mentor. Score the 9 value-chain activities (5 primary, 4 support) from these signals and the organization context.

${signalsSummary || '- no explicit signals provided yet'}

Rules:
- costContribution = share of total cost the activity drives (high|medium|low)
- valueContribution = contribution to differentiation / willingness-to-pay (high|medium|low)
- marginRole = creator (builds margin) | neutral | drain (erodes margin)
- separate drivers from evidence; make implications concrete for margin and positioning
- also return a positioningVerdict (cost-advantage | differentiation | stuck-in-the-middle) with a one-line summary

${buildValueChainStaircasePromptRules('en')}

Return JSON (each activity carries the full "staircase" and an "evidenceStatus"):
{"activities": {"inboundLogistics": {"costContribution": "high|medium|low", "valueContribution": "high|medium|low", "marginRole": "creator|neutral|drain", "maturity": "strong|adequate|weak", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5, "staircase": {"surface": "...", "costValueProof": "...", "proofRefs": ["signal-id"], "benchmark": "...", "potential": "..."}, "evidenceStatus": "confirmed|declared"}, "operations": {"...": "..."}, "outboundLogistics": {"...": "..."}, "marketingSales": {"...": "..."}, "service": {"...": "..."}, "infrastructure": {"...": "..."}, "hrManagement": {"...": "..."}, "technology": {"...": "..."}, "procurement": {"...": "..."}}, "positioningVerdict": {"positioning": "cost-advantage|differentiation|stuck-in-the-middle", "summary": "..."}}`;
    }
    return '';
  }

  if (toolType === 'capability-mapper') {
    const capData = inputData as any;
    if (stepId === 'mission') {
      return `Act as an AI strategy mentor. Improve the brief for this Capability Mapper analysis.

Current context:
- Industry: ${capData?.context?.industry || 'missing'}
- Capability domains: ${capData?.context?.capabilityDomains || 'missing'}
- Strategic priorities: ${capData?.context?.strategicPriorities || 'missing'}

Return JSON:
{"mission": {"industry": "...", "capabilityDomains": "...", "strategicPriorities": "...", "goal": "...", "successSignal": "...", "constraints": "...", "assumptions": "...", "kpiTarget": "..."}}`;
    }
    if (stepId === 'input') {
      return `Act as an AI strategy mentor. Based on the brief and organization context, propose 4-6 high-value signals about organizational capabilities, skills, processes, and gaps.

Context:
- Industry: ${capData?.context?.industry || 'missing'}
- Capability domains: ${capData?.context?.capabilityDomains || 'missing'}
- Strategic priorities: ${capData?.context?.strategicPriorities || 'missing'}

Return JSON:
{"signals": [{"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["technology|talent|processes|data|partnerships"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}]}`;
    }
    if (stepId === 'capabilities') {
      const signalsSummary = (capData?.signals || [])
        .slice(0, 20)
        .map((signal: any) => `- [${signal.type}] ${signal.content}`)
        .join('\n');
      return `Act as an AI strategy mentor. Turn these signals and the organization context into a scored capability map.

${signalsSummary || '- no explicit signals provided yet'}

Rules:
- score each capability on currentMaturity and targetMaturity (1-5)
- importance = strategic importance (high|medium|low)
- gapSize = critical|moderate|minor (derived from the maturity gap weighted by importance)
- sourcing = build|buy|partner|sustain
- separate drivers from evidence; make implications concrete for the transformation roadmap

Return JSON:
{"capabilities": [{"name": "...", "domain": "...", "currentMaturity": 1-5, "targetMaturity": 1-5, "importance": "high|medium|low", "gapSize": "critical|moderate|minor", "sourcing": "build|buy|partner|sustain", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}]}`;
    }
    return '';
  }

  if (toolType === 'ambition-decomposer') {
    const ambData = inputData as any;
    if (stepId === 'mission') {
      return `Act as an AI strategy mentor. Sharpen the ambition for this Ambition Decomposer session.

Current context:
- Ambition: ${ambData?.context?.ambitionStatement || 'missing'}
- Scope: ${ambData?.context?.scope || 'missing'}

Return JSON:
{"mission": {"ambitionStatement": "...", "scope": "...", "goal": "...", "successSignal": "...", "timeframe": "short|medium|long", "constraints": "...", "assumptions": "...", "kpiTarget": "..."}}`;
    }
    if (stepId === 'input') {
      return `Act as an AI strategy mentor. Based on the ambition and organization context, propose 4-6 high-value signals about what the ambition requires (markets, capabilities, constraints, enablers).

Ambition: ${ambData?.context?.ambitionStatement || 'missing'}
Scope: ${ambData?.context?.scope || 'missing'}

Return JSON:
{"signals": [{"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["market|capability|constraint|enabler"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}]}`;
    }
    if (stepId === 'themes') {
      const signalsSummary = (ambData?.signals || [])
        .slice(0, 20)
        .map((signal: any) => `- [${signal.type}] ${signal.content}`)
        .join('\n');
      return `Act as an AI strategy mentor. Decompose the ambition into 4-7 strategic themes with measurable targets.

Ambition: ${ambData?.context?.ambitionStatement || 'missing'}
${signalsSummary || '- no explicit signals provided yet'}

Rules:
- each theme = a coherent strand of work toward the ambition
- targetMetric = what to measure; targetValue = the goal value
- horizon = short|medium|long; importance = high|medium|low
- separate drivers from evidence; make implications concrete

Return JSON:
{"themes": [{"title": "...", "description": "...", "targetMetric": "...", "targetValue": "...", "horizon": "short|medium|long", "importance": "high|medium|low", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}]}`;
    }
    return '';
  }

  if (toolType === 'focus-tradeoff') {
    const focData = inputData as any;
    if (stepId === 'mission') {
      return `Act as an AI strategy mentor. Sharpen the focus question for this Focus & Trade-offs session.

Current context:
- Competing priorities: ${focData?.context?.competingPriorities || 'missing'}
- Decision criteria: ${focData?.context?.decisionCriteria || 'missing'}

Return JSON:
{"mission": {"competingPriorities": "...", "decisionCriteria": "...", "goal": "...", "successSignal": "...", "timeframe": "short|medium|long", "constraints": "...", "assumptions": "...", "kpiTarget": "..."}}`;
    }
    if (stepId === 'input') {
      return `Act as an AI strategy mentor. Based on the focus question and organization context, propose 4-6 signals about the competing options and what truly matters for the decision.

Competing priorities: ${focData?.context?.competingPriorities || 'missing'}
Decision criteria: ${focData?.context?.decisionCriteria || 'missing'}

Return JSON:
{"signals": [{"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["value|effort|risk|fit"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}]}`;
    }
    if (stepId === 'priorities') {
      const signalsSummary = (focData?.signals || [])
        .slice(0, 20)
        .map((signal: any) => `- [${signal.type}] ${signal.content}`)
        .join('\n');
      return `Act as an AI strategy mentor. Score the competing priorities for a focus decision.

${signalsSummary || '- no explicit signals provided yet'}

Rules:
- valueScore = strategic value (1-5); effortScore = effort/cost (1-5); strategicFit = fit with strategy (1-5)
- recommendation = pursue|defer|drop (high value + low effort + high fit → pursue)
- separate drivers from evidence; make implications concrete

Return JSON:
{"priorities": [{"title": "...", "description": "...", "valueScore": 1-5, "effortScore": 1-5, "strategicFit": 1-5, "recommendation": "pursue|defer|drop", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}]}`;
    }
    return '';
  }

  if (toolType === 'narrative-engine') {
    const narData = inputData as any;
    if (stepId === 'mission') {
      return `Act as an AI communications strategist. Sharpen the brief for this Narrative Engine session using the SCQA opening (Situation-Complication-Question-Answer) — the governing thought (coreMessage) must answer EXACTLY the question the complication forces.

Current context:
- Audience: ${narData?.context?.audience || 'missing'}
- Core message (Answer): ${narData?.context?.coreMessage || 'missing'}
- Situation: ${narData?.context?.situation || 'missing'}
- Complication: ${narData?.context?.complication || 'missing'}
- Question: ${narData?.context?.question || 'missing'}

Rules:
- situation = the stable fact both sides already agree on (not a claim).
- complication = what breaks that stable picture — must NOT restate the situation.
- question = the ONE question the complication forces.
- coreMessage = the Answer, and it must resolve exactly that question, not an easier one.

Return JSON:
{"mission": {"audience": "...", "coreMessage": "...", "situation": "...", "complication": "...", "question": "...", "goal": "...", "successSignal": "...", "timeframe": "short|medium|long", "constraints": "...", "assumptions": "...", "kpiTarget": "..."}}`;
    }
    if (stepId === 'input') {
      return `Act as an AI communications strategist. Based on the audience, core message, and organization context, propose 4-6 signals: proof points, audience insights, objections to preempt.

Audience: ${narData?.context?.audience || 'missing'}
Core message: ${narData?.context?.coreMessage || 'missing'}

Return JSON:
{"signals": [{"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["proof|audience|objection|emotion"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}]}`;
    }
    if (stepId === 'pillars') {
      const signalsSummary = (narData?.signals || [])
        .slice(0, 20)
        .map((signal: any) => `- [${signal.type}] ${signal.content}`)
        .join('\n');
      return `Act as an AI communications strategist. Build 3-5 narrative pillars that support the core message.

Core message: ${narData?.context?.coreMessage || 'missing'}
${signalsSummary || '- no explicit signals provided yet'}

Rules:
- each pillar = one claim that advances the core message
- proofPoints = concrete evidence backing the claim
- audienceResonance = high|medium|low (how strongly it lands with the audience)
- separate drivers from evidence; make implications concrete

Return JSON:
{"pillars": [{"title": "...", "message": "...", "proofPoints": ["..."], "audienceResonance": "high|medium|low", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}]}`;
    }
    return '';
  }

  if (toolType === 'growth-paths') {
    const growthData = inputData as any;
    if (stepId === 'mission') {
      return `Act as an AI growth strategy mentor. Improve the growth mission brief for this Ansoff session.

Current growth context:
- Growth goal: ${growthData?.context?.goal || 'missing'}
- Scope: ${growthData?.context?.scope || 'missing'}
- Success signal: ${growthData?.context?.successSignal || 'missing'}

Return JSON:
{"mission": {"goal": "...", "scope": "...", "successSignal": "...", "timeframe": "short|medium|long", "constraints": "...", "assumptions": "...", "kpiTarget": "..."}}`;
    }
    if (stepId === 'input') {
      return `Act as an AI growth strategy mentor. Based on the growth mission and organization context, propose 4-6 high-value growth signals.

Mission:
- Growth goal: ${growthData?.context?.goal || 'missing'}
- Scope: ${growthData?.context?.scope || 'missing'}
- Success signal: ${growthData?.context?.successSignal || 'missing'}

Return JSON:
{"signals": [{"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["marketPenetration|marketDevelopment|productDevelopment|diversification"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}]}`;
    }
    if (stepId === 'options') {
      const signalsSummary = (growthData?.signals || [])
        .slice(0, 20)
        .map((signal: any) => `- [${signal.type}] ${signal.content}`)
        .join('\n');
      return `Act as an AI growth strategy mentor. Turn these signals into Ansoff growth options.

${signalsSummary || '- no explicit signals provided yet'}

Rules:
- classify options into marketPenetration, marketDevelopment, productDevelopment, or diversification
- make each option concrete and mutually distinguishable
- include impact, effort, risk, rationale, evidence, confidence, and first step

Return JSON:
{"options": {"marketPenetration": [{"title":"...","description":"...","impact":"high|medium|low","effort":"high|medium|low","riskLevel":"high|medium|low","rationale":"...","evidence":["..."],"confidence":4,"firstStep":"..."}], "marketDevelopment": [], "productDevelopment": [], "diversification": []}}`;
    }
    return '';
  }

  if (toolType === 'portfolio-priority') {
    const portfolioData = inputData as any;
    if (stepId === 'mission') {
      return `Act as an AI portfolio strategy mentor. Improve the mission brief for this Portfolio Priority session.

Current mission context:
- Decision goal: ${portfolioData?.context?.goal || 'missing'}
- Scope: ${portfolioData?.context?.scope || 'missing'}
- Success signal: ${portfolioData?.context?.successSignal || 'missing'}
- Time horizon: ${portfolioData?.context?.timeframe || 'missing'}

Return JSON:
{"mission": {"goal": "...", "scope": "...", "successSignal": "...", "timeframe": "short|medium|long", "constraints": "...", "assumptions": "...", "kpiTarget": "..."}}`;
    }
    if (stepId === 'input') {
      return `Act as an AI portfolio analyst. Suggest high-value evidence signals for portfolio prioritization.

Use organization context, interview cues, resource constraints, performance signals, customer demand, and strategic fit.

Return JSON:
{"signals": [{"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["portfolio"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}]}`;
    }
    if (stepId === 'items') {
      const signalsSummary = (portfolioData?.signals || [])
        .map((signal: any) => `- ${signal.content}`)
        .join('\n');
      return `Act as an AI portfolio mentor. Turn these signals into BCG-style portfolio items.

${signalsSummary || '- no explicit signals provided yet'}

Rules:
- score marketGrowth, marketShare, and investmentLevel from 1 to 5
- include concrete rationale, evidence, confidence, and recommendation
- recommendation must be invest, maintain, test, harvest, or stop

Return JSON:
{"items": [{"title": "...", "description": "...", "marketGrowth": 3, "marketShare": 3, "investmentLevel": 3, "rationale": "...", "evidence": ["..."], "recommendation": "invest|maintain|test|harvest|stop", "confidence": 4}]}`;
    }
    return '';
  }

  if (toolType === 'risk-uncertainty') {
    const riskData = inputData as any;
    if (stepId === 'mission') {
      return `Act as an AI risk strategy mentor. Improve the mission brief for this Risk & Uncertainty session.

Current mission context:
- Decision goal: ${riskData?.context?.goal || 'missing'}
- Scope: ${riskData?.context?.scope || 'missing'}
- Success signal: ${riskData?.context?.successSignal || 'missing'}
- Time horizon: ${riskData?.context?.timeframe || 'missing'}

Return JSON:
{"mission": {"goal": "...", "scope": "...", "successSignal": "...", "timeframe": "short|medium|long", "constraints": "...", "assumptions": "...", "kpiTarget": "..."}}`;
    }
    if (stepId === 'input') {
      return `Act as an AI risk analyst. Suggest high-value evidence signals for strategic risk and uncertainty.

Use organization context, interview cues, market shifts, operational constraints, weak signals, and strategic assumptions.

Return JSON:
{"signals": [{"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["risk"], "evidenceType": "fact|observation|hypothesis", "state": "proposed", "provenance": "..."}]}`;
    }
    if (stepId === 'assumptions') {
      const signalsSummary = (riskData?.signals || [])
        .map((signal: any) => `- ${signal.content}`)
        .join('\n');
      // OXFORD O3: layer the dedicated risk q-bank (riskQuestionBank.ts) on top
      // of the legacy signal→assumptions/risks/scenarios contract, so the AI
      // mentor interviews EACH candidate risk through the same laddered,
      // forced-loop questions the wizard/tests use as single source of truth
      // (mirrors the A3 wiring above: additive context, JSON contract unchanged).
      const ladderBlock = buildRiskLadderPromptBlock('en');
      return `Act as an AI risk mentor. Turn these signals into assumptions, strategic risks, and scenarios.

${signalsSummary || '- no explicit signals provided yet'}

Laddered intake questions — walk this per candidate risk during the interview, one item at a time (the answer to one drives the next; L2 and L3 are FORCED loops that hold until a real, non-generic answer lands):
${ladderBlock}

Rules:
- Never persist a risk's probability/impact from a bare adjective ("high"/"wysokie") — the L2 loop above exists to catch that; ask again for the number.
- A response strategy ("mitigation") must name mitigate/transfer/accept/avoid, not a generic "we'll keep watching" — the L3 loop above exists to catch that.

Return JSON:
{
  "assumptions": [{"text": "...", "confidence": 3, "evidence": ["..."], "consequenceIfWrong": "...", "validationMethod": "..."}],
  "risks": [{"title": "...", "description": "...", "probability": 3, "impact": 3, "mitigation": "...", "trigger": "...", "owner": "...", "evidence": ["..."], "confidence": 4}],
  "scenarios": [{"title": "...", "likelihood": 3, "notes": "...", "posture": "base|upside|downside|stress", "signalsToWatch": ["..."], "response": "..."}]
}`;
    }
    return '';
  }

  const swotData = inputData as SWOTData | undefined;
  if (toolType === 'dynamic-swot') {
    if (stepId === 'mission') {
      return `Act as an AI strategy mentor. Improve the mission brief for this Dynamic SWOT session.

Current mission context:
- Strategic question: ${swotData?.context?.goal || 'missing'}
- Scope: ${swotData?.context?.scope || 'missing'}
- Success signal: ${swotData?.context?.successSignal || 'missing'}
- Time horizon: ${swotData?.context?.timeframe || 'missing'}

Return JSON:
{"mission": {"goal": "...", "scope": "...", "successSignal": "...", "timeframe": "short|medium|long", "constraints": "...", "assumptions": "...", "kpiTarget": "..."}}`;
    }
    if (stepId === 'input') {
      return `You are a partner at a consulting firm (HBS, MBA, 10 years of practice) preparing the evidence base for a Dynamic SWOT. Based on the mission and organization context, propose 4-6 high-value signals for the Input & Exploration phase.

Mission:
- Strategic question: ${swotData?.context?.goal || 'missing'}
- Scope: ${swotData?.context?.scope || 'missing'}
- Success signal: ${swotData?.context?.successSignal || 'missing'}

EVIDENCE DISCIPLINE:
- Each signal is a FACT CANDIDATE — concrete, checkable, tied to a source. "The market is growing" is not a signal; "client X asked for Y in the Q2 tender" is.
- Mark evidenceType honestly: "fact" only for verifiable statements; unverified beliefs are "observation" or "hypothesis".
- Do not invent numbers. If a number would help, propose WHERE to get it as the signal content.
- Respond in the user's language (Polish or English).

Return JSON:
{"signals": [{"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["..."], "evidenceType": "fact|observation|hypothesis", "state": "proposed|needs-evidence", "provenance": "..."}]}`;
    }
    if (stepId === 'swot') {
      return `You are a partner at a consulting firm (HBS, MBA, 10 years of practice). Turn the session evidence below into candidate SWOT items your client's board would accept as findings, not opinions.

${swotData ? buildSwotFactsBlock(swotData) : '- no session facts yet'}

RULES:
- Items derive from the EVIDENCE block only — every item's staircase.factRefs must point at signal ids listed above. An item with no supporting signal gets factRefs=[] and evidenceStatus="declared" (explicitly "declared, unconfirmed").
- Keep items concrete and falsifiable; no phrases that fit any company. Separate internal (S/W) from external (O/T).
- Strengths: classify each — "core-competency" (externally validated + broad + durable), "niche-strength" (validated but segment-bound), "claimed-strength" (no external proof), "table-stakes" (real but every serious competitor has it).
- Weaknesses: umbrella claims ("lack of agility", "poor communication", "culture") MUST include decomposition into process / tools / skills / incentives — each root demands a different move.
- Respond in the user's language (Polish or English).

${buildStaircasePromptRules('en')}

Return JSON:
{"items": [{"text": "...", "impact": "high|medium|low", "quadrant": "strengths|weaknesses|opportunities|threats", "confidence": 1-5, "status": "proposed", "staircase": {"fact": "...", "factRefs": ["signal-id"], "interpretation": "...", "implication": "..."}, "decomposition": [{"dimension": "process|tools|skills|incentives", "finding": "..."}], "evidenceStatus": "confirmed|declared", "classification": "core-competency|niche-strength|claimed-strength|table-stakes"}]}
("decomposition" only for umbrella claims; "classification" only for strengths.)`;
    }
  }

  return '';
}

export function getToolSuggestionPrompt(
  toolType: ToolType,
  stepId: string,
  inputData: unknown,
  level?: ToolDetailLevel
): string {
  const prompt = getToolSuggestionPromptInner(toolType, stepId, inputData);
  if (!prompt) return prompt;
  // K5 — dyrektywa poziomu wstrzykiwana MIĘDZY prompt a reguły grounding.
  // Dla 'medium'/undefined directive='' → wynik identyczny jak dziś.
  const directive = buildDetailLevelDirective(level, detectIsPolish(inputData));
  const levelBlock = directive ? `${directive}\n\n` : '';
  return `${prompt}\n\n${levelBlock}${GROUNDING_RULES_BOTH}`;
}

/**
 * Shared four-beat (CONCLUSION_LAYER_STANDARD variant W2) scaffold for the GENERIC
 * fallback summaries — the branch a strategy tool takes when its grounded
 * conclusion builder returns null (thin session, nothing scored yet). Historically
 * these fallbacks emitted a flat `"summary": "string"` plus a top-level
 * `"insights"` array; the per-tool normalizers (marketForces.ts, valueChain.ts,
 * portfolioPriority.ts, …) read `summary` as an OBJECT and pull `verdict` /
 * `tradeoffs` / `keyInsights` / `appliedConclusions` from it — so the old flat
 * shape silently DROPPED the verdict, trade-offs and insights. This scaffold emits
 * the same object contract the grounded builders use, so the fallback carries the
 * full ustalenie → so-what → dowód → implikacja quartet instead of a topic recap.
 *
 * Content only: no new registry, no new AI client — it just standardizes the
 * instruction prose + the `summary` JSON fragment the normalizers already consume.
 */
function w2FallbackInstructions(opts: {
  verdictHint: string;
  tradeoffHint: string;
  effectHint: string;
  isPolish: boolean;
}): string {
  const { verdictHint, tradeoffHint, effectHint, isPolish } = opts;
  return `W2 STRUCTURE (mandatory — a conclusion, not a recap):
1. "summary.verdict" — answer-first, 1-2 sentences: ${verdictHint}. A thesis, not a topic; lead with the decision, never an average or a list.
2. "summary.verdictRationale"/"summary.executiveSummary" — 3-4 sentences that RESTATE the verdict, then the why, each claim anchored in a named element above (the "dowód").
3. "summary.keyInsights" (3) — each an insight staircase in one line: fact from the session -> what it means for THIS company -> what follows for the decision. No insight that would fit any company.
4. "summary.tradeoffs" (>= 1 at recommendation level) — what we choose AT THE COST of what, and which option we reject and why. ${tradeoffHint} No trade-off = no decision, only a list.
5. "moves" (3-5) — each a DECISION carrying tradeoff {chosen, deferred, cost} + rejectedAlternative {option, reason} + a firstStep (verb + artifact + role), anchored in the named elements.
6. "summary.expectedEffect" — ${effectHint}, behaviorally observable, WITH a time horizon; no numbers absent from the elements above.

QUALITY BARS:
- Numbers exclusively from the elements above; anything unproven flagged "as declared, to be confirmed".
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work in front of the client.
- Every sentence falsifiable: with opposite elements it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.`;
}

/**
 * The `summary` object fragment shared by every generic fallback. Mirrors the
 * shape the grounded builders emit and the per-tool normalizers consume via
 * pickW2SummaryFields + executiveSummary/keyInsights/appliedConclusions.
 */
const W2_FALLBACK_SUMMARY_JSON = `"summary": {
    "verdict": "answer-first, 1-2 sentences: the decision this analysis forces",
    "verdictRationale": {"text": "why — tied to the named elements above", "factRefs": ["element-id"]},
    "executiveSummary": "3-4 sentences, opens by restating the verdict",
    "keyInsights": ["insight 1 — fact -> meaning -> implication", "insight 2", "insight 3"],
    "appliedConclusions": ["what to do first", "what to prioritize", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen": "...", "rejected": "...", "why": "..."}],
    "expectedEffect": {"text": "...", "horizon": "..."}
  }`;

/**
 * Final session-summary prompt for every Discovery tool. Same wrapper pattern
 * as getToolSuggestionPrompt above: branches build the raw prompt, the
 * exported function appends GROUNDING_RULES_BOTH once at the end.
 */
function getToolSummaryPromptInner(toolType: ToolType, inputData: unknown): string {
  const isPolish = detectIsPolish(inputData);

  // SMED Planner and DMS Builder carry a grounded W2 conclusion layer
  // (src/config/smedplanner, src/config/dmsbuilder). Prefer the fact-seeded
  // prompt; fall through to the generic operational summary when the session is
  // too empty to synthesize (builder returns null).
  if (toolType === 'smed-planner') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildSmedConclusionPrompt(toSmedSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'dms-builder') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildDmsConclusionPrompt(toDmsSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'inventory-autopilot') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildInventoryConclusionPrompt(toInventorySession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'ai-discovery') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildAiDiscoveryConclusionPrompt(toDiscoverySession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'pain-explorer') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildPainConclusionPrompt(toPainSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'rpa-scanner') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildRpaConclusionPrompt(toRpaSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }

  // Process Automation carries a grounded W2 conclusion layer
  // (src/config/processautomation). It reads the operational `sections`
  // (automation candidates) plus the quantitative `flow.processAutomation`
  // baseline. Falls through to the generic operational summary when the session
  // has no candidates yet (builder returns null).
  if (toolType === 'process-automation') {
    const op = inputData as
      | (OperationalToolData & { flow?: { processAutomation?: unknown } })
      | undefined;
    const prompt = buildProcessAutomationConclusionPrompt(
      toAutomationSession(op?.sections, (op?.flow?.processAutomation as any) ?? undefined),
      isPolish
    );
    if (prompt) return prompt;
  }

  // A3 / SOP grounded W2 conclusions (CONCLUSION_LAYER variant W2). These MUST
  // run BEFORE the generic OPERATIONAL_TOOL_TYPES summary below — both tool
  // types are in that list, so a later check would be unreachable dead code
  // (which is exactly what happened before OXFORD #102).
  if (toolType === 'a3-problem-solving') {
    const grounded = buildA3ConclusionPrompt(inputData as OperationalToolData, isPolish);
    if (grounded) return grounded;
  }
  if (toolType === 'sop-builder') {
    const grounded = buildSopConclusionPrompt(inputData as OperationalToolData, isPolish);
    if (grounded) return grounded;
  }

  if (OPERATIONAL_TOOL_TYPES.includes(toolType)) {
    const opData = inputData as any;
    const sectionsSummary = Object.entries(opData?.sections || {})
      .map(([key, items]: [string, any]) => {
        const list = Array.isArray(items) ? items : [];
        const titles = list
          .slice(0, 8)
          .map((item: any) => item?.title)
          .filter(Boolean)
          .join('; ');
        return `- ${humanizeStepId(key)} (${list.length} item(s))${titles ? `: ${titles}` : ''}`;
      })
      .join('\n');

    return `Act as an operational-excellence partner closing this engagement. You sign this summary with your own name in front of the client. Write the finishing block per CONCLUSION_LAYER_STANDARD variant W2 from the session work below.

=== SESSION WORK (the only admissible source of facts) ===
${sectionsSummary || '- (no sections populated yet)'}

W2 STRUCTURE (mandatory):
1. "summary.verdict" — answer-first, 1-2 sentences: what this analysis means for the operation's DECISION. A thesis, not a topic.
2. "summary.executiveSummary" — 3-4 sentences: restates the verdict, then the why, anchored in the section items above.
3. "summary.tradeoffs" — >= 1 at recommendation level: what we choose AT THE COST of what. No trade-off = no decision, only a list.
4. "initiatives" (3-5) — each a decision with a rationale that names the trade-off and the rejected variant; description carries the first step (verb + artifact + role).
5. "summary.expectedEffect" — behaviorally observable, WITH a time horizon; no numbers absent from the session items.

QUALITY BARS:
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work.
- Every sentence falsifiable: with opposite items it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return as JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences",
    "executiveSummary": "3-4 sentences, opens by restating the verdict",
    "keyInsights": ["insight 1", "insight 2", "insight 3"],
    "appliedConclusions": ["what to do first", "what to standardize", "what NOT to do", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"...","horizon":"..."}
  },
  "initiatives": [{"title": "...", "description": "...", "type": "operational|strategic|growth|defensive", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "..."}]
}`;
  }

  if (toolType === 'dynamic-swot') {
    const swotData = inputData as SWOTData | undefined;
    const tensionCandidates = swotData
      ? deriveTensionCandidates(
          (swotData.items || []).filter(
            (item) => item.proposalStatus !== 'rejected' && item.proposalStatus !== 'rethinking'
          ),
          2
        )
      : [];
    const candidateLines =
      tensionCandidates.length > 0
        ? tensionCandidates
            .map(
              (c) =>
                `- ${c.type} [${c.linkedItemIds[0]} x ${c.linkedItemIds[1]}] (weight ${c.weight})`
            )
            .join('\n')
        : '- (no accepted item pairs available)';

    return `You are a partner at a consulting firm (HBS, MBA, 10 years of practice). You sign this conclusion with your own name in front of the client's board. Produce the finishing block of this Dynamic SWOT session per CONCLUSION_LAYER_STANDARD variant W2.

=== SESSION FACTS (the ONLY admissible source of facts and numbers) ===
${swotData ? buildSwotFactsBlock(swotData) : '- empty session'}
=== END FACTS ===

TENSION PAIRS COMPUTED FROM ACCEPTED ITEMS (link moves to these, not to invented pairs):
${candidateLines}

W2 STRUCTURE (mandatory):
1. "verdict" — answer-first, 1-2 sentences: what this analysis means for the client's DECISION. A thesis, not a topic.
2. "verdictRationale" — why, referencing concrete session elements via factRefs (ids from the facts block).
3. "tradeoffs" — >= 1 at recommendation level: what we choose AT THE COST of what; which option was rejected and why. No trade-off = no decision, only a list.
4. Moves (3-5) — each is a decision, not a bullet.
5. "expectedEffect" — measurable or behaviorally observable, WITH a time horizon; no amounts absent from the facts.

${buildMoveConclusionPromptRules('en')}

QUALITY BARS:
- Numbers exclusively from the facts block; evidence marked "declared" must be flagged "as declared, to be confirmed".
- Zero filler phrases; every sentence falsifiable — with opposite data it would read differently.
- Applied conclusions: what this means / what to do / what NOT to do / what to validate next.
- Respond in the user's language (Polish or English), active voice, partner tone.
- Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}.
- After generating, run a self-check and return "selfCheck" per point: signature test, formula complete, numbers from facts, falsifiability, causality (factRefs), trade-off present, effect has horizon.

Return as JSON:
{
  "summary": {
    "verdict": "...",
    "verdictRationale": {"text": "...", "factRefs": ["..."]},
    "tradeoffs": [{"chosen": "...", "rejected": "...", "why": "..."}],
    "expectedEffect": {"text": "...", "horizon": "..."},
    "executiveSummary": "3-4 sentences, answer-first",
    "keyInsights": ["insight 1", "insight 2", "insight 3"],
    "appliedConclusions": ["practical implication 1", "practical implication 2"]
  },
  "moves": [{
    "title": "Move name",
    "category": "quick-win|big-bet|defensive-move|capability-build",
    "rationale": "why — anchored in listed element ids",
    "linkedItemIds": ["item-id"],
    "linkedTensionIds": ["tension-id"],
    "tradeoff": {"chosen": "...", "deferred": "...", "cost": "..."},
    "rejectedAlternative": {"option": "...", "reason": "..."},
    "whyFirst": "why this order (impact x effort, prerequisites)",
    "ownerRole": "accountable role",
    "expectedImpact": "high|medium|low",
    "estimatedEffort": "high|medium|low",
    "riskLevel": "high|medium|low",
    "confidence": 4,
    "firstStep": "verb + artifact + role"
  }],
  "initiatives": [{
    "title": "Initiative Name",
    "description": "What it does",
    "type": "strategic|operational|defensive|growth",
    "estimatedImpact": "high|medium|low",
    "estimatedEffort": "high|medium|low",
    "rationale": "Why this matters",
    "linkedItems": ["item-id"]
  }],
  "outputCandidates": [{
    "outputType": "initiative|report|presentation|idea",
    "title": "Output title",
    "description": "What should be created",
    "linkedItemIds": ["item-id"],
    "rationale": "Why this output now",
    "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"
  }],
  "selfCheck": {"signature": "pass|fail", "formulaComplete": "pass|fail", "numbersFromFacts": "pass|fail", "falsifiable": "pass|fail", "causality": "pass|fail", "tradeoffPresent": "pass|fail", "effectHasHorizon": "pass|fail"}
}`;
  }

  if (toolType === 'market-forces') {
    const porterData = inputData as any;
    // Grounded W2 conclusion (CONCLUSION_LAYER_STANDARD): seed the industry-
    // profitability verdict + move rules from the synthesis engine. Falls through
    // to the generic summary below when no force is scored yet (returns null).
    const grounded = buildPorterConclusionPrompt(porterData, detectIsPolish(porterData));
    if (grounded) return grounded;

    const forcesSummary = Object.entries(porterData?.forces || {})
      .map(([, force]: [string, any]) => `- ${force.name}: ${force.score}/5 (${force.trend})`)
      .join('\n');

    return `Act as a strategy partner closing this Porter's Five Forces session. You sign the finishing block with your own name in front of the client's board. Write it per CONCLUSION_LAYER_STANDARD variant W2.

=== SCORED FORCES (the only admissible source of facts and pressure numbers) ===
${forcesSummary || '- no force scored yet'}

${w2FallbackInstructions({
  verdictHint:
    "what this five-forces structure means for the client's MARGIN decision — lead with the force that squeezes margin hardest (where to defend, where to reposition), not an average of the five",
  tradeoffHint:
    'the canonical rejected alternative is "fight every force at once -> spread thin, win none".',
  effectHint: 'the margin / positioning change',
  isPolish,
})}
- Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}.

Return as JSON:
{
  ${W2_FALLBACK_SUMMARY_JSON},
  "moves": [{"title":"...","category":"positioning|pricing|partnership|capability-build|defensive-move","rationale":"why — anchored in the named forces","linkedForceIds":["buyerPower"],"tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"verb + artifact + role"}],
  "initiatives": [{"title": "...", "description": "...", "type": "strategic|defensive|growth", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": ["buyerPower"]}],
  "outputCandidates": [{"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "linkedForceIds": ["buyerPower"], "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
  }

  if (toolType === 'value-chain') {
    const vcData = inputData as any;
    // Grounded W2 conclusion (CONCLUSION_LAYER_STANDARD): seed the margin map +
    // lever candidates + move rules from the margin engine. Falls through to the
    // generic summary below when no activity is scored yet (returns null).
    const grounded = buildValueChainConclusionPrompt(vcData, detectIsPolish(vcData));
    if (grounded) return grounded;

    const activitiesSummary = Object.entries(vcData?.activities || {})
      .map(
        ([, a]: [string, any]) =>
          `- ${a.name}: cost ${a.costContribution}, value ${a.valueContribution}, margin ${a.marginRole}`
      )
      .join('\n');

    const leverCandidates = deriveLeverCandidates(vcData?.activities || {}, 3);
    const candidateLines =
      leverCandidates.length > 0
        ? leverCandidates
            .map(
              (c) =>
                `- [${c.activityId}] pole=${c.pole}, leverScore=${c.leverScore}, suggested=${c.suggestedLeverType} — ${c.rationaleEn}`
            )
            .join('\n')
        : '- (no scored activities to pre-compute lever candidates)';

    return `Act as a strategy partner closing this Value Chain session. You sign the finishing block with your own name in front of the client. Write it per CONCLUSION_LAYER_STANDARD variant W2.

=== SCORED ACTIVITIES (the only admissible source of facts) ===
${activitiesSummary || '- no activity scored yet'}
${vcData?.positioningVerdict ? `Positioning verdict: ${vcData.positioningVerdict.positioning} — ${vcData.positioningVerdict.summary}` : ''}

PRE-COMPUTED LEVER CANDIDATES (high cost x low maturity x value impact — link moves to these):
${candidateLines}

${w2FallbackInstructions({
  verdictHint:
    'where this value chain makes or loses margin — name the activity that is the biggest cost drain or the biggest untapped differentiation lever, and whether the position is cost-advantage, differentiation, or stuck-in-the-middle',
  tradeoffHint:
    'a margin lever is a choice: cutting cost in one activity vs investing to differentiate in another — name what you defer.',
  effectHint: 'the cost or willingness-to-pay change on the named activities',
  isPolish,
})}
- Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}.

${buildValueChainMovePromptRules('en')}

Return as JSON:
{
  ${W2_FALLBACK_SUMMARY_JSON},
  "moves": [{"title":"...","category":"cost-advantage|differentiation|linkage-optimization|capability-build|restructure","rationale":"...","linkedActivityIds":["operations"],"tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
  "initiatives": [{"title": "...", "description": "...", "type": "strategic|operational|defensive|growth", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": ["operations"]}],
  "outputCandidates": [{"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "linkedActivityIds": ["operations"], "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
  }

  if (toolType === 'capability-mapper') {
    const capData = inputData as any;
    // Grounded W2 conclusion (CONCLUSION_LAYER_STANDARD): seed the gap ranking +
    // W2 sourcing sequence from the synthesis engine. Falls through to the generic
    // summary below when no capability has a real gap yet (returns null).
    const grounded = buildCapabilityMapperConclusionPrompt(capData, detectIsPolish(capData));
    if (grounded) return grounded;

    const capsSummary = (capData?.capabilities || [])
      .map(
        (c: any) =>
          `- ${c.name} (${c.domain}): ${c.currentMaturity}→${c.targetMaturity}, importance ${c.importance}, ${c.sourcing || 'tbd'}`
      )
      .join('\n');

    return `Act as a strategy partner closing this Capability Map session. You sign the finishing block with your own name in front of the client. Write it per CONCLUSION_LAYER_STANDARD variant W2.

=== SCORED CAPABILITIES (the only admissible source of facts) ===
${capsSummary || '- no capability scored yet'}

${w2FallbackInstructions({
  verdictHint:
    'which capability gap most blocks the strategy — name the high-importance capability whose maturity is furthest below target, and whether the answer is build, buy, partner or reskill',
  tradeoffHint:
    'build vs buy/partner is the core trade-off: building takes time you may not have; buying costs control — name which you sacrifice.',
  effectHint: 'the maturity or delivery-capacity change on the named capabilities',
  isPolish,
})}
- Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}.

Return as JSON:
{
  ${W2_FALLBACK_SUMMARY_JSON},
  "moves": [{"title":"...","category":"build|buy|partner|reskill|restructure","rationale":"...","linkedCapabilityIds":["..."],"tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
  "initiatives": [{"title": "...", "description": "...", "type": "strategic|operational|defensive|growth", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": ["..."]}],
  "outputCandidates": [{"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "linkedCapabilityIds": ["..."], "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
  }

  if (toolType === 'ambition-decomposer') {
    const ambData = inputData as any;
    // Grounded W2 conclusion (CONCLUSION_LAYER_STANDARD): seed the prerequisite-
    // aware theme sequence + W2 moves from the synthesis engine. Falls through to
    // the generic summary below when there are no themes yet (returns null).
    const grounded = buildAmbitionDecomposerConclusionPrompt(ambData, detectIsPolish(ambData));
    if (grounded) return grounded;

    const themesSummary = (ambData?.themes || [])
      .map(
        (t: any) =>
          `- ${t.title}: ${t.targetMetric} → ${t.targetValue} (${t.horizon}, ${t.importance})`
      )
      .join('\n');

    return `Act as a strategy partner closing this Ambition Decomposition session. You sign the finishing block with your own name in front of the client. Write it per CONCLUSION_LAYER_STANDARD variant W2.

=== AMBITION + THEMES (the only admissible source of facts) ===
Ambition: ${ambData?.context?.ambitionStatement || 'n/a'}
${themesSummary || '- no theme defined yet'}

${w2FallbackInstructions({
  verdictHint:
    'which theme to sequence FIRST and why — name the foundation the rest depend on, not a wish-list of all themes at once',
  tradeoffHint:
    'sequencing is the trade-off: starting one theme first defers another — name what waits and the cost of waiting.',
  effectHint: "the progress toward the ambition's target metric",
  isPolish,
})}
- Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}.

Return as JSON:
{
  ${W2_FALLBACK_SUMMARY_JSON},
  "moves": [{"title":"...","category":"foundation|accelerator|bet|enabler|quick-win","rationale":"...","linkedThemeIds":["..."],"tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
  "initiatives": [{"title": "...", "description": "...", "type": "strategic|operational|defensive|growth", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": ["..."]}],
  "outputCandidates": [{"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "linkedThemeIds": ["..."], "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
  }

  if (toolType === 'focus-tradeoff') {
    const focData = inputData as any;
    // Grounded W2 conclusion (CONCLUSION_LAYER_STANDARD): seed the priority
    // ranking + commit/defer/cut sequence from the synthesis engine
    // (src/config/focustradeoffs). Falls through to the generic summary below
    // when no priority is scored yet (returns null).
    const grounded = buildFocusConclusionPrompt(focData, detectIsPolish(focData));
    if (grounded) return grounded;

    const prioritiesSummary = (focData?.priorities || [])
      .map(
        (p: any) =>
          `- ${p.title}: value ${p.valueScore}, effort ${p.effortScore}, fit ${p.strategicFit} → ${p.recommendation}`
      )
      .join('\n');

    return `Act as a strategy partner closing this Focus & Trade-offs session. You sign the finishing block with your own name in front of the client. Write it per CONCLUSION_LAYER_STANDARD variant W2.

=== SCORED PRIORITIES (the only admissible source of facts) ===
${prioritiesSummary || '- no priority scored yet'}

${w2FallbackInstructions({
  verdictHint:
    'what the organization must commit to and what it must CUT — name the priority that wins the scarce capacity and the one that is explicitly deprioritized',
  tradeoffHint:
    'this tool exists to force the trade-off: committing to one priority cuts or defers another — say which, and the cost of saying no.',
  effectHint: 'the focus / delivery-capacity change from committing to the chosen priorities',
  isPolish,
})}
- Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}.

Return as JSON:
{
  ${W2_FALLBACK_SUMMARY_JSON},
  "moves": [{"title":"...","category":"commit|sequence|cut|rebalance|experiment","rationale":"...","linkedPriorityIds":["..."],"tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
  "initiatives": [{"title": "...", "description": "...", "type": "strategic|operational|defensive|growth", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": ["..."]}],
  "outputCandidates": [{"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "linkedPriorityIds": ["..."], "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
  }

  if (toolType === 'narrative-engine') {
    const narData = inputData as any;
    // Grounded W2 conclusion (CONCLUSION_LAYER_STANDARD): seed the pillar
    // ranking + open/prove/reframe/cut delivery sequence from the synthesis
    // engine (src/config/narrativeengine). Falls through to the generic summary
    // below when no pillar is scored yet (returns null).
    const grounded = buildNarrativeConclusionPrompt(narData, detectIsPolish(narData));
    if (grounded) return grounded;

    const pillarsSummary = (narData?.pillars || [])
      .map(
        (p: any) =>
          `- ${p.title}: ${p.message} (${(p.proofPoints || []).length} proof, ${p.audienceResonance})`
      )
      .join('\n');

    return `Act as a strategy partner closing this Narrative session. You sign the finishing block with your own name in front of the client. Write it per CONCLUSION_LAYER_STANDARD variant W2.

=== CORE MESSAGE + PILLARS (the only admissible source of facts) ===
Core message: ${narData?.context?.coreMessage || 'n/a'}
Audience: ${narData?.context?.audience || 'n/a'}
${pillarsSummary || '- no pillar defined yet'}

${w2FallbackInstructions({
  verdictHint:
    'whether this narrative will land with the named audience and the ONE pillar it must lead with — name the strongest proven pillar and the weakest (thinnest proof) that endangers credibility',
  tradeoffHint:
    'a persuasive arc is a choice: leading with one pillar means another moves later or drops — name what you cut to keep the arc tight.',
  effectHint: 'the audience response / decision the narrative is meant to move',
  isPolish,
})}
- Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}.

Return as JSON:
{
  ${W2_FALLBACK_SUMMARY_JSON},
  "moves": [{"title":"...","category":"open|build|prove|cta|reframe","rationale":"...","linkedPillarIds":["..."],"tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
  "initiatives": [{"title": "...", "description": "...", "type": "strategic|operational|defensive|growth", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": ["..."]}],
  "outputCandidates": [{"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "linkedPillarIds": ["..."], "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
  }

  if (toolType === 'growth-paths') {
    const growthData = inputData as any;
    const optionsSummary = Object.entries(growthData?.quadrants || {})
      .map(
        ([quadrant, items]: [string, any]) =>
          `- ${quadrant}: ${(items || []).map((item: any) => item.title).join('; ') || 'none'}`
      )
      .join('\n');

    return `Act as a growth strategy partner closing this Ansoff Growth Paths session. You sign this summary with your own name in front of the client. Write the finishing block per CONCLUSION_LAYER_STANDARD variant W2.

=== GROWTH OPTIONS BY QUADRANT (the only admissible source of facts) ===
${optionsSummary}

W2 STRUCTURE (mandatory):
1. "summary.verdict" — answer-first, 1-2 sentences: which growth path to bet on FIRST and why. A thesis, not a quadrant recap.
2. "summary.executiveSummary" — 3-4 sentences: restates the verdict, then the why, anchored in the options above.
3. "summary.tradeoffs" — >= 1 at recommendation level: which path we scale AT THE COST of which; the canonical rejected alternative is "pursue every quadrant at once -> diluted resources".
4. "moves" (3-5) — each a growth DECISION (scale-core/enter-market/build-product/diversify/validate-first) with tradeOff (what it costs) and rejectedVariant (what you deliberately do NOT do and why), plus firstStep. If evidence is weak, keep a validate-first move before full scaling.
5. "summary.expectedEffect" — growth outcome, behaviorally observable, WITH a time horizon; no numbers absent from the options.

QUALITY BARS:
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work.
- Every sentence falsifiable: with different options it would read differently.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.
- Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}.

Return JSON:
{
  "summary": {
    "verdict": "answer-first: which growth path first and why",
    "executiveSummary": "3-4 sentences, opens by restating the verdict",
    "keyInsights": ["insight 1", "insight 2", "insight 3"],
    "appliedConclusions": ["what to scale", "what to test", "what to avoid", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"...","horizon":"..."}
  },
  "moves": [{"title":"...","category":"scale-core|enter-market|build-product|diversify|validate-first","rationale":"...","tradeOff":"...","rejectedVariant":"...","linkedOptionIds":[],"linkedQuadrants":["marketPenetration"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
  "initiatives": [{"title": "...", "description": "...", "type": "growth|strategic|operational", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": ["marketPenetration"]}],
  "outputCandidates": [{"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "linkedQuadrants": ["marketPenetration"], "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
  }

  if (toolType === 'portfolio-priority') {
    const portfolio = inputData as any;
    // Grounded W2 conclusion (CONCLUSION_LAYER_STANDARD): seed the 2x2
    // classification + dependency/budget-aware funding sequence from the matrix
    // engine. Falls through to the generic summary below when no accepted item is
    // scored yet (returns null).
    const grounded = buildPortfolioConclusionPrompt(portfolio, detectIsPolish(portfolio));
    if (grounded) return grounded;

    const itemsSummary = (portfolio?.initiatives || [])
      .map(
        (item: any) =>
          `- ${item.title}: ${item.category}, growth ${item.marketGrowth}/5, share ${item.marketShare}/5, investment ${item.investmentLevel}/5`
      )
      .join('\n');

    return `Act as a strategy partner closing this BCG-style Portfolio Prioritization session. You sign the finishing block with your own name in front of the client. Write it per CONCLUSION_LAYER_STANDARD variant W2.

=== SCORED PORTFOLIO ITEMS (growth/share/investment — the only admissible source of facts) ===
${itemsSummary || '- no portfolio item scored yet'}

${w2FallbackInstructions({
  verdictHint:
    'where the money goes and where it stops — name the item(s) to fund (star / question-mark worth a bet) and the one to harvest or stop, not an even spread across the 2x2',
  tradeoffHint:
    'capital is finite: funding a question-mark means starving a cash-cow or killing a dog — name what you defund to fund the bet.',
  effectHint: 'the portfolio return / resource-concentration change',
  isPolish,
})}
- Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}.

Return JSON:
{
  ${W2_FALLBACK_SUMMARY_JSON},
  "moves": [{"title":"...","category":"invest|maintain|test|harvest|stop","rationale":"...","linkedItemIds":[],"tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
  "initiatives": [{"title": "...", "description": "...", "type": "strategic|growth|operational", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": []}],
  "outputCandidates": [{"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "linkedItemIds": [], "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
  }

  if (toolType === 'risk-uncertainty') {
    const risk = inputData as any;
    // Grounded W2 conclusion (CONCLUSION_LAYER_STANDARD): seed the risk exposure
    // ranking + assumption fragility + W2 resilience move sequence from the
    // synthesis engine. Falls through to the generic summary below when no risk
    // or assumption is accepted yet (returns null).
    const grounded = buildRiskConclusionPrompt(risk, detectIsPolish(risk));
    if (grounded) return grounded;

    const riskSummary = (risk?.risks || [])
      .map(
        (item: any) => `- ${item.title || item.description}: P${item.probability}/I${item.impact}`
      )
      .join('\n');

    return `Act as a strategy partner closing this Strategic Risk & Uncertainty session. You sign the finishing block with your own name in front of the client. Write it per CONCLUSION_LAYER_STANDARD variant W2.

=== EXPLICIT RISKS (probability / impact — the only admissible source of facts) ===
${riskSummary || '- no explicit risk scored yet'}

${w2FallbackInstructions({
  verdictHint:
    'which risk most threatens the plan and whether to validate, mitigate or hedge it FIRST — name the top exposure (high P x high I) and the fragile assumption underneath it, not a risk register recap',
  tradeoffHint:
    'resilience costs: mitigating one risk spends budget or speed you could aim elsewhere — name the risk you consciously accept to act on the bigger one.',
  effectHint: 'the exposure reduction (probability or impact) on the named risk',
  isPolish,
})}
- Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}.

Return JSON:
{
  ${W2_FALLBACK_SUMMARY_JSON},
  "moves": [{"title":"...","category":"validate|mitigate|monitor|hedge|escalate","rationale":"...","linkedRiskIds":[],"linkedAssumptionIds":[],"tradeoff":{"chosen":"...","deferred":"...","cost":"..."},"rejectedAlternative":{"option":"...","reason":"..."},"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","confidence":4,"firstStep":"..."}],
  "initiatives": [{"title": "...", "description": "...", "type": "strategic|operational", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": []}],
  "outputCandidates": [{"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "linkedRiskIds": [], "linkedScenarioIds": [], "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
  }

  return '';
}

export function getToolSummaryPrompt(
  toolType: ToolType,
  inputData: unknown,
  level?: ToolDetailLevel
): string {
  const prompt = getToolSummaryPromptInner(toolType, inputData);
  if (!prompt) return prompt;
  // K5 — dyrektywa poziomu; 'medium'/undefined → wynik identyczny jak dziś.
  const directive = buildDetailLevelDirective(level, detectIsPolish(inputData));
  const levelBlock = directive ? `${directive}\n\n` : '';
  return `${prompt}\n\n${levelBlock}${GROUNDING_RULES_BOTH}`;
}
