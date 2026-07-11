/**
 * Security Utilities
 * Enterprise SaaS Architecture - Security Hardening Layer
 *
 * Centralized security functions for:
 * - Input sanitization
 * - SQL injection prevention
 * - XSS prevention
 * - CSRF token management
 */

import crypto from 'crypto';

import { decodeHtmlEntities } from './htmlEntities.js';

// ==========================================
// XSS PREVENTION
// ==========================================

/**
 * HTML entities map for XSS prevention
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#96;',
};

/**
 * Sanitize string input to prevent XSS attacks
 * Escapes HTML special characters
 *
 * Z139 (data-integrity) idempotency guard:
 * This runs on EVERY request-body/query/param string via the global
 * `inputSanitizationMiddleware`, on EVERY write. If a field's current value
 * already contains escaped entities — e.g. because a prior save escaped it
 * and the client echoed the escaped string back verbatim on the next
 * save/PATCH without decoding it first — escaping again used to compound
 * without bound (`&` -> `&amp;` -> `&amp;amp;` -> ... on every edit cycle).
 * We decode any pre-existing entities back to plain text FIRST, then escape
 * exactly once. This makes sanitization idempotent (repeated saves converge
 * to a single escape level, never grow) for ALL text fields across ALL
 * modules, while preserving the exact same escaped-storage/security
 * guarantee this function always had for values that were never escaped —
 * dangerous characters are still neutralized on every call. This does NOT
 * disable sanitization, it only removes the double/triple-escape defect.
 */
export function sanitizeString(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') return String(input);

  // Important:
  // - This runs on API input (JSON), not on HTML rendering.
  // - Escaping `/` or `=` breaks legitimate data (URLs, tokens, base64).
  // - Keep escaping to the minimal set needed to neutralize HTML contexts.
  const decoded = decodeHtmlEntities(input);
  return decoded.replace(/[&<>"'`]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize object recursively
 * Escapes all string values in nested objects/arrays
 */
export function sanitizeObject<T>(obj: T, maxDepth = 10): T {
  if (maxDepth <= 0) return obj;

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, maxDepth - 1)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value, maxDepth - 1);
    }
    return sanitized as T;
  }

  return obj;
}

/**
 * Strip HTML tags from input
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

// ==========================================
// SQL INJECTION PREVENTION
// ==========================================

/**
 * Allowed table names for dynamic queries
 * Only these tables can be used in interpolated SQL
 */
const ALLOWED_TABLES = new Set([
  'users',
  'organizations',
  'projects',
  'tasks',
  'initiatives',
  'decisions',
  'stage_gates',
  'notifications',
  'sessions',
  'teams',
  'team_members',
  'llm_providers',
  'revoked_tokens',
  'subscription_plans',
  'organization_billing',
  'activity_log',
  'audit_log',
  'knowledge_docs',
  'knowledge_candidates',
  'global_strategies',
  'assessments',
  'assessment_responses',
  'raid_items',
  'milestones',
  'documents',
  'user_settings',
  'organization_settings',
  'user_api_keys',
  'invitations',
  'refresh_tokens',
  'ai_conversations',
  'ai_messages',
  'token_usage',
  'sso_configurations',
  'legal_documents',
  'legal_acceptances',
]);

/**
 * Allowed column names for dynamic queries
 */
const ALLOWED_COLUMNS = new Set([
  'id',
  'user_id',
  'organization_id',
  'project_id',
  'initiative_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'status',
  'priority',
  'name',
  'title',
  'description',
  'email',
  'role',
  'type',
  'category',
  'assignee_id',
  'owner_id',
  'reporter_id',
]);

/**
 * Validate table name against allowlist
 * Throws error if table name is not allowed
 */
export function validateTableName(tableName: string): string {
  const normalized = tableName.toLowerCase().trim();
  if (!ALLOWED_TABLES.has(normalized)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }
  return normalized;
}

/**
 * Validate column name against allowlist
 * Throws error if column name is not allowed
 */
export function validateColumnName(columnName: string): string {
  const normalized = columnName.toLowerCase().trim();
  if (!ALLOWED_COLUMNS.has(normalized)) {
    throw new Error(`Invalid column name: ${columnName}`);
  }
  return normalized;
}

/**
 * Safe identifier for SQL (table/column names)
 * Validates against allowlist and escapes
 */
export function safeIdentifier(identifier: string, type: 'table' | 'column' = 'column'): string {
  // Remove any non-alphanumeric characters except underscore
  const cleaned = identifier.replace(/[^a-zA-Z0-9_]/g, '');

  if (type === 'table') {
    return validateTableName(cleaned);
  }
  return validateColumnName(cleaned);
}

/**
 * Escape SQL LIKE pattern special characters
 */
export function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, '\\$&');
}

// ==========================================
// CSRF PROTECTION
// ==========================================

/**
 * CSRF Token configuration
 */
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY_MS = 1000 * 60 * 60; // 1 hour

/**
 * In-memory CSRF token store
 * In production, use Redis for distributed systems
 */
const csrfTokenStore = new Map<string, { token: string; expiresAt: number }>();

/**
 * Generate a CSRF token for a session
 */
export function generateCsrfToken(sessionId: string): string {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const expiresAt = Date.now() + CSRF_TOKEN_EXPIRY_MS;

  csrfTokenStore.set(sessionId, { token, expiresAt });

  // Cleanup expired tokens periodically
  cleanupExpiredCsrfTokens();

  return token;
}

/**
 * Validate a CSRF token for a session
 */
export function validateCsrfToken(sessionId: string, token: string): boolean {
  const stored = csrfTokenStore.get(sessionId);

  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    csrfTokenStore.delete(sessionId);
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(stored.token), Buffer.from(token));
}

/**
 * Invalidate CSRF token for a session
 */
export function invalidateCsrfToken(sessionId: string): void {
  csrfTokenStore.delete(sessionId);
}

/**
 * Cleanup expired CSRF tokens
 */
function cleanupExpiredCsrfTokens(): void {
  const now = Date.now();
  for (const [sessionId, { expiresAt }] of csrfTokenStore.entries()) {
    if (now > expiresAt) {
      csrfTokenStore.delete(sessionId);
    }
  }
}

// ==========================================
// INPUT VALIDATION HELPERS
// ==========================================

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate integer
 */
export function isValidInteger(value: unknown): boolean {
  if (typeof value === 'number') return Number.isInteger(value);
  if (typeof value === 'string') return /^-?\d+$/.test(value);
  return false;
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, '') // Remove path traversal
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Only allow safe characters
    .replace(/^\.+/, '') // Remove leading dots
    .substring(0, 255); // Limit length
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

// ==========================================
// RATE LIMITING HELPERS
// ==========================================

/**
 * Generate a consistent key for rate limiting
 */
export function generateRateLimitKey(prefix: string, identifier: string): string {
  return `ratelimit:${prefix}:${identifier}`;
}

// ==========================================
// EXPORTS
// ==========================================

export default {
  // XSS Prevention
  sanitizeString,
  sanitizeObject,
  stripHtml,

  // SQL Injection Prevention
  validateTableName,
  validateColumnName,
  safeIdentifier,
  escapeLikePattern,

  // CSRF Protection
  generateCsrfToken,
  validateCsrfToken,
  invalidateCsrfToken,

  // Input Validation
  isValidUUID,
  isValidEmail,
  isValidInteger,
  sanitizeFilename,
  sanitizeUrl,

  // Rate Limiting
  generateRateLimitKey,
};
