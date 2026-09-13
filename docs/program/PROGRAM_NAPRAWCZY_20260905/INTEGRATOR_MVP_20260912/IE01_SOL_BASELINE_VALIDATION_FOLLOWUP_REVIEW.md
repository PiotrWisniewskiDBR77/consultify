# IE01 Sol baseline validation follow-up — 2026-09-12

## Verdict

**ACCEPT the bounded baseline-review validation repair by the frozen source hashes below.** The blocker from `IE01_SOL_INDEPENDENT_REVIEW.md` is closed in this WIP: every mandatory Definition baseline card must now retain named review in a configured profile, while non-baseline cards may still explicitly disable card review.

This is not final IE01 integration acceptance. The repair was reviewed before a new commit existed, so final integration still requires exact-SHA revalidation. The earlier HOLD also remains open for the separate same-mounted A-to-B card deep-link defect and preparation-lens history synchronization defect.

## Reviewed delta

Base checkpoint remains `a1e0ab0783b8de48e0e89b2da25b06f01e1ffc55`. Reviewed repair files and SHA-256 identities:

- `server/src/domain/initiatives-execution/configureInitiativeCards.ts` — `2e1a1bb15783f310fc73d040c18f5ee88439266754a900422d1b4f9853af42f3`
- `server/src/domain/initiatives-execution/definitionReadiness.ts` — `cdfd64314482578135cb17914cf27f812115b34f11e623eada0a80d2a1ca2515`
- `server/src/domain/initiatives-execution/__tests__/initiativeCardProfiles.pg.test.ts` — `330b4d54a73faa08efeb28ac16e3f3c0636b86962d30d96d3c55e8c558abf596`
- `src/components/Initiatives/__tests__/initiativeProfileContract.test.ts` — `91a64d789325710af027b37038a1ce83bd7539416f5b8edac90669428260e289`
- `tests/unit/initiatives-execution/definitionReadiness.test.ts` — `73fc7bb35654e7df870de7ca831c1e4c7a3f7e2c06d65298f0defa0c3786a7c1`
- `server/src/routes/pmo/__tests__/initiativeProfiles.gateway.pg.test.ts` — `54ad76ae96d4781b7ba957d1198a47716499bb1c79f4c33b0e5885a346a20a91`

Hashes were measured before and after the qualifying Gateway run and remained unchanged.

## Source conclusion

`definitionReadiness.ts` exports `DEFINITION_REQUIRED_CARD_KEYS` directly from the existing `REQUIREMENTS` object. `configuredCardProfile` uses that same list and rejects a configured profile with `CARD_PROFILE_BASELINE_REVIEW_REQUIRED` when any one of the eight cards is absent, has `reviewRequired=false`, or has no named reviewer. This keeps schema validation and runtime readiness on one denominator.

The fix preserves the intended boundaries:

- all eight existing Definition baseline cards remain review-required and named;
- a required or optional card outside that baseline can retain `reviewRequired=false` and an empty reviewer list;
- unprofiled legacy initiatives are unaffected because the new validation runs only while parsing a configured template profile;
- the review command remains fail-closed and does not gain a broad role-based fallback;
- invalid configuration fails before profile selection or command receipt mutation.

The canonical basis is consistent with `11_INITIATIVE_CARD_SYSTEM.md` sections 6 and 9.2 and governance decision D-20: templates define reviewers, and gate policy selects required domain reviews. No reviewer fallback was inferred.

## Independent behavior evidence

- Native source probe: invalid baseline `reviewRequired=false/reviewerIds=[]` returns `CARD_PROFILE_BASELINE_REVIEW_REQUIRED`; all eight valid named baseline cards plus a non-baseline `technical-specification.reviewRequired=false` profile parse successfully. Result: 2/2 behaviors GREEN.
- Profile/readiness unit files: **9/9 PASS**.
- Fresh real PostgreSQL domain run: **19/19 PASS**. Evidence: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/ie01-journey/sol-review-20260912-02-baselinefix-domain.json`, matching log and readback.
- First fresh Gateway attempt after production validation but before updating the Gateway fixture: **0/8 PASS**. Preserved as valid RED evidence that the old fixture itself encoded the newly forbidden configuration. Evidence: `sol-review-20260912-02-baselinefix-gateway.json` and log. It is not counted as a successful run.
- Fresh actual ApiGateway/JWT/PostgreSQL run after fixing the fixture and adding the eight-card negative matrix: **16/16 PASS**. Evidence: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/ie01-journey/sol-review-20260912-03-baselinefix-gateway16.json`, matching log and readback.

The 16 Gateway behaviors comprise the unchanged eight profile/tenant/policy/replay cases plus one case for each mandatory baseline card. Each new case proves preview 409 and apply 409 with exact code `CARD_PROFILE_BASELINE_REVIEW_REQUIRED`, unchanged aggregate state, empty selection, and no command receipt.

All fixtures used fresh IDs and their existing exact cleanup. Reviewer processes are terminal; API5293, Vite5292 and PostgreSQL6459 were not restarted.

## Compatibility boundary retained

Validation prevents a new invalid profile from being previewed or applied. It does not rewrite or silently repair an invalid profile snapshot that may already be embedded in an Initiative aggregate from code preceding this repair. No production profile inventory or migration was authorized or proved. Before rollout, an explicit read-only inventory must determine whether such persisted snapshots exist; any repair path must preserve content/history and use governed reconfiguration rather than direct payload rewriting.

No blocker remains inside this bounded baseline-validation repair. Full IE01 remains `PARTIAL`, and the original review's other findings and stated non-proven areas remain open.
