# HANDOFF — Lane UI-G4 (automated G4 for all 15 UI-CANON surfaces)

Branch: `codex/claude-next-ui-g4` · worktree `/Users/piotrwisniewski/.codex/worktrees/ui-g4`
Baseline: `c4f84a2baa7f1ce9c7b03a68ebbd1783cdbc581b`
Nothing was pushed, merged, deployed or released. The worktree is clean.

## What this lane was for

Every `*-UI-CANON-001` record produced by the earlier closure lanes (a, b, c,
codex) stopped at `NOT_VERIFIED`, `PARTIAL` or `BLOCKED_HUMAN` for the same
reason: **no lane had ever run a truly mounted application**. G0 (lease), G1
(typecheck/build) and G3 (migration chain) were closed; G4 — the browser gate —
was not. This lane closes the automatable half of G4 for all 15 surfaces and
states plainly what remains human-only.

## Result: 15/15

| Task | Route | Primary cells | Secondary | H-overflow | axe crit/serious | Unnamed controls | Deep/Reload/Cold | Visible focus | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| `ADM-UI-CANON-001` | `/admin` | 12/12 | 3/3 | 0 | 0 / 5 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `ASM-UI-CANON-001` | `/assessment` | 12/12 | 2/2 | 0 | 0 / 0 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `CHAT-UI-CANON-001` | `/chat` | 12/12 | — | 0 | 0 / 12 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `EXE-UI-CANON-001` | `/execution` | 12/12 | 1/1 | 0 | 0 / 0 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `FIN-UI-CANON-001` | `/finance` | 12/12 | — | 0 | 0 / 0 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `INI-UI-CANON-001` | `/initiatives` | 12/12 | 2/2 | 0 | 0 / 8 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `INT-UI-CANON-001` | `/interview` | 12/12 | 1/1 | 0 | 0 / 0 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `MAT-UI-CANON-001` | `/presentations` | 12/12 | 2/2 | 0 | 0 / 2 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `MTG-UI-CANON-001` | `/meeting` | 12/12 | — | 0 | 0 / 0 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `MYW-AGT-UI-CANON-001` | `/my-work` | 12/12 | 2/2 | 0 | 1 / 1 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `ORG-UI-CANON-001` | `/organization` | 12/12 | 3/3 | 0 | 0 / 0 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `PRT-UI-CANON-001` | `/partner` | 12/12 | 2/2 | 0 | 0 / 2 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `RES-UI-CANON-001` | `/results` | 12/12 | 3/3 | 0 | 0 / 6 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `SET-UI-CANON-001` | `/settings` | 12/12 | 2/2 | 0 | 0 / 7 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |
| `TLS-UI-CANON-001` | `/discovery-tools` | 12/12 | 3/3 | 0 | 15 / 20 | 0 | ✓✓✓ | ✗ | `AUTOMATED_G4_FAIL / BLOCKED_HUMAN` |

"Primary cells" = 3 viewports (1440×900, 768×1024, 390×844) × PL/EN × light/dark.
214 screenshots in total, each bound by sha256 to the exact product SHA in its
`TASK_EVIDENCE.json`.

**No surface passes automated G4, and none is claimed to.** The single reason
every row is red is `ICR-G4-001` (the product's focus ring does not reach most
controls) — a cross-cutting defect this lane may not fix. Seven surfaces would
be clean but for it.

### What genuinely passed everywhere

- **Mounting**: 15/15 surfaces render their own content in all 12 cells, plus
  every declared secondary route — against real Postgres and a real session.
- **No horizontal overflow** in any cell of any surface, including 390×844.
- **Deep-link, reload and cold reopen** land on the surface for all 15. Cold
  reopen uses a brand-new browser context, so no SPA state is carried over.
- **No unnamed interactive controls** remain on any swept surface (three were
  fixed in this lane; see below).

## What this lane changed

| Commit | Scope |
|---|---|
| `9e3091a10f` | `tests/e2e/ui-canon-g4/**`, `scripts/g4/**`, harness docs — the sweep itself |
| `40e1a89bdd` | 4 source files — accessible names for controls axe proved unnamed |

The source change is `aria-label` / `htmlFor`+`id` / `sr-only` label / `role="switch"`
only, on `ProfileSettings.tsx`, `AdminMembersRolesPanel.tsx`,
`AdminSecurityPolicyPanel.tsx` and `PartnerLayout.tsx`. It removed the `label`,
`select-name` and `button-name` violations from Settings, Admin and Partner.

**Verified non-visual**: the Admin members panel was captured through the same
sweep at `HEAD~1` and at `HEAD`; the two screenshots are identical apart from the
run-generated e-mail address. That check mattered because the fix wraps two
selects in extra grid `div`s.

- `npm run type-check` → exit 0
- `npm run build` → exit 0

## Human blockers (nothing here is satisfied by an automated pass)

1. **Manual VoiceOver pass** — no tool substitutes for it, on any of the 15.
2. **Brand / visual acceptance by the UX owner** — required by `CLAUDE.md` §7
   before any of these screens is treated as accepted.
3. **Named target-role human acceptance** — per
   `docs/cleanup/agents/OWNER_DECISIONS_AND_MEASURABLE_GATES_20260816.md`, row
   "Human UI/VoiceOver".

An axe run with zero critical/serious findings is **not** a human sign-off, and
no record in this lane presents it as one.

## Integrator requests (out of lease, filed not fixed)

See `INTEGRATOR_REQUEST_UI_G4.md`.

- **ICR-G4-001** — the `html.focus-highlight :focus-visible` ring
  (`src/index.css:876`) does not reach most controls; 17–19 of 25 keyboard-reachable
  controls show no indicator, and those that do show the browser default, not the
  product token. Blocks the keyboard half of G4 on all 15 surfaces.
- **ICR-G4-002** — `color-contrast` (serious) on 8 surfaces; a brand/token decision.
- **ICR-G4-003** — `src/components/shared/ModuleHub/FilterableTable.tsx:1160`
  sets `role="button"` on `<tr>`, producing `aria-allowed-attr` (**critical**) and
  `nested-interactive` on every clickable row. Root cause located; one line fixes
  both classes on the two worst surfaces.
- **ICR-G4-004** — `ui/primitives/Select.tsx` has no `aria-label`/attribute
  passthrough (unlike `Input`), which is the systemic source of `select-name`
  across ~49 call sites.

No backend change is requested. No API was altered to make a UI test pass.

## Coverage this lane did NOT achieve — stated plainly

- **`forbidden` state was not exercised.** The test-support bootstrap issues one
  ADMIN session; provoking a real 403 needs a second, lower-privileged fixture in
  the same tenant, which that endpoint does not currently offer. Recorded as not
  covered rather than simulated — faking it would have required interception,
  which this harness forbids.
- **`stale`/conflict** is recorded as not present on the surfaces swept; no
  optimistic-concurrency conflict was reachable through the UI for a single
  session.
- **`loading`** is captured where a real skeleton/spinner appeared during boot.
  Where none was caught in the sampled window this is recorded as a measurement
  limit, not as a defect.
- **Secondary routes** are swept at desktop/PL/light only, not the full matrix.
- Dead ends confirmed and deliberately not swept as surfaces: My Work's Radar tab
  (`RADAR_ENABLED=false`, no override), and Organization's
  Members/Billing/Limits/Domains/Branding (always redirected away).
- `scripts/check-focus-canon.sh` reports the crimson-focus debt fell from
  128 files/259 occurrences to 124/253 as a side effect of the accessible-name
  commit. The baseline was **not** ratcheted down — that file is shared
  governance outside this lease.

## How to reproduce

`HARNESS.md` in this directory has the exact commands: own sandbox Postgres on
port 34940 built from the canonical migration chain (732 migrations, 1588 tables,
0 failures), backend on 3941, Vite on 3940, then `scripts/g4/run-sweep.sh all`.

One trap is written up there because it produced a false green before it was
caught: the first-run onboarding modal covers every surface for a new tenant, and
the sweep initially photographed **that** while reporting `surfaceRendered: true`.
It is now retired through the product's own `PUT /api/preferences`, and a surface
only counts as rendered when no dialog covers more than 15% of the viewport.

Two further self-corrections are recorded rather than hidden: the unnamed-control
probe initially ignored `placeholder` on `<textarea>` and `<label for>` on
`<button>`, overcounting two correctly-named controls; and secondary-route
screenshots initially overwrote the primary desktop/PL/light capture.
