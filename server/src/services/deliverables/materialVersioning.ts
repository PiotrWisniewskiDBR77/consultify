/**
 * materialVersioning (F6.3) — wersjonowanie + rollback + RBAC.
 *
 * Domyka trójkę cyklu życia (F6.1 stany + F6.2 warstwy + F6.3 wersje/role):
 *   - append-only historia wersji (snapshot treści + stan + kto/kiedy)
 *   - rollback = operacja DO PRZODU (nowa wersja przywracająca stary snapshot;
 *     historii nie kasujemy — audytowalność)
 *   - RBAC: kto może edytować / akceptować / wysyłać (macierz ról × akcja)
 *
 * Czyste funkcje, deterministyczne, nigdy nie rzucają. Timestamp wstrzykiwalny
 * (testy deterministyczne).
 */

import type { MaterialState } from './materialLifecycle.js';

export type MaterialRole = 'owner' | 'editor' | 'reviewer' | 'viewer';
export type MaterialAction = 'edit' | 'submit' | 'authorize' | 'send' | 'rollback' | 'view';

// Macierz uprawnień: rola → dozwolone akcje.
const ROLE_ACTIONS: Record<MaterialRole, ReadonlySet<MaterialAction>> = {
  owner: new Set(['edit', 'submit', 'authorize', 'send', 'rollback', 'view']),
  editor: new Set(['edit', 'submit', 'rollback', 'view']),
  reviewer: new Set(['authorize', 'view']),
  viewer: new Set(['view']),
};

/** Czy rola ma uprawnienie do akcji? */
export function can(role: MaterialRole, action: MaterialAction): boolean {
  return ROLE_ACTIONS[role]?.has(action) ?? false;
}

export interface MaterialVersion<S = unknown> {
  version: number; // 1-based, monotoniczny
  state: MaterialState;
  snapshot: S; // migawka treści
  createdBy: string;
  createdAt: string; // ISO
  /** Jeśli ta wersja powstała z rollbacku — z której wersji przywrócono. */
  rolledBackFrom?: number;
}

/** Dołącz nową wersję (immutable). version = max+1. */
export function commitVersion<S>(
  history: MaterialVersion<S>[],
  snapshot: S,
  state: MaterialState,
  createdBy: string,
  at: string = new Date().toISOString()
): MaterialVersion<S>[] {
  const nextVersion = (history.length === 0 ? 0 : history[history.length - 1].version) + 1;
  const entry: MaterialVersion<S> = { version: nextVersion, state, snapshot, createdBy, createdAt: at };
  return [...history, entry];
}

/** Najnowsza wersja (lub null). */
export function latestVersion<S>(history: MaterialVersion<S>[]): MaterialVersion<S> | null {
  return history.length ? history[history.length - 1] : null;
}

/** Znajdź wersję po numerze. */
export function getVersion<S>(history: MaterialVersion<S>[], version: number): MaterialVersion<S> | null {
  return history.find((v) => v.version === version) ?? null;
}

export interface RollbackResult<S> {
  ok: boolean;
  history: MaterialVersion<S>[]; // niezmieniona przy błędzie
  error?: string;
}

/**
 * Rollback do wersji `toVersion`: tworzy NOWĄ wersję ze snapshotem starej
 * (historia rośnie, nic nie kasujemy). Wymaga uprawnienia `rollback`.
 * Nie wolno rollbackować, gdy najnowsza wersja jest `sent` (zamknięta).
 */
export function rollbackTo<S>(
  history: MaterialVersion<S>[],
  toVersion: number,
  role: MaterialRole,
  by: string,
  at: string = new Date().toISOString()
): RollbackResult<S> {
  if (!can(role, 'rollback')) {
    return { ok: false, history, error: `Role "${role}" cannot rollback` };
  }
  const target = getVersion(history, toVersion);
  if (!target) {
    return { ok: false, history, error: `Version ${toVersion} not found` };
  }
  const latest = latestVersion(history);
  if (latest && latest.state === 'sent') {
    return { ok: false, history, error: 'Latest version is sent (locked) — cannot rollback' };
  }
  const nextVersion = (latest?.version ?? 0) + 1;
  const restored: MaterialVersion<S> = {
    version: nextVersion,
    state: target.state,
    snapshot: target.snapshot,
    createdBy: by,
    createdAt: at,
    rolledBackFrom: toVersion,
  };
  return { ok: true, history: [...history, restored] };
}
