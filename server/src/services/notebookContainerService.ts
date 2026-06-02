/**
 * Notebook container (Notatnik) service.
 *
 * The container is the L1 entity that holds many notebook_pages (L3 note
 * cards). See docs/product/NOTEBOOK_STRUCTURE_SSOT.md.
 *
 * Two independent axes:
 *   scope            — who can open/edit: 'personal' | 'team' (team_id required for team)
 *   context_sharing  — whether content feeds org AI context: 'private' | 'org_context'
 *
 * Owned by a person (owner_user_id), cross-project (no project_id binding).
 */

import * as queryHelpers from '../utils/queryHelpers.js';

export type NotebookScope = 'personal' | 'team';
export type NotebookContextSharing = 'private' | 'org_context';

export interface NotebookContainerRow {
  id?: string;
  owner_user_id?: string;
  ownerUserId?: string;
  organization_id?: string;
  organizationId?: string;
  title?: string;
  icon?: string | null;
  scope?: string;
  team_id?: string | null;
  teamId?: string | null;
  context_sharing?: string;
  contextSharing?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  page_count?: number;
  pageCount?: number;
}

export interface PublicNotebook {
  id: string;
  ownerUserId: string;
  organizationId: string;
  title: string;
  icon: string | null;
  scope: NotebookScope;
  teamId: string | null;
  contextSharing: NotebookContextSharing;
  pageCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export const normalizeScope = (raw: unknown): NotebookScope =>
  String(raw || '').toLowerCase() === 'team' ? 'team' : 'personal';

export const normalizeContextSharing = (raw: unknown): NotebookContextSharing =>
  String(raw || '').toLowerCase() === 'org_context' ? 'org_context' : 'private';

/** Is `userId` a member of `teamId`? */
export const isTeamMember = async (teamId: string, userId: string): Promise<boolean> => {
  if (!teamId) return false;
  const row = await queryHelpers.queryOne<{ ok: number }>(
    `SELECT 1 as ok FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1`,
    [teamId, userId]
  );
  return Boolean((row as any)?.ok);
};

/**
 * Access (axis A): the owner always; team members when scope='team'.
 * Always hard-bounded by organization.
 */
export const canAccessNotebook = async (
  userId: string,
  orgId: string,
  row: NotebookContainerRow | null | undefined
): Promise<boolean> => {
  if (!row) return false;
  if (String(row.organization_id ?? row.organizationId ?? '') !== String(orgId)) return false;
  const owner = String(row.owner_user_id ?? row.ownerUserId ?? '');
  if (owner === userId) return true;
  const scope = normalizeScope(row.scope);
  if (scope !== 'team') return false;
  const teamId = String(row.team_id ?? row.teamId ?? '');
  if (!teamId) return false;
  return isTeamMember(teamId, userId);
};

/** Only the owner may mutate container metadata (rename, retype, delete). */
export const canMutateNotebook = (
  userId: string,
  orgId: string,
  row: NotebookContainerRow | null | undefined
): boolean => {
  if (!row) return false;
  if (String(row.organization_id ?? row.organizationId ?? '') !== String(orgId)) return false;
  return String(row.owner_user_id ?? row.ownerUserId ?? '') === userId;
};

export const toPublicNotebook = (row: NotebookContainerRow): PublicNotebook => ({
  id: String(row.id ?? ''),
  ownerUserId: String(row.owner_user_id ?? row.ownerUserId ?? ''),
  organizationId: String(row.organization_id ?? row.organizationId ?? ''),
  title: String(row.title ?? ''),
  icon: (row.icon ?? null) as string | null,
  scope: normalizeScope(row.scope),
  teamId: (row.team_id ?? row.teamId ?? null) as string | null,
  contextSharing: normalizeContextSharing(row.context_sharing ?? row.contextSharing),
  pageCount: Number(row.page_count ?? row.pageCount ?? 0) || 0,
  createdAt: (row.created_at ?? row.createdAt ?? null) as string | null,
  updatedAt: (row.updated_at ?? row.updatedAt ?? null) as string | null,
});

/** The deterministic default-notebook id used by the backfill migration. */
export const defaultNotebookId = (orgId: string, userId: string): string =>
  `nb_default_${orgId}_${userId}`;
