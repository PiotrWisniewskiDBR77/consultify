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
import {
  buildRoboticsConclusionPrompt,
  buildRoboticsDeepenPrompt,
  toRoboticsSession,
  ROBOTICS_AXES,
} from '@/config/roboticsfeasibility';
import {
  buildLogisticsConclusionPrompt,
  buildLogisticsDeepenPrompt,
  logisticsZoneLabel,
  toLogisticsSession,
  LOGISTICS_ZONES,
  LOGISTICS_PROPOSAL_BANK,
  type LogisticsZoneId,
} from '@/config/logisticsautomation';
import {
  buildIntegrationConclusionPrompt,
  buildIntegrationDeepenPrompt,
  toIntegrationSession,
  integrationLeverLabel,
  INTEGRATION_LEVERS,
  INTEGRATION_PROPOSAL_BANK,
  type IntegrationLeverId,
} from '@/config/integrationdiagnostic';
import {
  buildDataInventoryConclusionPrompt,
  buildDataInventoryStepSuggestionPrompt,
  toDataInventorySession,
} from '@/config/datainventory';
import {
  buildDecisionConclusionPrompt,
  buildDecisionDeepenPrompt,
  DECISION_PROPOSAL_BANK,
  decisionElementLabel,
  toDecisionSession,
  type DecisionElementId,
} from '@/config/decisionengine';
import {
  buildValuePoolConclusionPrompt,
  buildValuePoolDeepenPrompt,
  toValuePoolSession,
  VALUE_POOL_PROPOSAL_BANK,
  type ValuePoolPhaseId,
} from '@/config/digitalvaluepool';
import {
  buildLegacyConclusionPrompt,
  buildLegacyStepSuggestionPrompt,
  toLegacyMeta,
  toLegacySession,
} from '@/config/legacyanalyzer';
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

/**
 * Integration Diagnostic section suggestions — the runtime consumer of the
 * integration deepening ladder (buildIntegrationDeepenPrompt) and the per-lever
 * proposal bank (INTEGRATION_PROPOSAL_BANK). Mirrors buildLogisticsSectionPrompt:
 * each analytical section is disciplined by the doctrine's four-lever depth
 * staircase (inventory -> topology -> bridges -> API-led). The wizard steps map to
 * levers: systems->inventory, integrations->topology, bridges->bridges, and the
 * cross-lever `moves` step seeds candidate moves from the whole proposal bank.
 */
function buildIntegrationSectionPrompt(stepId: string, inputData: unknown): string | null {
  const isPolish = detectIsPolish(inputData);
  const L = (pl: string, en: string) => (isPolish ? pl : en);
  const leverLabel = (l: IntegrationLeverId) =>
    L(integrationLeverLabel(l).pl, integrationLeverLabel(l).en);

  const STEP_LEVER: Record<string, IntegrationLeverId> = {
    systems: 'inventory',
    integrations: 'topology',
    bridges: 'bridges',
  };

  const lever = STEP_LEVER[stepId];
  if (lever) {
    // Quantification-rung framing for the analytical data-collection steps.
    const framing = buildIntegrationDeepenPrompt(lever, 'quantification', isPolish);
    const proposals = INTEGRATION_PROPOSAL_BANK[lever]
      .map((p) => `- [${p.rung}] ${L(p.title.pl, p.title.en)} — ${L(p.explanation.pl, p.explanation.en)}`)
      .join('\n');
    return `${L(
      'Działaj jako partner ds. architektury integracji (dojrzałość Gartner, API-led MuleSoft, topologia point-to-point vs hub, koszt danych 1-10-100). Zaproponuj 4-6 pozycji dla tej sekcji, zdyscyplinowanych drabiną pogłębiającą (powierzchnia → dowód → kwantyfikacja → ryzyko/zdolności).',
      'Act as an integration-architecture partner (Gartner maturity, MuleSoft API-led, point-to-point vs hub topology, 1-10-100 data cost). Propose 4-6 items for this section, disciplined by the deepening ladder (surface → evidence → quantification → risk/capability).'
    )}

${L('Dźwignia', 'Lever')}: ${leverLabel(lever)}
${L('Rama kwantyfikacji', 'Quantification framing')}: ${framing ?? ''}

${L('Bank propozycji (użyj jako punktu wyjścia, nie kopiuj dosłownie):', 'Proposal bank (use as a starting point, do not copy verbatim):')}
${proposals}

${L('Zasady:', 'Rules:')}
- ${L(
      'Ręczne przepisywanie danych = brakująca integracja (dowód, nie hipoteza); nie zmyślaj liczb — gdy brak, oznacz jako do zmierzenia.',
      'Manual re-keying = a missing integration (proof, not hypothesis); do not invent numbers — where missing, mark as to-measure.'
    )}
- ${L(
      'Nie stawiaj celu „zintegruj wszystko": które 10-15% integracji odblokowuje 80% wartości.',
      'Do not set "integrate everything" as the goal: which 10-15% of integrations unlocks 80% of the value.'
    )}

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "category": "${lever}"}]}`;
  }

  if (stepId === 'moves') {
    const bank = INTEGRATION_LEVERS.map((l) => {
      const proposals = INTEGRATION_PROPOSAL_BANK[l]
        .map((p) => `    · [${p.rung}] ${L(p.title.pl, p.title.en)} — ${L(p.explanation.pl, p.explanation.en)}`)
        .join('\n');
      const risk = buildIntegrationDeepenPrompt(l, 'risk-capability', isPolish);
      return `- ${leverLabel(l)} — ${risk ?? ''}\n${proposals}`;
    }).join('\n');
    return `${L(
      'Działaj jako partner ds. architektury integracji. Zaproponuj 4-6 ruchów-kandydatów per dźwignia (inwentarz / topologia / mostki / API-led), każdy z impaktem, wysiłkiem i dowodem — zasilają sekwencję W2 System→Process→Experience.',
      'Act as an integration-architecture partner. Propose 4-6 candidate moves per lever (inventory / topology / bridges / API-led), each with impact, effort and evidence — they feed the W2 System→Process→Experience sequence.'
    )}

${L('Bank propozycji per dźwignia + rama ryzyka/zdolności:', 'Proposal bank per lever + risk/capability framing:')}
${bank}

${L('Zasady:', 'Rules:')}
- ${L(
      'Trzymaj porządek zależności: inwentarz → topologia/hub (SPOF) → automatyzacja mostków (quick win) → warstwa API-first. Nie kupuj platformy przed inwentarzem.',
      'Keep the dependency order: inventory → topology/hub (SPOF) → bridge automation (quick win) → API-first layer. Do not buy a platform before the inventory.'
    )}
- ${L(
      'Pojedynczy punkt awarii bez właściciela to cichy najwyższy priorytet, nawet bez historii awarii; zacznij automatyzację od mostka, którego oba systemy mają już API.',
      'A single point of failure with no owner is the silent top priority even without a failure history; start automation with a bridge whose both systems already expose an API.'
    )}

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "category": "inventory|topology|bridges|apiled"}]}`;
  }

  return null;
}

/**
 * Decision Engine section-suggestion prompts, seeded with the per-element
 * deepening ladder (buildDecisionDeepenPrompt) and the partner-grade proposal bank
 * (DECISION_PROPOSAL_BANK). This is what makes the ladder and the proposal bank
 * LIVE in runtime rather than dead config, AND — crucially — what makes the
 * AI-assisted steps emit the STRUCTURAL fields the synthesis engine needs
 * (scores, low/base/high, binary, strawman, fromPremortem, implementersPresent,
 * commitmentConfirmed). Without these, toDecisionSession runs starved in a live
 * session: weightedScore=0 everywhere, an empty tornado, robustness always
 * "robust", and the doctrine's signature move (measure the flipping variable)
 * never fires. Returns null for steps it does not own (context/summary).
 */
function buildDecisionSectionPrompt(stepId: string, inputData: unknown): string | null {
  // Wizard step ids → Decision-Quality element ids (only 'uncertainties' differs).
  const STEP_TO_ELEMENT: Record<string, DecisionElementId> = {
    frame: 'frame',
    alternatives: 'alternatives',
    criteria: 'criteria',
    uncertainties: 'uncertainty',
    assumptions: 'assumptions',
  };
  const element = STEP_TO_ELEMENT[stepId];
  if (!element) return null;

  const isPolish = detectIsPolish(inputData);
  const L = (pl: string, en: string) => (isPolish ? pl : en);
  const opData = inputData as any;
  const label = L(decisionElementLabel(element).pl, decisionElementLabel(element).en);

  // The quantification rung disciplines the structural capture (weights, ranges,
  // scores); it is the rung whose questions demand the numbers the engine reads.
  const framing = buildDecisionDeepenPrompt(element, 'quantification', isPolish) ?? '';
  const bank = DECISION_PROPOSAL_BANK[element]
    .map((p) => `- [${p.rung}] ${L(p.title.pl, p.title.en)} — ${L(p.explanation.pl, p.explanation.en)}`)
    .join('\n');

  // Existing criteria / alternatives so the model keys per-criterion scores and
  // uncertainty/assumption cross-references to the ids the engine already holds.
  const listIds = (key: string) =>
    (Array.isArray(opData?.sections?.[key]) ? opData.sections[key] : [])
      .map((it: any) => `${it.id ?? it.title ?? '?'}${it.label || it.title ? ` (${it.label ?? it.title})` : ''}`)
      .join(', ');
  const criteriaIds = listIds('criteria');
  const alternativeIds = listIds('alternatives');

  const header = L(
    'Działaj jako partner ds. jakości decyzji (Decision Quality — SDG, Howard/Spetzler + debiasing McKinsey).',
    'Act as a decision-quality partner (Decision Quality — SDG, Howard/Spetzler + McKinsey debiasing).'
  );
  const bankHeader = L(
    `Bank propozycji dla „${label}" (użyj jako inspiracji, nie kopiuj dosłownie):`,
    `Proposal bank for "${label}" (use as inspiration, do not copy verbatim):`
  );
  const framingHeader = L('Rama kwantyfikacji (jaką liczbę / flagę wychwycić):', 'Quantification framing (which number / flag to capture):');

  // Per-element JSON schema — the fields toDecisionSession reads and parseItems now
  // preserves. Numbers are engine-scale swings/weights, NOT invented business data.
  const schema: Record<DecisionElementId, string> = {
    frame: `{"items": [{"title": "the decision as an open question", "question": "how best to… (NOT a yes/no binary)", "decisionMaker": "who actually decides", "horizon": "time horizon", "binary": false, "implementersPresent": true, "commitmentConfirmed": false, "reversibility": "one-way|two-way", "impact": "high|medium|low", "effort": "high|medium|low", "description": "..."}]}
${L('Zwróć DOKŁADNIE jeden wiersz ramy. Ustaw binary=true tylko, gdy pytanie jest realnie postawione „robić X czy nie".', 'Return EXACTLY one frame row. Set binary=true only when the question is genuinely posed as "do X or not".')}`,
    alternatives: `{"items": [{"title": "option name", "label": "A. …", "description": "...", "scores": {${criteriaIds ? '"<criterionId>": 1-5, …' : '"<criterionId once criteria exist>": 1-5'}}, "strawman": false, "doable": true, "realOption": false, "target": "<one-off cost as a number, optional>", "impact": "high|medium|low", "effort": "high|medium|low"}]}
${L('Wygeneruj ≥3 realne, MECE alternatywy; oznacz strawman=true tylko dla opcji obecnej po to, by przegrać; realOption=true dla taniego pilotażu/opcji odroczonej.', 'Generate ≥3 real, MECE alternatives; set strawman=true only for an option present only to lose; realOption=true for a cheap pilot/deferred option.')}
${criteriaIds ? L(`Klucze w "scores" to id kryteriów: ${criteriaIds}.`, `Keys in "scores" are the criterion ids: ${criteriaIds}.`) : L('Kryteria jeszcze nie istnieją — zdefiniuj je najpierw w kroku Kryteria, potem uzupełnij scores.', 'Criteria do not exist yet — define them in the Criteria step first, then fill scores.')}`,
    criteria: `{"items": [{"title": "criterion", "label": "…", "description": "...", "weight": 0.0-1.0, "declared": true, "contested": false, "disputeKind": "fact|value", "impact": "high|medium|low", "effort": "high|medium|low"}]}
${L('Wagi (weight) powinny sumować się do ~1 w całym zestawie. Ustaw declared=false dla kryterium, które realnie waży, ale nie zostało formalnie zadeklarowane (ukryte kryterium). contested=true + disputeKind, gdy waga jest sporna.', 'Weights should sum to ~1 across the set. Set declared=false for a criterion that truly weighs but was never formally declared (a hidden criterion). contested=true + disputeKind when the weight is disputed.')}`,
    uncertainty: `{"items": [{"title": "uncertainty", "label": "…", "description": "...", "low": -0.5, "base": 0, "high": 0.1, "criterion": "<criterion id it perturbs>", "pointEstimate": false, "impact": "high|medium|low", "effort": "high|medium|low"}]}
${L('low/base/high to WPŁYW tej niepewności na wynik wiodącej opcji (w skali oceny), nie wartość biznesowa — base zwykle 0, low ujemne, high dodatnie. pointEstimate=true, gdy podano pojedynczą liczbę udającą pewność.', 'low/base/high are the IMPACT of this uncertainty on the leading option\'s score (on the scoring scale), not a business value — base usually 0, low negative, high positive. pointEstimate=true when a single number pretends to be certainty.')}
${criteriaIds ? L(`"criterion" to id kryterium, które ta niepewność zaburza: ${criteriaIds}.`, `"criterion" is the id of the criterion this uncertainty perturbs: ${criteriaIds}.`) : ''}`,
    assumptions: `{"items": [{"title": "assumption", "label": "…", "description": "...", "alternative": "<alternative id it underpins>", "fromPremortem": true, "anchored": false, "impact": "high|medium|low", "effort": "high|medium|low"}]}
${L('Ustaw fromPremortem=true dla założeń wydobytych przez pre-mortem („decyzja zawiodła — dlaczego?"); anchored=true, gdy założenie zakotwiczone w pierwszej liczbie/poprzedniej decyzji.', 'Set fromPremortem=true for assumptions surfaced by a pre-mortem ("the decision failed — why?"); anchored=true when the assumption is anchored to the first number/prior decision.')}
${alternativeIds ? L(`"alternative" to id alternatywy, którą to założenie podpiera: ${alternativeIds}.`, `"alternative" is the id of the alternative this assumption underpins: ${alternativeIds}.`) : ''}`,
  };

  return `${header}

${L(`Zaproponuj 3-6 pozycji dla sekcji „${label}", zdyscyplinowanych drabiną pogłębiającą.`, `Propose 3-6 items for the "${label}" section, disciplined by the deepening ladder.`)}

${framingHeader}
${framing}

${bankHeader}
${bank}

${L('Zasady:', 'Rules:')}
- ${L('Wypełnij pola strukturalne (scores/low/base/high/wagi/flagi), bo to one zasilają macierz, tornado i ocenę zaangażowania — bez nich silnik liczy zero.', 'Fill the structural fields (scores/low/base/high/weights/flags) — they feed the matrix, the tornado and the commitment score; without them the engine computes zero.')}
- ${L('Nie zmyślaj liczb biznesowych; wpływy i wagi to wielkości modelowe. Gdy czegoś nie wiadomo — oznacz w opisie jako do zmierzenia.', 'Do not invent business numbers; impacts and weights are model-scale. Where unknown, mark it as to-measure in the description.')}

Return JSON:
${schema[element]}`;
}

/**
 * Digital Value Pool section-suggestion prompts. Seeds the `functions` and
 * `useCases` steps with the deepening ladder (buildValuePoolDeepenPrompt) + the
 * partner-grade proposal bank (VALUE_POOL_PROPOSAL_BANK) — making both live in
 * runtime rather than dead config (Fix 5/6). Crucially it also instructs the
 * model to EMIT the exact fields the deterministic engine reads (side / base /
 * benchmarkShare / captureRate for functions; feasibility + the four scale-gate
 * flags + captureRate for use-cases) so the engine is no longer starved: without
 * these the generic operational generator emitted only title/impact/effort and
 * every valueAtStake collapsed to 0 and the gate never fired (Fix 1). Returns
 * null for steps it does not own (context/summary fall through to generic).
 */
function buildValuePoolSectionPrompt(stepId: string, inputData: unknown): string | null {
  const isPolish = detectIsPolish(inputData);
  const L = (pl: string, en: string) => (isPolish ? pl : en);
  const proposalLines = (phase: ValuePoolPhaseId) =>
    VALUE_POOL_PROPOSAL_BANK[phase]
      .map((p) => `- [${p.rung}] ${L(p.title.pl, p.title.en)} — ${L(p.explanation.pl, p.explanation.en)}`)
      .join('\n');

  if (stepId === 'functions') {
    const framing = buildValuePoolDeepenPrompt('decompose', 'quantification', isPolish) ?? '';
    return `${L(
      'Działaj jako partner ds. strategii cyfrowej/AI (McKinsey value-at-stake, BCG digital value gap). Rozłóż organizację na 3-6 FUNKCJI łańcucha wartości — każda z bazą kosztową/przychodową i benchmarkiem branżowym, żeby silnik policzył value-at-stake (baza × benchmark) i realistyczne przechwycenie.',
      'Act as a digital/AI strategy partner (McKinsey value-at-stake, BCG digital value gap). Decompose the organization into 3-6 value-chain FUNCTIONS — each with a cost/revenue base and an industry benchmark share, so the engine can size value-at-stake (base × benchmark) and a realistic capture.'
    )}

${L('Rama pogłębiająca (próg istotności):', 'Deepening framing (materiality):')}
${framing}

${L('Bank propozycji partnerskich:', 'Partner-grade proposal bank:')}
${proposalLines('decompose')}

${L('Zasady — POLA, KTÓRE MUSISZ WYPEŁNIĆ (silnik je czyta):', 'Rules — FIELDS YOU MUST FILL (the engine reads them):')}
- ${L('"side": "cost" dla funkcji na bazie kosztowej, "revenue" dla przychodowej.', '"side": "cost" for a function on a cost base, "revenue" for a revenue base.')}
- ${L('"base": baza kosztowa/przychodowa (waluta, ta sama jednostka co budżet). "benchmarkShare": część bazy realnie „w grze" pod AI/cyfryzacją, 0..1 (np. 0.18 = 18%).', '"base": the cost/revenue base (currency, same unit as the budget). "benchmarkShare": fraction of the base realistically "in play" under AI/digitization, 0..1 (e.g. 0.18 = 18%).')}
- ${L('"captureRate" (0..1): ile z pułapu teoretycznego firma realnie przechwyci w horyzoncie — NIE cała pula; przy braku danych ~0.4.', '"captureRate" (0..1): how much of the theoretical ceiling the firm realistically captures within the horizon — NOT the whole pool; default ~0.4 when unknown.')}
- ${L('"measured": true tylko gdy baza/benchmark z realnych danych; false gdy szacunek. Nie zmyślaj liczb — zostaw base/benchmarkShare puste, gdy fakt nie istnieje.', '"measured": true only when base/benchmark come from real data; false when estimated. Do not invent numbers — leave base/benchmarkShare unset when the fact does not exist.')}

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "side": "cost|revenue", "base": 0, "benchmarkShare": 0.0, "captureRate": 0.4, "measured": true}]}`;
  }

  if (stepId === 'useCases') {
    const framing = buildValuePoolDeepenPrompt('prioritize', 'risk-capability', isPolish) ?? '';
    return `${L(
      'Działaj jako partner ds. strategii cyfrowej/AI. Zaproponuj 3-6 kandydackich USE-CASE\'ów, każdy przypisany do funkcji (functionId), oceniony na DWÓCH osiach (impact × feasibility) i przepuszczony przez bramkę gotowości do SKALI.',
      'Act as a digital/AI strategy partner. Propose 3-6 candidate USE-CASES, each attributed to a function (functionId), scored on TWO axes (impact × feasibility) and passed through the scale-readiness gate.'
    )}

${L('Rama pogłębiająca (feasibility SKALOWANIA, nie tylko techniczna):', 'Deepening framing (feasibility TO SCALE, not just technical):')}
${framing}

${L('Bank propozycji partnerskich:', 'Partner-grade proposal bank:')}
${proposalLines('prioritize')}

${L('Zasady — POLA, KTÓRE MUSISZ WYPEŁNIĆ (silnik je czyta):', 'Rules — FIELDS YOU MUST FILL (the engine reads them):')}
- ${L('"functionId": id funkcji, do której należy use-case (musi pasować do funkcji z poprzedniego kroku). "phase": decompose|size|prioritize|sequence.', '"functionId": id of the function this use-case belongs to (must match a function from the previous step). "phase": decompose|size|prioritize|sequence.')}
- ${L('"impact" i "feasibility": high|medium|low. Feasibility to feasibility TECHNICZNA — bramka skalowania jest osobno poniżej.', '"impact" and "feasibility": high|medium|low. Feasibility is TECHNICAL feasibility — the scale gate below is separate.')}
- ${L('BRAMKA SKALOWANIA (kluczowa): "dataReady", "hasOwner", "scalable", "businessMetric" — każde true/false. Wysoka feasibility techniczna NIE promuje use-case\'u sama: brak danych LUB właściciela to bloker decydujący, który wypycha go z quick-winu do „pilota bez skali".', 'SCALE GATE (critical): "dataReady", "hasOwner", "scalable", "businessMetric" — each true/false. High technical feasibility does NOT promote a use-case alone: missing data OR owner is a decisive blocker that pushes it out of quick-win into "pilot without scale".')}
- ${L('"bottomUpValue": skwantyfikowana wartość oddolna (waluta), gdy istnieje. "captureRate" (0..1): realny capture, ~0.4 przy braku danych. Nie zmyślaj liczb.', '"bottomUpValue": the bottom-up quantified value (currency) where it exists. "captureRate" (0..1): realistic capture, ~0.4 when unknown. Do not invent numbers.')}

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "feasibility": "high|medium|low", "functionId": "fn-...", "phase": "prioritize", "bottomUpValue": 0, "dataReady": true, "hasOwner": true, "scalable": true, "businessMetric": true, "captureRate": 0.4}]}`;
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

    // Integration Diagnostic seeds section suggestions with the four-lever
    // deepening ladder + proposal bank (buildIntegrationSectionPrompt); fall
    // through to the generic operational prompt for steps it does not own.
    if (toolType === 'integration-diagnostic') {
      const integrationPrompt = buildIntegrationSectionPrompt(stepId, inputData);
      if (integrationPrompt) return integrationPrompt;
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

    // Legacy Analyzer seeds its capture-step suggestions with the deepening ladder
    // + partner-grade proposal bank (making both live in runtime); falls through to
    // the generic operational prompt for steps it does not own (context/summary).
    if (toolType === 'legacy-analyzer') {
      const legacyPrompt = buildLegacyStepSuggestionPrompt(stepId, detectIsPolish(inputData));
      if (legacyPrompt) return legacyPrompt;
    }

    // Robotics Feasibility seeds its `operations` step with the deepening ladder
    // (buildRoboticsDeepenPrompt across all six axes, technical feasibility BEFORE
    // economic) — this is what makes the ladder LIVE in runtime rather than dead
    // config. Falls through to the generic operational prompt for other steps.
    if (toolType === 'robotics-feasibility' && stepId === 'operations') {
      const isPolish = detectIsPolish(inputData);
      const framing = ROBOTICS_AXES.map((axis) => buildRoboticsDeepenPrompt(axis, 'evidence', isPolish))
        .filter((x): x is string => !!x)
        .map((x) => `- ${x}`)
        .join('\n');
      if (framing) {
        return `${
          isPolish
            ? 'Działaj jako partner ds. feasibility robotyzacji (roboty/coboty/AMR, ISO 10218/TS 15066, business case ROI/payback). Zaproponuj 3-6 operacji-kandydatów, każdą zdyscyplinowaną drabiną pogłębiającą — bramka TECHNICZNA (powtarzalność I ustrukturyzowane środowisko I rozwiązywalny chwyt) PRZED ekonomiczną.'
            : 'Act as a robotics-feasibility partner (robots/cobots/AMR, ISO 10218/TS 15066, ROI/payback business case). Propose 3-6 candidate operations, each disciplined by the deepening ladder — the TECHNICAL gate (repeatability AND structured environment AND solvable grip) BEFORE the economic one.'
        }

${isPolish ? 'Rama dowodowa per oś (czy to zmierzone, czy nawyk / broszura dostawcy):' : 'Evidence framing per axis (is it measured, or habit / a supplier brochure figure):'}
${framing}

${isPolish ? 'Zasady:' : 'Rules:'}
- ${
          isPolish
            ? 'Nie licz ROI operacji, która nie przeszła bramki technicznej; brak danych o powtarzalności/środowisku/chwycie = do zmierzenia, nie domyślne „przejście”.'
            : 'Do not price ROI on an operation that failed the technical gate; missing repeatability/environment/grip data = to-measure, not a default "pass".'
        }
- ${
          isPolish
            ? 'Podaj cycle time (manualny), wolumen roczny i liczbę zmian, bo payback zależy od trybu pracy (~2x dłuższy przy 1 zmianie); nie zmyślaj liczb.'
            : 'Capture cycle time (manual), annual volume and shift count — payback depends on the work mode (~2x longer at 1 shift); do not invent numbers.'
        }

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low", "category": "...", "repeatability": "high|medium|low", "structuredEnv": "high|medium|low", "gripSolvability": "high|medium|low", "shifts": 0, "cycleTimeManualSec": 0, "annualVolume": 0, "variability": "high|medium|low", "safetyRegime": "fenced|cobot|unknown"}]}`;
      }
    }

    // Decision Engine seeds its capture steps (frame / alternatives / criteria /
    // uncertainties / assumptions) with the deepening ladder + proposal bank AND
    // the structural field schema the synthesis engine reads — this is what feeds
    // the matrix / tornado / commitment score in a LIVE session. Falls through to
    // the generic operational prompt for steps it does not own (context/summary).
    if (toolType === 'decision-engine') {
      const decisionPrompt = buildDecisionSectionPrompt(stepId, inputData);
      if (decisionPrompt) return decisionPrompt;
    }

    const opData = inputData as any;
    const ctx = opData?.context || {};
    // Digital Value Pool seeds its functions/useCases suggestions with the
    // deepening ladder + proposal bank AND emits the exact fields the engine
    // reads (side/base/benchmarkShare/captureRate + scale-gate flags); falls
    // through to the generic operational prompt for steps it does not own.
    if (toolType === 'digital-value-pool') {
      const valuePoolPrompt = buildValuePoolSectionPrompt(stepId, inputData);
      if (valuePoolPrompt) return valuePoolPrompt;
    }

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
    const prompt = buildLegacyConclusionPrompt(
      toLegacySession(op?.sections, toLegacyMeta(op?.context)),
      isPolish
    );
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
