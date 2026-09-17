# FEEDBACK-1 K-03 — receipt

Status: READY FOR CTO REVIEW. Independent review after the race fix: ACCEPT, P0=0, P1=0, P2=2 non-blocking.

## Scope

- Final base after rebase: `844e009ffa9473f868ef7ddd4e62edb57a66cb6f`; the three incoming commits touched organization services/tests and the canonical-list guard, with no overlap.

- W120 FEEDBACK-1 position 2 / K-03.
- Product delta is limited to `src/hooks/useOpenChatWithContext.ts`.
- A repeated Ask Teresa action now queues its prompt when the live conversation is reused.
- Conversation reuse reads the current store snapshot at click time, rejects active IDs marked missing or `not_found`, and falls back to creating a new conversation.
- If the user selects another live conversation while a stored ID is being verified, the delayed action is treated as superseded and produces no context or prompt side effects.
- Existing line fixes cover AI role JSON parsing (#36) and honest Assessment navigation (#50); this package re-runs their regression tests and does not duplicate product code.

## Tests

- Focused and related regression family: 6 files / 33 tests PASS, `--retry=0`.
- Wider DRD importer run: 8 unchanged files green; 3 unchanged files have 13 inherited failures caused by Polish selectors against the current English default. The K-03 DRD CTA file was aligned to current DEC-461 English labels and is 5/5 PASS.
- Mutation RED 1: removing prompt queueing from the reuse path makes the second Ask Teresa test fail.
- Mutation RED 2: disabling the active missing-ID guard makes the missing active conversation test fail.
- Mutation RED 3: allowing a delayed action to inject into the newer conversation makes the race test fail on `setWorkspaceContext`.

## Gates

- Exact lock: installed `@types/node 22.19.3`; package lock `22.19.3`.
- Server TypeScript: 0 diagnostics / RC 0.
- Frontend TypeScript, same exact-lock method: base 152, final post-rebase candidate 152, delta 0; no diagnostics in changed files. The full final run completed in 195.09 s.
- Language gate PASS; flag/Dockerfile guard PASS (`brakujace=0`).
- Canonical-list ratchet PASS (346/346); artifact ratchet PASS (8/8).
- `git diff --check` PASS.
- No migration, flag, staging write, deploy, Railway change, screenshot, or protected-ref update.

## Files

- `src/hooks/useOpenChatWithContext.ts`
- `src/hooks/__tests__/useOpenChatWithContext.zapytajTerese.test.tsx`
- `tests/hooks/useOpenChatWithContext.idea.test.ts`
- `src/components/assessment/drd/__tests__/DrdHttpMethodWorkspaceScreen.zapytajTerese.test.tsx`
- `docs/program/FEEDBACK_1_K03_20260917/RECEIPT.md`
