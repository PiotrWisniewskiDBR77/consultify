import { CONSULTING_TOOL_STANDARD_OUTPUTS } from '@/config/consultingToolsStandard';
import {
  A3_SECTIONS,
  buildA3ConclusionPrompt,
  buildA3DeepenPrompt,
  type A3SectionId,
} from '@/config/a3problemsolving';
import { buildDmsConclusionPrompt, toDmsSession } from '@/config/dmsbuilder';
import {
  buildProcessAutomationConclusionPrompt,
  toAutomationSession,
} from '@/config/processautomation';
import { buildInventoryConclusionPrompt, toInventorySession } from '@/config/inventoryautopilot';
import { buildAiDiscoveryConclusionPrompt, toDiscoverySession } from '@/config/aidiscovery';
import { buildSmedConclusionPrompt, toSmedSession } from '@/config/smedplanner';
import { buildPainConclusionPrompt, toPainSession } from '@/config/painexplorer';
import { buildRpaConclusionPrompt, toRpaSession } from '@/config/rpascanner';
// 11 nowych silników operacyjnych (07-08)
import { buildVsmConclusionPrompt, toVsmSession } from '@/config/vsmbuilder';
import { buildConstraintConclusionPrompt, toConstraintSession } from '@/config/constraintcontrol';
import { buildControlTowerConclusionPrompt, toControlTowerSession } from '@/config/controltower';
import { buildAutomationPipelineConclusionPrompt, toAutomationPipelineSession } from '@/config/automationpipeline';
import { buildRoboticsConclusionPrompt, toRoboticsSession } from '@/config/roboticsfeasibility';
import {
  buildLogisticsConclusionPrompt,
  buildLogisticsDeepenPrompt,
  logisticsZoneLabel,
  toLogisticsSession,
  LOGISTICS_ZONES,
  LOGISTICS_PROPOSAL_BANK,
  type LogisticsZoneId,
} from '@/config/logisticsautomation';
import { buildIntegrationConclusionPrompt, toIntegrationSession } from '@/config/integrationdiagnostic';
import {
  buildDataInventoryConclusionPrompt,
  buildDataInventoryStepSuggestionPrompt,
  toDataInventorySession,
} from '@/config/datainventory';
import { buildDecisionConclusionPrompt, toDecisionSession } from '@/config/decisionengine';
import { buildValuePoolConclusionPrompt, toValuePoolSession } from '@/config/digitalvaluepool';
import { buildLegacyConclusionPrompt, toLegacySession } from '@/config/legacyanalyzer';
import {
  SOP_SECTIONS,
  buildSopConclusionPrompt,
  buildSopDeepenPrompt,
  type SopSectionId,
} from '@/config/sopbuilder';
import { buildStaircasePromptRules } from '@/config/swot/swotInsightStaircase';
import { buildValueChainStaircasePromptRules } from '@/config/valuechain/valueChainInsightStaircase';
import { buildPorterConclusionPrompt } from '@/config/porter/conclusionPrompts';
import { buildValueChainConclusionPrompt } from '@/config/valuechain/conclusionPrompts';
import { buildPortfolioConclusionPrompt } from '@/config/portfolio/conclusionPrompts';
import { buildCapabilityMapperConclusionPrompt } from '@/config/capabilitymapper/conclusionPrompts';
import { buildAmbitionDecomposerConclusionPrompt } from '@/config/ambitiondecomposer/conclusionPrompts';
import { buildFocusConclusionPrompt } from '@/config/focustradeoffs';
import { buildNarrativeConclusionPrompt } from '@/config/narrativeengine';
import { buildRiskConclusionPrompt } from '@/config/riskuncertainty';
import {
  buildValueChainMovePromptRules,
  deriveLeverCandidates,
} from '@/config/valuechain/valueChainMarginEngine';
import {
  buildMoveConclusionPromptRules,
  deriveTensionCandidates,
} from '@/config/swot/swotTensionEngine';
import { buildSwotFactsBlock } from '@/hooks/discovery/toolAi/dynamicSwot';
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
  stepId
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

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
 * Logistics Automation section-suggestion prompts, seeded with the per-zone
 * deepening ladder (buildLogisticsDeepenPrompt) and the process-first proposal
 * bank (LOGISTICS_PROPOSAL_BANK). This is what makes the ladder and the proposal
 * bank LIVE in runtime rather than dead config: the `zones` step is disciplined by
 * the quantification rung, the `moves` step by the risk/capability rung plus the
 * process-before-technology proposal bank. Returns null for steps it does not own.
 */
function buildLogisticsSectionPrompt(stepId: string, inputData: unknown): string | null {
  const isPolish = detectIsPolish(inputData);
  const L = (pl: string, en: string) => (isPolish ? pl : en);
  const zoneLabel = (z: LogisticsZoneId) => L(logisticsZoneLabel(z).pl, logisticsZoneLabel(z).en);

  if (stepId === 'zones') {
    const ladder = LOGISTICS_ZONES.map((z) => {
      const framing = buildLogisticsDeepenPrompt(z, 'quantification', isPolish);
      return `- ${zoneLabel(z)} — ${framing ?? ''}`;
    }).join('\n');
    return `${L(
      'Działaj jako partner ds. operacji magazynowych. Zaproponuj 5 wierszy stref (po jednym na strefę przepływu: przyjęcie, składowanie, kompletacja, pakowanie, wysyłka), zdyscyplinowanych drabiną pogłębiającą (powierzchnia → dowód → kwantyfikacja → ryzyko/zdolności).',
      'Act as a warehouse-operations partner. Propose 5 zone rows (one per flow zone: receiving, storage, picking, packing, shipping), disciplined by the deepening ladder (surface → evidence → quantification → risk/capability).'
    )}

${L(
      'Rama kwantyfikacji per strefa (kwota nieprodukcyjnego ruchu = FTE × koszt pracy × % nieprodukcyjny decyduje o priorytecie, nie „głośność” obszaru):',
      'Quantification framing per zone (the non-productive-motion amount = FTE × labour cost × non-productive % drives priority, not the zone\'s "loudness"):'
    )}
${ladder}

${L('Zasady:', 'Rules:')}
- ${L(
      'Każda strefa niesie FTE, % czasu nieprodukcyjnego oraz (dla składowania/kompletacji) dokładność zapasu — nie zmyślaj liczb; gdy brak, oznacz jako do zmierzenia (gemba).',
      'Each zone carries FTE, non-productive time %, and (for storage/picking) inventory accuracy — do not invent numbers; where missing, mark as to-measure (gemba).'
    )}
- ${L(
      'Kompletacja zwykle skupia najwięcej FTE, więc zwykle daje największą pojedynczą kwotę nieprodukcyjnego ruchu.',
      'Picking usually concentrates the most FTE, so it usually yields the largest single non-productive-motion amount.'
    )}

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "category": "receiving|storage|picking|packing|shipping", "zone": "receiving|storage|picking|packing|shipping"}]}`;
  }

  if (stepId === 'moves') {
    const bank = LOGISTICS_ZONES.map((z) => {
      const proposals = LOGISTICS_PROPOSAL_BANK[z];
      const lines = proposals
        .map((p) => `    · [${p.rung}] ${L(p.title.pl, p.title.en)} — ${L(p.explanation.pl, p.explanation.en)}`)
        .join('\n');
      const risk = buildLogisticsDeepenPrompt(z, 'risk-capability', isPolish);
      return `- ${zoneLabel(z)} — ${risk ?? ''}\n${lines}`;
    }).join('\n');
    return `${L(
      'Działaj jako partner ds. automatyzacji logistyki. Zaproponuj 4-6 ruchów-kandydatów (procesowych i technologicznych), zdyscyplinowanych regułą PROCES PRZED TECHNOLOGIĄ.',
      'Act as a logistics-automation partner. Propose 4-6 candidate moves (process and technology), disciplined by the PROCESS-BEFORE-TECHNOLOGY rule.'
    )}

${L(
      'Bank propozycji per strefa (propozycja proces-najpierw, 0 CAPEX, poprzedza każdy ruch sprzętowy) + rama ryzyka/zdolności:',
      'Proposal bank per zone (a process-first, 0-CAPEX proposal precedes any hardware move) + risk/capability framing:'
    )}
${bank}

${L('Zasady:', 'Rules:')}
- ${L(
      'Każdy ruch sprzętowy MUSI być poprzedzony ruchem procesowym (0 CAPEX) w tej samej strefie — ustaw processFirst=true dla ruchów procesowych.',
      'Every hardware move MUST be preceded by a process move (0 CAPEX) in the same zone — set processFirst=true for process moves.'
    )}
- ${L(
      'Dokładność zapasu <95% blokuje automatyzację składowania — najpierw dane, dopiero potem sprzęt.',
      'Inventory accuracy <95% blocks storage automation — data first, hardware only after.'
    )}
- ${L(
      'Nie automatyzuj strefy z nadmiarową zdolnością (nie-ograniczenia) — to iluzoryczny zysk; najpierw zlokalizuj prawdziwe wąskie gardło.',
      'Do not automate a spare-capacity (non-constraint) zone — an illusory gain; locate the true bottleneck first.'
    )}

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "category": "receiving|storage|picking|packing|shipping", "zone": "receiving|storage|picking|packing|shipping", "processFirst": true}]}`;
  }

  return null;
}

export function getToolSuggestionPrompt(
  toolType: ToolType,
  stepId: string,
  inputData: unknown
): string {
  if (OPERATIONAL_TOOL_TYPES.includes(toolType)) {
    // The shared OperationalToolData tools: each non-context/summary step is a
    // section. Generate concrete operational items for the current section.
    if (stepId === 'context' || stepId === 'summary') return '';

    // Logistics Automation seeds its section suggestions with the deepening ladder
    // + process-first proposal bank (making both live in runtime); fall through to
    // the generic operational prompt for steps it does not own.
    if (toolType === 'logistics-automation') {
      const logisticsPrompt = buildLogisticsSectionPrompt(stepId, inputData);
      if (logisticsPrompt) return logisticsPrompt;
    }

    // Data Inventory seeds its capture-step suggestions with the deepening ladder
    // + governance proposal bank (making both live in runtime); falls through to
    // the generic operational prompt for steps it does not own (context/summary).
    if (toolType === 'data-inventory') {
      const dataInventoryPrompt = buildDataInventoryStepSuggestionPrompt(
        stepId,
        detectIsPolish(inputData)
      );
      if (dataInventoryPrompt) return dataInventoryPrompt;
    }

    const opData = inputData as any;
    const ctx = opData?.context || {};
    const sectionName = humanizeStepId(stepId);
    return `Act as a senior operations consultant. Generate 3-6 concrete, specific items for the "${sectionName}" section of this engagement.

Context:
- Goal: ${ctx.goal || 'not specified'}
- Scope: ${ctx.scope || 'not specified'}
- Success signal: ${ctx.successSignal || 'not specified'}

Each item: clear title, actionable description, impact/effort ratings. Where relevant set category, owner, target, frequency, threshold, or durationMinutes. Ground items in the context; do not invent fake data.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "category": "...", "owner": "...", "target": "...", "frequency": "...", "threshold": "...", "durationMinutes": 0}]}`;
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
      return `Act as an AI communications strategist. Sharpen the brief for this Narrative Engine session.

Current context:
- Audience: ${narData?.context?.audience || 'missing'}
- Core message: ${narData?.context?.coreMessage || 'missing'}

Return JSON:
{"mission": {"audience": "...", "coreMessage": "...", "goal": "...", "successSignal": "...", "timeframe": "short|medium|long", "constraints": "...", "assumptions": "...", "kpiTarget": "..."}}`;
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
      return `Act as an AI risk mentor. Turn these signals into assumptions, strategic risks, and scenarios.

${signalsSummary || '- no explicit signals provided yet'}

Return JSON:
{
  "assumptions": [{"text": "...", "confidence": 3, "evidence": ["..."], "consequenceIfWrong": "...", "validationMethod": "..."}],
  "risks": [{"title": "...", "description": "...", "probability": 3, "impact": 3, "mitigation": "...", "trigger": "...", "owner": "...", "evidence": ["..."], "confidence": 4}],
  "scenarios": [{"title": "...", "likelihood": 3, "notes": "...", "posture": "base|upside|downside|stress", "signalsToWatch": ["..."], "response": "..."}]
}`;
    }
    return '';
  }

  // Grounded deepening overrides for A3 / SOP analytical sections (backward-compatible:
  // falls through to the generic operational prompt above when no override applies).
  if (toolType === 'a3-problem-solving' && A3_SECTIONS.includes(stepId as A3SectionId)) {
    const deepen = buildA3DeepenPrompt(stepId as A3SectionId, 'evidence', false);
    if (deepen) {
      return `Act as an operational-excellence partner running an A3. Propose 3-5 concrete items for the "${stepId}" section, disciplined by the insight staircase (surface → evidence → quantification → risk/capability).

Staircase framing for this section:
${deepen}

Rules:
- Every item traces down the staircase: a countermeasure names the root cause it removes; a root cause names the problem gap it explains.
- Prefer measurable items (set target/threshold/durationMinutes where the fact exists); do not invent numbers.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "owner": "...", "target": "...", "threshold": "...", "durationMinutes": 0}]}`;
    }
  }

  if (toolType === 'sop-builder' && SOP_SECTIONS.includes(stepId as SopSectionId)) {
    const deepen = buildSopDeepenPrompt(stepId as SopSectionId, 'quantification', false);
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

export function getToolSummaryPrompt(toolType: ToolType, inputData: unknown): string {
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
    const op = inputData as (OperationalToolData & { flow?: { processAutomation?: unknown } }) | undefined;
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

  // 11 nowych silników operacyjnych (07-08) — grounded W2 conclusion. MUSZĄ być
  // przed generic OPERATIONAL_TOOL_TYPES poniżej (te typy są w tej liście, więc
  // późniejszy check byłby dead code — lekcja OXFORD #102).
  if (toolType === 'vsm-builder') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildVsmConclusionPrompt(toVsmSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'constraint-control') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildConstraintConclusionPrompt(toConstraintSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'control-tower') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildControlTowerConclusionPrompt(toControlTowerSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'automation-pipeline') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildAutomationPipelineConclusionPrompt(toAutomationPipelineSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'robotics-feasibility') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildRoboticsConclusionPrompt(toRoboticsSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'logistics-automation') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildLogisticsConclusionPrompt(toLogisticsSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'integration-diagnostic') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildIntegrationConclusionPrompt(toIntegrationSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'data-inventory') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildDataInventoryConclusionPrompt(toDataInventorySession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'decision-engine') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildDecisionConclusionPrompt(toDecisionSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'digital-value-pool') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildValuePoolConclusionPrompt(toValuePoolSession(op?.sections), isPolish);
    if (prompt) return prompt;
  }
  if (toolType === 'legacy-analyzer') {
    const op = inputData as OperationalToolData | undefined;
    const prompt = buildLegacyConclusionPrompt(toLegacySession(op?.sections), isPolish);
    if (prompt) return prompt;
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
            (item) =>
              item.proposalStatus !== 'rejected' && item.proposalStatus !== 'rethinking'
          ),
          2
        )
      : [];
    const candidateLines =
      tensionCandidates.length > 0
        ? tensionCandidates
            .map((c) => `- ${c.type} [${c.linkedItemIds[0]} x ${c.linkedItemIds[1]}] (weight ${c.weight})`)
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

    return `Based on this Porter's Five Forces analysis, create a consulting-grade final summary:

${forcesSummary}

Provide:
1. Executive Summary (3-4 sentences)
2. Top 3 Strategic Implications
3. Applied Conclusions: where to defend margin, where to reposition, what to validate next
4. 3-5 Recommended Strategic Moves
5. Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}

Return as JSON:
{
  "summary": "executive summary",
  "insights": ["insight 1", "insight 2"],
  "appliedConclusions": ["..."],
  "moves": [{"title":"...","category":"positioning|pricing|partnership|capability-build|defensive-move","rationale":"...","linkedForceIds":["buyerPower"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
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

    return `Based on this Value Chain analysis, create a consulting-grade final summary:

${activitiesSummary}
${vcData?.positioningVerdict ? `Positioning verdict: ${vcData.positioningVerdict.positioning} — ${vcData.positioningVerdict.summary}` : ''}

PRE-COMPUTED LEVER CANDIDATES (high cost x low maturity x value impact — link moves to these):
${candidateLines}

Provide:
1. Executive Summary (3-4 sentences)
2. Top 3 Margin Levers (where cost can fall or value can rise) — anchored in the candidate activities above
3. Applied Conclusions: where to cut cost, where to invest for differentiation, what to validate next
4. 3-5 Recommended Strategic Moves, each a decision (improve/automate/outsource/integrate) with a trade-off
5. Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}

${buildValueChainMovePromptRules('en')}

Return as JSON:
{
  "summary": "executive summary",
  "insights": ["insight 1", "insight 2"],
  "appliedConclusions": ["..."],
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

    return `Based on this Capability Map, create a consulting-grade final summary:

${capsSummary}

Provide:
1. Executive Summary (3-4 sentences)
2. Top 3 Capability Gaps (where maturity is furthest below target on high-importance capabilities)
3. Applied Conclusions: what to build, what to buy/partner, what to reskill, what to validate next
4. 3-5 Recommended Strategic Moves
5. Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}

Return as JSON:
{
  "summary": "executive summary",
  "insights": ["insight 1", "insight 2"],
  "appliedConclusions": ["..."],
  "moves": [{"title":"...","category":"build|buy|partner|reskill|restructure","rationale":"...","linkedCapabilityIds":["..."],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
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
      .map((t: any) => `- ${t.title}: ${t.targetMetric} → ${t.targetValue} (${t.horizon}, ${t.importance})`)
      .join('\n');

    return `Based on this Ambition Decomposition, create a consulting-grade final summary:

Ambition: ${ambData?.context?.ambitionStatement || 'n/a'}
${themesSummary}

Provide:
1. Executive Summary (3-4 sentences)
2. Top 3 Priorities (which themes to sequence first and why)
3. Applied Conclusions: where to start, what to enable, what to validate next
4. 3-5 Recommended Strategic Moves
5. Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}

Return as JSON:
{
  "summary": "executive summary",
  "insights": ["insight 1", "insight 2"],
  "appliedConclusions": ["..."],
  "moves": [{"title":"...","category":"foundation|accelerator|bet|enabler|quick-win","rationale":"...","linkedThemeIds":["..."],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
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
      .map((p: any) => `- ${p.title}: value ${p.valueScore}, effort ${p.effortScore}, fit ${p.strategicFit} → ${p.recommendation}`)
      .join('\n');

    return `Based on this Focus & Trade-offs analysis, create a consulting-grade final summary:

${prioritiesSummary}

Provide:
1. Executive Summary (3-4 sentences)
2. Top 3 Trade-offs (the hardest tensions between competing priorities)
3. Applied Conclusions: what to commit to, what to sequence later, what to cut, what to validate next
4. 3-5 Recommended Strategic Moves
5. Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}

Return as JSON:
{
  "summary": "executive summary",
  "insights": ["insight 1", "insight 2"],
  "appliedConclusions": ["..."],
  "moves": [{"title":"...","category":"commit|sequence|cut|rebalance|experiment","rationale":"...","linkedPriorityIds":["..."],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
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
      .map((p: any) => `- ${p.title}: ${p.message} (${(p.proofPoints || []).length} proof, ${p.audienceResonance})`)
      .join('\n');

    return `Based on this Narrative, create a consulting-grade final summary:

Core message: ${narData?.context?.coreMessage || 'n/a'}
Audience: ${narData?.context?.audience || 'n/a'}
${pillarsSummary}

Provide:
1. Executive Summary (3-4 sentences)
2. Top 3 Storyline Threads (how the pillars connect into a persuasive arc)
3. Applied Conclusions: how to open, what to prove, what call-to-action, what to validate next
4. 3-5 Recommended Delivery Moves
5. Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}

Return as JSON:
{
  "summary": "executive summary",
  "insights": ["insight 1", "insight 2"],
  "appliedConclusions": ["..."],
  "moves": [{"title":"...","category":"open|build|prove|cta|reframe","rationale":"...","linkedPillarIds":["..."],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
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

    return `Summarize portfolio priorities in a consulting-grade way:

${itemsSummary || '- no portfolio items yet'}

1. Executive Summary
2. Top 3 insights
3. Applied Conclusions
4. 3-5 resource allocation moves
5. Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}

Return JSON:
{
  "summary": "executive summary",
  "insights": ["..."],
  "appliedConclusions": ["..."],
  "moves": [{"title":"...","category":"invest|maintain|test|harvest|stop","rationale":"...","linkedItemIds":[],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
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

    return `Summarize risks and scenarios in a consulting-grade way:

${riskSummary || '- no explicit risks yet'}

1. Executive Summary
2. Top 3 insights
3. Applied Conclusions
4. 3-5 resilience moves
5. Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}

Return JSON:
{
  "summary": "executive summary",
  "insights": ["..."],
  "appliedConclusions": ["..."],
  "moves": [{"title":"...","category":"validate|mitigate|monitor|hedge|escalate","rationale":"...","linkedRiskIds":[],"linkedAssumptionIds":[],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","confidence":4,"firstStep":"..."}],
  "initiatives": [{"title": "...", "description": "...", "type": "strategic|operational", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": []}],
  "outputCandidates": [{"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "linkedRiskIds": [], "linkedScenarioIds": [], "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
  }

  return '';
}
