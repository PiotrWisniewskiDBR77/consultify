/**
 * IS-2 (U-05 / DEC-535, Wpis 121 poz. 2): the ACTIVE sessions list
 * (`GET /interview/sessions` → `loadInterviewSessionsForOrganization`) historically
 * ran `SELECT s.*` with a single `projects` join, so the front-end TEMPLATE /
 * ASSIGNEE / DUE / SUBMITTED columns rendered "—"/"Unassigned" for every row even
 * though the archived/trash tabs (`/sessions/managed`) return the full set.
 *
 * The enriched read adds 1:1 joins (template, owner/respondent, the session's own
 * assignment via `interview_sessions.assignment_id`) so the active tab matches the
 * managed tab. It is a VISIBLE change, so it is gated fail-closed: only the exact
 * string `'true'` enables it; unset/anything else = byte-for-byte the legacy shape.
 */
export function isInterviewSessionsFullColumnsEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.INTERVIEW_SESSIONS_FULL_COLUMNS === 'true';
}
