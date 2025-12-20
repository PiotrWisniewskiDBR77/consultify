/**
 * AI Explainability Service
 * 
 * Core service for generating deterministic AIExplanation objects.
 * Ensures every AI response is explainable, traceable, and auditable.
 * 
 * AI Trust & Explainability Layer
 */

// Confidence Level Enum (mirrors TypeScript types)
const AIConfidenceLevel = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH'
};

// AI Project Role Enum (mirrors TypeScript types)
const AIProjectRole = {
    ADVISOR: 'ADVISOR',
    MANAGER: 'MANAGER',
    OPERATOR: 'OPERATOR'
};

/**
 * Compute confidence level based on context quality
 * 
 * CONFIDENCE LEVEL RULES (Deterministic):
 * 
 * LOW:
 * - No PMOHealthSnapshot available
 * - Missing project data (projectId is null)
 * - Conflicting signals (blockers > 3 AND pending decisions > 3)
 * - Missing critical context layers
 * 
 * MEDIUM:
 * - PMOHealthSnapshot exists but has missing criteria
 * - Heuristics used (e.g., intent detection fallback)
 * - External sources were fetched but not verified
 * - Some blockers present (1-3)
 * 
 * HIGH:
 * - PMOHealthSnapshot confirms project health
 * - No blockers or all blockers are acknowledged
 * - Full context available (6 layers populated)
 * - Project memory is present
 * 
 * @param {Object} context - The AI context object
 * @param {Object} options - Additional options
 * @returns {string} - 'LOW' | 'MEDIUM' | 'HIGH'
 */
const computeConfidenceLevel = (context, options = {}) => {
    // Safety check: no context means LOW confidence
    if (!context) {
        return AIConfidenceLevel.LOW;
    }

    let score = 0;
    const maxScore = 10;

    // ============================================
    // RULE 1: PMO Health Snapshot availability (+3)
    // ============================================
    const healthSnapshot = context?.pmo?.healthSnapshot;
    if (healthSnapshot) {
        score += 3;

        // Bonus: No blockers detected (+1)
        if (!healthSnapshot.blockers || healthSnapshot.blockers.length === 0) {
            score += 1;
        }
    }

    // ============================================
    // RULE 2: Project data availability (+2)
    // ============================================
    if (context?.project && context.project.projectId) {
        score += 2;
    }

    // ============================================
    // RULE 3: Project memory presence (+1)
    // ============================================
    const projectMemory = options.projectMemory || context?.projectMemory;
    if (projectMemory && projectMemory.memoryCount > 0) {
        score += 1;
    }

    // ============================================
    // RULE 4: Context layer completeness (+2)
    // ============================================
    const layerCount = _countPopulatedLayers(context);
    if (layerCount >= 5) {
        score += 2;
    } else if (layerCount >= 3) {
        score += 1;
    }

    // ============================================
    // RULE 5: Conflicting signals penalty (-2)
    // ============================================
    const blockerCount = _getBlockerCount(context);
    const pendingDecisions = context?.execution?.pendingDecisions?.length || 0;

    if (blockerCount > 3 && pendingDecisions > 3) {
        // Conflicting signals: too many issues to be confident
        score -= 2;
    }

    // ============================================
    // RULE 6: External data uncertainty (-1)
    // ============================================
    if (context?.external?.internetEnabled && context?.external?.fetchedData) {
        // External data adds uncertainty unless verified
        score -= 1;
    }

    // ============================================
    // COMPUTE FINAL CONFIDENCE
    // ============================================
    const normalizedScore = Math.max(0, Math.min(score, maxScore));
    const percentage = (normalizedScore / maxScore) * 100;

    if (percentage >= 70) {
        return AIConfidenceLevel.HIGH;
    } else if (percentage >= 40) {
        return AIConfidenceLevel.MEDIUM;
    } else {
        return AIConfidenceLevel.LOW;
    }
};

/**
 * Count the number of populated context layers
 * @private
 */
const _countPopulatedLayers = (context) => {
    if (!context) return 0;

    let count = 0;
    if (context.platform && Object.keys(context.platform).length > 0) count++;
    if (context.organization && context.organization.organizationId) count++;
    if (context.project && context.project.projectId) count++;
    if (context.execution && (context.execution.userTasks || context.execution.pendingDecisions)) count++;
    if (context.knowledge && Object.keys(context.knowledge).length > 0) count++;
    if (context.external && Object.keys(context.external).length > 0) count++;

    return count;
};

/**
 * Get total blocker count from context
 * @private
 */
const _getBlockerCount = (context) => {
    let count = 0;

    // From PMO health snapshot
    const healthSnapshot = context?.pmo?.healthSnapshot;
    if (healthSnapshot?.blockers) {
        count += healthSnapshot.blockers.length;
    }

    // From execution context
    if (context?.execution?.blockers) {
        count += context.execution.blockers.length;
    }

    return count;
};

/**
 * Build a reasoning summary based on context
 * This is deterministic and NOT LLM-dependent
 * 
 * @param {Object} context - The AI context
 * @param {Object} options - Additional options
 * @returns {string} - Human-readable reasoning summary
 */
const buildReasoningSummary = (context, options = {}) => {
    const parts = [];
    const healthSnapshot = context?.pmo?.healthSnapshot;

    // Task-related insights
    if (healthSnapshot?.tasks) {
        if (healthSnapshot.tasks.overdueCount > 0) {
            parts.push(`${healthSnapshot.tasks.overdueCount} overdue task(s)`);
        }
        if (healthSnapshot.tasks.blockedCount > 0) {
            parts.push(`${healthSnapshot.tasks.blockedCount} blocked task(s)`);
        }
    }

    // Decision-related insights
    if (healthSnapshot?.decisions?.pendingCount > 0) {
        parts.push(`${healthSnapshot.decisions.pendingCount} pending decision(s)`);
    }

    // Initiative-related insights
    if (healthSnapshot?.initiatives?.atRiskCount > 0) {
        parts.push(`${healthSnapshot.initiatives.atRiskCount} initiative(s) at risk`);
    }

    // Blockers
    if (healthSnapshot?.blockers?.length > 0) {
        const blockerTypes = [...new Set(healthSnapshot.blockers.map(b => b.type))];
        parts.push(`${healthSnapshot.blockers.length} blocker(s) (${blockerTypes.join(', ')})`);
    }

    // Phase information
    if (healthSnapshot?.phase?.name) {
        parts.push(`current phase: ${healthSnapshot.phase.name}`);
    }

    // Stage gate status
    if (healthSnapshot?.stageGate?.gateType) {
        if (healthSnapshot.stageGate.isReady) {
            parts.push(`stage gate ${healthSnapshot.stageGate.gateType} is ready`);
        } else {
            const missingCount = healthSnapshot.stageGate.missingCriteria?.length || 0;
            if (missingCount > 0) {
                parts.push(`stage gate ${healthSnapshot.stageGate.gateType} has ${missingCount} missing criteria`);
            }
        }
    }

    // Project memory
    const projectMemory = options.projectMemory || context?.projectMemory;
    if (projectMemory?.memoryCount > 0) {
        parts.push(`${projectMemory.memoryCount} project memory item(s) consulted`);
    }

    if (parts.length === 0) {
        return 'Based on available project context';
    }

    return 'Based on ' + parts.join(', ');
};

/**
 * Extract list of constraints applied to this response
 * 
 * @param {Object} context - The AI context
 * @param {Object} policy - The AI policy configuration
 * @param {string} aiRole - The active AI role
 * @returns {string[]} - List of constraints
 */
const extractConstraintsApplied = (context, policy, aiRole) => {
    const constraints = [];

    // AI Role constraint
    if (aiRole) {
        const roleDescriptions = {
            [AIProjectRole.ADVISOR]: 'AI Role: ADVISOR (explain/suggest only, no mutations)',
            [AIProjectRole.MANAGER]: 'AI Role: MANAGER (can draft, requires approval)',
            [AIProjectRole.OPERATOR]: 'AI Role: OPERATOR (can execute within governance)'
        };
        constraints.push(roleDescriptions[aiRole] || `AI Role: ${aiRole}`);
    }

    // Policy level constraint
    if (policy?.policyLevel) {
        constraints.push(`AI Policy: ${policy.policyLevel} mode`);
    }

    // Phase gate constraint
    const healthSnapshot = context?.pmo?.healthSnapshot;
    if (healthSnapshot?.phase?.name) {
        constraints.push(`Phase Gate: ${healthSnapshot.phase.name}`);
    }

    // Stage gate readiness
    if (healthSnapshot?.stageGate?.gateType && !healthSnapshot.stageGate.isReady) {
        constraints.push(`Stage gate not ready: ${healthSnapshot.stageGate.gateType}`);
    }

    // Governance settings
    if (context?.project?.governanceSettings?.requireApprovalForPhaseTransition) {
        constraints.push('Phase transition requires approval');
    }

    // Regulatory mode
    if (context?.regulatoryMode || context?.project?.regulatoryMode) {
        constraints.push('Regulatory compliance mode active');
    }

    return constraints;
};

/**
 * Identify data sources used for this response
 * 
 * @param {Object} context - The AI context
 * @param {Object} options - Additional options
 * @returns {Object} - Data used object
 */
const identifyDataUsed = (context, options = {}) => {
    const projectMemory = options.projectMemory || context?.projectMemory;

    return {
        projectData: !!(context?.project && context.project.projectId),
        projectMemoryCount: projectMemory?.memoryCount || 0,
        externalSources: _extractExternalSources(context)
    };
};

/**
 * Extract external sources list
 * @private
 */
const _extractExternalSources = (context) => {
    const sources = [];

    if (!context?.external?.internetEnabled) {
        return sources;
    }

    if (context.external.fetchedData?.webSearch) {
        sources.push('Web Search');
    }
    if (context.external.fetchedData?.news) {
        sources.push('News');
    }
    if (context.external.fetchedData?.market) {
        sources.push('Market Data');
    }
    if (context.external.externalSourcesUsed?.length > 0) {
        sources.push(...context.external.externalSourcesUsed);
    }

    return [...new Set(sources)]; // Deduplicate
};

/**
 * Build complete AIExplanation object
 * 
 * This is the main entry point for generating explainability metadata.
 * Called by aiOrchestrator before every AI response.
 * 
 * @param {Object} responseContext - The orchestrator response context
 * @returns {Object} - Complete AIExplanation object
 */
const buildAIExplanation = (responseContext) => {
    const context = responseContext?.context || {};
    const policy = responseContext?.policy || {};
    const projectMemory = responseContext?.projectMemory;

    // Determine AI Role (map from orchestrator roles to project roles)
    const orchestratorRole = responseContext?.role || 'ADVISOR';
    const aiRole = _mapOrchestratorRoleToProjectRole(orchestratorRole);

    // Determine regulatory mode
    const regulatoryMode = !!(
        context?.project?.regulatoryMode ||
        context?.regulatoryMode ||
        policy?.regulatoryMode
    );

    // Compute all explanation components
    const confidenceLevel = computeConfidenceLevel(context, { projectMemory });
    const reasoningSummary = buildReasoningSummary(context, { projectMemory });
    const constraintsApplied = extractConstraintsApplied(context, policy, aiRole);
    const dataUsed = identifyDataUsed(context, { projectMemory });

    return {
        aiRole,
        regulatoryMode,
        confidenceLevel,
        reasoningSummary,
        dataUsed,
        constraintsApplied,
        timestamp: new Date().toISOString()
    };
};

/**
 * Map orchestrator role to project role
 * @private
 */
const _mapOrchestratorRoleToProjectRole = (orchestratorRole) => {
    const mapping = {
        'ADVISOR': AIProjectRole.ADVISOR,
        'PMO_MANAGER': AIProjectRole.MANAGER,
        'EXECUTOR': AIProjectRole.OPERATOR,
        'EDUCATOR': AIProjectRole.ADVISOR
    };
    return mapping[orchestratorRole] || AIProjectRole.ADVISOR;
};

/**
 * Build human-readable explainability footer for UI
 * 
 * Example output:
 * ---
 * Why this recommendation?
 * • Based on 3 overdue critical tasks and 1 pending governance decision
 * • Constrained by current phase gate (Execution)
 * • Confidence: Medium
 * • AI Role: Advisor
 * ---
 * 
 * @param {Object} explanation - The AIExplanation object
 * @returns {string} - Formatted footer string
 */
const buildExplainabilityFooter = (explanation) => {
    if (!explanation) {
        return '';
    }

    const lines = ['---', '**Why this recommendation?**'];

    // Reasoning summary
    if (explanation.reasoningSummary) {
        lines.push(`• ${explanation.reasoningSummary}`);
    }

    // Key constraints (show max 3)
    const keyConstraints = (explanation.constraintsApplied || []).slice(0, 3);
    keyConstraints.forEach(constraint => {
        lines.push(`• ${constraint}`);
    });

    // Confidence level (human-readable)
    const confidenceLabels = {
        [AIConfidenceLevel.LOW]: 'Low',
        [AIConfidenceLevel.MEDIUM]: 'Medium',
        [AIConfidenceLevel.HIGH]: 'High'
    };
    const confidenceLabel = confidenceLabels[explanation.confidenceLevel] || explanation.confidenceLevel;
    lines.push(`• Confidence: ${confidenceLabel}`);

    // AI Role (human-readable)
    const roleLabels = {
        [AIProjectRole.ADVISOR]: 'Advisor',
        [AIProjectRole.MANAGER]: 'Manager',
        [AIProjectRole.OPERATOR]: 'Operator'
    };
    const roleLabel = roleLabels[explanation.aiRole] || explanation.aiRole;
    lines.push(`• AI Role: ${roleLabel}`);

    lines.push('---');

    return lines.join('\n');
};

module.exports = {
    // Enums
    AIConfidenceLevel,
    AIProjectRole,

    // Core functions
    computeConfidenceLevel,
    buildReasoningSummary,
    extractConstraintsApplied,
    identifyDataUsed,
    buildAIExplanation,
    buildExplainabilityFooter,

    // Internal helpers (exported for testing)
    _countPopulatedLayers,
    _getBlockerCount,
    _extractExternalSources,
    _mapOrchestratorRoleToProjectRole
};
