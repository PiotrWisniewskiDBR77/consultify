/**
 * In-memory cache for GET /my-work/personal-tasks.
 * Key must vary with auth token — otherwise after login/org change the UI can keep an empty [] from a prior session.
 */

const store = new Map<string, { at: number; data: unknown[] }>();

export const PERSONAL_TASKS_CACHE_MS = 15_000;

export function makePersonalTasksCacheKey(url: string, token: string | null): string {
  const tail = token && token.length > 16 ? token.slice(-32) : token || 'anon';
  return `${url}::${tail}`;
}

export function personalTasksCacheGet(key: string): unknown[] | null {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < PERSONAL_TASKS_CACHE_MS) {
    return hit.data;
  }
  return null;
}

export function personalTasksCacheSet(key: string, data: unknown[]): void {
  store.set(key, { at: Date.now(), data });
}

export function clearPersonalTasksCache(): void {
  store.clear();
}
