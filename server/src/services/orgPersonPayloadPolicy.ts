import { normalizeAccessRole } from '../middleware/requestAccess.js';

export type OrgPersonViewerRole = 'superadmin' | 'owner' | 'admin' | 'member' | 'guest' | '';

export function canReadOrgPersonPrivateFields(role: unknown): boolean {
  const normalized = normalizeAccessRole(role);
  return normalized === 'superadmin' || normalized === 'owner' || normalized === 'admin';
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function orgPersonDisplayName(row: Record<string, unknown>): string {
  const explicit = str(row.displayName) ?? str(row.display_name) ?? str(row.name);
  if (explicit) return explicit;
  const first = str(row.firstName) ?? str(row.first_name);
  const last = str(row.lastName) ?? str(row.last_name);
  const joined = [first, last].filter(Boolean).join(' ').trim();
  if (joined) return joined;
  return str(row.email) ?? str(row.id) ?? str(row.user_id) ?? 'UNKNOWN_USER';
}

export function shapeOrgPersonPayload<T extends Record<string, unknown>>(
  row: T,
  viewerRole: unknown
): T & { displayName: string; avatar: unknown; avatarUrl: unknown } {
  const displayName = orgPersonDisplayName(row);
  const avatar = row.avatar ?? row.avatarUrl ?? row.avatar_url ?? null;
  if (canReadOrgPersonPrivateFields(viewerRole)) {
    return { ...row, displayName, avatar, avatarUrl: row.avatarUrl ?? row.avatar_url ?? avatar } as T & {
      displayName: string;
      avatar: unknown;
      avatarUrl: unknown;
    };
  }
  const id = row.id ?? row.userId ?? row.user_id;
  return {
    id,
    userId: row.userId ?? row.user_id ?? id,
    displayName,
    name: displayName,
    avatar,
    avatarUrl: row.avatarUrl ?? row.avatar_url ?? avatar,
  } as unknown as T & { displayName: string; avatar: unknown; avatarUrl: unknown };
}

export function shapeOrgNestedUser<T extends Record<string, unknown>>(
  row: T,
  viewerRole: unknown
): Record<string, unknown> {
  const shaped = shapeOrgPersonPayload(row, viewerRole);
  if (canReadOrgPersonPrivateFields(viewerRole)) return shaped;
  return {
    id: shaped.id,
    displayName: shaped.displayName,
    name: shaped.displayName,
    avatar: shaped.avatar,
    avatarUrl: shaped.avatarUrl,
  };
}
