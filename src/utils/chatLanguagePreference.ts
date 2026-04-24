import { isValidLanguage, normalizeLanguageCode, type SupportedLanguage } from '@/i18n';

const LEGACY_KEY = 'consultinity-preferred-chat-lang';
const CANONICAL_KEY = 'consultify-preferred-chat-lang';

function normalizeChatLanguage(input: unknown): SupportedLanguage | null {
  const base = String(input || '')
    .trim()
    .split('-')[0];
  const normalized = normalizeLanguageCode(base) || base;
  return isValidLanguage(normalized) ? (normalized as SupportedLanguage) : null;
}

export function readPreferredChatLanguage(fallback?: unknown): SupportedLanguage | null {
  const fromStorage =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(CANONICAL_KEY) || localStorage.getItem(LEGACY_KEY)
      : null;

  return normalizeChatLanguage(fromStorage) || normalizeChatLanguage(fallback) || null;
}
