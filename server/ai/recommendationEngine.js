/**
 * RecommendationEngine
 * Maps detected signals to prioritized actionable recommendations.
 */
const RecommendationEngine = {
    /**
     * Generates recommendations based on detected signals.
     * @param {Array<Object>} signals - List of detected signals.
     * @returns {Array<Object>} List of recommendations.
     */
    generateRecommendations: (signals) => {
        const recommendations = [];

        signals.forEach(signal => {
            const mapped = RecommendationEngine._mapSignalToRecommendations(signal);
            if (mapped) {
                recommendations.push(...mapped);
            }
        });

        // Sort by priority (1 is highest)
        return recommendations.sort((a, b) => a.priority - b.priority);
    },

    _mapSignalToRecommendations: (signal) => {
        switch (signal.type) {
            case 'USER_AT_RISK':
                return [
                    {
                        signal_type: signal.type,
                        entity_id: signal.entity_id,
                        title: "Schedule Onboarding Review",
                        action: "Conduct a 15-minute sync with the user to identify friction points in their current task list.",
                        reasoning: `The user has ${signal.evidence.task_load} tasks and 0 completions. This usually indicates a tool adoption gap or scope overwhelm.`,
                        category: "TEAM",
                        priority: 1
                    },
                    {
                        signal_type: signal.type,
                        entity_id: signal.entity_id,
                        title: "Assign Mandatory 'First Value' Playbook",
                        action: "Trigger the 'first_value_checklist' playbook for this user to guide them through their first completion.",
                        reasoning: "Help adoption ratio is low. Guiding the user through a guided flow can break the 'blank page' paralysis.",
                        category: "AI",
                        priority: 2
                    }
                ];

            case 'BLOCKED_INITIATIVE':
                return [
                    {
                        signal_type: signal.type,
                        entity_id: signal.entity_id,
                        title: "Escalate Blocker Removal",
                        action: "Identify the owner of the blocking task and move it to the 'Priority 1' slot for the next 24 hours.",
                        reasoning: `Initiative momentum is lost (stale for ${signal.evidence.stale_days} days). Delaying blocker removal compounds ROI loss.`,
                        category: "PROCESS",
                        priority: 1
                    }
                ];

            case 'LOW_HELP_ADOPTION':
                return [
                    {
                        signal_type: signal.type,
                        entity_id: signal.entity_id,
                        title: "Simplify Help Content",
                        action: "Review the 'top dropout' playbooks and reduce step count by 20%.",
                        reasoning: `Global completion ratio is ${Math.round(signal.evidence.global_ratio * 100)}%, suggesting the content is too long or complex for current user patience levels.`,
                        category: "PROCESS",
                        priority: 3
                    }
                ];

            case 'STRONG_TEAM_MEMBER':
                return [
                    {
                        signal_type: signal.type,
                        entity_id: signal.entity_id,
                        title: "Invite to Mentoring Role",
                        action: "Ask this member to record a short Loom or snippet on how they manage their workload.",
                        reasoning: "High performers often have implicit processes that can be institutionalized to lift the whole team's average.",
                        category: "TEAM",
                        priority: 4
                    }
                ];

            default:
                return null;
        }
    }
};

module.exports = RecommendationEngine;
