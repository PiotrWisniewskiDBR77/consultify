export const createReportGeneratorPhases = ({ pipeline, AnalysisSchema, StrategySchema }) => ({
    runAnalystPhase: async (params) => {
        const { assessmentData, projectData, screenContext, userId, organizationId } = params;

        const prompt = `Analyze the following digital transformation assessment data.
Your task is to structure the findings and identify gaps.

## Assessment Data
${JSON.stringify(assessmentData, null, 2)}

## Project Context
${projectData ? JSON.stringify(projectData, null, 2) : 'No project context available'}

## Instructions
1. Summarize the current state vs target state
2. Analyze each dimension's gap
3. Identify key findings per dimension
4. Rate data quality and note any concerns

Be precise and data-driven. Use numbers and percentages.`;

        const response = await pipeline.process({
            type: 'structured',
            capability: 'analysis',
            role: 'ANALYST',
            schema: AnalysisSchema,
            prompt,
            screenContext,
            userId,
            organizationId,
            enableTools: false
        });

        return response.object || response.content;
    },

    runStrategistPhase: async (params) => {
        const { analysis, assessmentData, projectData, userId, organizationId } = params;

        const prompt = `Based on the following analysis, create an executive-level strategic report.

## Analysis Results
${JSON.stringify(analysis, null, 2)}

## Original Assessment
${JSON.stringify(assessmentData, null, 2)}

## Instructions (McKinsey Pyramid Principle)
1. Start with the answer: One-paragraph executive summary
2. Prioritize recommendations (CRITICAL → HIGH → MEDIUM → LOW)
3. Create a 3-phase roadmap
4. Identify risks and mitigations

Write for a CEO audience. Be decisive and action-oriented.`;

        const response = await pipeline.process({
            type: 'structured',
            capability: 'strategic',
            role: 'STRATEGIST',
            schema: StrategySchema,
            prompt,
            userId,
            organizationId,
            enableTools: false
        });

        return response.object || response.content;
    },

    generateSection: async (params) => {
        const { sectionType, data, userId, organizationId } = params;

        const sectionPrompts = {
            executive_summary: 'Write a concise executive summary for this transformation assessment.',
            gap_analysis: 'Perform a detailed gap analysis for each dimension.',
            recommendations: 'Generate prioritized recommendations based on the assessment.',
            roadmap: 'Create a phased implementation roadmap.',
            risk_analysis: 'Identify risks and mitigation strategies.'
        };

        const prompt = `${sectionPrompts[sectionType] || 'Generate content for this section.'}

## Data
${JSON.stringify(data, null, 2)}`;

        const response = await pipeline.process({
            capability: 'report_section',
            role: 'STRATEGIST',
            prompt,
            userId,
            organizationId
        });

        return {
            section: sectionType,
            content: response.content
        };
    }
});
