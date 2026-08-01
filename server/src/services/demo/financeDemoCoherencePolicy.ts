/**
 * FIN-005 — policy for deciding which Finance rows belong in the demo tenant.
 *
 * Extracted from the cleanup script on purpose: this is a product rule about
 * what a client-facing demo may show, so it must be readable and unit-tested,
 * not buried in an operations script. `server/scripts/finance-demo-coherence-cleanup.ts`
 * is the only caller that acts on it.
 *
 * The rule has a primary criterion and a secondary signal, and the difference
 * matters:
 *
 * - **Primary (decides):** a row is canonical when its id carries the demo
 *   seed's stable-id prefix `<orgId>--`, produced by
 *   `makeId(orgId, entity, slug)`. This is name-independent, so renaming a
 *   record cannot smuggle it in or out.
 * - **Secondary (informs only):** name flags such as `DBR77`, `Apator`,
 *   `staging` or `(kopia)`. These are reported so a human can see WHY a row
 *   looks wrong, but they never decide on their own — a name-only rule would
 *   both miss unnamed leftovers and risk catching a legitimate record whose
 *   title happens to contain a flagged word.
 */

/** Name patterns observed in the demo tenant on 2026-08-01. Advisory only. */
export const FINANCE_DEMO_NAME_FLAGS: ReadonlyArray<{ flag: string; pattern: RegExp }> = [
  { flag: 'DBR77', pattern: /\bDBR\s*77\b/i },
  { flag: 'Apator', pattern: /\bapator\b/i },
  { flag: 'staging', pattern: /\bstaging\b/i },
  { flag: 'ui-duplicate', pattern: /\((?:kopia|copy)(?:\s+\d+)?\)/i },
  { flag: 'technical-seed', pattern: /\b(?:seed|fixture|m16|smoke|e2e)\b/i },
];

/**
 * True when the row was written by the canonical demo seed for this tenant.
 *
 * Mirrors `makeId(orgId, entity, slug)` = `${orgId}--${entity}--${slug}` used by
 * `demoSeedService` and `atelierFinanceSeed`.
 */
export function isCanonicalDemoRowId(id: unknown, organizationId: string): boolean {
  const normalizedId = String(id ?? '').trim();
  const normalizedOrg = String(organizationId ?? '').trim();
  if (!normalizedId || !normalizedOrg) return false;
  // The `--` separator must be present, otherwise an org id that is a prefix of
  // another (`demo` vs `demo-org`) would classify foreign rows as canonical.
  return normalizedId.startsWith(`${normalizedOrg}--`);
}

/** Advisory flags for a customer-visible name. Empty when nothing looks off. */
export function financeDemoNameFlags(name: unknown): string[] {
  const value = String(name ?? '');
  if (!value.trim()) return [];
  return FINANCE_DEMO_NAME_FLAGS.filter(({ pattern }) => pattern.test(value)).map(
    ({ flag }) => flag
  );
}

export interface FinanceDemoRow {
  table: string;
  id: string;
  displayName: string;
}

export interface FinanceDemoClassification extends FinanceDemoRow {
  /** Written by the canonical seed for this tenant — must never be quarantined. */
  canonical: boolean;
  /** Advisory name signals; corroboration for a human reviewer. */
  flags: string[];
}

/** Classify one tenant's Finance rows into canonical and foreign. */
export function classifyFinanceDemoRows(
  rows: FinanceDemoRow[],
  organizationId: string
): {
  canonical: FinanceDemoClassification[];
  foreign: FinanceDemoClassification[];
  all: FinanceDemoClassification[];
} {
  const all = (rows || []).map((row) => ({
    ...row,
    canonical: isCanonicalDemoRowId(row.id, organizationId),
    flags: financeDemoNameFlags(row.displayName),
  }));

  return {
    all,
    canonical: all.filter((row) => row.canonical),
    foreign: all.filter((row) => !row.canonical),
  };
}
