const SignalEngine = require('./signalEngine');
const AIPlaybookService = require('./aiPlaybookService');

/**
 * AI Playbook Engine
 * Step 10: Generates playbook proposals based on detected signals.
 * 
 * Deterministic and read-only - does not execute anything.
 */
const AIPlaybookEngine = {
    /**
     * Generate playbook proposals for a given context
     * Matches signals to playbook templates.
     * 
     * @param {Object} context - AI context snapshot
     * @returns {Promise<Array>} - List of playbook proposals
     */
    generatePlaybookProposals: async (context) => {
        // 1. Detect signals
        const signals = SignalEngine.detectSignals(context);

        // 2. Get active templates
        const templates = await AIPlaybookService.listTemplates(false);

        // 3. Match signals to templates
        const proposals = [];

        for (const template of templates) {
            // Find matching signals for this template
            const matchingSignals = signals.filter(s =>
                s.type === template.triggerSignal || template.triggerSignal === 'ANY'
            );

            for (const signal of matchingSignals) {
                const proposal = {
                    proposal_id: `pbp-${template.key}-${signal.entity_id}`,
                    proposal_type: 'PLAYBOOK',
                    template_id: template.id,
                    template_key: template.key,
                    title: `${template.title} for ${signal.entity_type} "${signal.entity_name || signal.entity_id}"`,
                    description: template.description,
                    trigger_signal: signal,
                    estimated_duration_mins: template.estimatedDurationMins,
                    scope: signal.entity_type.toLowerCase(),
                    entity_id: signal.entity_id,
                    context: {
                        signal,
                        entity_id: signal.entity_id,
                        entity_type: signal.entity_type,
                        entity_name: signal.entity_name,
                        organization_id: context.organization?.id
                    }
                };

                proposals.push(proposal);
            }
        }

        return proposals;
    },

    /**
     * Get a specific playbook proposal by ID
     */
    getPlaybookProposalById: async (orgId, proposalId) => {
        // Re-generate proposals and find the matching one
        const AICoach = require('./aiCoach');
        const report = await AICoach.getAdvisoryReport(orgId);
        const proposals = await AIPlaybookEngine.generatePlaybookProposals({ data: report.context_snapshot });

        return proposals.find(p => p.proposal_id === proposalId) || null;
    }
};

module.exports = AIPlaybookEngine;
