/**
 * MW-DEC-001 — small, pure presentation helpers shared by the Decision
 * workspace sub-sections. Deliberately self-contained (not imported from
 * DecisionsPanelContent.tsx / DecisionPreviewPanel.tsx, which are owned by a
 * different work item and out of scope to edit) so this component tree stays
 * independently mountable.
 */
import type { WorkspaceUserRef } from './types';

export function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Absolute date+time — used for comments/history where "which exact moment" matters. */
export function formatDateTime(iso?: string | null, locale = 'en-US'): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Absolute date only — used for the due-date pill. */
export function formatDate(iso?: string | null, locale = 'en-US'): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isOverdue(iso?: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Soft, client-side mirror of the backend's admin-like role check
 * (DecisionController.normalizeAdminLikeRole / decisionCollaborationService
 * .isPrivilegedRole). This is ONLY used to decide which controls to show —
 * it is never the actual authorization boundary. The server re-checks on
 * every mutating call and returns 403/409 regardless of what this function
 * says, and the UI must (and does) handle that 403/409 honestly even if this
 * heuristic guessed wrong (e.g. a stale role in the client session).
 */
export function isAdminLikeRole(role?: string | null): boolean {
  const normalized = String(role || '')
    .trim()
    .toUpperCase();
  return (
    normalized === 'ADMIN' ||
    normalized === 'SUPERADMIN' ||
    normalized === 'OWNER' ||
    normalized === 'ADMINISTRATOR' ||
    normalized === 'SUPER_ADMIN'
  );
}

export function buildUserNameMap(users: WorkspaceUserRef[]): Map<string, WorkspaceUserRef> {
  const map = new Map<string, WorkspaceUserRef>();
  for (const u of users) map.set(String(u.id), u);
  return map;
}

/** Resolves a userId to a display name from the org directory, never fabricating one. */
export function resolveUserName(
  usersById: Map<string, WorkspaceUserRef>,
  userId: string | null | undefined,
  fallback: string
): string {
  if (!userId) return fallback;
  const found = usersById.get(String(userId));
  return found?.name || fallback;
}
