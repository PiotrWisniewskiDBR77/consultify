# Consultify — Design System Standardization Plan (palette + components)

Synthesis of: `COMPONENT_COVERAGE_MATRIX.md`, `UI_FRAGMENTATION_SCAN.md`, `COLOR_PALETTE_AUDIT_AND_PROPOSAL.md`.
**Brand bar:** Google/OpenAI/Apple-class "2026 tech" (rounded, soft, generous whitespace), **Harvard Crimson used LIGHTLY** as the single accent, navy/neutral structural, light + dark. Includes the Landing Page. Components must enforce the standard.

## Diagnosis
- **Colors invert the intent:** crimson declared but reality = violet `primary` (6,336 CTAs, 17,707 total) + raw `slate` (84k) + 1,670 hex. crimson used only 231×. LP hero = hardcoded violet→fuchsia gradient + off-scale hex. → Need ONE central palette + demote violet → crimson as the sole accent.
- **Components mostly exist but barely used:** chips 99% bespoke (1,513), states 99% bespoke (863 raw spinners), modals 97% (453), tables 82% raw (232), 3 Button impls + 9,394 raw `<button>`. → Standardize by central tokens + filling 7 component gaps + enforcement.

## A. New canonical palette (semantic tokens, light + dark)
Centralize as CSS variables in `src/index.css` `:root` / `.dark`, mapped to a Tailwind `c.*` namespace, so the palette lives in ONE place. Apple-grade soft neutrals + crimson accent (restrained).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--c-bg` | `#FAFAF9` (warm off-white) | `#0B1220` (navy-950) | app background |
| `--c-surface` | `#FFFFFF` | `#0F172A` (navy-900) | cards/panels |
| `--c-surface-raised` | `#FFFFFF` | `#15213B` (navy-800) | popovers/chips |
| `--c-border-subtle` | `#EEF0F2` | `rgba(255,255,255,.06)` | hairlines |
| `--c-border` | `#E2E5E9` | `rgba(255,255,255,.10)` | default borders |
| `--c-text` | `#0F172A` | `#F1F5F9` | primary text |
| `--c-text-secondary` | `#475569` | `#94A3B8` | secondary |
| `--c-text-muted` | `#64748B` | `#64748B` | muted/placeholder |
| `--c-accent` (brand) | `#A51C30` (Harvard Crimson) | `#C8324A` (lifted for dark contrast) | **sole accent — key CTAs, active/selected, brand moments (LIGHTLY)** |
| `--c-accent-soft` | `rgba(165,28,48,.08)` | `rgba(200,50,74,.14)` | accent tint (selected bg) |
| `--c-focus` | `rgba(165,28,48,.35)` | same | focus ring (was violet) |
| `--c-success/warning/danger/info` | green/amber/rose/blue (soft) | lifted | status only (signal, not decoration) |

**Rule:** crimson is the ONLY brand accent and used sparingly; everything structural is neutral. Violet `primary` is demoted → its scale re-points to crimson (one config change recolors CTAs/active app-wide); violet survives only as chart series.

## B. Component standardization
**Canon already EXISTS (use, don't reinvent):** Sidebar, ModuleNavBar (Menu2), ModuleMenu3 styles, ui/primitives Button, FilterableTable/ResizableTable/ColumnResizer, TableWithPreviewLayout/PreviewPane, Badge, GridView/Card, Modal/Drawer, Input, Toast, RowActionsMenu, Dropdown, Avatar, Tabs, SearchInput, ActiveFilters.
**7 GAPS to build (additive):**
1. `TableSettingsPopover` (column visibility) — canonical.
2. `ModuleMenu3` **JSX shell** (not just class constants) — one wrapper all hubs use.
3. `ToolChip` / `DueChip` / `MetaChip` named exports (kill 1,513 ad-hoc spans).
4. `Select` / `Toggle` / `Switch` primitives wrappers (theming/a11y layer over shadcn).
5. `Banner` (inline info/warning/degraded) — general module banner.
6. `AIActionSlot` / `Menu3AITrigger` — enforce AI-in-Menu3-right rule.
7. Onboarding banner shell.

## C. Rollout (sequenced, gated tsc 0 / eslint 0 each)
- **P0 — Token foundation (additive, ~0 visual change):** add `--c-*` vars (light+dark) in index.css + Tailwind `c.*` map. Define `bg-hig-primary`/`hig-focus` → crimson.
- **P1 — Central recolor lever:** re-point `primary` scale + `hig-*` (gradient/focus) → crimson; demote violet. ONE config change → CTAs/active/focus become brand crimson app-wide (reversible). Subtly soften neutrals for Apple feel.
- **P2 — Landing Page:** fix EpicHeroSection violet→fuchsia gradient + LP off-scale hex → tokens/crimson (highest brand ROI, contained).
- **P3 — Canon components adopt tokens** (Button, ModuleNavBar, ModuleMenu3, chips, states): so all hubs inherit; build the 7 gap components.
- **P4 — Enforcement:** ESLint — forbid raw `#hex`, `bg-gradient`, new local Button/Modal/chip; require tokens. Freeze registry updated.
- **P5 — Long-tail sweeps (codemod, sequenced):** Badge sweep (1,513), LoadingState rollout (~860), Button consolidation (3→1 + raw sweep), Modal consolidation (453), `slate-*`→token where it changes look. These are large; do with visual checkpoints.

## D. What changes look like (verification)
P0/P1/P2 change the app's color centrally — after reload: crimson CTAs/active/focus, neutral surfaces, on-brand LP. Owner visual review recommended after P1/P2.
