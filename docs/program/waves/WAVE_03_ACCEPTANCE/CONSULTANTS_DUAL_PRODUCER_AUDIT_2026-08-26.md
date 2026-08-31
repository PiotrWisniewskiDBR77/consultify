# `consultants` table — dual-producer audit (DEC-116 family, 2026-08-26)

Follow-up of the DEC-116 NO_MIGRATION investigation
(`OWNER_DECISION_LEDGER_2026-08-24.md`, entry `DEC-2026-08-26-116`; ledger lives in the
recovery-vault worktree, not on this branch). Same landmine class as the
`security_settings` dual-producer bug found earlier in this audit family: one table
name, two incompatible producers/schemas in the live codebase.

## Verdict (TL;DR)

**Neither producer is live. The Consultant-Mode shape (Producer B) is the authoritative
schema; the marketplace shape (Producer A) has no DDL anywhere in the repo and is wrong
on every database that could ever exist.** The table `consultants` does not exist on the
live demo database at all. No code change was made in this audit — resolution options
and a recommended fix are documented below for a supervised follow-up.

## The two producers

| | Producer A — marketplace | Producer B — Consultant Mode |
|---|---|---|
| File | `server/src/routes/consultants.routes.ts` | `server/src/services/consultantService.ts` (`registerConsultant`, ~line 179) |
| INSERT shape | `(id, organization_id, user_id, specialization, hourly_rate, availability, rating, created_at)` | `(id, display_name, status)` with `id = user_id`, `ON CONFLICT(id) DO UPDATE` |
| Matching DDL in repo | **none** — no migration anywhere creates this shape | `server/migrations/never-ran/017_consultant_mode.sql.sql` AND `server/migrations-v2/001_baseline_20260413.sql` line 8757 (`id, status, display_name, created_at`) |
| Reachability today | Behind `enableStubRoutes` (Gateway.ts:477 — `!isProduction \|\| ENABLE_STUB_ROUTES==='true'`). On Railway prod `ENABLE_STUB_ROUTES` is **unset** → the whole `/api/consultants` prefix is mounted as an honest 501 (Gateway.ts:507/994, `STUB_NAMES_WITH_LIVE_UI_ON_DEMO`). Reachable only in dev. | **Zero importers** of `consultantService` anywhere in `server/src` or `tests/` (only the dead `_backup/ts-js-collisions` shim and `dist/`). Entirely dead code — same result as the earlier `consultant_org_links` CRUD grep in this audit family. |

## Answers to the four investigation questions

### 1. What exists on demo/staging today

Read-only probe against the live Railway production database (2026-08-26, node+pg,
`to_regclass` + `information_schema` only, per the DEC-65 read-only rule):

```
to_regclass('public.consultants')          → null
to_regclass('public.consultant_org_links') → null
to_regclass('public.consultant_invites')   → null
```

**No consultant table of either shape exists on demo.** Confirms the NO_MIGRATION
classification. Note the discrepancy: the migrations-v2 baseline
(`001_baseline_20260413.sql`) *does* `CREATE TABLE IF NOT EXISTS public.consultants`
in the Consultant-Mode shape — so the baseline's dump source had run 017 at some point,
but the live demo DB never did (the runtime migration runner reads `server/migrations/`
top-level only; `never-ran/` is not picked up). A **fresh DB built from the v2 baseline
therefore HAS `consultants` (shape B)**, while demo does not — the original ticket's
"neither table currently exists on a fresh DB" holds only for the runtime-migrations
path, not the baseline path.

### 2. Is `consultants.routes.ts` mounted?

Yes, but only as a stub. `Gateway.ts:994` mounts it via `mountStub('/api/consultants', …)`:

- Dev (or `ENABLE_STUB_ROUTES=true`): real router mounted.
- Prod/demo (flag unset — verified on Railway): honest 501 JSON for the whole prefix,
  because `consultantRoutes` is in `STUB_NAMES_WITH_LIVE_UI_ON_DEMO` (live FE callers:
  `ConsultantPanelView.tsx`, `ConsultantInviteView.tsx`, routed in `AppRoutes.tsx`).

**Extra finding — the FE and Producer A don't even match.** The FE calls
`/consultants/orgs`, `/consultants/clients`, `/consultants/invites`
(`src/services/api.ts` ~10244–10274) — Consultant-Mode endpoints. **No router in
`server/src` serves those paths at all.** In dev with stubs on, `GET /api/consultants/orgs`
falls into Producer A's `GET /:id` with `id='orgs'` and queries the marketplace shape →
guaranteed failure. So even where Producer A is mounted, it serves the wrong contract to
its only claimed callers.

### 3. Is `ensureConsultant` / `consultantService` ever called?

No. Fresh grep 2026-08-26: zero importers of `consultantService` in `server/src`,
`src`, and `tests/` (only `_backup/ts-js-collisions/` shim, `dist/` build output, and
`services_list.txt`). The whole service — consultants CRUD, `consultant_org_links`
CRUD, consultant invites — is dead code. Confirms the earlier zero-importers finding
for its `consultant_org_links` CRUD.

### 4. Which producer is authoritative; resolution

**Authoritative schema = Consultant-Mode shape (B):** it is the only `consultants` DDL
that exists anywhere in the repo (never-ran 017 + live v2 baseline), and it is what a
fresh baseline-built DB actually contains. Producer A's marketplace shape has no DDL,
no live mount, and a contract mismatch with its own FE callers.

Recommended fix (needs supervisor sign-off; NOT applied here):

1. `consultants.routes.ts` (Producer A) — remove the router or gut its SQL. **Do not
   simply delete the Gateway mount**: the honest-501 stub for `/api/consultants` must
   stay, or the live `ConsultantPanelView`/`ConsultantInviteView` screens on demo regress
   from clean 501 to silent 404/blank. Safest shape: keep the 501 mount, delete the
   wrong-shape router file and its `routes/index.ts` export.
2. `consultantService.ts` (Producer B) — either delete as dead code (consistent with
   this branch family's dead-shim removals) or explicitly quarantine it as the *only*
   valid implementation if the abandoned Consultant-Mode feature is ever revived. If
   Consultant Mode is revived, 017 (or a Postgres port of it) must run first, and the
   missing `/consultants/orgs|clients|invites` routes must be written — they never
   existed in `server/src`.

## Adjacent landmine found during this audit (worth its own entry)

`server/src/middleware/orgContext.middleware.ts` — a **live** middleware (imported by
`auth.middleware.ts`, `index.ts`, realtime handlers) — queries `consultant_org_links`
in `resolveUserOrgAccess` (line ~317) and `getUserOrganizations` (line ~370) whenever a
user is *not* a direct org member. That table does not exist on demo. The failure is
masked: `DbPromise.get/all` default to `fallback=true`, so "relation does not exist"
is logged (`[DB:Promise] Error`) and `null` is returned → access denied. Net effect
today: correct deny, but (a) recurring error-log noise on every non-member access
check, and (b) if anyone ever flips those calls to `fallback:false` or "fixes" error
swallowing globally, non-member access checks start throwing 500s. If Consultant Mode
stays dead, the consultant-link branch in orgContext.middleware should be removed
alongside Producer B.

## Evidence trail

- Live DB probe script (read-only): scratchpad `probe-consultants-readonly.mjs`, output captured above.
- Gateway stub mechanics: `server/src/Gateway.ts:477,496-527,994`.
- Baseline DDL: `server/migrations-v2/001_baseline_20260413.sql:8757-8762`.
- Never-ran DDL: `server/migrations/never-ran/017_consultant_mode.sql.sql:4-10`.
- FE call sites: `src/services/api.ts:10244-10274`; views `src/views/consultant/*.tsx`.
- Runtime migration discovery (top-level `server/migrations/` only): `server/src/database/DatabaseInitializer.ts:3209-3249`.
