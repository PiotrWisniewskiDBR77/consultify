# Global Teresa — Presentation Studio bridge evidence

Status: `READY_FOR_CODEX_REVIEW`
Program status: `NO_GO` — this closes only the bounded PPT Teresa writer package.

## Scope

This package connects the canonical Teresa P08 dispatcher to the existing Presentation Studio domain writer. It does not change Menu 1, does not remove legacy UI, and does not claim runtime or deployment acceptance.

The bridge:

- resolves a tenant-scoped presentation and its current version;
- rejects stale `expectedVersion` before mutation;
- uses the existing presentation edit-plan parser and applier;
- respects locked slides and reports skipped slide numbers;
- writes an immutable deck-version snapshot and an applied AI-operation record;
- advances the deck head with a compare-and-swap update;
- rolls the transaction back when the head version changes concurrently.

## Exact allowlist

1. `server/src/services/presentationTeresaBridgeService.ts`
2. `server/src/services/v8/teresaCopilotCanon.ts`
3. `server/src/services/v8/teresaCopilotService.ts`
4. `server/src/routes/v8/__tests__/p08-artifact-studio-teresa-bridge.test.ts`
5. `server/src/services/__tests__/presentationTeresaBridgeService.test.ts`
6. `docs/ui-standards/01-shell-layout/artifact-studio/14_GLOBAL_TERESA_PRESENTATION_BRIDGE_EVIDENCE.md`

No other root-worktree changes belong to this package.

## Targeted gates

Command:

```text
cd server
npx vitest run src/routes/v8/__tests__/p08-artifact-studio-teresa-bridge.test.ts src/services/__tests__/presentationTeresaBridgeService.test.ts
```

Result: `2 passed`, `8 passed`, exit code `0`.

Covered behavior:

- PPT appears in the canonical Teresa handoff targets only with a real writer;
- proposal context carries deck, slide, block, classification, lifecycle and version;
- execution dispatch reaches the module-owned presentation bridge;
- locked slides are skipped and reported;
- stale versions fail before any write;
- compare-and-swap conflict causes transaction rollback;
- successful apply creates a version snapshot, operation record and new head.

`git diff --check` for the exact allowlist: `PASS` before staging.

## Remaining program gates

- XLSX still needs its versioned, atomic global-Teresa mutation bridge.
- Shared one-line Menu 2 and selection-driven Menu 3 are not yet runtime-complete across all three formats.
- Runtime browser evidence, realDB persistence/readback and cross-format transfer tests remain required.
- Legacy paths must remain until their documented parity and rollback gates pass.
- The contaminated root worktree prevents treating root-wide typecheck or clean-tree status as evidence for this bounded package.
