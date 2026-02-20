import type {
  GrowthPathsData,
  OperationalToolData,
  PorterData,
  PortfolioPriorityData,
  RiskUncertaintyData,
  SWOTData,
  ToolType,
} from '@/store/useToolStore';

export type ToolCompletionItem = { label: string; done: boolean; anchorId?: string };

export function computeToolReviewGaps(
  toolType: ToolType,
  inputData: unknown,
  isPolish: boolean
): string[] {
  if (!inputData) return [];
  const gaps: string[] = [];
  const data = inputData as any;

  if (toolType === 'dynamic-swot') {
    if (!data.context?.goal || !data.context?.scope)
      gaps.push(isPolish ? 'Brak kontekstu strategicznego' : 'Missing strategic context');
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
    if (!data.correlations?.length) gaps.push(isPolish ? 'Brak korelacji' : 'Missing correlations');
    return gaps;
  }

  if (toolType === 'market-forces') {
    if (!data.context?.industry) gaps.push(isPolish ? 'Brak branży' : 'Missing industry');
    if (!data.context?.geographicScope)
      gaps.push(isPolish ? 'Brak zakresu geograficznego' : 'Missing geographic scope');
    Object.entries(data.forces || {}).forEach(([key, force]: [string, any]) => {
      if (!force?.drivers?.length)
        gaps.push(`${isPolish ? 'Brak czynników' : 'Missing drivers'}: ${force?.name || key}`);
    });
    return gaps;
  }

  if (toolType === 'growth-paths') {
    const growth = data as GrowthPathsData;
    if (!growth.quadrants) gaps.push(isPolish ? 'Brak kwadrantów' : 'Missing quadrants');
    return gaps;
  }

  if (toolType === 'portfolio-priority') {
    const portfolio = data as PortfolioPriorityData;
    if (!portfolio.initiatives?.length)
      gaps.push(isPolish ? 'Brak inicjatyw w portfolio' : 'Missing portfolio initiatives');
    return gaps;
  }

  if (toolType === 'risk-uncertainty') {
    const risk = data as RiskUncertaintyData;
    if (!risk.assumptions?.length) gaps.push(isPolish ? 'Brak założeń' : 'Missing assumptions');
    if (!risk.risks?.length) gaps.push(isPolish ? 'Brak ryzyk' : 'Missing risks');
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
      label: isPolish ? 'Cel strategiczny zdefiniowany' : 'Strategic goal defined',
      done: !!swot?.context?.goal && !!swot?.context?.scope,
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
      label: isPolish ? 'Korelacje wygenerowane' : 'Correlations generated',
      done: (swot?.correlations?.length || 0) > 0,
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
    return items;
  }

  if (toolType === 'growth-paths') {
    const growth = data as GrowthPathsData;
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
    return items;
  }

  if (toolType === 'portfolio-priority') {
    const portfolio = data as PortfolioPriorityData;
    items.push({
      label: isPolish ? 'Inicjatywy dodane' : 'Initiatives added',
      done: (portfolio?.initiatives?.length || 0) > 0,
      anchorId: 'tool-content',
    });
    items.push({
      label: isPolish ? 'Kategorie przypisane' : 'Categories assigned',
      done: portfolio?.initiatives?.some((i) => i.category) || false,
      anchorId: 'tool-content',
    });
    return items;
  }

  if (toolType === 'risk-uncertainty') {
    const risk = data as RiskUncertaintyData;
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
