/**
 * Saved-view presets for the Consultify Audit Log modal.
 *
 * Storage layout (under key `consultify.auditLog.savedViews.v1`):
 *   { [userKey: string]: AuditLogSavedView[] }
 *
 * Saved views are PURELY local to the browser. Cross-user sharing of an
 * audit-log filter set is handled by the URL-param "Copy share link" flow.
 *
 * All public functions are defensive: if `localStorage` is unavailable
 * (SSR, private mode, throwing access), reads return [] and writes
 * silently no-op. Callers should not rely on success.
 */

export interface AuditLogSavedViewFilters {
  actorTypes: string[];
  action: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface AuditLogSavedView {
  id: string;
  name: string;
  createdAt: string;
  filters: AuditLogSavedViewFilters;
}

export interface SavedViewsBucket {
  userKey: string;
  views: AuditLogSavedView[];
}

export const SAVED_VIEWS_STORAGE_KEY = 'consultify.auditLog.savedViews.v1';
export const SAVED_VIEWS_MAX_PER_USER = 20;
export const SAVED_VIEWS_NAME_MAX_LENGTH = 40;
const SHARED_BUCKET_KEY = '__shared__';

type SavedViewsStore = Record<string, AuditLogSavedView[]>;

function resolveUserKey(userKey: string | null | undefined): string {
  if (typeof userKey !== 'string') return SHARED_BUCKET_KEY;
  const trimmed = userKey.trim();
  return trimmed.length > 0 ? trimmed : SHARED_BUCKET_KEY;
}

function getStorage(): Storage | null {
  try {
    if (typeof globalThis === 'undefined') return null;
    const candidate = (globalThis as { localStorage?: Storage }).localStorage;
    if (!candidate) return null;
    // Probe so quota / SecurityError are detected up front.
    const probeKey = '__consultify_audit_views_probe__';
    candidate.setItem(probeKey, '1');
    candidate.removeItem(probeKey);
    return candidate;
  } catch {
    return null;
  }
}

function readStore(storage: Storage): SavedViewsStore {
  let raw: string | null = null;
  try {
    raw = storage.getItem(SAVED_VIEWS_STORAGE_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: SavedViewsStore = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        out[k] = v.filter(isWellFormedView);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(storage: Storage, store: SavedViewsStore): void {
  try {
    storage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota / serialization errors are swallowed by contract.
  }
}

function isWellFormedView(value: unknown): value is AuditLogSavedView {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.name !== 'string') return false;
  if (typeof v.createdAt !== 'string') return false;
  const f = v.filters as Record<string, unknown> | undefined;
  if (!f || typeof f !== 'object') return false;
  if (!Array.isArray(f.actorTypes)) return false;
  if (!f.actorTypes.every((a) => typeof a === 'string')) return false;
  if (f.action !== null && typeof f.action !== 'string') return false;
  if (f.dateFrom !== null && typeof f.dateFrom !== 'string') return false;
  if (f.dateTo !== null && typeof f.dateTo !== 'string') return false;
  return true;
}

function normalizeActorTypes(actorTypes: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const a of actorTypes) {
    if (typeof a === 'string' && a.trim()) seen.add(a.trim());
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

function normalizeFilters(filters: AuditLogSavedViewFilters): AuditLogSavedViewFilters {
  return {
    actorTypes: normalizeActorTypes(filters.actorTypes),
    action: filters.action && filters.action.length > 0 ? filters.action : null,
    dateFrom: filters.dateFrom && filters.dateFrom.length > 0 ? filters.dateFrom : null,
    dateTo: filters.dateTo && filters.dateTo.length > 0 ? filters.dateTo : null,
  };
}

function sortByName(views: AuditLogSavedView[]): AuditLogSavedView[] {
  return [...views].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

function generateViewId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffffffff).toString(36);
  return `view_${ts}_${rand}`;
}

export function isSavedViewsStorageAvailable(): boolean {
  return getStorage() !== null;
}

export function listSavedViews(userKey: string): AuditLogSavedView[] {
  const storage = getStorage();
  if (!storage) return [];
  const key = resolveUserKey(userKey);
  const store = readStore(storage);
  const bucket = store[key] ?? [];
  return sortByName(bucket).slice(0, SAVED_VIEWS_MAX_PER_USER);
}

export interface SaveSavedViewInput {
  id?: string;
  name: string;
  filters: AuditLogSavedViewFilters;
}

export function saveSavedView(
  userKey: string,
  view: SaveSavedViewInput
): AuditLogSavedView {
  const trimmedName = (view.name ?? '').trim();
  if (trimmedName.length < 1 || trimmedName.length > SAVED_VIEWS_NAME_MAX_LENGTH) {
    throw new Error('NAME_INVALID');
  }
  const storage = getStorage();
  const key = resolveUserKey(userKey);

  const filters = normalizeFilters(view.filters);

  // No storage: still return a synthetic view object so the caller can
  // reflect the state in memory if it wants to. Persistence is a no-op.
  if (!storage) {
    return {
      id: view.id ?? generateViewId(),
      name: trimmedName,
      createdAt: new Date().toISOString(),
      filters,
    };
  }

  const store = readStore(storage);
  const bucket = store[key] ?? [];

  const lowerName = trimmedName.toLowerCase();
  const duplicateIdx = bucket.findIndex(
    (v) => v.name.toLowerCase() === lowerName && v.id !== view.id
  );
  if (duplicateIdx >= 0) {
    throw new Error('NAME_TAKEN');
  }

  if (view.id) {
    const idx = bucket.findIndex((v) => v.id === view.id);
    if (idx >= 0) {
      const updated: AuditLogSavedView = {
        ...bucket[idx],
        name: trimmedName,
        filters,
      };
      const nextBucket = [...bucket];
      nextBucket[idx] = updated;
      store[key] = nextBucket;
      writeStore(storage, store);
      return updated;
    }
    // id supplied but not found: fall through and treat as a new insert.
  }

  if (bucket.length >= SAVED_VIEWS_MAX_PER_USER) {
    throw new Error('LIMIT_REACHED');
  }

  const created: AuditLogSavedView = {
    id: view.id ?? generateViewId(),
    name: trimmedName,
    createdAt: new Date().toISOString(),
    filters,
  };
  store[key] = [...bucket, created];
  writeStore(storage, store);
  return created;
}

export function deleteSavedView(userKey: string, viewId: string): void {
  const storage = getStorage();
  if (!storage) return;
  const key = resolveUserKey(userKey);
  const store = readStore(storage);
  const bucket = store[key];
  if (!bucket || bucket.length === 0) return;
  const next = bucket.filter((v) => v.id !== viewId);
  if (next.length === bucket.length) return;
  store[key] = next;
  writeStore(storage, store);
}

export function exportSavedViews(userKey: string): string {
  const views = listSavedViews(userKey);
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      views,
    },
    null,
    2
  );
}

export interface ImportSavedViewsResult {
  added: number;
  skipped: number;
}

export function importSavedViews(
  userKey: string,
  json: string
): ImportSavedViewsResult {
  const parsed = JSON.parse(json);
  const incoming = extractIncomingViews(parsed);
  if (!incoming) throw new Error('INVALID_PAYLOAD');

  const storage = getStorage();
  if (!storage) return { added: 0, skipped: incoming.length };

  const key = resolveUserKey(userKey);
  const store = readStore(storage);
  const bucket = store[key] ?? [];
  const existingNames = new Set(bucket.map((v) => v.name.toLowerCase()));
  const seenInBatch = new Set<string>();

  let added = 0;
  let skipped = 0;
  const next: AuditLogSavedView[] = [...bucket];

  for (const candidate of incoming) {
    if (next.length >= SAVED_VIEWS_MAX_PER_USER) {
      skipped += 1;
      continue;
    }
    const name = (candidate.name ?? '').trim();
    if (name.length < 1 || name.length > SAVED_VIEWS_NAME_MAX_LENGTH) {
      skipped += 1;
      continue;
    }
    const lower = name.toLowerCase();
    if (existingNames.has(lower) || seenInBatch.has(lower)) {
      skipped += 1;
      continue;
    }
    seenInBatch.add(lower);
    const filters = normalizeFilters(candidate.filters);
    next.push({
      id: generateViewId(),
      name,
      createdAt: new Date().toISOString(),
      filters,
    });
    added += 1;
  }

  if (added > 0) {
    store[key] = next;
    writeStore(storage, store);
  }
  return { added, skipped };
}

function extractIncomingViews(parsed: unknown): AuditLogSavedView[] | null {
  if (!parsed) return null;
  if (Array.isArray(parsed)) {
    return parsed.filter(isWellFormedView);
  }
  if (typeof parsed === 'object') {
    const maybe = (parsed as { views?: unknown }).views;
    if (Array.isArray(maybe)) return maybe.filter(isWellFormedView);
  }
  return null;
}

export function findMatchingSavedView(
  views: readonly AuditLogSavedView[],
  filters: AuditLogSavedViewFilters
): AuditLogSavedView | null {
  const target = normalizeFilters(filters);
  for (const v of views) {
    const f = normalizeFilters(v.filters);
    if (
      f.action === target.action &&
      f.dateFrom === target.dateFrom &&
      f.dateTo === target.dateTo &&
      f.actorTypes.length === target.actorTypes.length &&
      f.actorTypes.every((a, i) => a === target.actorTypes[i])
    ) {
      return v;
    }
  }
  return null;
}
