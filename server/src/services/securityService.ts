/**
 * Security Service
 * FLOW-SECURITY-001: Advanced security features (SSO, SCIM, Sessions)
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import { flagOn } from '../utils/pgFlags.js';

// ==========================================
// TYPES
// ==========================================

export interface SSOConfiguration {
  id: string;
  organizationId: string;
  protocol: 'saml' | 'oidc';
  providerName: string;
  providerType: string;
  isEnabled: boolean;
  isDefault: boolean;
  jitProvisioning: boolean;
  defaultRole: string;
}

export interface UserSession {
  id: string;
  userId: string;
  organizationId: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  ipAddress?: string;
  geoCountry?: string;
  geoCity?: string;
  isActive: boolean;
  createdAt: string;
  lastActivityAt: string;
  isCurrent?: boolean;
}

export interface IPWhitelistRule {
  id: string;
  organizationId: string;
  ruleType: 'ip' | 'cidr' | 'range';
  ruleValue: string;
  description?: string;
  isEnabled: boolean;
}

export interface SecurityEvent {
  id: string;
  organizationId?: string;
  userId?: string;
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  ipAddress?: string;
  description?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

// ==========================================
// SERVICE
// ==========================================

class SecurityService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ==========================================
  // SSO
  // ==========================================

  /**
   * Get SSO configuration for organization
   */
  async getSSOConfiguration(orgId: string): Promise<SSOConfiguration | null> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      organization_id: string;
      protocol: string;
      provider_name: string;
      provider_type: string;
      is_enabled: number;
      is_default: number;
      jit_provisioning: number;
      default_role: string;
    }>(`SELECT * FROM sso_configurations WHERE organization_id = ? AND is_enabled = 1`, [orgId]);

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      protocol: row.protocol as SSOConfiguration['protocol'],
      providerName: row.provider_name,
      providerType: row.provider_type,
      isEnabled: flagOn(row.is_enabled),
      isDefault: flagOn(row.is_default),
      jitProvisioning: flagOn(row.jit_provisioning),
      defaultRole: row.default_role,
    };
  }

  /**
   * Create/Update SSO configuration
   */
  async saveSSOConfiguration(
    orgId: string,
    config: Partial<SSOConfiguration> & {
      samlConfig?: Record<string, unknown>;
      oidcConfig?: Record<string, unknown>;
    },
    userId: string
  ): Promise<string> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    // Check if exists
    const existing = await db.get<{ id: string }>(
      `SELECT id FROM sso_configurations WHERE organization_id = ? AND provider_name = ?`,
      [orgId, config.providerName]
    );

    if (existing) {
      await db.run(
        `UPDATE sso_configurations SET 
                    protocol = ?, provider_type = ?, is_enabled = ?, 
                    jit_provisioning = ?, default_role = ?, updated_at = ?
                 WHERE id = ?`,
        [
          config.protocol,
          config.providerType,
          config.isEnabled ? 1 : 0,
          config.jitProvisioning !== false ? 1 : 0,
          config.defaultRole || 'user',
          now,
          existing.id,
        ]
      );
      return existing.id;
    }

    const id = `sso-${uuidv4()}`;
    await db.run(
      `INSERT INTO sso_configurations (
                id, organization_id, protocol, provider_name, provider_type,
                is_enabled, jit_provisioning, default_role, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        config.protocol,
        config.providerName,
        config.providerType,
        config.isEnabled ? 1 : 0,
        config.jitProvisioning !== false ? 1 : 0,
        config.defaultRole || 'user',
        userId,
        now,
      ]
    );

    return id;
  }

  // ==========================================
  // SESSIONS
  // ==========================================

  /**
   * Create session
   */
  async createSession(input: {
    userId: string;
    organizationId: string;
    sessionToken: string;
    refreshToken?: string;
    userAgent?: string;
    ipAddress?: string;
    authMethod?: string;
    expiresAt?: string;
  }): Promise<string> {
    const db = await this.getDb();
    const id = `sess-${uuidv4()}`;
    const now = new Date().toISOString();

    // Parse user agent
    const { browser, os, deviceType } = this.parseUserAgent(input.userAgent);

    // Hash tokens
    const sessionTokenHash = this.hashToken(input.sessionToken);
    const refreshTokenHash = input.refreshToken ? this.hashToken(input.refreshToken) : null;

    await db.run(
      `INSERT INTO user_sessions (
                id, user_id, organization_id, session_token_hash, refresh_token_hash,
                user_agent, browser, os, device_type, ip_address,
                auth_method, created_at, last_activity_at, expires_at, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        input.userId,
        input.organizationId,
        sessionTokenHash,
        refreshTokenHash,
        input.userAgent || null,
        browser,
        os,
        deviceType,
        input.ipAddress || null,
        input.authMethod || 'password',
        now,
        now,
        input.expiresAt || null,
      ]
    );

    // Log security event
    await this.logSecurityEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      eventType: 'session_created',
      severity: 'info',
      ipAddress: input.ipAddress,
      details: { sessionId: id, authMethod: input.authMethod },
    });

    return id;
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string, currentSessionId?: string): Promise<UserSession[]> {
    const db = await this.getDb();
    const sessionColumns = await getTableColumns('user_sessions');
    const activityColumn = sessionColumns.has('last_activity_at')
      ? 'last_activity_at'
      : sessionColumns.has('last_active_at')
        ? 'last_active_at'
        : 'created_at';
    const activeExpr = sessionColumns.has('is_active')
      ? `COALESCE(CAST(is_active AS TEXT), '0') IN ('1', 'true', 'TRUE', 't', 'T')`
      : 'TRUE';

    const rows = await db.all<{
      id: string;
      user_id: string;
      organization_id: string;
      browser: string;
      os: string;
      device_type: string;
      ip_address: string;
      geo_country: string;
      geo_city: string;
      is_active: boolean | number | null;
      created_at: string;
      last_activity_at: string;
    }>(
      `SELECT *
       FROM user_sessions
       WHERE user_id = ?
         AND ${activeExpr}
       ORDER BY ${activityColumn} DESC`,
      [userId]
    );

    return (rows || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      organizationId: r.organization_id,
      browser: r.browser,
      os: r.os,
      deviceType: r.device_type,
      ipAddress: r.ip_address,
      geoCountry: r.geo_country,
      geoCity: r.geo_city,
      isActive: sessionColumns.has('is_active') ? r.is_active === true || r.is_active === 1 : true,
      createdAt: r.created_at,
      lastActivityAt: r.last_activity_at || (r as any).last_active_at || r.created_at,
      isCurrent: r.id === currentSessionId,
    }));
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionId: string, revokedBy: string, reason?: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.run(
      `UPDATE user_sessions SET 
                is_active = 0, revoked_at = ?, revoked_by = ?, revoke_reason = ?
             WHERE id = ?`,
      [now, revokedBy, reason || 'user_logout', sessionId]
    );

    // Get session info for logging
    const session = await db.get<{ user_id: string; organization_id: string }>(
      `SELECT user_id, organization_id FROM user_sessions WHERE id = ?`,
      [sessionId]
    );

    if (session) {
      await this.logSecurityEvent({
        organizationId: session.organization_id,
        userId: session.user_id,
        eventType: 'session_revoked',
        severity: 'info',
        details: { sessionId, revokedBy, reason },
      });
    }
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllSessions(
    userId: string,
    revokedBy: string,
    exceptSessionId?: string
  ): Promise<number> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    let query = `UPDATE user_sessions SET 
            is_active = 0, revoked_at = ?, revoked_by = ?, revoke_reason = 'revoke_all'
            WHERE user_id = ? AND is_active = 1`;
    const params: string[] = [now, revokedBy, userId];

    if (exceptSessionId) {
      query += ` AND id != ?`;
      params.push(exceptSessionId);
    }

    const result = await db.run(query, params);
    return result.changes || 0;
  }

  // ==========================================
  // IP WHITELIST
  // ==========================================

  /**
   * Get IP whitelist rules
   */
  async getIPWhitelist(orgId: string): Promise<IPWhitelistRule[]> {
    const db = await this.getDb();

    const rows = await db.all<{
      id: string;
      organization_id: string;
      rule_type: string;
      rule_value: string;
      description: string;
      is_enabled: number;
    }>(`SELECT * FROM ip_whitelist WHERE organization_id = ? ORDER BY created_at`, [orgId]);

    return (rows || []).map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      ruleType: r.rule_type as IPWhitelistRule['ruleType'],
      ruleValue: r.rule_value,
      description: r.description,
      isEnabled: r.is_enabled === 1,
    }));
  }

  /**
   * Add IP whitelist rule
   */
  async addIPWhitelistRule(
    orgId: string,
    rule: { ruleType: string; ruleValue: string; description?: string },
    userId: string
  ): Promise<string> {
    const db = await this.getDb();
    const id = `ip-${uuidv4()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO ip_whitelist (id, organization_id, rule_type, rule_value, description, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, orgId, rule.ruleType, rule.ruleValue, rule.description || null, userId, now]
    );

    return id;
  }

  /**
   * Check if IP is allowed
   */
  async isIPAllowed(orgId: string, ipAddress: string): Promise<boolean> {
    const rules = await this.getIPWhitelist(orgId);

    if (rules.length === 0) {
      return true; // No whitelist = allow all
    }

    const enabledRules = rules.filter((r) => r.isEnabled);
    if (enabledRules.length === 0) {
      return true;
    }

    for (const rule of enabledRules) {
      if (this.matchesIPRule(ipAddress, rule)) {
        return true;
      }
    }

    return false;
  }

  // ==========================================
  // SECURITY EVENTS
  // ==========================================

  /**
   * Log security event
   */
  async logSecurityEvent(event: {
    organizationId?: string;
    userId?: string;
    eventType: string;
    severity?: 'info' | 'warning' | 'critical';
    ipAddress?: string;
    userAgent?: string;
    description?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const db = await this.getDb();
    const id = `sec-${uuidv4()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO security_events (
                id, organization_id, user_id, event_type, severity,
                ip_address, user_agent, description, details, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        event.organizationId || null,
        event.userId || null,
        event.eventType,
        event.severity || 'info',
        event.ipAddress || null,
        event.userAgent || null,
        event.description || null,
        event.details ? JSON.stringify(event.details) : null,
        now,
      ]
    );
  }

  /**
   * Get security events
   */
  async getSecurityEvents(
    orgId: string,
    options?: { limit?: number; eventType?: string; severity?: string }
  ): Promise<SecurityEvent[]> {
    const db = await this.getDb();

    let query = `SELECT * FROM security_events WHERE organization_id = ?`;
    const params: (string | number)[] = [orgId];

    if (options?.eventType) {
      query += ` AND event_type = ?`;
      params.push(options.eventType);
    }

    if (options?.severity) {
      query += ` AND severity = ?`;
      params.push(options.severity);
    }

    query += ` ORDER BY created_at DESC`;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    const rows = await db.all<{
      id: string;
      organization_id: string;
      user_id: string;
      event_type: string;
      severity: string;
      ip_address: string;
      description: string;
      details: string;
      created_at: string;
    }>(query, params);

    return (rows || []).map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      userId: r.user_id,
      eventType: r.event_type,
      severity: r.severity as SecurityEvent['severity'],
      ipAddress: r.ip_address,
      description: r.description,
      details: r.details ? JSON.parse(r.details) : undefined,
      createdAt: r.created_at,
    }));
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseUserAgent(userAgent?: string): {
    browser?: string;
    os?: string;
    deviceType?: string;
  } {
    if (!userAgent) return {};

    // Simple parsing - in production, use a proper library
    let browser = 'Unknown';
    let os = 'Unknown';
    let deviceType = 'desktop';

    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) {
      os = 'Android';
      deviceType = 'mobile';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      os = 'iOS';
      deviceType = 'mobile';
    }

    return { browser, os, deviceType };
  }

  private matchesIPRule(ip: string, rule: IPWhitelistRule): boolean {
    switch (rule.ruleType) {
      case 'ip':
        return ip === rule.ruleValue;
      case 'cidr':
        // Simple CIDR check - in production use a proper library
        return ip.startsWith(rule.ruleValue.split('/')[0].replace(/\.\d+$/, ''));
      case 'range':
        // Simple range check
        const [start, end] = rule.ruleValue.split('-');
        return ip >= start && ip <= end;
      default:
        return false;
    }
  }
}

// Export singleton
const securityService = new SecurityService();
export default securityService;

// Named exports
export const getSSOConfiguration = (orgId: string) => securityService.getSSOConfiguration(orgId);
export const saveSSOConfiguration = (
  orgId: string,
  config: Parameters<typeof securityService.saveSSOConfiguration>[1],
  userId: string
) => securityService.saveSSOConfiguration(orgId, config, userId);
export const createSession = (input: Parameters<typeof securityService.createSession>[0]) =>
  securityService.createSession(input);
export const getUserSessions = (userId: string, currentSessionId?: string) =>
  securityService.getUserSessions(userId, currentSessionId);
export const revokeSession = (sessionId: string, revokedBy: string, reason?: string) =>
  securityService.revokeSession(sessionId, revokedBy, reason);
export const revokeAllSessions = (userId: string, revokedBy: string, exceptSessionId?: string) =>
  securityService.revokeAllSessions(userId, revokedBy, exceptSessionId);
export const getIPWhitelist = (orgId: string) => securityService.getIPWhitelist(orgId);
export const addIPWhitelistRule = (
  orgId: string,
  rule: Parameters<typeof securityService.addIPWhitelistRule>[1],
  userId: string
) => securityService.addIPWhitelistRule(orgId, rule, userId);
export const isIPAllowed = (orgId: string, ipAddress: string) =>
  securityService.isIPAllowed(orgId, ipAddress);
export const logSecurityEvent = (event: Parameters<typeof securityService.logSecurityEvent>[0]) =>
  securityService.logSecurityEvent(event);
export const getSecurityEvents = (
  orgId: string,
  options?: Parameters<typeof securityService.getSecurityEvents>[1]
) => securityService.getSecurityEvents(orgId, options);
