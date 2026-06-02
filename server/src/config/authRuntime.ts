import type { Request } from 'express';

const runtimeEnv = String(process.env.NODE_ENV || 'development')
  .trim()
  .toLowerCase();

const isStageLikeEnv = runtimeEnv === 'staging' || runtimeEnv === 'production';

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value == null || value === '') return fallback;
  return value === 'true';
};

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseDurationToMs = (value: string | undefined, fallbackMs: number): number => {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return fallbackMs;

  const match = raw.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return fallbackMs;

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};

const parseSameSite = (value: string | undefined): 'lax' | 'strict' | 'none' => {
  const normalized = String(value || 'lax')
    .trim()
    .toLowerCase();
  if (normalized === 'strict' || normalized === 'none') return normalized;
  return 'lax';
};

const defaultAccessTokenExpiry = isStageLikeEnv ? '1h' : '8h';
const accessTokenExpiry = String(process.env.AUTH_ACCESS_TOKEN_EXPIRY || defaultAccessTokenExpiry)
  .trim()
  .toLowerCase();
const accessTokenExpiryMs = parseDurationToMs(
  accessTokenExpiry,
  parseDurationToMs(defaultAccessTokenExpiry, 60 * 60 * 1000)
);

const refreshTokenExpiryDays = parsePositiveInteger(
  process.env.AUTH_REFRESH_TOKEN_EXPIRY_DAYS,
  isStageLikeEnv ? 7 : 30
);

const passwordResetTtlMinutes = parsePositiveInteger(
  process.env.AUTH_PASSWORD_RESET_TTL_MINUTES,
  60
);

const configuredFrontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:3000')
  .trim()
  .replace(/\/+$/, '');

export const authRuntimeConfig = {
  runtimeEnv,
  isStageLikeEnv,
  accessTokenExpiry,
  accessTokenExpiryMs,
  refreshTokenExpiryDays,
  refreshTokenExpiryMs: refreshTokenExpiryDays * 24 * 60 * 60 * 1000,
  passwordResetTtlMinutes,
  passwordResetTtlMs: passwordResetTtlMinutes * 60 * 1000,
  supportDebugResetLinks: parseBoolean(process.env.AUTH_SUPPORT_DEBUG_RESET_LINKS, false),
  cookieSecure: isStageLikeEnv || parseBoolean(process.env.AUTH_COOKIE_SECURE, false),
  cookieSameSite: parseSameSite(process.env.AUTH_COOKIE_SAMESITE),
  frontendUrl: configuredFrontendUrl,
};

export function resolveFrontendUrl(req?: Pick<Request, 'protocol' | 'get'>): string {
  if (configuredFrontendUrl) {
    return configuredFrontendUrl;
  }

  if (req) {
    return `${req.protocol}://${req.get('host') || 'localhost:3000'}`.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}

export function buildPasswordResetLink(
  token: string,
  req?: Pick<Request, 'protocol' | 'get'>
): string {
  return `${resolveFrontendUrl(req)}/reset-password?token=${token}`;
}

export function getPasswordResetExpiresAt(): string {
  return new Date(Date.now() + authRuntimeConfig.passwordResetTtlMs).toISOString();
}

export function shouldExposeSupportResetLink(): boolean {
  return authRuntimeConfig.supportDebugResetLinks && runtimeEnv !== 'production';
}
