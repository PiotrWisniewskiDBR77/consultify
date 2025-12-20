/**
 * ActionProposalMapper
 * Deterministically maps AI Signals to human-readable Action Proposals.
 * REQUIRED MAPPINGS:
 * - USER_AT_RISK    -> TASK_CREATE + PLAYBOOK_ASSIGN
 * - BLOCKED_INITIATIVE -> MEETING_SCHEDULE
 * - LOW_HELP_ADOPTION  -> PLAYBOOK_ASSIGN
 * - STRONG_TEAM_MEMBER -> ROLE_SUGGESTION
 */
const crypto = require('crypto');

/**
 * Generate a deterministic hash from content for stable proposal IDs.
 * @param {string} prefix - The proposal type prefix (e.g., 'tc', 'pa')
 * @param {string} entityId - The entity ID
 * @param {string} signalType - The signal type
 * @returns {string} A stable proposal ID
 */
const generateProposalId = (prefix, entityId, signalType) => {
    const content = `${prefix}-${entityId || 'global'}-${signalType}`;
    const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 8);
    return `ap-${prefix}-${hash}`;
};

const ActionProposalMapper = {
    /**
     * Maps a signal and its associated recommendation/simulation to proposals.
     * @param {Object} signal - The detected signal.
     * @param {Object} recommendation - The associated recommendation.
     * @param {Object} simulation - The associated simulation.
     * @returns {Array<Object>} List of generated action proposals.
     */
    mapSignalToProposals: (signal, recommendation, simulation) => {
        const proposals = [];

        switch (signal.type) {
            case 'USER_AT_RISK':
                // Mapping: TASK_CREATE
                proposals.push({
                    proposal_id: generateProposalId('tc', signal.entity_id, signal.type),
                    origin_signal: signal.type,
                    origin_recommendation: recommendation?.title || "N/A",
                    title: `Create onboarding review task for ${signal.title.split(': ')[1] || 'User'}`,
                    action_type: "TASK_CREATE",
                    scope: "USER",
                    payload_preview: {
                        entity_id: signal.entity_id,
                        title: "Onboarding review",
                        description: recommendation?.action || "Review user friction points."
                    },
                    risk_level: "LOW",
                    expected_impact: simulation?.narrative || "Improve user retention and initial value realization.",
                    simulation: {
                        assumptions: simulation?.assumptions || [],
                        expected_direction: "positive"
                    },
                    requires_approval: true
                });

                // Mapping: PLAYBOOK_ASSIGN
                proposals.push({
                    proposal_id: generateProposalId('pa', signal.entity_id, signal.type),
                    origin_signal: signal.type,
                    origin_recommendation: recommendation?.title || "N/A",
                    title: `Assign First Value playbook to ${signal.title.split(': ')[1] || 'User'}`,
                    action_type: "PLAYBOOK_ASSIGN",
                    scope: "USER",
                    payload_preview: {
                        entity_id: signal.entity_id,
                        playbook_key: "first_value_checklist"
                    },
                    risk_level: "LOW",
                    expected_impact: "Guide user to their first meaningful accomplishment in the platform.",
                    simulation: {
                        assumptions: ["User is willing to follow a guide"],
                        expected_direction: "positive"
                    },
                    requires_approval: true
                });
                break;

            case 'BLOCKED_INITIATIVE':
                // Mapping: MEETING_SCHEDULE
                proposals.push({
                    proposal_id: generateProposalId('ms', signal.entity_id, signal.type),
                    origin_signal: signal.type,
                    origin_recommendation: recommendation?.title || "N/A",
                    title: `Schedule unblocking sync for ${signal.title.split(': ')[1] || 'Initiative'}`,
                    action_type: "MEETING_SCHEDULE",
                    scope: "INITIATIVE",
                    payload_preview: {
                        entity_id: signal.entity_id,
                        summary: `Blocker removal sync for ${signal.title.split(': ')[1]}`,
                        participants: ["Owner", "Blocker Resource"]
                    },
                    risk_level: "MEDIUM",
                    expected_impact: simulation?.narrative || "Unfreeze dependencies and recover lost momentum.",
                    simulation: {
                        assumptions: simulation?.assumptions || [],
                        expected_direction: "positive"
                    },
                    requires_approval: true
                });
                break;

            case 'LOW_HELP_ADOPTION':
                // Mapping: PLAYBOOK_ASSIGN
                proposals.push({
                    proposal_id: generateProposalId('ha', signal.entity_id, signal.type),
                    origin_signal: signal.type,
                    origin_recommendation: recommendation?.title || "N/A",
                    title: "Assign 'Help Content Optimization' playbook to Admin",
                    action_type: "PLAYBOOK_ASSIGN",
                    scope: "ORG",
                    payload_preview: {
                        entity_id: signal.entity_id,
                        playbook_key: "help_optimization"
                    },
                    risk_level: "LOW",
                    expected_impact: simulation?.narrative || "Identify and fix patterns where users get stuck in help docs.",
                    simulation: {
                        assumptions: simulation?.assumptions || [],
                        expected_direction: "positive"
                    },
                    requires_approval: true
                });
                break;

            case 'STRONG_TEAM_MEMBER':
                // Mapping: ROLE_SUGGESTION
                proposals.push({
                    proposal_id: generateProposalId('rs', signal.entity_id, signal.type),
                    origin_signal: signal.type,
                    origin_recommendation: recommendation?.title || "N/A",
                    title: `Suggest Mentoring role for ${signal.title.split(': ')[1] || 'User'}`,
                    action_type: "ROLE_SUGGESTION",
                    scope: "ORG",
                    payload_preview: {
                        entity_id: signal.entity_id,
                        suggested_role: "Internal Mentor"
                    },
                    risk_level: "LOW",
                    expected_impact: simulation?.narrative || "Scale best practices by formalizing high-performer contributions.",
                    simulation: {
                        assumptions: simulation?.assumptions || [],
                        expected_direction: "positive"
                    },
                    requires_approval: true
                });
                break;

            default:
                break;
        }

        // Rule: Max 2 proposals per signal
        return proposals.slice(0, 2);
    }
};

module.exports = ActionProposalMapper;
