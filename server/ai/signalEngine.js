/**
 * SignalEngine
 * Detects organizational signals based on the provided AI_CONTEXT.
 * Rules are deterministic and explainable.
 */
const SignalEngine = {
    /**
     * Detects all signals within the provided context.
     * @param {Object} context - The AI_CONTEXT snapshot.
     * @returns {Array<Object>} List of detected signals.
     */
    detectSignals: (context) => {
        const signals = [];

        // 1. USER_AT_RISK
        signals.push(...SignalEngine._detectUsersAtRisk(context));

        // 2. BLOCKED_INITIATIVE
        signals.push(...SignalEngine._detectBlockedInitiatives(context));

        // 3. LOW_HELP_ADOPTION
        signals.push(...SignalEngine._detectLowHelpAdoption(context));

        // 4. STRONG_TEAM_MEMBER
        signals.push(...SignalEngine._detectStrongTeamMembers(context));

        return signals;
    },

    _detectUsersAtRisk: (context) => {
        const signals = [];
        const { user_load } = context.data.task_distribution;
        const help_ratios = context.data.help_completion_ratios;

        Object.keys(user_load).forEach(userId => {
            const load = user_load[userId];
            const help = help_ratios[userId] || { ratio: 0, started: 0 };
            const user = context.data.users.find(u => u.id === userId);

            // Logic: High load, zero completion, low help engagement
            if (load.total >= 5 && load.completed === 0 && help.ratio < 0.2) {
                signals.push({
                    type: 'USER_AT_RISK',
                    severity: 'HIGH',
                    entity_type: 'USER',
                    entity_id: userId,
                    title: `User at Risk: ${user ? user.first_name + ' ' + user.last_name : userId}`,
                    description: `${user?.first_name || 'User'} has ${load.total} tasks assigned but hasn't completed any yet. Help adoption is also low (${Math.round(help.ratio * 100)}%).`,
                    evidence: {
                        task_load: load.total,
                        completed_tasks: load.completed,
                        help_completion_ratio: help.ratio,
                        help_started: help.started
                    },
                    explanation: "High task volume combined with zero output and low help engagement suggests a stall or lack of understanding of the tool/process."
                });
            }
        });
        return signals;
    },

    _detectBlockedInitiatives: (context) => {
        const signals = [];
        const initiatives = context.data.initiative_status;

        initiatives.forEach(init => {
            if (init.is_blocked || init.stale_days > 7) {
                const reason = init.is_blocked ? "explicitly blocked" : `stale for ${init.stale_days} days`;
                signals.push({
                    type: 'BLOCKED_INITIATIVE',
                    severity: init.is_blocked ? 'CRITICAL' : 'MEDIUM',
                    entity_type: 'INITIATIVE',
                    entity_id: init.id,
                    title: `Blocked Initiative: ${init.name}`,
                    description: `Initiative "${init.name}" is ${reason}.`,
                    evidence: {
                        status: init.status,
                        stale_days: init.stale_days,
                        is_explicit_blocked: init.is_blocked
                    },
                    explanation: "Initiatives that stop moving for more than 7 days represent a loss of momentum and hidden friction."
                });
            }
        });
        return signals;
    },

    _detectLowHelpAdoption: (context) => {
        const signals = [];
        const help_ratios = context.data.help_completion_ratios;

        let totalStarted = 0;
        let totalCompleted = 0;
        let usersWithHelp = 0;

        Object.values(help_ratios).forEach(stats => {
            totalStarted += stats.started;
            totalCompleted += stats.completed;
            if (stats.started > 0) usersWithHelp++;
        });

        const globalRatio = totalStarted > 0 ? (totalCompleted / totalStarted) : 0;

        if (totalStarted > 5 && globalRatio < 0.3) {
            signals.push({
                type: 'LOW_HELP_ADOPTION',
                severity: 'MEDIUM',
                entity_type: 'ORGANIZATION',
                entity_id: context.orgId,
                title: "Low Help Adoption",
                description: `Across the organization, only ${Math.round(globalRatio * 100)}% of help playbooks are completed after being started.`,
                evidence: {
                    total_started: totalStarted,
                    total_completed: totalCompleted,
                    global_ratio: globalRatio,
                    active_help_users: usersWithHelp
                },
                explanation: "High dropout rate in playbooks suggests either the help content is not engaging or users are getting distracted before completion."
            });
        }
        return signals;
    },

    _detectStrongTeamMembers: (context) => {
        const signals = [];
        const { user_load } = context.data.task_distribution;
        const completions = Object.values(user_load).map(l => l.completed);

        if (completions.length < 2) return [];

        const avg = completions.reduce((a, b) => a + b, 0) / completions.length;
        const stdDev = Math.sqrt(completions.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / completions.length);

        Object.keys(user_load).forEach(userId => {
            const load = user_load[userId];
            const user = context.data.users.find(u => u.id === userId);

            if (load.completed > avg + stdDev && load.completed > 2) {
                signals.push({
                    type: 'STRONG_TEAM_MEMBER',
                    severity: 'LOW', // LOW severity usually means positive/info
                    entity_type: 'USER',
                    entity_id: userId,
                    title: `Strong Contributor: ${user ? user.first_name + ' ' + user.last_name : userId}`,
                    description: `${user?.first_name || 'User'} is performing significantly above the team average in task completion.`,
                    evidence: {
                        completed_tasks: load.completed,
                        team_average: Math.round(avg * 100) / 100,
                        standard_deviations_above: Math.round(((load.completed - avg) / (stdDev || 1)) * 100) / 100
                    },
                    explanation: "Identifying high-output individuals allows for better knowledge sharing and potential promotion/mentoring roles."
                });
            }
        });
        return signals;
    }
};

module.exports = SignalEngine;
