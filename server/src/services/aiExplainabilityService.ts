/**
 * AiExplainability Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Provides transparency and explainability for AI-generated recommendations
 */

/**
 * Compute confidence level based on available context
 * @param context - AI context object
 * @param options - Additional options
 * @returns Confidence level: LOW, MEDIUM, or HIGH
 */
function computeConfidenceLevel(context: any, options: any = {}): string {
    if (!context || Object.keys(context).length === 0) {
        return 'LOW';
    }

    const { pmo, project, platform, organization } = context;
    const { projectMemory } = options;

    // Check for critical data availability
    const hasProjectData = !!project?.projectId;
    const hasHealthSnapshot = !!pmo?.healthSnapshot;
    const hasBlockers = pmo?.healthSnapshot?.blockers?.length > 0;
    const hasMemory = projectMemory?.memoryCount > 0;

    // LOW: Missing critical context
    if (!hasProjectData && !hasHealthSnapshot) {
        return 'LOW';
    }

    // MEDIUM: Has some context but with issues
    if (hasBlockers || !hasMemory) {
        return 'MEDIUM';
    }

    // HIGH: Full context with no blockers
    if (hasProjectData && hasHealthSnapshot && platform && organization && !hasBlockers) {
        return 'HIGH';
    }

    return 'MEDIUM';
}

/**
 * Build reasoning summary from context
 * @param context - AI context object
 * @returns Human-readable reasoning summary
 */
function buildReasoningSummary(context: any): string {
    if (!context || !context.pmo?.healthSnapshot) {
        return 'Based on available project context';
    }

    const { healthSnapshot } = context.pmo;
    const parts: string[] = [];

    if (healthSnapshot.tasks?.overdueCount > 0) {
        parts.push(`${healthSnapshot.tasks.overdueCount} overdue task(s)`);
    }

    if (healthSnapshot.decisions?.pendingCount > 0) {
        parts.push(`${healthSnapshot.decisions.pendingCount} pending decision(s)`);
    }

    if (healthSnapshot.blockers?.length > 0) {
        parts.push(`${healthSnapshot.blockers.length} blocker(s)`);
    }

    if (parts.length === 0) {
        return 'Based on current project health';
    }

    return `Based on ${parts.join(', ')}`;
}

/**
 * Extract constraints applied to AI response
 * @param context - AI context object
 * @param policy - AI policy configuration
 * @param role - AI role
 * @returns List of constraints
 */
function extractConstraintsApplied(context: any, policy: any, role: string): string[] {
    const constraints: string[] = [];

    // AI Role constraint
    if (role) {
        const roleDescription = role === 'ADVISOR'
            ? 'explain/suggest only, no mutations'
            : 'can execute actions';
        constraints.push(`AI Role: ${role} (${roleDescription})`);
    }

    // Policy level constraint
    if (policy?.policyLevel) {
        constraints.push(`AI Policy: ${policy.policyLevel}`);
    }

    // Phase gate constraint
    if (context?.project?.phase) {
        constraints.push(`Phase Gate: ${context.project.phase}`);
    }

    return constraints;
}

/**
 * Identify data sources used in AI response
 * @param context - AI context object
 * @returns Data usage information
 */
function identifyDataUsed(context: any) {
    return {
        projectData: !!context?.project?.projectId,
        projectMemoryCount: context?.projectMemory?.memoryCount || 0,
        externalSources: context?.external?.sources || [],
        organizationData: !!context?.organization?.organizationId,
        platformData: !!context?.platform?.role
    };
}

/**
 * Build complete AI explanation object
 * @param responseContext - Response context from AI
 * @returns AI explanation object
 */
function buildAIExplanation(responseContext: any) {
    const { role, context, policy, projectMemory } = responseContext;

    return {
        aiRole: role,
        regulatoryMode: policy?.regulatoryMode || false,
        confidenceLevel: computeConfidenceLevel(context, { projectMemory }),
        reasoningSummary: buildReasoningSummary(context),
        constraintsApplied: extractConstraintsApplied(context, policy, role),
        dataUsed: identifyDataUsed(context),
        timestamp: new Date().toISOString()
    };
}

/**
 * Build human-readable explainability footer
 * @param explanation - AI explanation object
 * @returns Formatted footer text
 */
function buildExplainabilityFooter(explanation: any): string {
    if (!explanation) {
        return '';
    }

    const { aiRole, confidenceLevel, reasoningSummary, constraintsApplied, dataUsed } = explanation;

    const confidenceMap: Record<string, string> = {
        'LOW': 'Low',
        'MEDIUM': 'Medium',
        'HIGH': 'High'
    };

    const roleMap: Record<string, string> = {
        'ADVISOR': 'Advisor',
        'EXECUTOR': 'Executor',
        'COACH': 'Coach'
    };

    const parts: string[] = [
        '---',
        '**Why this recommendation?**',
        reasoningSummary,
        '',
        `**Confidence:** ${confidenceMap[confidenceLevel] || confidenceLevel}`,
        `**AI Role:** ${roleMap[aiRole] || aiRole}`
    ];

    if (dataUsed.projectMemoryCount > 0) {
        parts.push(`**Context:** ${dataUsed.projectMemoryCount} previous interaction(s)`);
    }

    if (constraintsApplied && constraintsApplied.length > 0) {
        parts.push('', '**Constraints:**');
        constraintsApplied.forEach((constraint: string) => {
            parts.push(`- ${constraint}`);
        });
    }

    return parts.join('\n');
}

// Export all functions
const AIExplainabilityService = {
    computeConfidenceLevel,
    buildReasoningSummary,
    extractConstraintsApplied,
    identifyDataUsed,
    buildAIExplanation,
    buildExplainabilityFooter
};

export default AIExplainabilityService;
