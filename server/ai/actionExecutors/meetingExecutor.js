/**
 * MeetingExecutor
 * Executes MEETING_SCHEDULE action.
 * Step 17: Now uses connector adapter layer for external integrations.
 */
const connectorAdapter = require('../connectorAdapter');

const MeetingExecutor = {
    /**
     * Schedules a meeting via connector (Google Calendar, etc.).
     * @param {Object} payload - The action payload.
     * @param {Object} metadata - Execution context.
     */
    execute: async (payload, metadata) => {
        const { summary, participants, entity_id, start_time, end_time, calendar_connector = 'google_calendar' } = payload;
        const { userId, organizationId, dry_run = false } = metadata;

        if (!summary) throw new Error('Meeting summary is required');

        // Use connector adapter for external integration
        const result = await connectorAdapter.execute(
            organizationId,
            calendar_connector,
            'event_create',
            {
                summary,
                participants: participants || [],
                entity_id,
                start_time: start_time || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default: tomorrow
                end_time: end_time || new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),     // Default: 1 hour later
                organizer_id: userId
            },
            { dry_run }
        );

        if (result.dry_run) {
            return {
                success: true,
                dry_run: true,
                would_do: result.would_do,
                external_calls: result.external_calls,
                connector_key: calendar_connector,
                sandbox_mode: result.sandbox_mode
            };
        }

        if (!result.success) {
            throw new Error(result.error || 'Failed to schedule meeting');
        }

        return {
            success: true,
            meetingId: result.result?.id || `mt-${Math.random().toString(36).substr(2, 9)}`,
            summary,
            participants: participants || [],
            scheduledAt: new Date().toISOString(),
            connector_key: calendar_connector,
            result: result.result,
            message: `Meeting "${summary}" scheduled successfully for ${entity_id || 'context resource'}.`
        };
    },

    /**
     * Dry-run mode: returns what would happen without execution.
     * @param {Object} payload - The action payload.
     * @param {Object} metadata - Execution context.
     */
    dryRun: async (payload, metadata) => {
        return MeetingExecutor.execute(payload, { ...metadata, dry_run: true });
    }
};

module.exports = MeetingExecutor;

