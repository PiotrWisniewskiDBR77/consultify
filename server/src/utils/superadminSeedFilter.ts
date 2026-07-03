/**
 * Super Admin — non-destructive seed/demo filtering for list views.
 *
 * Context: the Super Admin "Customers" lists (users + organizations) were
 * dominated by seed/test data — ~2900 `@demo.ateliertoys.com` accounts, a
 * `@local.test` fixture set, and hundreds of ephemeral `demo-org-session-*`
 * orgs created per demo session. Those rows LOOK real (plausible names/emails)
 * which is exactly why they are noise: an operator can't tell a real customer
 * from a seed record at a glance.
 *
 * This filter is a VIEW concern only — it hides seed rows from the default
 * listing. It NEVER deletes anything: pass `?includeSeed=true` to get the full
 * unfiltered set back (QA, audits, "show everything"). Fully reversible.
 *
 * Implementation note: uses LIKE on the email/org-id columns rather than
 * Postgres-only SPLIT_PART, so it runs identically on the pg backend and the
 * mock/sqlite adapter used in tests. COALESCE guards NULL emails/org-ids so a
 * real row with a missing email is never dropped by NULL-propagation through
 * the NOT(...) wrapper.
 */

/** Email domains that only ever belong to seed/demo/test fixtures. */
export const SEED_EMAIL_DOMAINS: readonly string[] = [
  'demo.ateliertoys.com',
  'ateliertoys-demo.com',
  'local.test',
  'test.com',
  'test.local',
  'example.com',
  'demo.com',
  'demo.local',
  'demo.ai',
  'consultify.local',
  'dbr77-e2e.test',
  'iris.internal',
];

/** SQL LIKE patterns for organization ids that are ephemeral demo scaffolding. */
export const EPHEMERAL_ORG_ID_PATTERNS: readonly string[] = ['demo-org-session-%'];

/**
 * True only when the caller EXPLICITLY opts in to seeing seed rows
 * (`?includeSeed=1|true|yes|on`). Default (absent) → filter seed out.
 */
export function isSeedRequested(query: Record<string, unknown> | undefined): boolean {
  if (!query) return false;
  const raw = query.includeSeed ?? query.include_seed ?? query.showSeed;
  if (raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export interface SeedExclusion {
  /** SQL boolean expression that is TRUE for NON-seed rows. Empty when nothing to filter. */
  clause: string;
  /** Bound parameters for the `?` placeholders inside `clause`, in order. */
  params: string[];
}

/**
 * Build a WHERE predicate that EXCLUDES seed/test rows.
 *
 * @param emailCol fully-qualified email column (e.g. `u.email`); omit to skip email filtering
 * @param orgIdCol fully-qualified org-id column (e.g. `u.organization_id` or `o.id`); omit to skip
 */
export function buildSeedExclusion(opts: { emailCol?: string; orgIdCol?: string }): SeedExclusion {
  const ors: string[] = [];
  const params: string[] = [];

  if (opts.emailCol) {
    for (const domain of SEED_EMAIL_DOMAINS) {
      ors.push(`LOWER(COALESCE(${opts.emailCol}, '')) LIKE ?`);
      params.push(`%@${domain.toLowerCase()}`);
    }
  }

  if (opts.orgIdCol) {
    for (const pattern of EPHEMERAL_ORG_ID_PATTERNS) {
      ors.push(`COALESCE(${opts.orgIdCol}, '') LIKE ?`);
      params.push(pattern);
    }
  }

  if (ors.length === 0) return { clause: '', params: [] };
  return { clause: `NOT (${ors.join(' OR ')})`, params };
}
