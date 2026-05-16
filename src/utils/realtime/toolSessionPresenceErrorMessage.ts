export function toolSessionPresenceErrorMessage(error: unknown, fallback: string): string {
  const record = error && typeof error === 'object' ? (error as { data?: { code?: string } }) : null;
  const code = record?.data?.code;

  if (code === 'REALTIME_TOOL_SESSION_PRESENCE_PAYLOAD_INVALID') {
    return 'Tool-session presence payload is invalid. Refresh the board and retry.';
  }
  if (code === 'REALTIME_TOOL_SESSION_PRESENCE_READ_FAILED') {
    return 'Collaborator presence could not be refreshed. Try again shortly.';
  }
  if (code === 'REALTIME_TOOL_SESSION_PRESENCE_WRITE_FAILED') {
    return 'Presence sync is temporarily unavailable. Try again shortly.';
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}
