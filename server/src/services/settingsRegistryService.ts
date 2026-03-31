/**
 * Settings Registry Service — P31 §2.3.2-§2.3.6
 *
 * Provides structured settings with scope model, impact metadata,
 * ownership enforcement, and admin routing.
 */

import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// P31 §2.3.2 — Scope model
export type SettingsScope = 'personal' | 'module' | 'tenant';

// P31 §2.3.2 — Impact metadata
export interface SettingsKeyMetadata {
  key: string;
  scope: SettingsScope;
  ownerContract: 'P30' | 'P31' | 'P32' | 'P33';
  impactLanguage: string;
  impactedSurface: string;
  requiresRestart: boolean;
  confirmationGate: boolean;
  readRoles: string[];
  writeRoles: string[];
}

// P31 §2.3.6 — Impact metadata registry (contract table)
const SETTINGS_REGISTRY: SettingsKeyMetadata[] = [
  // Personal scope
  { key: 'theme', scope: 'personal', ownerContract: 'P31', impactLanguage: 'Changes your visual theme across all modules', impactedSurface: 'All UI', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },
  { key: 'language', scope: 'personal', ownerContract: 'P31', impactLanguage: 'Changes your interface language', impactedSurface: 'All UI labels', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },
  { key: 'notifications_email', scope: 'personal', ownerContract: 'P31', impactLanguage: 'Controls email notification delivery', impactedSurface: 'Email notifications', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },
  { key: 'notifications_push', scope: 'personal', ownerContract: 'P31', impactLanguage: 'Controls push notification delivery', impactedSurface: 'Push notifications', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },
  { key: 'ai_instructions', scope: 'personal', ownerContract: 'P31', impactLanguage: 'Customizes AI behavior for your account', impactedSurface: 'AI responses', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },
  { key: 'ai_model_preference', scope: 'personal', ownerContract: 'P31', impactLanguage: 'Sets your preferred AI model', impactedSurface: 'AI model selection', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },
  { key: 'working_hours', scope: 'personal', ownerContract: 'P31', impactLanguage: 'Sets your availability schedule', impactedSurface: 'Calendar, DND', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },
  { key: 'keyboard_shortcuts', scope: 'personal', ownerContract: 'P31', impactLanguage: 'Customizes keyboard shortcuts', impactedSurface: 'All UI interactions', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },

  // Module scope
  { key: 'interview_recording_auto_start', scope: 'module', ownerContract: 'P31', impactLanguage: 'Auto-starts recording when interview begins', impactedSurface: 'Interview module', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },
  { key: 'interview_default_scoring_scale', scope: 'module', ownerContract: 'P31', impactLanguage: 'Sets default scoring scale for assessments', impactedSurface: 'Interview scoring', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },
  { key: 'tools_default_export_format', scope: 'module', ownerContract: 'P31', impactLanguage: 'Sets default export format for tools output', impactedSurface: 'Tools export', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },
  { key: 'outputs_default_template', scope: 'module', ownerContract: 'P31', impactLanguage: 'Sets default template for new outputs', impactedSurface: 'Outputs creation', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },
  { key: 'assessment_auto_save', scope: 'module', ownerContract: 'P31', impactLanguage: 'Enables auto-save during assessments', impactedSurface: 'Assessment module', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },
  { key: 'copilot_suggestions_enabled', scope: 'module', ownerContract: 'P31', impactLanguage: 'Enables AI copilot suggestions in workspace', impactedSurface: 'AI Copilot', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['*'] },

  // Tenant scope (admin-only write, routes to P32)
  { key: 'default_currency', scope: 'tenant', ownerContract: 'P32', impactLanguage: 'Changes default currency for all financial modules', impactedSurface: 'Finance, KPI, Reports', requiresRestart: false, confirmationGate: true, readRoles: ['*'], writeRoles: ['admin', 'owner'] },
  { key: 'default_date_format', scope: 'tenant', ownerContract: 'P32', impactLanguage: 'Changes date format across the organization', impactedSurface: 'All date displays', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['admin', 'owner'] },
  { key: 'mfa_enforcement', scope: 'tenant', ownerContract: 'P32', impactLanguage: 'Enforces MFA for all organization members', impactedSurface: 'Authentication', requiresRestart: false, confirmationGate: true, readRoles: ['*'], writeRoles: ['admin', 'owner'] },
  { key: 'sso_configuration', scope: 'tenant', ownerContract: 'P32', impactLanguage: 'Configures SSO/IdP for the organization', impactedSurface: 'Authentication', requiresRestart: false, confirmationGate: true, readRoles: ['*'], writeRoles: ['admin', 'owner'] },
  { key: 'session_timeout', scope: 'tenant', ownerContract: 'P32', impactLanguage: 'Sets session timeout for all members', impactedSurface: 'Session management', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['admin', 'owner'] },
  { key: 'guest_access_enabled', scope: 'tenant', ownerContract: 'P32', impactLanguage: 'Enables or disables guest access to the workspace', impactedSurface: 'Access control', requiresRestart: false, confirmationGate: true, readRoles: ['*'], writeRoles: ['admin', 'owner'] },
  { key: 'external_link_sharing', scope: 'tenant', ownerContract: 'P32', impactLanguage: 'Controls external link sharing permissions', impactedSurface: 'Sharing, Links', requiresRestart: false, confirmationGate: true, readRoles: ['*'], writeRoles: ['admin', 'owner'] },
  { key: 'tool_approval_required', scope: 'tenant', ownerContract: 'P32', impactLanguage: 'Requires admin approval for new tool usage', impactedSurface: 'Tools module', requiresRestart: false, confirmationGate: false, readRoles: ['*'], writeRoles: ['admin', 'owner'] },
];

class SettingsRegistryServiceClass {

  getRegistry(): SettingsKeyMetadata[] {
    return [...SETTINGS_REGISTRY];
  }

  getKeyMetadata(key: string): SettingsKeyMetadata | undefined {
    return SETTINGS_REGISTRY.find(k => k.key === key);
  }

  getKeysByScope(scope: SettingsScope): SettingsKeyMetadata[] {
    return SETTINGS_REGISTRY.filter(k => k.scope === scope);
  }

  getKeysByOwner(owner: string): SettingsKeyMetadata[] {
    return SETTINGS_REGISTRY.filter(k => k.ownerContract === owner);
  }

  /**
   * P31 §2.3.5 — Check if a key write should route to Admin (P32)
   * Returns routing info if the key is tenant-enforced and owned by P32
   */
  checkWriteRouting(key: string, userRole: string): { allowed: boolean; routeTo?: string; guidance?: string } {
    const meta = this.getKeyMetadata(key);
    if (!meta) return { allowed: true };

    if (meta.scope === 'tenant' && meta.ownerContract === 'P32') {
      if (!meta.writeRoles.includes(userRole) && !meta.writeRoles.includes('*')) {
        return {
          allowed: false,
          routeTo: 'Admin',
          guidance: `This setting is managed in Admin. Only ${meta.writeRoles.join('/')} roles can modify "${key}".`,
        };
      }
    }

    if (meta.scope === 'tenant' && !meta.writeRoles.includes(userRole) && !meta.writeRoles.includes('*')) {
      return {
        allowed: false,
        routeTo: 'Admin',
        guidance: `Tenant-enforced setting "${key}" requires ${meta.writeRoles.join('/')} role. Managed in Admin (P32).`,
      };
    }

    return { allowed: true };
  }

  /**
   * P31 §2.3.3 — Resolve effective value with inheritance cascade
   * Personal > Module > Tenant > System
   */
  async resolveEffectiveValue(key: string, userId: string, orgId?: string): Promise<{
    value: any;
    source: 'personal' | 'module' | 'tenant' | 'system' | 'default';
    metadata?: SettingsKeyMetadata;
    overriddenBy?: string;
  }> {
    const meta = this.getKeyMetadata(key);

    // 1. Personal override
    const personal = await dbGet(
      'SELECT value FROM user_preferences WHERE user_id = $1 AND key = $2',
      [userId, `settings:${key}`],
      { fallback: true }
    );
    if (personal?.value) {
      return { value: personal.value, source: 'personal', metadata: meta };
    }

    // 2. Tenant value (from settings table, scoped by org)
    if (orgId) {
      const tenant = await dbGet(
        'SELECT value FROM settings WHERE key = $1',
        [`tenant:${orgId}:${key}`],
        { fallback: true }
      );
      if (tenant?.value) {
        return { value: tenant.value, source: 'tenant', metadata: meta };
      }
    }

    // 3. System default
    const system = await dbGet(
      'SELECT value FROM settings WHERE key = $1',
      [key],
      { fallback: true }
    );
    if (system?.value) {
      return { value: system.value, source: 'system', metadata: meta };
    }

    return { value: null, source: 'default', metadata: meta };
  }

  /**
   * P31 §2.4 — Degraded posture helpers
   */
  buildDenialResponse(key: string, reason: 'permission_denied' | 'read_only' | 'not_found' | 'resolver_unavailable') {
    const meta = this.getKeyMetadata(key);

    switch (reason) {
      case 'permission_denied':
        return {
          status: 403,
          code: 'SETTINGS_PERMISSION_DENIED',
          message: meta?.ownerContract === 'P32'
            ? `This setting is managed in Admin. Navigate to Admin → Security Policy to modify "${key}".`
            : meta?.ownerContract === 'P30'
            ? `This setting is managed in Organization. Navigate to Organization settings to modify "${key}".`
            : `You do not have permission to modify "${key}".`,
          routeTo: meta?.ownerContract === 'P32' ? '/admin/security' : meta?.ownerContract === 'P30' ? '/organization' : undefined,
        };
      case 'read_only':
        return {
          status: 403,
          code: 'SETTINGS_READ_ONLY',
          message: `Setting "${key}" is read-only in Settings. ${meta?.ownerContract === 'P32' ? 'Managed in Admin.' : 'Managed in Organization.'}`,
          routeTo: meta?.ownerContract === 'P32' ? '/admin/security' : '/organization',
        };
      case 'not_found':
        return {
          status: 404,
          code: 'SETTINGS_KEY_NOT_FOUND',
          message: `Setting "${key}" is no longer available.`,
          routeTo: '/settings',
        };
      case 'resolver_unavailable':
        return {
          status: 503,
          code: 'SETTINGS_RESOLVER_UNAVAILABLE',
          message: 'Settings resolver is temporarily unavailable. Please try again.',
        };
    }
  }
}

const settingsRegistryService = new SettingsRegistryServiceClass();
export default settingsRegistryService;
export { SettingsRegistryServiceClass, SETTINGS_REGISTRY };
