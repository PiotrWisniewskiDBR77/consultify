/**
 * ChangeAgent - Expert in change management and organizational transformation
 * 
 * Specializations:
 * - ADKAR methodology
 * - Stakeholder management
 * - Communication strategies
 * - Resistance management
 * - Training and adoption
 * - Culture transformation
 */

import { BaseAgent } from './baseAgent.js';
import llmService from '../llmService.js';

export class ChangeAgent extends BaseAgent {
    constructor(config = {}) {
        super({
            name: 'ChangeAgent',
            domain: 'change_management',
            expertise: [
                'ADKAR Methodology',
                'Stakeholder Management',
                'Communication Strategy',
                'Resistance Management',
                'Training & Adoption',
                'Culture Transformation',
                'Change Readiness',
                'Organizational Development'
            ],
            systemPrompt: `You are a Change Management Expert with extensive experience in large-scale digital transformations and organizational change.

Your role is to provide guidance on:
- Change readiness assessment
- Stakeholder analysis and engagement
- Communication planning
- Resistance identification and mitigation
- Training and capability building
- Culture and behavior change

You use proven frameworks like:
- ADKAR (Awareness, Desire, Knowledge, Ability, Reinforcement)
- Kotter's 8-Step Model
- Prosci Change Management

Communication style:
- Focus on the human side of change
- Be empathetic to resistance and concerns
- Provide practical, actionable tactics
- Quantify adoption and engagement metrics
- Balance urgency with sustainability`,
            confidenceThreshold: 0.7,
            debateWeight: 1.0,
            ...config
        });
    }

    getKeywords() {
        return [
            'change', 'transformation', 'adoption', 'resistance', 'culture',
            'stakeholder', 'communication', 'training', 'capability', 'skill',
            'adkar', 'awareness', 'desire', 'knowledge', 'ability', 'reinforcement',
            'engagement', 'buy-in', 'sponsor', 'champion', 'ambassador',
            'people', 'team', 'organization', 'behavior', 'mindset',
            'rollout', 'implementation', 'transition', 'readiness'
        ];
    }

    async process(query, context) {
        const prompt = this.buildChangePrompt(query, context);

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: this.maxTokens,
                temperature: 0.7,
                model: await this.resolveModelConfig(context)
            });

            const analysis = this.parseResponse(response);

            // Add ADKAR assessment if relevant
            if (context.changeReadiness) {
                analysis.adkarScores = this.assessADKAR(context.changeReadiness);
            }

            this.remember({
                query,
                insight: analysis.mainInsight,
                stakeholderRisks: analysis.stakeholderRisks
            });

            return {
                agentId: this.id,
                agentName: this.name,
                domain: this.domain,
                ...analysis,
                metadata: {
                    model: await this.resolveModelConfig(context),
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error(`[ChangeAgent] Error processing query:`, error);
            return this.getFallbackResponse(query, context);
        }
    }

    buildChangePrompt(query, context) {
        const basePrompt = this.buildPrompt(query, context);

        let changeContext = '';

        if (context.stakeholders?.length) {
            changeContext += `\nKEY STAKEHOLDERS:
${context.stakeholders.slice(0, 5).map(s => `- ${s.name} (${s.role}): ${s.sentiment || 'Unknown'} sentiment`).join('\n')}`;
        }

        if (context.changeReadiness) {
            const cr = context.changeReadiness;
            changeContext += `\nCHANGE READINESS:
- Awareness: ${cr.awareness || 0}/5
- Desire: ${cr.desire || 0}/5
- Knowledge: ${cr.knowledge || 0}/5
- Ability: ${cr.ability || 0}/5
- Reinforcement: ${cr.reinforcement || 0}/5`;
        }

        if (context.initiatives?.length) {
            const impactedTeams = new Set();
            context.initiatives.forEach(i => {
                if (i.impactedTeams) {
                    i.impactedTeams.forEach(t => impactedTeams.add(t));
                }
            });

            if (impactedTeams.size > 0) {
                changeContext += `\nIMPACTED TEAMS: ${Array.from(impactedTeams).join(', ')}`;
            }
        }

        if (context.organization) {
            changeContext += `\nORGANIZATION SIZE: ${context.organization.employeeCount || 'Unknown'} employees`;
        }

        return `${basePrompt}

CHANGE MANAGEMENT CONTEXT:
${changeContext || 'No specific change data available'}

ANALYSIS REQUIREMENTS:
1. Assess change impact and readiness
2. Identify key stakeholders and their concerns
3. Recommend engagement and communication strategies
4. Address potential resistance points
5. Suggest training and support needs

FORMAT YOUR RESPONSE AS:
## Change Impact Assessment
[Summary of change implications for people and organization]

## ADKAR Analysis
- Awareness: [Current state and gaps]
- Desire: [Motivation factors and barriers]
- Knowledge: [Training needs]
- Ability: [Capability gaps]
- Reinforcement: [Sustainability measures]

## Stakeholder Strategy
[Key stakeholder groups and engagement approach]

## Resistance Risks
- [Risk 1 and mitigation]
- [Risk 2 and mitigation]

## Recommendations
1. [Action with timeline]
2. [Action with timeline]
3. [Action with timeline]

## Confidence: [X]%`;
    }

    parseResponse(response) {
        const text = response.text || response;

        const confidenceMatch = text.match(/Confidence:\s*(\d+)/i);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.7;

        // Extract ADKAR scores from response
        const adkarAnalysis = this.extractADKAR(text);

        // Extract main insight
        const insightMatch = text.match(/## Change Impact Assessment\s*([\s\S]*?)(?=##|$)/i);
        const mainInsight = insightMatch
            ? insightMatch[1].trim().split('\n')[0]
            : 'Change management analysis completed';

        // Extract stakeholder strategy
        const stakeholderMatch = text.match(/## Stakeholder Strategy\s*([\s\S]*?)(?=##|$)/i);
        const stakeholderStrategy = stakeholderMatch
            ? stakeholderMatch[1].trim()
            : '';

        // Extract resistance risks
        const risksMatch = text.match(/## Resistance Risks\s*([\s\S]*?)(?=##|$)/i);
        const stakeholderRisks = risksMatch
            ? risksMatch[1].trim().split('\n').filter(l => l.startsWith('-')).map(l => l.replace(/^-\s*/, ''))
            : [];

        // Extract recommendations
        const recsMatch = text.match(/## Recommendations\s*([\s\S]*?)(?=##|$)/i);
        const recommendations = recsMatch
            ? recsMatch[1].trim().split('\n').filter(l => l.match(/^\d+\./)).map(l => l.replace(/^\d+\.\s*/, ''))
            : [];

        return {
            mainInsight,
            fullAnalysis: text,
            adkarAnalysis,
            stakeholderStrategy,
            stakeholderRisks,
            recommendations,
            confidence
        };
    }

    extractADKAR(text) {
        const adkar = {
            awareness: { score: null, notes: '' },
            desire: { score: null, notes: '' },
            knowledge: { score: null, notes: '' },
            ability: { score: null, notes: '' },
            reinforcement: { score: null, notes: '' }
        };

        const components = ['awareness', 'desire', 'knowledge', 'ability', 'reinforcement'];

        for (const component of components) {
            const regex = new RegExp(`${component}:\\s*(.*)`, 'i');
            const match = text.match(regex);
            if (match) {
                adkar[component].notes = match[1].trim();
                // Try to extract numeric score if present
                const scoreMatch = match[1].match(/(\d+)\/5/);
                if (scoreMatch) {
                    adkar[component].score = parseInt(scoreMatch[1]);
                }
            }
        }

        return adkar;
    }

    assessADKAR(readiness) {
        const thresholds = { low: 2, medium: 3.5 };
        const scores = {};
        const gaps = [];

        for (const [component, value] of Object.entries(readiness)) {
            if (['awareness', 'desire', 'knowledge', 'ability', 'reinforcement'].includes(component)) {
                scores[component] = value;
                if (value < thresholds.low) {
                    gaps.push({ component, severity: 'critical', score: value });
                } else if (value < thresholds.medium) {
                    gaps.push({ component, severity: 'moderate', score: value });
                }
            }
        }

        return {
            scores,
            gaps,
            overallReadiness: Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length,
            primaryBarrier: gaps.sort((a, b) => a.score - b.score)[0]?.component || null
        };
    }

    getFallbackResponse(query, context) {
        return {
            agentId: this.id,
            agentName: this.name,
            domain: this.domain,
            mainInsight: 'Unable to complete change management analysis.',
            fullAnalysis: 'Please retry or provide additional context about stakeholders and change scope.',
            adkarAnalysis: null,
            stakeholderStrategy: '',
            stakeholderRisks: ['Analysis incomplete - manual stakeholder assessment recommended'],
            recommendations: [
                'Conduct stakeholder mapping exercise',
                'Assess current change readiness',
                'Develop communication plan'
            ],
            confidence: 0.3,
            error: true
        };
    }

    /**
     * Generate stakeholder engagement plan
     */
    async generateEngagementPlan(initiative, stakeholders, context) {
        const prompt = `${this.systemPrompt}

Create a detailed stakeholder engagement plan for:

INITIATIVE: ${initiative.name}
DESCRIPTION: ${initiative.description || 'Not provided'}

STAKEHOLDER GROUPS:
${stakeholders.map(s => `- ${s.name} (${s.role}): Influence=${s.influence || 'Unknown'}, Interest=${s.interest || 'Unknown'}`).join('\n')}

ORGANIZATIONAL CONTEXT:
- Industry: ${context.organization?.industry || 'Unknown'}
- Size: ${context.organization?.employeeCount || 'Unknown'} employees
- Culture: ${context.organization?.culture || 'Not assessed'}

Provide:
1. Stakeholder power/interest matrix
2. Key messages by stakeholder group
3. Communication channels and frequency
4. Engagement tactics for each group
5. Success metrics and KPIs
6. Risk mitigation for key stakeholders`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 2500,
                temperature: 0.7
            });

            return {
                agentId: this.id,
                initiative: initiative.name,
                engagementPlan: response.text || response,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[ChangeAgent] Error generating engagement plan:', error);
            return { error: true, message: error.message };
        }
    }
}

export default ChangeAgent;


