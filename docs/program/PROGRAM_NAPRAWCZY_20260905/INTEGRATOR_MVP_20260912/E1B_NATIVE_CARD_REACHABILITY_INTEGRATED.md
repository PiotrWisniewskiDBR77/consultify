# Native card reachability integrated

Root source `96db009a37` integrates author `de48cc0a49834340e165f26dcc26aea8c0fbe605`. Normal author hooks passed; root verified all six integrated hashes against freeze V6 (SHA256 de9d3adda4f55291cb31a5bda20a817a55e1f69146c3651a514e84a82eda12da). Independent review: ACCEPT, 34/34 tests, JSON SHA256 b9630e798dd77c3eefedf3deb9cc7072c7f51ee142b8863cbd3ecaf1bb916a59.

The resolver now follows an explicit canonical-only legacy header to the full runtime registration, preserving canonical version, lifecycle and document origin. Timeline uses canonical lifecycle for its mode and baseline lock. Legacy mode mapping remains. A stale EXECUTING expectation was separately reproduced on root before integration and corrected to the existing shared IN_EXECUTION contract; the production status adapter was not changed.

Root global TypeScript comparison: 189 diagnostics across 55 files versus 192 across 57; no additions, removed Timeline TS2367 twice and types TS2353 once. This is not a clean global check. Combined build session58424 exited0 in36.20s. Dist index SHA256 b8592eb52d45560ad51dfdfb2165b6105792aa0ea54dbd35c0756ac456ff09d6. Log: E1B_NATIVE_CARD_REACHABILITY_INTEGRATED_BUILD_V1.log.

API5293/PID88576 and existing local unified-read cohort remain unchanged; preview5292 serves the new dist. Same native Initiative remains version49 IN_EXECUTION and ExecutionCase ACTIVE, with zero legacy rows in pre-editor SQL readback. Execution Sol is authorized to run the independently corrected visible editor script; Export Sol owns independent receipt/DB verification and cleanup, including the discovered initiative_candidates row. No cleanup until the visible evidence is captured. A separate native plan-window versus baseline-date review is read-only; no date may be invented from a scheduling window.

Built GREEN, save/clear/Bank readback, frozen plan equality and strict cleanup remain OPEN at this checkpoint. No default-flag change, deployment, full fresh-org flow or complete MVP acceptance is claimed.


## Built follow-up: actual composition remains red

After integration, normal Bank→Open correctly shows the canonical profile and lifecycle. The Timeline navigation entry now appears, but selecting it shows a noContent placeholder. No forecast write occurred. Root traced the production cause: TIMELINE is a right-column legacy contract item, intentionally omitted by sekcjeZKontraktu; runtime composition adds milestones but omits the Timeline renderer. The earlier mounted test supplied that renderer directly and therefore did not prove production composition. A bounded runtime-only composition fix is assigned to Execution Sol with independent Export Sol review. Preserve `e1b-native-editor-visible-write-v2` as the real built RED. The V1 Edit selector timeout is separately a harness issue (actual role is radio).

Baseline research does not justify rejecting every missing baseline: binding handoff contracts allow explicit gaps and profile-dependent requirements. The tentative window cannot supply exact dates. Profile/gap semantics are under read-only review; no new policy or gate has been introduced.
