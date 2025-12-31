/**
 * Intelligence AI Service
 * 
 * AI prompts and functions for the Project Intelligence Hub
 * Handles insight detection and structured interviews
 */

import { sendMessageToAI, AIMessageHistory } from './gemini';
import { InsightCategory, DetectedInsight, InterviewProgress, PMODomainId } from '../../types';

/**
 * System prompt for Project Intelligence interviews
 */
export const INTELLIGENCE_SYSTEM_PROMPT = `You are an expert Project Intelligence Assistant for Consultify, a PMO platform.

Your role is to help capture and organize project knowledge through structured conversations.

CAPABILITIES:
1. Conduct structured interviews to gather project information
2. Detect and extract insights from conversations (objectives, stakeholders, risks, assumptions, constraints, decisions, dependencies, success criteria)
3. Ask clarifying questions to ensure completeness
4. Organize information according to PMO best practices

INTERVIEW TOPICS (follow this order naturally):
1. Project Context - What is the project about? What problem are we solving?
2. Objectives - What are the main goals? What outcomes do we expect?
3. Stakeholders - Who are the key people? Who is the sponsor?
4. Scope - What is in scope? What is out of scope?
5. Risks & Issues - What could go wrong? Are there known issues?
6. Assumptions - What are we assuming to be true? What constraints exist?
7. Success Criteria - How will we measure success? What are the KPIs?
8. Dependencies - What external dependencies exist? What do we need from others?

INSIGHT CATEGORIES:
- objective: Project goals and expected outcomes (PMO Domain: BENEFITS_REALIZATION)
- stakeholder: Key people and their roles (PMO Domain: RESOURCE_RESPONSIBILITY)
- risk: Potential problems and mitigations (PMO Domain: RISK_ISSUE_MANAGEMENT)
- assumption: Things assumed to be true (PMO Domain: SCOPE_CHANGE_CONTROL)
- constraint: Limitations and boundaries (PMO Domain: SCOPE_CHANGE_CONTROL)
- decision: Key decisions made (PMO Domain: GOVERNANCE_DECISION_MAKING)
- dependency: External dependencies (PMO Domain: SCHEDULE_MILESTONES)
- success_criteria: How success is measured (PMO Domain: PERFORMANCE_MONITORING)

BEHAVIOR:
- Be concise and professional
- Ask one question at a time
- Acknowledge information briefly, then probe deeper
- When you detect potential insights, mention them naturally: "I noted that [X] seems to be a key objective..."
- Guide the conversation through topics naturally, don't announce phases
- If information is vague, ask clarifying questions

Remember: You are helping to build a comprehensive project knowledge base. Every piece of information matters.`;

/**
 * Prompt for detecting insights from text
 */
export const INSIGHT_DETECTION_PROMPT = `Analyze the following text and extract any project insights you can identify.

For each insight found, provide:
- category: one of (objective, stakeholder, risk, assumption, constraint, decision, dependency, success_criteria)
- title: a concise title (max 100 chars)
- description: the full insight text
- confidence: high, medium, or low
- sourceQuote: the relevant quote from the original text

Return a JSON array of insights. If no insights found, return an empty array.

Example output:
[
  {
    "category": "stakeholder",
    "title": "John Smith as Project Sponsor",
    "description": "John Smith from the Legal department will be the project sponsor, responsible for final approval decisions.",
    "confidence": "high",
    "sourceQuote": "John from Legal will sponsor this project"
  }
]

TEXT TO ANALYZE:
`;

/**
 * Detect insights from AI response text
 */
export const detectInsightsFromResponse = async (
    responseText: string,
    conversationHistory: AIMessageHistory[] = []
): Promise<DetectedInsight[]> => {
    if (!responseText || responseText.length < 20) {
        return [];
    }

    try {
        const prompt = INSIGHT_DETECTION_PROMPT + responseText;
        
        const result = await sendMessageToAI(
            [], // No history needed for detection
            prompt,
            'You are an insight extraction assistant. Extract project insights from text and return them as a JSON array.'
        );

        if (!result) return [];

        // Try to parse JSON from response
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];

        const parsed = JSON.parse(jsonMatch[0]);
        
        if (!Array.isArray(parsed)) return [];

        // Validate and map to DetectedInsight type
        return parsed
            .filter(item => 
                item.category && 
                item.title && 
                ['objective', 'stakeholder', 'risk', 'assumption', 'constraint', 'decision', 'dependency', 'success_criteria'].includes(item.category)
            )
            .map(item => ({
                category: item.category as InsightCategory,
                title: String(item.title).slice(0, 100),
                content: { description: item.description || item.title },
                confidence: (['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium') as 'high' | 'medium' | 'low',
                sourceQuote: item.sourceQuote || undefined
            }));

    } catch (error) {
        console.error('[Intelligence] Insight detection error:', error);
        return [];
    }
};

/**
 * Generate interview questions for a specific topic
 */
export const getInterviewQuestions = (topic: string): string[] => {
    const questions: Record<string, string[]> = {
        context: [
            "Can you briefly describe what this project is about?",
            "What specific problem or opportunity is this project addressing?",
            "Why is this project important now?"
        ],
        objectives: [
            "What are the main goals you want to achieve with this project?",
            "What specific outcomes do you expect?",
            "How does this project align with broader organizational goals?"
        ],
        stakeholders: [
            "Who is the executive sponsor for this project?",
            "Who are the key stakeholders who will be impacted?",
            "Who will be making the final decisions?"
        ],
        scope: [
            "What is definitely included in the scope of this project?",
            "Are there any areas explicitly out of scope?",
            "Are there any boundaries or limitations we should be aware of?"
        ],
        risks: [
            "What are the main risks that could impact this project?",
            "Are there any known issues we should be tracking?",
            "What could prevent us from achieving our objectives?"
        ],
        assumptions: [
            "What key assumptions are we making about this project?",
            "What constraints exist (budget, time, resources)?",
            "What needs to be true for this project to succeed?"
        ],
        success: [
            "How will we know if this project is successful?",
            "What metrics or KPIs will we track?",
            "What does 'done' look like for this project?"
        ],
        dependencies: [
            "What external dependencies does this project have?",
            "Are we waiting on anything from other teams or vendors?",
            "What do we need from others to proceed?"
        ]
    };

    return questions[topic] || [];
};

/**
 * Map insight category to PMO Domain
 */
export const getCategoryPMODomain = (category: InsightCategory): PMODomainId => {
    const mapping: Record<InsightCategory, PMODomainId> = {
        objective: PMODomainId.BENEFITS_REALIZATION,
        stakeholder: PMODomainId.RESOURCE_RESPONSIBILITY,
        risk: PMODomainId.RISK_ISSUE_MANAGEMENT,
        assumption: PMODomainId.SCOPE_CHANGE_CONTROL,
        constraint: PMODomainId.SCOPE_CHANGE_CONTROL,
        decision: PMODomainId.GOVERNANCE_DECISION_MAKING,
        dependency: PMODomainId.SCHEDULE_MILESTONES,
        success_criteria: PMODomainId.PERFORMANCE_MONITORING
    };
    return mapping[category];
};

/**
 * Suggest next interview topic based on progress
 */
export const suggestNextTopic = (progress: InterviewProgress): string | null => {
    const topicOrder = ['context', 'objectives', 'stakeholders', 'scope', 'risks', 'assumptions', 'success', 'dependencies'];
    
    for (const topic of topicOrder) {
        if (!progress.completed.includes(topic)) {
            return topic;
        }
    }
    
    return null; // All topics covered
};

export const IntelligenceAI = {
    SYSTEM_PROMPT: INTELLIGENCE_SYSTEM_PROMPT,
    detectInsightsFromResponse,
    getInterviewQuestions,
    getCategoryPMODomain,
    suggestNextTopic
};

export default IntelligenceAI;

