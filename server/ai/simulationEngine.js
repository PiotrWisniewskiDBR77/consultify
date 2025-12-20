/**
 * SimulationEngine
 * Simulates directional impact of recommendations.
 */
const SimulationEngine = {
    /**
     * Simulates outcomes for a list of recommendations.
     * @param {Array<Object>} recommendations - List of recommendations.
     * @returns {Array<Object>} List of simulations.
     */
    simulateImpacts: (recommendations) => {
        return recommendations.map(rec => SimulationEngine._simulateRecommendation(rec));
    },

    _simulateRecommendation: (recommendation) => {
        const simulation = {
            recommendation_title: recommendation.title,
            metric_impacts: [],
            narrative: "",
            assumptions: [],
            confidence: 0.7 // Default confidence
        };

        switch (recommendation.signal_type) {
            case 'USER_AT_RISK':
                simulation.metric_impacts = [
                    { metric: 'Task Throughput', direction: 'UP', outlook: 'Significant' },
                    { metric: 'User Satisfaction', direction: 'UP', outlook: 'Moderate' }
                ];
                simulation.narrative = "Addressing friction early will prevent the user from disengaging with the platform. Successful onboarding review usually results in the first 3 tasks being completed within 48 hours.";
                simulation.assumptions = [
                    "User is available for a sync",
                    "Blockers are tool-related, not organizational politics"
                ];
                simulation.confidence = 0.85;
                break;

            case 'BLOCKED_INITIATIVE':
                simulation.metric_impacts = [
                    { metric: 'Project Velocity', direction: 'UP', outlook: 'Critical' },
                    { metric: 'Budget Burn', direction: 'STABLE', outlook: 'Positive' }
                ];
                simulation.narrative = "Removing this blocker will unfreeze the downstream dependencies of the initiative, potentially saving 3-5 days of 'wait time' overhead.";
                simulation.assumptions = [
                    "Blocker resource is internal",
                    "No new blockers appear immediately"
                ];
                simulation.confidence = 0.75;
                break;

            case 'LOW_HELP_ADOPTION':
                simulation.metric_impacts = [
                    { metric: 'Feature Adoption', direction: 'UP', outlook: 'Moderate' },
                    { metric: 'Support Tickets', direction: 'DOWN', outlook: 'Moderate' }
                ];
                simulation.narrative = "Simplified help content increases completion rates, which correlates with 20% higher sustained platform engagement.";
                simulation.assumptions = [
                    "UI hasn't fundamentally changed",
                    "Users are actually reading the simplified content"
                ];
                simulation.confidence = 0.6;
                break;

            case 'STRONG_TEAM_MEMBER':
                simulation.metric_impacts = [
                    { metric: 'Team Average Output', direction: 'UP', outlook: 'Low/Long-term' }
                ];
                simulation.narrative = "Capturing 'expert knowledge' helps bridge the gap between high performers and the rest of the team through social proof and shared tactics.";
                simulation.assumptions = [
                    "User is willing to share knowledge",
                    "Teammates are receptive to peer learning"
                ];
                simulation.confidence = 0.5;
                break;

            default:
                simulation.narrative = "Impact is expected to be positive but lacks specific data for precise simulation.";
                simulation.assumptions = ["Ceteris paribus (all other things equal)"];
        }

        return simulation;
    }
};

module.exports = SimulationEngine;
