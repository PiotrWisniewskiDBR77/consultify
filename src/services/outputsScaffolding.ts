/**
 * Outputs Scaffolding
 *
 * Deterministic mapping from tools / templates / assessments → report sections,
 * deck slides, and initiative hints.  Every consulting tool gets a bespoke
 * scaffold; assessments (DRD, SIRI, ADMA) get their own; templates fall back
 * to a generic scaffold derived from their outputMapping.
 */

import {
  CONSULTING_TOOL_STANDARD_OUTPUTS,
  type ConsultingToolOutputType,
} from '@/config/consultingToolsStandard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportSection {
  id: string;
  title: { en: string; pl: string };
  required: boolean;
  dataSource: string;
}

export interface DeckSlide {
  id: string;
  title: { en: string; pl: string };
  layout: 'title' | 'content' | 'chart' | 'comparison' | 'summary';
  dataSource: string;
}

export interface InitiativeHint {
  category: string;
  titlePattern: { en: string; pl: string };
  sourceField: string;
}

export interface OutputScaffold {
  sourceType: 'tool' | 'template' | 'assessment';
  sourceSlug: string;
  sourceArtifact: 'final-source-summary';
  primarySourceField: string;
  supportedOutputs: readonly ConsultingToolOutputType[];
  reportOutline: ReportSection[];
  deckOutline: DeckSlide[];
  initiativeHints: InitiativeHint[];
}

type OutputScaffoldDefinition = Omit<
  OutputScaffold,
  'supportedOutputs' | 'sourceArtifact' | 'primarySourceField'
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sec(
  id: string,
  en: string,
  pl: string,
  required: boolean,
  dataSource: string
): ReportSection {
  return { id, title: { en, pl }, required, dataSource };
}

function slide(
  id: string,
  en: string,
  pl: string,
  layout: DeckSlide['layout'],
  dataSource: string
): DeckSlide {
  return { id, title: { en, pl }, layout, dataSource };
}

function hint(category: string, en: string, pl: string, sourceField: string): InitiativeHint {
  return { category, titlePattern: { en, pl }, sourceField };
}

function withStandardOutputs(scaffold: OutputScaffoldDefinition): OutputScaffold {
  return {
    ...scaffold,
    sourceArtifact: 'final-source-summary',
    primarySourceField: 'tool.finalSourceSummary',
    supportedOutputs: CONSULTING_TOOL_STANDARD_OUTPUTS,
  };
}

// ---------------------------------------------------------------------------
// Tool scaffolds (31)
// ---------------------------------------------------------------------------

const TOOL_SCAFFOLDS: Record<string, OutputScaffoldDefinition> = {
  'dynamic-swot': {
    sourceType: 'tool',
    sourceSlug: 'dynamic-swot',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('strengths', 'Strengths Analysis', 'Analiza mocnych stron', true, 'tool.strengths'),
      sec('weaknesses', 'Weaknesses Analysis', 'Analiza słabych stron', true, 'tool.weaknesses'),
      sec('opportunities', 'Opportunities Analysis', 'Analiza szans', true, 'tool.opportunities'),
      sec('threats', 'Threats Analysis', 'Analiza zagrożeń', true, 'tool.threats'),
      sec(
        'cross-impact',
        'Cross-Impact Matrix',
        'Macierz wzajemnego wpływu',
        false,
        'tool.crossImpact'
      ),
      sec('takeaways', 'Key Takeaways', 'Kluczowe wnioski', true, 'tool.takeaways'),
      sec(
        'initiatives',
        'Recommended Initiatives',
        'Rekomendowane inicjatywy',
        true,
        'tool.initiatives'
      ),
    ],
    deckOutline: [
      slide('title', 'Dynamic SWOT Analysis', 'Dynamiczna analiza SWOT', 'title', 'tool.meta'),
      slide(
        'sw',
        'Strengths & Weaknesses',
        'Mocne i słabe strony',
        'comparison',
        'tool.strengths,tool.weaknesses'
      ),
      slide(
        'ot',
        'Opportunities & Threats',
        'Szanse i zagrożenia',
        'comparison',
        'tool.opportunities,tool.threats'
      ),
      slide(
        'matrix',
        'Cross-Impact Matrix',
        'Macierz wzajemnego wpływu',
        'chart',
        'tool.crossImpact'
      ),
      slide('takeaways', 'Key Takeaways', 'Kluczowe wnioski', 'content', 'tool.takeaways'),
      slide(
        'initiatives',
        'Recommended Initiatives',
        'Rekomendowane inicjatywy',
        'content',
        'tool.initiatives'
      ),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'strategy',
        'Leverage ${strength} to capture ${opportunity}',
        'Wykorzystaj ${strength} do uchwycenia ${opportunity}',
        'tool.crossImpact'
      ),
      hint(
        'risk',
        'Mitigate ${threat} by addressing ${weakness}',
        'Zmitiguj ${threat} adresując ${weakness}',
        'tool.crossImpact'
      ),
    ],
  },

  'market-forces': {
    sourceType: 'tool',
    sourceSlug: 'market-forces',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('rivalry', 'Competitive Rivalry', 'Rywalizacja konkurencyjna', true, 'tool.rivalry'),
      sec(
        'new-entrants',
        'Threat of New Entrants',
        'Zagrożenie nowych wejść',
        true,
        'tool.newEntrants'
      ),
      sec(
        'substitutes',
        'Threat of Substitutes',
        'Zagrożenie substytutów',
        true,
        'tool.substitutes'
      ),
      sec('buyer-power', 'Buyer Power', 'Siła nabywców', true, 'tool.buyerPower'),
      sec('supplier-power', 'Supplier Power', 'Siła dostawców', true, 'tool.supplierPower'),
      sec('strategic-levers', 'Strategic Levers', 'Dźwignie strategiczne', true, 'tool.levers'),
      sec(
        'initiatives',
        'Recommended Initiatives',
        'Rekomendowane inicjatywy',
        true,
        'tool.initiatives'
      ),
    ],
    deckOutline: [
      slide('title', 'Market Forces Analysis', 'Analiza sił rynkowych', 'title', 'tool.meta'),
      slide('scorecard', 'Force Scorecard', 'Scorecard sił', 'chart', 'tool.scores'),
      slide(
        'rivalry',
        'Competitive Rivalry',
        'Rywalizacja konkurencyjna',
        'content',
        'tool.rivalry'
      ),
      slide(
        'forces',
        'Entrants, Substitutes, Bargaining',
        'Wejścia, substytuty, siła przetargowa',
        'comparison',
        'tool.newEntrants,tool.substitutes'
      ),
      slide('levers', 'Strategic Levers', 'Dźwignie strategiczne', 'content', 'tool.levers'),
      slide(
        'initiatives',
        'Recommended Initiatives',
        'Rekomendowane inicjatywy',
        'content',
        'tool.initiatives'
      ),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'strategy',
        'Strengthen position against ${force}',
        'Wzmocnij pozycję wobec ${force}',
        'tool.levers'
      ),
      hint(
        'risk',
        'Monitor ${force} intensity changes',
        'Monitoruj zmiany intensywności ${force}',
        'tool.scores'
      ),
    ],
  },

  'growth-paths': {
    sourceType: 'tool',
    sourceSlug: 'growth-paths',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('market-penetration', 'Market Penetration', 'Penetracja rynku', true, 'tool.penetration'),
      sec('market-development', 'Market Development', 'Rozwój rynku', true, 'tool.development'),
      sec('product-development', 'Product Development', 'Rozwój produktu', true, 'tool.productDev'),
      sec('diversification', 'Diversification', 'Dywersyfikacja', true, 'tool.diversification'),
      sec('risk-framing', 'Risk Framing', 'Ocena ryzyk', true, 'tool.riskFraming'),
      sec(
        'recommended-paths',
        'Recommended Growth Paths',
        'Rekomendowane ścieżki wzrostu',
        true,
        'tool.recommended'
      ),
    ],
    deckOutline: [
      slide('title', 'Growth Paths Analysis', 'Analiza ścieżek wzrostu', 'title', 'tool.meta'),
      slide('matrix', 'Ansoff Matrix', 'Macierz Ansoffa', 'chart', 'tool.matrix'),
      slide('options', 'Growth Options', 'Opcje wzrostu', 'comparison', 'tool.options'),
      slide('risk', 'Risk Framing', 'Ocena ryzyk', 'chart', 'tool.riskFraming'),
      slide(
        'recommended',
        'Recommended Paths',
        'Rekomendowane ścieżki',
        'content',
        'tool.recommended'
      ),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'growth',
        'Pursue ${path} growth opportunity',
        'Realizuj szansę wzrostu ${path}',
        'tool.recommended'
      ),
      hint(
        'risk',
        'Mitigate risk for ${path} path',
        'Zmitiguj ryzyko ścieżki ${path}',
        'tool.riskFraming'
      ),
    ],
  },

  'value-chain': {
    sourceType: 'tool',
    sourceSlug: 'value-chain',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec(
        'primary-activities',
        'Primary Activities',
        'Aktywności podstawowe',
        true,
        'tool.primary'
      ),
      sec(
        'support-activities',
        'Support Activities',
        'Aktywności wspierające',
        true,
        'tool.support'
      ),
      sec('cost-drivers', 'Cost Drivers', 'Dźwignie kosztów', true, 'tool.costDrivers'),
      sec('value-drivers', 'Value Drivers', 'Dźwignie wartości', true, 'tool.valueDrivers'),
      sec('hotspots', 'Improvement Hotspots', 'Hotspoty usprawnień', true, 'tool.hotspots'),
      sec(
        'initiatives',
        'Recommended Initiatives',
        'Rekomendowane inicjatywy',
        true,
        'tool.initiatives'
      ),
    ],
    deckOutline: [
      slide('title', 'Value Chain Analysis', 'Analiza łańcucha wartości', 'title', 'tool.meta'),
      slide('chain', 'Value Chain Map', 'Mapa łańcucha wartości', 'chart', 'tool.chainMap'),
      slide(
        'drivers',
        'Cost & Value Drivers',
        'Dźwignie kosztów i wartości',
        'comparison',
        'tool.costDrivers,tool.valueDrivers'
      ),
      slide('hotspots', 'Improvement Hotspots', 'Hotspoty usprawnień', 'content', 'tool.hotspots'),
      slide(
        'initiatives',
        'Recommended Initiatives',
        'Rekomendowane inicjatywy',
        'content',
        'tool.initiatives'
      ),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'efficiency',
        'Optimize ${activity} cost structure',
        'Zoptymalizuj strukturę kosztów ${activity}',
        'tool.costDrivers'
      ),
      hint(
        'value',
        'Enhance ${activity} value delivery',
        'Wzmocnij dostarczanie wartości ${activity}',
        'tool.valueDrivers'
      ),
    ],
  },

  'portfolio-priority': {
    sourceType: 'tool',
    sourceSlug: 'portfolio-priority',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('criteria', 'Prioritization Criteria', 'Kryteria priorytetyzacji', true, 'tool.criteria'),
      sec('scoring', 'Initiative Scoring', 'Scoring inicjatyw', true, 'tool.scoring'),
      sec('matrix', 'Impact/Effort Matrix', 'Macierz Impact/Effort', true, 'tool.matrix'),
      sec(
        'constraints',
        'Constraints & Dependencies',
        'Ograniczenia i zależności',
        false,
        'tool.constraints'
      ),
      sec('top-picks', 'Top Picks', 'Najlepsze wybory', true, 'tool.topPicks'),
      sec('roadmap', 'Sequencing Recommendation', 'Rekomendacja sekwencji', true, 'tool.roadmap'),
    ],
    deckOutline: [
      slide('title', 'Portfolio Prioritization', 'Priorytetyzacja portfela', 'title', 'tool.meta'),
      slide(
        'criteria',
        'Prioritization Criteria',
        'Kryteria priorytetyzacji',
        'content',
        'tool.criteria'
      ),
      slide('matrix', 'Impact/Effort Matrix', 'Macierz Impact/Effort', 'chart', 'tool.matrix'),
      slide('ranking', 'Initiative Ranking', 'Ranking inicjatyw', 'chart', 'tool.scoring'),
      slide('top-picks', 'Top Picks', 'Najlepsze wybory', 'content', 'tool.topPicks'),
      slide(
        'sequence',
        'Recommended Sequence',
        'Rekomendowana sekwencja',
        'content',
        'tool.roadmap'
      ),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'portfolio',
        'Invest in ${initiative} (high impact)',
        'Zainwestuj w ${initiative} (wysoki impact)',
        'tool.topPicks'
      ),
      hint(
        'portfolio',
        'Defer ${initiative} (low priority)',
        'Odłóż ${initiative} (niski priorytet)',
        'tool.scoring'
      ),
    ],
  },

  'risk-uncertainty': {
    sourceType: 'tool',
    sourceSlug: 'risk-uncertainty',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('risk-register', 'Risk Register', 'Rejestr ryzyk', true, 'tool.riskRegister'),
      sec('unknowns', 'Unknowns & Assumptions', 'Niewiadome i założenia', true, 'tool.unknowns'),
      sec(
        'impact-probability',
        'Impact × Probability Matrix',
        'Macierz wpływ × prawdopodobieństwo',
        true,
        'tool.matrix'
      ),
      sec('mitigations', 'Mitigation Strategies', 'Strategie mitigacji', true, 'tool.mitigations'),
      sec('contingency', 'Contingency Plans', 'Plany awaryjne', false, 'tool.contingency'),
    ],
    deckOutline: [
      slide(
        'title',
        'Risk & Uncertainty Analysis',
        'Analiza ryzyk i niepewności',
        'title',
        'tool.meta'
      ),
      slide('heatmap', 'Risk Heat Map', 'Mapa ciepła ryzyk', 'chart', 'tool.matrix'),
      slide('top-risks', 'Top Risks', 'Najważniejsze ryzyka', 'content', 'tool.riskRegister'),
      slide('unknowns', 'Key Unknowns', 'Kluczowe niewiadome', 'content', 'tool.unknowns'),
      slide('mitigations', 'Mitigation Plan', 'Plan mitigacji', 'content', 'tool.mitigations'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'risk',
        'Mitigate ${risk} through ${action}',
        'Zmitiguj ${risk} przez ${action}',
        'tool.mitigations'
      ),
      hint(
        'risk',
        'Investigate unknown: ${unknown}',
        'Zbadaj niewiadomą: ${unknown}',
        'tool.unknowns'
      ),
    ],
  },

  'capability-mapper': {
    sourceType: 'tool',
    sourceSlug: 'capability-mapper',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('capability-map', 'Capability Map', 'Mapa kompetencji', true, 'tool.capabilityMap'),
      sec('maturity-assessment', 'Maturity Assessment', 'Ocena dojrzałości', true, 'tool.maturity'),
      sec('gap-analysis', 'Gap Analysis', 'Analiza luk', true, 'tool.gaps'),
      sec(
        'priority-capabilities',
        'Priority Capabilities',
        'Priorytetowe kompetencje',
        true,
        'tool.priorities'
      ),
      sec('roadmap', 'Development Roadmap', 'Roadmapa rozwoju', true, 'tool.roadmap'),
      sec(
        'initiatives',
        'Recommended Initiatives',
        'Rekomendowane inicjatywy',
        true,
        'tool.initiatives'
      ),
    ],
    deckOutline: [
      slide('title', 'Capability Mapping', 'Mapowanie kompetencji', 'title', 'tool.meta'),
      slide('map', 'Capability Map', 'Mapa kompetencji', 'chart', 'tool.capabilityMap'),
      slide('maturity', 'Maturity Levels', 'Poziomy dojrzałości', 'chart', 'tool.maturity'),
      slide('gaps', 'Key Gaps', 'Kluczowe luki', 'content', 'tool.gaps'),
      slide(
        'priorities',
        'Priority Capabilities',
        'Priorytetowe kompetencje',
        'content',
        'tool.priorities'
      ),
      slide('roadmap', 'Development Roadmap', 'Roadmapa rozwoju', 'content', 'tool.roadmap'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'capabilities',
        'Build ${capability} to level ${target}',
        'Rozwiń ${capability} do poziomu ${target}',
        'tool.gaps'
      ),
      hint(
        'capabilities',
        'Acquire ${capability} externally',
        'Pozyskaj ${capability} z zewnątrz',
        'tool.priorities'
      ),
    ],
  },

  'ambition-decomposer': {
    sourceType: 'tool',
    sourceSlug: 'ambition-decomposer',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('vision', 'Vision Statement', 'Deklaracja wizji', true, 'tool.vision'),
      sec('dimensions', 'Ambition Dimensions', 'Wymiary ambicji', true, 'tool.dimensions'),
      sec('targets', 'Targets & Metrics', 'Cele i metryki', true, 'tool.targets'),
      sec('initiative-themes', 'Initiative Themes', 'Tematy inicjatyw', true, 'tool.themes'),
      sec('alignment', 'Alignment Check', 'Sprawdzenie alignmentu', false, 'tool.alignment'),
    ],
    deckOutline: [
      slide('title', 'Ambition Decomposition', 'Dekompozycja ambicji', 'title', 'tool.meta'),
      slide('vision', 'Vision & Ambition', 'Wizja i ambicja', 'content', 'tool.vision'),
      slide('tree', 'Ambition Tree', 'Drzewo ambicji', 'chart', 'tool.dimensions'),
      slide('targets', 'Targets & Metrics', 'Cele i metryki', 'content', 'tool.targets'),
      slide('themes', 'Initiative Themes', 'Tematy inicjatyw', 'content', 'tool.themes'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'strategy',
        'Deliver on ${dimension} ambition',
        'Zrealizuj ambicję ${dimension}',
        'tool.dimensions'
      ),
      hint(
        'measurement',
        'Track ${metric} toward ${target}',
        'Śledź ${metric} w kierunku ${target}',
        'tool.targets'
      ),
    ],
  },

  'focus-tradeoff': {
    sourceType: 'tool',
    sourceSlug: 'focus-tradeoff',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('tradeoff-map', 'Trade-off Map', 'Mapa trade-offów', true, 'tool.tradeoffMap'),
      sec('stop-doing', 'Stop-Doing List', 'Lista stop-doing', true, 'tool.stopDoing'),
      sec('focus-areas', 'Focus Areas', 'Obszary fokusowe', true, 'tool.focusAreas'),
      sec('rationale', 'Decision Rationale', 'Uzasadnienie decyzji', true, 'tool.rationale'),
    ],
    deckOutline: [
      slide('title', 'Focus & Trade-offs', 'Fokus i trade-offy', 'title', 'tool.meta'),
      slide('map', 'Trade-off Map', 'Mapa trade-offów', 'chart', 'tool.tradeoffMap'),
      slide('focus', 'Where We Focus', 'Gdzie się skupiamy', 'content', 'tool.focusAreas'),
      slide('stop', 'What We Stop Doing', 'Co przestajemy robić', 'content', 'tool.stopDoing'),
      slide('rationale', 'Decision Rationale', 'Uzasadnienie', 'content', 'tool.rationale'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'strategy',
        'Double down on ${focusArea}',
        'Podwój wysiłek w ${focusArea}',
        'tool.focusAreas'
      ),
      hint('strategy', 'Wind down ${stoppedItem}', 'Wygaś ${stoppedItem}', 'tool.stopDoing'),
    ],
  },

  'narrative-engine': {
    sourceType: 'tool',
    sourceSlug: 'narrative-engine',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('storyline', 'Strategy Storyline', 'Narracja strategii', true, 'tool.storyline'),
      sec('alignment', 'Alignment Checklist', 'Checklist alignmentu', true, 'tool.alignment'),
      sec('messaging-gaps', 'Messaging Gaps', 'Luki w komunikacji', true, 'tool.messagingGaps'),
      sec('audience-mapping', 'Audience Mapping', 'Mapowanie odbiorców', false, 'tool.audiences'),
    ],
    deckOutline: [
      slide('title', 'Narrative & Alignment', 'Narracja i alignment', 'title', 'tool.meta'),
      slide('storyline', 'Strategy Storyline', 'Narracja strategii', 'content', 'tool.storyline'),
      slide('alignment', 'Alignment Check', 'Sprawdzenie alignmentu', 'chart', 'tool.alignment'),
      slide('gaps', 'Messaging Gaps', 'Luki w komunikacji', 'content', 'tool.messagingGaps'),
      slide('audiences', 'Audience Map', 'Mapa odbiorców', 'content', 'tool.audiences'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'communication',
        'Close messaging gap for ${audience}',
        'Zamknij lukę komunikacyjną dla ${audience}',
        'tool.messagingGaps'
      ),
      hint(
        'alignment',
        'Align ${stakeholder} on strategy narrative',
        'Wyrównaj ${stakeholder} wokół narracji strategii',
        'tool.alignment'
      ),
    ],
  },

  'sop-builder': {
    sourceType: 'tool',
    sourceSlug: 'sop-builder',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('process-scope', 'Process Scope', 'Zakres procesu', true, 'tool.scope'),
      sec('sop-steps', 'SOP Steps', 'Kroki SOP', true, 'tool.steps'),
      sec('checklist', 'Quality Checklist', 'Checklist jakości', true, 'tool.checklist'),
      sec('training', 'Training Plan', 'Plan szkolenia', false, 'tool.training'),
      sec('kpis', 'Performance Metrics', 'Metryki wydajności', true, 'tool.kpis'),
    ],
    deckOutline: [
      slide(
        'title',
        'Standard Operating Procedure',
        'Standardowa procedura operacyjna',
        'title',
        'tool.meta'
      ),
      slide('scope', 'Process Scope', 'Zakres procesu', 'content', 'tool.scope'),
      slide('steps', 'SOP Steps', 'Kroki SOP', 'content', 'tool.steps'),
      slide('checklist', 'Quality Checklist', 'Checklist jakości', 'content', 'tool.checklist'),
      slide('kpis', 'Performance Metrics', 'Metryki wydajności', 'chart', 'tool.kpis'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'standardization',
        'Implement SOP for ${process}',
        'Wdróż SOP dla ${process}',
        'tool.scope'
      ),
      hint(
        'training',
        'Train team on ${process} SOP',
        'Przeszkol zespół z SOP ${process}',
        'tool.training'
      ),
    ],
  },

  'a3-problem-solving': {
    sourceType: 'tool',
    sourceSlug: 'a3-problem-solving',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('background', 'Background & Context', 'Tło i kontekst', true, 'tool.background'),
      sec('current-condition', 'Current Condition', 'Stan obecny', true, 'tool.currentCondition'),
      sec(
        'root-causes',
        'Root Cause Analysis',
        'Analiza przyczyn źródłowych',
        true,
        'tool.rootCauses'
      ),
      sec('target-condition', 'Target Condition', 'Stan docelowy', true, 'tool.targetCondition'),
      sec('countermeasures', 'Countermeasures', 'Środki zaradcze', true, 'tool.countermeasures'),
      sec('implementation', 'Implementation Plan', 'Plan wdrożenia', true, 'tool.implementation'),
      sec(
        'follow-up',
        'Follow-up & Verification',
        'Follow-up i weryfikacja',
        true,
        'tool.followUp'
      ),
    ],
    deckOutline: [
      slide('title', 'A3 Problem Solving', 'Rozwiązywanie problemów A3', 'title', 'tool.meta'),
      slide('background', 'Background', 'Tło', 'content', 'tool.background'),
      slide(
        'current',
        'Current vs Target',
        'Stan obecny vs docelowy',
        'comparison',
        'tool.currentCondition,tool.targetCondition'
      ),
      slide('root-causes', 'Root Causes', 'Przyczyny źródłowe', 'chart', 'tool.rootCauses'),
      slide(
        'countermeasures',
        'Countermeasures',
        'Środki zaradcze',
        'content',
        'tool.countermeasures'
      ),
      slide('plan', 'Implementation Plan', 'Plan wdrożenia', 'content', 'tool.implementation'),
      slide('next', 'Follow-up', 'Follow-up', 'summary', 'tool.followUp'),
    ],
    initiativeHints: [
      hint(
        'improvement',
        'Implement countermeasure: ${countermeasure}',
        'Wdróż środek zaradczy: ${countermeasure}',
        'tool.countermeasures'
      ),
      hint(
        'quality',
        'Address root cause: ${rootCause}',
        'Zaadresuj przyczynę źródłową: ${rootCause}',
        'tool.rootCauses'
      ),
    ],
  },

  'vsm-builder': {
    sourceType: 'tool',
    sourceSlug: 'vsm-builder',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('current-state', 'Current State Map', 'Mapa stanu obecnego', true, 'tool.currentState'),
      sec(
        'waste-analysis',
        'Waste Identification',
        'Identyfikacja marnotrawstw',
        true,
        'tool.wasteAnalysis'
      ),
      sec('metrics', 'Flow Metrics', 'Metryki przepływu', true, 'tool.metrics'),
      sec(
        'future-state',
        'Future State Design',
        'Projekt stanu przyszłego',
        true,
        'tool.futureState'
      ),
      sec('improvement-plan', 'Improvement Plan', 'Plan usprawnień', true, 'tool.improvementPlan'),
    ],
    deckOutline: [
      slide('title', 'Value Stream Mapping', 'Mapowanie strumienia wartości', 'title', 'tool.meta'),
      slide('current', 'Current State', 'Stan obecny', 'chart', 'tool.currentState'),
      slide('waste', 'Waste Hotspots', 'Hotspoty marnotrawstw', 'chart', 'tool.wasteAnalysis'),
      slide('metrics', 'Flow Metrics', 'Metryki przepływu', 'chart', 'tool.metrics'),
      slide('future', 'Future State', 'Stan przyszły', 'chart', 'tool.futureState'),
      slide('plan', 'Improvement Plan', 'Plan usprawnień', 'content', 'tool.improvementPlan'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'lean',
        'Eliminate waste at ${step}',
        'Wyeliminuj marnotrawstwo w ${step}',
        'tool.wasteAnalysis'
      ),
      hint(
        'flow',
        'Implement future-state flow at ${step}',
        'Wdróż przepływ docelowy w ${step}',
        'tool.futureState'
      ),
    ],
  },

  'constraint-control': {
    sourceType: 'tool',
    sourceSlug: 'constraint-control',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec(
        'constraint-id',
        'Constraint Identification',
        'Identyfikacja constraintu',
        true,
        'tool.constraintId'
      ),
      sec(
        'exploitation',
        'Exploitation Strategy',
        'Strategia eksploatacji',
        true,
        'tool.exploitation'
      ),
      sec(
        'subordination',
        'Subordination Rules',
        'Reguły podporządkowania',
        true,
        'tool.subordination'
      ),
      sec('buffer-policy', 'Buffer Policy', 'Polityka buforów', true, 'tool.bufferPolicy'),
      sec('elevation', 'Elevation Plan', 'Plan podniesienia', false, 'tool.elevation'),
      sec('actions', 'Action List', 'Lista działań', true, 'tool.actions'),
    ],
    deckOutline: [
      slide(
        'title',
        'Constraint Control (TOC)',
        'Kontrola constraintu (TOC)',
        'title',
        'tool.meta'
      ),
      slide(
        'constraint',
        'System Constraint',
        'Constraint systemowy',
        'content',
        'tool.constraintId'
      ),
      slide(
        'exploit',
        'Exploitation Strategy',
        'Strategia eksploatacji',
        'content',
        'tool.exploitation'
      ),
      slide('buffers', 'Buffer Policy', 'Polityka buforów', 'chart', 'tool.bufferPolicy'),
      slide('actions', 'Action Plan', 'Plan działań', 'content', 'tool.actions'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'throughput',
        'Exploit constraint at ${resource}',
        'Eksploatuj constraint w ${resource}',
        'tool.constraintId'
      ),
      hint(
        'throughput',
        'Elevate constraint capacity',
        'Podnieś przepustowość constraintu',
        'tool.elevation'
      ),
    ],
  },

  'decision-engine': {
    sourceType: 'tool',
    sourceSlug: 'decision-engine',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('decision-context', 'Decision Context', 'Kontekst decyzji', true, 'tool.context'),
      sec('criteria', 'Criteria & Weights', 'Kryteria i wagi', true, 'tool.criteria'),
      sec('options', 'Options Analysis', 'Analiza opcji', true, 'tool.options'),
      sec('scoring', 'Scoring Results', 'Wyniki scoringu', true, 'tool.scoring'),
      sec('rationale', 'Decision Rationale', 'Uzasadnienie decyzji', true, 'tool.rationale'),
    ],
    deckOutline: [
      slide('title', 'Decision Engine', 'Silnik decyzyjny', 'title', 'tool.meta'),
      slide('context', 'Decision Context', 'Kontekst decyzji', 'content', 'tool.context'),
      slide('criteria', 'Criteria & Weights', 'Kryteria i wagi', 'chart', 'tool.criteria'),
      slide('scoring', 'Option Scoring', 'Scoring opcji', 'chart', 'tool.scoring'),
      slide('recommendation', 'Recommendation', 'Rekomendacja', 'content', 'tool.rationale'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'decision',
        'Implement decision: ${option}',
        'Wdróż decyzję: ${option}',
        'tool.rationale'
      ),
    ],
  },

  'control-tower': {
    sourceType: 'tool',
    sourceSlug: 'control-tower',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('kpi-set', 'KPI Set', 'Zestaw KPI', true, 'tool.kpiSet'),
      sec('thresholds', 'Thresholds & Alerts', 'Progi i alerty', true, 'tool.thresholds'),
      sec('ownership', 'Ownership Matrix', 'Macierz ownership', true, 'tool.ownership'),
      sec('cadence', 'Operating Cadence', 'Cadence operacyjny', true, 'tool.cadence'),
      sec('escalation', 'Escalation Rules', 'Reguły eskalacji', true, 'tool.escalation'),
    ],
    deckOutline: [
      slide('title', 'Control Tower', 'Control Tower', 'title', 'tool.meta'),
      slide('kpis', 'KPI Dashboard', 'Dashboard KPI', 'chart', 'tool.kpiSet'),
      slide('thresholds', 'Thresholds & Alerts', 'Progi i alerty', 'chart', 'tool.thresholds'),
      slide('ownership', 'Ownership Matrix', 'Macierz ownership', 'content', 'tool.ownership'),
      slide('cadence', 'Operating Cadence', 'Cadence operacyjny', 'content', 'tool.cadence'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'governance',
        'Implement control tower for ${area}',
        'Wdróż control tower dla ${area}',
        'tool.kpiSet'
      ),
      hint(
        'measurement',
        'Define thresholds for ${kpi}',
        'Zdefiniuj progi dla ${kpi}',
        'tool.thresholds'
      ),
    ],
  },

  'automation-pipeline': {
    sourceType: 'tool',
    sourceSlug: 'automation-pipeline',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('opportunity-scan', 'Opportunity Scan', 'Skan okazji', true, 'tool.opportunityScan'),
      sec('backlog', 'Automation Backlog', 'Backlog automatyzacji', true, 'tool.backlog'),
      sec('sizing', 'Sizing Rules', 'Reguły sizingu', true, 'tool.sizing'),
      sec('delivery', 'Delivery Checklist', 'Checklist delivery', true, 'tool.delivery'),
      sec('economics', 'Economics & ROI', 'Ekonomia i ROI', true, 'tool.economics'),
    ],
    deckOutline: [
      slide('title', 'Automation Pipeline', 'Pipeline automatyzacji', 'title', 'tool.meta'),
      slide('scan', 'Opportunity Scan', 'Skan okazji', 'chart', 'tool.opportunityScan'),
      slide('backlog', 'Automation Backlog', 'Backlog automatyzacji', 'content', 'tool.backlog'),
      slide(
        'sizing',
        'Sizing & Prioritization',
        'Sizing i priorytetyzacja',
        'chart',
        'tool.sizing'
      ),
      slide('economics', 'Economics & ROI', 'Ekonomia i ROI', 'chart', 'tool.economics'),
      slide('delivery', 'Delivery Checklist', 'Checklist delivery', 'content', 'tool.delivery'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'automation',
        'Automate ${process} (ROI: ${roi})',
        'Zautomatyzuj ${process} (ROI: ${roi})',
        'tool.backlog'
      ),
      hint(
        'automation',
        'Build automation capability for ${area}',
        'Zbuduj zdolność automatyzacji dla ${area}',
        'tool.delivery'
      ),
    ],
  },

  'smed-planner': {
    sourceType: 'tool',
    sourceSlug: 'smed-planner',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec(
        'current-changeover',
        'Current Changeover Analysis',
        'Analiza obecnego przezbrojenia',
        true,
        'tool.currentChangeover'
      ),
      sec(
        'step-classification',
        'Step Classification (Internal/External)',
        'Klasyfikacja kroków (internal/external)',
        true,
        'tool.stepClassification'
      ),
      sec('conversion-plan', 'Conversion Plan', 'Plan konwersji', true, 'tool.conversionPlan'),
      sec(
        'time-reduction',
        'Time Reduction Estimate',
        'Szacunek redukcji czasu',
        true,
        'tool.timeReduction'
      ),
      sec(
        'improvement-backlog',
        'Improvement Backlog',
        'Backlog usprawnień',
        true,
        'tool.improvementBacklog'
      ),
    ],
    deckOutline: [
      slide('title', 'SMED Planner', 'Planer SMED', 'title', 'tool.meta'),
      slide(
        'current',
        'Current Changeover',
        'Obecne przezbrojenie',
        'chart',
        'tool.currentChangeover'
      ),
      slide(
        'classification',
        'Step Classification',
        'Klasyfikacja kroków',
        'comparison',
        'tool.stepClassification'
      ),
      slide('conversion', 'Conversion Plan', 'Plan konwersji', 'content', 'tool.conversionPlan'),
      slide('reduction', 'Time Reduction', 'Redukcja czasu', 'chart', 'tool.timeReduction'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'lean',
        'Convert internal step to external: ${step}',
        'Konwertuj krok wewnętrzny na zewnętrzny: ${step}',
        'tool.conversionPlan'
      ),
      hint(
        'efficiency',
        'Reduce changeover time by ${percent}%',
        'Zredukuj czas przezbrojenia o ${percent}%',
        'tool.timeReduction'
      ),
    ],
  },

  'dms-builder': {
    sourceType: 'tool',
    sourceSlug: 'dms-builder',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec(
        'tier-cadence',
        'Tier Cadence Design',
        'Projekt cadence tierów',
        true,
        'tool.tierCadence'
      ),
      sec('kpi-board', 'KPI Board', 'Tablica KPI', true, 'tool.kpiBoard'),
      sec('escalation', 'Escalation Rules', 'Reguły eskalacji', true, 'tool.escalation'),
      sec('roles', 'Roles & Responsibilities', 'Role i odpowiedzialności', true, 'tool.roles'),
      sec(
        'visual-management',
        'Visual Management',
        'Zarządzanie wizualne',
        false,
        'tool.visualManagement'
      ),
    ],
    deckOutline: [
      slide(
        'title',
        'Daily Management System',
        'System zarządzania dziennego',
        'title',
        'tool.meta'
      ),
      slide('tiers', 'Tier Cadence', 'Cadence tierów', 'content', 'tool.tierCadence'),
      slide('kpis', 'KPI Board', 'Tablica KPI', 'chart', 'tool.kpiBoard'),
      slide('escalation', 'Escalation Rules', 'Reguły eskalacji', 'content', 'tool.escalation'),
      slide(
        'roles',
        'Roles & Responsibilities',
        'Role i odpowiedzialności',
        'content',
        'tool.roles'
      ),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint('governance', 'Implement DMS for ${area}', 'Wdróż DMS dla ${area}', 'tool.tierCadence'),
      hint(
        'measurement',
        'Deploy visual management at ${location}',
        'Wdróż zarządzanie wizualne w ${location}',
        'tool.visualManagement'
      ),
    ],
  },

  'inventory-autopilot': {
    sourceType: 'tool',
    sourceSlug: 'inventory-autopilot',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('sku-segmentation', 'SKU Segmentation', 'Segmentacja SKU', true, 'tool.skuSegmentation'),
      sec(
        'policy-table',
        'Replenishment Policy Table',
        'Tabela polityk uzupełnień',
        true,
        'tool.policyTable'
      ),
      sec('simulation', 'Simulation Assumptions', 'Założenia symulacji', true, 'tool.simulation'),
      sec(
        'tradeoffs',
        'Cash/Stockout Trade-offs',
        'Trade-offy cash/stockout',
        true,
        'tool.tradeoffs'
      ),
      sec('recommendations', 'Recommendations', 'Rekomendacje', true, 'tool.recommendations'),
    ],
    deckOutline: [
      slide('title', 'Inventory Autopilot', 'Autopilot zapasów', 'title', 'tool.meta'),
      slide('segmentation', 'SKU Segmentation', 'Segmentacja SKU', 'chart', 'tool.skuSegmentation'),
      slide(
        'policies',
        'Replenishment Policies',
        'Polityki uzupełnień',
        'content',
        'tool.policyTable'
      ),
      slide('tradeoffs', 'Cash vs Stockout', 'Cash vs stockout', 'chart', 'tool.tradeoffs'),
      slide(
        'recommendations',
        'Recommendations',
        'Rekomendacje',
        'content',
        'tool.recommendations'
      ),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'supply-chain',
        'Implement autopilot for ${segment} SKUs',
        'Wdróż autopilot dla SKU segmentu ${segment}',
        'tool.skuSegmentation'
      ),
      hint(
        'cost-reduction',
        'Optimize safety stock for ${segment}',
        'Zoptymalizuj zapas bezpieczeństwa dla ${segment}',
        'tool.policyTable'
      ),
    ],
  },

  'robotics-feasibility': {
    sourceType: 'tool',
    sourceSlug: 'robotics-feasibility',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec(
        'feasibility-score',
        'Feasibility Score',
        'Wynik wykonalności',
        true,
        'tool.feasibilityScore'
      ),
      sec(
        'prerequisites',
        'Prerequisites Assessment',
        'Ocena prerekwizytów',
        true,
        'tool.prerequisites'
      ),
      sec('roi-analysis', 'ROI Analysis', 'Analiza ROI', true, 'tool.roiAnalysis'),
      sec('risk-assessment', 'Risk Assessment', 'Ocena ryzyk', true, 'tool.riskAssessment'),
      sec('pilot-plan', 'Pilot Plan', 'Plan pilota', true, 'tool.pilotPlan'),
    ],
    deckOutline: [
      slide('title', 'Robotics Feasibility', 'Wykonalność robotyki', 'title', 'tool.meta'),
      slide('score', 'Feasibility Score', 'Wynik wykonalności', 'chart', 'tool.feasibilityScore'),
      slide('prerequisites', 'Prerequisites', 'Prerekwizyty', 'content', 'tool.prerequisites'),
      slide('roi', 'ROI Analysis', 'Analiza ROI', 'chart', 'tool.roiAnalysis'),
      slide('risks', 'Risk Assessment', 'Ocena ryzyk', 'chart', 'tool.riskAssessment'),
      slide('pilot', 'Pilot Plan', 'Plan pilota', 'content', 'tool.pilotPlan'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'automation',
        'Deploy robotics pilot for ${process}',
        'Wdróż pilota robotyki dla ${process}',
        'tool.pilotPlan'
      ),
      hint(
        'digital',
        'Address prerequisite: ${prerequisite}',
        'Zaadresuj prerekwizyt: ${prerequisite}',
        'tool.prerequisites'
      ),
    ],
  },

  'logistics-automation': {
    sourceType: 'tool',
    sourceSlug: 'logistics-automation',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec(
        'opportunity-map',
        'Automation Opportunity Map',
        'Mapa okazji automatyzacji',
        true,
        'tool.opportunityMap'
      ),
      sec('prerequisites', 'Prerequisites', 'Prerekwizyty', true, 'tool.prerequisites'),
      sec(
        'technology-options',
        'Technology Options',
        'Opcje technologiczne',
        true,
        'tool.technologyOptions'
      ),
      sec('economics', 'Economics & Payback', 'Ekonomia i payback', true, 'tool.economics'),
      sec('roadmap', 'Implementation Roadmap', 'Roadmapa wdrożenia', true, 'tool.roadmap'),
    ],
    deckOutline: [
      slide('title', 'Logistics Automation', 'Automatyzacja logistyki', 'title', 'tool.meta'),
      slide('opportunities', 'Opportunity Map', 'Mapa okazji', 'chart', 'tool.opportunityMap'),
      slide(
        'tech',
        'Technology Options',
        'Opcje technologiczne',
        'comparison',
        'tool.technologyOptions'
      ),
      slide('economics', 'Economics & Payback', 'Ekonomia i payback', 'chart', 'tool.economics'),
      slide('roadmap', 'Implementation Roadmap', 'Roadmapa wdrożenia', 'content', 'tool.roadmap'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'automation',
        'Automate ${area} logistics flow',
        'Zautomatyzuj przepływ logistyczny ${area}',
        'tool.opportunityMap'
      ),
      hint(
        'digital',
        'Deploy ${technology} in warehouse',
        'Wdróż ${technology} w magazynie',
        'tool.technologyOptions'
      ),
    ],
  },

  'rpa-scanner': {
    sourceType: 'tool',
    sourceSlug: 'rpa-scanner',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec(
        'candidate-list',
        'RPA Candidate List',
        'Lista kandydatów RPA',
        true,
        'tool.candidateList'
      ),
      sec(
        'suitability-scoring',
        'Suitability Scoring',
        'Scoring odpowiedniości',
        true,
        'tool.suitabilityScoring'
      ),
      sec(
        'complexity-assessment',
        'Complexity Assessment',
        'Ocena złożoności',
        true,
        'tool.complexityAssessment'
      ),
      sec(
        'prioritized-backlog',
        'Prioritized Backlog',
        'Priorytetyzowany backlog',
        true,
        'tool.prioritizedBacklog'
      ),
      sec(
        'economics',
        'Economics & FTE Savings',
        'Ekonomia i oszczędności FTE',
        true,
        'tool.economics'
      ),
    ],
    deckOutline: [
      slide('title', 'RPA Scanner', 'Skaner RPA', 'title', 'tool.meta'),
      slide('candidates', 'RPA Candidates', 'Kandydaci RPA', 'content', 'tool.candidateList'),
      slide(
        'scoring',
        'Suitability Scoring',
        'Scoring odpowiedniości',
        'chart',
        'tool.suitabilityScoring'
      ),
      slide(
        'backlog',
        'Prioritized Backlog',
        'Priorytetyzowany backlog',
        'content',
        'tool.prioritizedBacklog'
      ),
      slide(
        'economics',
        'Economics & FTE Savings',
        'Ekonomia i oszczędności FTE',
        'chart',
        'tool.economics'
      ),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'automation',
        'Implement RPA for ${process}',
        'Wdróż RPA dla ${process}',
        'tool.prioritizedBacklog'
      ),
      hint(
        'efficiency',
        'Save ${fteCount} FTE via ${process} automation',
        'Zaoszczędź ${fteCount} FTE przez automatyzację ${process}',
        'tool.economics'
      ),
    ],
  },

  'ai-discovery': {
    sourceType: 'tool',
    sourceSlug: 'ai-discovery',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec(
        'use-case-inventory',
        'AI Use-Case Inventory',
        "Inwentarz use-case'ów AI",
        true,
        'tool.useCaseInventory'
      ),
      sec('feasibility', 'Feasibility Assessment', 'Ocena wykonalności', true, 'tool.feasibility'),
      sec(
        'prerequisites',
        'Data & Infrastructure Prerequisites',
        'Prerekwizyty danych i infrastruktury',
        true,
        'tool.prerequisites'
      ),
      sec('risk-controls', 'Risk Controls', 'Kontrole ryzyk', true, 'tool.riskControls'),
      sec('pilot-plan', 'Pilot Plan', 'Plan pilota', true, 'tool.pilotPlan'),
      sec('economics', 'Value Estimation', 'Szacunek wartości', true, 'tool.economics'),
    ],
    deckOutline: [
      slide('title', 'AI Discovery', 'Odkrywanie AI', 'title', 'tool.meta'),
      slide(
        'use-cases',
        'AI Use-Case Shortlist',
        "Shortlista use-case'ów AI",
        'content',
        'tool.useCaseInventory'
      ),
      slide(
        'feasibility',
        'Feasibility Matrix',
        'Macierz wykonalności',
        'chart',
        'tool.feasibility'
      ),
      slide('prerequisites', 'Prerequisites', 'Prerekwizyty', 'content', 'tool.prerequisites'),
      slide('risks', 'Risk Controls', 'Kontrole ryzyk', 'content', 'tool.riskControls'),
      slide('pilot', 'Pilot Plan', 'Plan pilota', 'content', 'tool.pilotPlan'),
      slide('economics', 'Value Estimation', 'Szacunek wartości', 'chart', 'tool.economics'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'ai',
        'Pilot AI use-case: ${useCase}',
        'Pilotuj use-case AI: ${useCase}',
        'tool.useCaseInventory'
      ),
      hint(
        'data',
        'Build data foundation for ${useCase}',
        'Zbuduj fundament danych dla ${useCase}',
        'tool.prerequisites'
      ),
    ],
  },

  'integration-diagnostic': {
    sourceType: 'tool',
    sourceSlug: 'integration-diagnostic',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec(
        'integration-map',
        'Integration Landscape Map',
        'Mapa krajobrazu integracji',
        true,
        'tool.integrationMap'
      ),
      sec(
        'debt-assessment',
        'Integration Debt Assessment',
        'Ocena długu integracyjnego',
        true,
        'tool.debtAssessment'
      ),
      sec('risk-hotspots', 'Risk Hotspots', 'Hotspoty ryzyk', true, 'tool.riskHotspots'),
      sec(
        'architecture-roadmap',
        'Architecture Remediation Roadmap',
        'Roadmapa naprawy architektury',
        true,
        'tool.architectureRoadmap'
      ),
      sec(
        'priority-actions',
        'Priority Actions',
        'Priorytetowe akcje',
        true,
        'tool.priorityActions'
      ),
    ],
    deckOutline: [
      slide('title', 'Integration Diagnostic', 'Diagnostyka integracji', 'title', 'tool.meta'),
      slide('map', 'Integration Landscape', 'Krajobraz integracji', 'chart', 'tool.integrationMap'),
      slide('debt', 'Integration Debt', 'Dług integracyjny', 'chart', 'tool.debtAssessment'),
      slide('risks', 'Risk Hotspots', 'Hotspoty ryzyk', 'chart', 'tool.riskHotspots'),
      slide(
        'roadmap',
        'Remediation Roadmap',
        'Roadmapa naprawy',
        'content',
        'tool.architectureRoadmap'
      ),
      slide('actions', 'Priority Actions', 'Priorytetowe akcje', 'content', 'tool.priorityActions'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'architecture',
        'Remediate integration at ${system}',
        'Napraw integrację w ${system}',
        'tool.architectureRoadmap'
      ),
      hint(
        'risk',
        'Address integration risk: ${risk}',
        'Zaadresuj ryzyko integracji: ${risk}',
        'tool.riskHotspots'
      ),
    ],
  },

  'digital-value-pool': {
    sourceType: 'tool',
    sourceSlug: 'digital-value-pool',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('value-pool-map', 'Value Pool Map', 'Mapa pul wartości', true, 'tool.valuePoolMap'),
      sec(
        'economic-levers',
        'Economic Levers',
        'Dźwignie ekonomiczne',
        true,
        'tool.economicLevers'
      ),
      sec('digital-enablers', 'Digital Enablers', 'Enablery cyfrowe', true, 'tool.digitalEnablers'),
      sec(
        'initiative-shortlist',
        'Initiative Shortlist',
        'Shortlista inicjatyw',
        true,
        'tool.initiativeShortlist'
      ),
      sec('economics', 'Value Sizing', 'Sizing wartości', true, 'tool.economics'),
    ],
    deckOutline: [
      slide('title', 'Digital Value Pool', 'Cyfrowa pula wartości', 'title', 'tool.meta'),
      slide('map', 'Value Pool Map', 'Mapa pul wartości', 'chart', 'tool.valuePoolMap'),
      slide('levers', 'Economic Levers', 'Dźwignie ekonomiczne', 'content', 'tool.economicLevers'),
      slide('enablers', 'Digital Enablers', 'Enablery cyfrowe', 'content', 'tool.digitalEnablers'),
      slide(
        'initiatives',
        'Initiative Shortlist',
        'Shortlista inicjatyw',
        'content',
        'tool.initiativeShortlist'
      ),
      slide('economics', 'Value Sizing', 'Sizing wartości', 'chart', 'tool.economics'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'digital',
        'Capture digital value in ${pool}',
        'Uchwyć wartość cyfrową w ${pool}',
        'tool.valuePoolMap'
      ),
      hint(
        'economics',
        'Activate economic lever: ${lever}',
        'Aktywuj dźwignię ekonomiczną: ${lever}',
        'tool.economicLevers'
      ),
    ],
  },

  'legacy-analyzer': {
    sourceType: 'tool',
    sourceSlug: 'legacy-analyzer',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec(
        'legacy-scorecard',
        'Legacy Drag Scorecard',
        'Scorecard obciążenia legacy',
        true,
        'tool.legacyScorecard'
      ),
      sec('risk-heatmap', 'Risk Heatmap', 'Heatmapa ryzyk', true, 'tool.riskHeatmap'),
      sec('cost-analysis', 'Cost of Legacy', 'Koszt legacy', true, 'tool.costAnalysis'),
      sec(
        'modernization-options',
        'Modernization Options',
        'Opcje modernizacji',
        true,
        'tool.modernizationOptions'
      ),
      sec(
        'modernization-backlog',
        'Modernization Backlog',
        'Backlog modernizacji',
        true,
        'tool.modernizationBacklog'
      ),
    ],
    deckOutline: [
      slide('title', 'Legacy Analyzer', 'Analizator legacy', 'title', 'tool.meta'),
      slide(
        'scorecard',
        'Legacy Drag Scorecard',
        'Scorecard obciążenia legacy',
        'chart',
        'tool.legacyScorecard'
      ),
      slide('heatmap', 'Risk Heatmap', 'Heatmapa ryzyk', 'chart', 'tool.riskHeatmap'),
      slide('cost', 'Cost of Legacy', 'Koszt legacy', 'chart', 'tool.costAnalysis'),
      slide(
        'options',
        'Modernization Options',
        'Opcje modernizacji',
        'comparison',
        'tool.modernizationOptions'
      ),
      slide(
        'backlog',
        'Modernization Backlog',
        'Backlog modernizacji',
        'content',
        'tool.modernizationBacklog'
      ),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'modernization',
        'Modernize ${system} (strategy: ${strategy})',
        'Zmodernizuj ${system} (strategia: ${strategy})',
        'tool.modernizationBacklog'
      ),
      hint(
        'risk',
        'Mitigate legacy risk at ${system}',
        'Zmitiguj ryzyko legacy w ${system}',
        'tool.riskHeatmap'
      ),
    ],
  },

  'data-inventory': {
    sourceType: 'tool',
    sourceSlug: 'data-inventory',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec(
        'decision-data-map',
        'Decision→Data Map',
        'Mapa decyzja→dane',
        true,
        'tool.decisionDataMap'
      ),
      sec('gap-register', 'Data Gap Register', 'Rejestr luk danych', true, 'tool.gapRegister'),
      sec(
        'quality-assessment',
        'Data Quality Assessment',
        'Ocena jakości danych',
        true,
        'tool.qualityAssessment'
      ),
      sec(
        'data-initiative-backlog',
        'Data Initiative Backlog',
        'Backlog inicjatyw danych',
        true,
        'tool.dataInitiativeBacklog'
      ),
      sec(
        'governance-needs',
        'Governance Needs',
        'Potrzeby governance',
        false,
        'tool.governanceNeeds'
      ),
    ],
    deckOutline: [
      slide('title', 'Data Inventory', 'Inwentarz danych', 'title', 'tool.meta'),
      slide('map', 'Decision→Data Map', 'Mapa decyzja→dane', 'chart', 'tool.decisionDataMap'),
      slide('gaps', 'Data Gaps', 'Luki danych', 'chart', 'tool.gapRegister'),
      slide('quality', 'Data Quality', 'Jakość danych', 'chart', 'tool.qualityAssessment'),
      slide(
        'backlog',
        'Data Initiative Backlog',
        'Backlog inicjatyw danych',
        'content',
        'tool.dataInitiativeBacklog'
      ),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'data',
        'Close data gap for ${decision}',
        'Zamknij lukę danych dla ${decision}',
        'tool.gapRegister'
      ),
      hint(
        'data',
        'Improve data quality in ${domain}',
        'Popraw jakość danych w ${domain}',
        'tool.qualityAssessment'
      ),
    ],
  },

  'pain-to-solution': {
    sourceType: 'tool',
    sourceSlug: 'pain-to-solution',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('pain-inventory', 'Pain Inventory', 'Inwentarz bólów', true, 'tool.painInventory'),
      sec(
        'archetype-mapping',
        'Pain→Archetype Mapping',
        'Mapowanie ból→archetyp',
        true,
        'tool.archetypeMapping'
      ),
      sec(
        'solution-backlog',
        'Solution Backlog',
        'Backlog rozwiązań',
        true,
        'tool.solutionBacklog'
      ),
      sec('feasibility', 'Feasibility Notes', 'Notatki wykonalności', true, 'tool.feasibility'),
      sec('prioritization', 'Prioritization', 'Priorytetyzacja', true, 'tool.prioritization'),
    ],
    deckOutline: [
      slide('title', 'Pain-to-Solution Mapper', 'Mapper ból→rozwiązanie', 'title', 'tool.meta'),
      slide('pains', 'Pain Inventory', 'Inwentarz bólów', 'content', 'tool.painInventory'),
      slide('mapping', 'Pain→Archetype Map', 'Mapa ból→archetyp', 'chart', 'tool.archetypeMapping'),
      slide(
        'solutions',
        'Solution Backlog',
        'Backlog rozwiązań',
        'content',
        'tool.solutionBacklog'
      ),
      slide(
        'feasibility',
        'Feasibility Assessment',
        'Ocena wykonalności',
        'chart',
        'tool.feasibility'
      ),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'solutions',
        'Implement ${solution} for ${pain}',
        'Wdróż ${solution} dla ${pain}',
        'tool.solutionBacklog'
      ),
      hint(
        'discovery',
        'Validate feasibility of ${solution}',
        'Zwaliduj wykonalność ${solution}',
        'tool.feasibility'
      ),
    ],
  },

  'pain-explorer': {
    sourceType: 'tool',
    sourceSlug: 'pain-explorer',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('raw-pains', 'Raw Pain Collection', 'Surowa kolekcja bólów', true, 'tool.rawPains'),
      sec(
        'structured-problems',
        'Structured Problem List',
        'Lista ustrukturyzowanych problemów',
        true,
        'tool.structuredProblems'
      ),
      sec('hypotheses', 'Hypotheses', 'Hipotezy', true, 'tool.hypotheses'),
      sec('evidence-gaps', 'Evidence Gaps', 'Luki w evidence', true, 'tool.evidenceGaps'),
      sec(
        'priority-problems',
        'Priority Problems',
        'Priorytetowe problemy',
        true,
        'tool.priorityProblems'
      ),
    ],
    deckOutline: [
      slide('title', 'Pain Explorer', 'Eksplorator bólów', 'title', 'tool.meta'),
      slide('pains', 'Pain Landscape', 'Krajobraz bólów', 'chart', 'tool.rawPains'),
      slide(
        'problems',
        'Structured Problems',
        'Ustrukturyzowane problemy',
        'content',
        'tool.structuredProblems'
      ),
      slide('hypotheses', 'Hypotheses', 'Hipotezy', 'content', 'tool.hypotheses'),
      slide('gaps', 'Evidence Gaps', 'Luki w evidence', 'content', 'tool.evidenceGaps'),
      slide(
        'priorities',
        'Priority Problems',
        'Priorytetowe problemy',
        'content',
        'tool.priorityProblems'
      ),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint('discovery', 'Investigate: ${problem}', 'Zbadaj: ${problem}', 'tool.structuredProblems'),
      hint(
        'validation',
        'Validate hypothesis: ${hypothesis}',
        'Zwaliduj hipotezę: ${hypothesis}',
        'tool.hypotheses'
      ),
    ],
  },

  'process-automation': {
    sourceType: 'tool',
    sourceSlug: 'process-automation',
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'tool.summary'),
      sec('process-map', 'Process Map', 'Mapa procesu', true, 'tool.processMap'),
      sec('baseline', 'Baseline Measurement', 'Pomiar baseline', true, 'tool.baseline'),
      sec(
        'target-design',
        'Target Process Design',
        'Projekt procesu docelowego',
        true,
        'tool.targetDesign'
      ),
      sec(
        'automation-spec',
        'Automation Specification',
        'Specyfikacja automatyzacji',
        true,
        'tool.automationSpec'
      ),
      sec('economics', 'Economics & Payback', 'Ekonomia i payback', true, 'tool.economics'),
      sec('initiative-set', 'Initiative Set', 'Zestaw inicjatyw', true, 'tool.initiativeSet'),
      sec('risk-assessment', 'Risk Assessment', 'Ocena ryzyk', false, 'tool.riskAssessment'),
    ],
    deckOutline: [
      slide('title', 'Process Automation', 'Automatyzacja procesu', 'title', 'tool.meta'),
      slide('process', 'Process Map', 'Mapa procesu', 'chart', 'tool.processMap'),
      slide(
        'baseline-target',
        'Baseline vs Target',
        'Baseline vs target',
        'comparison',
        'tool.baseline,tool.targetDesign'
      ),
      slide(
        'automation',
        'Automation Specification',
        'Specyfikacja automatyzacji',
        'content',
        'tool.automationSpec'
      ),
      slide('economics', 'Economics & Payback', 'Ekonomia i payback', 'chart', 'tool.economics'),
      slide('initiatives', 'Initiative Set', 'Zestaw inicjatyw', 'content', 'tool.initiativeSet'),
      slide('risks', 'Risk Assessment', 'Ocena ryzyk', 'content', 'tool.riskAssessment'),
      slide('next', 'Next Steps', 'Następne kroki', 'summary', 'tool.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'automation',
        'Automate ${processStep} (payback: ${months}m)',
        'Zautomatyzuj ${processStep} (payback: ${months}m)',
        'tool.economics'
      ),
      hint(
        'process-improvement',
        'Redesign ${processStep} before automation',
        'Przeprojektuj ${processStep} przed automatyzacją',
        'tool.targetDesign'
      ),
    ],
  },
};

// ---------------------------------------------------------------------------
// Assessment scaffolds (3)
// ---------------------------------------------------------------------------

const ASSESSMENT_SCAFFOLDS: Record<string, OutputScaffoldDefinition> = {
  DRD: {
    sourceType: 'assessment',
    sourceSlug: 'DRD',
    reportOutline: [
      sec(
        'exec-summary',
        'Executive Summary',
        'Podsumowanie wykonawcze',
        true,
        'assessment.summary'
      ),
      sec(
        'methodology',
        'Assessment Methodology',
        'Metodologia oceny',
        true,
        'assessment.methodology'
      ),
      sec(
        'dimension-scores',
        'Dimension Scores',
        'Wyniki wymiarów',
        true,
        'assessment.dimensionScores'
      ),
      sec(
        'maturity-profile',
        'Maturity Profile',
        'Profil dojrzałości',
        true,
        'assessment.maturityProfile'
      ),
      sec('gap-analysis', 'Gap Analysis', 'Analiza luk', true, 'assessment.gapAnalysis'),
      sec(
        'benchmark',
        'Benchmark Comparison',
        'Porównanie z benchmarkiem',
        false,
        'assessment.benchmark'
      ),
      sec('recommendations', 'Recommendations', 'Rekomendacje', true, 'assessment.recommendations'),
      sec(
        'roadmap',
        'Transformation Roadmap',
        'Roadmapa transformacji',
        true,
        'assessment.roadmap'
      ),
    ],
    deckOutline: [
      slide(
        'title',
        'Digital Readiness Diagnosis',
        'Diagnoza gotowości cyfrowej',
        'title',
        'assessment.meta'
      ),
      slide('methodology', 'Methodology', 'Metodologia', 'content', 'assessment.methodology'),
      slide('radar', 'Maturity Radar', 'Radar dojrzałości', 'chart', 'assessment.dimensionScores'),
      slide(
        'profile',
        'Maturity Profile',
        'Profil dojrzałości',
        'chart',
        'assessment.maturityProfile'
      ),
      slide('gaps', 'Gap Analysis', 'Analiza luk', 'chart', 'assessment.gapAnalysis'),
      slide(
        'benchmark',
        'Benchmark Comparison',
        'Porównanie z benchmarkiem',
        'comparison',
        'assessment.benchmark'
      ),
      slide(
        'recommendations',
        'Recommendations',
        'Rekomendacje',
        'content',
        'assessment.recommendations'
      ),
      slide(
        'roadmap',
        'Transformation Roadmap',
        'Roadmapa transformacji',
        'content',
        'assessment.roadmap'
      ),
    ],
    initiativeHints: [
      hint(
        'digital',
        'Improve ${dimension} from ${current} to ${target}',
        'Popraw ${dimension} z ${current} do ${target}',
        'assessment.gapAnalysis'
      ),
      hint(
        'transformation',
        'Address gap in ${dimension}',
        'Zaadresuj lukę w ${dimension}',
        'assessment.gapAnalysis'
      ),
    ],
  },

  SIRI: {
    sourceType: 'assessment',
    sourceSlug: 'SIRI',
    reportOutline: [
      sec(
        'exec-summary',
        'Executive Summary',
        'Podsumowanie wykonawcze',
        true,
        'assessment.summary'
      ),
      sec('methodology', 'SIRI Methodology', 'Metodologia SIRI', true, 'assessment.methodology'),
      sec(
        'building-blocks',
        'Building Blocks Assessment',
        'Ocena bloków budulcowych',
        true,
        'assessment.buildingBlocks'
      ),
      sec(
        'dimension-scores',
        'Dimension Scores',
        'Wyniki wymiarów',
        true,
        'assessment.dimensionScores'
      ),
      sec(
        'band-classification',
        'Band Classification',
        'Klasyfikacja pasma',
        true,
        'assessment.bandClassification'
      ),
      sec('gap-analysis', 'Gap Analysis', 'Analiza luk', true, 'assessment.gapAnalysis'),
      sec(
        'prioritization',
        'Prioritization Matrix',
        'Macierz priorytetyzacji',
        true,
        'assessment.prioritization'
      ),
      sec('roadmap', 'Industry 4.0 Roadmap', 'Roadmapa Industry 4.0', true, 'assessment.roadmap'),
    ],
    deckOutline: [
      slide(
        'title',
        'Smart Industry Readiness Index',
        'Indeks gotowości Smart Industry',
        'title',
        'assessment.meta'
      ),
      slide(
        'methodology',
        'SIRI Methodology',
        'Metodologia SIRI',
        'content',
        'assessment.methodology'
      ),
      slide('blocks', 'Building Blocks', 'Bloki budulcowe', 'chart', 'assessment.buildingBlocks'),
      slide('radar', 'Dimension Radar', 'Radar wymiarów', 'chart', 'assessment.dimensionScores'),
      slide(
        'band',
        'Band Classification',
        'Klasyfikacja pasma',
        'chart',
        'assessment.bandClassification'
      ),
      slide('gaps', 'Gap Analysis', 'Analiza luk', 'chart', 'assessment.gapAnalysis'),
      slide(
        'priorities',
        'Prioritization Matrix',
        'Macierz priorytetyzacji',
        'chart',
        'assessment.prioritization'
      ),
      slide(
        'roadmap',
        'Industry 4.0 Roadmap',
        'Roadmapa Industry 4.0',
        'content',
        'assessment.roadmap'
      ),
    ],
    initiativeHints: [
      hint(
        'industry4.0',
        'Advance ${dimension} to band ${targetBand}',
        'Podnieś ${dimension} do pasma ${targetBand}',
        'assessment.gapAnalysis'
      ),
      hint(
        'technology',
        'Deploy ${technology} for ${dimension}',
        'Wdróż ${technology} dla ${dimension}',
        'assessment.prioritization'
      ),
    ],
  },

  ADMA: {
    sourceType: 'assessment',
    sourceSlug: 'ADMA',
    reportOutline: [
      sec(
        'exec-summary',
        'Executive Summary',
        'Podsumowanie wykonawcze',
        true,
        'assessment.summary'
      ),
      sec('methodology', 'ADMA Methodology', 'Metodologia ADMA', true, 'assessment.methodology'),
      sec('pillar-scores', 'Pillar Scores', 'Wyniki filarów', true, 'assessment.pillarScores'),
      sec(
        'dimension-detail',
        'Dimension Detail',
        'Szczegóły wymiarów',
        true,
        'assessment.dimensionDetail'
      ),
      sec(
        'maturity-level',
        'Overall Maturity Level',
        'Ogólny poziom dojrzałości',
        true,
        'assessment.maturityLevel'
      ),
      sec('gap-analysis', 'Gap Analysis', 'Analiza luk', true, 'assessment.gapAnalysis'),
      sec('recommendations', 'Recommendations', 'Rekomendacje', true, 'assessment.recommendations'),
      sec('action-plan', 'Action Plan', 'Plan działań', true, 'assessment.actionPlan'),
    ],
    deckOutline: [
      slide(
        'title',
        'Advanced Digital Maturity Assessment',
        'Zaawansowana ocena dojrzałości cyfrowej',
        'title',
        'assessment.meta'
      ),
      slide(
        'methodology',
        'ADMA Methodology',
        'Metodologia ADMA',
        'content',
        'assessment.methodology'
      ),
      slide('pillars', 'Pillar Scores', 'Wyniki filarów', 'chart', 'assessment.pillarScores'),
      slide(
        'dimensions',
        'Dimension Detail',
        'Szczegóły wymiarów',
        'chart',
        'assessment.dimensionDetail'
      ),
      slide(
        'maturity',
        'Overall Maturity',
        'Ogólna dojrzałość',
        'chart',
        'assessment.maturityLevel'
      ),
      slide('gaps', 'Gap Analysis', 'Analiza luk', 'chart', 'assessment.gapAnalysis'),
      slide(
        'recommendations',
        'Recommendations',
        'Rekomendacje',
        'content',
        'assessment.recommendations'
      ),
      slide('action-plan', 'Action Plan', 'Plan działań', 'content', 'assessment.actionPlan'),
    ],
    initiativeHints: [
      hint(
        'digital',
        'Improve ${pillar} maturity from ${current} to ${target}',
        'Popraw dojrzałość ${pillar} z ${current} do ${target}',
        'assessment.gapAnalysis'
      ),
      hint(
        'transformation',
        'Implement recommendation for ${dimension}',
        'Wdróż rekomendację dla ${dimension}',
        'assessment.recommendations'
      ),
    ],
  },
};

// ---------------------------------------------------------------------------
// Generic template fallback scaffold
// ---------------------------------------------------------------------------

function buildGenericTemplateScaffold(slug: string): OutputScaffold {
  return withStandardOutputs({
    sourceType: 'template',
    sourceSlug: slug,
    reportOutline: [
      sec('exec-summary', 'Executive Summary', 'Podsumowanie wykonawcze', true, 'template.summary'),
      sec('context', 'Context & Objectives', 'Kontekst i cele', true, 'template.context'),
      sec('analysis', 'Analysis', 'Analiza', true, 'template.analysis'),
      sec('findings', 'Key Findings', 'Kluczowe wnioski', true, 'template.findings'),
      sec('recommendations', 'Recommendations', 'Rekomendacje', true, 'template.recommendations'),
      sec('next-steps', 'Next Steps', 'Następne kroki', true, 'template.nextSteps'),
    ],
    deckOutline: [
      slide('title', 'Analysis Overview', 'Przegląd analizy', 'title', 'template.meta'),
      slide('context', 'Context & Objectives', 'Kontekst i cele', 'content', 'template.context'),
      slide('analysis', 'Analysis', 'Analiza', 'chart', 'template.analysis'),
      slide('findings', 'Key Findings', 'Kluczowe wnioski', 'content', 'template.findings'),
      slide(
        'recommendations',
        'Recommendations',
        'Rekomendacje',
        'content',
        'template.recommendations'
      ),
      slide('next-steps', 'Next Steps', 'Następne kroki', 'summary', 'template.nextSteps'),
    ],
    initiativeHints: [
      hint(
        'general',
        'Implement recommendation: ${recommendation}',
        'Wdróż rekomendację: ${recommendation}',
        'template.recommendations'
      ),
    ],
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getOutputScaffold(sourceType: string, sourceSlug: string): OutputScaffold | null {
  switch (sourceType) {
    case 'tool':
      return TOOL_SCAFFOLDS[sourceSlug] ? withStandardOutputs(TOOL_SCAFFOLDS[sourceSlug]) : null;
    case 'assessment':
      return ASSESSMENT_SCAFFOLDS[sourceSlug]
        ? withStandardOutputs(ASSESSMENT_SCAFFOLDS[sourceSlug])
        : null;
    case 'template':
      return buildGenericTemplateScaffold(sourceSlug);
    default:
      return null;
  }
}

export function getReportOutlineForTool(toolType: string): ReportSection[] {
  return TOOL_SCAFFOLDS[toolType]?.reportOutline ?? [];
}

export function getDeckOutlineForTool(toolType: string): DeckSlide[] {
  return TOOL_SCAFFOLDS[toolType]?.deckOutline ?? [];
}

export function getAllToolScaffolds(): Record<string, OutputScaffold> {
  return Object.fromEntries(
    Object.entries(TOOL_SCAFFOLDS).map(([slug, scaffold]) => [slug, withStandardOutputs(scaffold)])
  );
}

export function getAllAssessmentScaffolds(): Record<string, OutputScaffold> {
  return Object.fromEntries(
    Object.entries(ASSESSMENT_SCAFFOLDS).map(([slug, scaffold]) => [
      slug,
      withStandardOutputs(scaffold),
    ])
  );
}

export { ASSESSMENT_SCAFFOLDS, TOOL_SCAFFOLDS };
