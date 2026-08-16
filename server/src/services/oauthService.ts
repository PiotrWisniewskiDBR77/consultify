/**
 * OAuth Service — Google & LinkedIn login/connect flows
 * Bundle 30.5 (T110, T111, T112)
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import config from '../config/Config.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

export interface OAuthUserInfo {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

interface OAuthLink {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  provider_email: string | null;
  display_name: string | null;
  linked_at: string;
  last_login_at: string | null;
  revoked_at: string | null;
}

interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id: string;
  status: string;
}

export type OAuthProvider = 'google' | 'linkedin';

export interface ApprovedOAuthProviderDecision {
  approved: true;
  scopes: string[];
  residency: string;
}

// ==========================================
// STATE MANAGEMENT (in-memory, TTL ~10min)
// ==========================================

const pendingStates = new Map<
  string,
  { createdAt: number; mode: 'login' | 'connect'; userId?: string }
>();
const STATE_TTL_MS = 10 * 60 * 1000;

function cleanExpiredStates(): void {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (now - val.createdAt > STATE_TTL_MS) {
      pendingStates.delete(key);
    }
  }
}

setInterval(cleanExpiredStates, 60_000);

// ==========================================
// PROVIDER CONFIGS
// ==========================================

const REQUIRED_PROVIDER_SCOPES: Record<OAuthProvider, readonly string[]> = {
  google: ['openid', 'email', 'profile'],
  linkedin: ['openid', 'profile', 'email'],
};

/**
 * Product secrets are deliberately insufficient to activate OAuth. Security /
 * Privacy and Product must also publish an explicit provider decision. The
 * registry is JSON so scopes and residency are reviewed as data, not inferred
 * from whichever credentials happen to exist in an environment.
 *
 * Example:
 * {"google":{"approved":true,"scopes":["openid","email","profile"],"residency":"EU"}}
 */
export function getApprovedOAuthProviderDecision(
  provider: OAuthProvider
): ApprovedOAuthProviderDecision | null {
  const raw = process.env.OAUTH_APPROVED_PROVIDER_REGISTRY;
  if (!raw) return null;

  try {
    const registry = JSON.parse(raw) as Record<string, unknown>;
    const candidate = registry[provider];
    if (!candidate || typeof candidate !== 'object') return null;
    const decision = candidate as Record<string, unknown>;
    if (decision.approved !== true || !Array.isArray(decision.scopes)) return null;
    if (typeof decision.residency !== 'string' || !decision.residency.trim()) return null;

    const scopes = decision.scopes.filter((scope): scope is string => typeof scope === 'string');
    const required = REQUIRED_PROVIDER_SCOPES[provider];
    if (scopes.length !== required.length || !required.every((scope) => scopes.includes(scope))) {
      return null;
    }

    return { approved: true, scopes: [...scopes], residency: decision.residency.trim() };
  } catch {
    return null;
  }
}

function getGoogleConfig(): OAuthProviderConfig | null {
  const decision = getApprovedOAuthProviderDecision('google');
  if (!decision) return null;
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    callbackUrl: config.GOOGLE_CALLBACK_URL || `http://localhost:3005/api/auth/google/callback`,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: decision.scopes,
  };
}

function getLinkedInConfig(): OAuthProviderConfig | null {
  const decision = getApprovedOAuthProviderDecision('linkedin');
  if (!decision) return null;
  if (!config.LINKEDIN_CLIENT_ID || !config.LINKEDIN_CLIENT_SECRET) return null;
  return {
    clientId: config.LINKEDIN_CLIENT_ID,
    clientSecret: config.LINKEDIN_CLIENT_SECRET,
    callbackUrl: config.LINKEDIN_CALLBACK_URL || `http://localhost:3005/api/auth/linkedin/callback`,
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scopes: decision.scopes,
  };
}

// ==========================================
// CORE OAUTH FLOW
// ==========================================

class OAuthService {
  /**
   * Generate authorization URL for a provider
   */
  generateAuthUrl(
    provider: 'google' | 'linkedin',
    mode: 'login' | 'connect' = 'login',
    userId?: string
  ): { url: string; state: string } | null {
    const cfg = provider === 'google' ? getGoogleConfig() : getLinkedInConfig();
    if (!cfg) return null;

    const state = crypto.randomBytes(32).toString('hex');
    pendingStates.set(state, { createdAt: Date.now(), mode, userId });

    const callbackUrl =
      mode === 'connect' && provider === 'linkedin'
        ? cfg.callbackUrl.replace('/callback', '/connect/callback')
        : cfg.callbackUrl;

    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: cfg.scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return { url: `${cfg.authorizeUrl}?${params.toString()}`, state };
  }

  /**
   * Validate and consume state (one-time use)
   */
  validateState(state: string): { mode: 'login' | 'connect'; userId?: string } | null {
    const entry = pendingStates.get(state);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > STATE_TTL_MS) {
      pendingStates.delete(state);
      return null;
    }
    pendingStates.delete(state);
    return { mode: entry.mode, userId: entry.userId };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(
    provider: 'google' | 'linkedin',
    code: string,
    mode: 'login' | 'connect' = 'login'
  ): Promise<{ accessToken: string; idToken?: string } | null> {
    const cfg = provider === 'google' ? getGoogleConfig() : getLinkedInConfig();
    if (!cfg) return null;

    const callbackUrl =
      mode === 'connect' && provider === 'linkedin'
        ? cfg.callbackUrl.replace('/callback', '/connect/callback')
        : cfg.callbackUrl;

    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl,
    });

    const resp = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      logger.error(`[OAuth] Token exchange failed for ${provider}: ${resp.status} ${text}`);
      return null;
    }

    const data = (await resp.json()) as any;
    return {
      accessToken: data.access_token,
      idToken: data.id_token,
    };
  }

  /**
   * Fetch user info from provider
   */
  async getUserInfo(
    provider: 'google' | 'linkedin',
    accessToken: string
  ): Promise<OAuthUserInfo | null> {
    const cfg = provider === 'google' ? getGoogleConfig() : getLinkedInConfig();
    if (!cfg) return null;

    const resp = await fetch(cfg.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      logger.error(`[OAuth] UserInfo fetch failed for ${provider}: ${resp.status}`);
      return null;
    }

    const data = (await resp.json()) as any;

    if (provider === 'google') {
      return {
        providerUserId: data.sub,
        email: data.email || null,
        emailVerified: data.email_verified === true,
        displayName: data.name || null,
        firstName: data.given_name || null,
        lastName: data.family_name || null,
        avatarUrl: data.picture || null,
      };
    }

    // LinkedIn OpenID Connect userinfo
    return {
      providerUserId: data.sub,
      email: data.email || null,
      emailVerified: data.email_verified === true,
      displayName: data.name || null,
      firstName: data.given_name || null,
      lastName: data.family_name || null,
      avatarUrl: data.picture || null,
    };
  }

  /**
   * Find or create user based on OAuth info (login flow)
   */
  async findOrCreateUser(
    provider: 'google' | 'linkedin',
    userInfo: OAuthUserInfo
  ): Promise<{ user: UserRow; isNew: boolean; linked: boolean } | { error: string }> {
    // 1. Check existing oauth_link
    const existingLink = await dbGet<OAuthLink>(
      `SELECT * FROM oauth_links
       WHERE provider = ? AND provider_user_id = ? AND revoked_at IS NULL`,
      [provider, userInfo.providerUserId]
    );

    if (existingLink) {
      const user = await dbGet<UserRow>(`SELECT * FROM users WHERE id = ?`, [existingLink.user_id]);
      if (user) {
        await dbRun(
          `UPDATE oauth_links SET last_login_at = NOW(), provider_email = ? WHERE id = ?`,
          [userInfo.email, existingLink.id]
        );
        return { user, isNew: false, linked: false };
      }
    }

    // 2. Check by email
    if (!userInfo.email) {
      return { error: 'no_email' };
    }

    if (provider === 'google' && !userInfo.emailVerified) {
      return { error: 'email_not_verified' };
    }

    const existingUser = await dbGet<UserRow>(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [
      userInfo.email,
    ]);

    if (existingUser) {
      // Link existing account
      await this.createOAuthLink(provider, userInfo, existingUser.id);
      return { user: existingUser, isNew: false, linked: true };
    }

    // 3. Create new user
    const userId = uuidv4();
    const orgId = uuidv4();

    // Create organization first
    await dbRun(
      `INSERT INTO organizations (id, name, status, plan, created_at, updated_at)
       VALUES (?, ?, 'active', 'free', NOW(), NOW())`,
      [orgId, `${userInfo.firstName || userInfo.displayName || 'User'}'s Organization`]
    );

    // Create user
    await dbRun(
      `INSERT INTO users (id, email, first_name, last_name, role, organization_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'CEO', ?, 'active', NOW(), NOW())`,
      [
        userId,
        userInfo.email,
        userInfo.firstName || userInfo.displayName || '',
        userInfo.lastName || '',
        orgId,
      ]
    );

    const newUser = await dbGet<UserRow>(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!newUser) {
      return { error: 'user_creation_failed' };
    }

    await this.createOAuthLink(provider, userInfo, userId);
    return { user: newUser, isNew: true, linked: true };
  }

  /**
   * Create oauth_link record
   */
  async createOAuthLink(provider: string, userInfo: OAuthUserInfo, userId: string): Promise<void> {
    const id = uuidv4();
    await dbRun(
      `INSERT INTO oauth_links (id, user_id, provider, provider_user_id, provider_email, display_name, linked_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON CONFLICT (user_id, provider) DO UPDATE SET
         provider_user_id = EXCLUDED.provider_user_id,
         provider_email = EXCLUDED.provider_email,
         display_name = EXCLUDED.display_name,
         last_login_at = NOW(),
         revoked_at = NULL`,
      [id, userId, provider, userInfo.providerUserId, userInfo.email, userInfo.displayName]
    );
  }

  /**
   * Connect flow: link provider to existing user
   */
  async connectAccount(
    provider: string,
    userInfo: OAuthUserInfo,
    userId: string
  ): Promise<{ success: true } | { error: string }> {
    // Check if this provider identity is already linked to another user
    const existingLink = await dbGet<OAuthLink>(
      `SELECT * FROM oauth_links
       WHERE provider = ? AND provider_user_id = ? AND revoked_at IS NULL AND user_id != ?`,
      [provider, userInfo.providerUserId, userId]
    );

    if (existingLink) {
      return { error: 'provider_identity_already_linked' };
    }

    await this.createOAuthLink(provider, userInfo, userId);
    return { success: true };
  }

  /**
   * Disconnect provider from user
   */
  async disconnectAccount(
    provider: string,
    userId: string
  ): Promise<{ success: true } | { error: string }> {
    const link = await dbGet<OAuthLink>(
      `SELECT * FROM oauth_links WHERE user_id = ? AND provider = ? AND revoked_at IS NULL`,
      [userId, provider]
    );

    if (!link) {
      return { error: 'not_connected' };
    }

    await dbRun(`UPDATE oauth_links SET revoked_at = NOW() WHERE id = ?`, [link.id]);

    return { success: true };
  }

  /**
   * Get connected accounts for a user
   */
  async getConnectedAccounts(userId: string): Promise<
    Array<{
      provider: string;
      email: string | null;
      displayName: string | null;
      connectedAt: string;
      status: string;
    }>
  > {
    const links = await dbAll<OAuthLink>(
      `SELECT * FROM oauth_links WHERE user_id = ? AND revoked_at IS NULL`,
      [userId]
    );

    return links.map((link) => ({
      provider: link.provider,
      email: link.provider_email,
      displayName: link.display_name,
      connectedAt: link.linked_at,
      status: 'active',
    }));
  }

  /**
   * Get OAuth provider status (for /api/auth/oauth/status)
   */
  getProviderStatus(): {
    google: { configured: boolean; approved: boolean; loginUrl: string; residency?: string };
    microsoft: { configured: false; approved: false; loginUrl: string };
    linkedin: { configured: boolean; approved: boolean; loginUrl: string; residency?: string };
  } {
    const googleDecision = getApprovedOAuthProviderDecision('google');
    const linkedinDecision = getApprovedOAuthProviderDecision('linkedin');
    const googleCfg = getGoogleConfig();
    const linkedinCfg = getLinkedInConfig();

    return {
      google: {
        configured: !!googleCfg,
        approved: !!googleDecision,
        loginUrl: googleCfg ? '/api/auth/google' : '',
        ...(googleDecision ? { residency: googleDecision.residency } : {}),
      },
      microsoft: { configured: false, approved: false, loginUrl: '' },
      linkedin: {
        configured: !!linkedinCfg,
        approved: !!linkedinDecision,
        loginUrl: linkedinCfg ? '/api/auth/linkedin' : '',
        ...(linkedinDecision ? { residency: linkedinDecision.residency } : {}),
      },
    };
  }
}

export const oauthService = new OAuthService();
export default oauthService;
