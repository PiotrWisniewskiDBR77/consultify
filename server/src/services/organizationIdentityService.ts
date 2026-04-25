import * as DbPromise from '../utils/DbPromise.js';

const IGNORED_ORGANIZATION_TOKENS = new Set([
  'a',
  'and',
  'co',
  'company',
  'corp',
  'corporation',
  'gmbh',
  'group',
  'holding',
  'holdings',
  'inc',
  'incorporated',
  'limited',
  'llc',
  'ltd',
  'oo',
  'o',
  'plc',
  'sa',
  's',
  'sp',
  'z',
]);

const GENERIC_ORGANIZATION_NAMES = new Set(['my company', 'new organization']);

export interface OrganizationIdentityMatch {
  id: string;
  name: string | null;
  status?: string | null;
  is_active?: number | boolean | null;
}

export class DuplicateOrganizationNameError extends Error {
  code = 'ORGANIZATION_ALREADY_EXISTS' as const;
  existingOrganization: OrganizationIdentityMatch;
  requestedName: string;

  constructor(requestedName: string, existingOrganization: OrganizationIdentityMatch) {
    super(`Organization "${requestedName}" already exists as "${existingOrganization.name || ''}"`);
    this.name = 'DuplicateOrganizationNameError';
    this.requestedName = requestedName;
    this.existingOrganization = existingOrganization;
  }
}

function normalizeOrganizationName(rawName: string): string {
  return String(rawName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildOrganizationCanonicalKey(rawName: string): string {
  const normalized = normalizeOrganizationName(rawName);
  if (!normalized) return '';

  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !IGNORED_ORGANIZATION_TOKENS.has(token));

  return tokens.join('');
}

export function isGenericOrganizationName(rawName: string | null | undefined): boolean {
  const normalized = normalizeOrganizationName(String(rawName || ''));
  return !normalized || GENERIC_ORGANIZATION_NAMES.has(normalized);
}

export async function findOrganizationByCanonicalName(
  rawName: string,
  options: { excludeOrganizationId?: string } = {}
): Promise<OrganizationIdentityMatch | null> {
  const canonicalKey = buildOrganizationCanonicalKey(rawName);
  if (!canonicalKey || isGenericOrganizationName(rawName)) {
    return null;
  }

  const rows = await DbPromise.all<OrganizationIdentityMatch>(
    `SELECT id, name, status, is_active
       FROM organizations
      WHERE name IS NOT NULL`,
    []
  );

  return (
    rows.find((row) => {
      if (!row?.id || row.id === options.excludeOrganizationId) return false;

      const status = String(row.status || '').toLowerCase();
      const isActive =
        row.is_active === undefined || row.is_active === null || Number(row.is_active) !== 0;
      if (!isActive || status === 'deleted' || status === 'merged') return false;

      return buildOrganizationCanonicalKey(String(row.name || '')) === canonicalKey;
    }) || null
  );
}

export async function assertOrganizationNameAvailable(
  rawName: string,
  options: { excludeOrganizationId?: string } = {}
): Promise<void> {
  const existingOrganization = await findOrganizationByCanonicalName(rawName, options);
  if (existingOrganization) {
    throw new DuplicateOrganizationNameError(rawName, existingOrganization);
  }
}
