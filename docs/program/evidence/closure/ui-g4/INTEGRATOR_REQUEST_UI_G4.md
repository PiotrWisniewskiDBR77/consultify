# INTEGRATOR_REQUEST — UI-G4 cross-cutting findings

Lane: `codex/claude-next-ui-g4` (UI-CANON G4, automated half).
Baseline: `c4f84a2baa7f1ce9c7b03a68ebbd1783cdbc581b`.
Harness: `docs/program/evidence/closure/ui-g4/HARNESS.md`.

These findings were reproduced in a truly mounted application against real
PostgreSQL with a real signed-in session. They are **outside this lane's lease**:
each is either a global visual change or a shared-component change that would
alter how every screen looks, which this lane may not decide. They are filed
here rather than fixed, and each `*-UI-CANON-001` record cites this document.

---

## ICR-G4-001 — the product's focus ring does not reach most controls

**Severity: blocks the keyboard/focus half of G4 on every surface swept.**

`src/index.css:876-879` defines the canonical focus ring:

```css
html.focus-highlight :focus-visible {
  outline: 2px solid var(--c-focus-solid, #2563eb);
  outline-offset: 2px;
}
```

`focusHighlight` defaults to `true` (`src/utils/accessibilityRuntime.ts:37`) and
the class is genuinely applied — a live session reports
`document.documentElement.className === "dark focus-highlight"`. The rule is also
served correctly by the dev server (verified by fetching `/src/index.css` and
grepping the emitted rule).

**Observed anyway**, walking the real keyboard tab order on `/my-work`:

| measurement | result |
|---|---|
| controls reached with 25 `Tab` presses | 25 |
| controls with no outline, no box-shadow, no ring on self/parent/::before/::after | 17–19 depending on run |
| controls that do show a ring | the browser default `1px solid rgb(163,191,245)` (`-webkit-focus-ring-color`), **not** the product's `2px` `--c-focus-solid` (`#5b8def` in dark) |

Each offending element reports `matches(':focus-visible') === true`, so the
pseudo-class is active; the declaration simply is not winning. Injecting the
identical rule with `!important` immediately changes the computed outline from
`1px rgb(163,191,245)` to `2px rgb(91,141,239)` — proof that the ring is
reachable and that the authored rule is being outranked, not that the token or
the class is wrong.

Reproduce:

```bash
node scripts/g4/probe-focus.mjs /my-work        # heuristic + full computed picture
node scripts/g4/probe-focus-rules.mjs /my-work  # CDP matched-styles for the winner
```

**Related governance already in the repo.** `scripts/check-focus-canon.sh` is a
pre-commit ratchet that meters a *neighbouring* debt: components that paint their
own focus ring with crimson `ring-primary-*` instead of the blue `c-focus` token
(`TRIADA_KANON.md:167`, `CLAUDE.md` "Pułapka nr 1"). At this baseline it reports
**128 files / 259 occurrences**; the accessible-name commit in this lane happens
to bring it to 124 / 253. That meter answers "is the ring the right colour",
while this finding answers "does a ring appear at all" — they are different
questions and the meter passing is not evidence for this one. The delta register
`docs/ui-standards/_DOC_CODE_DELTA_REGISTER.md` (D-01, D-05) is the existing home
for this topic and should absorb this finding.

This lane deliberately did **not** run
`bash scripts/check-focus-canon.sh --update-baseline` even though the debt fell,
because the baseline file is shared governance owned outside this lease.

**Why this lane did not fix it.** Making the focus ring appear on every control
is a product-wide visual change across all 15 surfaces at once. `CLAUDE.md` §9
forbids mass enabling of visual changes, and §7 requires owner acceptance on
clean screenshots before any visual change is seen by the owner. The correct
owner is the UX owner named in
`docs/cleanup/agents/OWNER_DECISIONS_AND_MEASURABLE_GATES_20260816.md` (row
"Human UI/VoiceOver").

**Requested**: attribute the losing cascade (shadow-DOM boundary and
component-level `outline` utilities are the two leading candidates), then decide
the fix and its rollout with the UX owner. Until then every surface's keyboard
evidence stays red on "visible focus".

---

## ICR-G4-002 — `color-contrast` violations (axe, impact: serious)

Present in every captured cell of the affected surfaces, in both themes.
Counts are per-cell totals across the 12-cell matrix and are recorded exactly in
each surface's `TASK_EVIDENCE.json` under `denominators.axeViolationIds`.

Contrast is a brand/token decision (the palette is owner-governed, and
`CLAUDE.md` §3 pins specific semantic colours), so this lane records it rather
than re-tinting tokens. **Requested**: UX owner ruling on the offending
token/most-used pairs, then a single token-level correction rather than
per-screen patches.

---

## ICR-G4-003 — `<tr role="button">` breaks row semantics (axe critical + serious)

**Root cause located: `src/components/shared/ModuleHub/FilterableTable.tsx:1160`**

```tsx
tabIndex={onRowClick || onRowDoubleClick ? 0 : undefined}
role={onRowClick ? 'button' : undefined}
```

Every clickable row of the shared `FilterableTable` is published to assistive
technology as a **button**, not a row. axe reports two violations on the very same
nodes (`tr[role="button"]:nth-child(1..n)`):

| rule | impact | why |
|---|---|---|
| `aria-allowed-attr` | **critical** | a `<tr>` re-roled to `button` still carries table-row ARIA that `button` does not allow |
| `nested-interactive` | serious | the row contains its own buttons, checkboxes and kebab menu, i.e. interactive controls inside an interactive control |

Observed on `/discovery-tools` and its three category routes (15 critical + 15
serious across the swept cells) and on `/my-work?tab=vault`.

**This was a well-intentioned accessibility change.** The code comment above the
line explains it was added so row preview is reachable by keyboard, citing TRIADA
canon part B points 41-43 ("full Tab cycle through all interactive elements").
The intent is right and should be preserved; the mechanism is wrong — `tabIndex`
plus a key handler achieves it without re-roling the row, or the row can expose a
single focusable control instead.

**Requested**: the owner of the shared `FilterableTable` / `StandardTable` canon
decides the replacement mechanism, because it changes keyboard behaviour in every
module hub at once. This lane must not restructure the list canon (`CLAUDE.md`
UI §1/§9), so it is reported rather than patched. Fixing this one line clears
**both** axe classes on the two worst surfaces in this sweep.

---

## ICR-G4-004 — `ui/primitives/Select.tsx` accepts no accessible name

**Severity: systemic source of the `select-name` violations; ~49 call sites.**

`src/components/ui/primitives/Select.tsx` renders a `<select>` whose id comes from
React's `useId()` (hence the `#_r_0_`, `#_r_1_`, `#_r_2_` targets axe reported) but,
unlike the sibling `Input` primitive, it does **not** spread native attributes and
exposes no `aria-label` prop. A caller that does not pass a visible `label` therefore
produces a permanently unnamed `<select>`, and no call-site fix can name it directly.

This lane fixed the Admin call sites by pairing each `SelectField` with an
`sr-only` `<label htmlFor>` — correct but a workaround. The primitive is shared with
Settings and ~49 other files, so changing it was explicitly out of this lane's lease.

**Requested**: add `aria-label` / native-attribute passthrough to the `Select`
primitive (matching what `Input` already does), then re-scan for `select-name`
across the modules this lane did not sweep. Every `SelectField` used without a
`label` prop anywhere in the app has the same latent defect.

---

## Not requested

No backend change is requested by this lane. No API was altered to make a UI
test pass. The one backend-adjacent problem met during setup — a migration that
could not apply against a **drifted donor database** — was resolved by building
the schema from the canonical chain instead of changing the migration; see
`HARNESS.md` §1.
