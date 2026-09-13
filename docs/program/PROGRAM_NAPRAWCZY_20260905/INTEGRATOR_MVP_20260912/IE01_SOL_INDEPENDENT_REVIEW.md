# IE01 Sol independent review — 2026-09-12

## Verdict

**HOLD for integration of checkpoint `a1e0ab0783b8de48e0e89b2da25b06f01e1ffc55`.** The bounded current-policy, template-lock, named-reviewer and replay protections passed fresh real-PostgreSQL and actual-Gateway verification, but the accepted profile schema contains one newly introduced fail-closed consistency defect: it accepts a baseline Definition card with `reviewRequired=false` and no named reviewers while the Definition gate still requires an accepted review and the review command denies every actor. That legal profile can dead-end the mandatory eight-card Definition path after the next publication.

This is an independent source/test review only. Full IE01 remains `PARTIAL`; no release, deploy, migration, live write or complete-module acceptance is authorized here.

## Frozen source and evidence identity

- Worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-closed-autosave-20260912`
- Branch: `codex/ie01-initiative-journey-20260912`
- Reviewed HEAD: `a1e0ab0783b8de48e0e89b2da25b06f01e1ffc55`
- Required base / merge-base: `e0fb12491f4b2547228008dee276202950b95aed`
- Worktree and index: clean before and after review.
- `evidence/ie01-definition-checkpoint/source-hashes.json`: 28/28 paths independently recalculated and equal to the manifest.
- Full author packet and repository checkpoint read. The preserved combined run is **26 PASS + 2 CLOSED `STACK_TRACE_ERROR` failures**, not 28/28; the unchanged CLOSED regression was separately 10/10 PASS. This review does not merge those denominators.

## Introduced findings

### [BLOCKER] A schema-valid profile can make a mandatory baseline card impossible to review

Files and lines:

- `server/src/domain/initiatives-execution/configureInitiativeCards.ts:39-55` accepts `reviewRequired=false` with an empty `reviewerIds` list for every card, including the eight Definition baseline cards.
- `server/src/domain/initiatives-execution/definitionReadiness.ts:116-129` correctly keeps the baseline eight review-mandatory through `cardKey in REQUIREMENTS`, but checks named reviewer identity only when the configured card has `reviewRequired=true`.
- `server/src/domain/initiatives-execution/reviewInitiativeCard.ts:52-58` requires the actor to appear in `reviewerIds` for every configured card, including a card whose profile says `reviewRequired=false`; an empty list therefore denies every actor before receipt replay.

Independent behavior reproduction on frozen source:

1. Constructed a 26-card `technology` profile whose eight baseline Definition cards are `REQUIRED`, `reviewRequired=false`, `reviewerIds=[]`; the remaining cards are optional.
2. `configuredCardProfile(...)` accepted it (`schemaAccepted: 26`).
3. Eight complete/current/sufficient baseline cards already `ACCEPTED` by a non-profile reviewer produced `evaluateDefinitionReadiness(...).readiness === "READY"` with no findings.
4. For the same configured profile, `reviewInitiativeCard(...)` on `summary-scope` failed with `MaterialCommandRuleError: CARD_PROFILE_REVIEWER_NOT_NAMED` for an otherwise eligible independent reviewer.

Concrete user path: apply the schema-valid profile to an initiative with accepted baseline cards; edit and republish any baseline card; its state becomes `REQUESTED`, Definition readiness becomes not ready, and every review attempt is rejected because the configured reviewer list is empty. The user cannot recover through the legal card-review command.

The canonical contract supports a validation fix rather than a universal role fallback: `11_INITIATIVE_CARD_SYSTEM.md` section 6 says the template defines reviewers; section 9.2 says gate policy selects domain reviews; D-20 fixes configurable reviewers per gate; the runtime already treats the eight baseline cards as always review-required. Reject any profile where a baseline Definition card has `reviewRequired=false` or has no named reviewer. Preserve `reviewRequired=false` for non-baseline cards where the profile allows it. Update the readiness test fixture so all baseline cards explicitly remain review-required/named; keep the existing extra-card negative/optional case separate.

Required acceptance after fix: schema RED→GREEN for all eight baseline keys, apply rejection before receipt/selection mutation, and one real PG/Gateway path proving that a profile accepted by schema can still publish and receive a legal named review. Re-run the current-policy/revocation/replay cases on the fixed source.

### [IMPORTANT] A same-mounted SPA navigation can discard the requested canonical card deep link

Files and lines:

- `src/components/Initiatives/InitiativeDocumentView.tsx:800` reads `open`/`card` only in the `useState` initializer.
- `src/components/Initiatives/InitiativesHub.tsx:1919-1929` reuses the same `InitiativeDocumentView` component when `activeDocumentId` changes.
- `src/components/Initiatives/InitiativesHub.tsx:2755-2758` changes an open record tab through bare `setActiveDocumentId`.
- `src/components/Initiatives/InitiativeDocumentView.tsx:9492-9501` then writes the retained `activeNSection` back into the new record's URL.

Reproduction: keep InitiativesHub mounted, open initiative A on `summary-scope`, then navigate in-app to `?open=B&mode=doc&card=gates-approvals`. Hub switches the prop to B without remounting the document component. The state initializer does not run again, so B remains on A's section; once the URL effect sees `open=B`, it replaces `card=gates-approvals` with the retained section. The existing navigation test proves only a first mount and does not rerender the document with a second initiative/deep link.

Reset or derive canonical navigation state when `initiativeId`/matching deep-link card changes, and clear record-local finding state at that identity boundary. Add a two-record same-mount test that asserts B renders the requested card and performs no write.

### [NORMAL] The new preparation lens is not synchronized from browser history

Files and lines:

- `src/components/Initiatives/InitiativesHub.tsx:288-295` derives `preparationLens` only at first mount.
- `src/components/Initiatives/InitiativesHub.tsx:850-865` handles only legacy invalid `tab` values and returns for absent/canonical tabs without syncing `lens`.
- `src/components/Initiatives/InitiativesHub.tsx:1470-1482` updates `activeTab` on `popstate` but not `preparationLens`.

Reproduction: within the same mounted Hub, traverse browser history between URLs carrying `lens=list` and `lens=analysis`. The URL/search params change but the workspace dropdown and rendered surface retain the previous lens. Add a popstate/history test for both directions and synchronize the lens from the URL with the same normalization used at initialization.

## Fresh independent verification

All commands ran from the frozen worktree with no source edits and no runtime restarts.

- Frontend/schema/readiness/authority per-file run: **6 files, 18/18 PASS**. Covered mounted finding focus, cross-card draft preservation, conflict preservation, dirty-review denial, actor/section remount isolation, initial-read guard, initial deep-link mount, Hub four-destination shell, profile schema, readiness and authority helper.
- Real PostgreSQL domain runner: **19/19 PASS**, fresh IDs, terminal process, isolated cleanup. Evidence: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/ie01-journey/sol-review-20260912-01-domain.json`, matching log and readback.
- Actual ApiGateway/JWT/PostgreSQL runner: **8/8 PASS**, fresh IDs, terminal process, isolated cleanup. Evidence: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/ie01-journey/sol-review-20260912-01-gateway.json`, matching log and readback.
- The runners verified Docker id `bd644c57cb4c9f8626855da09a587e2897d5d5a07da97012d8897886aceac02c`, bound PostgreSQL `127.0.0.1:6459/cx8_e0`, loaded credentials privately, used unique fixture IDs, preserved readbacks and cleaned their exact records. No API5293/Vite5292/DB process was restarted or left by this reviewer.

These fresh runs confirm the implemented boundaries for template hash/version conflict, tenant-hidden preview/apply, missing update authority, effective-policy drift before apply, named-member revocation before apply, named card review, replay revalidation, parent/template/selection locking, and 400/403/404/409 mapping. They do not cover the blocker profile because the fixtures set `summary-scope.reviewRequired=true` with one named reviewer.

## Pre-existing or explicitly retained gaps

The following remain `PARTIAL`/`NOT_PROVEN` and are not introduced findings from this checkpoint:

- full 26-card render/edit/review/capability/negative matrix and semantically native renderers;
- approved typed waiver positive path, full profile-change acceptance invalidation, six production-ready profiles and deployment configuration;
- atomic concurrency proof for policy/member revocation during a command; current tests prove sequential revalidation before replay, while policy/member readers are outside the locked transaction;
- object-level visibility and own-scope semantics beyond the inherited template/project readers;
- default legal reviewer usability (`PROJECT_LEADER` still needs explicit `initiative.view` in the accepted local fixture);
- full reload/offline draft recovery, per-card UI named-reviewer affordance, duplicate same-record tabs, inherited legacy 404s and full visual acceptance;
- full 12-state lifecycle, Analysis, durable report/PDF/scheduler/delivery and production environment profiles.

The new profile preview does not independently widen template visibility in this source: the existing authenticated `GET /api/initiatives/templates` already returns `sectionConfig` for organization/public templates, while the new preview additionally requires `initiative.view` on the target initiative and applies the same organization/public template predicate. That inherited reader policy remains a qualified gap, not a new cross-tenant finding here.

## Release of review resources

Reviewer test processes are terminal. API5293 PID3432, Vite5292 PID16251 and PostgreSQL6459 were not restarted or retained. The author worktree was frozen and clean when this checkpoint review ended; the integrator resumed source ownership afterward to prepare fixes. Integration should resume only after a separate exact-SHA review of the blocker fix and the two navigation regressions.
