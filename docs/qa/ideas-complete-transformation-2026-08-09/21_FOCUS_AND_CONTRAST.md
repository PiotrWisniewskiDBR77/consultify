# 21 — Focus-visible + Contrast (Gate 4 gap closure)

Stream: G4-FOCUS-CONTRAST. Worktree: `/Users/piotrwisniewski/consultify-wt/g4-focus-contrast`
(detached, stamp **`e0fc428a33`**). Date: 2026-08-11. Changes left uncommitted per instruction.

Closes two gaps the Gate 4 visual matrix (`19_VISUAL_CX_MATRIX.md`) explicitly logged as
**NOT CAPTURED** (no `:focus-visible` screenshot) and **NOT MEASURED** (no contrast ratio —
deliberately not guessed).

Harness: `dev-render/`, port **3611** (`npx vite --config dev-render/vite.config.ts --port 3611
--strictPort`, started manually via Bash — the browser-preview tool's `.claude/launch.json`
resolves against the *outer* session checkout, not this worktree, so the server was started
by hand from this worktree and the browser pane pointed at `http://localhost:3611` directly).
`.claude/launch.json` in this worktree got one new entry appended (`g4-focus-contrast`, port
3611) — nothing removed.

---

## 1. Method — how focus was driven, and a methodology finding that shaped everything else

Instruction: drive focus with **real keyboard interaction**, not `.focus()`. That surfaced a
defect before a single screenshot was taken:

**Forward `Tab` does not move focus at all on Mind Map, Whiteboard, or Process Flow.** All
three mount a document-level (`document.addEventListener('keydown', …)`, no `containerRef`,
so it is global, not scoped to the canvas) keyboard-shortcut hook that intercepts bare `Tab`
as "add child" / "add step" and calls `preventDefault()` — regardless of which element on the
page currently has focus, as long as it isn't a text input:
- `src/components/MyWork/hooks/useKeyboardShortcuts.ts:380` (Mind Map): `if (event.key ===
  'Tab' && !event.shiftKey) { if (onAddChild) { event.preventDefault(); onAddChild(); ... } }`,
  attached via `document.addEventListener('keydown', handleKeyDown)` at line 523.
- `src/components/MyWork/canvas/useIdeasToolKeyboard.ts:160` (shared hook used by Whiteboard
  `IdeaWhiteboardTool.tsx:3975` and Process Flow `IdeaProcessFlowTool.tsx:2544`, both called
  with no `containerRef`, so `target = containerRef?.current || document` at line 204 resolves
  to `document`): same `Tab && !shiftKey → onAddChild` pattern.

Verified with a minimal repro: fresh page load, click the "Konwertuj" button (real mouse
click, focuses it), press `Tab` once — focus stays on "Konwertuj" (confirmed via
`document.activeElement` before/after) and no visible focus ring ever gets a chance to render
on the *next* control, because there is no next control to land on.

**Worse, on Mind Map specifically, `Shift+Tab` also fires the add-child side effect**, even
though the guard explicitly reads `!event.shiftKey`. Minimal repro: fresh `resetMap=1` page
load, **zero mouse interaction**, a single `Shift+Tab` keypress → a new empty child node
("Wpisz…" placeholder) appears under the "Dyscyplina zakresu i wyceny" branch with its
type-picker menu open (Key Insight / Open question / Action Item / Evidence needed /
Hypothesis), confirmed reproducible across repeated clean runs (fresh browser context,
`resetMap=1`, no prior state). A `document`-level capture-phase event log shows the
synthesized `Tab` keydown already has `defaultPrevented: true` by the time it reaches even a
capture-phase listener on `document` itself, meaning some other, earlier-registered handler
intercepts it first. **Root cause not pinned to an exact line within this stream's budget** —
flagged as an open item, not guessed at. Practical consequence: **every Mind Map screenshot in
this report that required more than the very first Shift+Tab press shows that extra node and
its type-picker overlaid on the canvas** — this is not a capture artifact, it is what a
keyboard user actually gets, and it is reported as Finding F-K2 below, not silently cropped out.

Because forward `Tab` is inert, **`Shift+Tab` was used as the sole navigation mechanism** for
every capture (a real keyboard combo, dispatched via Playwright `keyboard.press('Shift+Tab')`,
confirmed to correctly set `:focus-visible` — Chromium applies `:focus-visible` to any element
whose focus resulted from a keyboard event, independent of what was focused immediately
before). Each target was reached by an isolated walk (fresh browser page per screenshot, no
cross-target reuse) from a side-effect-free anchor (an empty click on the canvas background for
the 3 canvas tools; no click at all for Table, where `Shift+Tab` from an unfocused document
already walks the real order). The Idea Table's own grid keyboard hook
(`src/components/MyWork/table/useTableKeyboard.ts:145`) also remaps `Tab` — but scoped to a
`containerRef` (the grid), not `document`, so it only affects `Tab` while focus is already
inside a table cell; less severe than the two document-global cases above, still worth a P2
note (see F-K3).

A first pass reached the CTA and one canvas-node target by *clicking the target itself* — that
was **wrong** (a mouse click on `Konwertuj` opens its dropdown and does not set
`:focus-visible`) and was redone: every one of the 40 screenshots below was re-captured
reaching the target exclusively via `Shift+Tab`, verified against a live event/state log before
the screenshot was taken.

## 2. Focus-visible matrix

All 40 screenshots were opened with the Read tool and visually inspected (not just measured
programmatically). Canon: ring must be blue `c-focus`
(`--c-focus-solid` `#2563eb` light / `#5b8def` dark, box-shadow recipe
`0 0 0 2px var(--c-focus-solid)`-ish, see `tailwind.config.js:701` `hig-focus`). Files live in
`docs/qa/ideas-complete-transformation-2026-08-09/screenshots/`, prefix `g4focus__`.

| Tool | Control | Light | Dark | Ring source | Verdict |
|---|---|---|---|---|---|
| Mind Map | CTA "Konwertuj" | `g4focus__mindmap__cta-convert__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow (`rgba(37,99,235,.4)` / `rgba(91,141,239,.45)`) | PASS |
| Mind Map | Menu-2 tool switcher ("Mapa myśli" tab) | `g4focus__mindmap__menu2-toolswitcher__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow | PASS |
| Mind Map | Toolbar icon-only ("AI") | `g4focus__mindmap__toolbar-ai-icon__light__pl.png` | `…__dark__pl.png` | native UA outline, `rgb(0,95,204)`/`rgb(153,200,255)` — blue, **not** the `c-focus` token | PASS (blue) / minor inconsistency, see F-K1 |
| Mind Map | Right-rail control ("Zaznaczanie") | `g4focus__mindmap__rightrail-select__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow | PASS |
| Mind Map | Canvas node (idea card) | `g4focus__mindmap__canvas-node__light__pl.png` | `…__dark__pl.png` | **none** — `outline:none`, `box-shadow:none` | **FAIL — invisible** (F-01) |
| Whiteboard | CTA "Konwertuj" | `g4focus__whiteboard__cta-convert__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow | PASS |
| Whiteboard | Menu-2 tab ("Whiteboard") | `g4focus__whiteboard__menu2-toolswitcher__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow (dark capture: switcher pill lands outside this particular pan/zoom crop — element confirmed focused programmatically, not clearly visible in-frame; see NOT MEASURED) | PASS (light) / inconclusive (dark) |
| Whiteboard | Toolbar icon-only ("Kształt") | `g4focus__whiteboard__toolbar-shape-icon__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow | PASS |
| Whiteboard | Right-rail control ("Zaznaczanie") | `g4focus__whiteboard__rightrail-select__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow | PASS |
| Whiteboard | Canvas node (sticky note) | `g4focus__whiteboard__canvas-node__light__pl.png` | `…__dark__pl.png` | **none** | **FAIL — invisible** (F-01) |
| Process Flow | CTA "Konwertuj" | `g4focus__processflow__cta-convert__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow | PASS |
| Process Flow | Menu-2 tab ("Process Flow") | `g4focus__processflow__menu2-toolswitcher__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow | PASS |
| Process Flow | Toolbar icon-only ("Decyzja") | `g4focus__processflow__toolbar-decision-icon__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow (blends into dark rail as a filled tint rather than a crisp ring at this icon size — still blue, still visibly distinct) | PASS |
| Process Flow | Right-rail control ("Zaznaczanie") | `g4focus__processflow__rightrail-select__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow | PASS |
| Process Flow | Canvas node (flow step) | `g4focus__processflow__canvas-node__light__pl.png` | `…__dark__pl.png` | **none** (the "Koniec" node's red border is its baseline Yes/No/End semantic color, unrelated to focus — confirmed via computed style: `outline:none`, `box-shadow:none`) | **FAIL — invisible** (F-01) |
| Table | CTA "Nowy pomysł" | `g4focus__table__cta-newidea__light__pl.png` | `…__dark__pl.png` | native UA outline, `rgb(0,95,204)`/`rgb(153,200,255)` — blue, not the token | PASS (blue) / minor inconsistency, see F-K1 |
| Table | Toolbar icon-only (row kebab, "Row actions") | `g4focus__table__toolbar-rowactions-icon__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow | PASS |
| Table | Right-rail-equivalent ("Ustawienia widoku" gear) | `g4focus__table__rightrail-viewsettings__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow | PASS |
| Table | Row control (star toggle) | `g4focus__table__table-row-star__light__pl.png` | `…__dark__pl.png` | custom `c-focus` box-shadow | PASS |
| Table | Row control (checkbox) | `g4focus__table__table-row-checkbox__light__pl.png` | `…__dark__pl.png` | native UA outline, blue | PASS (blue) / minor inconsistency, see F-K1 |

**Count: 40 screenshots captured, 40 opened and visually inspected.** No crimson
(`primary-*`/`#85182F`) focus ring found anywhere in the four tools. 3 controls FAIL with a
completely invisible ring (canvas nodes, all three canvas tools, both themes — F-01). 1 control
(Whiteboard's Menu-2 tab in dark theme) is programmatically confirmed focused but not clearly
visible in that specific capture's pan/zoom framing — logged as inconclusive, not scored PASS
or FAIL, see §4.

## 3. Contrast — method and results

**Method used: computed-style ancestor-walk compositing (Method 1)**, cross-verified with
**pixel-sampling of the actual rendered PNG via `sharp`** (Method 2) wherever Method 1 flagged
a translucent/`backdrop-filter` layer, and once to resolve an apparent contradiction (see
below). Method 1: for each control's text (or, for icon-only controls, the SVG's computed
`color`, matched against the WCAG "UI component" 3:1 threshold rather than the 4.5:1 text
threshold), walk from the element up to `<html>`, composite every ancestor's
`background-color` **in outermost-to-innermost order** (Porter-Duff "over"), and multiply the
foreground's alpha by the cumulative `opacity` of the element and its ancestors. This is the
"measure the actual composited background" approach the task specifically asked for, not a
read of the nearest ancestor's nominal token value — it matters here because several controls
sit on a `backdrop-filter: blur(...)` translucent panel (flagged `backdrop-blur` in the table;
Menu-2 tab strips on Whiteboard/Process Flow, the "4 niepowiązanych elementów" toast, the
Table's sticky column-header row) where reading only the immediate parent's nominal color would
have been wrong.

**One measurement was cross-checked and corrected.** A first look at
`g4focus__table__table-row-checkbox__dark__pl.png` was misread by eye as "the table body stays
white under `theme=dark`" — a plausible-looking dark-mode bug. Pixel-sampling the actual PNG at
multiple points (`sharp`, raw RGB extraction) came back `rgb(15,23,42)` / `rgb(21,33,59)` etc.
— genuinely dark navy, matching the computed-style read exactly. Re-cropping and re-viewing the
same file confirmed the table body **is** correctly dark-themed; the original read was a
misjudgment on a small inline preview, not a real defect. Retracted before it went in the
findings list — flagged here as a reminder that Method 2 pixel-sampling is what catches both
kinds of error (the token-vs-composited trap the task named, and a plain visual misread).

Font-size/weight was read per element to apply the correct WCAG threshold (≥24px, or ≥18.66px
bold = "large text", 3:1; otherwise 4.5:1; all UI-component/icon measurements use 3:1
regardless of size).

### 3.1 Results table

| Tool | Theme | Control | Foreground | Composited background | Ratio | Threshold | Verdict |
|---|---|---|---|---|---|---|---|
| Mind Map | light | CTA "Konwertuj" text | rgb(255,255,255) | rgb(15,23,42) | 17.85 | 4.5 | PASS |
| Mind Map | light | Menu-2 switcher label ("Mapa myśli") | rgb(100,116,139) | rgb(255,255,255) | 4.76 | 4.5 | PASS |
| Mind Map | light | Canvas node title | rgb(88,101,119) | rgb(241,245,249) | 5.41 | 4.5 | PASS |
| Mind Map | light | Branch node title | rgb(71,85,105) | rgb(241,245,249) | 6.92 | 4.5 | PASS |
| Mind Map | light | Node sub-label "L2" | rgb(88,101,119) | rgb(241,245,249) | 5.41 | 4.5 | PASS |
| Mind Map | light | Status pill "Kształtuje się" | rgb(71,85,105) | rgb(248,250,252) | 7.24 | 4.5 | PASS |
| Mind Map | light | Status pill "Zmiany w kolejce" | rgb(100,116,139) | rgb(255,255,255) | 4.76 | 4.5 | PASS |
| Mind Map | light | Note-card body text | rgb(71,85,105) | rgb(250,250,249) | 7.26 | 4.5 | PASS |
| Mind Map | light | Icon-only rail button "AI" (UI comp.) | rgb(100,116,139) | rgb(255,255,255) | 4.76 | 3.0 | PASS |
| Mind Map | light | Icon-only rail "Zaznaczanie" (UI comp.) | rgb(15,23,42) | rgb(248,250,252) *(backdrop-blur)* | 17.06 | 3.0 | PASS |
| Mind Map | light | Disabled button (auto-detected) | rgb(15,23,42) | rgb(255,255,255) | 17.85 | 3.0 | PASS |
| Mind Map | dark | CTA "Konwertuj" text | rgb(15,23,42) | rgb(244,247,251) | 16.61 | 4.5 | PASS |
| Mind Map | dark | Menu-2 switcher label | rgb(138,153,176) | rgb(15,23,42) | 6.18 | 4.5 | PASS |
| Mind Map | dark | Canvas node title | rgb(135,149,170) | rgb(18,25,42) | 5.76 | 4.5 | PASS |
| Mind Map | dark | Branch node title | rgb(148,163,184) | rgb(18,25,42) | 6.82 | 4.5 | PASS |
| Mind Map | dark | **Node sub-label "L2"** | rgb(92,107,129) | rgb(18,25,42) | **3.22** | 4.5 | **FAIL** |
| Mind Map | dark | Status pill "Kształtuje się" | rgb(184,196,214) | rgb(21,33,59) | 9.07 | 4.5 | PASS |
| Mind Map | dark | Status pill "Zmiany w kolejce" | rgb(138,153,176) | rgb(15,23,42) | 6.18 | 4.5 | PASS |
| Mind Map | dark | Note-card body text | rgb(184,196,214) | rgb(10,15,30) | 10.82 | 4.5 | PASS |
| Mind Map | dark | Icon-only rail "AI" (UI comp.) | rgb(148,163,184) | rgb(15,23,42) | 6.96 | 3.0 | PASS |
| Mind Map | dark | Icon-only rail "Zaznaczanie" (UI comp.) | rgb(244,247,251) | rgb(15,23,42) *(backdrop-blur)* | 16.61 | 3.0 | PASS |
| Mind Map | dark | Disabled button | rgb(255,255,255) | rgb(15,23,42) | 17.85 | 3.0 | PASS |
| Whiteboard | light | CTA "Konwertuj" text | rgb(255,255,255) | rgb(15,23,42) | 17.85 | 4.5 | PASS |
| Whiteboard | light | Menu-2 tab "Whiteboard" (active) | rgb(71,85,105) | rgb(248,250,252) *(backdrop-blur)* | 7.24 | 4.5 | PASS |
| Whiteboard | light | Toolbar "Wstaw" label | rgb(71,85,105) | rgb(248,250,252) *(backdrop-blur)* | 7.24 | 4.5 | PASS |
| Whiteboard | light | Section header "OBSZAR" | rgb(100,116,139) | rgb(255,255,255) | 4.76 | 4.5 | PASS |
| Whiteboard | light | Area title "DISCOVERY — WARSZTAT 1" | rgb(15,23,42) | rgb(255,255,255) | 17.85 | 4.5 | PASS |
| Whiteboard | light | Sticky-note header "NOTATKA" | rgb(100,116,139) | rgb(255,255,255) | 4.76 | 4.5 | PASS |
| Whiteboard | light | Sticky-note body text | rgb(15,23,42) | rgb(248,250,252) | 17.06 | 4.5 | PASS |
| Whiteboard | light | Toast "4 niepowiązanych elementów…" | rgb(51,65,85) | rgb(255,255,255) *(backdrop-blur)* | 10.35 | 4.5 | PASS |
| Whiteboard | light | Toast CTA "Działaj" | rgb(59,40,131) | rgb(235,234,243) *(backdrop-blur)* | 9.66 | 4.5 | PASS |
| Whiteboard | light | Icon-only "Kształt" (UI comp.) | rgb(71,85,105) | rgb(248,250,252) *(backdrop-blur)* | 7.24 | 3.0 | PASS |
| Whiteboard | light | Disabled button | rgb(15,23,42) | rgb(255,255,255) | 17.85 | 3.0 | PASS |
| Whiteboard | dark | CTA "Konwertuj" text | rgb(15,23,42) | rgb(244,247,251) | 16.61 | 4.5 | PASS |
| Whiteboard | dark | Menu-2 tab "Whiteboard" | rgb(184,196,214) | rgb(21,33,59) *(backdrop-blur)* | 9.07 | 4.5 | PASS |
| Whiteboard | dark | Toolbar "Wstaw" label | rgb(184,196,214) | rgb(21,33,59) *(backdrop-blur)* | 9.07 | 4.5 | PASS |
| Whiteboard | dark | Section header "OBSZAR" | rgb(138,153,176) | rgb(15,23,42) | 6.18 | 4.5 | PASS |
| Whiteboard | dark | Area title | rgb(255,255,255) | rgb(15,23,42) | 17.85 | 4.5 | PASS |
| Whiteboard | dark | Sticky-note header "NOTATKA" | rgb(138,153,176) | rgb(15,23,42) *(backdrop-blur)* | 6.18 | 4.5 | PASS |
| Whiteboard | dark | Sticky-note body text | rgb(244,247,251) | rgb(21,33,59) | 14.89 | 4.5 | PASS |
| Whiteboard | dark | Toast text | rgb(226,232,240) | rgb(21,30,50) *(backdrop-blur)* | 13.53 | 4.5 | PASS |
| Whiteboard | dark | Toast CTA "Działaj" | rgb(88,166,255) | rgb(27,43,70) *(backdrop-blur)* | 5.59 | 4.5 | PASS |
| Whiteboard | dark | Icon-only "Kształt" (UI comp.) | rgb(138,153,176) | rgb(15,23,42) *(backdrop-blur)* | 6.18 | 3.0 | PASS |
| Whiteboard | dark | Disabled button | rgb(255,255,255) | rgb(15,23,42) | 17.85 | 3.0 | PASS |
| Process Flow | light | CTA "Konwertuj" text | rgb(255,255,255) | rgb(15,23,42) | 17.85 | 4.5 | PASS |
| Process Flow | light | Menu-2 tab "Klasyczny przepływ" (active) | rgb(15,23,42) | rgb(248,250,252) | 17.06 | 4.5 | PASS |
| Process Flow | light | Menu-2 tab "Automatyzacja" (inactive) | rgb(100,116,139) | rgb(255,255,255) | 4.76 | 4.5 | PASS |
| Process Flow | light | Body/description text | rgb(71,85,105) | rgb(248,250,252) | 7.24 | 4.5 | PASS |
| Process Flow | light | **Swimlane label "Klient"** | rgb(100,116,139) | rgb(246,247,249) | **4.43** | 4.5 | **FAIL (borderline)** |
| Process Flow | light | Chip "Brak ostrzeżeń" | rgb(2,79,38) | rgb(231,242,231) | 8.47 | 4.5 | PASS |
| Process Flow | light | Flow node "Start" | rgb(15,23,42) | rgb(243,250,236) | 16.74 | 4.5 | PASS |
| Process Flow | light | Flow node "Koniec" | rgb(15,23,42) | rgb(253,241,237) | 16.14 | 4.5 | PASS |
| Process Flow | light | Edge label "Nie" | rgb(71,85,105) | rgb(250,250,249) | 7.26 | 4.5 | PASS |
| Process Flow | light | Decision node text | rgb(15,23,42) | rgb(250,250,249) | 17.09 | 4.5 | PASS |
| Process Flow | light | Icon-only "Decyzja" (UI comp.) | rgb(71,85,105) | rgb(248,250,252) *(backdrop-blur)* | 7.24 | 3.0 | PASS |
| Process Flow | light | Disabled button | rgb(15,23,42) | rgb(255,255,255) | 17.85 | 3.0 | PASS |
| Process Flow | dark | CTA "Konwertuj" text | rgb(15,23,42) | rgb(244,247,251) | 16.61 | 4.5 | PASS |
| Process Flow | dark | Menu-2 tab (active) | rgb(244,247,251) | rgb(21,33,59) | 14.89 | 4.5 | PASS |
| Process Flow | dark | Menu-2 tab (inactive) | rgb(138,153,176) | rgb(15,23,42) | 6.18 | 4.5 | PASS |
| Process Flow | dark | Body/description text | rgb(184,196,214) | rgb(21,33,59) | 9.07 | 4.5 | PASS |
| Process Flow | dark | Swimlane label "Klient" | rgb(138,153,176) | rgb(25,31,48) | 5.67 | 4.5 | PASS |
| Process Flow | dark | Chip "Brak ostrzeżeń" | rgb(179,213,106) | rgb(27,46,58) | 8.42 | 4.5 | PASS |
| Process Flow | dark | Flow node "Start" | rgb(244,247,251) | rgb(7,27,29) | 16.51 | 4.5 | PASS |
| Process Flow | dark | Flow node "Koniec" | rgb(244,247,251) | rgb(29,12,27) | 17.44 | 4.5 | PASS |
| Process Flow | dark | Edge label "Nie" | rgb(184,196,214) | rgb(10,15,30) | 10.82 | 4.5 | PASS |
| Process Flow | dark | Decision node text | rgb(244,247,251) | rgb(10,15,30) | 17.77 | 4.5 | PASS |
| Process Flow | dark | Icon-only "Decyzja" (UI comp.) | rgb(138,153,176) | rgb(15,23,42) *(backdrop-blur)* | 6.18 | 3.0 | PASS |
| Process Flow | dark | Disabled button | rgb(255,255,255) | rgb(15,23,42) | 17.85 | 3.0 | PASS |
| Table | light | CTA "Nowy pomysł" | rgb(250,250,249) | rgb(15,23,42) | 17.09 | 4.5 | PASS |
| Table | light | Column header "Tytuł" | rgb(100,116,139) | rgb(248,250,252) *(backdrop-blur)* | 4.55 | 4.5 | PASS (borderline) |
| Table | light | Row title text | rgb(15,23,42) | rgb(255,255,255) | 17.85 | 4.5 | PASS |
| Table | light | Row description text | rgb(100,116,139) | rgb(255,255,255) | 4.76 | 4.5 | PASS |
| Table | light | Status pill "Kształtuje się" | rgb(71,85,105) | rgb(248,250,252) | 7.24 | 4.5 | PASS |
| Table | light | Tag chip "rynek" | rgb(71,85,105) | rgb(248,250,252) | 7.24 | 4.5 | PASS |
| Table | light | Right-panel header "WŁAŚCIWOŚCI" | rgb(100,116,139) | rgb(255,255,255) | 4.76 | 4.5 | PASS |
| Table | light | Right-panel empty state "Brak komentarzy." | rgb(100,116,139) | rgb(255,255,255) | 4.76 | 4.5 | PASS |
| Table | light | Right-panel value "Bez folderu" | rgb(71,85,105) | rgb(240,241,243) | 6.70 | 4.5 | PASS |
| Table | light | **Icon-only "Row actions" kebab (UI comp.)** | rgb(181,187,195) | rgb(255,255,255) | **1.93** | 3.0 | **FAIL** |
| Table | light | Icon-only "Ustawienia widoku" (UI comp.) | rgb(100,116,139) | rgb(248,250,252) *(backdrop-blur)* | 4.55 | 3.0 | PASS |
| Table | light | Disabled button | rgb(15,23,42) | rgb(255,255,255) | 17.85 | 3.0 | PASS |
| Table | dark | CTA "Nowy pomysł" | rgb(10,15,30) | rgb(244,247,251) | 17.77 | 4.5 | PASS |
| Table | dark | Column header "Tytuł" | rgb(138,153,176) | rgb(21,33,59) *(backdrop-blur)* | 5.53 | 4.5 | PASS |
| Table | dark | Row title text | rgb(244,247,251) | rgb(15,23,42) | 16.61 | 4.5 | PASS |
| Table | dark | Row description text | rgb(138,153,176) | rgb(15,23,42) | 6.18 | 4.5 | PASS |
| Table | dark | Status pill "Kształtuje się" | rgb(184,196,214) | rgb(21,33,59) | 9.07 | 4.5 | PASS |
| Table | dark | Tag chip "rynek" | rgb(184,196,214) | rgb(21,33,59) | 9.07 | 4.5 | PASS |
| Table | dark | Right-panel header "WŁAŚCIWOŚCI" | rgb(138,153,176) | rgb(15,23,42) | 6.18 | 4.5 | PASS |
| Table | dark | Right-panel empty state | rgb(138,153,176) | rgb(15,23,42) | 6.18 | 4.5 | PASS |
| Table | dark | Right-panel value "Bez folderu" | rgb(203,213,225) | rgb(32,41,59) | 9.83 | 4.5 | PASS |
| Table | dark | **Icon-only "Row actions" kebab (UI comp.)** | rgb(49,60,81) | rgb(15,23,42) | **1.61** | 3.0 | **FAIL** |
| Table | dark | Icon-only "Ustawienia widoku" (UI comp.) | rgb(138,153,176) | rgb(21,33,59) *(backdrop-blur)* | 5.53 | 3.0 | PASS |
| Table | dark | Disabled button | rgb(255,255,255) | rgb(15,23,42) | 17.85 | 3.0 | PASS |

87 controls measured (both themes), all computed via Method 1 with `hasGradient`/
`hasBackdropBlur` flags recorded per row (12 rows sit on a `backdrop-filter: blur()` panel,
flagged above; none sit on a CSS gradient in these four tools' resting states). The "Row
actions" kebab FAIL was cross-checked with Method 2: extracting the actual button's 32×32
pixel block from `g4focus__table__toolbar-rowactions-icon__light__pl.png` and averaging its RGB
gives `(253,253,254)` — confirms the icon is genuinely a very light gray line on white at rest,
not a computed-style artifact.

## 4. Findings

| ID | Severity | Where | What | Rule |
|---|---|---|---|---|
| F-K1 | **P0** | Mind Map, Whiteboard, Process Flow (all instances, all themes) | Forward `Tab` never moves focus — intercepted document-wide as "add child"/"add step" and `preventDefault()`-ed, regardless of current focus target. A keyboard-only user cannot Tab through the toolbar, rail, or CTA at all in the forward direction. | WCAG 2.1.1 Keyboard, 2.4.3 Focus Order |
| F-K2 | **P0** | Mind Map (all instances) | `Shift+Tab` — the only working navigation key — also fires the "add child" side effect on the very first press, even on a completely fresh, unclicked page load. Creates a real, saved empty node with its type-picker open, visible in every Mind Map screenshot in §2. Root cause not pinned to an exact source line within this stream's budget (see §1) — a `document`-level listener earlier in the capture chain than this stream's own debug listener already has `defaultPrevented: true` on the synthesized `Tab` keydown before it's inspectable. | WCAG 2.1.1; data-integrity (mutates the map from pure navigation) |
| F-01 | **P1** | Mind Map / Whiteboard / Process Flow canvas nodes, all themes | Canvas nodes (idea cards, sticky notes, flow steps) are keyboard-focusable (confirmed reachable via `Shift+Tab`, `document.activeElement` correctly reports the node) but render **zero** visible focus indication — `outline: none`, `box-shadow: none` on all 6 captures (3 tools × 2 themes). A keyboard user has no way to tell which node is selected. | TRIADA_KANON.md focus rule; WCAG 2.4.7 Focus Visible |
| F-K3 | P2 | Idea Table | Idea Table's own grid keyboard hook (`useTableKeyboard.ts:145`) remaps `Tab` to move between grid cells rather than leaving the table, scoped to the grid container (not global like F-K1) — a debatable but non-standard pattern; not tested for keyboard escape from the last cell. | WCAG 2.1.1 (informational) |
| F-C1 | P2 | Mind Map, dark, node sub-label "L2" | Measured 3.22:1 against a 4.5:1 threshold — small badge text on dark canvas cards. | WCAG 1.4.3 |
| F-C2 | P3 | Process Flow, light, swimlane label "Klient" | Measured 4.43:1 against 4.5:1 — a hairline miss. | WCAG 1.4.3 |
| F-C3 | **P1** | Idea Table, both themes, row-actions kebab icon at rest | Measured 1.93:1 (light) / 1.61:1 (dark) against the 3:1 UI-component threshold — well under, in both themes, cross-verified by pixel sampling. Likely an intentional "reveal on row hover" pattern (common in table UIs), but the icon is still the only way to reach per-row actions and currently fails the strict AA non-text-contrast bar at rest. | WCAG 1.4.11 Non-text Contrast |
| F-K4 (informational) | — | Header row (Idee/Teresa/kebab), left icon rail (Przegląd/Właściwości/…/Wygląd), Table's "Nowy pomysł" CTA, Table row checkboxes | These controls render the browser's **native UA focus outline** (`rgb(0,95,204)` light / a lighter blue in dark) instead of the app's custom `c-focus` box-shadow recipe used everywhere else. Still blue, still visible, **not a canon violation** (canon requires blue, not a specific implementation) — flagged as a visual inconsistency worth a follow-up ticket, not fixed here per the "unambiguous token violations only" scope. | TRIADA_KANON.md (style consistency, not a hard rule) |

**No crimson focus rings found** in any of the 4 tools, 40 captures, or the `check-focus-canon.sh`
repo scan (below) — nothing to fix in this stream under the "unambiguous crimson → c-focus"
mandate, because there was no crimson to fix.

## 5. NOT CAPTURED / NOT MEASURED

- **Root cause of F-K2** (why `Shift+Tab` fires `Tab`'s handler on Mind Map): reproduced
  deterministically, not traced to an exact file/line within this stream's time budget.
- **Whiteboard Menu-2 tab, dark theme, visual confirmation**: `document.activeElement` and its
  computed `box-shadow` (`rgba(91,141,239,.45)`, correct `c-focus`) were captured
  programmatically, but the switcher pill is not clearly visible within
  `g4focus__whiteboard__menu2-toolswitcher__dark__pl.png`'s specific pan/zoom framing (130%
  zoom, panned to the workshop board) — not re-shot due to time; logged as inconclusive rather
  than scored PASS.
- **Keyboard escape from the Idea Table grid** (does `Tab` ever leave the last cell forward,
  and does `Shift+Tab` correctly leave the first cell backward into the toolbar) — not tested;
  only the within-grid remap in `useTableKeyboard.ts` was read from source.
- **Arrow-key navigation between canvas nodes** — the brief mentions arrow keys; this run used
  `Shift+Tab` exclusively (the only mechanism that reliably worked given F-K1/F-K2) and did not
  separately verify whether react-flow's own arrow-key node-to-node navigation exists or shows
  a ring.
- **Placeholder text contrast on Idea Table**: no `input[placeholder]`/`textarea[placeholder]`
  element is present in this screen's resting state (no search/filter box open) — genuinely not
  measurable without opening a different UI state; reported as not found, not guessed.
- **Gradient backgrounds**: none of the 4 tools use a CSS gradient behind any of the 87 measured
  controls in their resting/focused states surveyed here — 12 sit on `backdrop-filter: blur()`
  translucent panels instead (flagged and measured via Method 1, cross-checked once via Method
  2). A literal `background-image: gradient(...)` case was not found to test the "worst case
  along the gradient" instruction against.
- **Hover, active, and hover-then-focus compound states** — out of scope per the brief's focus
  on `:focus-visible`; not captured.
- **Focus ring on the "Column header 'Tytuł'" measurement** unexpectedly returned identical
  fg/bg to the "Ustawienia widoku" gear in both themes — plausible (same sticky header-row
  `backdrop-blur` strip) but not independently re-verified against a screenshot crop; flagged so
  it isn't silently trusted at face value.

## 6. Guard exit codes (real, not piped to `tail`)

Run from this worktree's root:

```
$ ./scripts/check-focus-canon.sh; echo "EXIT=$?"
```

| Script | Exit code | Result summary |
|---|---|---|
| `scripts/check-focus-canon.sh` | **0** | Report mode (always exits 0 without `--ci`): 130 files / 261 occurrences of crimson-as-focus (`ring-primary-*` instead of `ring-c-focus`) at repo scale, 77% file coverage compliant, unchanged by this stream (no `ring-*` class was touched — nothing to fix, no crimson found in any of the 4 tools). Top-10 offenders are all outside the four Idea Workspace tools (billing, reports wizard, super-admin panels, partner portal, etc.) — none of the four tools examined here appear in the top offenders list. `IdeaMapWorkspace.tsx` appears once in the separate, non-gating **heuristic** section (dynamic `ring-2 ring-${cfg.color}-500/60`-style string construction) — flagged there as a manual-review candidate, not a confirmed violation, and unrelated to the focus rings actually rendered in this stream's 40 captures (all confirmed blue by direct inspection). |

No source files were changed in this stream — no crimson focus ring existed in the four tools
to fix, so nothing was touched under the "fix only unambiguous token violations" mandate.
`.claude/launch.json` received one additive entry (`g4-focus-contrast`, port 3611); nothing
removed.

## 7. SHA

Worktree base: **`e0fc428a33`** ("E15 PASS: two consecutive clean rounds, and the final gate
board"), detached HEAD, no commits made in this stream.
