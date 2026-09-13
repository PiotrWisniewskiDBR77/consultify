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
