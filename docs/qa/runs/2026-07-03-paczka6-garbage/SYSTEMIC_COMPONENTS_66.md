# PACZKA 6 #66 — 4 systemic shared-component fixes: scoping + findings

Status: **scoped, NOT shipped in the hotfix window.** Rationale: TOP-3 (#62/#63) +
#61/#64/#65 were the deadline-critical items. #66 touches core shared components with
many live adopters; a rushed, unverified broad change before a client demo violates
"verify before claiming" / "self-audit before handoff". Findings below make each item
a contained, low-risk follow-up.

## (a) Checkbox + bulk in list tables (UI-T1 / UI-M2)
- **The shared component ALREADY supports it.** `src/components/shared/ModuleHub/FilterableTable.tsx`
  has a `selection` prop: select-all header checkbox (indeterminate when partial) +
  per-row checkbox (lines ~24, 81-82, 169, 448, 555). Designed opt-in ("omit to leave
  existing tables unaffected", canon §3.5).
- **Gap = per-adopter wiring, not a component build.** Tools/Assessment/Initiatives/
  Documents tables don't pass `selection` + don't render a bulk-action bar.
- **Follow-up:** for each target hub, hold `selectedIds` state, pass `selection` to
  FilterableTable, render a bulk-action bar (delete/archive/status) above the table.
  Verify each table live (regression surface = 24 adopters share the component).

## (b) Pill-frames on the 2nd menu bar (UI-T6/T9/M1)
- Canon: `docs/ui-standards/03-modules/13_MENU_2_MODULE_TOPBAR.md` (Menu 2) — the second
  bar's segmented controls/filters should use `ChipBase`/pill geometry (§4.2 of
  TABLE_AND_PREVIEW_CANON), not bare text.
- **Gap:** Tools/Assessment/Initiatives/Materiały render Menu-2 items as bare text.
- **Follow-up:** wrap Menu-2 segment items in the canonical pill frame. Contained per
  hub; verify visually.

## (c) Preview consistency (UI-P1 / UI-M3)
- Canon §11: preview footer fixed order (AI hints → divider → Relations → divider →
  Actions pill h-9); no duplicated title, no empty fields, no engineer jargon.
- **Gap:** Assessment/Initiatives/Documents previews show duplicated titles / empty
  fields / raw jargon.
- **Follow-up:** align each preview to the canonical `PreviewPaneShell` footer contract;
  strip duplicate title + jargon strings.

## (d) Button style chaos (UI-T4 / UI-T10)
- **Gap:** mix of bare-text vs pill vs filled buttons in Tools sessions / Initiatives
  toolbar.
- **Follow-up:** normalize to the primary/secondary/overflow hierarchy (ARTIFACT_ANATOMY
  + editor-shell command-row rules): one primary filled, secondaries as ghost/outline,
  rest into overflow.

## Recommendation
Each is a contained follow-up with an existing canonical target — no new primitives
needed. Sequence: (a) delivers the most user-visible value (Piotr flagged it across 4
modules) but has the widest regression surface → do it first WITH live verification per
table, not blind.
