# PMO-1a v4d closure, W244

Base verified by ls-remote: c1213d39adaff2ae484fe6e9d4857e37b9f58b40. Rebased previous e0033462288da5f8da4ae8d65c87ef5531b6808f without conflicts. Only refreshed evidence after rebase; no new production behavior in this iteration.

Own foreground frontend tsc, NODE_OPTIONS=--max-old-space-size=8192: baseline 156, candidate 156, raw diagnostic set added=[], removed=[] (tsc-diff.json). No timeouts or signals; both normal exit 2. Instrument control and restored-code proof below.

Fresh HTTP via local API 4214, pgvector17 restored dump staging-pre-zasiew-demo-20260918T0129.dump (restore RC0), owned container cto-a-pmo1a-w244-pg port6458. Existing local users authenticated using password parsed at runtime from authorized access file. No writes to staging/demo.

All22 records: 20 disabled with nonempty reason, two with no primary transition. Self-review POST409, unauthorized reviewer POST403 and preflight false. Distinct authorized reviewer: Sarah proposes201, James reviews200 and executes201; initiative_status_history3->4, id88d1f4ab-ebed-4ebe-8ee6-e1124dc8c18f, APPROVED->IN_EXECUTION. Exact response codes retained; no201 mislabeled200.

Actual component PmoStageTransitionPanel and actual lifecycle hook replay fresh captured Gateway/PG results:24PASS, plus delta/importers total80PASS19PGskipped (not counted as evidence). Raw HTTP capture committed at docs/program/PMO_1A_V4_W224_20260917/measure-v4d-realpg.json. Mutation and final identity below.

Callers: InitiativeDocumentView.tsx:10598 passes currentUserId at10602. Shared read-only readiness: initiativeTransitionPreflightService.ts:299 and transformationInitiativeTransitionAdapterService.ts:98. Existing records' output shape recorded for22initiatives, not synthetic component copies. Zone authorized W244 PMO; no other package altered. Screenshots owned by CTO per W240/W242.

Language, flags, canon and artifact gates PASS. Own API stopped and database/container/volume removed, fstrim executed. No migration changes, bypass, stash, force-push or protected-branch push.

Instrument control: appended exactly `const __s: number = "x"` to production PmoStageTransitionPanel.tsx; full foreground tsc returned157 (exit2), sole added TS2322 at403:7. Removed; source byte-identical to measured156 candidate (`git diff --exit-code` PASS).
Self-review mutation: removed `!reviewerIsCurrentActor &&` from transitionProposalReady;1FAILED8PASS. Restored production source;33/33 actual-component tests PASS.

Server tsc:0, normal exit0, TypeScript and server dependencies from lock-ci clean npm-ci station; no source changes there. Final base readback remains c1213d39adaff2ae484fe6e9d4857e37b9f58b40. KOSZT: not available from session counter | version v4d | repeat YES.

W247 rebase:34bc633ff987fa6f362082d610aad6e04e0f7ed2, range-diff3/3 identical patches; actual-card tests33PASS. Own new-base foreground tsc156 and rebased candidate156, full diagnostic sets added0/removed0. Instrument control above remains applicable; no production changes. Current final SHA and new backup in OD_CODEXA.
