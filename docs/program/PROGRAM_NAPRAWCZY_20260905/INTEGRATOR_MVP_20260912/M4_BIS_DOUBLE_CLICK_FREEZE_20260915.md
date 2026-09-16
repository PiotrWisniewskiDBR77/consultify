# M4-bis — allocation-row double-click test freeze

**READY FOR CTO REVIEW.** The M4-bis test correction is frozen on `codex/a-m4-bis-20260915`, based on `c458374bfad320e0c987c4f13fa299a0d261143d`.

## Correction

`executionWorkResources.test.tsx` once again sends `fireEvent.doubleClick` to the selected person row. The assertion records the actual contract: a person can have multiple allocations, so double-click keeps the person's preview selected; choosing the `Allocation alloc1` relation opens that allocation's canonical workspace. The test still separately proves the initial single-click preview and the final workspace contents.

## Verification

- Full changed test file: **6/6 PASS**, `--retry=0`.
- Importer closure for the changed test file: `rg -l executionWorkResources src tests scripts` returned no importers. No source file changed; the complete six-test file is the full sibling verification for this delta.
- Esbuild of the changed test file: **PASS**.
- Same-environment TypeScript ratchet with the actual owner `node_modules` symlink and TypeScript 5.8.3:
  - clean base server: **22** diagnostics;
  - candidate server: **22** diagnostics;
  - server delta: **0**;
  - clean base frontend: **TIMEOUT_120**;
  - candidate frontend: **TIMEOUT_120**;
  - frontend delta: **NOT_PROVEN** because neither run completed inside the mandatory ceiling.
- W79's `194 / 27` is retained as a historical toolchain fingerprint, not substituted for this package's same-environment comparison.
- `node_modules` and `package-lock.json` are unchanged.

## Evidence limits

- This is a test-only correction. Browser screenshots were not produced and no staging write occurred.
- CTO owns the review verdict under W78/W79; this freeze contains no self-acceptance.

## Implementation commit

- `cac81d5731` — restores and explains the double-click behavior assertion.
