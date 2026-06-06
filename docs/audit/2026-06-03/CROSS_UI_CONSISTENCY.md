# Cross-Cutting — UI/UX & Design Consistency Audit
**Date:** 2026-06-03 | **Branch:** feat/wave1-foundations | **Grade: D+ → C**

Baseline was D (2026-06-02). Three concrete wins since then: (1) 57 `" 2.tsx"` debris files are gone, (2) `Admin/shared/Button` and `Admin/shared/Card` are now thin adapters over `ui/primitives` (forks retired), (3) X1 ESLint design guardrails are live and wired (warn level with `--max-warnings 0` enforcement gate). Everything else remains structurally unchanged.

---

## 1. Shell consistency

Four competing shell patterns still active across 2,279 `.tsx` files:

| Shell | Active files | Non-migrated user-facing views |
|---|---|---|
| `ModuleHub` (canonical) | **52** | — |
| `SplitLayout` (unapproved) | **18** | `MyWorkView`, `ExecutiveView`, `LeadershipDashboardView`, `InterviewView`, `StudioView`, `UserDashboardView`, `ImplementationView`, `ProjectIntelligenceView`, `RolloutTab` — plus 4 Assessment variants and 3 Full* views |
| `KimiWorkspaceShell` (unapproved) | **8** | `ExceleView`, `WordyView`, `PrezentacjeView`, `TabeleView` (all 4 Kimi lanes unmigrated) |
| `ExecutiveModuleShell` | **14** | Partial: `TabeleMelsView` migrated; 3 others still on `KimiWorkspaceShell` |

**8 actively-routed user-facing views** remain on `SplitLayout` (confirmed in `AppRoutes.tsx` lazy imports): `StudioView` (line 43), `MyWorkView` (46), `ImplementationView` (102), `ProjectIntelligenceView` (247), `ExecutiveView` (359), plus `LeadershipDashboardView`, `InterviewView`, `UserDashboardView`. These are high-traffic screens.

No progress vs. baseline on shell migration.

---

## 2. Design tokens

| Metric | 2026-06-02 | 2026-06-03 | Delta |
|---|---|---|---|
| Hardcoded hex (`#rrggbb`) in `src/components` | 1,458 | **1,450** | −8 (flat) |
| `style={{}}` inline blocks | 1,288 | **1,451** | **+163** (regression) |
| Arbitrary `bg-[#…]` values | 34 | **45** | **+11** (regression) |
| `slate-*` occurrences | 36,366 | **45,696** | **+9,330** (regression) |
| `crimson-*` usage (brand token) | ~0 | **79** | +79 (new) |
| `primary-600/700/800` leftover | unknown | **3,846** | still dominant |

**Crimson scale is defined** (`tailwind.config.js` lines ~34–46, full 50–950 range, `DEFAULT: '#A51C30'`, focus ring token) and used in 79 places. But it is dwarfed by 3,846 `primary-*` occurrences — the brand token is not yet the default.

The `slate-*` count jumped 9,330 lines since yesterday — new code written in Tailwind defaults, not navy tokens. The `style={{}}` and `bg-[#]` regressions confirm the ESLint guard is catching but not stopping new violations.

`token-radius`, `token-shadow`, `font-serif` usage: **0 occurrences** in `src/**/*.tsx` — these X1 tokens exist in config but are unused.

---

## 3. Shared primitives

Primitives exist but are fragmented:

- `src/components/ui/primitives/ErrorState.tsx` — exists
- `src/components/ui/primitives/LoadingState.tsx` — exists
- `src/components/ui/primitives/OnboardingHint.tsx` — exists
- `src/components/ui/composed/EmptyState.tsx` — exists
- `src/components/EmptyStates/EmptyStateWithActions.tsx` — **duplicate** (separate directory)
- `src/components/MyWork/shared/EmptyState.tsx` — **module-local duplicate**
- `src/components/MyWork/table/EmptyStateView.tsx` — **third MyWork variant**
- `src/components/shared/NModeBlocks/EmptyStateInline.tsx` — **fourth variant**

Combined `ErrorState | LoadingState | OnboardingHint | EmptyState` adoption: **52 files** out of 2,279. Usage rate ~2.3%. The primitives exist but modules reach past them.

---

## 4. State coverage gaps

**1,680 hand-rolled `animate-spin` occurrences** outside `LoadingState` (representative: `App.tsx` line ~40 `text-indigo-500` spinner — wrong color token; `InitiativeTasksTab.tsx` raw border spinner; `MaturityMatrix.tsx` emoji spinner `⌛`).

**184 views have `isLoading`/`loading` state** but only ~52 import any shared state primitive — leaving ~130+ views with ad-hoc loading UI. High infinite-spinner risk in: `LeadershipDashboardView`, `ProjectIntelligenceView`, `StudioView`, `AssessmentSessionEditorView`, `InitiativeManagementView`.

`EconomicsViewPlaceholder.tsx` still exists at `src/views/EconomicsViewPlaceholder.tsx` — full placeholder view still shipped. AppRoutes no longer contains `V4ComingSoonView` or explicit `coming_soon` hardcodes (resolved from baseline).

---

## 5. ESLint design guardrails

**Active and configured** in `eslint.config.js` lines 177–197:

- `no-restricted-syntax` warns on `style={{}}`, raw hex literals, `bg-[#…]` arbitrary values
- `no-restricted-imports` warns on `Admin/shared/Button` and `Admin/shared/Card` outside Admin scope
- `ui/` override block exempts the primitives layer correctly
- Level: **warn** (not error), with CI running `--max-warnings 0` as enforcement gate

Gap: `eslint.config.js` line 88–93 ignores `**/* 2.tsx` and `**/*2.tsx` patterns — this is vestigial from the now-deleted debris files, still harmless. The warn-not-error level means `--max-warnings 0` is the real gate; if the CI step is misconfigured or skipped, new violations slip through undetected. No evidence the CI gate is currently active (no `package.json` check run here).

---

## 6. Component duplication

**" 2.tsx" debris: 0 files** — fully cleared (was 57). Win.

**Admin/shared forks: retired** — `Button.tsx` and `Card.tsx` are now thin adapters, not independent implementations. Win.

**EmptyState duplication: 4 variants** remain (see §3). Not consolidated.

**Button implementations: still 2** — `src/components/ui/Button.tsx` (2-line re-export) + `src/components/ui/primitives/Button.tsx` (canonical). Minor but real.

---

## Grade: C (up from D)

Wins: debris cleared, forks retired to adapters, X1 ESLint rules live. Regressions: `slate-*` +9k, `style={{}}` +163, arbitrary colors +11. Core shell fragmentation (SplitLayout in 8 routed views, KimiWorkspaceShell in 4 lanes) unchanged.

---

## Prioritized stabilization backlog (visual session)

1. **[P0] ESLint: flip warn → error** for `style={{}}` and `bg-[#…]` — the regressions (+163 inline, +11 arbitrary) prove warn-only is insufficient. Do after a bulk cleanup sprint, not before.

2. **[P0] token-migration sprint: `primary-*` → `crimson-*`** — 3,846 `primary-600/700/800` hits. Start with navigation + module headers (highest visual impact). `slate-*` → `navy-*` is a longer tail (45k) but same priority class.

3. **[P1] SplitLayout → ModuleHub migration** for the 8 routed views. Priority order: `MyWorkView` (simplest), `ExecutiveView`, `LeadershipDashboardView`, then the 5 others. Assessment variants (`AssessmentHubDashboard`, Full* views) can stay on SplitLayout if assessment remains a custom experience.

4. **[P1] KimiWorkspace: migrate ExceleView, WordyView, PrezentacjeView → ExecutiveModuleShell**. TabeleMelsView is already done as the reference. 3 lanes remain on `KimiWorkspaceShell`.

5. **[P2] EmptyState consolidation** — delete `MyWork/shared/EmptyState`, `MyWork/table/EmptyStateView`, `EmptyStateWithActions`, `EmptyStateInline`; redirect all to `ui/composed/EmptyState` + `ui/primitives/OnboardingHint`. Cuts 4 variants to 1.

6. **[P2] Replace 1,680 hand-rolled `animate-spin` spinners** — extract to `LoadingState` primitive; start with `App.tsx`, `InitiativeTasksTab.tsx`, `MaturityMatrix.tsx` as examples.

7. **[P3] Wire `token-radius`, `token-shadow`, `font-serif`** into at least one canonical module to validate the X1 token chain end-to-end; currently 0 usage despite being defined.

8. **[P3] Delete `EconomicsViewPlaceholder.tsx`** or replace with real Economics module — still a live placeholder view in the route tree.
