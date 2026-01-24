/**
 * useToolAI - Hook for AI interactions in strategic tools
 *
 * Wraps useAIStream to provide tool-specific AI capabilities:
 * - Structured prompts with organization context
 * - JSON extraction from AI responses
 * - Tool-specific analysis generation
 */

import { useCallback, useState } from 'react';

import { useAIStream } from '@/hooks/useAIStream';
import {
  InitiativeDraft,
  SWOTCorrelation,
  SWOTItem,
  ToolType,
  useToolStore,
} from '@/store/useToolStore';

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

const BASE_SYSTEM_PROMPT = `You are an expert strategic consultant helping users perform strategic analysis.
You have deep knowledge of business strategy frameworks and can provide actionable insights.

RESPONSE GUIDELINES:
1. Be concise but comprehensive
2. Use bullet points for clarity
3. Provide specific, actionable recommendations
4. Reference the organization's context when relevant
5. When generating JSON, ensure it's valid and properly formatted

LANGUAGE: Respond in the same language as the user's input (Polish or English).`;

const SWOT_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are guiding the user through a Dynamic SWOT analysis.

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

const PORTER_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are guiding the user through Porter's Five Forces analysis.

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

const GROWTH_PATHS_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are guiding the user through the Ansoff Matrix (Growth Paths).

QUADRANTS:
1. Market Penetration - current products, current markets
2. Market Development - current products, new markets
3. Product Development - new products, current markets
4. Diversification - new products, new markets

When generating initiatives, return JSON:
{"initiatives": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;

const PORTFOLIO_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are guiding the user through a BCG-style portfolio prioritization.

DIMENSIONS:
- Market Growth (1-5)
- Market Share (1-5)

Categories: star, cash-cow, question-mark, dog.
Provide priority and rationale where relevant.`;

const RISK_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are guiding the user through a Strategic Risk & Uncertainty assessment.

Provide assumptions, risks, scenarios, and mitigation suggestions.
Use concise, actionable entries.`;

const OPERATIONAL_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are guiding the user through an Operational Excellence tool.

Provide concise, actionable items for each operational section.
When generating items, return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;

// ==================== HOOK ====================

export const useToolAI = ({ toolType }: UseToolAIOptions): UseToolAIReturn => {
  const { formatForPrompt } = useOrganizationContext();
  const {
    currentSession,
    currentStep,
    getStepDefinitions,
    addSWOTItem,
    addCorrelation,
    addInitiative,
  } = useToolStore();

  const [error, setError] = useState<string | null>(null);

  const { startStream, isStreaming, streamedContent, abortStream } = useAIStream();

  // Get the appropriate system prompt
  const getSystemPrompt = useCallback(() => {
    const promptMap: Record<ToolType, string> = {
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
    };
    const basePrompt = promptMap[toolType] || PORTER_SYSTEM_PROMPT;
    const orgContext = formatForPrompt();

    return `${basePrompt}

=== ORGANIZATION CONTEXT ===
${orgContext}
=== END CONTEXT ===`;
  }, [toolType, formatForPrompt]);

  // Extract JSON from AI response
  const extractJSON = useCallback((content: string, key: string): any[] => {
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed[key] || [];
      }
    } catch (e) {
      console.error('[useToolAI] Failed to extract JSON:', e);
    }
    return [];
  }, []);

  // Send a message to the AI
  const sendMessage = useCallback(
    async (message: string) => {
      setError(null);

      try {
        const systemPrompt = getSystemPrompt();
        const stepDefs = getStepDefinitions();
        const currentStepDef = stepDefs[currentStep - 1];

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
    [getSystemPrompt, currentSession, currentStep, getStepDefinitions, startStream]
  );

  // Request AI suggestions for current step
  const requestSuggestions = useCallback(async () => {
    setError(null);

    const stepDefs = getStepDefinitions();
    const currentStepDef = stepDefs[currentStep - 1];

    if (!currentStepDef) return;

    let prompt = '';

    if (toolType === 'dynamic-swot') {
      if (['strengths', 'weaknesses', 'opportunities', 'threats'].includes(currentStepDef.id)) {
        prompt = `Based on the organization context, suggest 5 ${currentStepDef.id} for this SWOT analysis.

Consider the industry, company size, and current strategic situation.

Return your suggestions as JSON in this exact format:
{"items": [{"text": "specific item description", "impact": "high|medium|low", "quadrant": "${currentStepDef.id}"}]}

Provide specific, actionable items relevant to this organization.`;
      }
    } else if (toolType === 'market-forces') {
      if (
        ['rivalry', 'newEntrants', 'substitutes', 'buyerPower', 'supplierPower'].includes(
          currentStepDef.id
        )
      ) {
        prompt = `Analyze the ${currentStepDef.name} force for this industry.

Provide:
1. A score from 1-5 (1=very low, 5=very high)
2. Key drivers of this force
3. Current trend (increasing/stable/decreasing)
4. Strategic implications

Be specific to the organization's industry and market position.`;
      }
    } else if (toolType === 'growth-paths') {
      if (
        ['market-penetration', 'market-development', 'product-development', 'diversification'].includes(
          currentStepDef.id
        )
      ) {
        prompt = `Suggest 3-5 initiatives for the ${currentStepDef.name} quadrant.

Return JSON:
{"initiatives": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;
      }
    } else if (toolType === 'portfolio-priority') {
      if (currentStepDef.id === 'portfolio-items') {
        prompt = `Propose 3-5 portfolio initiatives with market growth and share scores.

Return JSON:
{"items": [{"title": "...", "description": "...", "marketGrowth": 3, "marketShare": 3, "investmentLevel": 3}]}`;
      }
    } else if (toolType === 'risk-uncertainty') {
      if (currentStepDef.id === 'assumptions') {
        prompt = `List 3-5 key assumptions with confidence (1-5). Return JSON:
{"assumptions": [{"text": "...", "confidence": 3}]}`;
      }
      if (currentStepDef.id === 'risks') {
        prompt = `List 3-5 strategic risks with probability/impact (1-5) and mitigation. Return JSON:
{"risks": [{"description": "...", "probability": 3, "impact": 3, "mitigation": "..."}]}`;
      }
      if (currentStepDef.id === 'scenarios') {
        prompt = `List 2-4 scenarios with likelihood (1-5) and notes. Return JSON:
{"scenarios": [{"title": "...", "likelihood": 3, "notes": "..."}]}`;
      }
    } else if (
      ['sop-builder', 'a3-problem-solving', 'smed-planner', 'dms-builder', 'inventory-autopilot'].includes(
        toolType
      )
    ) {
      if (currentStepDef.id !== 'context' && currentStepDef.id !== 'summary') {
        prompt = `Provide 3-5 concise items for ${currentStepDef.name}.

Return JSON:
{"items": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;
      }
    }

    if (prompt) {
      await sendMessage(prompt);
    }
  }, [toolType, currentStep, getStepDefinitions, sendMessage]);

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

    const prompt = `Analyze these SWOT items and identify strategic correlations:

${itemsSummary}

Generate 4-6 strategic correlations that connect:
- Strengths with Opportunities (SO) - offensive strategies
- Weaknesses with Opportunities (WO) - reorientation strategies
- Strengths with Threats (ST) - defensive strategies
- Weaknesses with Threats (WT) - survival strategies

Return as JSON:
{"correlations": [{"items": ["id1", "id2"], "type": "SO|WO|ST|WT", "insight": "strategic insight", "initiativeProposal": "proposed action"}]}`;

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

      prompt = `Based on this completed SWOT analysis:

${itemsSummary}

Provide:
1. Executive Summary (3-4 sentences)
2. Top 3 Key Insights
3. 3-5 Strategic Initiative Recommendations

For initiatives, return as JSON:
{"summary": "executive summary text", "insights": ["insight 1", "insight 2", "insight 3"], "initiatives": [{"title": "Initiative Name", "description": "What it does", "type": "strategic|operational|defensive|growth", "estimatedImpact": "high|medium|low", "estimatedEffort": "high|medium|low", "rationale": "Why this matters"}]}`;
    } else if (toolType === 'market-forces') {
      const porterData = currentSession.inputData as any;
      const forcesSummary = Object.entries(porterData.forces || {})
        .map(([key, force]: [string, any]) => `- ${force.name}: ${force.score}/5 (${force.trend})`)
        .join('\n');

      prompt = `Based on this Porter's Five Forces analysis:

${forcesSummary}

Provide:
1. Overall Industry Attractiveness Score (1-5)
2. Executive Summary (3-4 sentences)
3. Top 3 Strategic Implications
4. 3-5 Competitive Initiative Recommendations

Return as JSON:
{"attractiveness": 3, "summary": "executive summary", "insights": ["insight 1", "insight 2"], "initiatives": [{"title": "...", "description": "...", "type": "...", "rationale": "..."}]}`;
    } else if (toolType === 'growth-paths') {
      prompt = `Summarize the Ansoff Matrix analysis:
1. Executive Summary (3-4 sentences)
2. Top 3 insights
3. 3-5 initiative recommendations (with impact/effort)

Return JSON:
{"summary": "...", "insights": ["..."], "initiatives": [{"title": "...", "description": "...", "impact": "high|medium|low", "effort": "high|medium|low"}]}`;
    } else if (toolType === 'portfolio-priority') {
      prompt = `Summarize portfolio priorities:
1. Executive Summary
2. Top 3 insights
3. 3-5 initiatives (with rationale)

Return JSON:
{"summary": "...", "insights": ["..."], "initiatives": [{"title": "...", "description": "...", "rationale": "..."}]}`;
    } else if (toolType === 'risk-uncertainty') {
      prompt = `Summarize risks and scenarios:
1. Executive Summary
2. Top 3 insights
3. 3-5 resilience initiatives

Return JSON:
{"summary": "...", "insights": ["..."], "initiatives": [{"title": "...", "description": "...", "rationale": "..."}]}`;
    } else if (
      ['sop-builder', 'a3-problem-solving', 'smed-planner', 'dms-builder', 'inventory-autopilot'].includes(
        toolType
      )
    ) {
      prompt = `Summarize the operational analysis:
1. Executive Summary
2. Top 3 insights
3. 3-5 operational initiatives

Return JSON:
{"summary": "...", "insights": ["..."], "initiatives": [{"title": "...", "description": "...", "rationale": "..."}]}`;
    }

    if (prompt) {
      await sendMessage(prompt);
    }
  }, [toolType, currentSession, sendMessage]);

  // Get opening question for current step
  const getStepOpeningQuestion = useCallback((): string => {
    const stepDefs = getStepDefinitions();
    const currentStepDef = stepDefs[currentStep - 1];

    if (!currentStepDef) return '';

    const questions: Record<string, Record<string, string>> = {
      'dynamic-swot': {
        context: 'What strategic goal are you analyzing? Define the scope and timeframe.',
        strengths: 'What internal strengths give your organization a competitive advantage?',
        weaknesses: 'What internal weaknesses need to be addressed?',
        opportunities: 'What external opportunities can your organization leverage?',
        threats: 'What external threats could impact your organization?',
        correlations:
          "I'll analyze connections between your SWOT elements to identify strategic patterns.",
        summary: 'Let me summarize the analysis and propose strategic initiatives.',
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
