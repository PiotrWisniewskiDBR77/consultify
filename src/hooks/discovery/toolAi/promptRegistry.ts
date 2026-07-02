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

const humanizeStepId = (stepId: string): string =>
  stepId
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export function getToolSuggestionPrompt(
  toolType: ToolType,
  stepId: string,
  inputData: unknown
): string {
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

Return JSON:
{"activities": {"inboundLogistics": {"costContribution": "high|medium|low", "valueContribution": "high|medium|low", "marginRole": "creator|neutral|drain", "maturity": "strong|adequate|weak", "drivers": ["..."], "evidence": ["..."], "implication": "...", "confidence": 1-5}, "operations": {"...": "..."}, "outboundLogistics": {"...": "..."}, "marketingSales": {"...": "..."}, "service": {"...": "..."}, "infrastructure": {"...": "..."}, "hrManagement": {"...": "..."}, "technology": {"...": "..."}, "procurement": {"...": "..."}}, "positioningVerdict": {"positioning": "cost-advantage|differentiation|stuck-in-the-middle", "summary": "..."}}`;
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
  if (OPERATIONAL_TOOL_TYPES.includes(toolType)) {
    const opData = inputData as any;
    const sectionsSummary = Object.entries(opData?.sections || {})
      .map(
        ([key, items]: [string, any]) =>
          `- ${humanizeStepId(key)}: ${(Array.isArray(items) ? items : []).length} item(s)`
      )
      .join('\n');

    return `Based on this completed operational analysis, create a consulting-grade final summary:

${sectionsSummary || '- (no sections populated yet)'}

Provide:
1. Executive Summary (3-4 sentences)
2. Top 3 Key Insights
3. Applied Conclusions: what to do, what to standardize, what to validate next
4. Initiatives to drive the work forward
5. Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}

Return as JSON:
{
  "summary": "executive summary",
  "insights": ["insight 1", "insight 2"],
  "appliedConclusions": ["..."],
  "initiatives": [{"title": "...", "description": "...", "type": "operational|strategic|growth|defensive", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "..."}]
}`;
  }

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

  if (toolType === 'value-chain') {
    const vcData = inputData as any;
    const activitiesSummary = Object.entries(vcData?.activities || {})
      .map(
        ([, a]: [string, any]) =>
          `- ${a.name}: cost ${a.costContribution}, value ${a.valueContribution}, margin ${a.marginRole}`
      )
      .join('\n');

    return `Based on this Value Chain analysis, create a consulting-grade final summary:

${activitiesSummary}
${vcData?.positioningVerdict ? `Positioning verdict: ${vcData.positioningVerdict.positioning} — ${vcData.positioningVerdict.summary}` : ''}

Provide:
1. Executive Summary (3-4 sentences)
2. Top 3 Margin Levers (where cost can fall or value can rise)
3. Applied Conclusions: where to cut cost, where to invest for differentiation, what to validate next
4. 3-5 Recommended Strategic Moves
5. Output Candidates covering ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}

Return as JSON:
{
  "summary": "executive summary",
  "insights": ["insight 1", "insight 2"],
  "appliedConclusions": ["..."],
  "moves": [{"title":"...","category":"cost-advantage|differentiation|linkage-optimization|capability-build|restructure","rationale":"...","linkedActivityIds":["operations"],"expectedImpact":"high|medium|low","estimatedEffort":"high|medium|low","riskLevel":"high|medium|low","confidence":4,"firstStep":"..."}],
  "initiatives": [{"title": "...", "description": "...", "type": "strategic|operational|defensive|growth", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "...", "linkedItems": ["operations"]}],
  "outputCandidates": [{"outputType": "initiative|report|presentation|idea", "title": "...", "description": "...", "linkedActivityIds": ["operations"], "rationale": "...", "readiness": "ready-for-initiative|ready-for-presentation|ready-for-report|keep-as-idea|blocked"}]
}`;
  }

  if (toolType === 'capability-mapper') {
    const capData = inputData as any;
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
