import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type AuditLogSavedViewFilters,
  deleteSavedView,
  exportSavedViews,
  importSavedViews,
  listSavedViews,
  SAVED_VIEWS_MAX_PER_USER,
  SAVED_VIEWS_STORAGE_KEY,
  saveSavedView,
} from '../presentationAuditLogSavedViews';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

interface GlobalsWithStorage {
  localStorage?: Storage;
}

function installLocalStorage(): MemoryStorage {
  const fresh = new MemoryStorage();
  (globalThis as GlobalsWithStorage).localStorage = fresh;
  return fresh;
}

function uninstallLocalStorage(): void {
  delete (globalThis as GlobalsWithStorage).localStorage;
}

const USER_KEY = 'user_alpha';

const FILTERS_A: AuditLogSavedViewFilters = {
  actorTypes: ['USER', 'AI_AGENT'],
  action: 'create',
  dateFrom: '2026-04-01',
  dateTo: '2026-04-30',
};

const FILTERS_B: AuditLogSavedViewFilters = {
  actorTypes: ['SYSTEM'],
  action: null,
  dateFrom: null,
  dateTo: null,
};

describe('presentationAuditLogSavedViews', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    uninstallLocalStorage();
  });

  it('returns empty list when nothing is stored for the user', () => {
    expect(listSavedViews(USER_KEY)).toEqual([]);
  });

  it('saves a view and lists it back', () => {
    const saved = saveSavedView(USER_KEY, {
      name: 'My filter',
      filters: FILTERS_A,
    });
    expect(saved.id).toMatch(/^view_/);
    expect(saved.name).toBe('My filter');

    const list = listSavedViews(USER_KEY);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(saved.id);
    expect(list[0].filters.actorTypes).toEqual(['AI_AGENT', 'USER']);
    expect(list[0].filters.action).toBe('create');
  });

  it('throws NAME_TAKEN when a different id collides on name (case-insensitive)', () => {
    saveSavedView(USER_KEY, { name: 'Shared Name', filters: FILTERS_A });
    expect(() => saveSavedView(USER_KEY, { name: 'shared name', filters: FILTERS_B })).toThrowError(
      'NAME_TAKEN'
    );
  });

  it('updates an existing view by id without changing list size', () => {
    const v1 = saveSavedView(USER_KEY, { name: 'Alpha', filters: FILTERS_A });
    saveSavedView(USER_KEY, { name: 'Beta', filters: FILTERS_B });

    const updated = saveSavedView(USER_KEY, {
      id: v1.id,
      name: 'Alpha v2',
      filters: { ...FILTERS_A, action: 'update' },
    });

    const list = listSavedViews(USER_KEY);
    expect(list).toHaveLength(2);
    expect(updated.id).toBe(v1.id);
    expect(list.find((v) => v.id === v1.id)?.name).toBe('Alpha v2');
    expect(list.find((v) => v.id === v1.id)?.filters.action).toBe('update');
  });

  it('throws LIMIT_REACHED when bucket has 20 views and a new one is added', () => {
    for (let i = 0; i < SAVED_VIEWS_MAX_PER_USER; i += 1) {
      saveSavedView(USER_KEY, {
        name: `View ${String(i).padStart(2, '0')}`,
        filters: FILTERS_A,
      });
    }
    expect(listSavedViews(USER_KEY)).toHaveLength(SAVED_VIEWS_MAX_PER_USER);
    expect(() => saveSavedView(USER_KEY, { name: 'Overflow', filters: FILTERS_A })).toThrowError(
      'LIMIT_REACHED'
    );
  });

  it('delete is idempotent and tolerates missing ids', () => {
    const v = saveSavedView(USER_KEY, { name: 'Deletable', filters: FILTERS_A });
    expect(listSavedViews(USER_KEY)).toHaveLength(1);

    deleteSavedView(USER_KEY, v.id);
    expect(listSavedViews(USER_KEY)).toHaveLength(0);

    expect(() => deleteSavedView(USER_KEY, v.id)).not.toThrow();
    expect(() => deleteSavedView(USER_KEY, 'view_does_not_exist')).not.toThrow();
  });

  it('exports and re-imports preserving filters', () => {
    saveSavedView(USER_KEY, { name: 'Alpha', filters: FILTERS_A });
    saveSavedView(USER_KEY, { name: 'Beta', filters: FILTERS_B });

    const json = exportSavedViews(USER_KEY);
    installLocalStorage();

    const result = importSavedViews(USER_KEY, json);
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);

    const list = listSavedViews(USER_KEY);
    expect(list.map((v) => v.name).sort()).toEqual(['Alpha', 'Beta']);
    const alpha = list.find((v) => v.name === 'Alpha');
    expect(alpha?.filters.actorTypes).toEqual(['AI_AGENT', 'USER']);
    expect(alpha?.filters.action).toBe('create');
    expect(alpha?.filters.dateFrom).toBe('2026-04-01');
    expect(alpha?.filters.dateTo).toBe('2026-04-30');
  });

  it('import dedupes by name (case-insensitive) against existing bucket', () => {
    saveSavedView(USER_KEY, { name: 'Existing', filters: FILTERS_A });

    const payload = JSON.stringify({
      version: 1,
      views: [
        {
          id: 'view_x',
          name: 'existing',
          createdAt: new Date().toISOString(),
          filters: FILTERS_B,
        },
        {
          id: 'view_y',
          name: 'Brand New',
          createdAt: new Date().toISOString(),
          filters: FILTERS_B,
        },
      ],
    });

    const result = importSavedViews(USER_KEY, payload);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);

    const list = listSavedViews(USER_KEY);
    expect(list.map((v) => v.name).sort()).toEqual(['Brand New', 'Existing']);
  });

  it('degrades gracefully when localStorage is unavailable', () => {
    uninstallLocalStorage();

    expect(listSavedViews(USER_KEY)).toEqual([]);

    expect(() => saveSavedView(USER_KEY, { name: 'Hidden', filters: FILTERS_A })).not.toThrow();

    expect(() => deleteSavedView(USER_KEY, 'view_anything')).not.toThrow();

    expect(listSavedViews(USER_KEY)).toEqual([]);

    const exported = exportSavedViews(USER_KEY);
    expect(JSON.parse(exported).views).toEqual([]);

    expect(() => importSavedViews(USER_KEY, JSON.stringify({ views: [] }))).not.toThrow();
  });

  it('persists across calls under the same storage key', () => {
    const storage = installLocalStorage();
    saveSavedView(USER_KEY, { name: 'Persisted', filters: FILTERS_A });
    const raw = storage.getItem(SAVED_VIEWS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed[USER_KEY]).toBeDefined();
    expect(parsed[USER_KEY]).toHaveLength(1);
  });
});
