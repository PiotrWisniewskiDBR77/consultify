export function toolSessionLockErrorMessage(error: unknown, fallback: string): string {
  const record =
    error && typeof error === 'object' ? (error as { data?: { code?: string } }) : null;
  const code = record?.data?.code;

  if (code === 'REALTIME_TOOL_SESSION_LOCK_PAYLOAD_INVALID') {
    return 'Lock payload is invalid. Refresh the board and retry editing.';
  }
  if (code === 'REALTIME_TOOL_SESSION_LOCK_HELD') {
    return 'This block is currently locked by another collaborator.';
  }
  if (code === 'REALTIME_TOOL_SESSION_LOCKS_UNAVAILABLE') {
    return 'Realtime edit locks are temporarily unavailable. Try again shortly.';
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}
