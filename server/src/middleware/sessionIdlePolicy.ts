type DbGet = <T = unknown>(sql: string, params?: unknown[]) => Promise<T | undefined>;

type SecuritySettingsRow = {
  setting_value?: unknown;
};

type UserSessionRow = {
  last_activity_at?: Date | string | null;
  last_active_at?: Date | string | null;
  created_at?: Date | string | null;
};

export type SessionIdleDecision =
  | { kind: 'NO_POLICY'; queryCount: 1 }
  | { kind: 'NO_SESSION'; queryCount: 2 }
  | { kind: 'ACTIVE'; queryCount: 2 }
  | { kind: 'EXPIRED'; queryCount: 2 };

const readTimeoutMinutes = (raw: unknown): number | null => {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const value = (parsed as { sessionTimeout?: unknown }).sessionTimeout;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
};

const readActivityMillis = (row: UserSessionRow): number | null => {
  const value = row.last_activity_at ?? row.last_active_at ?? row.created_at;
  if (!value) return null;
  const millis = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
};

export async function evaluateSessionIdlePolicy(
  dbGet: DbGet,
  organizationId: string,
  userId: string,
  tokenJti: string,
  nowMillis = Date.now()
): Promise<SessionIdleDecision> {
  const settings = await dbGet<SecuritySettingsRow>(
    `SELECT setting_value
     FROM organization_settings
     WHERE organization_id = ? AND setting_key = 'security'`,
    [organizationId]
  );
  const timeoutMinutes = readTimeoutMinutes(settings?.setting_value);
  if (timeoutMinutes === null) return { kind: 'NO_POLICY', queryCount: 1 };

  const session = await dbGet<UserSessionRow>(
    `SELECT last_activity_at, last_active_at, created_at
     FROM user_sessions
     WHERE user_id = ? AND token_jti = ? AND (is_active = true OR is_active IS NULL)
     LIMIT 1`,
    [userId, tokenJti]
  );
  if (!session) return { kind: 'NO_SESSION', queryCount: 2 };

  const activityMillis = readActivityMillis(session);
  if (activityMillis === null) return { kind: 'NO_SESSION', queryCount: 2 };
  if (nowMillis - activityMillis > timeoutMinutes * 60_000) {
    return { kind: 'EXPIRED', queryCount: 2 };
  }
  return { kind: 'ACTIVE', queryCount: 2 };
}

export const __private__ = { readTimeoutMinutes, readActivityMillis };
