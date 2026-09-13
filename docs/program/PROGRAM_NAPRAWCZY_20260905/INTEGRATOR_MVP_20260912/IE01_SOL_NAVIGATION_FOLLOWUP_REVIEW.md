# IE01 Sol navigation follow-up — 2026-09-13

## Verdict

**ACCEPT the bounded navigation repairs at exact commit `ea59dd1fbab2ff7fa42e7285839318d148496970`.** No blocker remains in the two reviewed fixes: a same-mounted Initiative document now resets record-local navigation before the prior card can be serialized into the new record URL, and the Preparation lens now follows router search-parameter history in both directions.

This closes the two navigation findings from `IE01_SOL_INDEPENDENT_REVIEW.md`. Together with the separate ACCEPT in `IE01_SOL_BASELINE_VALIDATION_FOLLOWUP_REVIEW.md`, all three introduced findings from that review are closed. Full IE01 remains `PARTIAL`; the pre-existing and explicitly retained gaps in the original review are unchanged.

## Frozen identity

- Worktree: `/Users/piotrwisniewski/Developer/codex-wt/codex-closed-autosave-20260912`
- Commit: `ea59dd1fbab2ff7fa42e7285839318d148496970`
- Worktree: clean after verification
- `src/components/Initiatives/InitiativeDocumentView.tsx`: `5161c4cef1046b900120f9746182191d8f6ffe226dd1bc1b0aaf4329b337b886`
- `src/components/Initiatives/InitiativesHub.tsx`: `00f18f218cd6fd338301f35e1383760e2b8275bd4790250beb439c4d40c4e0c5`
- `tests/components/Initiatives/InitiativeDocumentView.canonicalNavigation.behavior.test.tsx`: `33aa9f146d2190535166be5bf9e58373925c8419e82e56ac75b2de31e2e3ceba`
- `src/components/Initiatives/__tests__/InitiativesHub.journeyNavigation.test.tsx`: `46dfe0107126f36c9396cd809b5b239e781bc57fe6f1babc2a333efbbbfffdda`

These hashes match `IE01_REPAIRS_COMMITTED_MANIFEST.json`.

## Source conclusion

`InitiativeDocumentView` detects an `initiativeId` identity change during render and resets the active canonical card from the matching current deep link before effects can replace it with the previous initiative's section. It clears record-local finding state and recomputes the dirty flag from the existing actor-and-initiative-keyed draft store, so the repair preserves stored drafts across record switches rather than deleting them.

`InitiativesHub` now uses one `resolvePreparationLens` normalization for initialization and every `searchParams` change. This makes real-router forward and back navigation update both the workspace selector and rendered surface. The test-only history controls use `→` and `←`; application code and the J0 scanner contract are unchanged by that label adjustment.

## Independent verification

- Navigation behavior: **2 files, 4/4 PASS**. This includes same-mounted A-to-B navigation to B's requested `gates-approvals` card with no write, and router history `list → analysis → list` with surface/readout agreement.
- CLOSED/autosave regression: **10/10 PASS**. The inherited React `act(...)` warnings remain non-failing test diagnostics; no assertion failed.
- Definition draft regression: **6/6 PASS**, including cross-card draft preservation and actor/section isolation.
- Total additional scoped follow-up: **20/20 PASS**.

No source was edited during this independent review. No API, Vite, PostgreSQL process, migration, live write, deployment, or global build was started.

## Integration boundary

The three reviewed repair findings are accepted for integration at the exact commit above. This receipt does not promote the full IE01 module beyond `PARTIAL`, erase the original combined-run denominator of 26 PASS plus 2 CLOSED stack-trace failures, or close the original report's pre-existing/NOT_PROVEN areas.
