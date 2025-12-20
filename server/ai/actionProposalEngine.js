const SignalEngine = require('./signalEngine');
const RecommendationEngine = require('./recommendationEngine');
const SimulationEngine = require('./simulationEngine');
const ActionProposalMapper = require('./actionProposalMapper');

/**
 * ActionProposalEngine
 * Transforms AI Signals into human-readable Action Proposals.
 * Deterministic and read-only.
 */
const ActionProposalEngine = {
    /**
     * Generates action proposals for a given organization context.
     * @param {Object} context - The AI_CONTEXT snapshot.
     * @returns {Array<Object>} List of final action proposals.
     */
    generateProposals: (context) => {
        // 1. Detect Signals
        const signals = SignalEngine.detectSignals(context);

        // 2. Map Signals to Recommendations
        const recommendations = RecommendationEngine.generateRecommendations(signals);

        // 3. Simulate Impacts for recommendations
        const simulations = SimulationEngine.simulateImpacts(recommendations);

        const allProposals = [];

        // 4. Map everything to Action Proposals
        signals.forEach(signal => {
            // Find associated recommendation and simulation for this signal
            const relevantRec = recommendations.find(r => r.signal_type === signal.type && r.entity_id === signal.entity_id);
            const relevantSim = simulations.find(s => s.recommendation_title === relevantRec?.title);

            const proposals = ActionProposalMapper.mapSignalToProposals(signal, relevantRec, relevantSim);

            if (proposals && proposals.length > 0) {
                allProposals.push(...proposals);
            }
        });

        // Ensure deterministic output (sort by proposal_id)
        return allProposals.sort((a, b) => a.proposal_id.localeCompare(b.proposal_id));
    },

    /**
     * Gets a specific proposal by ID for server-side verification.
     * @param {string} orgId - The organization ID.
     * @param {string} proposalId - The target proposal ID.
     * @returns {Promise<Object|null>} The proposal if found.
     */
    getProposalById: async (orgId, proposalId) => {
        // In a real system, we'd build context first.
        // For simplicity, we use the AICoach to get all proposals and filter.
        const AICoach = require('./aiCoach');
        const report = await AICoach.getAdvisoryReport(orgId);
        const proposals = ActionProposalEngine.generateProposals({ data: report.context_snapshot });

        return proposals.find(p => p.proposal_id === proposalId) || null;
    }
};

module.exports = ActionProposalEngine;
