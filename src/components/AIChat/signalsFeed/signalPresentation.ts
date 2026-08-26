import type { TFunction } from 'i18next';

import type { SignalDTO, SignalSeverity } from './signalTypes';

const VALID_SEVERITIES = new Set<SignalSeverity>(['info', 'warning', 'critical', 'blocker']);

export function readSeverity(dto: SignalDTO): { value: SignalSeverity; wasCapped: boolean } {
  const raw = String(dto.severityRaw ?? '').toLowerCase() as SignalSeverity;
  if (VALID_SEVERITIES.has(raw)) return { value: raw, wasCapped: false };
  const fallback = String(dto.severity || 'INFO').toLowerCase() as SignalSeverity;
  return { value: VALID_SEVERITIES.has(fallback) ? fallback : 'info', wasCapped: true };
}

export const severityRank: Record<SignalSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
  blocker: 3,
};

const translated = (
  key: string | undefined,
  params: Record<string, unknown> | undefined,
  fallback: string,
  t: TFunction
) => {
  if (!key) return fallback;
  const frontKey = `chatSignals.rule.${key}`;
  const value = t(frontKey, { ...params, defaultValue: '' });
  return value && value !== frontKey ? value : fallback;
};

export const signalTitle = (dto: SignalDTO, t: TFunction) =>
  translated(dto.titleKey, dto.titleParams, dto.title || t('chatSignals.untitled'), t);

export const signalBody = (dto: SignalDTO, t: TFunction) =>
  translated(dto.bodyKey, dto.bodyParams, dto.body || '', t);

/**
 * FIX-5 (dyżur 26 chat-signals-front, odbiór P1.5) — wydzielone z `signalAge`
 * tak, aby dowolna data ISO (nie tylko `dto.firstObservedAt`) mogła dostać
 * ten sam, względny, PRZETŁUMACZONY zapis. Używane też przez „Skąd wiadomo"
 * (`source.evidence[].observedAt`), które wcześniej pokazywało surowy string
 * ISO zamiast czasu względnego.
 */
export function relativeTime(iso: string, now: Date, t: TFunction): string {
  const delta = Math.max(0, now.getTime() - new Date(iso).getTime());
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return t('chatSignals.age.now');
  if (minutes < 60) return t('chatSignals.age.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('chatSignals.age.hours', { count: hours });
  if (hours < 48) return t('chatSignals.age.yesterday');
  return t('chatSignals.age.days', { count: Math.floor(hours / 24) });
}

export function signalAge(dto: SignalDTO, now: Date, t: TFunction): string {
  return relativeTime(dto.firstObservedAt, now, t);
}

/**
 * FIX-5 — `refType` (task/decision/initiative/project/program, patrz
 * `server/src/types/executionVisibility.ts:SourceObjectTypeValues`) idzie
 * przez słownik `chatSignals.refType.*` zamiast surowego stringa z API.
 * Nieznana wartość ma bezpieczny fallback (sam string), zamiast pustego pola.
 */
export const refTypeLabel = (refType: string, t: TFunction): string =>
  t(`chatSignals.refType.${refType}`, { defaultValue: refType });

export const localizedSignal = (dto: SignalDTO, t: TFunction, now = new Date()) => ({
  severity: readSeverity(dto).value,
  title: signalTitle(dto, t),
  body: signalBody(dto, t),
  age: signalAge(dto, now, t),
});
