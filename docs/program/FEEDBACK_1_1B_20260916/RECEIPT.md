# FEEDBACK-1 / 1b — Tools Reports read-only navigation

**Verdict: READY FOR CTO REVIEW.** Opening or leaving the Tools Reports list no longer arms a tool-session `PUT`; a real edit still saves on unmount.

- Base: `8bb6ec7fd7`
- Branch: `codex/feedback-1-1b-tools-reports-20260916`
- Scope: `ToolDocumentView` hydration/autosave bridge and its behavioral regression tests.
- Decision marker: `[ODMROZENIE 03_TOOLS DEC-575]`

## Behavior proved

- A persisted Zustand session with the same id cannot pass the write bridge while the authoritative GET is still pending.
- After GET and hydration, navigation-only changes and section changes produce zero `PUT` requests.
- A genuine `inputData` edit still produces exactly one `PUT` when the document unmounts before the debounce expires.
- Existing 409 conflict handling, recovery drafts, and unmount flush behavior remain unchanged.

## Evidence

- Focused Vitest: `21/21 PASS` (`ToolDocumentView.golden-flow` plus `useToolSessionSync`, `--retry=0`).
- Front TypeScript on the same `node_modules`: line `RC=2, 169`; candidate `RC=2, 169`; delta `0`.
- Server TypeScript on the same `node_modules`: line `RC=0, 0`; candidate `RC=0, 0`; delta `0`; both output files contain completion markers.
- `git diff --check`: PASS.
- Per-file esbuild for `ToolDocumentView.tsx`: PASS.
- Focused ESLint: one pre-existing import-sort error and 23 pre-existing warnings; the change adds no imports and no new lint site.
- Independent review: ACCEPT, `0 x P0`, `0 x P1`, `0 x P2` after the final manual-save gate correction.

No staging write, deployment, Railway change, or protected-ref push was performed.
