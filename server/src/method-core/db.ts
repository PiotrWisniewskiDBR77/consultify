/**
 * Shared Method Kernel — small persistence helpers.
 *
 * `DbPromise.run()` in this repo defaults to `fallback: true`, which
 * SWALLOWS SQL errors and resolves `{ success: false }` instead of
 * rejecting — a documented defect (see MEMORY handoffs, e.g.
 * "DbPromise.run() połyka błędy przy ZAPISIE"). Every kernel write goes
 * through `runOrThrow` below so a broken statement surfaces as a thrown
 * error, never a silent no-op.
 */

import { randomUUID, createHash } from 'node:crypto';
import * as DbPromise from '../utils/DbPromise.js';

export function genId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function runOrThrow(
  sql: string,
  params: unknown[]
): Promise<{ lastID?: number; changes?: number }> {
  const result = await DbPromise.run(sql, params, { fallback: false });
  if (!result.success) {
    throw new Error(
      `method-core: SQL write failed: ${result.error ?? 'unknown error'} — ${sql.slice(0, 160)}`
    );
  }
  return result;
}

/**
 * Postgres unique_violation. Used to detect a lost idempotency race against
 * the partial unique index on method_events(session_id, idempotency_key).
 */
export function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: unknown }).code === '23505';
}

/**
 * The mock test database (server/src/database/Database.ts) returns JSONB
 * columns verbatim (whatever was passed as the query param — usually the
 * JSON string we sent), while real Postgres deserializes `json`/`jsonb`
 * columns back into objects automatically. This tolerates both.
 */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/**
 * Deterministic content hash. Documented defect this avoids: an UPDATE/read
 * without ORDER BY plus float concatenation produced 6-7 different hashes
 * across 10 runs of a prior kernel-adjacent feature. Fix used here: sort
 * every object/array IN MEMORY (never rely on SQL ORDER BY for anything
 * that feeds a hash) before serializing, and never fold a float into the
 * hashed representation — payloads hashed by this kernel are event/session
 * records (ids, enums, ISO timestamps, strings), not aggregated numerics.
 */
export function computeContentHash(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValueDeep(value));
}

function sortValueDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValueDeep);
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const key of sortedKeys) out[key] = sortValueDeep(obj[key]);
    return out;
  }
  return value;
}
