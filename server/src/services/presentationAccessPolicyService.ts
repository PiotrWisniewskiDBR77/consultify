export type PresentationCapability =
  | 'presentation_create'
  | 'presentation_view'
  | 'presentation_edit'
  | 'presentation_approve'
  | 'presentation_export'
  | 'presentation_share'
  | 'template_approve'
  | 'brand_change'
  /**
   * Sprint S17 — gates the SuperAdmin presentation-studio layout-capacity
   * admin surface. The registry behind it is currently PROCESS-GLOBAL
   * (R-S13-1 tenant scoping is still open), so a single override
   * payload affects every tenant served by this Node process. We
   * therefore intentionally restrict this capability to SUPERADMIN
   * only — neither tenant Owner nor tenant Admin gets it. When R-S13-1
   * lands and the registry becomes tenant-scoped, we will introduce a
   * separate `presentation_admin_layout_capacity_tenant` capability
   * that tenant Owner / Admin can hold for their own tenant.
   */
  | 'presentation_admin_layout_capacity';

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
    'presentation_admin_layout_capacity',
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
