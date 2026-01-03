/**
 * StrategyAgent - Expert in strategic planning and vision
 * 
 * Specializations:
 * - Corporate strategy and vision alignment
 * - Market positioning and competitive analysis
 * - Digital transformation strategy
 * - Strategic initiative prioritization
 * - Long-term roadmap planning
 */

import { BaseAgent } from './baseAgent.js';
import llmService from '../llmService.js';

export class StrategyAgent extends BaseAgent {
    constructor(config = {}) {
        super({
            name: 'StrategyAgent',
            domain: 'strategy',
            expertise: [
                'Corporate Strategy',
                'Digital Transformation',
                'Market Analysis',
                'Competitive Positioning',
                'Strategic Planning',
                'Vision Alignment',
                'Portfolio Management',
                'Business Model Innovation'
            ],
            systemPrompt: `You are a Senior Strategy Consultant with 20+ years of experience at top-tier firms (McKinsey, BCG, Bain level).

Your role is to provide strategic guidance on:
- Vision and mission alignment
- Competitive positioning and market strategy
- Digital transformation roadmaps
- Strategic initiative prioritization
- Long-term value creation

Communication style:
- Think like a CEO advisor
- Focus on strategic implications, not operational details
- Use frameworks (Porter's 5 Forces, Blue Ocean, etc.) when relevant
- Quantify impact when possible
- Be direct and actionable`,
            confidenceThreshold: 0.75,
            debateWeight: 1.2, // Strategy often leads discussions
            ...config
        });
    }

    getKeywords() {
        return [
            'strategy', 'strategic', 'vision', 'mission', 'goal', 'objective',
            'competitive', 'market', 'position', 'differentiation', 'advantage',
            'transform', 'transformation', 'digital', 'innovation', 'disrupt',
            'roadmap', 'plan', 'priority', 'prioritize', 'focus',
            'long-term', 'future', 'growth', 'scale', 'expand',
            'portfolio', 'initiative', 'alignment', 'direction'
        ];
    }

    async process(query, context) {
        const prompt = this.buildStrategyPrompt(query, context);

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: this.maxTokens,
                temperature: this.temperature,
                model: await this.resolveModelConfig(context)
            });

            const analysis = this.parseResponse(response);

            // Remember this interaction
            this.remember({
                query,
                insight: analysis.mainInsight,
                recommendations: analysis.recommendations
            });

            return {
                agentId: this.id,
                agentName: this.name,
                domain: this.domain,
                ...analysis,
                metadata: {
                    model: context.preferredModel || 'default',
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error(`[StrategyAgent] Error processing query:`, error);
            return this.getFallbackResponse(query, context);
        }
    }

    buildStrategyPrompt(query, context) {
        const basePrompt = this.buildPrompt(query, context);

        // Add strategy-specific context
        let strategyContext = '';

        if (context.assessment?.scores) {
            const scores = context.assessment.scores;
            strategyContext += `\nMATURITY ASSESSMENT:
- Strategy & Vision: ${scores.strategy || 'Not assessed'}
- Digital Capabilities: ${scores.digital || 'Not assessed'}
- Innovation: ${scores.innovation || 'Not assessed'}`;
        }

        if (context.initiatives?.length) {
            const strategicInitiatives = context.initiatives
                .filter(i => i.category === 'strategic' || i.priority === 'high')
                .slice(0, 5);

            if (strategicInitiatives.length) {
                strategyContext += `\nKEY STRATEGIC INITIATIVES:
${strategicInitiatives.map(i => `- ${i.name}: ${i.status || 'Unknown status'}`).join('\n')}`;
            }
        }

        if (context.goals?.length) {
            strategyContext += `\nSTRATEGIC GOALS:
${context.goals.slice(0, 5).map(g => `- ${g.name}: ${g.progress || 0}% complete`).join('\n')}`;
        }

        return `${basePrompt}

ADDITIONAL STRATEGIC CONTEXT:
${strategyContext || 'No additional strategic data available'}

FORMAT YOUR RESPONSE AS:
## Strategic Assessment
[Your high-level strategic view]

## Key Insights
1. [Insight 1]
2. [Insight 2]
3. [Insight 3]

## Strategic Recommendations
1. [Recommendation with rationale]
2. [Recommendation with rationale]
3. [Recommendation with rationale]

## Strategic Risks
- [Risk and mitigation]

## Confidence: [X]%
[Brief explanation of confidence level]`;
    }

    parseResponse(response) {
        // Extract structured data from response
        const text = response.text || response;

        // Simple parsing - in production, use more robust extraction
        const confidenceMatch = text.match(/Confidence:\s*(\d+)/i);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.7;

        // Extract main insight (first substantial paragraph)
        const insightMatch = text.match(/## Strategic Assessment\s*([\s\S]*?)(?=##|$)/i);
        const mainInsight = insightMatch
            ? insightMatch[1].trim().split('\n')[0]
            : 'Strategic analysis completed';

        // Extract recommendations
        const recsMatch = text.match(/## Strategic Recommendations\s*([\s\S]*?)(?=##|$)/i);
        const recommendations = recsMatch
            ? recsMatch[1].trim().split('\n').filter(l => l.match(/^\d+\./)).map(l => l.replace(/^\d+\.\s*/, ''))
            : [];

        // Extract risks
        const risksMatch = text.match(/## Strategic Risks\s*([\s\S]*?)(?=##|$)/i);
        const risks = risksMatch
            ? risksMatch[1].trim().split('\n').filter(l => l.startsWith('-')).map(l => l.replace(/^-\s*/, ''))
            : [];

        return {
            mainInsight,
            fullAnalysis: text,
            recommendations,
            risks,
            confidence,
            frameworks: this.detectFrameworks(text)
        };
    }

    detectFrameworks(text) {
        const frameworks = [];
        const frameworkPatterns = [
            { name: "Porter's Five Forces", pattern: /porter|five forces/i },
            { name: 'Blue Ocean Strategy', pattern: /blue ocean/i },
            { name: 'SWOT Analysis', pattern: /swot/i },
            { name: 'BCG Matrix', pattern: /bcg|growth.share/i },
            { name: 'Value Chain', pattern: /value chain/i },
            { name: 'Core Competencies', pattern: /core competenc/i },
            { name: 'Strategic Intent', pattern: /strategic intent/i },
            { name: 'Balanced Scorecard', pattern: /balanced scorecard/i }
        ];

        for (const fw of frameworkPatterns) {
            if (fw.pattern.test(text)) {
                frameworks.push(fw.name);
            }
        }

        return frameworks;
    }

    getFallbackResponse(query, context) {
        return {
            agentId: this.id,
            agentName: this.name,
            domain: this.domain,
            mainInsight: 'Unable to complete strategic analysis due to technical issues.',
            fullAnalysis: 'Please retry the query or contact support.',
            recommendations: [
                'Review current strategic priorities',
                'Assess alignment with organizational goals',
                'Consider competitive landscape implications'
            ],
            risks: ['Analysis incomplete - manual review recommended'],
            confidence: 0.3,
            frameworks: [],
            error: true
        };
    }

    /**
     * Generate strategic initiative recommendations
     */
    async recommendInitiatives(context) {
        const prompt = `${this.systemPrompt}

Based on the following organizational context, recommend 3-5 strategic initiatives:

ORGANIZATION: ${context.organization?.name || 'Unknown'}
INDUSTRY: ${context.organization?.industry || 'Unknown'}
CURRENT MATURITY: ${context.assessment?.overallScore || 'Not assessed'}/5

EXISTING INITIATIVES:
${context.initiatives?.map(i => `- ${i.name} (${i.status})`).join('\n') || 'None'}

STRATEGIC GOALS:
${context.goals?.map(g => g.name).join('\n') || 'Not defined'}

Recommend NEW strategic initiatives that:
1. Fill gaps in current portfolio
2. Align with industry best practices
3. Build on organizational strengths
4. Address key weaknesses

FORMAT:
For each initiative provide:
- Name
- Strategic rationale
- Expected impact (High/Medium/Low)
- Estimated timeline
- Key success factors`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 2000,
                temperature: 0.8
            });

            return {
                agentId: this.id,
                recommendations: response.text || response,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[StrategyAgent] Error generating initiative recommendations:', error);
            return { error: true, message: error.message };
        }
    }
}

export default StrategyAgent;
