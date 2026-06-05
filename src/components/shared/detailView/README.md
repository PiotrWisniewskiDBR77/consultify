# DetailView canon

Canonical detail-view primitives for the platform's **heavy artifacts** —
Insight and Initiative today, Task / Decision / Report next.

**Why:** every artifact detail view was hand-built with its own header, metric
layout, toolbar, sidebar and per-section formatting → visual chaos. The
Initiative document view (`src/components/Initiatives/InitiativeDocumentView.tsx`)
is the most polished of them (owner invested dozens of hours). These primitives
**extract that standard** so every artifact shares one look — and the rest of
the cards get pulled up to that bar.

Full rationale: `docs/audit/2026-06-05/_IV_MODULE_MASTER_PLAN.md` §7, plus
observations #21 (N/C views), #22 (adaptive sidebar), #23 (section card + AI),
#26 (toolbar), #27 (metric strip + ID artifact).

## The two layouts (owner principle)

- **Notion (N)** — left sidebar + one section at a time, lots of whitespace.
  Onboarding-friendly, focused. *(today's view)*
- **ClickUp (C)** — sidebar becomes a table of contents; all sections render in a
  dense 2-3 column grid. Power-user, big-screen, less clicking. *(to build)*

`ViewModeToggle` switches between them and persists per user.

## AI on three levels (owner principle — master plan §6)

AI is a **copilot, not autopilot** — strong support at three granularities:

| Level     | Where                         | Example                                    |
| --------- | ----------------------------- | ------------------------------------------ |
| `tool`    | artifact toolbar              | "Regenerate the whole insight"             |
| `section` | section header (right slot)   | "Regenerate the Problem section"           |
| `field`   | inline next to a field/cell   | "Suggest a target value for this KPI row"  |

`AIAssistLevel` types this; the `AIAssist` primitive (next) renders it. Every
level respects backend capabilities (`canUseAi`) and versions its output.

## Primitives

| Primitive        | Status  | Purpose                                                   |
| ---------------- | ------- | --------------------------------------------------------- |
| `MetricStrip`    | ✅ done | Inline metric row w/ dividers (kills the "10 boxes" #27)  |
| `ViewModeToggle` | ✅ done | N / C switch + per-user persistence                       |
| `DetailHeader`   | ⬜ next | back + title + artifact ID + copy-link + saved + N/C      |
| `ActionToolbar`  | ⬜ next | primary action + Export/Convert/AI dropdowns (#26)        |
| `SectionSidebar` | ⬜ next | grouped sections + numbers + drag + adaptive hide-empty   |
| `SectionCard`    | ⬜ next | one section card kanon + AI slot in header (#23)          |
| `AIAssist`       | ✅ done | 3-level AI slot (tool / section / field) + canUseAi gate   |
| `SummaryCard`    | ⬜ next | reusable compact artifact (C-mode + embed in Reports)     |

## House style

Match platform conventions: `navy`/`slate`/`primary` palette, dark-mode aware,
`rounded-full` pills, `text-[10px] uppercase tracking-[0.14em]` labels, hairline
dividers (`divide-*/[0.06]`). Color is **semantic, not decorative** — it lives in
status pills and AI accents, not in row backgrounds.

## Wiring (next step — with owner present)

These primitives ship unwired on purpose: the targets are 9525-line
(`InitiativeDocumentView`) and 5991-line (`InsightViewer`) components. Wiring
them is done deliberately, verified, not blind while the app is under test.
First wire target: the Insight metric strip (#27), then the Initiative header.
