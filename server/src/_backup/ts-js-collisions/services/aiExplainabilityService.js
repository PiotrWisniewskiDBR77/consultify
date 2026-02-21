/**
 * AI Explainability Service
 * Provides transparency and explainability for AI-generated recommendations
 */

/**
 * Compute confidence level based on available context
 * @param {Object} context - AI context object
 * @param {Object} options - Additional options
 * @returns {string} Confidence level: LOW, MEDIUM, or HIGH
 */
function computeConfidenceLevel(context, options = {}) {
  if (!context || Object.keys(context).length === 0) {
    return 'LOW';
  }

  const { pmo, project, platform, organization, execution, knowledge, external } = context;
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
 * @param {Object} context - AI context object
 * @returns {string} Human-readable reasoning summary
 */
function buildReasoningSummary(context) {
  if (!context || !context.pmo?.healthSnapshot) {
    return 'Based on available project context';
  }

  const { healthSnapshot } = context.pmo;
  const parts = [];

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
 * @param {Object} context - AI context object
 * @param {Object} policy - AI policy configuration
 * @param {string} role - AI role
 * @returns {Array<string>} List of constraints
 */
function extractConstraintsApplied(context, policy, role) {
  const constraints = [];

  // AI Role constraint
  if (role) {
    const roleDescription =
      role === 'ADVISOR' ? 'explain/suggest only, no mutations' : 'can execute actions';
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
 * @param {Object} context - AI context object
 * @returns {Object} Data usage information
 */
function identifyDataUsed(context) {
  return {
    projectData: !!context?.project?.projectId,
    projectMemoryCount: context?.projectMemory?.memoryCount || 0,
    externalSources: context?.external?.sources || [],
    organizationData: !!context?.organization?.organizationId,
    platformData: !!context?.platform?.role,
  };
}

/**
 * Build complete AI explanation object
 * @param {Object} responseContext - Response context from AI
 * @returns {Object} AI explanation object
 */
function buildAIExplanation(responseContext) {
  const { role, context, policy, projectMemory } = responseContext;

  return {
    aiRole: role,
    regulatoryMode: policy?.regulatoryMode || false,
    confidenceLevel: computeConfidenceLevel(context, { projectMemory }),
    reasoningSummary: buildReasoningSummary(context),
    constraintsApplied: extractConstraintsApplied(context, policy, role),
    dataUsed: identifyDataUsed(context),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build human-readable explainability footer
 * @param {Object} explanation - AI explanation object
 * @returns {string} Formatted footer text
 */
function buildExplainabilityFooter(explanation) {
  if (!explanation) {
    return '';
  }

  const { aiRole, confidenceLevel, reasoningSummary, constraintsApplied, dataUsed } = explanation;

  const confidenceMap = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
  };

  const roleMap = {
    ADVISOR: 'Advisor',
    EXECUTOR: 'Executor',
    COACH: 'Coach',
  };

  const parts = [
    '---',
    '**Why this recommendation?**',
    reasoningSummary,
    '',
    `**Confidence:** ${confidenceMap[confidenceLevel] || confidenceLevel}`,
    `**AI Role:** ${roleMap[aiRole] || aiRole}`,
  ];

  if (dataUsed.projectMemoryCount > 0) {
    parts.push(`**Context:** ${dataUsed.projectMemoryCount} previous interaction(s)`);
  }

  if (constraintsApplied && constraintsApplied.length > 0) {
    parts.push('', '**Constraints:**');
    constraintsApplied.forEach((constraint) => {
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
  buildExplainabilityFooter,
};

export default AIExplainabilityService;
