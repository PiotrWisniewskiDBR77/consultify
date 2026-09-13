# W17 correction package — source review, 13 September 2026

Status: source integration in progress; actual built acceptance pending. No deployment.

## Presentation

Restore author `cad013383c` integrated as `f8a728694a`. Restore now updates the row title and snapshot under the same organization/version compare-and-swap. Direct snapshot title precedes metadata title; absent title retains current row title. Invalid non-object/JSON snapshots reject before mutation. Root route suite passed 11/11; an independent Sol also passed 11/11. These tests use route/SQLite persistence, not the shared Gateway/JWT/PostgreSQL runtime. The final language-hook adjustment returns the stable diagnostic DECK_VERSION_SNAPSHOT_INVALID.

EN author `310ead935d` integrated as `942bb40775`. Both command surfaces resolve translation keys; English and Polish contain the eleven command labels, and the structure rail consumes its translated title. Independent root reviewed all six files. Author regression suite14/14 and root combined restore/labels13/13 passed. The mounted label tests compose the toolbar and shell; actual DeckBuilder browser wiring remains to verify.

Close-button accessibility fix `771e7970e6` is integrated. Its visible runtime verification remains pending with the combined build.

## Notebook

Root reviewed persisted parent DTOs in both legacy/V8 reads, verified-parent resolution before child mounting, denied-read handling, canonical path correction, genuine containerless-page reachability and late prior-identity title cancellation. Root independent pending/denied tests passed2/2. Final author scoped suite passed76/76. Server typecheck exited0. Frontend check exited2 with191 diagnostics, including two new nullable-state accesses; these were corrected with optional chaining and the focused suite rerun. The inherited189 diagnostics are not a global frontend PASS; no post-correction full typecheck is claimed here.

## Required actual acceptance

Use the existing owned local API5293/preview5292/PostgreSQL6459 runtime with exact source and dist identity. Preserve held Deck7769e962faaa4ed5abbe85ebf98b4e49 version6; do not repeat historical failed runs. Verify restore followed by visible edit/reload, matching UI/API/SQL title, cards, history and version. Verify EN controls and accessible Close. For Notebook, use new owned two-parent and orphan fixtures and prove real sidebar isolation, canonical/deep-link reload and cleanup readback. Present-mode/notes isolation follows as a separate action slice. Full W17 action and difficult-scenario denominator remains open.

## Actual local acceptance checkpoint

Combined build source61e0500ce03ca9a7d2df6791383795363d5e6587, served index SHA256 da17cb9e61615d1884ab6e8a0fd3882b1e44f1717eec26d3449144da25416f73 independently read back. Build8GB retry exited0 after verified default4GB V8 heap failure. API5293 uses the same source; database connected, Redis-disconnected health remains degraded.

- Restore/edit/reload: raw actual-v6-fixed-restore-v1/result.json SHA c41326d6ae92393cad976f03054cfb24d1ca4e356ce0165191ece6175a5c5077. Root verified restoreVersion3 expected6→7 and visibleedit7→8, matching SQL row/rawJSON/API/UI titles, exact8cards and hard reload screenshot. Two browser writes, zero pageErrors. Fixture remains heldv8 for subsequent read-only acceptance.
- EN/Close: actual-v2/result.json under w17-deck-en-close-readonly-20260913 SHA c3ec3546275a75ea8fe04009d48c4ad326d17530777210d5fb0b9bc5851616dd. Root viewed seven English commands and Structure; accessible Close closes history. Zero business writes/pageErrors.
- Notebook: W17_NOTEBOOK_PARENT_CONTEXT_UI_20260913T110856Z/result.json SHA ed9cd50eb5f53a789b74b16ed9a034c051ea77dd4b68e7267c910dfe43ff6686. Root verified27checks and visually inspected ParentB single-page sidebar after canonical reload. Legal containerless page remains reachable. Cleanup3pages+2notebooks confirmed by GET404 and scoped lists0. Ten aborted analytics/web-vitals requests are retained; no zero-total-network-error claim.

All three bounded corrections are accepted locally. Setup via API does not prove CreateUI.

## Newly observed Present visual defect

Present read-only raw SHA a938d3e716ddb9d37a2a7a04eed4706ffd8cad4b22da790732c416318f8a6edf reports current/beginning/presenter navigation, keyboard exit and private-note separation. Root viewed both actual-v2 audience/presenter screenshots: slide text is near-white on white; audience counter is dark on black. Initial screenshots are not settled-state proof. Follow-up computed-style evidence found normal entrance animation opacity0.039 then1.0, with settled heading contrast10.045:1. No persistent slide-theme defect was established; authored animations and palette remain unchanged. The actual persistent defects are the audience counter contrast1.176:1 on black and six icon buttons without accessible names. Their correction is integrated0e2f5282ac; actual built verification remains pending. Full W17 action/scenario matrix remains OPEN.


## Present control integration and Notebook UIcreate
Present controls integrated0e2f5282ac after independent root review and author5/5 scoped regressions, normal hooks. Combined8GB build60165 exited0; no backend change/restart. Notebook UIcreate→title/body edit→V8PUT200→sameID reload accepted: finalreceipt23f497bfabf789d69654b6f7194b218a2158f498d1579c358abfc514ce77a0a6, original timeout preserved as legacy-only endpoint instrumentation error. Root inspected rawV8 response, canonical readback and reload screenshot; cleanup404/404/scoped0.
