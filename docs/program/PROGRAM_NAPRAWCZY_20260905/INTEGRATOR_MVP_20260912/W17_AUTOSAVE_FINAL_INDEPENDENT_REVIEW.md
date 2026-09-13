# W17 — bounded autosave independent acceptance

**ACCEPT bounded autosave fix**, exact SHA `0005b14011de1ef447b6842ecff1d3569ba202e0`. WT codex-w17-deck-autosave-20260912 clean before/after, hash manifest in evidence. No source edits/build/tsc/restart by reviewer. Full W17 action/export acceptance remains OPEN.

## Independently executed

| Contract | Evidence/result |
|---|---|
| Component + hooks |37/37 PASS,0skip, maxWorkers1; actual DeckBuilder and useDeckAutosave/useVersionHistory tests, controlled transport |
| Established conflict A→B |PASS in full37: keyed internal DeckBuilder owns conflict/history/proposal/edit state; old banner/content/token does not cross route identity |
| Late A409/500/network/409-latest and queued B |PASS in full37: callbacks after async boundaries ignored for old epoch/id; Bedit re-arms after A settles, no overlapping hook writer |
| Real reopen |UI login→own create201→open+reload,0PUT; SQL version1/history0/updated_at/deck hash identical; API readback agrees |
| Real server restore |First edit v2; canonical restore v3 with no extraPUT; next edit CAS3→v4 |
| Real AI Accept |Existing registered chat handler created deterministic proposal200; UI Accept v5 with no autosave echo; next edit CAS5→v6 |
| Real in-flight edit/revert |Held real accepted PUT response v7; revert queued, no parallel write; release causes next sequential PUT→v8, original title restored |
| Real409 + MELS Reload latest |Competing canonical writer v9; stale local edit409; existing MELS banner reachable; Reload latest0additionalPUT and identical SQL atv9 |
| Local session checkpoint |UI checkpoint, edit v10, local restore produces one real autosave→v11; final reload0PUT/SQL unchanged |

Own deck `1bb7a33536884dd393af5e7615e99a7c`, local `cx8_e0` in cx-codex8-pg:6459. Explicit Docker unix socket /Users/piotrwisniewski/.colima/default/docker.sock. Front5291 PID94759 cwd W17; C8 backend4218 PID55218 unchanged. Real UI login with existing private C8 fixture, secrets never printed. Browser/test processes finished, resources returned to root without restart.

## Source review closure

Pre-review W17_AUTOSAVE_PRE_REVIEW.md and corrected root finding retained. inFlight was never cleared by deckId effect; original overlap-via-reset premise remains withdrawn. Current hook guards all relevant async completion/error/conflict paths and preserves queue. Internal keyed DeckBuilder closes the independently identified already-established-conflict A→B state reuse. Canonical loader3paths/serverrestore/acceptedAI/conflictReload baseline both writer and timeline; local restore remains an edit. Existing single CAS/token/history writer preserved. Component evidence separates controlled races from real PG flow; no claim that every possible concurrent runtime scheduling was exercised.

## Harness qualifications and remaining scope

First flow attempt timed out loading Vite modules before deckGET/write; kept under flow-initial-load-timeout. Retry completed restore/edit to v4, then an unresolved waitForResponse timeout after proposal banner; no acceptPOST in saved log. Likely UI obstruction was not independently established as cause. Preserved flow.json/log. Continued explicitly on same v4 record with fresh UI using flow-continue; new proposal, no lifecycle reset or repeated restore/write. The registered handler returns handled/reply, not operationId; continuation reads operationId from actual agent-edit HTTP response. This tests the real registered command, not full typed-chat UX.

Read-only reopen and final light/MELS screenshots inspected, plus flow light/dark. Dark is ONLY CSS-class probe (not configured-theme acceptance), exhibits mixed contrast/blank white slide content; no full dark visualPASS. Missing logo from sparse public assets and mixed existing Polish/English labels are visible. Full W17 visual/export/actions matrix, broader auth/tenant/AI quality remain NOT_PROVEN. The accepted scope is persistence behavior, not presentation quality or release readiness.

Evidence `/Users/piotrwisniewski/Developer/codex-wt/w17-deck-independent-final`: tests37.json/log, readback.json/open+reload PNG, flow.json/log, flow-continue.json/log, session-restore.json/log, final-light/dark PNG, source-hashes.json. SQL/API before/after recorded for each phase. Existing author deck/evidence untouched. No live endpoints, no provider service needed (deterministic existing command).
