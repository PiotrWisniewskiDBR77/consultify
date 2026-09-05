import type { I18nMessageDto } from '@/services/api';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function translateOperatorMessage(
  message: I18nMessageDto | string | null | undefined,
  t: Translate
): string {
  if (!message) return '';
  if (typeof message === 'string') return message;
  const params = Object.fromEntries(
    Object.entries(message.params || {}).filter(([, value]) => value !== null)
  );
  return t(message.key, params);
}
