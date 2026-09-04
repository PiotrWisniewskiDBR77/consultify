import type {
  GrowthPathsData,
  OperationalToolData,
  PorterData,
  PortfolioPriorityData,
  ProposalStatus,
  RiskUncertaintyData,
  SWOTData,
  SWOTOutputReadiness,
  ToolType,
} from '@/store/useToolStore';
import {
  dynamicSwotPack,
  getDynamicSwotPackForCurrentFlags,
} from '@/toolPacks/packs/dynamicSwot.pack';

export type ToolCompletionItem = { label: string; done: boolean; anchorId?: string };
export type DynamicSwotPhaseSummary = {
  id: 'mission' | 'input' | 'swot' | 'insights' | 'recommendations' | 'outputs' | 'review';
  label: string;
  done: boolean;
  gapCount: number;
  readiness: 'blocked' | 'needs-work' | 'ready';
  primaryGap?: string;
};

const readinessRank = {
  blocked: 0,
  'needs-work': 1,
  ready: 2,
} as const;

const isGovernedAccepted = (proposalStatus?: ProposalStatus) =>
  proposalStatus !== 'ai-proposed' &&
  proposalStatus !== 'rethinking' &&
  proposalStatus !== 'rejected';

export function computeDynamicSwotSessionSignals(data: SWOTData | undefined, isPolish: boolean) {
  const swot = data;
  const signals = swot?.signals || [];
  const items = swot?.items || [];
  const tensions = swot?.tensions || [];
  const moves = swot?.recommendedMoves || [];
  const outputs = swot?.outputCandidates || [];
  const acceptedTensions = tensions.filter((item) => isGovernedAccepted(item.proposalStatus));
  const acceptedMoves = moves.filter((item) => isGovernedAccepted(item.proposalStatus));
  const acceptedOutputs = outputs.filter((item) => isGovernedAccepted(item.proposalStatus));
  const proposedSignals = signals.filter((signal) => signal.state === 'proposed').length;
  const needsEvidenceSignals = signals.filter((signal) => signal.state === 'needs-evidence').length;
  const proposedItems = items.filter((item) => item.status === 'proposed').length;
  const acceptedItems = items.filter((item) => item.status !== 'proposed').length;
  const readyOutputs = acceptedOutputs.filter((output) =>
    ['ready-for-initiative', 'ready-for-presentation', 'ready-for-report'].includes(
      output.readiness || 'keep-as-idea'
    )
  ).length;

  const missingEvidence = [];
  if (!swot?.context?.goal)
    missingEvidence.push(isPolish ? 'Brak pytania strategicznego' : 'Missing decision question');
  if (!signals.length)
    missingEvidence.push(isPolish ? 'Brak sygnałów wejściowych' : 'Missing input signals');
  if (!items.length) missingEvidence.push(isPolish ? 'Brak kart SWOT' : 'Missing SWOT cards');
  if (
    !acceptedTensions.length &&
    !(swot?.correlations || []).some((item) => isGovernedAccepted(item.proposalStatus))
  )
    missingEvidence.push(
      isPolish ? 'Brak napięć lub korelacji' : 'Missing tensions or correlations'
    );
  if (!acceptedMoves.length)
    missingEvidence.push(isPolish ? 'Brak rekomendowanych ruchów' : 'Missing recommended moves');

  return {
    proposedSignals,
    needsEvidenceSignals,
    proposedItems,
    acceptedItems,
    tensions: tensions.length,
    moves: moves.length,
    readyOutputs,
    missingEvidence,
  };
}

export function computeDynamicSwotPhaseSummaries(
  data: SWOTData | undefined,
  isPolish: boolean
): DynamicSwotPhaseSummary[] {
  const swot = data;
  const quadrants = {
    strengths: swot?.items?.filter((item) => item.quadrant === 'strengths').length || 0,
    weaknesses: swot?.items?.filter((item) => item.quadrant === 'weaknesses').length || 0,
    opportunities: swot?.items?.filter((item) => item.quadrant === 'opportunities').length || 0,
    threats: swot?.items?.filter((item) => item.quadrant === 'threats').length || 0,
  };

  const acceptedCorrelations =
    swot?.correlations?.filter((item) => isGovernedAccepted(item.proposalStatus)).length || 0;
  const acceptedTensions =
    swot?.tensions?.filter((item) => isGovernedAccepted(item.proposalStatus)).length || 0;
  const acceptedMoves =
    swot?.recommendedMoves?.filter((item) => isGovernedAccepted(item.proposalStatus)).length || 0;
  const acceptedOutputs =
    swot?.outputCandidates?.filter((item) => isGovernedAccepted(item.proposalStatus)).length || 0;
  const acceptedSummary =
    !!swot?.summary?.executiveSummary && isGovernedAccepted(swot?.summary?.proposalStatus);

  const summaries: Array<Omit<DynamicSwotPhaseSummary, 'readiness'>> = [
    {
      id: 'mission',
      label: isPolish ? 'Misja i kontekst' : 'Mission & Context',
      done: !!swot?.context?.goal && !!swot?.context?.scope && !!swot?.context?.successSignal,
      gapCount: [!swot?.context?.goal, !swot?.context?.scope, !swot?.context?.successSignal].filter(
        Boolean
      ).length,
      primaryGap: !swot?.context?.goal
        ? isPolish
          ? 'Doprecyzuj pytanie decyzyjne'
          : 'Sharpen the decision question'
        : !swot?.context?.scope
          ? isPolish
            ? 'Ustal zakres analizy'
            : 'Define the scope'
          : !swot?.context?.successSignal
            ? isPolish
              ? 'Zapisz sygnał sukcesu'
              : 'Define the success signal'
            : undefined,
    },
    {
      id: 'input',
      label: isPolish ? 'Wejście i eksploracja' : 'Input & Exploration',
      done: (swot?.signals?.length || 0) >= 3,
      gapCount: (swot?.signals?.length || 0) >= 3 ? 0 : 3 - (swot?.signals?.length || 0),
      primaryGap:
        (swot?.signals?.length || 0) >= 3
          ? undefined
          : isPolish
            ? 'Dodaj więcej dowodów wejściowych'
            : 'Add more input evidence',
    },
    {
      id: 'swot',
      label: isPolish ? 'Budowa SWOT' : 'SWOT Build',
      done: Object.values(quadrants).every((count) => count > 0),
      gapCount: Object.values(quadrants).filter((count) => count === 0).length,
      primaryGap: Object.values(quadrants).every((count) => count > 0)
        ? undefined
        : isPolish
          ? 'Uzupełnij brakujące ćwiartki macierzy'
          : 'Fill the missing matrix quadrants',
    },
    {
      id: 'insights',
      label: isPolish ? 'Synteza i napięcia' : 'Synthesis & Insights',
      done:
        (acceptedTensions > 0 || acceptedCorrelations > 0) &&
        (acceptedMoves > 0 || acceptedSummary),
      gapCount: [
        !(acceptedTensions > 0 || acceptedCorrelations > 0),
        !(acceptedMoves > 0 || acceptedSummary),
      ].filter(Boolean).length,
      primaryGap:
        acceptedTensions === 0 && acceptedCorrelations === 0
          ? isPolish
            ? 'Wygeneruj napięcia strategiczne'
            : 'Generate strategic tensions'
          : acceptedMoves === 0
            ? isPolish
              ? 'Przełóż analizę na ruchy'
              : 'Translate analysis into moves'
            : undefined,
    },
    {
      id: 'outputs',
      label: isPolish ? 'Wyniki i działania' : 'Outputs & Actions',
      done: acceptedSummary && acceptedOutputs > 0,
      gapCount: [!acceptedSummary, !(acceptedOutputs > 0)].filter(Boolean).length,
      primaryGap: !acceptedSummary
        ? isPolish
          ? 'Przygotuj końcowe podsumowanie źródeł'
          : 'Prepare the final source summary'
        : acceptedOutputs === 0
          ? isPolish
            ? 'Określ ścieżki outputów'
            : 'Define the output routes'
          : undefined,
    },
  ];

  const activePack = getDynamicSwotPackForCurrentFlags();
  if (activePack !== dynamicSwotPack) {
    const recommendations = activePack.phases.find((phase) => phase.id === 'recommendations');
    const review = activePack.phases.find((phase) => phase.id === 'review');
    const outputsIndex = summaries.findIndex((summary) => summary.id === 'outputs');
    summaries.splice(outputsIndex, 0, {
      id: 'recommendations',
      label: recommendations?.title[isPolish ? 'pl' : 'en'] || 'Recommendations',
      done: acceptedMoves > 0,
      gapCount: acceptedMoves > 0 ? 0 : 1,
      primaryGap:
        acceptedMoves > 0
          ? undefined
          : isPolish
            ? 'Zatwierdź kierunek i alternatywy'
            : 'Approve a direction and alternatives',
    });
    summaries.push({
      id: 'review',
      label: review?.title[isPolish ? 'pl' : 'en'] || 'Review',
      done: acceptedSummary && acceptedOutputs > 0,
      gapCount: [!acceptedSummary, !(acceptedOutputs > 0)].filter(Boolean).length,
      primaryGap:
        acceptedSummary && acceptedOutputs > 0
          ? undefined
          : isPolish
            ? 'Zatwierdź albo zwróć wynik z komentarzem'
            : 'Approve or return the result with a comment',
    });
  }

  return summaries.map((summary) => ({
    ...summary,
    readiness: summary.done ? 'ready' : summary.gapCount > 1 ? 'blocked' : 'needs-work',
  }));
}

export function computeDynamicSwotOverallReadiness(
  data: SWOTData | undefined,
  isPolish: boolean
): {
  label: string;
  readiness: 'blocked' | 'needs-work' | 'ready';
  readyRoutes: SWOTOutputReadiness[];
} {
  const summaries = computeDynamicSwotPhaseSummaries(data, isPolish);
  const outputs = data?.outputCandidates || [];
  const readiness = summaries.reduce<'blocked' | 'needs-work' | 'ready'>((current, summary) => {
    if (readinessRank[summary.readiness] < readinessRank[current]) {
      return summary.readiness;
    }
    return current;
  }, 'ready');

  const readyRoutes = outputs
    .map((output) => output.readiness || 'keep-as-idea')
    .filter(
      (readinessValue): readinessValue is SWOTOutputReadiness =>
        readinessValue === 'ready-for-initiative' ||
        readinessValue === 'ready-for-presentation' ||
        readinessValue === 'ready-for-report' ||
        readinessValue === 'keep-as-idea' ||
        readinessValue === 'blocked'
    );

  return {
    label:
      readiness === 'ready'
        ? isPolish
          ? 'Gotowe do decyzji'
          : 'Decision-ready'
        : readiness === 'needs-work'
          ? isPolish
            ? 'Wymaga dopracowania'
            : 'Needs refinement'
          : isPolish
            ? 'Zablokowane brakami'
            : 'Blocked by gaps',
    readiness,
    readyRoutes,
  };
}

export function computeToolReviewGaps(
  toolType: ToolType,
  inputData: unknown,
  isPolish: boolean
): string[] {
  if (!inputData) return [];
  const gaps: string[] = [];
  const data = inputData as any;

  if (toolType === 'dynamic-swot') {
    const acceptedTensions =
      data.tensions?.filter((item: any) => isGovernedAccepted(item.proposalStatus)).length || 0;
    const acceptedCorrelations =
      data.correlations?.filter((item: any) => isGovernedAccepted(item.proposalStatus)).length || 0;
    const acceptedMoves =
      data.recommendedMoves?.filter((item: any) => isGovernedAccepted(item.proposalStatus))
        .length || 0;
    const acceptedOutputs =
      data.outputCandidates?.filter((item: any) => isGovernedAccepted(item.proposalStatus))
        .length || 0;
    const acceptedSummary =
      !!data.summary?.executiveSummary && isGovernedAccepted(data.summary?.proposalStatus);
    if (!data.context?.goal || !data.context?.scope || !data.context?.successSignal)
      gaps.push(isPolish ? 'Brak misji i kontekstu' : 'Missing mission');
    if (!(data.signals?.length || 0) && !(data.items?.length || 0))
      gaps.push(isPolish ? 'Brak sygnałów wejściowych' : 'Missing input signals');
    ['strengths', 'weaknesses', 'opportunities', 'threats'].forEach((q) => {
      if (!data.items?.some((i: any) => i.quadrant === q)) {
        const labels: Record<string, string> = {
          strengths: isPolish ? 'Mocne strony' : 'Strengths',
          weaknesses: isPolish ? 'Słabe strony' : 'Weaknesses',
          opportunities: isPolish ? 'Szanse' : 'Opportunities',
          threats: isPolish ? 'Zagrożenia' : 'Threats',
        };
        gaps.push(`${isPolish ? 'Brak' : 'Missing'}: ${labels[q]}`);
      }
    });
    if (!acceptedTensions && !acceptedCorrelations)
      gaps.push(isPolish ? 'Brak napięć strategicznych' : 'Missing strategic tensions');
    if (!acceptedMoves)
      gaps.push(isPolish ? 'Brak rekomendowanych ruchów' : 'Missing recommended moves');
    if (!acceptedSummary)
      gaps.push(isPolish ? 'Brak wyników i działań' : 'Missing final source summary');
    if (!acceptedOutputs)
      gaps.push(isPolish ? 'Brak kandydatów outputów' : 'Missing output candidates');
    return gaps;
  }

  if (toolType === 'market-forces') {
    const acceptedImplications =
      data.implications?.filter((item: any) => isGovernedAccepted(item.proposalStatus)).length || 0;
    const acceptedMoves =
      data.recommendedMoves?.filter((item: any) => isGovernedAccepted(item.proposalStatus))
        .length || 0;
    const acceptedOutputs =
      data.outputCandidates?.filter((item: any) => isGovernedAccepted(item.proposalStatus))
        .length || 0;
    const acceptedSummary =
      !!data.summary?.executiveSummary && isGovernedAccepted(data.summary?.proposalStatus);

    if (!data.context?.industry) gaps.push(isPolish ? 'Brak branży' : 'Missing industry');
    if (!data.context?.geographicScope)
      gaps.push(isPolish ? 'Brak zakresu geograficznego' : 'Missing geographic scope');
    if (!(data.signals?.length || 0))
      gaps.push(isPolish ? 'Brak sygnałów rynkowych' : 'Missing market signals');
    Object.entries(data.forces || {}).forEach(([key, force]: [string, any]) => {
      if (!force?.drivers?.length)
        gaps.push(`${isPolish ? 'Brak czynników' : 'Missing drivers'}: ${force?.name || key}`);
    });
    if (!acceptedImplications)
      gaps.push(isPolish ? 'Brak implikacji strategicznych' : 'Missing strategic implications');
    if (!acceptedMoves)
      gaps.push(isPolish ? 'Brak rekomendowanych ruchów' : 'Missing recommended moves');
    if (!acceptedSummary)
      gaps.push(isPolish ? 'Brak wyników i działań' : 'Missing final source summary');
    if (!acceptedOutputs)
      gaps.push(isPolish ? 'Brak kandydatów outputów' : 'Missing output candidates');
    return gaps;
  }

  if (toolType === 'growth-paths') {
    const growth = data as GrowthPathsData;
    const acceptedOptions = Object.values(growth.quadrants || {}).reduce(
      (sum: number, items: any) =>
        sum + (items || []).filter((item: any) => isGovernedAccepted(item.proposalStatus)).length,
      0
    );
    const acceptedComparisons =
      growth.comparisons?.filter((item: any) => isGovernedAccepted(item.proposalStatus)).length ||
      0;
    const acceptedMoves =
      growth.recommendedMoves?.filter((item: any) => isGovernedAccepted(item.proposalStatus))
        .length || 0;
    const acceptedOutputs =
      growth.outputCandidates?.filter((item: any) => isGovernedAccepted(item.proposalStatus))
        .length || 0;
    const acceptedSummary =
      !!growth.summary?.executiveSummary && isGovernedAccepted(growth.summary?.proposalStatus);

    if (!growth.context?.goal || !growth.context?.scope || !growth.context?.successSignal)
      gaps.push(isPolish ? 'Brak misji wzrostu i kontekstu' : 'Missing growth mission');
    if (!(growth.signals?.length || 0))
      gaps.push(isPolish ? 'Brak sygnałów wzrostu' : 'Missing growth signals');
    if (!acceptedOptions)
      gaps.push(
        isPolish ? 'Brak zaakceptowanych opcji wzrostu' : 'Missing accepted growth options'
      );
    if (!acceptedComparisons)
      gaps.push(isPolish ? 'Brak porównania strategicznego' : 'Missing strategic comparison');
    if (!acceptedMoves)
      gaps.push(isPolish ? 'Brak rekomendowanych ruchów' : 'Missing recommended moves');
    if (!acceptedSummary)
      gaps.push(isPolish ? 'Brak wyników i działań' : 'Missing final source summary');
    if (!acceptedOutputs)
      gaps.push(isPolish ? 'Brak kandydatów outputów' : 'Missing output candidates');
    return gaps;
  }

  if (toolType === 'portfolio-priority') {
    const portfolio = data as PortfolioPriorityData;
    const acceptedItems = (portfolio.initiatives || []).filter(
      (item) => item.proposalStatus !== 'rejected'
    ).length;
    const acceptedTradeOffs = (portfolio.tradeOffs || []).filter(
      (item) => item.proposalStatus !== 'rejected'
    ).length;
    const acceptedMoves = (portfolio.recommendedMoves || []).filter(
      (item) => item.proposalStatus !== 'rejected'
    ).length;
    const acceptedOutputs = (portfolio.outputCandidates || []).filter(
      (item) => item.proposalStatus !== 'rejected'
    ).length;
    const acceptedSummary =
      !!portfolio.summary?.executiveSummary && portfolio.summary?.proposalStatus !== 'rejected';
    if (!portfolio.context?.goal || !portfolio.context?.scope || !portfolio.context?.successSignal)
      gaps.push(isPolish ? 'Brak misji portfela i kontekstu' : 'Missing portfolio mission');
    if (!(portfolio.signals?.length || 0))
      gaps.push(isPolish ? 'Brak sygnałów portfolio' : 'Missing portfolio signals');
    if (!acceptedItems)
      gaps.push(
        isPolish ? 'Brak zaakceptowanych elementów portfolio' : 'Missing accepted portfolio items'
      );
    if (!acceptedTradeOffs)
      gaps.push(isPolish ? 'Brak trade-offów portfolio' : 'Missing portfolio trade-offs');
    if (!acceptedMoves)
      gaps.push(isPolish ? 'Brak rekomendowanych ruchów' : 'Missing recommended moves');
    if (!acceptedSummary)
      gaps.push(isPolish ? 'Brak wyników i działań' : 'Missing final source summary');
    if (!acceptedOutputs)
      gaps.push(isPolish ? 'Brak kandydatów outputów' : 'Missing output candidates');
    return gaps;
  }

  if (toolType === 'risk-uncertainty') {
    const risk = data as RiskUncertaintyData;
    const acceptedAssumptions = (risk.assumptions || []).filter(
      (item) => item.proposalStatus !== 'rejected'
    ).length;
    const acceptedRisks = (risk.risks || []).filter(
      (item) => item.proposalStatus !== 'rejected'
    ).length;
    const acceptedScenarios = (risk.scenarios || []).filter(
      (item) => item.proposalStatus !== 'rejected'
    ).length;
    const acceptedMoves = (risk.recommendedMoves || []).filter(
      (item) => item.proposalStatus !== 'rejected'
    ).length;
    const acceptedOutputs = (risk.outputCandidates || []).filter(
      (item) => item.proposalStatus !== 'rejected'
    ).length;
    const acceptedSummary =
      !!risk.summary?.executiveSummary && risk.summary?.proposalStatus !== 'rejected';
    if (!risk.context?.goal || !risk.context?.scope || !risk.context?.successSignal)
      gaps.push(isPolish ? 'Brak misji i kontekstu' : 'Missing risk mission');
    if (!(risk.signals?.length || 0))
      gaps.push(isPolish ? 'Brak sygnałów ryzyka' : 'Missing risk signals');
    if (!acceptedAssumptions)
      gaps.push(isPolish ? 'Brak zaakceptowanych założeń' : 'Missing accepted assumptions');
    if (!acceptedRisks)
      gaps.push(isPolish ? 'Brak zaakceptowanych ryzyk' : 'Missing accepted risks');
    if (!acceptedScenarios) gaps.push(isPolish ? 'Brak scenariuszy' : 'Missing scenarios');
    if (!acceptedMoves)
      gaps.push(isPolish ? 'Brak rekomendowanych ruchów' : 'Missing recommended moves');
    if (!acceptedSummary)
      gaps.push(isPolish ? 'Brak wyników i działań' : 'Missing final source summary');
    if (!acceptedOutputs)
      gaps.push(isPolish ? 'Brak kandydatów outputów' : 'Missing output candidates');
    return gaps;
  }

  // Operational tools fallback
  const operational = data as OperationalToolData;
  const sections = operational?.sections || {};
  if (!operational?.context?.goal || !operational?.context?.scope) {
    gaps.push(isPolish ? 'Brak kontekstu' : 'Missing context');
  }
  const missingSections = Object.keys(sections).filter((k) => (sections[k]?.length || 0) === 0);
  missingSections
    .slice(0, 8)
    .forEach((k) => gaps.push(`${isPolish ? 'Brak' : 'Missing'}: ${k.replace(/-/g, ' ')}`));

  const flow = (data as any)?.flow;
  if (flow?.impactHypothesis) {
    const ih = flow.impactHypothesis;
    if (!ih?.metricName || ih?.baseline == null || ih?.target == null || !ih?.unit) {
      gaps.push(isPolish ? 'Brak hipotezy wpływu' : 'Missing impact hypothesis');
    }
  }
  if (flow?.results) {
    const r = flow.results;
    if (!r?.executiveSummary && (r?.keyFindings?.length || 0) === 0) {
      gaps.push(isPolish ? 'Brak wyników' : 'Missing results');
    }
  }
  if (flow?.processAutomation) {
    const pa = flow.processAutomation;
    if (!pa?.processName || pa?.volumePerWeek == null || pa?.baselineMinutesPerCycle == null) {
      gaps.push(isPolish ? 'Brak pomiaru baseline' : 'Missing baseline measurement');
    }
    if (pa?.targetMinutesPerCycle == null) {
      gaps.push(isPolish ? 'Brak re-estymacji target' : 'Missing target re-estimation');
    }
  }
  if (flow?.economics) {
    const e = flow.economics;
    if (e?.fullyLoadedCostPerHour == null) {
      gaps.push(isPolish ? 'Brak założeń kosztu/h' : 'Missing cost/hour assumption');
    }
  }
  return gaps;
}

export function computeToolCompletionItems(
  toolType: ToolType,
  inputData: unknown,
  isPolish: boolean
): ToolCompletionItem[] {
  if (!inputData) return [];
  const items: ToolCompletionItem[] = [];
  const data = inputData as any;

  if (toolType === 'dynamic-swot') {
    const swot = data as SWOTData;
    items.push({
      label: isPolish ? 'Misja i kontekst zdefiniowane' : 'Mission defined',
      done: !!swot?.context?.goal && !!swot?.context?.scope && !!swot?.context?.successSignal,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Sygnały wejściowe zebrane' : 'Input signals collected',
      done: (swot?.signals?.length || 0) > 0 || (swot?.items?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    const quadrantLabels: Record<string, string> = {
      strengths: isPolish ? 'Mocne strony' : 'Strengths',
      weaknesses: isPolish ? 'Słabe strony' : 'Weaknesses',
      opportunities: isPolish ? 'Szanse' : 'Opportunities',
      threats: isPolish ? 'Zagrożenia' : 'Threats',
    };
    ['strengths', 'weaknesses', 'opportunities', 'threats'].forEach((q) => {
      items.push({
        label: `${isPolish ? 'Elementy' : 'Items'}: ${quadrantLabels[q]}`,
        done: swot?.items?.some((i) => i.quadrant === q) || false,
        anchorId: 'tool-content',
      });
    });
    items.push({
      label: isPolish ? 'Napięcia strategiczne wygenerowane' : 'Strategic tensions generated',
      done: (swot?.tensions?.length || 0) > 0 || (swot?.correlations?.length || 0) > 0,
      anchorId: 'analysis',
    });
    items.push({
      label: isPolish ? 'Rekomendowane ruchy wygenerowane' : 'Recommended moves generated',
      done: (swot?.recommendedMoves?.length || 0) > 0,
      anchorId: 'analysis',
    });
    items.push({
      label: isPolish ? 'Wyniki i działania gotowe' : 'Final source summary ready',
      done: !!swot?.summary?.executiveSummary,
      anchorId: 'analysis',
    });
    return items;
  }

  if (toolType === 'market-forces') {
    const porter = data as PorterData;
    items.push({
      label: isPolish ? 'Branża zdefiniowana' : 'Industry defined',
      done: !!porter?.context?.industry,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Sygnały rynkowe zebrane' : 'Market signals collected',
      done: (porter?.signals?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Zakres geograficzny' : 'Geographic scope',
      done: !!porter?.context?.geographicScope,
      anchorId: 'tool-content',
    });
    Object.values(porter?.forces || {}).forEach((force: any) => {
      items.push({
        label: `${isPolish ? 'Czynniki' : 'Drivers'}: ${force?.name || '-'}`,
        done: (force?.drivers?.length || 0) > 0,
        anchorId: 'tool-content',
      });
    });
    items.push({
      label: isPolish ? 'Implikacje strategiczne' : 'Strategic implications',
      done: (porter?.implications?.length || 0) > 0,
      anchorId: 'analysis',
    });
    items.push({
      label: isPolish ? 'Rekomendowane ruchy' : 'Recommended moves',
      done: (porter?.recommendedMoves?.length || 0) > 0,
      anchorId: 'analysis',
    });
    items.push({
      label: isPolish ? 'Wyniki i działania gotowe' : 'Final source summary ready',
      done: !!porter?.summary?.executiveSummary,
      anchorId: 'analysis',
    });
    return items;
  }

  if (toolType === 'growth-paths') {
    const growth = data as GrowthPathsData;
    items.push({
      label: isPolish ? 'Misja wzrostu i kontekst zdefiniowane' : 'Growth mission defined',
      done: !!growth?.context?.goal && !!growth?.context?.scope && !!growth?.context?.successSignal,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Sygnały wzrostu zebrane' : 'Growth signals collected',
      done: (growth?.signals?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Penetracja rynku' : 'Market Penetration',
      done: (growth?.quadrants?.marketPenetration?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Rozwój rynku' : 'Market Development',
      done: (growth?.quadrants?.marketDevelopment?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Rozwój produktu' : 'Product Development',
      done: (growth?.quadrants?.productDevelopment?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Dywersyfikacja' : 'Diversification',
      done: (growth?.quadrants?.diversification?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Porównanie strategiczne' : 'Strategic comparison',
      done: (growth?.comparisons?.length || 0) > 0,
      anchorId: 'analysis',
    });
    items.push({
      label: isPolish ? 'Rekomendowane ruchy' : 'Recommended moves',
      done: (growth?.recommendedMoves?.length || 0) > 0,
      anchorId: 'analysis',
    });
    items.push({
      label: isPolish ? 'Wyniki i działania gotowe' : 'Final source summary ready',
      done: !!growth?.summary?.executiveSummary,
      anchorId: 'analysis',
    });
    return items;
  }

  if (toolType === 'portfolio-priority') {
    const portfolio = data as PortfolioPriorityData;
    items.push({
      label: isPolish ? 'Misja portfela i kontekst' : 'Portfolio mission',
      done:
        !!portfolio?.context?.goal &&
        !!portfolio?.context?.scope &&
        !!portfolio?.context?.successSignal,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Sygnały portfolio' : 'Portfolio signals',
      done: (portfolio?.signals?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Elementy portfela i macierz' : 'Portfolio items',
      done: (portfolio?.initiatives?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Trade-offy i priorytety' : 'Allocation trade-offs',
      done: (portfolio?.tradeOffs?.length || 0) > 0,
      anchorId: 'analysis',
    });
    items.push({
      label: isPolish ? 'Rekomendowane ruchy' : 'Recommended moves',
      done: (portfolio?.recommendedMoves?.length || 0) > 0,
      anchorId: 'analysis',
    });
    items.push({
      label: isPolish ? 'Wyniki i działania gotowe' : 'Final source summary ready',
      done: !!portfolio?.summary?.executiveSummary,
      anchorId: 'tool-content',
    });
    return items;
  }

  if (toolType === 'risk-uncertainty') {
    const risk = data as RiskUncertaintyData;
    items.push({
      label: isPolish ? 'Misja i kontekst' : 'Risk mission',
      done: !!risk?.context?.goal && !!risk?.context?.scope && !!risk?.context?.successSignal,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Sygnały ryzyka' : 'Risk signals',
      done: (risk?.signals?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Założenia' : 'Assumptions',
      done: (risk?.assumptions?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Ryzyka' : 'Risks',
      done: (risk?.risks?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Scenariusze' : 'Scenarios',
      done: (risk?.scenarios?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Rekomendowane ruchy' : 'Recommended moves',
      done: (risk?.recommendedMoves?.length || 0) > 0,
      anchorId: 'analysis',
    });
    items.push({
      label: isPolish ? 'Wyniki i działania gotowe' : 'Final source summary ready',
      done: !!risk?.summary?.executiveSummary,
      anchorId: 'analysis',
    });
    return items;
  }

  const operational = data as OperationalToolData;
  items.push({
    label: isPolish ? 'Kontekst zdefiniowany' : 'Context defined',
    done: !!operational?.context?.goal && !!operational?.context?.scope,
    anchorId: 'tool-content',
  });
  const sections = operational?.sections || {};
  Object.keys(sections).forEach((sectionId) => {
    items.push({
      label: sectionId,
      done: (sections[sectionId]?.length || 0) > 0,
      anchorId: 'tool-content',
    });
  });

  const flow = (data as any)?.flow;
  if (flow?.impactHypothesis) {
    const ih = flow.impactHypothesis;
    items.push({
      label: isPolish ? 'Hipoteza wpływu' : 'Impact hypothesis',
      done: !!ih?.metricName && ih?.baseline != null && ih?.target != null && !!ih?.unit,
      anchorId: 'tool-content',
    });
  }
  if (flow?.results) {
    const r = flow.results;
    items.push({
      label: isPolish ? 'Wyniki' : 'Results',
      done: !!r?.executiveSummary || (r?.keyFindings?.length || 0) > 0,
      anchorId: 'tool-content',
    });
  }
  if (flow?.processAutomation) {
    const pa = flow.processAutomation;
    items.push({
      label: isPolish ? 'Pomiar baseline' : 'Baseline measurement',
      done: !!pa?.processName && pa?.volumePerWeek != null && pa?.baselineMinutesPerCycle != null,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Re-estymacja target' : 'Target re-estimation',
      done: pa?.targetMinutesPerCycle != null,
      anchorId: 'tool-content',
    });
  }
  if (flow?.economics) {
    const e = flow.economics;
    items.push({
      label: isPolish ? 'Ekonomia' : 'Economics',
      done:
        e?.fullyLoadedCostPerHour != null &&
        (e?.baselineHoursPerWeek != null ||
          flow?.processAutomation?.baselineMinutesPerCycle != null) &&
        (e?.targetHoursPerWeek != null || flow?.processAutomation?.targetMinutesPerCycle != null),
      anchorId: 'tool-content',
    });
  }
  return items;
}
