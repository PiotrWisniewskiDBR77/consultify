/**
 * MeetingExecutor
 * Executes MEETING_SCHEDULE action.
 * (Mocked execution/Classical service adapter)
 */
const MeetingExecutor = {
    /**
     * Mocks scheduling a meeting.
     * @param {Object} payload - The action payload.
     * @param {Object} metadata - Execution context.
     */
    execute: async (payload, metadata) => {
        const { summary, participants, entity_id } = payload;
        const { userId, organizationId } = metadata;

        if (!summary) throw new Error('Meeting summary is required');

        // Logic for classical service would go here:
        // const calendarApi = new GoogleCalendar(actAs = userId);
        // const result = await calendarApi.createEvent({ ... });

        // MOCK SUCCESS
        const meetingId = `mt-${Math.random().toString(36).substr(2, 9)}`;

        return {
            success: true,
            meetingId,
            summary,
            participants: participants || [],
            scheduledAt: new Date().toISOString(),
            message: `Meeting "${summary}" scheduled successfully for ${entity_id || 'context resource'}. Participants: ${(participants || []).join(', ')}`
        };
    }
};

module.exports = MeetingExecutor;
