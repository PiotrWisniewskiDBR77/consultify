/**
 * Settings Registry Service — P31 §2.3.2-§2.3.6
 *
 * Canonical registry for Settings taxonomy, inheritance resolution,
 * write routing, and denial guidance.
 */

import { get as dbGet } from '../utils/DbPromise.js';
import organizationContextService from './organizationContext/OrganizationContextService.js';

export type SettingsScope = 'personal' | 'module' | 'tenant';
type SettingsOwner = 'P30' | 'P31' | 'P32' | 'P33';
type ManagedSurface = 'settings' | 'organization' | 'admin' | 'superadmin';
type ResolvedSource = 'personal' | 'module' | 'tenant' | 'system' | 'default';

export interface SettingsKeyMetadata {
  key: string;
  scope: SettingsScope;
  ownerContract: SettingsOwner;
  managedIn: ManagedSurface;
  routeTo?: string;
  impactLanguage: string;
  impactedSurface: string;
  requiresRestart: boolean;
  confirmationGate: boolean;
  readRoles: string[];
  writeRoles: string[];
  aliases?: string[];
  tenantEnforced?: boolean;
  readOnlyInSettings?: boolean;
  moduleId?: 'interview' | 'tools' | 'outputs' | 'assessment' | 'copilot';
  endpoint?: string;
  storage?: string;
  observableEffect?: string;
  secretRule?: 'NOT_SECRET' | 'WRITE_ONLY_NEVER_RETURN';
}

function operationalMetadata(meta: SettingsKeyMetadata): SettingsKeyMetadata {
  const endpoint = meta.endpoint ?? `/api/settings/registry/${meta.key}`;
  const storage = meta.storage ?? (meta.scope === 'personal'
    ? `user_preferences(settings:${meta.key})`
    : meta.scope === 'module'
      ? `settings(module:{orgId}:${meta.moduleId ?? 'module'}:${meta.key})`
      : `settings(tenant:{orgId}:${meta.key})`);
  return {
    ...meta,
    endpoint,
    storage,
    observableEffect: meta.observableEffect ?? meta.impactedSurface,
    secretRule: meta.secretRule ?? 'NOT_SECRET',
  };
}

const SETTINGS_REGISTRY: SettingsKeyMetadata[] = [
  {
    key: 'theme',
    scope: 'personal',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Changes the visual appearance of all app surfaces for you.',
    impactedSurface: 'All UI surfaces',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['*'],
  },
  {
    key: 'language',
    scope: 'personal',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Changes the UI language; content language is separate.',
    impactedSurface: 'All UI surfaces',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['*'],
  },
  {
    key: 'timezone',
    scope: 'personal',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Changes how dates and times are displayed for you.',
    impactedSurface: 'All date/time displays',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['*'],
  },
  {
    key: 'email_digest',
    scope: 'personal',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Controls how often you receive email summaries.',
    impactedSurface: 'Email delivery',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['*'],
    aliases: ['notifications_email'],
  },
  {
    key: 'ai_suggestions_enabled',
    scope: 'personal',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Enables or disables AI-powered suggestions in your workflow.',
    impactedSurface: 'Copilot, inline suggestions',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['*'],
    aliases: ['copilot_suggestions_enabled'],
  },
  {
    key: 'working_hours',
    scope: 'personal',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Sets your availability schedule for notifications and planning.',
    impactedSurface: 'Calendar, quiet hours',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['*'],
  },

  {
    key: 'default_language',
    scope: 'tenant',
    ownerContract: 'P30',
    managedIn: 'organization',
    routeTo: '/organization/profile',
    impactLanguage:
      'Sets the default UI language for new members; existing members keep their personal choice.',
    impactedSurface: 'New member onboarding',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
    readOnlyInSettings: true,
  },
  {
    key: 'default_timezone',
    scope: 'tenant',
    ownerContract: 'P30',
    managedIn: 'organization',
    routeTo: '/organization/profile',
    impactLanguage: 'Sets the default timezone for new members and shared views.',
    impactedSurface: 'Shared calendars, reports',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
    readOnlyInSettings: true,
  },
  {
    key: 'default_currency',
    scope: 'tenant',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Changes the currency symbol in all financial displays for the organization.',
    impactedSurface: 'Finance, KPI, Reports',
    requiresRestart: false,
    confirmationGate: true,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
  },
  {
    key: 'default_sharing_mode',
    scope: 'tenant',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Changes the default visibility of new items created by all members.',
    impactedSurface: 'All new artifacts',
    requiresRestart: false,
    confirmationGate: true,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
  },
  {
    key: 'mfa_required',
    scope: 'tenant',
    ownerContract: 'P32',
    managedIn: 'admin',
    routeTo: '/admin/security',
    impactLanguage: 'Enforces multi-factor authentication for all members on next login.',
    impactedSurface: 'Authentication flow',
    requiresRestart: false,
    confirmationGate: true,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
    readOnlyInSettings: true,
    aliases: ['mfa_enforcement'],
  },
  {
    key: 'sso_enforced',
    scope: 'tenant',
    ownerContract: 'P32',
    managedIn: 'admin',
    routeTo: '/admin/security',
    impactLanguage: 'Requires SSO login and disables password login when enforced.',
    impactedSurface: 'Authentication flow',
    requiresRestart: false,
    confirmationGate: true,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
    readOnlyInSettings: true,
    aliases: ['sso_configuration'],
  },
  {
    key: 'guest_access_enabled',
    scope: 'tenant',
    ownerContract: 'P32',
    managedIn: 'admin',
    routeTo: '/admin/security?tab=collaboration',
    impactLanguage: 'Enables or disables guest access to the workspace.',
    impactedSurface: 'Access control',
    requiresRestart: false,
    confirmationGate: true,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
    readOnlyInSettings: true,
    tenantEnforced: true,
  },
  {
    key: 'external_link_sharing',
    scope: 'tenant',
    ownerContract: 'P32',
    managedIn: 'admin',
    routeTo: '/admin/security?tab=collaboration',
    impactLanguage: 'Controls external link sharing permissions across the workspace.',
    impactedSurface: 'Sharing, links',
    requiresRestart: false,
    confirmationGate: true,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
    readOnlyInSettings: true,
    tenantEnforced: true,
  },

  {
    key: 'default_tool_visibility',
    scope: 'module',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Controls which tools are visible to users by default.',
    impactedSurface: 'Tools module',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['*'],
    moduleId: 'tools',
  },
  {
    key: 'tool_approval_required',
    scope: 'module',
    ownerContract: 'P32',
    managedIn: 'admin',
    routeTo: '/admin/security?tab=collaboration',
    impactLanguage: 'Requires admin approval before a tool can be used.',
    impactedSurface: 'Tools module',
    requiresRestart: false,
    confirmationGate: true,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
    readOnlyInSettings: true,
    tenantEnforced: true,
    moduleId: 'tools',
  },
  {
    key: 'recording_auto_start',
    scope: 'module',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Automatically starts recording when an interview session begins.',
    impactedSurface: 'Interview sessions',
    requiresRestart: false,
    confirmationGate: true,
    readRoles: ['*'],
    writeRoles: ['*'],
    moduleId: 'interview',
    aliases: ['interview_recording_auto_start'],
  },
  {
    key: 'ai_transcription_enabled',
    scope: 'module',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Enables AI-powered transcription of interview recordings.',
    impactedSurface: 'Interview sessions',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['*'],
    moduleId: 'interview',
  },
  {
    key: 'default_export_format',
    scope: 'module',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Sets the default file format when exporting artifacts.',
    impactedSurface: 'Export dialogs',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['*'],
    moduleId: 'outputs',
    aliases: ['tools_default_export_format'],
  },
  {
    key: 'scoring_scale',
    scope: 'module',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Changes the scoring scale for all new assessments.',
    impactedSurface: 'Assessment creation',
    requiresRestart: false,
    confirmationGate: true,
    readRoles: ['*'],
    writeRoles: ['*'],
    moduleId: 'assessment',
    aliases: ['interview_default_scoring_scale'],
  },
  {
    key: 'model_preference',
    scope: 'module',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Switches the AI model used for suggestions and generation.',
    impactedSurface: 'All AI-powered features',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['*'],
    moduleId: 'copilot',
  },
  {
    key: 'citation_style',
    scope: 'module',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Changes how AI-generated content references sources.',
    impactedSurface: 'AI outputs',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['*'],
    moduleId: 'copilot',
  },
];

const SUPPLEMENTAL_METADATA: SettingsKeyMetadata[] = [
  {
    key: 'default_date_format',
    scope: 'tenant',
    ownerContract: 'P31',
    managedIn: 'settings',
    impactLanguage: 'Changes the default date format across shared organization views.',
    impactedSurface: 'Dates in shared views',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
  },
  {
    key: 'session_timeout_minutes',
    scope: 'tenant',
    ownerContract: 'P32',
    managedIn: 'admin',
    routeTo: '/admin/security',
    impactLanguage: 'Sets the session timeout for all members.',
    impactedSurface: 'Session management',
    requiresRestart: false,
    confirmationGate: true,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
    readOnlyInSettings: true,
    aliases: ['session_timeout'],
  },
  {
    key: 'password_policy',
    scope: 'tenant',
    ownerContract: 'P32',
    managedIn: 'admin',
    routeTo: '/admin/security',
    impactLanguage: 'Changes password requirements for the organization.',
    impactedSurface: 'Authentication flow',
    requiresRestart: false,
    confirmationGate: true,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
    readOnlyInSettings: true,
  },
  {
    key: 'brand_color',
    scope: 'tenant',
    ownerContract: 'P30',
    managedIn: 'organization',
    routeTo: '/organization/branding',
    impactLanguage: 'Changes the default brand color inherited by organization surfaces.',
    impactedSurface: 'Branding, shared UI',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
    readOnlyInSettings: true,
  },
  {
    key: 'accent_color',
    scope: 'tenant',
    ownerContract: 'P30',
    managedIn: 'organization',
    routeTo: '/organization/branding',
    impactLanguage: 'Changes the accent color inherited by organization surfaces.',
    impactedSurface: 'Branding, shared UI',
    requiresRestart: false,
    confirmationGate: false,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
    readOnlyInSettings: true,
  },
  {
    key: 'custom_domain',
    scope: 'tenant',
    ownerContract: 'P30',
    managedIn: 'organization',
    routeTo: '/organization/domains',
    impactLanguage: 'Changes the organization custom domain used for workspace access.',
    impactedSurface: 'Workspace access',
    requiresRestart: false,
    confirmationGate: true,
    readRoles: ['*'],
    writeRoles: ['admin', 'owner'],
    readOnlyInSettings: true,
  },
];

const REGISTRY_INDEX = new Map<string, SettingsKeyMetadata>();
for (const meta of [...SETTINGS_REGISTRY, ...SUPPLEMENTAL_METADATA]) {
  REGISTRY_INDEX.set(meta.key, meta);
  for (const alias of meta.aliases || []) {
    REGISTRY_INDEX.set(alias, meta);
  }
}

const USER_PREFERENCE_KEYS = new Set([
  'theme',
  'language',
  'timezone',
  'email_digest',
  'ai_suggestions_enabled',
  'working_hours',
]);

function normalizeRole(role?: string): 'admin' | 'owner' | 'member' | 'guest' {
  const normalized = String(role || '')
    .trim()
    .toLowerCase();
  switch (normalized) {
    case 'owner':
    case 'superadmin':
    case 'super_admin':
      return 'owner';
    case 'admin':
    case 'administrator':
      return 'admin';
    case 'guest':
    case 'viewer':
    case 'client':
      return 'guest';
    default:
      return 'member';
  }
}

function canWrite(meta: SettingsKeyMetadata, role: string): boolean {
  const normalized = normalizeRole(role);
  return meta.writeRoles.includes('*') || meta.writeRoles.includes(normalized);
}

function parseValue(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function readOrganizationSecuritySettings(orgId: string): Promise<Record<string, unknown>> {
  const row = await dbGet<{ setting_value?: string }>(
    `SELECT setting_value FROM organization_settings WHERE organization_id = ? AND setting_key = 'security'`,
    [orgId],
    { fallback: true }
  );
  return (parseValue(row?.setting_value) as Record<string, unknown>) || {};
}

function isMeaningfulValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function getManagedSurfaceLabel(managedIn: ManagedSurface): string {
  switch (managedIn) {
    case 'organization':
      return 'Organization';
    case 'admin':
      return 'Admin';
    case 'superadmin':
      return 'Superadmin';
    default:
      return 'Settings';
  }
}

async function readPersonalValue(
  userId: string,
  key: string,
  aliases: string[] = []
): Promise<unknown> {
  const rowsToCheck = [`settings:${key}`, ...aliases.map((alias) => `settings:${alias}`)];
  if (USER_PREFERENCE_KEYS.has(key)) rowsToCheck.push(key);
  for (const alias of aliases) {
    if (USER_PREFERENCE_KEYS.has(alias)) rowsToCheck.push(alias);
  }

  for (const preferenceKey of rowsToCheck) {
    const personal = await dbGet<{ value?: string }>(
      'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?',
      [userId, preferenceKey],
      { fallback: true }
    );
    if (isMeaningfulValue(personal?.value)) {
      return parseValue(personal?.value);
    }
  }

  return null;
}

async function readSettingsValue(storeKeys: string[]): Promise<unknown> {
  for (const storeKey of storeKeys) {
    const result = await dbGet<{ value?: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [storeKey],
      { fallback: true }
    );
    if (isMeaningfulValue(result?.value)) {
      return parseValue(result?.value);
    }
  }
  return null;
}

class SettingsRegistryServiceClass {
  normalizeRole(role?: string): 'admin' | 'owner' | 'member' | 'guest' {
    return normalizeRole(role);
  }

  getRegistry(): SettingsKeyMetadata[] {
    return SETTINGS_REGISTRY.map(operationalMetadata);
  }

  getKeyMetadata(key: string): SettingsKeyMetadata | undefined {
    const meta = REGISTRY_INDEX.get(key);
    return meta ? operationalMetadata(meta) : undefined;
  }

  getKeysByScope(scope: SettingsScope): SettingsKeyMetadata[] {
    return SETTINGS_REGISTRY.filter((entry) => entry.scope === scope).map(operationalMetadata);
  }

  getKeysByOwner(owner: string): SettingsKeyMetadata[] {
    return SETTINGS_REGISTRY.filter((entry) => entry.ownerContract === owner).map(operationalMetadata);
  }

  getWriteTarget(
    key: string,
    userRole: string,
    targetScope?: string
  ): 'personal' | 'tenant' | 'module' | 'blocked' {
    const meta = this.getKeyMetadata(key);
    if (!meta) return 'blocked';
    if (meta.readOnlyInSettings || meta.managedIn !== 'settings') return 'blocked';
    if (meta.scope === 'personal') return 'personal';
    if (meta.scope === 'tenant') return canWrite(meta, userRole) ? 'tenant' : 'blocked';
    if (
      targetScope === 'module' &&
      canWrite({ ...meta, writeRoles: ['admin', 'owner'] }, userRole)
    ) {
      return 'module';
    }
    return 'personal';
  }

  checkWriteRouting(
    key: string,
    userRole: string
  ): { allowed: boolean; routeTo?: string; guidance?: string } {
    const meta = this.getKeyMetadata(key);
    if (!meta) {
      return {
        allowed: false,
        routeTo: '/settings',
        guidance: `This setting key is unknown. Refresh Settings before trying to modify "${key}".`,
      };
    }

    if (meta.readOnlyInSettings || meta.managedIn !== 'settings') {
      const managedSurface = getManagedSurfaceLabel(meta.managedIn);
      return {
        allowed: false,
        routeTo: meta.routeTo || managedSurface,
        guidance: `This setting is managed in ${managedSurface}. Open ${meta.routeTo || managedSurface} to modify "${meta.key}".`,
      };
    }

    if (!canWrite(meta, userRole)) {
      return {
        allowed: false,
        guidance: `Only ${meta.writeRoles.join('/')} roles can modify "${meta.key}".`,
      };
    }

    return { allowed: true };
  }

  async resolveEffectiveValue(
    key: string,
    userId: string,
    orgId?: string
  ): Promise<{
    value: any;
    source: ResolvedSource;
    metadata?: SettingsKeyMetadata;
    overriddenBy?: string;
    degraded?: boolean;
  }> {
    const meta = this.getKeyMetadata(key);
    if (!meta) {
      return { value: null, source: 'default' };
    }

    let personalIgnored = false;
    if (!meta.tenantEnforced) {
      const personal = await readPersonalValue(userId, meta.key, meta.aliases);
      if (isMeaningfulValue(personal)) {
        return { value: personal, source: 'personal', metadata: meta };
      }
    } else {
      personalIgnored = true;
    }

    if (
      orgId &&
      ['default_language', 'default_timezone', 'mfa_required', 'sso_enforced'].includes(meta.key)
    ) {
      const context = await organizationContextService.buildResolvedContext(orgId);
      const tenantValueMap: Record<string, unknown> = {
        default_language: context.profile.defaultLanguage,
        default_timezone: context.profile.defaultTimezone,
        mfa_required: context.trust.mfa.required,
        sso_enforced: context.trust.sso.enforced,
      };
      const resolvedTenantValue = tenantValueMap[meta.key];
      if (isMeaningfulValue(resolvedTenantValue)) {
        return {
          value: resolvedTenantValue,
          source: 'tenant',
          metadata: meta,
          overriddenBy: personalIgnored ? 'tenant' : undefined,
        };
      }
    }

    if (orgId && meta.key === 'session_timeout_minutes') {
      const securitySettings = await readOrganizationSecuritySettings(orgId);
      if (isMeaningfulValue(securitySettings.sessionTimeout)) {
        return {
          value: securitySettings.sessionTimeout,
          source: 'tenant',
          metadata: meta,
        };
      }
    }

    if (orgId && meta.key === 'password_policy') {
      const securitySettings = await readOrganizationSecuritySettings(orgId);
      if (isMeaningfulValue(securitySettings.passwordPolicy)) {
        return {
          value: securitySettings.passwordPolicy,
          source: 'tenant',
          metadata: meta,
        };
      }
    }

    if (orgId && meta.scope === 'module') {
      const moduleValue = await readSettingsValue([
        `module:${orgId}:${meta.moduleId}:${meta.key}`,
        `module:${orgId}:${meta.key}`,
        ...(meta.aliases || []).flatMap((alias) => [
          `module:${orgId}:${meta.moduleId}:${alias}`,
          `module:${orgId}:${alias}`,
        ]),
      ]);
      if (isMeaningfulValue(moduleValue)) {
        return {
          value: moduleValue,
          source: 'module',
          metadata: meta,
          overriddenBy: personalIgnored ? 'module' : undefined,
        };
      }
    }

    if (orgId && meta.scope !== 'personal') {
      const tenantValue = await readSettingsValue([
        `tenant:${orgId}:${meta.key}`,
        ...(meta.aliases || []).map((alias) => `tenant:${orgId}:${alias}`),
      ]);
      if (isMeaningfulValue(tenantValue)) {
        return {
          value: tenantValue,
          source: 'tenant',
          metadata: meta,
          overriddenBy: personalIgnored ? 'tenant' : undefined,
        };
      }
    }

    const systemValue = await readSettingsValue([meta.key, ...(meta.aliases || [])]);
    if (isMeaningfulValue(systemValue)) {
      return { value: systemValue, source: 'system', metadata: meta };
    }

    return {
      value: null,
      source: 'default',
      metadata: meta,
      overriddenBy: personalIgnored ? 'tenant' : undefined,
    };
  }

  buildDenialResponse(
    key: string,
    reason: 'permission_denied' | 'read_only' | 'not_found' | 'resolver_unavailable'
  ) {
    const meta = this.getKeyMetadata(key);
    const managedSurface = getManagedSurfaceLabel(meta?.managedIn || 'settings');
    const routeTo = meta?.routeTo;

    switch (reason) {
      case 'permission_denied':
        return {
          status: 403,
          code: 'SETTINGS_PERMISSION_DENIED',
          message:
            meta?.managedIn && meta.managedIn !== 'settings'
              ? `This setting is managed in ${managedSurface}. Navigate there to modify "${meta.key}".`
              : `You do not have permission to modify "${meta?.key || key}".`,
          guidance:
            meta?.managedIn && meta.managedIn !== 'settings'
              ? `Managed in ${managedSurface}.`
              : 'Your role does not allow this update.',
          routeTo,
        };
      case 'read_only':
        return {
          status: 403,
          code: 'SETTINGS_READ_ONLY',
          message: `Setting "${meta?.key || key}" is read-only in Settings. Managed in ${managedSurface}.`,
          guidance: `Managed in ${managedSurface}.`,
          routeTo,
        };
      case 'not_found':
        return {
          status: 404,
          code: 'SETTINGS_KEY_NOT_FOUND',
          message: `Setting "${key}" is no longer available.`,
          guidance: 'Open Settings root to refresh the available configuration.',
          routeTo: '/settings',
        };
      case 'resolver_unavailable':
        return {
          status: 503,
          code: 'SETTINGS_RESOLVER_UNAVAILABLE',
          message: 'Settings resolver is temporarily unavailable. Please try again.',
          guidance: 'Retry, or refresh the Organization/Admin source if the issue persists.',
        };
    }
  }
}

const settingsRegistryService = new SettingsRegistryServiceClass();
export default settingsRegistryService;
export { SETTINGS_REGISTRY, SettingsRegistryServiceClass, SUPPLEMENTAL_METADATA };
