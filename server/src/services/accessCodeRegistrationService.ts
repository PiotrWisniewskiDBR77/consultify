import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import {
  type PinnedTransactionClient,
  withPinnedPostgresTransaction,
} from '../database/PostgresDatabase.js';
import { resolveBlockingOrgStatusValue } from './organizationSuspensionGuard.js';

export type AccessCodeRegistrationReason =
  | 'INVALID_CODE'
  | 'CODE_DEACTIVATED'
  | 'CODE_EXPIRED'
  | 'CODE_EXHAUSTED'
  | 'CODE_ROLE_INVALID'
  | 'CODE_ORG_MISMATCH'
  | 'ORGANIZATION_BLOCKED'
  | 'EMAIL_EXISTS'
  | 'CODE_CONSUMPTION_RACE';

export class AccessCodeRegistrationError extends Error {
  constructor(
    public readonly reason: AccessCodeRegistrationReason,
    message: string,
    public readonly blockingStatus: string | null = null
  ) {
    super(message);
    this.name = 'AccessCodeRegistrationError';
  }
}

export type AccessCodeRegistrationTransaction = Pick<
  PinnedTransactionClient,
  'queryOne' | 'queryRun'
>;

type TransactionRunner = <T>(
  work: (tx: AccessCodeRegistrationTransaction) => Promise<T>
) => Promise<T>;

type RegistrationDeps = {
  transaction?: TransactionRunner;
  createId?: () => string;
  now?: () => Date;
  hashPassword?: (password: string) => string;
};

export type AccessCodeRegistrationInput = {
  code: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type AccessCodeRegistrationResult = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  organizationName: string;
};

type AccessCodeRow = {
  id: string;
  organization_id: string;
  role: string;
  max_uses: number;
  current_uses: number;
  uses_count: number;
  expires_at: string | null;
  is_expired: boolean;
  is_active: number | boolean;
  created_by: string | null;
  created_by_user_id?: string | null;
  org_id: string;
  org_name: string;
  org_status: string | null;
};

function isInactive(value: number | boolean): boolean {
  return value === false || Number(value) === 0;
}

const ORGANIZATION_MEMBER_ROLES = new Set([
  'OWNER',
  'ADMIN',
  'MEMBER',
  'CONSULTANT',
  'USER',
  'GUEST',
]);

function normalizeCodeRole(value: unknown): string {
  const role = String(value || '')
    .trim()
    .toUpperCase();
  if (!ORGANIZATION_MEMBER_ROLES.has(role)) {
    throw new AccessCodeRegistrationError(
      'CODE_ROLE_INVALID',
      'This access code has an invalid organization role'
    );
  }
  return role;
}

/**
 * Public access-code registration is one identity unit of work: the account,
 * its ACTIVE tenant membership, code consumption and usage receipt either all
 * commit on one PostgreSQL connection or all roll back.
 */
export async function registerWithAccessCode(
  input: AccessCodeRegistrationInput,
  deps: RegistrationDeps = {}
): Promise<AccessCodeRegistrationResult> {
  const transaction: TransactionRunner = deps.transaction || withPinnedPostgresTransaction;
  const createId = deps.createId || uuidv4;
  const now = deps.now || (() => new Date());
  const hashPassword = deps.hashPassword || ((password: string) => bcrypt.hashSync(password, 8));
  const email = String(input.email || '')
    .trim()
    .toLowerCase();

  return transaction(async (tx) => {
    const accessCode = await tx.queryOne<AccessCodeRow>(
      `SELECT ac.*, o.id AS org_id, o.name AS org_name, o.status AS org_status,
              (ac.expires_at IS NOT NULL AND ac.expires_at <= CURRENT_TIMESTAMP) AS is_expired
         FROM access_codes ac
         JOIN organizations o ON o.id = ac.organization_id
        WHERE ac.code = ?
        FOR UPDATE`,
      [input.code]
    );

    if (!accessCode) {
      throw new AccessCodeRegistrationError('INVALID_CODE', 'Invalid access code');
    }
    if (isInactive(accessCode.is_active)) {
      throw new AccessCodeRegistrationError(
        'CODE_DEACTIVATED',
        'This access code has been deactivated'
      );
    }
    if (
      accessCode.is_expired === true ||
      (accessCode.is_expired == null &&
        accessCode.expires_at != null &&
        new Date(accessCode.expires_at).getTime() < now().getTime())
    ) {
      throw new AccessCodeRegistrationError('CODE_EXPIRED', 'This access code has expired');
    }
    if (
      accessCode.max_uses !== -1 &&
      Math.max(Number(accessCode.current_uses || 0), Number(accessCode.uses_count || 0)) >=
        Number(accessCode.max_uses)
    ) {
      throw new AccessCodeRegistrationError(
        'CODE_EXHAUSTED',
        'This access code has reached its usage limit'
      );
    }

    const blockingStatus = resolveBlockingOrgStatusValue(accessCode.org_status);
    if (blockingStatus) {
      throw new AccessCodeRegistrationError(
        'ORGANIZATION_BLOCKED',
        'Organization is not accepting new members',
        blockingStatus
      );
    }

    const creatorId = accessCode.created_by_user_id || accessCode.created_by;
    if (!creatorId) {
      throw new AccessCodeRegistrationError(
        'CODE_ORG_MISMATCH',
        'Access code is not valid for this organization'
      );
    }
    const creator = await tx.queryOne<{ role: string | null }>(
      'SELECT role FROM users WHERE id = ? LIMIT 1',
      [creatorId]
    );
    const creatorIsPlatformSuperAdmin = String(creator?.role || '').toUpperCase() === 'SUPERADMIN';
    if (!creatorIsPlatformSuperAdmin) {
      const creatorMembership = await tx.queryOne<{ id: string }>(
        `SELECT id FROM organization_members
          WHERE user_id = ? AND organization_id = ? AND UPPER(COALESCE(status, '')) = 'ACTIVE'
          LIMIT 1`,
        [creatorId, accessCode.org_id]
      );
      if (!creatorMembership) {
        throw new AccessCodeRegistrationError(
          'CODE_ORG_MISMATCH',
          'Access code is not valid for this organization'
        );
      }
    }

    const existingUser = await tx.queryOne<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = ? FOR UPDATE',
      [email]
    );
    if (existingUser) {
      throw new AccessCodeRegistrationError('EMAIL_EXISTS', 'Email already registered');
    }

    const userId = createId();
    const role = normalizeCodeRole(accessCode.role);
    const passwordHash = hashPassword(input.password);
    await tx.queryRun(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [userId, accessCode.org_id, email, passwordHash, input.firstName, input.lastName, role]
    );
    await tx.queryRun(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP)`,
      [createId(), accessCode.org_id, userId, role]
    );

    const consumed = await tx.queryRun(
      `UPDATE access_codes
          SET current_uses = COALESCE(current_uses, 0) + 1,
              uses_count = COALESCE(uses_count, 0) + 1
        WHERE id = ?
          AND is_active = 1
          AND (max_uses = -1 OR (
            COALESCE(current_uses, 0) < max_uses
            AND COALESCE(uses_count, 0) < max_uses
          ))
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [accessCode.id]
    );
    if (consumed.changes !== 1) {
      throw new AccessCodeRegistrationError(
        'CODE_CONSUMPTION_RACE',
        'This access code is no longer available'
      );
    }

    await tx.queryRun(
      `INSERT INTO access_code_usage (id, code_id, user_id, used_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [createId(), accessCode.id, userId]
    );

    return {
      userId,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      role,
      organizationId: accessCode.org_id,
      organizationName: accessCode.org_name,
    };
  });
}
