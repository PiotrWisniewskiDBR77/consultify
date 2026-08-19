const STORAGE_PREFIX = 'consultify.material-command.v1';

const fingerprintKey = (value: string) => {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x85ebca6b);
  }
  return `${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}`;
};

const storageKeyFor = (namespace: string, fingerprint: string) =>
  `${STORAGE_PREFIX}.${namespace}.${fingerprintKey(fingerprint)}`;

/** Reuses one idempotency key across retries and reloads in the current browser session. */
export const persistentCommandId = (namespace: string, fingerprint: string): string => {
  const storageKey = storageKeyFor(namespace, fingerprint);
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
};

/** Clears an intent only after the caller has independently read back success. */
export const clearPersistentCommandId = (namespace: string, fingerprint: string): void => {
  try {
    window.sessionStorage.removeItem(storageKeyFor(namespace, fingerprint));
  } catch {
    // Storage can be unavailable in hardened/private contexts. The command
    // remains safe; callers simply cannot extend persistence across reloads.
  }
};
