# CLOSED autosave — independent bounded ACCEPT

Exact source `4fe3e7d8ff8b43edb9a4b7f3b71d9c1554d94e04`; worktree clean after acceptance. No product changes by reviewer. Source reviewed against its base, normal actual hook log inspected. RC1 unchanged.

## Independent behavior and runtime

Evidence: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/closed-independent-final/`.

- `component10.json`: independent 10/10 PASS, zero skipped. Same ten fullNames across author baseline (8 FAIL/2 PASS), card-scope mutation (4 FAIL/6 PASS), newer-backup mutation (1 FAIL/9 PASS), and restored 10/10. Final product bytes equal preserved restored source. Tests cover capability revocation, newer backup preservation, legal null clears, canonical runtime writer and refused runtime owner clear.
- `closed-ui/evidence.json`: fresh own CLOSED record, real member login/API/JWT/PG. Zero initiative writes after two debounce periods; complete SQL row unchanged; no Unsaved/page errors. Two inherited organization-members GET403 retained. Actual 1440x900 light/dark screenshots inspected, luma difference 223.145.
- `legal-ui/evidence.json`: fresh own DRAFT, title/date-set/date-clear/owner-clear each real PUT200. Exactly four initiative PUTs through final reload and 3300ms observation; SQL planned_end_date and owner_execution_id null; no Unsaved, HTTP errors or page errors.
- `narrative-ui/evidence.json`: additional single problem-text edit on the same DRAFT. Exactly one initiative PUT200; SQL and reload retain distinctive problem narrative; no second autosave, Unsaved, HTTP or page errors after 3300ms. Screenshot inspected. This addresses the problemDefinition/problemStatement baseline precedence question for this actual structural edit.
- `runtime-create/create-receipt.json` and `runtime-ui/evidence.json`: canonical application registration creates own runtime-only record; UI metadata PATCH200 expectedVersion1 advances PostgreSQL aggregate 1→2, reload remains clean, zero legacy PUT. Ten inherited read404 responses retained; no page errors.

## Evidence boundaries

Local dev frontend5292 + real Gateway5293 + PG6459/cx8_e0. Existing synthetic identities, fresh owned project/records; legacy initial states seeded explicitly, not lifecycle/create UI acceptance. Runtime registration uses existing application service, not a claimed Hub form flow. Capability-revocation/newer-backup and runtime-owner-refusal proven at component behavior level, not all repeated in browser. This accepts the bounded autosave repair, not all Initiatives/MVP or staging. Total telemetry writes are separated from initiative writers.

Author external Playwright harness had a weak `r.ok` method-reference assertion; independent copies enforce status()===200 plus payload/SQL/no-extra-save. Author corrected harness and disclosed retrospective checks. Independent fresh runs use corrected assertions; old evidence is not mislabeled as rerun.

No new blocker found in the accepted scope. Resources5292/5293 returned unchanged to integrator; no reviewer browser/test remains active.
