/**
 * Module 12 (Audyty — Audit Orchestrator) — kill-switch for the not-yet-wired
 * "Edit program" affordance.
 *
 * Decision DP-5 (Harvard/wdrozenie-100/M12-audyty.md, D-01 → DP-5):
 * the program-edit surface (a PATCH `/audit/programs/:id` round-trip via
 * `updateProgram` in src/components/Audit/auditApi.ts) has a working backend but
 * NO frontend screen calling it — an orphaned client wrapper, not a rendered
 * dead CTA. Rather than half-building an edit modal, the edit surface stays
 * hidden behind a flag + label until it is built end-to-end. The wired actions
 * (Create program, Generate surveys, Delete) stay visible regardless.
 *
 * This is a SEPARATE flag from the Initiatives bulk stub
 * (src/utils/initiativesBulkStubFlag.ts) by design — do NOT import that one.
 *
 * Where this flag gates
 * ---------------------
 *   * Any future "Edit program" CTA in AuditsHub must render only when ON.
 *   * `isAuditProgramEditEnabled()` also documents that the orphan
 *     `updateProgram` client wrapper is intentionally gated, not forgotten.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_auditProgramEdit=0|1` — operator bypass for staging.
 *   2. `localStorage["ff.audit_program_edit"]` — user / org override.
 *   3. `import.meta.env.VITE_AUDIT_PROGRAM_EDIT` — build-time default.
 *   4. Default: OFF. Flip this ON only once the edit screen is wired to
 *      `updateProgram` and verified.
 */

const LS_KEY = 'ff.audit_program_edit';
const QUERY_KEY = 'ff_auditProgramEdit';
const ENV_KEY = 'VITE_AUDIT_PROGRAM_EDIT';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
    return parsed === null ? false : parsed;
  } catch {
    return false;
  }
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

export function isAuditProgramEditEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AUDIT_PROGRAM_EDIT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
