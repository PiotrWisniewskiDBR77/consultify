# TBL-FU-C7-4 — AI Operator Playwright E2E Suite

**Source sprint:** Block C / C-S7
**Filed:** 2026-05-08
**Priority:** P2
**Status:** `OPEN`
**Owner:** Agent D (QA)

## Why this exists

L5.1–L5.5 in the validation matrix calls for a Playwright e2e smoke. C-S7 closeout deferred this because:

1. The AI Operator surface is feature-flagged off everywhere by default.
2. The Anygravity P0 trial #2 (D-S5) will exercise the full UI on staging with a human operator, producing screen recordings that double as smoke evidence.

A reusable Playwright suite is still valuable for regression once the surface goes general-availability.

## Scope

1. Add `tests/e2e/smoke/tabele-ai-operator.spec.ts`.
2. Cover:
   - L5.1 — Open AI Editor from right-rail icon; assert 8 levels visible.
   - L5.2 — Apply a stub-LLM cell-level proposal; assert the record cell updates.
   - L5.3 — Open QA Report; assert health bar + suggestion list render.
   - L5.4 — Open Source Pack; add 2 candidates; save pack; assert it lands in saved-list.
   - L5.5 — Trip soft-warn at 70 %; assert banner.
3. Ensure tests pass with `stubLlmProvider` (no live OpenAI key required in CI).
4. Add a `playwright` GH Action workflow scoped to `consultify/`.

## Out of scope

- Multi-browser matrix (chromium only is fine for smoke).
- Visual regression snapshots (filed separately if needed).

## Definition of done

- 5 specs land in `tests/e2e/smoke/tabele-ai-operator.spec.ts`.
- Workflow runs on PR labelled `tabele-e2e`.
- Passes 10 consecutive runs without flake.
