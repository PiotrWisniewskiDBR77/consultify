# K9 Teresa navigation — independent review

Verdict: **HOLD** at exact candidate
`2ea7740c4eec23190ce8a35394a4461925505eca`.

Exact base: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.

## Blocking findings

### P1 — stale token role can disclose administrator grounding

The `/chat/stream` route is correctly protected by `verifyToken` and
`requireActiveChatMembership`, but the membership guard selects only `status` from
`organization_members`. It does not read the current membership `role`.
`verifyToken` retains the signed token role for the token organization, and K9 then passes
`req.userRole` directly to `buildModuleContextGrounding`.

Consequently, after an ADMIN is downgraded to MEMBER, a still-valid token with the old role
continues to include `ADMIN` navigation and can execute the new admin organization/role/flag
queries. Active membership is verified; current authorization role is not. Resolve the role
from the active membership row for this provider-bearing request and pass that verified role
to grounding. Add a behavior test with token role ADMIN and membership role MEMBER proving
zero admin label, route, queries and citations.

### P1 — organization flag lookup fails open

`buildTeresaNavigationGrounding` catches a failed `feature_flags` query and leaves its flag
map empty. An absent map entry then admits every organization-gated manifest entry. A
skeptical fault-injection test with the query throwing exposed all five guarded entries:
Audits, Results, Finance, Materials and Meetings.

This violates the accepted rule that Teresa mentions only modules visible to the user. When
organization entitlement cannot be verified, organization-gated entries must be excluded.
Add the failed-query behavior test and retain zero label/route mentions in both EN and PL.

## Verified behavior and gates

- The three submitted target files pass: 17/17 tests.
- Explicit MEMBER + `MODULE_AUDITS=false` + Meetings runtime OFF produces zero ADMIN,
  Audits and Meetings labels in the model prompt.
- `routeConfig` and the server mirror compare equal in the submitted contract test.
- The reconstructed route importer denominator is 227 passed / one failed: 17 target tests
  plus 210 passed / one failed across the 16 routing importer files. The single failure is
  the unchanged `BENEFITS_REALIZATION` `/results/kpi` versus `/results` expectation.
- `git show`/`git diff` confirms the pre-existing route declarations and that failing mapping
  are unchanged from exact base; K9 only appends the manifest to `routeConfig`.
- Admin queries select organization metadata, aggregated roles and flag names/states. The
  settings query selects setting keys and timestamps; neither selects `setting_value`, email,
  token, password or secret data.
- The delta adds no component, view, layout or second Teresa panel. Screenshot N/A is valid:
  no rendered UI behavior changed.
- Server TypeScript: RC 0. Frontend TypeScript: 177 errors and 7,427 list files.
- Frontend build: RC 0, completed in 54.86 seconds.
- Language ratchet: green. List canon: 349/349. Artifact canon: 8/0/117.
- Product/test code adds zero `as any`; migrations and forbidden paths: zero.
- IRIS/package evidence has a hygiene defect: `git diff --check` is red from extra blank lines
  at EOF in six submitted files.

## Freeze integrity

The receipt identifies the full base but records the product checkpoint only as abbreviated
`197039091f`; it does not pin the full product commit/tree or hashes of the behavioral
evidence. The corrected freeze should record full SHAs and a verifiable hash manifest before
the next independent review.
