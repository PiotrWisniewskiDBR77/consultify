import { CONSULTING_TOOL_STANDARD_OUTPUTS } from '@/config/consultingToolsStandard';
import type { SWOTData, SWOTItem, ToolType } from '@/store/useToolStore';

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

export function getToolSuggestionPrompt(
  toolType: ToolType,
  stepId: string,
  inputData: unknown
): string {
  if (toolType === 'market-forces') {
    const porterData = inputData as any;
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

  if (OPERATIONAL_TOOL_TYPES.includes(toolType)) {
    if (stepId !== 'context' && stepId !== 'summary') {
      return `Act as an AI operations mentor. Provide 3-5 concise items for ${stepId}.

Prefer items that can later support applied conclusions and concrete outputs.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;
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
      return `Act as an AI strategy mentor. Based on the mission and organization context, propose 4-6 high-value signals for the Input & Exploration phase.

Mission:
- Strategic question: ${swotData?.context?.goal || 'missing'}
- Scope: ${swotData?.context?.scope || 'missing'}
- Success signal: ${swotData?.context?.successSignal || 'missing'}

Return JSON:
{"signals": [{"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["..."], "evidenceType": "fact|observation|hypothesis", "state": "accepted|proposed|needs-evidence", "provenance": "..."}]}`;
    }
    if (stepId === 'swot') {
      const signalsSummary = (swotData?.signals || [])
        .slice(0, 20)
        .map((signal) => `- [${signal.type}] ${signal.content}`)
        .join('\n');
      return `Act as an AI strategy mentor. Turn the following signals into candidate SWOT items.

${signalsSummary || '- no explicit signals provided yet'}

Rules:
- keep items concrete
- avoid duplicates
- separate internal vs external
- classify each item into strengths, weaknesses, opportunities, or threats

Return JSON:
{"items": [{"text": "...", "impact": "high|medium|low", "quadrant": "strengths|weaknesses|opportunities|threats", "confidence": 1-5, "status": "accepted|proposed"}]}`;
    }
  }

  return '';
}

export function getToolSummaryPrompt(toolType: ToolType, inputData: unknown): string {
  if (toolType === 'dynamic-swot') {
    const swotData = inputData as SWOTData | undefined;
    const itemsSummary = (swotData?.items || [])
      .map((item: SWOTItem) => `- ${item.quadrant.toUpperCase()}: ${item.text}`)
      .join('\n');

    return `Based on this completed SWOT analysis, produce a consulting-grade finish:

${itemsSummary}

Provide:
1. Executive Summary (3-4 sentences)
2. Top 3 Key Insights
3. Applied Conclusions: what this means, what to do, what not to do, what to validate next
4. 3-5 Recommended Strategic Moves
5. Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}

The executive summary should function as the final source summary for downstream outputs.

Return as JSON:
{
  "summary": "executive summary text",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "appliedConclusions": [
    "practical implication 1",
    "practical implication 2"
  ],
  "moves": [{
    "title": "Move name",
    "category": "quick-win|big-bet|defensive-move|capability-build",
    "rationale": "Why this matters",
    "linkedItemIds": ["item1"],
    "expectedImpact": "high|medium|low",
    "estimatedEffort": "high|medium|low",
    "riskLevel": "high|medium|low",
    "confidence": 4,
    "firstStep": "first action"
  }],
  "initiatives": [{
    "title": "Initiative Name",
    "description": "What it does",
    "type": "strategic|operational|defensive|growth",
    "estimatedImpact": "high|medium|low",
    "estimatedEffort": "high|medium|low",
    "rationale": "Why this matters",
    "linkedItems": ["item1"]
  }],
  "outputCandidates": [{
    "outputType": "initiative|report|presentation|idea",
    "title": "Output title",
    "description": "What should be created",
    "linkedItemIds": ["item1"],
    "rationale": "Why this output now",
    "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"
  }]
}`;
  }

  if (toolType === 'market-forces') {
    const porterData = inputData as any;
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

  if (toolType === 'growth-paths') {
    const growthData = inputData as any;
    const optionsSummary = Object.entries(growthData?.quadrants || {})
      .map(
        ([quadrant, items]: [string, any]) =>
          `- ${quadrant}: ${(items || []).map((item: any) => item.title).join('; ') || 'none'}`
      )
      .join('\n');

    return `Based on this Ansoff Growth Paths analysis, create a consulting-grade final summary:

${optionsSummary}

Provide:
1. Executive Summary (3-4 sentences)
2. Top 3 growth insights
3. Applied Conclusions: what to scale, what to test, what to avoid, what to validate next
4. 3-5 Recommended Growth Moves
5. Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}

Return JSON:
{
  "summary": "executive summary",
  "insights": ["insight 1", "insight 2"],
  "appliedConclusions": ["..."],
  "moves": [{"title":"...","category":"scale-core|enter-market|build-product|diversify|validate-first","rationale":"...","linkedOptionIds":[],"linkedQuadrants":["marketPenetration"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
  "initiatives": [{"title": "...", "description": "...", "type": "growth|strategic|operational", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": ["marketPenetration"]}],
  "outputCandidates": [{"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "linkedQuadrants": ["marketPenetration"], "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
  }

  if (toolType === 'portfolio-priority') {
    const portfolio = inputData as any;
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
    const riskSummary = (risk?.risks || [])
      .map((item: any) => `- ${item.title || item.description}: P${item.probability}/I${item.impact}`)
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

  if (OPERATIONAL_TOOL_TYPES.includes(toolType)) {
    return `Summarize the operational analysis:
1. Executive Summary
2. Top 3 insights
3. 3-5 operational initiatives

Return JSON:
{"summary": "...", "insights": ["..."], "initiatives": [{"title": "...", "description": "...", "rationale": "..."}]}`;
  }

  return '';
}
