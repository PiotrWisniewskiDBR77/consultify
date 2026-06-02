# Sprint 5 — AI Editor + QA Frontend (Block C)

**Sprint ID:** `C-S5`
**Owner:** Agent A (CTO; merged scope)
**Status:** `EXECUTED — GO`
**Estimate:** ~2 days (delivered same-session given the existing right-rail tooling)
**Epic:** EPIC-T10 + EPIC-T11
**Executed:** 2026-05-08

## Goal

Build `<TabeleAiEditorPanel>` (8 levels + diff card), `<TabeleQaPanel>`
(health bar + 5 axis cards + suggestion list), and connect them to the
existing right-rail panel slots in `<TabeleMelsView>`. Wire QA →
AI Editor handoff so a suggestion launches the editor with prefilled
level + prompt + context.

## Pre-sprint risk check

- **C-P1 (8 levels overwhelm):** mitigated. Levels are surfaced as a
  compact 2-column tile grid with numerals 1–8, icons, and tooltips.
  Levels 7 (methodology) + 8 (sources) are visually de-emphasised
  (disabled) for non-super-admin actors so the cognitive surface
  matches the user's permission set.
- **C-P2 (proposed-not-applied confusion):** mitigated. The `<ProposalDiffCard>`
  carries a level badge, handler-status pill (`live`/`stub`), proposal
  ID, prompt, operations preview, soft-warn banner, and the "AI never
  executes" safety copy under the Propose button.
- **C-P3 (QA scoring opacity):** mitigated. Each axis card is
  collapsible — the "Why this score?" details list every metric
  contributing to the axis. Bands are colour-coded (green/amber/red)
  with the same tokens across health bar, axis cards, and suggestions.

## Deliverables (status)

- [x] `<TabeleAiEditorPanel>` (8 level tiles + prompt + propose +
      `<ProposalDiffCard>` + budget snapshot footer).
- [x] `<TabeleQaPanel>` (`<QaHealthBar>` + 5 `<QaAxisCard>`s +
      `<QaSuggestionList>`).
- [x] `<ProposalDiffCard>` standalone, presentational only.
- [x] `<QaHealthBar>`, `<QaAxisCard>`, `<QaSuggestionList>` standalone.
- [x] `useTabeleRightRailPanels` hook wires panels into the right rail
      and routes the QA → AI Editor preset handoff.
- [x] `<TabeleView>` now passes `rightRailPanels` to `<TabeleMelsView>`
      via the new wrapper `TabeleMelsViewWithPanels`.
- [x] API client (`tablePlatform.api.ts`) extended with:
        - `proposeAiEdit`, `applyAiProposal`, `rejectAiProposal`, `getAiBudget`
        - `recomputeQaReport`, `getLatestQaReport`, `dismissQaSuggestion`
- [x] Client-side kill switches (`tabeleAiEditorFlag`, `tabeleQaFlag`)
      mirror the resolution order of `melsTabeleFlag` (URL > LS > env > off).
- [x] 14 new component tests (5 + 5 + 4) covering rendering, propose,
      apply/reject, dismissals, handoff, kill switches.

## CTO scope decisions

1. **Right rail is the only AI surface.** Per `.cursor/rules/ai-actions-menu3.mdc`
   and EPIC-T16 §"MELS § 2.D", AI buttons live ONLY in the right rail.
   No new toolbars, no canvas-side widgets.
2. **Backend-driven super-admin.** Levels 7/8 are visually disabled
   when the actor is not a super-admin, but the backend
   `TableAiEditorService` still enforces the gate (defense in depth).
   The frontend cannot grant access by lying.
3. **Optimistic dismissals + server confirmation.** "Mark not
   applicable" removes the suggestion from view immediately and
   calls `dismissQaSuggestion` in the background. On error the UI
   restores the suggestion and surfaces a toast. This avoids a flicker
   on the round-trip (~300 ms).
4. **Preset handoff via key remount.** When QA's "Open in AI Editor"
   fires, the connector hook bumps a nonce and uses it as the AI
   Editor's React key. This guarantees a clean remount with the new
   level/prompt/context, even when the current and target levels match
   (avoids stale `useEffect` issues).
5. **Client-side kill switches.** Two new flags
   (`ff.tabele_ai_editor`, `ff.tabele_qa`) mirror `ff.mels_tabele`.
   Disabled by default; backend feature flags
   (`ENABLE_TABLE_AI_EDITOR`, `ENABLE_TABLE_QA_ENGINE`) remain
   authoritative.
6. **i18n is partial in C-S5; full pass deferred.** The right-rail icon
   labels (`AI Editor`, `QA Report`) already use `t()` from prior
   sprints. Internal panel copy (`Recompute`, `Propose`, `Apply`, …)
   ships in English with sensible defaults so we can land the
   functional pipeline NOW. Polish + EN expansion is filed as
   `TBL-FU-C5-1` (see follow-ups).

## Out of scope (explicit, with rationale)

- Auto-switching the right-rail active tool when QA hands off to the
  AI Editor. We tracked the preset and keyed-remount but the user
  still clicks the AI Editor icon — programmatic active-tool control
  requires touching `<ExecutiveModuleShell>` + `<RightRail>` shared
  components, which is a separate UI epic. Filed as `TBL-FU-C5-2`.
- Operations preview wired from the proposal row. The diff card
  currently shows "no operations preview available" because the
  backend stores operations in `tp_schema_proposals.operations` but
  the proposal-fetch endpoint isn't yet exposed under
  `/ai-editor/proposals/:id`. Filed as `TBL-FU-C5-3` and is the first
  task in C-S6/C-S7.
- Legacy `<KimiWorkspaceShell>` lane (when MELS flag is OFF). MELS
  rollout is now the canonical Tabele shell; the legacy shell is
  staying behind a kill switch.
- Backend `ENABLE_TABLE_AI_EDITOR` / `ENABLE_TABLE_QA_ENGINE` flags
  remain `false` in all environments by default. The C-S7 closeout +
  Anygravity P0 trial #2 is where the "flip on" call lives.
- Polish translation strings for the new panels (see follow-up
  `TBL-FU-C5-1`).

## Files

### Created

- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/aiEditor/levelMeta.ts`
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/aiEditor/ProposalDiffCard.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/aiEditor/TabeleAiEditorPanel.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/qa/QaHealthBar.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/qa/QaAxisCard.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/qa/QaSuggestionList.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/qa/TabeleQaPanel.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/useTabeleRightRailPanels.tsx`
- `consultify/src/utils/tabeleAiEditorFlag.ts`
- `consultify/src/utils/tabeleQaFlag.ts`
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/__tests__/TabeleAiEditorPanel.test.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/__tests__/TabeleQaPanel.test.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/__tests__/useTabeleRightRailPanels.test.tsx`
- `docs/product/work-packets/tabele-full-product/block-C-ai-operator/evidence/sprint-5/validation-matrix-run.md`

### Updated

- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx`
  (additive wrapper `TabeleMelsViewWithPanels` that wires panels via
   `useTabeleRightRailPanels`)
- `consultify/src/services/api/tablePlatform.api.ts`
  (additive AI Editor + QA Engine API client functions)

## Validation

- C-S5 component tests: **14 / 14 passing**
  - `TabeleQaPanel` 5/5
  - `TabeleAiEditorPanel` 5/5
  - `useTabeleRightRailPanels` 4/4
- Existing `TabeleView.melsRouting` regression: **2 / 2 passing**.
- Lint: 0 errors on changed files.
- DBR77 hex scan: 0 raw hex literals in any new component.
  Tailwind tokens only (slate-* / emerald-* / amber-* / rose-*).
- Block C aggregate: backend 94 / 94 still passing (no server changes
  in C-S5 beyond client-only API additions).

## Follow-ups filed

- `TBL-FU-C5-1`  i18n pass (EN + PL) for new panel copy.
- `TBL-FU-C5-2`  Programmatic right-rail active-tool control so QA
  → AI Editor handoff opens the panel automatically.
- `TBL-FU-C5-3`  Backend endpoint to fetch a proposal by id (for
  the diff card operations preview).

## Sprint Exit Gate

- [x] Frontend lint + typecheck clean on changed files.
- [x] DBR77 hex scan clean on new components.
- [x] Component tests green.
- [x] Manual review: all AI buttons live in the right rail per Menu 3
      placement contract.
- [x] Recommendation: **GO** to C-S6.
