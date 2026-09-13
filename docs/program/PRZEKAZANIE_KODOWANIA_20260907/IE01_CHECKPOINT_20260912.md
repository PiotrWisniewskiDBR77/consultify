# IE01 bounded Definition checkpoint — 2026-09-12

Status: AUTHOR EVIDENCE READY FOR INDEPENDENT REVIEW, full IE01 PARTIAL. Base e0fb12491f4b2547228008dee276202950b95aed, branch codex/ie01-initiative-journey-20260912. No release/deploy or complete-module acceptance. Mandate [ODMROZENIE 05_INITIATIVES DEC-2026091202] [ODMROZENIE WSPOLNE DEC-2026091202].

## Implemented boundary

Four fixed Hub entries, List/Analysis and preparation Work report reading the same filtered scope; canonical26 navigation with existing29-key compatibility. The report is a reader, not ReportRun/PDF/scheduler/delivery. Definition's existing eight content editors now expose specific readiness findings, field focus, actor/initiative/card-local drafts, original CAS, conflict preservation, dirty-review prevention and protection against editing before initial content read. Section remount preserves drafts; full-browser-reload/offline draft storage is not claimed.

Configured profile selection uses the existing template API with explicit preview/hash and current policy id/version. Profile schema contains26 entries, requiredness, reviewRequired and named reviewerIds. Six profile names are distinct from governance baselines; no invented six-by26 default matrix. Root-approved optional transaction reads lock parent→template→selection in the existing transaction before receipt replay. Existing published content and legacy selection requiredness survive configuration. Profile omission cannot bypass an already configured profile; changes after draft and unverified waiver requests are denied. No UoW lifecycle, migrations or existing105 initiative changes.

Apply, review and Definition commands recheck effective policy and active named reviewer membership/capability. Presence of an ID is insufficient. Review authority is checked before receipt replay; readiness rejects accepted content reviewed by a different named reviewer. Existing8 required Definition baseline stays conservative; explicitly optional extra cards can omit review. MaterialCommandRuleError types now represent403/404 already emitted by the mapper, preserving400/409.

## Executed evidence (evidence/ie01-definition-checkpoint)

- Mounted findings/drafts: genuine2RED→2GREEN, extended dirty/conflict2RED→4GREEN; final6 behaviors plus Hub1/deeplink1 =8GREEN. Deep-link loading and initial editor loading mutations each caused1FAIL, restored8GREEN.
- Profile schema3RED→3GREEN; readiness2newRED→4GREEN; authority helper3GREEN. Combined28 run had26PASS and2 CLOSED failures (STACK_TRACE_ERROR; preserved), not28PASS. Unchanged isolated CLOSED full rerun10/10PASS. Thus new frontend/schema/readiness/helper18PASS and CLOSED10PASS in separately qualified runs. JSON reporter initially wrote to junit.xml despite outputFile.json option; the actual parsed10/0 JSON was preserved as closed-regression-retest.json.
- Real domain PostgreSQL19/19 restored, including6 explicit fixture profiles, retained legacy requiredness, two-session template lock55P03, omitted-profile bypass, stale/lifecycle/replay and named authority. Named-review mutation18PASS1FAIL then19GREEN.
- Real ApiGateway/JWT/PostgreSQL8/8, foreign scope404, missing update404, revoked named reviewer403, stale policy/hash/version409, malformed keys400, named review201, revoked replay/readiness denial. Authority mutation6PASS2FAIL then8GREEN. Domain/Gateway fixtures use fresh own UUIDs, save readback before exact cleanup; SQL-seeded aggregates prove those routes, not creation.
- server-tsc-profile-3.log exit0 after final source; previous type failures preserved in external scratch. No new full frontend build claimed.

## Fresh final-source UI/API/PG vertical

One initiative initiative-53431a2c-e3f1-4e5b-b63a-8799f016e2eb and Decision a8a91cf3-15f8-4789-a579-f0ce731961ab. Actual Hub source201→registration201 with project→configured profile201→eight publish201→eight independent review201→Definition request201→return201→one-card correction/publication→independent rereview→resubmit201→approve201→reload. Final API+SQL: DEFINED v24; typed Decision APPROVED v4; MyWork1; legacy initiative0. Each stage has actual response evidence. Existing older completed fixture is untouched and is not substituted for this final-source proof.

The profile was created through actual POST /api/initiatives/templates201 (template-create-api-evidence), then selected/applied in UI. This proves one explicit configured profile, NOT that target environments have all six starter profiles. Local policy baseline STANDARD v1 and quorum1 are explicit synthetic fixture configuration, not product defaults. PROJECT_LEADER factory lacks initiative.view despite review capability: root authorized explicit initiative.view for the one local project reviewer; SQL retained. Default reviewer usability remains a release fix/configuration dependency.

Final light/dark1440x900 inspected: Approved/Defined content readable; duplicate same-record tabs visibly remain. Known legacy planning/detail/suggested-change/attachment GET404 responses preserved; pageErrors0 does not mean zero HTTP errors. Light mean luma245.42; dark25.47; light-minus-dark delta219.95 exceeds the required40 theme distinction threshold. This proves theme distinction, not full visual acceptance.

## Remaining scope, not silently accepted

1. Full26 card render/edit/review/capability/negative matrix is unfinished. Native mappings remain partial: milestones uses Tasks without dedicated filter; feasibility uses Gates; competencies/comments/history need correct semantic surfaces; missing sections remain explicit. No generic editor substitutes for required product behavior.
2. Six production-ready profile configurations and supported rollout, approved typed waiver positive path, complete profile-change acceptance invalidation and authority concurrency proof remain. Current fail-closed waiver is not completed governance. Policy id/version is shown as technical text; improve user-facing policy description later.
3. Profile preview uses the existing project capability reader boundary. Object-level visibility beyond that inherited reader and any own-scope semantics require independent verification; do not claim stronger security than tested.
4. Default legal reviewer access needs bounded fix or supported deployment configuration. Existing template POST shadow permission is inherited and not claimed as full template-admin authorization proof.
5. Full12 lifecycle gates, I03 consulting analysis, I06/IE07 durable reports/PDF/scheduler/delivery, planned/execution intervention contracts remain required future blocks. Finance references retain their own readiness boundaries.
6. Global topbar Save is still metadata-oriented; card dirty indication and explicit card publication are proved, not a claim that global Save commits all canonical drafts. Full reload/offline recovery and per-card UI named-reviewer authority remain future coverage.
7. Duplicate tab opening, inherited runtime-only legacy404s, remaining visual gaps remain visible limitations. No fullIE01 or final rollout acceptance.

## Reproduction / ownership

External scratch /Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/ie01-journey holds run-profile-tests.py <freshlabel>, run-profile-gateway.py <freshlabel>, full mutation logs, stage harnesses and HANDOFF. Those runners verify explicit local Docker identity and privately load credentials, never print them. UI stage harnesses are fresh-output-only and mutate one fresh fixture; do not rerun completed lifecycle stages or seed-ui.mjs. Reviewer should create new IDs and preserve terminal records. account.json is SECRET and excluded.

Assigned local API5293 PID3432, Vite5292 PID16251, DB6459cx8_e0. API intentionally restarted from final source before fresh UI; no other runtime touched. Source/test sha256 manifest is source-hashes.json; original base and all RED evidence preserved. Normal hook/commit result will be added in external final packet after execution, not assumed here.
