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
    if (
      ['rivalry', 'newEntrants', 'substitutes', 'buyerPower', 'supplierPower'].includes(stepId)
    ) {
      return `Act as an AI strategy mentor. Analyze the ${stepId} force for this industry.

Provide:
1. A score from 1-5 (1=very low, 5=very high)
2. Key drivers of this force
3. Current trend (increasing/stable/decreasing)
4. Strategic implications

Be specific to the organization's industry and market position. Explain the "why", not only the score.`;
    }
    return '';
  }

  if (toolType === 'growth-paths') {
    if (
      ['market-penetration', 'market-development', 'product-development', 'diversification'].includes(
        stepId
      )
    ) {
      return `Act as an AI growth mentor. Suggest 3-5 initiatives for the ${stepId} quadrant.

Keep them realistic, mutually distinguishable, and easy to compare in later discussion.

Return JSON:
{"initiatives": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;
    }
    return '';
  }

  if (toolType === 'portfolio-priority') {
    if (stepId === 'portfolio-items') {
      return `Act as an AI portfolio mentor. Propose 3-5 portfolio initiatives with market growth and share scores.

Bias toward explicit trade-offs and prioritization clarity.

Return JSON:
{"items": [{"title": "...", "description": "...", "marketGrowth": 3, "marketShare": 3, "investmentLevel": 3}]}`;
    }
    return '';
  }

  if (toolType === 'risk-uncertainty') {
    if (stepId === 'assumptions') {
      return `Act as an AI risk mentor. List 3-5 key assumptions with confidence (1-5). Return JSON:
{"assumptions": [{"text": "...", "confidence": 3}]}`;
    }
    if (stepId === 'risks') {
      return `Act as an AI risk mentor. List 3-5 strategic risks with probability/impact (1-5) and mitigation. Return JSON:
{"risks": [{"description": "...", "probability": 3, "impact": 3, "mitigation": "..."}]}`;
    }
    if (stepId === 'scenarios') {
      return `Act as an AI risk mentor. List 2-4 scenarios with likelihood (1-5) and notes. Return JSON:
{"scenarios": [{"title": "...", "likelihood": 3, "notes": "..."}]}`;
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
1. Overall Industry Attractiveness Score (1-5)
2. Executive Summary (3-4 sentences)
3. Top 3 Strategic Implications
4. Applied Conclusions for the organization
5. 3-5 Competitive Initiative Recommendations

Return as JSON:
{"attractiveness": 3, "summary": "executive summary", "insights": ["insight 1", "insight 2"], "appliedConclusions": ["..."], "initiatives": [{"title": "...", "description": "...", "type": "...", "rationale": "..."}]}`;
  }

  if (toolType === 'growth-paths') {
    return `Summarize the Ansoff Matrix analysis in a way that can feed report and presentation creation:
1. Executive Summary (3-4 sentences)
2. Top 3 insights
3. Applied Conclusions
4. 3-5 initiative recommendations (with impact/effort)

Return JSON:
{"summary": "...", "insights": ["..."], "appliedConclusions": ["..."], "initiatives": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;
  }

  if (toolType === 'portfolio-priority') {
    return `Summarize portfolio priorities in a consulting-grade way:
1. Executive Summary
2. Top 3 insights
3. Applied Conclusions
4. 3-5 initiatives (with rationale)

Return JSON:
{"summary": "...", "insights": ["..."], "appliedConclusions": ["..."], "initiatives": [{"title": "...", "description": "...", "rationale": "..."}]}`;
  }

  if (toolType === 'risk-uncertainty') {
    return `Summarize risks and scenarios in a consulting-grade way:
1. Executive Summary
2. Top 3 insights
3. Applied Conclusions
4. 3-5 resilience initiatives

Return JSON:
{"summary": "...", "insights": ["..."], "appliedConclusions": ["..."], "initiatives": [{"title": "...", "description": "...", "rationale": "..."}]}`;
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
