import { TERESA_NAVIGATION_MANIFEST } from '../../sharedRuntime/routes/teresaNavigationManifest.js';

export type TeresaNavigationUnavailableReason =
  | 'role_required'
  | 'organization_flag_off'
  | 'organization_flag_unverified'
  | 'runtime_flag_off';

export interface TeresaNavigationGroundingInput {
  organizationId: string;
  userRole?: string | null;
  language?: string | null;
  runtimeFlags?: Readonly<Record<string, boolean>>;
  queryFn?: (sql: string, params: unknown[]) => Promise<unknown[]>;
}

export interface TeresaNavigationItem {
  id: string;
  label: string;
  route: string;
  clickPath: readonly string[];
  availability: 'available' | 'coming_soon';
}

export interface TeresaNavigationExcludedItem {
  id: string;
  reason: TeresaNavigationUnavailableReason;
}

export interface TeresaNavigationGrounding {
  items: TeresaNavigationItem[];
  excluded: TeresaNavigationExcludedItem[];
  systemInstructionAddon: string;
}

const normalizeRole = (role?: string | null): string => {
  const normalized = String(role || '').trim().toUpperCase().replaceAll('-', '_');
  return normalized === 'SUPER_ADMIN' ? 'SUPERADMIN' : normalized;
};

const isEnabled = (value: unknown): boolean =>
  value === true || value === 1 || String(value || '').toLowerCase() === 'true' || value === 't';

export async function buildTeresaNavigationGrounding(
  input: TeresaNavigationGroundingInput
): Promise<TeresaNavigationGrounding | null> {
  if (!input.organizationId) return null;

  const role = normalizeRole(input.userRole);
  const language = String(input.language || '').toLowerCase().startsWith('pl') ? 'pl' : 'en';
  const organizationFlags = new Map<string, boolean>();
  let organizationFlagsVerified = false;

  if (input.queryFn) {
    try {
      const rows = await input.queryFn(
        `SELECT flag_key, enabled
           FROM feature_flags
          WHERE organization_id = ? AND environment = 'production'`,
        [input.organizationId]
      );
      organizationFlagsVerified = true;
      for (const row of Array.isArray(rows) ? rows : []) {
        if (!row || typeof row !== 'object') continue;
        const candidate = row as Record<string, unknown>;
        if (typeof candidate.flag_key === 'string') {
          organizationFlags.set(candidate.flag_key, isEnabled(candidate.enabled));
        }
      }
    } catch {
      // Chat remains available, but organization-gated navigation fails closed:
      // an entitlement that cannot be verified must never be described to the user.
    }
  }

  const items: TeresaNavigationItem[] = [];
  const excluded: TeresaNavigationExcludedItem[] = [];
  for (const entry of TERESA_NAVIGATION_MANIFEST) {
    if (entry.roles && !entry.roles.includes(role)) {
      excluded.push({ id: entry.id, reason: 'role_required' });
      continue;
    }
    if (entry.runtimeFlagKey && input.runtimeFlags?.[entry.runtimeFlagKey] !== true) {
      excluded.push({ id: entry.id, reason: 'runtime_flag_off' });
      continue;
    }
    if (entry.organizationFlagKey && !organizationFlagsVerified) {
      excluded.push({ id: entry.id, reason: 'organization_flag_unverified' });
      continue;
    }
    if (entry.organizationFlagKey && organizationFlags.get(entry.organizationFlagKey) === false) {
      excluded.push({ id: entry.id, reason: 'organization_flag_off' });
      continue;
    }
    items.push({
      id: entry.id,
      label: language === 'pl' ? entry.labelPl : entry.labelEn,
      route: entry.route,
      clickPath: language === 'pl' ? entry.clickPathPl : entry.clickPathEn,
      availability: entry.availability || 'available',
    });
  }

  const heading = language === 'pl' ? 'NAWIGACJA DOSTĘPNA UŻYTKOWNIKOWI' : 'NAVIGATION AVAILABLE TO THE USER';
  const rules = language === 'pl'
    ? [
        'Wymieniaj wyłącznie poniższe pozycje. Ukrytych modułów nie nazywaj ani nie sugeruj.',
        'Podawaj ścieżkę kliknięć. Nie twierdź, że otwierasz ekran za użytkownika.',
      ]
    : [
        'Mention only the entries below. Do not name or suggest hidden modules.',
        'Give the click path. Do not claim that you open the screen for the user.',
      ];
  const unavailable = language === 'pl' ? 'planowane, jeszcze niedostępne' : 'planned, not available yet';
  const lines = items.map((item) =>
    `- ${item.label}: ${item.clickPath.join(' → ')} (${item.route})${item.availability === 'coming_soon' ? ` — ${unavailable}` : ''}`
  );

  return {
    items,
    excluded,
    systemInstructionAddon: [`## ${heading}`, ...rules, '', ...lines].join('\n'),
  };
}

export default { buildTeresaNavigationGrounding };
