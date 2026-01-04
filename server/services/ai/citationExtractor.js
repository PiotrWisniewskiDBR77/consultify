/**
 * Citation Extractor Service
 * 
 * Extracts and injects citations from AI responses that reference PMO data.
 * Detects mentions of assessments, initiatives, roadmaps, and reports.
 */

import pool from '../../db.js';

/**
 * Extract citations from AI response and context
 * @param {string} response - AI response text
 * @param {object} context - PMO context (projectId, userId, etc.)
 * @returns {Promise<object>} Response with injected citations and actions
 */
async function extractCitations(response, context = {}) {
    const citations = [];
    const actions = [];
    
    try {
        // Extract assessment references
        const assessmentCitations = await extractAssessmentCitations(response, context);
        citations.push(...assessmentCitations);

        // Extract initiative references
        const initiativeCitations = await extractInitiativeCitations(response, context);
        citations.push(...initiativeCitations);

        // Extract roadmap references
        const roadmapCitations = await extractRoadmapCitations(response, context);
        citations.push(...roadmapCitations);

        // Extract report references
        const reportCitations = await extractReportCitations(response, context);
        citations.push(...reportCitations);

        // Generate actions based on context and response
        const suggestedActions = generateActions(response, context, citations);
        actions.push(...suggestedActions);

    } catch (err) {
        console.error('[CitationExtractor] Error:', err);
    }

    return {
        citations: citations.slice(0, 5), // Max 5 citations
        actions: actions.slice(0, 4) // Max 4 actions
    };
}

/**
 * Extract assessment-related citations
 */
async function extractAssessmentCitations(response, context) {
    const citations = [];
    const lowerResponse = response.toLowerCase();
    
    // Check for assessment mentions
    const assessmentKeywords = [
        'assessment', 'maturity', 'score', 'drd', 'siri', 'adma', 'cmmi',
        'digital maturity', 'evaluation', 'gap analysis', 'dimension'
    ];

    const hasAssessmentMention = assessmentKeywords.some(kw => lowerResponse.includes(kw));
    
    if (hasAssessmentMention && context.projectId) {
        try {
            // Fetch recent assessment for project
            const result = await pool.query(`
                SELECT id, name, framework, overall_score, created_at
                FROM assessments
                WHERE project_id = $1
                ORDER BY created_at DESC
                LIMIT 1
            `, [context.projectId]);

            if (result.rows.length > 0) {
                const assessment = result.rows[0];
                citations.push({
                    id: `assessment-${assessment.id}`,
                    type: 'assessment',
                    title: assessment.name || `${assessment.framework} Assessment`,
                    reference: `Score: ${assessment.overall_score?.toFixed(1) || 'N/A'}/5`,
                    entityId: assessment.id,
                    link: `/assessment/${assessment.id}`
                });
            }
        } catch (err) {
            console.error('[CitationExtractor] Assessment query error:', err);
        }
    }

    return citations;
}

/**
 * Extract initiative-related citations
 */
async function extractInitiativeCitations(response, context) {
    const citations = [];
    const lowerResponse = response.toLowerCase();
    
    // Check for initiative mentions
    const initiativeKeywords = [
        'initiative', 'project', 'implementation', 'improvement',
        'transformation', 'digital initiative', 'program'
    ];

    const hasInitiativeMention = initiativeKeywords.some(kw => lowerResponse.includes(kw));
    
    if (hasInitiativeMention && context.projectId) {
        try {
            // Fetch recent initiatives for project
            const result = await pool.query(`
                SELECT id, name, status, priority, estimated_roi
                FROM initiatives
                WHERE project_id = $1
                ORDER BY priority DESC, created_at DESC
                LIMIT 2
            `, [context.projectId]);

            for (const initiative of result.rows) {
                citations.push({
                    id: `initiative-${initiative.id}`,
                    type: 'initiative',
                    title: initiative.name,
                    reference: `${initiative.status} • Priority: ${initiative.priority}`,
                    entityId: initiative.id,
                    link: `/initiatives/${initiative.id}`
                });
            }
        } catch (err) {
            console.error('[CitationExtractor] Initiative query error:', err);
        }
    }

    return citations;
}

/**
 * Extract roadmap-related citations
 */
async function extractRoadmapCitations(response, context) {
    const citations = [];
    const lowerResponse = response.toLowerCase();
    
    // Check for roadmap mentions
    const roadmapKeywords = [
        'roadmap', 'timeline', 'phase', 'milestone', 'schedule',
        'quarter', 'plan', 'planning'
    ];

    const hasRoadmapMention = roadmapKeywords.some(kw => lowerResponse.includes(kw));
    
    if (hasRoadmapMention && context.projectId) {
        try {
            // Check if project has roadmap items
            const result = await pool.query(`
                SELECT COUNT(*) as count, MIN(start_date) as earliest, MAX(end_date) as latest
                FROM roadmap_items
                WHERE project_id = $1
            `, [context.projectId]);

            if (result.rows[0]?.count > 0) {
                citations.push({
                    id: `roadmap-${context.projectId}`,
                    type: 'roadmap',
                    title: 'Transformation Roadmap',
                    reference: `${result.rows[0].count} items planned`,
                    entityId: context.projectId,
                    link: `/roadmap`
                });
            }
        } catch (err) {
            console.error('[CitationExtractor] Roadmap query error:', err);
        }
    }

    return citations;
}

/**
 * Extract report-related citations
 */
async function extractReportCitations(response, context) {
    const citations = [];
    const lowerResponse = response.toLowerCase();
    
    // Check for report mentions
    const reportKeywords = [
        'report', 'analysis', 'summary', 'executive summary',
        'documentation', 'findings', 'recommendations'
    ];

    const hasReportMention = reportKeywords.some(kw => lowerResponse.includes(kw));
    
    if (hasReportMention && context.projectId) {
        try {
            // Fetch recent reports for project
            const result = await pool.query(`
                SELECT id, title, report_type, created_at
                FROM reports
                WHERE project_id = $1
                ORDER BY created_at DESC
                LIMIT 1
            `, [context.projectId]);

            if (result.rows.length > 0) {
                const report = result.rows[0];
                citations.push({
                    id: `report-${report.id}`,
                    type: 'report',
                    title: report.title,
                    reference: `${report.report_type} • ${new Date(report.created_at).toLocaleDateString()}`,
                    entityId: report.id,
                    link: `/reports/${report.id}`
                });
            }
        } catch (err) {
            console.error('[CitationExtractor] Report query error:', err);
        }
    }

    return citations;
}

/**
 * Generate suggested actions based on context and response
 */
function generateActions(response, context, citations) {
    const actions = [];
    const lowerResponse = response.toLowerCase();

    // If assessment was mentioned, suggest viewing it
    if (citations.some(c => c.type === 'assessment')) {
        actions.push({
            id: 'view-assessment',
            type: 'navigate',
            label: 'View Assessment',
            icon: 'assessment',
            payload: { view: 'ASSESSMENT_SUMMARY' }
        });
    }

    // If initiatives were mentioned, suggest generating more
    if (lowerResponse.includes('initiative') || lowerResponse.includes('recommend')) {
        actions.push({
            id: 'generate-initiatives',
            type: 'navigate',
            label: 'Generate Initiatives',
            icon: 'initiative',
            payload: { view: 'INITIATIVE_GENERATOR' }
        });
    }

    // If roadmap was mentioned, suggest viewing/building it
    if (lowerResponse.includes('roadmap') || lowerResponse.includes('timeline')) {
        actions.push({
            id: 'build-roadmap',
            type: 'navigate',
            label: 'Build Roadmap',
            icon: 'roadmap',
            payload: { view: 'FULL_STEP3_ROADMAP' }
        });
    }

    // If ROI or cost was mentioned, suggest calculator
    if (lowerResponse.includes('roi') || lowerResponse.includes('cost') || lowerResponse.includes('benefit')) {
        actions.push({
            id: 'calculate-roi',
            type: 'navigate',
            label: 'Calculate ROI',
            icon: 'roi',
            payload: { view: 'ECONOMICS' }
        });
    }

    // Always offer to export/save
    if (response.length > 500) {
        actions.push({
            id: 'export-response',
            type: 'copy',
            label: 'Copy Response',
            icon: 'copy',
            payload: { copyText: response }
        });
    }

    return actions;
}

/**
 * Process AI response and inject citations
 * This is the main entry point called from the AI pipeline
 */
async function processResponse(response, context = {}) {
    const { citations, actions } = await extractCitations(response, context);
    
    return {
        content: response,
        citations,
        actions
    };
}

export {
extractCitations,
    processResponse,
    extractAssessmentCitations,
    extractInitiativeCitations,
    extractRoadmapCitations,
    extractReportCitations,
    generateActions
};

export default {
    extractCitations,
    processResponse,
    extractAssessmentCitations,
    extractInitiativeCitations,
    extractRoadmapCitations,
    extractReportCitations,
    generateActions
};









