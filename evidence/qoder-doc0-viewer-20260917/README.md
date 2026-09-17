# DOC-0 (DEC-593) — read-only document viewer: visual evidence

Captured 2026-09-17 on branch `qoder/doc0-viewer-20260917` (worktree C).
Harness: `dev-render` on port **5421** (pool C), dedicated temporary entry
`doc0-document-viewer.html` (sources archived here as `*.txt` — NOT committed to
`dev-render/`, see §4). Viewport **1440×900**, language **EN**, theme through the
app store + `.dark` class (never `emulateMedia`).

## 1. What is real

- Component: `src/components/documents/DocumentViewer.tsx` on the real
  `StandardArtifactShell` (karta `document`, klasa `L`) — no mockup.
- Content: the REAL staging row `c9a254b7-9f13-405f-a210-310a7c695aa0`
  "Northwind OEE Recovery 2027 — Dynamic SWOT read-out" (org 468b234c), captured
  read-only by running the PRODUCTION resolver
  `server/src/services/artifacts/artifactContentResolverService.ts` against the
  local dump copy (`qoder-c-pg-doc0-18`, port 6622): origin runtime `report`,
  `canonicalKind=document`, projection `synced`, 17 582 chars of markdown
  (`capture-envelope.mts.txt` is the capture script).
- Transport only is stubbed: the harness has no backend, so `window.fetch`
  returns the captured envelope byte-for-byte for
  `GET /api/artifacts/:id/content` and delegates everything else.
- Properties panel values are the real `v8_output_artifacts` row:
  `delivery_state=draft`, owner `users` row 75f25357 → "Irina Lebedjuk",
  `last_transition_at=2026-09-16T00:02:57.607Z`.

## 2. Labels read aloud (light screenshot)

Header: "Northwind OEE Recovery 2027 — Dynamic SWOT read-out", status pill
"draft", save state "Saved", kebab menu (More), back arrow.
Breadcrumb strip: "Approved findings".
Left nav (17 entries, real headings of the document): Northwind OEE Reco…,
Executive Summary, Strategic tensions, Recommended actions, Assessment Method…,
Strategic tensions, Recommended actions, Tool & Process Overv…, **Approved
findings** (active), Key Findings, Approved findings, Identified Gaps, Approved
findings, Recommendations, Recommended actions, Next Steps, Recommended actions.
Centre: the projected markdown of the active section (real SWOT findings —
strengths / weaknesses / opportunities / threats bullets).
Right panel: "PROPERTIES" → Property/Value, Status = draft, Content registry =
Artifact content, Owner = Irina Lebedjuk, Updated = 2026-09-16T00:02:57.607Z.
Read-only variant has NO primary button and no Actions section (DEC-593).
Dark edit-path variant adds the primary "Edit" button in the header and an
"ACTIONS" section with the single "Edit" action — editing stays an explicit,
separate action.

## 3. Measurements (`pomiary.json`)

| shot | size | console errors | page errors | pixel contrast (WCAG) | AA |
|---|---|---|---|---|---|
| doc0-viewer-en-light-1440x900.png | 112.0 KB | 0 | 0 | 19.47 (bg L=0.945, text L=0.004) | pass |
| doc0-viewer-en-dark-1440x900.png | 100.7 KB | 0 | 0 | 17.34 (bg L=0.008, text L=0.953) | pass |
| doc0-viewer-en-dark-edit-path-1440x900.png | 103.9 KB | 0 | 0 | 17.34 | pass |

Contrast is measured PIXEL-WISE from the raw capture (pngjs luminance histogram
over the document body box x=260,y=170,w=840,h=700: background = modal bucket,
text = the ≥0.05%-share bucket furthest from it), BEFORE the palette
quantization (sharp, 1440×900 unchanged) that keeps every PNG under the 200 KB
evidence limit.

## 4. Why the harness screen is archived here and not committed

`scripts/check-dev-render-parytet.mjs` R1 measured **1 new violation** for the
screen: `<DocumentViewer>` has no production caller yet — the wiring
(etap 1 punkt b) sits in files outside the allowed list of `[C] Wpis 37`
(`OutputsAggregateTabContent.tsx`), reported as Q4. Adding a baseline entry to
silence a NEW R1 debt is forbidden by the gate's own rule ("Nigdy żeby uciszyć
nową regresję"), so the screen lives only in this evidence dir
(`harness-screen-doc0-document-viewer.tsx.txt`,
`harness-entry-doc0-document-viewer-main.tsx.txt`,
`harness-entry-doc0-document-viewer.html.txt`) and the parity output is
archived as `parytet-R1-output.txt`. Per reguła 17 the screenshots therefore
document the COMPONENT, not a wired product route — the route is Q4.

## 5. Registry numbers behind DEC-594 / DEC-595

Raw artifacts (`backfill-po-verify.json`, `backfill-po-verify.mts.txt`,
`mutation-results.json`, `archived-not-hidden-proof.txt`) sit in this directory
but are NOT committed — `evidence/.gitignore` excludes `*.json`/`*.txt`, so the
numbers are restated here. All read-only, measured 2026-09-17 10:52Z against the
local dump copy `qoder-c-pg-doc0-18` (port 6622, removed after the measurement),
org `a3e05d4a-5397-419d-b486-8e44366c0063`.

| measurement | value |
|---|---|
| `wave5_artifacts` rows / with content | 238 / 238 |
| unlisted native artifacts after backfill | 0 |
| backfill inserted (first run / second run) | 119 / 0 (idempotent) |
| inserted by family | document 12, presentation 45, sheet 62 |
| `v8_output_artifacts` rows, all orgs / this org | 1773 / 827 |
| by family, all orgs | document 153, presentation 187, sheet 177, template 1002, null 254 |
| `v8_artifact_origin_links`, all orgs | 1446 |
| duplicate `(org, origin_runtime, origin_record_id)` keys | 0 |
| contentless `document` rows | 6 (reason `ARTIFACT_CONTENT_ORIGIN_NOT_FOUND`) |
| archived `document` rows, this org | 9 = 6 set by DEC-595 (`last_transition_at` 2026-09-17T14:09:19Z) + 3 pre-existing (2026-07-07) |

The six DEC-595 rows: `77deb2e5-b304-452c-b2a0-a7cb67119209` (DBR77 Staging
Assessment Executive Report), `7136de78-da0a-4777-96d3-f854a341c5e1` (Q2
Strategy Report), `63abe6f8-3064-4f02-a7e5-60d36a058cd0` (Q2 Strategy — Market
expansion playbook), and `f4ef329b-d2ab-4f74-b167-7eeb0a18d050` /
`8f623933-6ef5-4b2f-8b00-d3d6fdb732e9` / `9dfe39da-c3f8-4ea7-9630-d4454a36c6a8`
(three "Sekcja finansowa — 2025 (2026-08-09)" rows). Each was logged with its
pre-change state, and `restoreArchivedDocumentRows` reverses exactly those six.

`v8_artifact_origin_links` has no summary column (`link_id, artifact_id,
organization_id, origin_runtime, origin_record_id, is_primary_origin,
created_at`), so the DEC-595 audit trail is the application log plus the
`entries` array returned to the caller — not a DB column.

Mutation proofs (`mutation-results.json`): 7 mutations of
`documentContentResolver.ts` / `documentViewerFlag.ts` /
`DocumentViewer.tsx`, each red with a genuine assertion failure (failed counts
6, 1, 2, 1, 3, 3, 1 — output matched `/\d+ failed/` and never `Startup Error`)
and green again after restore.

**Finding, not fixed (DEC-607):** `delivery_state='archived'` alone does NOT
remove a row from the Materials list — `listArtifactsForUser` filters only by
`organization_id` (`artifactRegistryService.ts:3249-3250`) and
`matchesViewFilters` (`:2956-3000`) has no archived rule, while `isDraft` comes
from the `is_draft` column (`:535`), not from `delivery_state`. Hiding the six
rows needs a change in `artifactRegistryService.ts`, outside the `[C] Wpis 37`
allowed-files list — reported as Q4, zero edits made.
