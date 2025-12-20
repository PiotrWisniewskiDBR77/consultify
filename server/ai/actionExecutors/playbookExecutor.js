const HelpService = require('../../services/helpService');

/**
 * PlaybookExecutor
 * Executes PLAYBOOK_ASSIGN action.
 */
const PlaybookExecutor = {
    /**
     * Assigns a playbook by recording a STARTED event.
     * @param {Object} payload - The action payload.
     * @param {Object} metadata - Execution context (userId, organizationId).
     */
    execute: async (payload, metadata) => {
        const { playbook_key, entity_id } = payload;
        const { organizationId, userId: actingUserId } = metadata;

        if (!playbook_key) throw new Error('playbook_key is required');

        // entity_id is likely the user who should get the playbook
        // If not provided, default to the acting user.
        const targetUserId = entity_id || actingUserId;

        // Verify playbook exists
        const playbook = await HelpService.getPlaybook(playbook_key);
        if (!playbook) throw new Error(`Playbook not found: ${playbook_key}`);

        // Mark event as STARTED for the target user
        const event = await HelpService.markEvent(
            targetUserId,
            organizationId,
            playbook_key,
            HelpService.EVENT_TYPES.STARTED,
            { assignedBy: actingUserId, source: 'ai_action' }
        );

        return {
            success: true,
            playbookKey: playbook_key,
            playbookTitle: playbook.title,
            targetUserId,
            eventId: event.id,
            message: `Playbook "${playbook.title}" assigned to user ${targetUserId}`
        };
    }
};

module.exports = PlaybookExecutor;
