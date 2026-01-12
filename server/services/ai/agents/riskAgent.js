/**
 * RiskAgent - Expert in risk identification and mitigation
 * 
 * Specializations:
 * - Risk identification and assessment
 * - Risk quantification and prioritization
 * - Mitigation strategy development
 * - Contingency planning
 * - Risk monitoring and early warning
 * - Compliance and regulatory risks
 */

import { BaseAgent } from './baseAgent.js';
import llmService from '../llmService.js';

export class RiskAgent extends BaseAgent {
    constructor(config = {}) {
        super({
            name: 'RiskAgent',
            domain: 'risk_management',
            expertise: [
                'Risk Identification',
                'Risk Assessment',
                'Risk Quantification',
                'Mitigation Planning',
                'Contingency Planning',
                'Compliance Risk',
                'Operational Risk',
                'Strategic Risk'
            ],
            systemPrompt: `You are a Chief Risk Officer (CRO) advisor specializing in digital transformation and technology implementation risks.

Your role is to:
- Identify and categorize risks (strategic, operational, financial, compliance, technical)
- Assess probability and impact of risks
- Develop mitigation and contingency strategies
- Monitor early warning indicators
- Ensure regulatory and compliance adherence

Risk assessment approach:
- Use structured risk frameworks (COSO, ISO 31000)
- Quantify risks where possible (expected monetary value, probability)
- Consider interdependencies and cascading effects
- Balance risk aversion with opportunity cost

Communication style:
- Be thorough but not alarmist
- Prioritize risks by severity
- Provide actionable mitigation steps
- Include monitoring metrics for each risk`,
            confidenceThreshold: 0.75,
            debateWeight: 1.1, // Risk perspective is important in debates
            ...config
        });

        // Risk categories for classification
        this.riskCategories = [
            'strategic',
            'operational',
            'financial',
            'technical',
            'compliance',
            'reputational',
            'people',
            'external'
        ];
    }

    getKeywords() {
        return [
            'risk', 'threat', 'danger', 'issue', 'problem', 'concern',
            'mitigation', 'contingency', 'backup', 'fallback', 'plan b',
            'probability', 'likelihood', 'impact', 'severity', 'exposure',
            'compliance', 'regulation', 'audit', 'control', 'security',
            'fail', 'failure', 'delay', 'obstacle', 'barrier', 'blocker',
            'uncertainty', 'unknown', 'assumption', 'dependency'
        ];
    }

    async process(query, context) {
        const prompt = this.buildRiskPrompt(query, context);

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: this.maxTokens,
                temperature: 0.6,
                model: await this.resolveModelConfig(context)
            });

            const analysis = this.parseResponse(response);

            // Calculate risk scores if we have structured data
            if (analysis.risks?.length) {
                analysis.riskMatrix = this.buildRiskMatrix(analysis.risks);
                analysis.overallRiskScore = this.calculateOverallRisk(analysis.risks);
            }

            this.remember({
                query,
                insight: analysis.mainInsight,
                topRisks: analysis.risks?.slice(0, 3)
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
            console.error(`[RiskAgent] Error processing query:`, error);
            return this.getFallbackResponse(query, context);
        }
    }

    buildRiskPrompt(query, context) {
        const basePrompt = this.buildPrompt(query, context);

        let riskContext = '';

        if (context.risks?.length) {
            riskContext += `\nKNOWN RISKS:
${context.risks.slice(0, 10).map(r => `- ${r.name}: ${r.category || 'Uncategorized'} (P: ${r.probability || 'Unknown'}, I: ${r.impact || 'Unknown'})`).join('\n')}`;
        }

        if (context.initiatives?.length) {
            const highRiskInitiatives = context.initiatives.filter(i =>
                i.risk === 'high' || i.complexity === 'high'
            );

            if (highRiskInitiatives.length) {
                riskContext += `\nHIGH-RISK INITIATIVES:
${highRiskInitiatives.map(i => `- ${i.name}: ${i.riskReason || 'Flagged as high risk'}`).join('\n')}`;
            }
        }

        if (context.dependencies?.length) {
            riskContext += `\nCRITICAL DEPENDENCIES:
${context.dependencies.slice(0, 5).map(d => `- ${d.from} → ${d.to}: ${d.type || 'dependency'}`).join('\n')}`;
        }

        if (context.organization) {
            riskContext += `\nORGANIZATIONAL RISK FACTORS:
- Industry: ${context.organization.industry || 'Unknown'} (regulatory complexity)
- Size: ${context.organization.employeeCount || 'Unknown'} employees
- Technical Maturity: ${context.organization.technicalMaturity || 'Unknown'}`;
        }

        return `${basePrompt}

RISK CONTEXT:
${riskContext || 'No specific risk data available'}

ANALYSIS REQUIREMENTS:
1. Identify all significant risks
2. Categorize by type (strategic, operational, financial, technical, compliance)
3. Assess probability (1-5) and impact (1-5)
4. Recommend specific mitigation actions
5. Define early warning indicators
6. Provide structured risk metrics

FORMAT YOUR RESPONSE AS:
## Risk Assessment Summary
[Overview of risk landscape and key concerns]

## Critical Risks (Top 5)
| Risk | Category | Probability | Impact | Score | Mitigation |
|------|----------|-------------|--------|-------|------------|
| [Name] | [Cat] | [1-5] | [1-5] | [P×I] | [Action] |

## Risk Interdependencies
[How risks may cascade or compound]

## Early Warning Indicators
- [Indicator 1]: Watch for...
- [Indicator 2]: Watch for...

## Contingency Plans
1. If [trigger] occurs → [response]

## Recommendations
1. [Priority action]
2. [Priority action]

## Confidence: [X]%`;
    }

    parseResponse(response) {
        const text = response.text || response;

        const confidenceMatch = text.match(/Confidence:\s*(\d+)/i);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.7;

        // Extract main insight
        const insightMatch = text.match(/## Risk Assessment Summary\s*([\s\S]*?)(?=##|$)/i);
        const mainInsight = insightMatch
            ? insightMatch[1].trim().split('\n')[0]
            : 'Risk assessment completed';

        // Extract risks from table
        const risks = this.extractRisksFromTable(text);

        // Extract early warning indicators
        const warningsMatch = text.match(/## Early Warning Indicators\s*([\s\S]*?)(?=##|$)/i);
        const earlyWarnings = warningsMatch
            ? warningsMatch[1].trim().split('\n').filter(l => l.startsWith('-')).map(l => l.replace(/^-\s*/, ''))
            : [];

        // Extract contingency plans
        const contingenciesMatch = text.match(/## Contingency Plans\s*([\s\S]*?)(?=##|$)/i);
        const contingencies = contingenciesMatch
            ? contingenciesMatch[1].trim().split('\n').filter(l => l.match(/^\d+\./)).map(l => l.replace(/^\d+\.\s*/, ''))
            : [];

        // Extract recommendations
        const recsMatch = text.match(/## Recommendations\s*([\s\S]*?)(?=##|$)/i);
        const recommendations = recsMatch
            ? recsMatch[1].trim().split('\n').filter(l => l.match(/^\d+\./)).map(l => l.replace(/^\d+\.\s*/, ''))
            : [];

        return {
            mainInsight,
            fullAnalysis: text,
            risks,
            earlyWarnings,
            contingencies,
            recommendations,
            confidence
        };
    }

    extractRisksFromTable(text) {
        const risks = [];

        // Try to find table rows
        const tableMatch = text.match(/## Critical Risks[\s\S]*?\|[\s\S]*?(?=##|$)/i);
        if (!tableMatch) return risks;

        const lines = tableMatch[0].split('\n');

        for (const line of lines) {
            // Skip header and separator rows
            if (line.includes('Risk') && line.includes('Category')) continue;
            if (line.match(/^\|[-\s|]+\|$/)) continue;

            // Parse table row
            const cells = line.split('|').map(c => c.trim()).filter(c => c);
            if (cells.length >= 5) {
                const probability = parseInt(cells[2]) || 3;
                const impact = parseInt(cells[3]) || 3;

                risks.push({
                    name: cells[0],
                    category: cells[1]?.toLowerCase(),
                    probability,
                    impact,
                    score: probability * impact,
                    mitigation: cells[5] || ''
                });
            }
        }

        return risks.sort((a, b) => b.score - a.score);
    }

    buildRiskMatrix(risks) {
        const matrix = {
            critical: [], // P>=4 AND I>=4
            high: [],     // Score >= 12
            medium: [],   // Score >= 6
            low: []       // Score < 6
        };

        for (const risk of risks) {
            if (risk.probability >= 4 && risk.impact >= 4) {
                matrix.critical.push(risk);
            } else if (risk.score >= 12) {
                matrix.high.push(risk);
            } else if (risk.score >= 6) {
                matrix.medium.push(risk);
            } else {
                matrix.low.push(risk);
            }
        }

        return matrix;
    }

    calculateOverallRisk(risks) {
        if (!risks.length) return { score: 0, level: 'unknown' };

        // Weighted average with higher weight for critical risks
        let totalWeight = 0;
        let weightedSum = 0;

        for (const risk of risks) {
            const weight = risk.score >= 16 ? 3 : risk.score >= 9 ? 2 : 1;
            weightedSum += risk.score * weight;
            totalWeight += weight;
        }

        const avgScore = weightedSum / totalWeight;

        let level;
        if (avgScore >= 16) level = 'critical';
        else if (avgScore >= 12) level = 'high';
        else if (avgScore >= 6) level = 'medium';
        else level = 'low';

        return { score: Math.round(avgScore * 10) / 10, level };
    }

    getFallbackResponse(query, context) {
        return {
            agentId: this.id,
            agentName: this.name,
            domain: this.domain,
            mainInsight: 'Unable to complete risk assessment.',
            fullAnalysis: 'Please retry or provide additional project/initiative details.',
            risks: [],
            earlyWarnings: ['Manual risk review recommended'],
            contingencies: [],
            recommendations: [
                'Conduct structured risk workshop',
                'Review historical project data for patterns',
                'Assess dependencies and single points of failure'
            ],
            confidence: 0.3,
            error: true
        };
    }

    /**
     * Perform comprehensive risk assessment for an initiative
     */
    async assessInitiativeRisks(initiative, context) {
        const prompt = `${this.systemPrompt}

Perform comprehensive risk assessment for:

INITIATIVE: ${initiative.name}
DESCRIPTION: ${initiative.description || 'Not provided'}
TIMELINE: ${initiative.startDate || 'TBD'} to ${initiative.endDate || 'TBD'}
BUDGET: ${initiative.estimatedCost ? '$' + initiative.estimatedCost : 'Not specified'}
TEAM SIZE: ${initiative.teamSize || 'Unknown'}

DEPENDENCIES:
${initiative.dependencies?.map(d => `- ${d}`).join('\n') || 'Not specified'}

ORGANIZATIONAL CONTEXT:
- Industry: ${context.organization?.industry || 'Unknown'}
- Company Size: ${context.organization?.employeeCount || 'Unknown'}
- Technical Maturity: ${context.organization?.technicalMaturity || 'Unknown'}

Identify and assess all risks in these categories:
1. STRATEGIC - alignment, priority changes, scope creep
2. TECHNICAL - complexity, integration, technology maturity
3. OPERATIONAL - resources, skills, capacity
4. FINANCIAL - budget, ROI, cash flow
5. COMPLIANCE - regulatory, security, data privacy
6. PEOPLE - resistance, turnover, skills gaps
7. EXTERNAL - vendor, market, economic

For each risk provide:
- Description
- Root cause
- Probability (1-5)
- Impact (1-5)
- Specific mitigation strategy
- Owner recommendation
- Monitoring metric`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 3000,
                temperature: 0.6
            });

            return {
                agentId: this.id,
                initiative: initiative.name,
                riskAssessment: response.text || response,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[RiskAgent] Error assessing initiative risks:', error);
            return { error: true, message: error.message };
        }
    }
}

export default RiskAgent;




