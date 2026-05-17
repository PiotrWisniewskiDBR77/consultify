export function ideaTablePresenceErrorMessage(error: unknown, fallback: string): string {
  const record =
    error && typeof error === 'object' ? (error as { data?: { code?: string } }) : null;
  const code = record?.data?.code;

  if (code === 'IDEA_TABLE_PRESENCE_POLL_FAILED') {
    return 'Idea table presence is unavailable. Refresh My Work and retry.';
  }
  if (code === 'IDEA_TABLE_PRESENCE_UPSERT_FAILED') {
    return 'Could not publish your cursor to collaborators. Retry in a moment.';
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}
