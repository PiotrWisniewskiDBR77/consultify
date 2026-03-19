/**
 * useToolAI - Hook for AI interactions in strategic tools
 *
 * Wraps useAIStream to provide tool-specific AI capabilities:
 * - Structured prompts with organization context
 * - JSON extraction from AI responses
 * - Tool-specific analysis generation
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  CONSULTING_TOOL_AI_BEHAVIOR_RULES,
  CONSULTING_TOOL_CONTEXT_SOURCES,
  CONSULTING_TOOL_CONVERSATION_LAYERS,
  CONSULTING_TOOL_EXPERIENCE_PRINCIPLES,
  CONSULTING_TOOL_RUNTIME_STAGES,
  CONSULTING_TOOL_SOURCE_ARTIFACTS,
  CONSULTING_TOOL_STANDARD_OUTPUTS,
} from '@/config/consultingToolsStandard';
import { useAIStream } from '@/hooks/useAIStream';
import { SWOTCorrelation, SWOTData, SWOTItem, ToolType, useToolStore } from '@/store/useToolStore';

import { useOrganizationContext } from './useOrganizationContext';

// ==================== TYPES ====================

interface UseToolAIOptions {
  toolType: ToolType;
}

interface UseToolAIReturn {
  // Stream state
  isStreaming: boolean;
  streamedContent: string;
  error: string | null;

  // Actions
  sendMessage: (message: string) => Promise<void>;
  requestSuggestions: () => Promise<void>;
  generateCorrelations: () => Promise<void>;
  generateSummary: () => Promise<void>;
  abortStream: () => void;

  // Utilities
  getStepOpeningQuestion: () => string;
}

// ==================== SYSTEM PROMPTS ====================

const BASE_SYSTEM_PROMPT = `You are an expert consulting AI helping users think, not just generate text.
You act as a consultant, mentor, and challenger. Your job is to reduce friction, guide the conversation, structure evidence, explain your reasoning, and help the user reach practical conclusions.

RESPONSE GUIDELINES:
1. Be concise but comprehensive
2. Use bullet points for clarity
3. Ask short purposeful questions when information is missing
4. Provide specific, actionable recommendations
5. Reference the organization's context when relevant
6. When using benchmarks or external points of reference, say so explicitly
7. When generating JSON, ensure it's valid and properly formatted

LANGUAGE: Respond in the same language as the user's input (Polish or English).`;

const CONSULTING_TOOLS_STANDARD_PROMPT = `

CONSULTING TOOLS STANDARD:
- Canonical runtime flow: ${CONSULTING_TOOL_RUNTIME_STAGES.join(' -> ')}
- Canonical outputs: ${CONSULTING_TOOL_STANDARD_OUTPUTS.join(', ')}
- AI behavior rules: ${CONSULTING_TOOL_AI_BEHAVIOR_RULES.join('; ')}
- Experience principles: ${CONSULTING_TOOL_EXPERIENCE_PRINCIPLES.join('; ')}
- Conversation layers: ${CONSULTING_TOOL_CONVERSATION_LAYERS.join(' -> ')}
- Context sources to consider: ${CONSULTING_TOOL_CONTEXT_SOURCES.join(', ')}
- Source artifacts: ${CONSULTING_TOOL_SOURCE_ARTIFACTS.join(', ')}
- Always preserve explicit context, analysis, applied conclusions, final summary, and output readiness.
`;

const SWOT_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}${CONSULTING_TOOLS_STANDARD_PROMPT}

You are guiding the user through a Dynamic SWOT analysis.
Do not behave like a static template filler. Behave like a strategic advisor who explains what matters and why.

SWOT FRAMEWORK:
- Strengths: Internal positive attributes and resources
- Weaknesses: Internal areas needing improvement
- Opportunities: External factors the organization can leverage
- Threats: External risks and challenges

CORRELATION TYPES:
- S+O (Strength-Opportunity): Use strengths to capture opportunities
- W+O (Weakness-Opportunity): Overcome weaknesses to capture opportunities
- S+T (Strength-Threat): Use strengths to mitigate threats
- W+T (Weakness-Threat): Address weaknesses exposed by threats

When generating items, use this JSON format:
{"items": [{"text": "...", "impact": "high|medium|low", "quadrant": "strengths|weaknesses|opportunities|threats"}]}

When generating correlations, use this JSON format:
{"correlations": [{"items": ["id1", "id2"], "type": "SO|WO|ST|WT", "insight": "...", "initiativeProposal": "..."}]}

When generating initiatives, use this JSON format:
{"initiatives": [{"title": "...", "description": "...", "type": "strategic|operational|defensive|growth", "rationale": "..."}]}`;

const PORTER_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}${CONSULTING_TOOLS_STANDARD_PROMPT}

You are guiding the user through Porter's Five Forces analysis.
Challenge assumptions, explain strategic implications, and connect findings to defensibility, margin, and positioning.

PORTER'S FIVE FORCES:
1. Competitive Rivalry - Intensity of competition among existing firms
2. Threat of New Entrants - Barriers to entry and likelihood of new competitors
3. Threat of Substitutes - Availability of alternative products/services
4. Bargaining Power of Buyers - Customers' ability to drive prices down
5. Bargaining Power of Suppliers - Suppliers' ability to drive prices up

SCORING (1-5):
1 = Very Low (favorable for the company)
5 = Very High (unfavorable for the company)

When analyzing forces, provide:
- Score (1-5)
- Key drivers
- Trend (increasing/stable/decreasing)
- Strategic implications

When generating initiatives, focus on:
- Strengthening competitive position
- Building barriers to entry
- Reducing substitute threat
- Improving bargaining power`;

const GROWTH_PATHS_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}${CONSULTING_TOOLS_STANDARD_PROMPT}

You are guiding the user through the Ansoff Matrix (Growth Paths).
Help the user compare options, challenge wishful thinking, and keep the finish presentation-ready.

QUADRANTS:
1. Market Penetration - current products, current markets
2. Market Development - current products, new markets
3. Product Development - new products, current markets
4. Diversification - new products, new markets

When generating initiatives, return JSON:
{"initiatives": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;

const PORTFOLIO_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}${CONSULTING_TOOLS_STANDARD_PROMPT}

You are guiding the user through a BCG-style portfolio prioritization.
Push toward explicit trade-offs, sequencing, and what should not be prioritized.

DIMENSIONS:
- Market Growth (1-5)
- Market Share (1-5)

Categories: star, cash-cow, question-mark, dog.
Provide priority and rationale where relevant.`;

const RISK_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}${CONSULTING_TOOLS_STANDARD_PROMPT}

You are guiding the user through a Strategic Risk & Uncertainty assessment.

Provide assumptions, risks, scenarios, applied implications, and mitigation suggestions.
Use concise, actionable entries.`;

const OPERATIONAL_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}${CONSULTING_TOOLS_STANDARD_PROMPT}

You are guiding the user through an Operational Excellence tool.

Provide concise, actionable items for each operational section and explain operational implications, not only observations.
When generating items, return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;

const PROCESS_AUTOMATION_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}${CONSULTING_TOOLS_STANDARD_PROMPT}

You are guiding the user through a Process Automation (Speed Tool) workflow.

Focus on:
- identifying automation candidates
- estimating baseline vs target time and error rates
- building a fast business case (hours saved, savings, payback)
- turning outcomes into applied conclusions and execution-ready initiatives

When generating items for mapping/redesign steps, return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;

// ==================== HOOK ====================

export const useToolAI = ({ toolType }: UseToolAIOptions): UseToolAIReturn => {
  const { formatForPrompt } = useOrganizationContext();
  const {
    currentSession,
    currentStep,
    getStepDefinitions,
    updateInputData,
    addSWOTSignal,
    addSWOTItem,
    addCorrelation,
    setSWOTTensions,
    setSWOTMoves,
    setSWOTOutputCandidates,
    setSWOTSummary,
    setInitiatives,
  } = useToolStore();

  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    'suggestions' | 'correlations' | 'summary' | null
  >(null);

  const { startStream, isStreaming, streamedContent, abortStream } = useAIStream();

  // Get the appropriate system prompt
  const getSystemPrompt = useCallback(() => {
    const promptMap: Partial<Record<ToolType, string>> = {
      'dynamic-swot': SWOT_SYSTEM_PROMPT,
      'market-forces': PORTER_SYSTEM_PROMPT,
      'growth-paths': GROWTH_PATHS_SYSTEM_PROMPT,
      'portfolio-priority': PORTFOLIO_SYSTEM_PROMPT,
      'risk-uncertainty': RISK_SYSTEM_PROMPT,
      'value-chain': PORTER_SYSTEM_PROMPT,
      'ambition-decomposer': PORTER_SYSTEM_PROMPT,
      'focus-tradeoff': PORTER_SYSTEM_PROMPT,
      'capability-mapper': PORTER_SYSTEM_PROMPT,
      'narrative-engine': PORTER_SYSTEM_PROMPT,
      'sop-builder': OPERATIONAL_SYSTEM_PROMPT,
      'a3-problem-solving': OPERATIONAL_SYSTEM_PROMPT,
      'smed-planner': OPERATIONAL_SYSTEM_PROMPT,
      'dms-builder': OPERATIONAL_SYSTEM_PROMPT,
      'inventory-autopilot': OPERATIONAL_SYSTEM_PROMPT,
      'vsm-builder': OPERATIONAL_SYSTEM_PROMPT,
      'constraint-control': OPERATIONAL_SYSTEM_PROMPT,
      'decision-engine': OPERATIONAL_SYSTEM_PROMPT,
      'control-tower': OPERATIONAL_SYSTEM_PROMPT,
      'automation-pipeline': OPERATIONAL_SYSTEM_PROMPT,
      'robotics-feasibility': OPERATIONAL_SYSTEM_PROMPT,
      'logistics-automation': OPERATIONAL_SYSTEM_PROMPT,
      'rpa-scanner': OPERATIONAL_SYSTEM_PROMPT,
      'ai-discovery': OPERATIONAL_SYSTEM_PROMPT,
      'integration-diagnostic': OPERATIONAL_SYSTEM_PROMPT,
      'digital-value-pool': OPERATIONAL_SYSTEM_PROMPT,
      'legacy-analyzer': OPERATIONAL_SYSTEM_PROMPT,
      'data-inventory': OPERATIONAL_SYSTEM_PROMPT,
      'pain-to-solution': OPERATIONAL_SYSTEM_PROMPT,
      'pain-explorer': OPERATIONAL_SYSTEM_PROMPT,
      'process-automation': PROCESS_AUTOMATION_SYSTEM_PROMPT,
    };
    const basePrompt = promptMap[toolType] || PORTER_SYSTEM_PROMPT;
    const orgContext = formatForPrompt();

    return `${basePrompt}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===`;
  }, [toolType, formatForPrompt]);

  const extractObject = useCallback((content: string): Record<string, any> | null => {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('[useToolAI] Failed to extract object:', e);
      return null;
    }
  }, []);

  const currentStepDef = useMemo(() => {
    const stepDefs = getStepDefinitions();
    return stepDefs[currentStep - 1];
  }, [currentStep, getStepDefinitions]);

  // Send a message to the AI
  const sendMessage = useCallback(
    async (message: string) => {
      setError(null);

      try {
        const systemPrompt = getSystemPrompt();
        // Build context about current step
        const stepContext = currentStepDef
          ? `\n\nCURRENT STEP: ${currentStepDef.name}\nSTEP DESCRIPTION: ${currentStepDef.description}`
          : '';

        await startStream(
          message,
          currentSession?.chatHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })) || [],
          systemPrompt + stepContext
        );
      } catch (e) {
        setError('Failed to send message');
        console.error('[useToolAI] Error sending message:', e);
      }
    },
    [currentSession, currentStepDef, getSystemPrompt, startStream]
  );

  // Request AI suggestions for current step
  const requestSuggestions = useCallback(async () => {
    setError(null);

    const stepDefs = getStepDefinitions();
    const currentStepDef = stepDefs[currentStep - 1];

    if (!currentStepDef) return;

    let prompt = '';

    if (toolType === 'dynamic-swot') {
      if (currentStepDef.id === 'mission') {
        const swotData = currentSession?.inputData as SWOTData | undefined;
        prompt = `Act as an AI strategy mentor. Improve the mission brief for this Dynamic SWOT session.

Current mission context:
- Strategic question: ${swotData?.context?.goal || 'missing'}
- Scope: ${swotData?.context?.scope || 'missing'}
- Success signal: ${swotData?.context?.successSignal || 'missing'}
- Time horizon: ${swotData?.context?.timeframe || 'missing'}

Return JSON:
{"mission": {"goal": "...", "scope": "...", "successSignal": "...", "timeframe": "short|medium|long", "constraints": "...", "assumptions": "...", "kpiTarget": "..."}}`;
      } else if (currentStepDef.id === 'input') {
        const swotData = currentSession?.inputData as SWOTData | undefined;
        prompt = `Act as an AI strategy mentor. Based on the mission and organization context, propose 4-6 high-value signals for the Input & Exploration phase.

Mission:
- Strategic question: ${swotData?.context?.goal || 'missing'}
- Scope: ${swotData?.context?.scope || 'missing'}
- Success signal: ${swotData?.context?.successSignal || 'missing'}

Return JSON:
{"signals": [{"type": "interview|file|link|ai|benchmark", "content": "...", "sourceLabel": "...", "confidence": 1-5, "tags": ["..."], "evidenceType": "fact|observation|hypothesis", "state": "accepted|proposed|needs-evidence", "provenance": "..."}]}`;
      } else if (currentStepDef.id === 'swot') {
        const swotData = currentSession?.inputData as SWOTData | undefined;
        const signalsSummary = (swotData?.signals || [])
          .slice(0, 20)
          .map((signal) => `- [${signal.type}] ${signal.content}`)
          .join('\n');

        prompt = `Act as an AI strategy mentor. Turn the following signals into candidate SWOT items.

${signalsSummary || '- no explicit signals provided yet'}

Rules:
- keep items concrete
- avoid duplicates
- separate internal vs external
- classify each item into strengths, weaknesses, opportunities, or threats

Return JSON:
{"items": [{"text": "...", "impact": "high|medium|low", "quadrant": "strengths|weaknesses|opportunities|threats", "confidence": 1-5, "status": "accepted|proposed"}]}`;
      }
    } else if (toolType === 'market-forces') {
      if (
        ['rivalry', 'newEntrants', 'substitutes', 'buyerPower', 'supplierPower'].includes(
          currentStepDef.id
        )
      ) {
        prompt = `Act as an AI strategy mentor. Analyze the ${currentStepDef.name} force for this industry.

Provide:
1. A score from 1-5 (1=very low, 5=very high)
2. Key drivers of this force
3. Current trend (increasing/stable/decreasing)
4. Strategic implications

Be specific to the organization's industry and market position. Explain the "why", not only the score.`;
      }
    } else if (toolType === 'growth-paths') {
      if (
        [
          'market-penetration',
          'market-development',
          'product-development',
          'diversification',
        ].includes(currentStepDef.id)
      ) {
        prompt = `Act as an AI growth mentor. Suggest 3-5 initiatives for the ${currentStepDef.name} quadrant.

Keep them realistic, mutually distinguishable, and easy to compare in later discussion.

Return JSON:
{"initiatives": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;
      }
    } else if (toolType === 'portfolio-priority') {
      if (currentStepDef.id === 'portfolio-items') {
        prompt = `Act as an AI portfolio mentor. Propose 3-5 portfolio initiatives with market growth and share scores.

Bias toward explicit trade-offs and prioritization clarity.

Return JSON:
{"items": [{"title": "...", "description": "...", "marketGrowth": 3, "marketShare": 3, "investmentLevel": 3}]}`;
      }
    } else if (toolType === 'risk-uncertainty') {
      if (currentStepDef.id === 'assumptions') {
        prompt = `Act as an AI risk mentor. List 3-5 key assumptions with confidence (1-5). Return JSON:
{"assumptions": [{"text": "...", "confidence": 3}]}`;
      }
      if (currentStepDef.id === 'risks') {
        prompt = `Act as an AI risk mentor. List 3-5 strategic risks with probability/impact (1-5) and mitigation. Return JSON:
{"risks": [{"description": "...", "probability": 3, "impact": 3, "mitigation": "..."}]}`;
      }
      if (currentStepDef.id === 'scenarios') {
        prompt = `Act as an AI risk mentor. List 2-4 scenarios with likelihood (1-5) and notes. Return JSON:
{"scenarios": [{"title": "...", "likelihood": 3, "notes": "..."}]}`;
      }
    } else if (
      [
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
      ].includes(toolType)
    ) {
      if (currentStepDef.id !== 'context' && currentStepDef.id !== 'summary') {
        prompt = `Act as an AI operations mentor. Provide 3-5 concise items for ${currentStepDef.name}.

Prefer items that can later support applied conclusions and concrete outputs.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;
      }
    }

    if (prompt) {
      setPendingAction('suggestions');
      await sendMessage(prompt);
    }
  }, [toolType, currentStep, currentSession?.inputData, getStepDefinitions, sendMessage]);

  // Generate correlations (SWOT-specific)
  const generateCorrelations = useCallback(async () => {
    if (toolType !== 'dynamic-swot' || !currentSession) return;

    setError(null);

    const swotData = currentSession.inputData as any;
    const items = swotData.items || [];

    if (items.length < 4) {
      setError('Need at least 4 SWOT items to generate correlations');
      return;
    }

    const itemsSummary = items
      .map(
        (item: SWOTItem) =>
          `[${item.id}] ${item.quadrant.toUpperCase()}: ${item.text} (${item.impact} impact)`
      )
      .join('\n');

    const prompt = `Analyze these SWOT items and identify strategic correlations.
Act as an AI strategy mentor: explain the most meaningful tensions, not just mechanically pair items.

${itemsSummary}

Generate 4-6 strategic correlations that connect:
- Strengths with Opportunities (SO) - offensive strategies
- Weaknesses with Opportunities (WO) - reorientation strategies
- Strengths with Threats (ST) - defensive strategies
- Weaknesses with Threats (WT) - survival strategies

Return as JSON:
{"correlations": [{"items": ["id1", "id2"], "type": "SO|WO|ST|WT", "insight": "strategic insight", "initiativeProposal": "proposed action"}]}`;

    setPendingAction('correlations');
    await sendMessage(prompt);
  }, [toolType, currentSession, sendMessage]);

  // Generate summary and initiatives
  const generateSummary = useCallback(async () => {
    if (!currentSession) return;

    setError(null);

    let prompt = '';

    if (toolType === 'dynamic-swot') {
      const swotData = currentSession.inputData as any;
      const itemsSummary = (swotData.items || [])
        .map((item: SWOTItem) => `- ${item.quadrant.toUpperCase()}: ${item.text}`)
        .join('\n');

      prompt = `Based on this completed SWOT analysis, produce a consulting-grade finish:

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
    } else if (toolType === 'market-forces') {
      const porterData = currentSession.inputData as any;
      const forcesSummary = Object.entries(porterData.forces || {})
        .map(([key, force]: [string, any]) => `- ${force.name}: ${force.score}/5 (${force.trend})`)
        .join('\n');

      prompt = `Based on this Porter's Five Forces analysis, create a consulting-grade final summary:

${forcesSummary}

Provide:
1. Overall Industry Attractiveness Score (1-5)
2. Executive Summary (3-4 sentences)
3. Top 3 Strategic Implications
4. Applied Conclusions for the organization
5. 3-5 Competitive Initiative Recommendations

Return as JSON:
{"attractiveness": 3, "summary": "executive summary", "insights": ["insight 1", "insight 2"], "appliedConclusions": ["..."], "initiatives": [{"title": "...", "description": "...", "type": "...", "rationale": "..."}]}`;
    } else if (toolType === 'growth-paths') {
      prompt = `Summarize the Ansoff Matrix analysis in a way that can feed report and presentation creation:
1. Executive Summary (3-4 sentences)
2. Top 3 insights
3. Applied Conclusions
4. 3-5 initiative recommendations (with impact/effort)

Return JSON:
{"summary": "...", "insights": ["..."], "appliedConclusions": ["..."], "initiatives": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;
    } else if (toolType === 'portfolio-priority') {
      prompt = `Summarize portfolio priorities in a consulting-grade way:
1. Executive Summary
2. Top 3 insights
3. Applied Conclusions
4. 3-5 initiatives (with rationale)

Return JSON:
{"summary": "...", "insights": ["..."], "appliedConclusions": ["..."], "initiatives": [{"title": "...", "description": "...", "rationale": "..."}]}`;
    } else if (toolType === 'risk-uncertainty') {
      prompt = `Summarize risks and scenarios in a consulting-grade way:
1. Executive Summary
2. Top 3 insights
3. Applied Conclusions
4. 3-5 resilience initiatives

Return JSON:
{"summary": "...", "insights": ["..."], "appliedConclusions": ["..."], "initiatives": [{"title": "...", "description": "...", "rationale": "..."}]}`;
    } else if (
      [
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
      ].includes(toolType)
    ) {
      prompt = `Summarize the operational analysis:
1. Executive Summary
2. Top 3 insights
3. 3-5 operational initiatives

Return JSON:
{"summary": "...", "insights": ["..."], "initiatives": [{"title": "...", "description": "...", "rationale": "..."}]}`;
    }

    if (prompt) {
      setPendingAction('summary');
      await sendMessage(prompt);
    }
  }, [toolType, currentSession, sendMessage]);

  useEffect(() => {
    if (isStreaming || !pendingAction || !streamedContent || toolType !== 'dynamic-swot') return;

    const parsed = extractObject(streamedContent);
    if (!parsed) {
      setPendingAction(null);
      return;
    }

    if (pendingAction === 'suggestions' && currentStepDef) {
      if (currentStepDef.id === 'mission' && parsed.mission) {
        updateInputData({
          context: {
            ...(currentSession?.inputData as SWOTData | undefined)?.context,
            goal: typeof parsed.mission.goal === 'string' ? parsed.mission.goal : '',
            scope: typeof parsed.mission.scope === 'string' ? parsed.mission.scope : '',
            successSignal:
              typeof parsed.mission.successSignal === 'string' ? parsed.mission.successSignal : '',
            constraints:
              typeof parsed.mission.constraints === 'string' ? parsed.mission.constraints : '',
            assumptions:
              typeof parsed.mission.assumptions === 'string' ? parsed.mission.assumptions : '',
            kpiTarget: typeof parsed.mission.kpiTarget === 'string' ? parsed.mission.kpiTarget : '',
            timeframe:
              parsed.mission.timeframe === 'short' ||
              parsed.mission.timeframe === 'medium' ||
              parsed.mission.timeframe === 'long'
                ? parsed.mission.timeframe
                : 'medium',
          },
        } as Partial<SWOTData>);
      }

      if (currentStepDef.id === 'input') {
        const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
        const existingSignals = (
          (currentSession?.inputData as SWOTData | undefined)?.signals || []
        ).map((signal) => `${signal.type}:${signal.content.toLowerCase().trim()}`);

        signals.forEach((signal) => {
          if (!signal?.content || !signal?.type) return;
          const key = `${signal.type}:${String(signal.content).toLowerCase().trim()}`;
          if (existingSignals.includes(key)) return;
          addSWOTSignal({
            type: signal.type,
            content: String(signal.content),
            sourceLabel: String(signal.sourceLabel || 'AI mentor'),
            confidence: typeof signal.confidence === 'number' ? signal.confidence : 3,
            tags: Array.isArray(signal.tags) ? signal.tags.filter(Boolean) : [],
            evidenceType:
              signal.evidenceType === 'fact' ||
              signal.evidenceType === 'observation' ||
              signal.evidenceType === 'hypothesis'
                ? signal.evidenceType
                : 'observation',
            state:
              signal.state === 'accepted' ||
              signal.state === 'proposed' ||
              signal.state === 'needs-evidence'
                ? signal.state
                : 'proposed',
            provenance: String(signal.provenance || signal.sourceLabel || 'AI mentor'),
          });
        });
      }

      if (currentStepDef.id === 'swot') {
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        const existingItems = (
          (currentSession?.inputData as SWOTData | undefined)?.items || []
        ).map((item) => `${item.quadrant}:${item.text.toLowerCase().trim()}`);
        items.forEach((item) => {
          if (!item?.text || !item?.quadrant) return;
          const key = `${item.quadrant}:${String(item.text).toLowerCase().trim()}`;
          if (existingItems.includes(key)) return;
          addSWOTItem({
            text: String(item.text),
            quadrant: item.quadrant,
            impact: item.impact || 'medium',
            source: 'ai',
            confidence: typeof item.confidence === 'number' ? item.confidence : 3,
            status: item.status === 'accepted' ? 'accepted' : 'proposed',
          });
        });
      }
    }

    if (pendingAction === 'correlations') {
      const correlations = Array.isArray(parsed.correlations) ? parsed.correlations : [];
      const currentCorrelations = ((currentSession?.inputData as SWOTData | undefined)
        ?.correlations || []) as SWOTCorrelation[];
      const normalizedCorrelations = correlations.filter(
        (corr) =>
          Array.isArray(corr?.items) &&
          corr.items.length >= 2 &&
          typeof corr?.type === 'string' &&
          typeof corr?.insight === 'string'
      );
      normalizedCorrelations.forEach((corr) => {
        const duplicate = currentCorrelations.some(
          (existing) =>
            existing.type === corr.type &&
            existing.insight === corr.insight &&
            existing.items.join('|') === corr.items.join('|')
        );
        if (!duplicate) {
          addCorrelation({
            items: corr.items,
            type: corr.type,
            insight: corr.insight,
            initiativeProposal: corr.initiativeProposal,
          });
        }
      });

      setSWOTTensions(
        normalizedCorrelations.map((corr) => ({
          title:
            corr.type === 'SO'
              ? 'Attack opportunity'
              : corr.type === 'WO'
                ? 'Repair to capture'
                : corr.type === 'ST'
                  ? 'Defend with strength'
                  : 'Protect against exposure',
          type:
            corr.type === 'SO'
              ? 'attack'
              : corr.type === 'WO'
                ? 'repair'
                : corr.type === 'ST'
                  ? 'defend'
                  : 'protect',
          linkedCorrelationIds: [],
          linkedItemIds: corr.items,
          insight: corr.insight,
          whyNow: corr.initiativeProposal,
          confidence: 4,
        }))
      );
    }

    if (pendingAction === 'summary') {
      const initiatives = Array.isArray(parsed.initiatives) ? parsed.initiatives : [];
      const moves = Array.isArray(parsed.moves) ? parsed.moves : [];
      const outputCandidates = Array.isArray(parsed.outputCandidates)
        ? parsed.outputCandidates
        : [];

      setSWOTSummary({
        executiveSummary: typeof parsed.summary === 'string' ? parsed.summary : '',
        keyInsights: Array.isArray(parsed.insights) ? parsed.insights.filter(Boolean) : [],
        appliedConclusions: Array.isArray(parsed.appliedConclusions)
          ? parsed.appliedConclusions.filter(Boolean)
          : [],
        recommendedInitiatives: initiatives.map((initiative) => ({
          id: '',
          title: initiative.title,
          description: initiative.description || '',
          type: initiative.type || 'strategic',
          source: toolType,
          linkedItems: initiative.linkedItems || [],
          estimatedImpact: initiative.estimatedImpact || 'medium',
          estimatedEffort: initiative.estimatedEffort || 'medium',
          rationale: initiative.rationale || '',
        })),
      });

      setSWOTMoves(
        moves.map((move) => ({
          title: move.title,
          category: move.category || 'quick-win',
          rationale: move.rationale || '',
          linkedTensionIds: move.linkedTensionIds || [],
          linkedItemIds: move.linkedItemIds || [],
          expectedImpact: move.expectedImpact || 'medium',
          estimatedEffort: move.estimatedEffort || 'medium',
          riskLevel: move.riskLevel || 'medium',
          confidence: typeof move.confidence === 'number' ? move.confidence : 3,
          firstStep: move.firstStep || '',
        }))
      );

      setSWOTOutputCandidates(
        outputCandidates.map((candidate) => ({
          outputType: candidate.outputType || 'initiative',
          title: candidate.title,
          description: candidate.description || '',
          linkedMoveIds: candidate.linkedMoveIds || [],
          linkedItemIds: candidate.linkedItemIds || [],
          rationale: candidate.rationale || '',
          readiness:
            candidate.readiness === 'ready-for-initiative' ||
            candidate.readiness === 'ready-for-presentation' ||
            candidate.readiness === 'ready-for-report' ||
            candidate.readiness === 'keep-as-idea' ||
            candidate.readiness === 'blocked'
              ? candidate.readiness
              : 'keep-as-idea',
        }))
      );

      setInitiatives(
        initiatives.map((initiative) => ({
          title: initiative.title,
          description: initiative.description || '',
          type: initiative.type || 'strategic',
          source: toolType,
          linkedItems: initiative.linkedItems || [],
          estimatedImpact: initiative.estimatedImpact || 'medium',
          estimatedEffort: initiative.estimatedEffort || 'medium',
          rationale: initiative.rationale || '',
        }))
      );
    }

    setPendingAction(null);
  }, [
    addSWOTSignal,
    addCorrelation,
    addSWOTItem,
    currentSession?.inputData,
    currentStepDef,
    extractObject,
    isStreaming,
    pendingAction,
    updateInputData,
    setInitiatives,
    setSWOTMoves,
    setSWOTOutputCandidates,
    setSWOTSummary,
    setSWOTTensions,
    streamedContent,
    toolType,
  ]);

  // Get opening question for current step
  const getStepOpeningQuestion = useCallback((): string => {
    const stepDefs = getStepDefinitions();
    const currentStepDef = stepDefs[currentStep - 1];

    if (!currentStepDef) return '';

    const questions: Record<string, Record<string, string>> = {
      'dynamic-swot': {
        mission:
          'What decision are we supporting, what is the scope, and what will success look like?',
        input:
          'What signals do we already have from interviews, materials, and external context that should shape this analysis?',
        swot: 'Let me turn the captured signals into a high-quality SWOT structure.',
        insights:
          "I'll synthesize the matrix into tensions, applied conclusions, and strategic moves.",
        outputs: 'Let me prepare the final source summary and downstream outputs.',
      },
      'market-forces': {
        context: 'What industry and market are you analyzing? Define your competitive position.',
        rivalry: 'How intense is competition among existing players in your industry?',
        newEntrants: 'How easy is it for new competitors to enter your market?',
        substitutes: 'What substitute products or services threaten your offerings?',
        buyerPower: 'How much bargaining power do your customers have?',
        supplierPower: 'How much bargaining power do your suppliers have?',
        summary: 'Let me summarize the competitive landscape and propose initiatives.',
      },
      'growth-paths': {
        context: 'What growth goal and scope are you analyzing?',
        'market-penetration': 'What initiatives grow in current markets with current products?',
        'market-development': 'What initiatives expand into new markets?',
        'product-development': 'What new products could accelerate growth?',
        diversification: 'What initiatives combine new products and new markets?',
        summary: 'Let me summarize growth paths and propose initiatives.',
      },
      'portfolio-priority': {
        context: 'What portfolio scope and constraints are you analyzing?',
        'portfolio-items': 'List initiatives and assess growth and share.',
        'portfolio-matrix': 'Let me summarize the portfolio matrix.',
        summary: 'Let me summarize portfolio priorities and initiatives.',
      },
      'risk-uncertainty': {
        context: 'What risk scope and time horizon are you analyzing?',
        assumptions: 'What key assumptions underpin the strategy?',
        risks: 'What are the strategic risks and mitigations?',
        scenarios: 'What scenarios could materially impact outcomes?',
        summary: 'Let me summarize risks and propose resilience initiatives.',
      },
      'sop-builder': {
        context: 'What operational scope are you standardizing?',
        standards: 'What standards and quality criteria are required?',
        checklists: 'What checklist items ensure compliance?',
        summary: 'Let me summarize SOP and propose initiatives.',
      },
      'a3-problem-solving': {
        context: 'What problem scope are you analyzing?',
        problem: 'Describe the problem and its impact.',
        'root-cause': 'What are the root causes?',
        countermeasures: 'What countermeasures will address root causes?',
        summary: 'Let me summarize A3 and propose initiatives.',
      },
      'smed-planner': {
        context: 'What changeover process are you improving?',
        'changeover-steps': 'List key changeover steps and durations.',
        improvements: 'What quick wins and investments reduce time?',
        summary: 'Let me summarize SMED and propose initiatives.',
      },
      'dms-builder': {
        context: 'What DMS scope and teams are involved?',
        kpis: 'What KPIs should be tracked daily?',
        escalation: 'What escalation rules should apply?',
        summary: 'Let me summarize DMS and propose initiatives.',
      },
      'inventory-autopilot': {
        context: 'What inventory scope are you optimizing?',
        'sku-classification': 'What SKU classes and criteria apply?',
        replenishment: 'What replenishment policies are needed?',
        summary: 'Let me summarize inventory and propose initiatives.',
      },
    };

    return questions[toolType]?.[currentStepDef.id] || '';
  }, [toolType, currentStep, getStepDefinitions]);

  return {
    isStreaming,
    streamedContent,
    error,
    sendMessage,
    requestSuggestions,
    generateCorrelations,
    generateSummary,
    abortStream,
    getStepOpeningQuestion,
  };
};

export default useToolAI;
