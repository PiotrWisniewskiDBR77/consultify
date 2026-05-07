export type PresentationConfidentiality = 'public' | 'internal' | 'confidential';
export type PresentationAction = 'export' | 'share';

export function normalizePresentationRole(role: string | null | undefined): string {
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

export function resolvePresentationDeckConfidentiality(deck: any): PresentationConfidentiality {
  const direct = String(deck?.confidentiality || '').toLowerCase();
  if (direct === 'public' || direct === 'internal' || direct === 'confidential') return direct;
  try {
    const parsed = deck?.deck_json ? JSON.parse(deck.deck_json) : null;
    const meta = String(parsed?.meta?.confidentiality || '').toLowerCase();
    if (meta === 'public' || meta === 'internal' || meta === 'confidential') return meta;
  } catch {
    // ignore parse errors
  }
  return 'internal';
}

export function isPresentationActionAllowedByConfidentiality(params: {
  action: PresentationAction;
  role: string | null | undefined;
  confidentiality: PresentationConfidentiality;
}): boolean {
  const role = normalizePresentationRole(params.role);
  if (params.confidentiality === 'confidential') {
    return ['SUPERADMIN', 'OWNER', 'ADMIN', 'PROJECT_MANAGER'].includes(role);
  }
  if (
    params.action === 'share' &&
    params.confidentiality !== 'public' &&
    role === 'PROJECT_MANAGER'
  ) {
    return false;
  }
  return true;
}
