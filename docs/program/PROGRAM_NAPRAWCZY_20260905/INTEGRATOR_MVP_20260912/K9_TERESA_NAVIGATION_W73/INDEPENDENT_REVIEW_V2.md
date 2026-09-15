# K9 Teresa navigation — independent re-review v2

Verdict: **HOLD** at exact candidate
`8c284e6f2b1e026fdd42fa602e4a8ddd0a6e4a73`.

Exact base: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.

## Blocking finding

### P1 — Projects is disclosed while its runtime feature is OFF

The two blockers from the first review are corrected, but the completed
fail-open audit found one remaining route whose availability is not represented
in the Teresa filter. `TERESA_NAVIGATION_MANIFEST` includes `PROJECTS` for every
active tenant member and assigns no `runtimeFlagKey`. The production route uses
`import.meta.env.VITE_PMO_PROJECTS === 'true'`; when the flag is absent or OFF,
`/projects` redirects to `/my-work`. The server call supplies only
`VITE_MODULE_MEETINGS`, so Teresa still receives `Projects: My Work → Projects
(/projects)` while the user does not have that screen.

This conflicts with W70/W73 variant B: Teresa may name only what the user sees,
filtered by role, organization and flag. Add a server-controlled Projects
runtime flag to the manifest/filter and prove OFF gives zero Projects label,
click path and route in EN and PL. The client must not supply this flag.

## Corrected first-review blockers

- **Feature flag query fault: GREEN.** A thrown `feature_flags` query leaves the
  verification state false and excludes all five organization-gated entries.
  The behavior tests prove 0/5 ids, labels and routes in EN and PL.
- **Stale role: GREEN.** `/chat/stream` is wired as `verifyToken →
  requireActiveChatMembership → validateBody → handler`. The membership
  guard selects current `status, role`, rejects missing/unverifiable membership,
  and overwrites `req.userRole`. The behavior test starts with stale JWT
  `ADMIN`, returns current membership `MEMBER`, and proves zero admin label,
  route, organization/member data query and admin citation.
- Role authority remains fail-closed for admin data: only exact current
  `OWNER`/`ADMIN` values enter the admin block. Organization identity comes from
  authenticated request fields. The body supplies neither role nor runtime or
  organization flag state to K9 grounding.

## Other security and integrity checks

- Admin grounding selects organization metadata, aggregated membership roles
  and flag name/state only. Settings grounding selects user language/timezone
  and organization setting keys/timestamps. It does not select e-mail,
  `setting_value`, token, password or secret values.
- The delta adds no component, route shell or second `UnifiedChatPanel`.
- Frontend manifest and server mirror compare equal; the manifest has 16
  entries. The routing importer set proves the referenced route grammar, apart
  from the inherited Results expectation described below.
- No migration, forbidden path or new product/test `as any` is present.
- Evidence hash manifest: 7/7 files verified. `git diff --check` against the
  exact base is green.

## Reproduced tests and gates

- Focused K9 denominator: **4 files, 20 passed, 0 failed**.
- Routing importer candidate: **24 files passed, 1 failed; 247 passed, 1
  failed**. Exact-base reconstruction in the same linked worktree: **23 files
  passed, 1 failed; 246 passed, 1 failed**. The candidate adds exactly the one
  passing manifest-mirror test. Both runs have the identical sole failure:
  `tests/navigation/routeMapping.test.ts` expects `/results` for
  `BENEFITS_REALIZATION` and receives `/results/kpi`.
- Server TypeScript: RC 0.
- Frontend TypeScript: 177 errors, within the W73 ceiling. This independent
  environment listed 7,424 absolute files; the frozen evidence says 7,427, so
  the file-count evidence is not byte-for-byte reproducible here. The error
  denominator is reproduced and unchanged.
- `check:jezyk:ci`: PASS; K4en -68 and K7 -1.
- `check:list-canon`: PASS, 349 / baseline 349.
- `check:artefakt`: PASS, 8 / 0 / 117, baselines unchanged.
- Production build: RC 0, completed in 35.75 seconds.

## Freeze verification

- Final package HEAD/tree: `8c284e6f2b1e026fdd42fa602e4a8ddd0a6e4a73` /
  `6c4b5244f6b4302a60fcd45604907006664b000f`.
- Frozen product commit/tree: `6f77b9406f9a7dadc1b10467fc08a1a8f5f0be66` /
  `73a4da0f5cf943d4408d97c806ec51e58e0dd622`.
- The seven frozen evidence hashes verify. Integration and deployment remain
  not done.

Screenshots remain N/A because the package adds prompt grounding and a data-only
manifest, with no rendered UI change. This review used behavior tests at the
authorization and prompt boundary.
