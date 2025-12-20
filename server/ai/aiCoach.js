const AIContextBuilder = require('./aiContextBuilder');
const SignalEngine = require('./signalEngine');
const RecommendationEngine = require('./recommendationEngine');
const SimulationEngine = require('./simulationEngine');

/**
 * AICoach Facade
 * Orchestrates the AI Advisor pipeline:
 * Context -> Signals -> Recommendations -> Simulation
 */
const AICoach = {
    /**
     * Gets a full health report for the organization.
     * @param {string} orgId - The organization ID.
     * @returns {Promise<Object>} The full advisory report.
     */
    getAdvisoryReport: async (orgId) => {
        // 1. Build Context
        const context = await AIContextBuilder.buildContext(orgId);

        // 2. Detect Signals
        const signals = SignalEngine.detectSignals(context);

        // 3. Generate Recommendations
        const recommendations = RecommendationEngine.generateRecommendations(signals);

        // 4. Simulate Impacts
        const simulations = SimulationEngine.simulateImpacts(recommendations);

        return {
            orgId,
            orgName: context.orgName,
            timestamp: context.timestamp,
            summary: {
                task_count: context.data.task_distribution.total,
                active_initiatives: context.data.initiative_status.length,
                health_score: AICoach._calculateHealthScore(context, signals)
            },
            signals,
            recommendations,
            simulations,
            context_snapshot: context.data, // For audit/verification
            audit: {
                context_id: context.timestamp, // In real system, would be a UUID
                data_sources: ['tasks', 'initiatives', 'help_events', 'metrics_events', 'organization_events'],
                version: '1.0.0-governed'
            }
        };
    },

    /**
     * Simple health score calculation (0-100)
     */
    _calculateHealthScore: (context, signals) => {
        let score = 100;

        // Penalty for high-severity signals
        signals.forEach(s => {
            if (s.severity === 'CRITICAL') score -= 15;
            if (s.severity === 'HIGH') score -= 10;
            if (s.severity === 'MEDIUM') score -= 5;
        });

        // Penalties for blocked initiatives
        const blockedCount = context.data.initiative_status.filter(i => i.is_blocked).length;
        score -= (blockedCount * 5);

        return Math.max(0, score);
    }
};

module.exports = AICoach;
