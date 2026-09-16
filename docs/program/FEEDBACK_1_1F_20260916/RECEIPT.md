# FEEDBACK-1 / 1f — localized presentation breadcrumb

**Verdict: READY FOR CTO REVIEW.** The Deck Builder breadcrumb now follows the active EN/PL locale while an explicit caller-provided module label remains authoritative.

- Base: `70d366f158`
- Branch: `codex/feedback-1-1f-deck-label-20260916`
- Scope: `DeckBuilderMelsView` module label fallback and a real-resource i18n regression test.
- Decision marker: `[ODMROZENIE 11_MATERIALS DEC-575]`

## Behavior proved

- With no `moduleLabel`, the shell reads `presentations.builder.moduleLabel` from the shipped locale resource: `Presentations` in EN and `Prezentacje` in PL.
- A caller-provided `moduleLabel` takes priority over the locale fallback.
- No locale resource was changed.
- A full scan of the four `src/components/**/*MelsView.tsx` files found no other Polish `moduleLabel` literal: Idea uses `Ideas`; Prezentacje and Tabele already use `prop ?? t(...)`.

## Evidence

- Focused Vitest: **11/11 PASS** across the new EN/PL/custom-priority suite and the existing Artifact Studio shell and label suites (`--retry=0`).
- Full TypeScript on the same installation: frontend base `70d366f158` **RC=2 / 169** → candidate **RC=2 / 169**, delta 0; server base and candidate **RC=0 / 0**.
- Independent review: **ACCEPT, 0 P0 / 0 P1**.
- `git diff --check`: PASS.

No staging write, deployment, Railway change, migration or protected-ref push was performed.
