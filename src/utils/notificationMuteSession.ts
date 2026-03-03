/**
 * Session-only mute for notification types.
 *
 * This is intentionally NOT persisted in user preferences.
 * It only lives for the current browser session (sessionStorage).
 */

const STORAGE_KEY = 'consultify-muted-notification-types-session';
export const NOTIFICATION_MUTE_SESSION_CHANGED_EVENT = 'notification-mute-session-changed';

const emitChanged = () => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_MUTE_SESSION_CHANGED_EVENT));
  } catch {
    // ignore
  }
};

const safeParse = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

export const getMutedNotificationTypes = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    return safeParse(window.sessionStorage.getItem(STORAGE_KEY)).map((t) => t.toUpperCase());
  } catch {
    return [];
  }
};

export const isNotificationTypeMuted = (type?: string | null): boolean => {
  if (!type) return false;
  const t = String(type).toUpperCase();
  return getMutedNotificationTypes().includes(t);
};

export const muteNotificationTypeForSession = (type: string): void => {
  const t = String(type || '').toUpperCase();
  if (!t) return;
  if (typeof window === 'undefined') return;
  try {
    const current = new Set(getMutedNotificationTypes());
    current.add(t);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(current)));
    emitChanged();
  } catch {
    // ignore
  }
};

export const unmuteNotificationTypeForSession = (type: string): void => {
  const t = String(type || '').toUpperCase();
  if (!t) return;
  if (typeof window === 'undefined') return;
  try {
    const current = new Set(getMutedNotificationTypes());
    current.delete(t);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(current)));
    emitChanged();
  } catch {
    // ignore
  }
};

export const clearMutedNotificationTypesForSession = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    emitChanged();
  } catch {
    // ignore
  }
};
