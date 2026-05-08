# Sprint 4 — Template Lifecycle Frontend + MELS Shell (Block A)

**Sprint ID:** `A-S4`
**Owner:** Agent B
**Status:** `PLANNED`
**Estimate:** ~2.5 days (lifecycle UI 1.0 day + MELS shell extraction 1.5 days)
**Epics:** EPIC-T6, **EPIC-T16 (D1, D2, D3, D4)**

## Goal

Two parallel sub-streams in this sprint:

1. **Lifecycle UI:** Build `TemplateLifecycleBadge` and `TemplateLifecycleFilter` components, wire them into `ArtifactModuleHome` lane=tabele. Default filter to `Approved`. Render badges on each card.
2. **MELS shell (EPIC-T16):** Extract `ExecutiveModuleShell` from `KimiWorkspaceShell` + `DeckBuilder` patterns. Refactor `TabeleView` to consume it. Build Tabele left rail (record/table outline + sort + collapse + Teresa slot) and top bar chips (functional buttons replacing any Menu 2 row).

## Pre-sprint risk check

A-P1 (catalog overwhelm) — default filter mitigates. A-P3 (badge clutter) — subtle dot only.

## Deliverables

**Lifecycle (EPIC-T6):**
- `consultify/src/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleBadge.tsx`.
- `consultify/src/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleFilter.tsx`.
- `ArtifactModuleHome.tsx` updated: filter chip + badge per card + 15 approved by default.
- Unit tests for both new components.
- `ArtifactModuleHome.test.tsx` updated to cover filter behavior.

**MELS shell (EPIC-T16, deliverables D1–D4):**
- `consultify/src/components/shared/ExecutiveModuleShell/index.tsx` + `TopBar.tsx` + `LeftRail.tsx` + `RightRail.tsx` + `useRailState.ts` + `styles.module.css`.
- `consultify/src/components/AIChat/KimiWorkspace/tabele/TabeleLeftRail.tsx` (record/table outline + sort + Teresa slot).
- `consultify/src/components/AIChat/KimiWorkspace/tabele/TabeleTopBarChips.tsx` (Internal / Theme / History / QA / Governance / Analytics / Audit / Share / Agent / Run).
- `TabeleView.tsx` refactored to render via `ExecutiveModuleShell`. **No Menu 2 anywhere.** All Foundation Block E2E specs remain green.
- Snapshot tests for shell layout and rail collapse behavior.

## Files

### Created
- `consultify/src/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleBadge.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleFilter.tsx`
- `consultify/src/components/shared/ExecutiveModuleShell/index.tsx`
- `consultify/src/components/shared/ExecutiveModuleShell/TopBar.tsx`
- `consultify/src/components/shared/ExecutiveModuleShell/LeftRail.tsx`
- `consultify/src/components/shared/ExecutiveModuleShell/RightRail.tsx`
- `consultify/src/components/shared/ExecutiveModuleShell/useRailState.ts`
- `consultify/src/components/shared/ExecutiveModuleShell/styles.module.css`
- `consultify/src/components/AIChat/KimiWorkspace/tabele/TabeleLeftRail.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabele/TabeleTopBarChips.tsx`
- `tests/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleBadge.test.tsx`
- `tests/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleFilter.test.tsx`
- `tests/components/shared/ExecutiveModuleShell/index.test.tsx`
- `tests/components/shared/ExecutiveModuleShell/useRailState.test.ts`

### Updated
- `consultify/src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx` (filter + badge wiring; lane=tabele branch only)
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` (consumes `ExecutiveModuleShell`; canvas content unchanged)
- `tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.test.tsx`
- `consultify/public/locales/{en,pl}/translation.json` (~10 lifecycle keys + ~15 MELS chip keys)

### Untouched
- `tabelePreview/*` canvas content (Foundation Block).
- All other Foundation Block files except `TabeleView.tsx` (refactor only — outputs identical to user) and `ArtifactModuleHome.tsx` (additive within lane=tabele branch).

## Sprint Entry Gate

- [ ] S1 closed `GO` (lifecycle endpoints available).
- [ ] S2 closed `GO` (templates seeded with statuses).

## Sprint Exit Gate

- [ ] Frontend typecheck clean.
- [ ] Lint clean.
- [ ] Component tests green (lifecycle + shell + rail state).
- [ ] Manual review: badges render correctly in light + dark mode.
- [ ] Manual review: TabeleView renders with `ExecutiveModuleShell`; **no Menu 2 row** present; left rail collapse toggle visible.
- [ ] All Foundation Block E2E specs (`tabele.spec.ts`, `tabele-source-pack.spec.ts`, `tabele-governance.spec.ts`) still pass against the refactored view.
- [ ] DBR77 hex scan: 0 hits in new files (shell + rails + lifecycle).
- [ ] Recommendation: `GO` to S5.

## Realized risks

(filled at exit)

## Daily evidence

(filled per day)
