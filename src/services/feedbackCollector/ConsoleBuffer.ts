/**
 * ConsoleBuffer
 *
 * Part of Feedback Pipeline V2 (see docs/SUPERADMIN_FEEDBACK_PIPELINE_V2_PLAN.md).
 * Keeps a ring-buffer of the last N console.* messages so that when the user
 * opens the bug report dialog we can attach them to the ticket for Cursor.
 *
 * Design rules:
 * - zero-cost when disabled (no patching applied)
 * - never throws (safe to call anywhere)
 * - never blocks original console methods
 * - caps payload size so we don't ship megabytes
 */

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export interface ConsoleEntry {
  at: string;
  level: ConsoleLevel;
  message: string;
  args?: string[];
}

const MAX_ENTRIES = 60;
const MAX_ARG_LEN = 2_000;
const MAX_MESSAGE_LEN = 1_000;

const ring: ConsoleEntry[] = [];
let installed = false;

function safeStringify(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack || ''}`;
  }
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(
      value,
      (_k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v as object)) return '[Circular]';
          seen.add(v as object);
        }
        if (typeof v === 'function') return `[fn ${v.name || 'anonymous'}]`;
        if (typeof v === 'bigint') return v.toString();
        return v;
      },
      0
    );
  } catch {
    try {
      return String(value);
    } catch {
      return '[unstringifiable]';
    }
  }
}

function push(level: ConsoleLevel, args: unknown[]) {
  if (ring.length >= MAX_ENTRIES) ring.shift();
  const rendered = args.map(safeStringify);
  const joined = rendered.join(' ').slice(0, MAX_MESSAGE_LEN);
  ring.push({
    at: new Date().toISOString(),
    level,
    message: joined,
    args: rendered.length > 1 ? rendered.map((a) => a.slice(0, MAX_ARG_LEN)) : undefined,
  });
}

export function installConsoleBuffer(): void {
  if (installed || typeof window === 'undefined' || typeof console === 'undefined') return;
  installed = true;

  const levels: ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug'];
  for (const level of levels) {
    const original = (console as any)[level] as ((...args: unknown[]) => void) | undefined;
    if (typeof original !== 'function') continue;
    (console as any)[level] = function patched(...args: unknown[]) {
      try {
        push(level, args);
      } catch {
        // swallow — telemetry must not break user console
      }
      try {
        original.apply(console, args);
      } catch {
        // ignore
      }
    };
  }
}

export function snapshotConsoleBuffer(limit = MAX_ENTRIES): ConsoleEntry[] {
  const start = Math.max(0, ring.length - limit);
  return ring.slice(start).map((entry) => ({ ...entry }));
}

export function clearConsoleBuffer(): void {
  ring.length = 0;
}
