/** Maximum page size accepted by the canonical tool-session list endpoint. */
export const TOOL_SESSIONS_PAGE_LIMIT = 100;

/**
 * The Sessions surface owns every tool session. Lifecycle status is a user
 * filter, not a data-visibility gate; approved sessions must remain reachable
 * here because Reports is backed by artifacts rather than session records.
 */
export function selectVisibleToolSessions<T>(sessions: readonly T[]): T[] {
  return [...sessions];
}
