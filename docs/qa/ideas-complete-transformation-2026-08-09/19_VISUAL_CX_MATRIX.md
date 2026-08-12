# Gate 4 — Visual CX Matrix (24-shot review)

Stamp: worktree `3dd93792b9` (detached, `/Users/piotrwisniewski/consultify-wt/ideas-visual-gate`)
Date: 2026-08-10
Reviewer: visual-review stream (continuation of a stream that died before writing the report; screenshots were already rendered by that prior stream — this stream only opened and looked at them, wrote this document, and ran the guard scripts; no re-render, no dev server started)

Source captures: `docs/qa/ideas-complete-transformation-2026-08-09/screenshots/g4__*.png` — confirmed exactly 24 files on disk (4 tools × 6 variants).

All 24 files were opened with the Read tool and visually inspected. Several were additionally cropped/zoomed with a local PIL script (`/private/tmp/.../scratchpad/crops/*.png`) to verify pixel-level colors and confirm suspected overlaps — these crops are working artifacts, not new evidence files.

---

## RECAPTURE — Stream VISUAL-2, stamp `b03937fcf9`, 2026-08-10

**INVALIDATED EVIDENCE — do not cite the pre-recapture Table baseline shots.** The four
`g4__table__baseline__1440x900__*` captures scored FAIL under F-06 below were produced by a
**broken dev-render harness**, not a real product defect: `dev-render/screens/idea-table.tsx`
composed `IdeasTableContent` next to the fixed-320px `ArtifactRightPanel` in a row flex
without `min-w-0`, so the panel's automatic minimum width (its own content width) pushed it
off-canvas (`scrollWidth` 1684 vs a 1440 viewport) and every section header/item clipped
mid-word. Production never mounts that panel this way. The harness fix (`min-w-0 flex-1`
wrapper) landed on this branch before this stream started; this stream only recaptured and
re-reviewed. **F-06 is CLOSED — no code change was needed, the panel was never actually
broken.**

Separately, F-03 (the floating archetype view-switcher pill overlapping the in-canvas
Menu-2 toolbar on Whiteboard/Process Flow at the 720x450 zoom-reflow viewport) **was a real
defect** and is fixed in this stream — see below.

Recaptured/added in this pass (all opened and visually inspected with the Read tool, all
against the harness running from this worktree, stamp `b03937fcf9`):

| File | Status |
|---|---|
| `g4__table__baseline__1440x900__light__pl.png` | Recaptured (overwritten) — was FAIL (F-06), now PASS |
| `g4__table__baseline__1440x900__dark__pl.png` | Recaptured (overwritten) — was FAIL (F-06), now PASS |
| `g4__table__baseline__1440x900__light__en.png` | Recaptured (overwritten) — was FAIL (F-06), now PASS |
| `g4__table__baseline__1440x900__dark__en.png` | Recaptured (overwritten) — was FAIL (F-06), now PASS |
| `g4__table__1280x800__light__pl.png` | Recaptured (overwritten) — was PASS, still PASS |
| `g4__table__zoom200reflow__720x450__light__pl.png` | Recaptured (overwritten) — was PASS, still PASS |
| `fix__whiteboard__zoom200reflow__720x450__light__pl.png` | New — after-shot for the F-03 fix |
| `fix__processflow__zoom200reflow__720x450__light__pl.png` | New — after-shot for the F-03 fix |

**F-03 fix.** Root cause: `src/components/MyWork/mindmap/IdeaViewSwitcher.tsx`, the
`compactCanvas` branch (viewport `< 720` wide or `< 260` tall) unconditionally anchored the
switcher pill at `top: r.top + 8` — the very top-left corner of the canvas. On Mind Map that
corner is empty canvas, so it was never a problem. On Whiteboard and Process Flow, that exact
corner is where their own in-canvas Menu-2 toolbar (`WhiteboardToolbar` /
`ProcessFlowToolbar`) renders as the first child of the tool's root — flush with the canvas
top edge — so the pill sat directly on top of it, hiding the tool label / mode tabs / •••
more-menu. Fix: the `compactCanvas` branch now measures that same first-child toolbar strip
(`mels-canvas-content`'s tool root → its own first child) and, when it's a slim strip flush
with the canvas top (not the full-bleed canvas surface itself, which Mind Map has), drops the
pill below its bottom edge instead of on top of it. Mind Map's corner-cluster/full-bleed
first child never matches the "slim strip flush with top" shape, so its position is
unchanged (verified — see below).

Non-regression: `verify__whiteboard__{1440x900,1280x800}__light__pl.png` and
`verify__processflow__{1440x900,1280x800}__light__pl.png` were rendered to
`/private/tmp/.../scratchpad/shots/` (not committed as evidence, verification-only) and
visually confirmed clean — pill sits in its usual bottom-right corner next to the zoom
cluster, no overlap, toolbar rows fully legible, identical to the original PASS baselines.

## Scope excluded per instruction (already settled, not re-litigated here)
- Bottom-right "← Lista | Uwagi" pill = `dev-render/PanelUwag.tsx` harness feedback panel, not product chrome. Present in every screenshot; ignored throughout.
- Process Flow toolbar "Kroki N | Lanes N" mixed-locale chip (English "Lanes" surviving inside a PL render): already found and fixed on the integration branch per the task brief. It IS still visible in this worktree's PL captures (`g4__processflow__baseline__1440x900__light__pl.png`, `..dark__pl.png`, `..1280x800__light__pl.png`, `..zoom200reflow__720x450__light__pl.png` all show "Lanes 2"). Logged once below as found-and-fixed-elsewhere, not scored as a new defect.

## Chrome i18n — general observation (applies to all tool/locale pairs)
Chrome (breadcrumb, Menu 1 buttons/status pills, Menu 2 tab labels, empty-states, toasts) is correctly translated in every `__en` capture checked (Ideas/Idee, Shaping/Kształtuje się, Convert/Konwertuj, Classic Flow/Klasyczny przepływ, Insert/Wstaw, NOTE/NOTATKA, "4 unconnected elements.../4 niepowiązanych elementów...", Steps/Kroki, No warnings/Brak ostrzeżeń, etc.). Idea/node/task CONTENT (titles, sticky notes, mind-map branches) stays in Polish in every `__en` capture too — this is user-authored seed data, not chrome, and is expected/correct behavior (the harness does not machine-translate a consultant's own written content). Noted once here rather than repeated per row.

---

## 1. Full matrix

| # | Tool | Theme | Locale | Viewport | Screenshot | Verdict | Observation |
|---|------|-------|--------|----------|------------|---------|-------------|
| 1 | Mind Map | light | pl | 1440x900 baseline | `g4__mindmap__baseline__1440x900__light__pl.png` | PASS | Clean. Convert CTA is dark navy `(15,23,42)`, not crimson. Status dot purple, not crimson. |
| 2 | Mind Map | dark | pl | 1440x900 baseline | `g4__mindmap__baseline__1440x900__dark__pl.png` | PASS (minor) | See F-01: a mind-map connector edge routes across the "Przejście z time&material na milestone fixed-fee" card, striking through its text. Same node is clean in the light PL capture — force-directed layout is non-deterministic between renders. |
| 3 | Mind Map | light | en | 1440x900 baseline | `g4__mindmap__baseline__1440x900__light__en.png` | PASS | Chrome fully English (Ideas/Shaping/Changes queued/Convert). Node content stays Polish — expected (user content). |
| 4 | Mind Map | dark | en | 1440x900 baseline | `g4__mindmap__baseline__1440x900__dark__en.png` | PASS (minor) | Same edge-through-text artifact as row 2, reproduced in this render too (F-01). |
| 5 | Mind Map | light | pl | 1280x800 | `g4__mindmap__1280x800__light__pl.png` | PASS | Layout holds fully at 1280x800, no clipping, no overlap. |
| 6 | Mind Map | light | pl | 720x450 zoom200reflow | `g4__mindmap__zoom200reflow__720x450__light__pl.png` | PASS (minor) | Title correctly truncates to "Podnieść marż…". Right tool rail (canvas §10.2 lewy/prawy rail) is taller than the 450px viewport; lowest icons (link, play, upload, undo/redo, more) are clipped at the bottom edge with no visible scroll affordance (F-02). Mind Map lacks the extra archetype Menu-2 row, so it does NOT show the pill-overlap defect seen on Whiteboard/Process Flow (see F-03). |
| 7 | Whiteboard | light | pl | 1440x900 baseline | `g4__whiteboard__baseline__1440x900__light__pl.png` | PASS | Clean; diamond node label truncates to "Automatyzo…" (acceptable for a diamond shape's limited label space). |
| 8 | Whiteboard | dark | pl | 1440x900 baseline | `g4__whiteboard__baseline__1440x900__dark__pl.png` | PASS (minor) | Two of four sticky notes show a warm amber/gold halo (box-shadow) around their border, not present on the other two notes and not visible at all in the light-theme capture of the identical board state (F-04). Confirmed NOT crimson (sampled ~RGB 44,46,39, warm but not red-dominant) and NOT the mandated blue `c-focus`. |
| 9 | Whiteboard | light | en | 1440x900 baseline | `g4__whiteboard__baseline__1440x900__light__en.png` | PASS | Chrome fully English (Insert/AREA/NOTE/"4 unconnected elements — click to select them on the canvas"/Go). No amber glow (theme-driven, not locale-driven). |
| 10 | Whiteboard | dark | en | 1440x900 baseline | `g4__whiteboard__baseline__1440x900__dark__en.png` | PASS (minor) | Amber glow reproduces here too (F-04), confirming it is theme-driven, not locale-driven. |
| 11 | Whiteboard | light | pl | 1280x800 | `g4__whiteboard__1280x800__light__pl.png` | PASS | Layout holds; toolbar/menu rows all legible, no overlap. |
| 12 | Whiteboard | light | pl | 720x450 zoom200reflow | `g4__whiteboard__zoom200reflow__720x450__light__pl.png` | FAIL → **FIXED** | Floating archetype view-switcher pill (Mind Map/Doc/Link/Table icons) renders ON TOP OF the "Whiteboard / Insert▾ / •••" Menu-2 row, obscuring the "Whiteboard" label and clipping the "•••" more-menu control (F-03). **Fixed in stream VISUAL-2 (stamp `b03937fcf9`)** — see `fix__whiteboard__zoom200reflow__720x450__light__pl.png`: the pill now sits below the toolbar row, which is fully legible ("Whiteboard", "Wstaw ▾", "•••" all visible, none clipped). The "4 niepowiązanych elementów" toast still overlaps canvas content near the bottom action rail — that part was NOT in scope for this fix and is unchanged (cosmetic, not a control-obscuring defect). |
| 13 | Process Flow | light | pl | 1440x900 baseline | `g4__processflow__baseline__1440x900__light__pl.png` | PASS (known issue) | "Kroki 7 \| **Lanes 2**" — the already-fixed-elsewhere mixed-locale chip, still present in this worktree. Logged once, not scored (see header). "Nie"/red arrow and "Koniec" red end-node use a bright red `(232,5,56)`, distinct from brand crimson `#85182F` — legitimate semantic use (No-branch / end), not a CTA/focus/selection misuse. Active tab uses neutral surface highlight, not crimson underline. |
| 14 | Process Flow | dark | pl | 1440x900 baseline | `g4__processflow__baseline__1440x900__dark__pl.png` | PASS (known issue) | Same "Lanes 2" untranslated chip (F-05, logged once). Dark rendering of nodes/lanes fully legible; decision diamond dark fill + gold border reads fine against dark bg. |
| 15 | Process Flow | light | en | 1440x900 baseline | `g4__processflow__baseline__1440x900__light__en.png` | PASS | Confirms the Lanes bug is PL-only: this EN capture correctly shows "Steps 7 \| Lanes 2" — both fully English. Chrome (Classic Flow/Automation/Value Stream/No warnings) fully translated. |
| 16 | Process Flow | dark | en | 1440x900 baseline | `g4__processflow__baseline__1440x900__dark__en.png` | PASS | Same as row 15, dark theme; consistent. |
| 17 | Process Flow | light | pl | 1280x800 | `g4__processflow__1280x800__light__pl.png` | PASS (known issue) | Layout holds. "Lanes 2" present (F-05, already logged). "Więcej" renders correctly with the ogonek (initially misread at low zoom, confirmed correct on crop). |
| 18 | Process Flow | light | pl | 720x450 zoom200reflow | `g4__processflow__zoom200reflow__720x450__light__pl.png` | FAIL → **FIXED (partial)** | Same defect pattern as row 12 (F-03): the floating view-switcher pill overlapped the archetype tabs row ("Automatyzacja"/"Strumień wartości" cut to "...tyzacja") and the description line ("Mapuj bieżący proces..." truncated). **Fixed in stream VISUAL-2 (stamp `b03937fcf9`)** — see `fix__processflow__zoom200reflow__720x450__light__pl.png`: the pill now sits below the "Koniec / Wstaw / Rozdziel" row, and the mode tabs, description line, and Koniec/Wstaw/Rozdziel row are all fully visible with zero pill overlap. **NOT fixed, separate root cause, still present**: "Kroki 7 \| Ścieżki 2 \| Brak ostrzeżeń" (top-right) is still clipped by the right-side tool rail icons overlapping on top of it ("Brak os..."). That clipping is caused by the floating right tool rail's width vs. the toolbar's chip row, not by the view-switcher pill (which this stream's fix addressed) — logged as a residual, out-of-scope defect (see §3). |
| 19 | Table (Idea Table) | light | pl | 1440x900 baseline | `g4__table__baseline__1440x900__light__pl.png` | ~~FAIL~~ → **RECAPTURED, PASS** | **INVALIDATED original finding — see RECAPTURE section above.** The clipping (F-06) was a broken dev-render harness (`dev-render/screens/idea-table.tsx` missing `min-w-0` on the flex row hosting `ArtifactRightPanel`), not a product defect. Recaptured against the fixed harness (stamp `b03937fcf9`): the outer artefakt-level right panel (table properties, not a row) renders fully intact — "AKCJE", "WŁAŚCIWOŚCI" (Wiersze: 5 / Folder: Bez folderu / Właściciel / Widoczność), "POWIĄZANIA" (1 inicjatywa promowana / Powiązana Mapa rekomendacji), "KOMENTARZE" (Brak komentarzy), "HISTORIA / AI" (Pogrupuj wg etapu / Zaproponuj kolejny pomysł) — every header and item complete, nothing cut mid-word. |
| 20 | Table (Idea Table) | dark | pl | 1440x900 baseline | `g4__table__baseline__1440x900__dark__pl.png` | ~~FAIL~~ → **RECAPTURED, PASS** | Same as row 19, dark theme. Recaptured — panel intact, confirms the fix (i.e. the non-bug) is theme-independent. |
| 21 | Table (Idea Table) | light | en | 1440x900 baseline | `g4__table__baseline__1440x900__light__en.png` | ~~FAIL~~ → **RECAPTURED, PASS** | Same as row 19, English chrome. Recaptured — "ACTIONS", "PROPERTIES" (Rows: 5 / Folder: No folder / Owner / Visibility), "RELATIONS" (1 promoted initiative / Linked Recommendation map), "COMMENTS" (No comments yet), "HISTORY / AI" (Group by stage / Suggest next idea) all complete. Confirms locale-independence of the fix. |
| 22 | Table (Idea Table) | dark | en | 1440x900 baseline | `g4__table__baseline__1440x900__dark__en.png` | ~~FAIL~~ → **RECAPTURED, PASS** | Same as row 19, dark+EN. Recaptured — panel intact. 4th and final confirmation across all baseline theme×locale combinations that F-06 was a harness artifact, not a product defect. |
| 23 | Table (Idea Table) | light | pl | 1280x800 | `g4__table__1280x800__light__pl.png` | PASS (recaptured) | Recaptured against the fixed harness. No row selected in this capture, so no inspector panel is open — nothing to clip. Still cannot be used to confirm or deny panel behavior at this viewport with a row selected (see NOT MEASURED). |
| 24 | Table (Idea Table) | light | pl | 720x450 zoom200reflow | `g4__table__zoom200reflow__720x450__light__pl.png` | PASS (recaptured) | Recaptured against the fixed harness. Correct responsive column-priority behavior per §11.1: Tags/Tool/Date columns drop, Title + Etap (status) remain, "Nowy pomysł" collapses to icon-only "+". No row selected — panel not shown. |

---

## 2. Findings

| ID | Severity | Screenshot(s) | What's visibly wrong | Rule / SSOT |
|----|----------|----------------|------------------------|-------------|
| F-06 | ~~P1~~ **CLOSED — not a real defect** | `g4__table__baseline__1440x900__{light,dark}__{pl,en}.png` (4 shots) | **INVALIDATED, see RECAPTURE section above.** Was reported as: Idea Table's right-hand properties/inspector panel has every section header and item truncated mid-word at the viewport's right edge. Root cause was `dev-render/screens/idea-table.tsx` composing `IdeasTableContent` next to the fixed-320px `ArtifactRightPanel` in a row flex without `min-w-0`, pushing the panel off-canvas in the HARNESS only (`scrollWidth` 1684 vs 1440 viewport). Production never mounts the panel that way. Fixed harness confirms the panel is intact in all 4 baseline combinations — recaptured 2026-08-10, stamp `b03937fcf9`. No product code changed for this item. **Correction to the original write-up**: this panel is NOT row-selection-gated as originally stated ("illegible whenever a row is selected") — it is the outer artefakt-level right panel (properties of the TABLE itself: Wiersze/Folder/Właściciel/Widoczność, table-level Powiązania, etc.), mounted unconditionally by this dev-render harness regardless of row selection; it is visible in the 720x450 zoom-reflow capture too (row 24) with zero row selected. | ARTIFACT_ANATOMY_STANDARD.md §11.2 "Prawy panel 360 (320–420)" / §11.1 "Prawy panel (preview) clamp(340px,28%,480px)"; DoD §18.1 "Prawy panel: sekcje w kolejności Akcje·Właściwości·Powiązania·Komentarze·Historia/AI" |
| F-03 | ~~P1~~ **FIXED (partially — see residual below)** | `g4__whiteboard__zoom200reflow__720x450__light__pl.png` (before), `fix__whiteboard__zoom200reflow__720x450__light__pl.png` (after); `g4__processflow__zoom200reflow__720x450__light__pl.png` (before), `fix__processflow__zoom200reflow__720x450__light__pl.png` (after) | At the 720x450 (200%-zoom-reflow) viewport, the floating view-type switcher pill (Mind Map/Doc/Link/Table icons) overlapped and obscured the archetype-specific Menu-2 row underneath it (tool label, tabs, description text, and on Process Flow the "•••" more-menu). Root cause: `src/components/MyWork/mindmap/IdeaViewSwitcher.tsx`'s `compactCanvas` branch unconditionally anchored the pill at the canvas's top-left corner (`r.top + 8`) — exactly where Whiteboard's/Process Flow's own in-canvas toolbar renders as the first child of the tool root, flush with the canvas top. Mind Map has no such child there, so it never collided. **Fix**: the branch now measures that first-child toolbar strip and, when present (slim strip flush with canvas top, distinct from a full-bleed canvas surface), places the pill below it instead of on top. Verified: after-shots show the toolbar label/tabs/•••-menu fully legible with the pill sitting clear below; 1440x900 and 1280x800 unaffected (pill still in its usual bottom-right corner). **Residual, NOT fixed, separate root cause**: on Process Flow at 720x450, the "Brak ostrzeżeń" chip is still clipped by the floating right tool rail overlapping it — that is the right rail's width vs. the toolbar's chip row, unrelated to the view-switcher pill; logged as a new open item, not closed by this fix. | ARTIFACT_ANATOMY_STANDARD.md §19.1 responsywność (desktop-first breakpoints must not overlap/obscure controls); §11.2 Menu 2 zone |
| F-01 | P2 | `g4__mindmap__baseline__1440x900__{dark__pl,dark__en}.png` | A dashed mind-map connector edge routes directly across the "Przejście z time&material na milestone fixed-fee" node, striking through its text and reducing readability. The identical node in the light-theme capture of the same idea does not show this — the force-directed graph layout is evidently non-deterministic between separate renders, and this particular random layout happened to collide in the dark captures. Text remains legible despite the strike-through. | General canvas-edge-routing quality; not a token/crimson/focus violation |
| F-04 | P2 | `g4__whiteboard__baseline__1440x900__{dark__pl,dark__en}.png` | Two of the four sticky notes on the whiteboard show a warm amber/gold halo (box-shadow) around their border in dark mode; the other two notes (same board, same state) do not, and none show it in the light-theme captures. Sampled color is warm (R>B) but far from crimson `#85182F`, and not the mandated blue `c-focus`. Semantic meaning unclear from a static screenshot (possibly a low-opacity shadow that's simply imperceptible against a near-white light background but pops against dark) — if it is meant to signal state (e.g. one of the "4 unconnected elements"), that signal is effectively invisible in light theme. | DoD §18.1 "Light + dark czytelne; tokeny c.* (zero navy/slate/hex)" — asymmetric visibility between themes for what may be a stateful indicator |
| F-02 | P2 | `g4__mindmap__zoom200reflow__720x450__light__pl.png` | Right canvas tool rail (`⑩`, §10.2) is taller than the 450px-high viewport; the lowest icons (link, play, upload, undo/redo, more) are clipped at the bottom with no visible scroll affordance in the static capture. | ARTIFACT_ANATOMY_STANDARD.md §10.2 "Lewy rail `⑩` narzędzia"; §19.1 responsywność |
| F-05 | N/A — already fixed upstream, logged for the record only | `g4__processflow__baseline__1440x900__light__pl.png`, `..dark__pl.png`, `..1280x800__light__pl.png`, `..zoom200reflow__720x450__light__pl.png` | "Kroki N \| **Lanes N**" — "Lanes" stays in English inside every PL Process Flow capture in THIS worktree, while the equivalent EN captures correctly show "Steps N \| Lanes N". Per task brief this exact chip was already found and fixed on the integration branch; this worktree (`3dd93792b9`) predates or does not include that fix. Not counted as a new finding, listed once per instruction. | (informational only) |

**Severity note:** no P0s. F-06 and F-03 are P1 (a user hits them directly, at required breakpoints, and they are unambiguously, visibly broken — not "could be prettier"). F-01/F-02/F-04 are P2 (visible, real, but cosmetic/edge-case/non-blocking). F-05 is explicitly excluded from scoring per the task brief.

**Crimson trap: no violations found.** Checked CTAs (Convert/Konwertuj buttons — dark navy `#0F172A`-ish, not crimson), status-lifecycle pills (purple/blue/green tones), selected/active tab states (neutral surface highlight), and the "No"/"Koniec" semantic red on Process Flow (bright red `(232,5,56)`, confirmed different from brand crimson `#85182F` and used for a legitimate Yes/No/Start/End semantic, not as CTA/active-state/focus). No `primary-*`-as-crimson misuse observed in any of the 24 captures.

**Focus rings:** none of the 24 static captures show an element in a keyboard-focus state (no screenshot was taken mid-Tab-navigation), so focus-ring color could not be visually verified from these captures either way — see NOT MEASURED.

---

## 3. NOT CAPTURED / NOT MEASURED

- **Focus-ring color/visibility**: no capture shows an interactive element in `:focus-visible` state. Cannot visually confirm or deny blue `c-focus` compliance from these 24 screenshots; `check-focus-canon.sh` (run separately, see §4) is the only signal available for this run, and it is a repo-wide static-analysis heuristic, not a check of these specific screens.
- **Text contrast ratios**: not computed. Per instructions, judging contrast reliably requires measuring the actual composited pixel colors with a proper contrast tool, not eyeballing a screenshot; no such tool was run in this pass. Reported as NOT MEASURED rather than guessing a ratio anywhere in this document.
  **UPDATE 2026-08-12 (stream S1-CONTRAST, RISK-35):** contrast WAS since measured (a later
  stream, `21_FOCUS_AND_CONTRAST.md` §3) and four measured FAILs were fixed — see
  `21_FOCUS_AND_CONTRAST.md` §8 for the authoritative before/after ratios, file:line diffs, and
  screenshots (`fix__table__rowactions-rest__{light,dark}__pl.png`,
  `fix__mindmap__l2-badge__{light,dark}__pl.png`,
  `fix__processflow__swimlane-klient__{light,dark}__pl.png`). Affected cells in this document's
  §1 table: row 2 (Idea Table baseline, kebab icon-only button) and the Process Flow baseline
  rows (swimlane labels) carried this contrast defect at the time of THIS document's original
  pass but were not flagged here because contrast was explicitly out of scope for this
  24-screenshot layout review — not a contradiction, a different pass measuring a different
  thing. This update is a pointer only; §1's PASS/FAIL verdicts in this document were about
  layout/clipping/overlap, not text/icon contrast, and are left unchanged.
- ~~Table archetype at 1280x800 and 720x450 with a row selected~~ — **superseded**: F-06 turned out to be a harness bug, not gated on row selection at all (see correction in the F-06 row above); this NOT-MEASURED item no longer applies. Still genuinely not captured in this pass: a Table screenshot with an actual ROW clicked open (the row-preview flyout built into `IdeasTableContent`, distinct from the outer artefakt panel) at any viewport — none of the 6 recaptured Table shots click a row.
- **Whiteboard amber glow (F-04) semantic meaning**: could not determine from static images whether the glow is a deliberate "unconnected element" indicator, a stale hover/selection state coincidentally captured, or an unintended shadow leak. Would need to inspect the component source or interact with a live render to know for certain.
- **Mind-map edge-through-text (F-01) reproducibility**: only observed in the two dark captures; whether it's a stable per-idea layout seed or genuinely random per-render was not tested (would require re-rendering the same idea multiple times, which this stream was explicitly told not to do).
- **Right tool rail scroll affordance (F-02)**: cannot tell from a static PNG whether the rail is actually scrollable (with a scrollbar/gesture) and the icons are merely below the fold, or whether they are truly unreachable. Only the visual clipping itself is confirmed.
- **Any interaction, hover, or keyboard-navigation states** beyond what happens to be visible in these 24 static baseline/viewport captures — this review is limited to what a screenshot shows, per the task's own framing.
- **NEW (stream VISUAL-2, 2026-08-10): Process Flow "Brak ostrzeżeń" chip clipped by the right tool rail at 720x450** — visible in both the before- and after-fix Process Flow zoom-reflow shots (`g4__processflow__zoom200reflow__720x450__light__pl.png`, `fix__processflow__zoom200reflow__720x450__light__pl.png`). Confirmed it is NOT caused by the view-switcher pill (the F-03 fix target) — the floating right tool rail simply overlaps the toolbar's rightmost stat chip at this narrow width. Root cause not investigated (out of scope for this stream's task). Not filed as a numbered F-id; flagged here so it isn't lost.
- **Whiteboard/Process Flow at 1440x900 and 1280x800 after the F-03 fix**: verified visually (`verify__whiteboard__{1440x900,1280x800}__light__pl.png`, `verify__processflow__{1440x900,1280x800}__light__pl.png`) but these verification renders were saved to `/private/tmp/.../scratchpad/shots/` only, not committed to `docs/qa/.../screenshots/` — they are not part of the repo's evidence trail, only this document's word that they were looked at.

---

## 4. Guard exit codes

Run from worktree root `/Users/piotrwisniewski/consultify-wt/ideas-visual-gate`, real exit codes captured directly (`echo "EXIT=$?"` immediately after each command, never piped to `tail`):

| Script | Exit code | Result summary |
|--------|-----------|-----------------|
| `scripts/check-focus-canon.sh` | **0** | Reports 130 files / 261 occurrences of crimson-as-focus (`ring-primary-*` instead of `ring-c-focus`) at repo scale, 77% file coverage compliant. This is a repo-wide informational report, not a per-commit gate — it exits 0 regardless of the existing violation count (no ratchet/baseline comparison logic observed in its output, unlike the other two scripts). None of the 24 g4 screenshots were in a focus state, so this count is unrelated to what was visually reviewed here. |
| `scripts/check-artefakt.sh` | **0** | "brak nowych naruszeń crimson w powłoce artefaktów (aktualnie 7, baseline 7 — dług nie rośnie)" — ratchet-based, existing debt of 7 violations repo-wide, not increasing. Karty-N ratchet also flat (0/0). |
| `scripts/check-list-canon.sh` | **0** | Staging was empty, so it fell back to a full repo scan: "408 naruszeń, baseline 409 — dług nie rośnie" (debt actually dropped by 1, script suggests running `--update` to bank the improvement, not done here since no code was changed in this pass). 1 of 12 `*Hub.tsx` files still uses legacy menu without `StandardModuleBar` import. |

All three guards pass (exit 0) under their respective ratchet/ceiling logic; none of them specifically re-check the exact 24 screens reviewed above, so a clean guard exit does not by itself confirm or contradict any finding in §2 — it only confirms the *codebase's* known-debt count didn't grow in this worktree.

---

## 5. Guard exit codes — stream VISUAL-2 recapture, `/Users/piotrwisniewski/consultify-wt/ideas-visual2`, stamp `b03937fcf9`, 2026-08-10

Run from this worktree's root, real exit codes captured directly (`echo "EXIT=$?"` immediately after each command, never piped to `tail`), after the `IdeaViewSwitcher.tsx` fix and all recaptures, changes left uncommitted per task instruction:

| Script | Exit code | Result summary |
|--------|-----------|-----------------|
| `scripts/check-focus-canon.sh` | **0** | Same repo-scale informational report as §4 (130 files / 261 crimson-as-focus occurrences, 77% coverage) — unchanged, this stream touched no `ring-*` classes. |
| `scripts/check-artefakt.sh` | **0** | "brak nowych naruszeń crimson w powłoce artefaktów (aktualnie 7, baseline 7 — dług nie rośnie)"; karty-N ratchet flat (0/0) — unchanged. |
| `scripts/check-list-canon.sh` | **0** | Staging was empty (nothing staged, per instruction not to commit), so it fell back to a full repo scan: 161 files, 408 violations vs baseline 409 — debt still down by 1, unchanged from §4. 1/12 `*Hub.tsx` legacy-menu note unchanged. |
| `scripts/check-gestosc.sh` | **0** | "brak regresji mechanicznych (sprawdzono plików: 1)". |

All four guards pass (exit 0); none flag the `IdeaViewSwitcher.tsx` change or the screenshot files (guards check source, not images). No baseline was raised.

---

## UPDATE 2026-08-11 — owner rejection, root cause, and the full 24-cell re-verification

### What the owner rejected, and why the earlier entry was wrong

This document previously carried finding **F-03** (the floating view-switcher pill
overlapping the Menu-2 row at 720×450) as fixed, and separately logged the right
rail clipping the "Brak ostrzeżeń" chip as a **residual finding, out of scope**.

The owner reviewed the submitted
`screenshots/fix__processflow__zoom200reflow__720x450__light__pl.png`, saw the
clipped chip, and returned Gate 4 as **FIX_REQUIRED**. He is right. Two different
collisions existed at the same viewport; fixing one and filing the other as
"residual" left a visible truncation in an image being offered for acceptance.
Calling it out in a subordinate clause did not discharge it.

### Root cause of the rail collision

`src/components/shared/ExecutiveModuleShell/index.tsx` measures the floating right
tool rail's real width but, in `centerMode='canvas'`, deliberately zeroes the
reserved gutter so ReactFlow keeps full-bleed width. That decision is still
correct for the canvas itself — but `ProcessFlowToolbar` and `WhiteboardToolbar`
render as ordinary DOM inside that full-width wrapper, and their Menu-2 badges are
right-aligned. The absolutely-positioned rail (`right:0`, `inset-y-0`) therefore
overlapped real content: "Brak ostrzeżeń" → "Brak os…". A stale comment in the
shell even *claimed* the gutter was reserved while the code below forced it to 0.

### The fix

Reserve space only where real content lives, not by shrinking the canvas. The
shell now also tracks the unclamped rail width and exposes it as a CSS custom
property `--mels-rail-gutter` on the canvas-content wrapper; both toolbars apply
`padding-right: var(--mels-rail-gutter, 0px)`. Their existing `flex-wrap` /
`overflow-x-auto` then does the right thing inside a correctly-sized container —
no new mechanism, and no shrinking text into unreadability.

### The matrix the owner asked for — 24 cells, all captured and all looked at

`g4v2__{tool}__{viewport}__{theme}__{locale}.png`, SHA `d2d18aa05f`.
24 files, **24 distinct checksums** (no blank or duplicated frames).

| Tool | 720×450 | 1280×800 | 1440×900 |
|---|---|---|---|
| Process Flow — light pl / light en / dark pl / dark en | PASS ×4 | PASS ×4 | PASS ×4 |
| Whiteboard — light pl / light en / dark pl / dark en | PASS ×4 | PASS ×4 | PASS ×4 |

PASS here means, per cell: **no Menu-2 element occluded or truncated, and no
right-rail control occluded or truncated.**

The orchestrator independently opened and inspected the originally-rejected cell
(`processflow 720×450 light pl` — "Brak ostrzeżeń" now renders in full, the badge
row wraps to its own line, clear gap before the rail) and the hardest contrast
case (`processflow 720×450 dark en` — "Steps 7 / Lanes 2 / No warnings" all
complete on one row, rail clear).

The earlier view-switcher fix was checked for regression by live DOM measurement
rather than by eye: at 720×450 the pill's top sits below the toolbar chrome's
bottom on both tools (Process Flow 197.5 > 189.5; Whiteboard 105.5 > 97.5),
`overlap: false`.

### Consequence for the older evidence

`fix__processflow__zoom200reflow__720x450__light__pl.png` and its whiteboard
sibling are **superseded** — they show the pre-fix rail collision and must not be
cited as acceptance evidence. The `g4v2__*` set replaces them.

### Still NOT captured at this gate

- Interactive behaviour (opening mode tabs, the overflow menu, dragging nodes) —
  the 24 cells are static first-paint layout only.
- A Process Flow carrying more badges or longer labels than the harness mock, or
  a semantic-kit chip alongside the mode tabs. The `flex-wrap` fallback is
  expected to hold, and that expectation is **not** evidence — it was not
  screenshotted.
- Viewport widths between 720 and 1280, and heights between 450 and 800.

---

## RECAPTURE — Stream S9-GATE4EVIDENCE, 2026-08-12: g4v3 Table set + RISK-19/RISK-29 reconciliation

This stream's Mission B/C: recapture the Idea Table evidence RISK-29 says is still missing,
and independently re-verify the rail-collision fix RISK-19 says is done. Both traced, both
spot-checked, findings below. **I did not edit `16_OPEN_RISKS_AND_LIMITATIONS.csv` — the
proposed RISK-29 row text is at the bottom of this section, for the session owner to write.**

### Independent trace of the `--mels-rail-gutter` fix (not taking RISK-19's word for it)

Read the code myself, not just the doc above:

- `src/components/shared/ExecutiveModuleShell/index.tsx:319-370` — `railGutter`/`railExtent`
  state, measured via `ResizeObserver` + `getBoundingClientRect()` on
  `[data-mels-floating-rail-surface]` (the rail is `createPortal`-ed to `document.body`, so a
  tree-based measurement would read zero — the code explicitly guards against that). Line 488
  sets `'--mels-rail-gutter': `${railExtent}px`` as a CSS custom property on the canvas-content
  wrapper.
- `src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:277` — `style={{ paddingRight: 'var(--mels-rail-gutter, 0px)' }}`.
- `src/components/MyWork/processflow/ProcessFlowToolbar.tsx:338` — same line, same pattern.

Both toolbars consume the same measured variable the shell publishes. This is a real,
measured-not-guessed fix (ResizeObserver, not a hardcoded px guess), independently confirmed.

### Spot-check — 2 of the 24 `g4v2__*` 720×450 captures, opened and inspected myself

- `g4v2__processflow__720x450__light__pl.png`: cropped and 3x-upscaled the top-right corner.
  The "SEL" mode-badge chip sits fully clear of the floating right rail, with a visible gap
  between the chip's right edge and the rail's rounded left edge. No overlap, no truncation.
- `g4v2__whiteboard__720x450__dark__en.png`: same crop treatment. Same result — the "SEL" chip
  clears the rail with a visible gap in dark theme too.

Both cells genuinely clear the collision. Consistent with the 24-cell PASS table above.

### Table recapture — 4 new `g4v3__table__1440x900__{light,dark}__{pl,en}.png` files

Captured via a throwaway Playwright script (not committed — one-off capture, not reusable
tooling) against this worktree's own dev server, `idea-table` screen, **with S1-CONTRAST's
kebab-opacity fix in place** (cherry-picked commits `7fff6a1078`..`705c066180`, this stream).
All four opened and inspected with the Read tool. Per cell:

| Cell | 5 right-panel headers | Clipping | Overlap | Kebab at rest |
|---|---|---|---|---|
| light/pl | AKCJE·WŁAŚCIWOŚCI·POWIĄZANIA·KOMENTARZE·HISTORIA/AI, all in full | None | None | **Not in frame** — see below |
| dark/pl | Same 5, all in full, correct dark tokens | None | None | Not in frame |
| light/en | ACTIONS·PROPERTIES·RELATIONS·COMMENTS·HISTORY/AI, all in full | None | None | Not in frame |
| dark/en | Same 5, all in full | None | None | Not in frame |

**Kebab-at-rest finding (measured, not eyeballed):** at 1440px total width with the 320px
`ArtifactRightPanel` reserved (`aside` rect confirmed `x:1120, width:320` via
`getBoundingClientRect()`), the table's own fixed column widths (`select 40 + title 560 +
stage 150 + tags 230 + tool 190 + date 128 + actions 56 = 1354px`) don't fit in the remaining
`1120px`. The table's own `.app-table-scrollbar` div (`overflow-x: auto`) safely contains the
overflow — confirmed `scrollWidth 1355` vs `clientWidth 1120`, **no visual overlap onto the
panel** (this is NOT a repeat of the original `min-w-0` bug; that one had no scroll container
and pushed the panel off-canvas). But it does mean the Data and row-actions (kebab) columns
sit past the visible edge at `scrollLeft: 0` in all four cells — confirmed by DOM measurement
(`kebabRect.right: 1343` vs the visible clip boundary at `1120`) and by scrolling the container
to its max (`scrollLeft: 235`) and re-screenshotting: the kebab **is** there, legible, at the
opacity S1's fix set (not part of the four required filenames — a supplementary check only).
This is a property of this specific dev-render composition (table + an extra 320px artefact
panel neither side reserves room for) at exactly 1440px — RISK-29's own corrected text already
establishes that production (`MyIdeasListContent.tsx:1785`) has no such competing panel, so
this is not expected to reproduce there. Not fixed, because it isn't a defect in the fixed
code path — flagged for the record, not silently omitted.

### A stale-evidence finding, not something I introduced: RISK-29's "only light/pl recaptured" claim does not match what's on disk

Before capturing anything new, I read the FOUR existing `g4__table__baseline__1440x900__*`
files (not just light/pl) to see what "not yet recaptured" would look like. All four are
already clean — opened and inspected with the Read tool just now, same result as the new
`g4v3` set (all 5 panel headers in full, no clipping, no overlap). Cross-checked against this
same document's own **"RECAPTURE — Stream VISUAL-2, stamp `b03937fcf9`, 2026-08-10"** section
above, which explicitly lists all four `g4__table__baseline__1440x900__*` files as
"Recaptured (overwritten) — was FAIL (F-06), now PASS" and states "F-06 is CLOSED." That
recapture predates this stream and predates RISK-35's kebab-contrast fix, but it is real and
it is on disk now, independently re-verified by me. RISK-29's CSV text ("only light/pl has
been recaptured so far") appears to be a documentation-sync gap against this same file, not
against the product — the session that wrote RISK-29's "CORRECTED 2026-08-10" text and the
session that ran Stream VISUAL-2's recapture were evidently not reconciled with each other.
I did not resolve which came first; I only verified what's true of the files as they exist now.

### Proposed corrected RISK-29 row (for the session owner to write — not written by me)

```
risk_id: RISK-29
epic_id: E13
category: visual
description: [unchanged from the current CORRECTED 2026-08-10 text — the harness
  root-cause analysis (min-w-0 missing, dev-render-only, zero production code
  touched) still stands and was not re-litigated by this stream]
evidence: [existing evidence line] || S9-GATE4EVIDENCE 2026-08-12: independently
  traced the --mels-rail-gutter fix (ExecutiveModuleShell/index.tsx:319-370,488;
  WhiteboardToolbar.tsx:277; ProcessFlowToolbar.tsx:338) and spot-checked
  g4v2__processflow__720x450__light__pl.png + g4v2__whiteboard__720x450__dark__en.png
  by eye — both clear, no overlap, no truncation. Recaptured all four Table cells
  at 1440x900 with S1-CONTRAST's kebab fix in place: g4v3__table__1440x900__
  {light,dark}__{pl,en}.png, all opened and inspected — 5/5 right-panel headers
  render in full in every cell, zero clipping, zero overlap. Also independently
  re-verified the pre-existing g4__table__baseline__1440x900__* set (all 4 cells,
  not just light/pl) and found it already clean, per this doc's own Stream
  VISUAL-2 section.
severity: P2
status: RESOLVED — both halves closed. Zoom-200 rail overlap: RESOLVED, code
  fix traced independently and reproduced clear in 2 fresh spot-checks (in
  addition to RISK-19's own 24-cell matrix). Table-evidence recapture: RESOLVED,
  g4v3 4-cell set is the first evidence combining the harness fix AND the
  RISK-35 kebab-contrast fix; the CSV's prior "only light/pl recaptured" claim
  is superseded (contradicted by both the new g4v3 set and the pre-existing,
  independently-re-verified g4__table__baseline__1440x900__* set). One
  non-blocking finding carried forward, not a defect: at exactly 1440px in
  this specific dev-render composition (table + the exploratory 320px
  ArtifactRightPanel), the row-actions kebab needs a horizontal scroll to
  reach — confirmed harmless (contained scroll, not a panel overlap) and
  confirmed not expected to reproduce in production, which has no competing
  panel at that width.
```

I am not marking Gate 4 PASS and not claiming owner acceptance — both remain the owner's
and the session coordinator's alone. This section only supplies the evidence trail and a
proposed row for RISK-29; the CSV itself was left untouched by this stream.
