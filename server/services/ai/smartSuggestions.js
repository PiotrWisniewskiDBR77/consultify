/**
 * Smart Suggestions Service
 * 
 * Generates context-aware suggestions based on user's PMO state:
 * - Incomplete assessments
 * - Low maturity areas
 * - Stale initiatives
 * - Missing roadmap
 * - Conversation context
 */

import pool from '../../db.js';

/**
 * Get smart suggestions for a user/project
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID (optional)
 * @param {object} conversationContext - Recent conversation context
 * @returns {Promise<Array>} Array of suggestions
 */
async function getSuggestions(userId, projectId, conversationContext = {}) {
    const suggestions = [];

    try {
        // 1. Check for incomplete assessments
        const assessmentSuggestions = await checkAssessmentStatus(userId, projectId);
        suggestions.push(...assessmentSuggestions);

        // 2. Check for low maturity areas
        const maturitySuggestions = await checkLowMaturityAreas(userId, projectId);
        suggestions.push(...maturitySuggestions);

        // 3. Check for stale initiatives
        const initiativeSuggestions = await checkStaleInitiatives(userId, projectId);
        suggestions.push(...initiativeSuggestions);

        // 4. Check for missing roadmap
        const roadmapSuggestions = await checkRoadmapStatus(userId, projectId);
        suggestions.push(...roadmapSuggestions);

        // 5. Add conversation-based suggestions
        if (conversationContext.messages && conversationContext.messages.length > 0) {
            const contextSuggestions = generateContextSuggestions(conversationContext);
            suggestions.push(...contextSuggestions);
        }

        // 6. Add onboarding suggestions for new users
        const onboardingSuggestions = await checkOnboardingStatus(userId);
        suggestions.push(...onboardingSuggestions);

    } catch (err) {
        console.error('[SmartSuggestions] Error:', err);
    }

    // Sort by priority and return top 3
    return suggestions
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3);
}

/**
 * Check for incomplete assessments
 */
async function checkAssessmentStatus(userId, projectId) {
    const suggestions = [];

    try {
        if (projectId) {
            // Check project-specific assessment
            const result = await pool.query(`
                SELECT id, name, framework, completion_percent, overall_score
                FROM assessments
                WHERE project_id = $1
                ORDER BY created_at DESC
                LIMIT 1
            `, [projectId]);

            if (result.rows.length > 0) {
                const assessment = result.rows[0];
                const completion = assessment.completion_percent || 0;

                if (completion < 100) {
                    suggestions.push({
                        id: 'continue-assessment',
                        type: 'continue',
                        text: `Continue assessment (${completion}% complete)`,
                        priority: 100 - completion, // Higher priority for less complete
                        context: ['assessment', 'incomplete'],
                        action: {
                            type: 'navigate',
                            view: 'ASSESSMENT_DRD',
                            data: { assessmentId: assessment.id }
                        }
                    });
                }
            } else {
                // No assessment exists - suggest starting one
                suggestions.push({
                    id: 'start-assessment',
                    type: 'action',
                    text: 'Start your digital maturity assessment',
                    priority: 95,
                    context: ['assessment', 'new'],
                    action: {
                        type: 'navigate',
                        view: 'ASSESSMENT_OVERVIEW'
                    }
                });
            }
        }
    } catch (err) {
        console.error('[SmartSuggestions] Assessment check error:', err);
    }

    return suggestions;
}

/**
 * Check for low maturity areas that need attention
 */
async function checkLowMaturityAreas(userId, projectId) {
    const suggestions = [];

    try {
        if (projectId) {
            // Get dimension scores
            const result = await pool.query(`
                SELECT d.name, ds.score
                FROM dimension_scores ds
                JOIN dimensions d ON ds.dimension_id = d.id
                WHERE ds.project_id = $1
                ORDER BY ds.score ASC
                LIMIT 1
            `, [projectId]);

            if (result.rows.length > 0) {
                const lowest = result.rows[0];
                
                if (lowest.score < 2.5) {
                    suggestions.push({
                        id: 'improve-dimension',
                        type: 'insight',
                        text: `${lowest.name} scored ${lowest.score.toFixed(1)} - want improvement suggestions?`,
                        priority: 90,
                        context: ['maturity', 'low-score'],
                        action: {
                            type: 'chat',
                            prompt: `How can I improve my ${lowest.name} maturity?`
                        }
                    });
                }
            }
        }
    } catch (err) {
        console.error('[SmartSuggestions] Maturity check error:', err);
    }

    return suggestions;
}

/**
 * Check for stale initiatives that need updates
 */
async function checkStaleInitiatives(userId, projectId) {
    const suggestions = [];

    try {
        const query = projectId 
            ? `SELECT id, title as name, status, updated_at FROM initiatives WHERE project_id = $1 AND status != 'completed' AND updated_at < NOW() - INTERVAL '7 days' ORDER BY updated_at ASC LIMIT 1`
            : `SELECT i.id, i.title as name, i.status, i.updated_at FROM initiatives i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.status != 'completed' AND i.updated_at < NOW() - INTERVAL '7 days' ORDER BY i.updated_at ASC LIMIT 1`;

        const result = await pool.query(query, [projectId || userId]);

        if (result.rows.length > 0) {
            const initiative = result.rows[0];
            const daysSince = Math.floor((Date.now() - new Date(initiative.updated_at).getTime()) / (1000 * 60 * 60 * 24));

            suggestions.push({
                id: 'update-initiative',
                type: 'followup',
                text: `Update "${initiative.name}"? (${daysSince} days since last update)`,
                priority: 80,
                context: ['initiative', 'stale'],
                action: {
                    type: 'navigate',
                    view: 'FULL_STEP2_INITIATIVES',
                    data: { initiativeId: initiative.id }
                }
            });
        }
    } catch (err) {
        console.error('[SmartSuggestions] Initiative check error:', err);
    }

    return suggestions;
}

/**
 * Check for missing or incomplete roadmap
 */
async function checkRoadmapStatus(userId, projectId) {
    const suggestions = [];

    try {
        if (projectId) {
            // Check for initiatives without roadmap items
            const result = await pool.query(`
                SELECT COUNT(*) as initiative_count,
                       (SELECT COUNT(*) FROM roadmap_items WHERE project_id = $1) as roadmap_count
                FROM initiatives
                WHERE project_id = $1 AND status != 'completed'
            `, [projectId]);

            const { initiative_count, roadmap_count } = result.rows[0];

            if (initiative_count > 0 && roadmap_count === 0) {
                suggestions.push({
                    id: 'create-roadmap',
                    type: 'action',
                    text: `Ready to build your transformation roadmap? (${initiative_count} initiatives pending)`,
                    priority: 85,
                    context: ['roadmap', 'missing'],
                    action: {
                        type: 'navigate',
                        view: 'FULL_STEP3_ROADMAP'
                    }
                });
            }
        }
    } catch (err) {
        console.error('[SmartSuggestions] Roadmap check error:', err);
    }

    return suggestions;
}

/**
 * Generate suggestions based on conversation context
 */
function generateContextSuggestions(conversationContext) {
    const suggestions = [];
    const { messages, idleMinutes } = conversationContext;

    // Check if conversation is idle
    if (idleMinutes && idleMinutes >= 5) {
        suggestions.push({
            id: 'summarize-chat',
            type: 'followup',
            text: 'Would you like me to summarize our discussion?',
            priority: 60,
            context: ['conversation', 'idle'],
            action: {
                type: 'chat',
                prompt: 'Please summarize our conversation so far.'
            }
        });
    }

    // Analyze last few messages for topics
    if (messages && messages.length > 0) {
        const lastMessages = messages.slice(-3);
        const combinedText = lastMessages.map(m => m.content).join(' ').toLowerCase();

        // Topic-based suggestions
        if (combinedText.includes('next step') || combinedText.includes('what should')) {
            suggestions.push({
                id: 'action-plan',
                type: 'insight',
                text: 'Create an action plan from our discussion?',
                priority: 75,
                context: ['conversation', 'action-oriented'],
                action: {
                    type: 'chat',
                    prompt: 'Create a concrete action plan based on our discussion.'
                }
            });
        }

        if (combinedText.includes('compare') || combinedText.includes('versus')) {
            suggestions.push({
                id: 'detailed-comparison',
                type: 'expand',
                text: 'See detailed comparison analysis?',
                priority: 70,
                context: ['conversation', 'comparison'],
                action: {
                    type: 'chat',
                    prompt: 'Provide a detailed comparison with pros and cons.'
                }
            });
        }
    }

    return suggestions;
}

/**
 * Check onboarding status for new users
 */
async function checkOnboardingStatus(userId) {
    const suggestions = [];

    try {
        const result = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM projects WHERE user_id = $1) as project_count,
                (SELECT COUNT(*) FROM assessments a JOIN projects p ON a.project_id = p.id WHERE p.user_id = $1) as assessment_count
        `, [userId]);

        const { project_count, assessment_count } = result.rows[0];

        if (project_count === 0) {
            suggestions.push({
                id: 'create-project',
                type: 'action',
                text: 'Create your first project to get started',
                priority: 100,
                context: ['onboarding', 'new-user'],
                action: {
                    type: 'navigate',
                    view: 'PROJECT_LIST'
                }
            });
        } else if (assessment_count === 0) {
            suggestions.push({
                id: 'first-assessment',
                type: 'action',
                text: 'Start your digital maturity assessment',
                priority: 98,
                context: ['onboarding', 'no-assessment'],
                action: {
                    type: 'navigate',
                    view: 'ASSESSMENT_OVERVIEW'
                }
            });
        }
    } catch (err) {
        console.error('[SmartSuggestions] Onboarding check error:', err);
    }

    return suggestions;
}

/**
 * Get suggestions with caching
 * Suggestions are cached for 5 minutes per user/project
 */
const suggestionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedSuggestions(userId, projectId, conversationContext) {
    const cacheKey = `${userId}-${projectId || 'global'}`;
    const cached = suggestionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        // Merge cached suggestions with real-time conversation suggestions
        const contextSuggestions = generateContextSuggestions(conversationContext);
        return [...cached.suggestions, ...contextSuggestions]
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 3);
    }

    const suggestions = await getSuggestions(userId, projectId, conversationContext);
    suggestionCache.set(cacheKey, { suggestions, timestamp: Date.now() });

    return suggestions;
}

/**
 * Invalidate cache for a user/project (call after state changes)
 */
function invalidateCache(userId, projectId) {
    const cacheKey = `${userId}-${projectId || 'global'}`;
    suggestionCache.delete(cacheKey);
}

export {
getSuggestions,
    getCachedSuggestions,
    invalidateCache,
    checkAssessmentStatus,
    checkLowMaturityAreas,
    checkStaleInitiatives,
    checkRoadmapStatus,
    generateContextSuggestions,
    checkOnboardingStatus
};

export default {
    getSuggestions,
    getCachedSuggestions,
    invalidateCache,
    checkAssessmentStatus,
    checkLowMaturityAreas,
    checkStaleInitiatives,
    checkRoadmapStatus,
    generateContextSuggestions,
    checkOnboardingStatus
};



