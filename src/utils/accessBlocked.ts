/**
 * S1.14b/B2 — one sentence per access-block code, from the i18n catalog.
 *
 * Measured on staging 13.09: the AI chat bubble rendered the raw machine code
 * ("⚠️ Access blocked (TRIAL_PROFILE_INCOMPLETE).") because the streaming branch
 * built its text by string-interpolating `data.code`. Every surface that has to
 * name an access block now reads the same `access.blocked.<CODE>` key (present in
 * en AND pl), and falls back to `access.blocked.default` for an unknown code —
 * never to the code itself.
 *
 * The translator is INJECTED (same shape as `getAiErrorLine` in
 * aiProviderErrorCopy.ts) rather than imported here: this module is pulled in by
 * leaf utilities, and a static `@/i18n` import would drag the i18next runtime
 * into module graphs that deliberately mock react-i18next.
 */
type AccessBlockedT = (key: string, options?: { defaultValue?: string }) => unknown;

export function accessBlockedSentence(t: AccessBlockedT, code: unknown): string {
  const normalized = String(code || '').trim();
  const raw = normalized ? t(`access.blocked.${normalized}`, { defaultValue: '' }) : '';
  const fromCatalog = typeof raw === 'string' ? raw.trim() : '';
  if (fromCatalog) return fromCatalog;
  const fallback = t('access.blocked.default', { defaultValue: 'Access is blocked.' });
  return typeof fallback === 'string' && fallback.trim()
    ? fallback
    : 'Access is blocked.';
}

export type AccessBlockedPayload = {
  code?: string;
  error?: string;
  errorCode?: string;
  message?: string;
  messageEn?: string;
  cta?: {
    label?: string;
    labelKey?: string;
    href?: string;
    path?: string;
  };
};

export const HIGH_RISK_ACCESS_BLOCKED_CODES = [
  'TRIAL_INVITES_DISABLED',
  'TRIAL_UPLOAD_DISABLED',
  'TRIAL_EXPORT_DISABLED',
  'PUBLIC_SHARE_DISABLED',
  'TRIAL_AI_MEMORY_DISABLED',
  'AI_AUTOPILOT_DISABLED',
] as const;

export const DEFAULT_ACCESS_BLOCKED_CODES = [
  'TRIAL_PROFILE_INCOMPLETE',
  'TRIAL_ENTRY_RESTRICTION',
  'TRIAL_EXPIRED',
  'AI_LIMIT_REACHED',
  'AI_TOKEN_BUDGET_EXCEEDED',
  'INSUFFICIENT_TOKENS',
  'DEMO_READ_ONLY',
  // OPS-DEMO-002: the demo principal's session lapsed, or its workspace header no
  // longer matches an active session. Unregistered codes are dropped silently by
  // `dispatchAccessBlocked`, which would leave the user staring at a dead screen.
  'DEMO_SESSION_EXPIRED',
  'DEMO_SESSION_INVALID',
  'FEATURE_ACCESS_DENIED',
  ...HIGH_RISK_ACCESS_BLOCKED_CODES,
] as const;

const ACCESS_BLOCKED_CODE_SET = new Set<string>(DEFAULT_ACCESS_BLOCKED_CODES);

export function getAccessBlockedCode(data: AccessBlockedPayload | null | undefined): string {
  const featureAccessDenied = data?.error === 'FEATURE_ACCESS_DENIED';
  return String(
    featureAccessDenied ? 'FEATURE_ACCESS_DENIED' : data?.code || data?.errorCode || ''
  );
}

export function isAccessBlockedCode(code: unknown): boolean {
  return ACCESS_BLOCKED_CODE_SET.has(String(code || ''));
}

export function dispatchAccessBlocked(data: AccessBlockedPayload, defaultMessage: string): void {
  if (typeof window === 'undefined') return;
  const code = getAccessBlockedCode(data);
  if (!isAccessBlockedCode(code)) return;

  window.dispatchEvent(
    new CustomEvent('access:blocked', {
      detail: {
        code,
        message: data.message || data.messageEn || data.error || defaultMessage,
        cta: data.cta
          ? {
              label: data.cta.label,
              labelKey: data.cta.labelKey,
              href: data.cta.href || data.cta.path,
            }
          : undefined,
      },
    })
  );
}
