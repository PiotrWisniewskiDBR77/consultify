# E5 — width x theme x axe matrix — REAL evidence, live stack

Data: 2026-08-12. Stack: backend 127.0.0.1:3001 (coordinator-owned, LIVE, real Postgres
`case-workspace-test-pg` 127.0.0.1:55432), frontend `vite --port 4501` proxying
`VITE_API_TARGET=http://127.0.0.1:3001` (launch.json entry
`case-workspace-wave-c4-deliverable-open-return`). Logged in via real
`POST /api/auth/login` (cw.local@local.test), token placed in `localStorage['token']`
exactly as `tokenService.ts` reads it — same procedure as
`LIVE_STACK_RUNBOOK.md` §8. axe-core 4.10.2 loaded live from CDN into the page
(`window.axe.run(document, {resultTypes:['violations']})`) — real DOM audit, not a
static lint.

Screens tested:
- **List** = `CasesListScreen` at `/zlecenia?ff_zlecenia=1` (349 real cases from DB).
- **Detail** = `CaseDetailScreen` Plan tab (`widok-planu=prosty`) at
  `/zlecenia/case-b9a5b56c-0652-4931-9594-13fb683c18ed?zakladka=plan&widok-planu=prosty`
  (real case "Transformacja 06b70681", 2 real plan steps, status W toku).

Method per cell: `resize_window` to the target width (height 900, or 1000 at 1920) →
wait for the page's entrance transition to settle (see note below) → run axe →
read `document.documentElement.scrollWidth` vs `clientWidth` for hidden horizontal
scroll.

**Important timing finding (not a false result — logged so future testers don't
misread it):** the detail screen has a fade/opacity entrance transition on
navigation/resize (framer-motion, `NModeHeader.tsx` + surrounding elements). If
axe is run immediately, it catches the DOM mid-fade and reports **transient**
`color-contrast` failures (up to 14 nodes) that are artifacts of the animation,
not real defects — confirmed by re-running axe after the fade settles (~2-3s)
and watching the count drop to the *real*, steady-state figure. All numbers
below are the **settled** (post-animation) reading. This is itself a data point
for the reduced-motion section.

## List screen — CasesListScreen (`/zlecenia`)

| Width | Theme | Hidden h-scroll | Critical | Serious | Notes |
|---|---|---|---|---|---|
| 320  | dark  | NO (320=320) | 0 | 1 (`color-contrast`, 5 nodes) | bottom-nav labels, see finding F1 |
| 375  | dark  | NO (375=375) | 0 | 1 (`color-contrast`, 5 nodes) | same |
| 430  | dark  | NO (430=430) | 0 | 1 (`color-contrast`, 5 nodes) | same |
| 768  | dark  | NO (768=768) | 0 | 0 | bottom-nav not rendered at this width |
| 1024 | dark  | NO (1024=1024) | 0 | 0 | |
| 1440 | dark  | NO (1440=1440) | 0 | 0 | |
| 1920 | dark  | NO (1920=1920) | 0 | 0 | 2 moderate (`page-has-heading-one`, `region`) |
| 320  | light | NO (320=320) | 0 | 0 | contrast issue is DARK-THEME ONLY |
| 375  | light | NO (375=375) | 0 | 0 | |
| 430  | light | NO (430=430) | 0 | 0 | |
| 768  | light | NO (768=768) | 0 | 0 | |
| 1024 | light | NO (1024=1024) | 0 | 0 | |
| 1440 | light | NO (1440=1440) | 0 | 0 | |
| 1920 | light | NO (1920=1920) | 0 | 0 | 2 moderate |

**14/14 cells: PASS on critical/serious axe gate except the 3 dark-theme mobile
cells (320/375/430), which fail on 1 serious cluster (F1, below). Zero hidden
horizontal scroll at any of the 14 cells.**

## Detail screen — CaseDetailScreen, Plan tab, real case (`/zlecenia/case-b9a5b56c-...`)

| Width | Theme | Hidden h-scroll | Critical | Serious | Notes |
|---|---|---|---|---|---|
| 320  | dark  | NO | 1 (`button-name`, F2) | 1 (`color-contrast`, 5 nodes, F1) | |
| 375  | dark  | NO | 1 (F2) | 1 (F1, 5 nodes) | |
| 430  | dark  | NO | 1 (F2) | 1 (F1, 5 nodes) | |
| 768  | dark  | NO | 1 (F2) | 0 | bottom-nav gone |
| 1024 | dark  | NO | 1 (F2) | 0 | +1 moderate `landmark-unique` |
| 1440 | dark  | NO | 1 (F2) | 0 | +1 moderate `landmark-unique` |
| 1920 | dark  | NO | 1 (F2) | 0 | +1 moderate `landmark-unique` |
| 320  | light | NO | 1 (F2) | 0 | contrast issue is dark-only here too |
| 375  | light | NO | 1 (F2) | 0 | |
| 430  | light | NO | 1 (F2) | 0 | |
| 768  | light | NO | 1 (F2) | 0 | |
| 1024 | light | NO | 1 (F2) | 0 | +1 moderate `landmark-unique` |
| 1440 | light | NO | 1 (F2) | 0 | +1 moderate `landmark-unique` |
| 1920 | light | NO | 1 (F2) | 0 | +1 moderate `landmark-unique` |

**14/14 cells: zero hidden horizontal scroll. All 14 cells fail the "zero
critical" axe gate on F2 (see below) — F2 is a shared-shell defect, present on
every width/theme because it is not responsive-conditional. 3 dark-theme mobile
cells additionally carry F1.**

## Findings behind the violations (both OUT OF ALLOWLIST — reported, not patched)

### F1 — `color-contrast` (serious), dark theme, viewport < 768px
Bottom mobile nav labels (`My Work`, `Licensed Tools`/Tools, `Initiatives`, `AI`,
`More`) render at 3.75:1 contrast (need 4.5:1) in dark theme.
- Source: `src/components/navigation/BottomNavigation.tsx:161`
  `'text-slate-600 dark:text-slate-500 active:text-primary-600 dark:active:text-primary-400'`
  — `dark:text-slate-500` (#64748b) on the app dark background (~#0f1729) measures
  3.75:1 (axe-reported, confirmed on composed background, not token-in-isolation).
- Fix suggestion: `dark:text-slate-500` → `dark:text-slate-400` (or a `c-text-*`
  token already audited to ≥4.5:1 on this surface).
- File `src/components/navigation/BottomNavigation.tsx` is **outside the E5
  allowlist** (`src/components/CaseWorkspace/**`, `src/utils/enumLabels.ts`) —
  reported, not patched by this packet.
- Affects both List and Detail Case Workspace screens identically (it's global
  chrome), confirmed present at 320/375/430, confirmed absent at ≥768.

### F2 — `button-name` (critical), all widths, both themes, Detail screen only
The artifact-shell back button has no accessible name — icon-only `<button>`
with no `aria-label`, no visible text, `<ChevronLeft>` SVG has no `aria-hidden`
compensating label.
- Source: `src/components/shared/NModeLayout/NModeHeader.tsx:352-359`:
  ```tsx
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClose}
    className="p-2 -ml-2 rounded-xl text-c-text-secondary hover:bg-state-hover transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
  >
    <ChevronLeft size={20} />
  </motion.button>
  ```
- Fix suggestion: add `aria-label="Wróć do listy"` (matches the visible label
  used elsewhere for this same action, e.g. "Wróć do listy zleceń" seen in the
  preview pane) to the `motion.button`.
- File `src/components/shared/NModeLayout/NModeHeader.tsx` is **outside the E5
  allowlist** — reported, not patched. This is shell chrome shared by every
  artifact screen in the app (not Case-Workspace-specific), so fixing it
  benefits far more than this module — recommend routing it to whoever owns
  SPEC-A shell (`ArtifactRightPanel`/`NModeHeader`).
- This is the only **critical** (zero-tolerance) axe finding in the whole
  width x theme matrix, and it fires on **every single detail-screen cell**
  (14/14), because it is not responsive-conditional.

## Moderate-only findings (not gating, listed for completeness)
- `page-has-heading-one` — no `<h1>` on either screen (both use `<h2>` as the
  top-level visible heading). Moderate, not required to be zero per the task's
  "critical/serious" bar, but worth a future ticket.
- `region` — some content outside a landmark region.
- `landmark-unique` — duplicate landmark role+name pair, appears only ≥1024px
  (extra chrome, e.g. right rail, becomes visible at that breakpoint).
