/**
 * Report Content Generator
 * 
 * AI-powered content generation for BCG/McKinsey-style report sections.
 * Generates professional narratives, insights, and recommendations.
 */

import aiService from '../aiService.js';
import promptTemplateService from './promptTemplateService.js';
import { getDatabase } from '../../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import path from 'path';
import { DRD_AXES_CONFIG, MATURITY_LEVELS } from './bcgReportGenerator.js'; // Retained as no replacement was provided in instruction

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prompt templates for different section types
const PROMPT_TEMPLATES = {
    executiveSummary: `You are a senior BCG/McKinsey consultant writing an executive summary for a digital maturity assessment.

ORGANIZATION:
{{organizationContext}}

ASSESSMENT RESULTS:
- Overall Maturity: {{overallActual}}% ({{maturityLabel}})
- Target: {{overallTarget}}%
- Gap: {{overallGap}} percentage points

STRENGTHS:
{{strengths}}

GAPS:
{{gaps}}

Write a concise executive summary (300-400 words) with:
1. Opening verdict (1-2 sentences)
2. Key findings (3 bullet points)
3. Strategic implications (1 paragraph)
4. Immediate actions (3 priorities)

Use professional consulting language. Be direct about challenges but constructive.
Respond in JSON format: { "verdict": string, "keyFindings": string[], "strategicImplications": string, "immediateActions": string[] }`,

    axisNarrative: `You are a senior consultant analyzing the {{axisName}} dimension of a digital maturity assessment.

ORGANIZATION CONTEXT:
{{organizationContext}}

AXIS: {{axisName}} ({{bcgLabel}})
- Current Level: {{actual}} / {{maxLevel}}
- Target Level: {{target}} / {{maxLevel}}
- Gap: {{gap}} levels

AREA BREAKDOWN:
{{areaScores}}

Write a focused analysis (150-200 words) covering:
1. Current state assessment
2. Key strengths identified
3. Critical gaps to address
4. Specific recommendations

Use professional consulting language appropriate for C-level audience.
Respond in JSON format: { "currentState": string, "strengths": string[], "gaps": string[], "recommendations": string[] }`,

    recommendations: `You are a transformation expert creating strategic recommendations for a digital transformation program.

ORGANIZATION:
{{organizationContext}}

GAP ANALYSIS:
{{gapAnalysis}}

STRATEGIC PRIORITIES:
{{priorities}}

Generate 5 strategic recommendations that:
1. Address the most critical gaps
2. Build on existing strengths
3. Are actionable and measurable
4. Include realistic timelines

Format each recommendation with:
- Priority (CRITICAL/HIGH/MEDIUM)
- Title (max 10 words)
- Description (2-3 sentences)
- Expected outcome
- Timeline
- Required resources

Respond in JSON format: { "recommendations": [{ "priority": string, "title": string, "description": string, "expectedOutcome": string, "timeline": string, "resources": string[] }] }`,

    transformationRoadmap: `You are a transformation strategist designing a phased roadmap for digital transformation.

ORGANIZATION:
{{organizationContext}}

CURRENT STATE:
- Overall Maturity: {{overallActual}}%
- Key Gaps: {{keyGaps}}

TARGET STATE:
- Target Maturity: {{overallTarget}}%
- Time Horizon: {{horizon}}

Design a 3-phase transformation roadmap:

PHASE 1: Foundation (0-90 days)
- Quick wins and governance setup

PHASE 2: Acceleration (90-180 days)
- Address critical gaps

PHASE 3: Scale (180-365 days)
- Enterprise-wide transformation

For each phase, provide:
- Key objectives (3-4)
- Success metrics
- Risk factors
- Resource requirements

Respond in JSON format: { "phases": [{ "name": string, "duration": string, "objectives": string[], "successMetrics": string[], "risks": string[], "resources": string[] }] }`
};

class ReportContentGenerator {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Generate executive summary narrative
     */
    async generateExecutiveSummary(assessment, orgContext, metrics) {
        const cacheKey = `exec_${assessment.id}_${Date.now()}`;

        const context = this._buildContextString(orgContext);
        const prompt = this._fillTemplate(PROMPT_TEMPLATES.executiveSummary, {
            organizationContext: context,
            overallActual: metrics.overallActual,
            overallTarget: metrics.overallTarget,
            overallGap: metrics.overallGap,
            maturityLabel: this._getMaturityLabel(metrics.overallActual),
            strengths: metrics.strengths.slice(0, 3).map(s => `- ${s.bcgLabel}: ${s.actualPercent}%`).join('\n'),
            gaps: metrics.gaps.slice(0, 3).map(g => `- ${g.bcgLabel}: Gap ${g.gapPercent}%`).join('\n')
        });

        try {
            const response = await aiService.generateStructuredContent(prompt, 'assessment_report');
            const parsed = this._parseJSONResponse(response);

            return {
                generated: true,
                generatedAt: new Date().toISOString(),
                ...parsed
            };
        } catch (error) {
            console.error('[ReportContentGenerator] Executive summary failed:', error);
            return this._generateFallbackExecutiveSummary(metrics);
        }
    }

    /**
     * Generate narrative for specific axis
     */
    async generateAxisNarrative(axis, scores, orgContext) {
        const axisConfig = DRD_AXES_CONFIG[axis];
        if (!axisConfig) {
            return this._generateFallbackAxisNarrative(axis, scores);
        }

        const context = this._buildContextString(orgContext);
        const areaScoresText = Object.entries(scores.areaScores || {})
            .map(([area, [actual, target]]) => `- ${area}: ${actual} → ${target}`)
            .join('\n') || 'No area-level data available';

        const prompt = this._fillTemplate(PROMPT_TEMPLATES.axisNarrative, {
            organizationContext: context,
            axisName: axisConfig.name,
            bcgLabel: axisConfig.bcgLabel,
            actual: scores.actual || 0,
            target: scores.target || 0,
            gap: scores.gap || 0,
            maxLevel: axisConfig.maxLevel,
            areaScores: areaScoresText
        });

        try {
            const response = await aiService.generateStructuredContent(prompt, 'assessment_report');
            const parsed = this._parseJSONResponse(response);

            return {
                axis,
                generated: true,
                generatedAt: new Date().toISOString(),
                ...parsed
            };
        } catch (error) {
            console.error(`[ReportContentGenerator] Axis narrative for ${axis} failed:`, error);
            return this._generateFallbackAxisNarrative(axis, scores);
        }
    }

    /**
     * Generate strategic recommendations
     */
    async generateRecommendations(gaps, priorities, orgContext) {
        const context = this._buildContextString(orgContext);

        const gapAnalysisText = gaps.slice(0, 5)
            .map(g => `- ${g.bcgLabel}: Gap ${g.gap} levels (Priority: ${g.priority})`)
            .join('\n');

        const prioritiesText = priorities.slice(0, 3)
            .map(p => DRD_AXES_CONFIG[p]?.bcgLabel || p)
            .join(', ');

        const prompt = this._fillTemplate(PROMPT_TEMPLATES.recommendations, {
            organizationContext: context,
            gapAnalysis: gapAnalysisText,
            priorities: prioritiesText
        });

        try {
            const response = await aiService.generateStructuredContent(prompt, 'assessment_report');
            const parsed = this._parseJSONResponse(response);

            return {
                generated: true,
                generatedAt: new Date().toISOString(),
                count: parsed.recommendations?.length || 0,
                recommendations: parsed.recommendations || []
            };
        } catch (error) {
            console.error('[ReportContentGenerator] Recommendations failed:', error);
            return this._generateFallbackRecommendations(gaps);
        }
    }

    /**
     * Generate transformation roadmap narrative
     */
    async generateTransformationRoadmap(metrics, orgContext) {
        const context = this._buildContextString(orgContext);

        const keyGapsText = metrics.gaps.slice(0, 3)
            .map(g => g.bcgLabel)
            .join(', ');

        const horizon = orgContext?.transformationHorizon || '12 months';

        const prompt = this._fillTemplate(PROMPT_TEMPLATES.transformationRoadmap, {
            organizationContext: context,
            overallActual: metrics.overallActual,
            overallTarget: metrics.overallTarget,
            keyGaps: keyGapsText,
            horizon
        });

        try {
            const response = await aiService.generateStructuredContent(prompt, 'assessment_report');
            const parsed = this._parseJSONResponse(response);

            return {
                generated: true,
                generatedAt: new Date().toISOString(),
                totalDuration: horizon,
                phases: parsed.phases || []
            };
        } catch (error) {
            console.error('[ReportContentGenerator] Roadmap failed:', error);
            return this._generateFallbackRoadmap(metrics);
        }
    }

    /**
     * Regenerate specific section based on user feedback
     */
    async regenerateSection(sectionType, currentContent, feedback, context) {
        const regeneratePrompt = `You are a senior consultant revising a report section based on feedback.

CURRENT CONTENT:
${JSON.stringify(currentContent, null, 2)}

USER FEEDBACK:
${feedback}

CONTEXT:
${this._buildContextString(context)}

Please revise the content to address the feedback while maintaining professional consulting quality.
Keep the same JSON structure as the original content.`;

        try {
            const response = await AiService.generateStructuredContent(regeneratePrompt, 'assessment_report');
            return {
                regenerated: true,
                regeneratedAt: new Date().toISOString(),
                feedback,
                ...this._parseJSONResponse(response)
            };
        } catch (error) {
            console.error('[ReportContentGenerator] Section regeneration failed:', error);
            throw new Error('Failed to regenerate section');
        }
    }

    /**
     * Generate comment response
     */
    async generateCommentResponse(comment, sectionContent, context) {
        const prompt = `You are a senior consultant responding to a comment on a report section.

SECTION CONTENT:
${JSON.stringify(sectionContent, null, 2)}

COMMENT:
${comment}

CONTEXT:
${this._buildContextString(context)}

Provide a helpful response that:
1. Acknowledges the comment
2. Suggests specific improvements if applicable
3. Offers alternative perspectives if relevant

Keep response concise (2-3 sentences).
Respond in JSON: { "response": string, "suggestedEdits": string[] }`;

        try {
            const response = await AiService.generateStructuredContent(prompt, 'report_comment');
            return this._parseJSONResponse(response);
        } catch (error) {
            console.error('[ReportContentGenerator] Comment response failed:', error);
            return {
                response: 'Thank you for your feedback. Our team will review and incorporate your suggestions.',
                suggestedEdits: []
            };
        }
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    /**
     * Build context string from organization data
     */
    _buildContextString(context) {
        if (!context) return 'No organization context available';

        const parts = [];

        if (context.industry) parts.push(`Industry: ${context.industry}`);
        if (context.companySize) parts.push(`Size: ${context.companySize}`);
        if (context.employeeCount) parts.push(`Employees: ${context.employeeCount}`);

        if (context.strategicGoals) {
            const goals = Array.isArray(context.strategicGoals)
                ? context.strategicGoals.join(', ')
                : context.strategicGoals;
            parts.push(`Goals: ${goals}`);
        }

        if (context.challenges) {
            const challenges = Array.isArray(context.challenges)
                ? context.challenges.join(', ')
                : context.challenges;
            parts.push(`Challenges: ${challenges}`);
        }

        return parts.length > 0 ? parts.join('\n') : 'No context provided';
    }

    /**
     * Fill template with variables
     */
    _fillTemplate(template, variables) {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
        }
        return result;
    }

    /**
     * Parse JSON response from AI
     */
    _parseJSONResponse(response) {
        try {
            // Try direct parse
            return JSON.parse(response);
        } catch (e) {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e2) {
                    console.warn('[ReportContentGenerator] Failed to parse JSON:', e2);
                }
            }
            return {};
        }
    }

    /**
     * Get maturity label for percentage
     */
    _getMaturityLabel(percentage) {
        if (percentage >= 80) return 'Leading';
        if (percentage >= 60) return 'Optimized';
        if (percentage >= 40) return 'Standardized';
        if (percentage >= 20) return 'Emerging';
        return 'Ad-hoc';
    }

    // ==========================================
    // FALLBACK GENERATORS (Deterministic)
    // ==========================================

    _generateFallbackExecutiveSummary(metrics) {
        const label = this._getMaturityLabel(metrics.overallActual);

        return {
            generated: false,
            verdict: `Organization demonstrates ${label} digital maturity at ${metrics.overallActual}%, with ${metrics.overallGap} percentage point gap to target.`,
            keyFindings: [
                metrics.strengths.length > 0
                    ? `Strong performance in ${metrics.strengths[0]?.bcgLabel || 'key areas'}`
                    : 'Foundational digital capabilities require development',
                metrics.gaps.length > 0
                    ? `Critical gaps identified in ${metrics.gaps[0]?.bcgLabel || 'multiple dimensions'}`
                    : 'Current state aligned with targets',
                `${metrics.quickWins?.length || 0} quick-win opportunities available`
            ],
            strategicImplications: `Digital transformation investment required to close ${metrics.overallGap} percentage point maturity gap. Focus on ${metrics.strategicPriorities?.slice(0, 2).map(p => DRD_AXES_CONFIG[p]?.bcgLabel).join(' and ') || 'core capabilities'}.`,
            immediateActions: [
                'Establish transformation governance',
                'Launch quick-win initiatives',
                'Build digital capability roadmap'
            ]
        };
    }

    _generateFallbackAxisNarrative(axis, scores) {
        const config = DRD_AXES_CONFIG[axis] || { name: axis, bcgLabel: axis };

        return {
            axis,
            generated: false,
            currentState: `Current ${config.bcgLabel} maturity at Level ${scores.actual || 0} of ${config.maxLevel || 5}.`,
            strengths: scores.actual >= 3 ? ['Established foundation in place'] : [],
            gaps: scores.gap > 0 ? [`Gap of ${scores.gap} levels to target state`] : [],
            recommendations: [
                scores.gap > 2
                    ? 'Strategic transformation program required'
                    : 'Incremental improvement recommended'
            ]
        };
    }

    _generateFallbackRecommendations(gaps) {
        return {
            generated: false,
            count: Math.min(gaps.length, 5),
            recommendations: gaps.slice(0, 5).map((gap, i) => ({
                priority: gap.priority >= 70 ? 'CRITICAL' : gap.priority >= 50 ? 'HIGH' : 'MEDIUM',
                title: `Address ${gap.bcgLabel} Gap`,
                description: `Implement improvement program to close ${gap.gap}-level gap in ${gap.bcgLabel}.`,
                expectedOutcome: `${gap.gapPercent}% maturity improvement`,
                timeline: gap.gap <= 2 ? '90 days' : '6-12 months',
                resources: ['Project team', 'Executive sponsor', 'Change management']
            }))
        };
    }

    _generateFallbackRoadmap(metrics) {
        return {
            generated: false,
            totalDuration: '12 months',
            phases: [
                {
                    name: 'Foundation',
                    duration: '0-90 days',
                    objectives: ['Establish governance', 'Execute quick wins', 'Build baseline'],
                    successMetrics: ['Governance in place', 'Quick wins delivered'],
                    risks: ['Resource availability'],
                    resources: ['PMO', 'Executive sponsor']
                },
                {
                    name: 'Acceleration',
                    duration: '90-180 days',
                    objectives: ['Launch programs', 'Build capabilities', 'Change management'],
                    successMetrics: ['Programs on track', 'Capabilities developed'],
                    risks: ['Change resistance'],
                    resources: ['Transformation team', 'Training']
                },
                {
                    name: 'Scale',
                    duration: '180-365 days',
                    objectives: ['Scale pilots', 'Achieve targets', 'Embed practices'],
                    successMetrics: ['Target maturity achieved', 'Practices embedded'],
                    risks: ['Sustainability'],
                    resources: ['Full organization']
                }
            ]
        };
    }
}

export default new ReportContentGenerator();














