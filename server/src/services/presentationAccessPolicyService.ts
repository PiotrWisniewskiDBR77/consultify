export type PresentationCapability =
  | 'presentation_create'
  | 'presentation_view'
  | 'presentation_edit'
  | 'presentation_approve'
  | 'presentation_export'
  | 'presentation_share'
  | 'template_approve'
  | 'brand_change';

type NormalizedRole = 'SUPERADMIN' | 'OWNER' | 'ADMIN' | 'PROJECT_MANAGER' | 'USER' | 'VIEWER';

function normalizeRole(role: string | null | undefined): NormalizedRole {
  const raw = String(role || '')
    .trim()
    .toUpperCase();
  if (raw.includes('SUPER')) return 'SUPERADMIN';
  if (raw === 'OWNER') return 'OWNER';
  if (raw === 'ADMIN' || raw === 'ADMINISTRATOR') return 'ADMIN';
  if (raw === 'PROJECT_MANAGER' || raw === 'MANAGER') return 'PROJECT_MANAGER';
  if (raw === 'USER' || raw === 'TEAM_MEMBER' || raw === 'MEMBER') return 'USER';
  return 'VIEWER';
}

const CAPABILITY_MATRIX: Record<NormalizedRole, ReadonlySet<PresentationCapability>> = {
  SUPERADMIN: new Set<PresentationCapability>([
    'presentation_create',
    'presentation_view',
    'presentation_edit',
    'presentation_approve',
    'presentation_export',
    'presentation_share',
    'template_approve',
    'brand_change',
  ]),
  OWNER: new Set<PresentationCapability>([
    'presentation_create',
    'presentation_view',
    'presentation_edit',
    'presentation_approve',
    'presentation_export',
    'presentation_share',
    'template_approve',
    'brand_change',
  ]),
  ADMIN: new Set<PresentationCapability>([
    'presentation_create',
    'presentation_view',
    'presentation_edit',
    'presentation_approve',
    'presentation_export',
    'presentation_share',
    'template_approve',
    'brand_change',
  ]),
  PROJECT_MANAGER: new Set<PresentationCapability>([
    'presentation_create',
    'presentation_view',
    'presentation_edit',
    'presentation_export',
    'presentation_share',
  ]),
  USER: new Set<PresentationCapability>([
    'presentation_create',
    'presentation_view',
    'presentation_edit',
    'presentation_export',
    'presentation_share',
  ]),
  VIEWER: new Set<PresentationCapability>(['presentation_view', 'presentation_export']),
};

export function hasPresentationCapability(
  role: string | null | undefined,
  capability: PresentationCapability
): boolean {
  const normalized = normalizeRole(role);
  return CAPABILITY_MATRIX[normalized].has(capability);
}
