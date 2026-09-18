# RB-3 — READY FOR CTO REVIEW

Date: 2026-09-17 (America/Chicago) / 2026-09-18 (CEST)

Track: B / Codex-2

Base: `e05ea74752eee242ad38f64c036cf50f4b2e3f73` (`origin/integracja/20260911`, refreshed before READY).

Decision: DEC-632 / KANAL Wpis 228. DOC-0 1b v2 (`7ca293cc81`) and RB-1 v2 (`b8250edb22`) are ancestors of the base. The first production commit did not edit `artifactNavigation.ts`, `OutputsAggregateTabContent.tsx`, or `artifactRegistryService.ts`.

## Delivered contract

- Fail-closed `VITE_REPORT_BUILDER_NAV_V2` flag with Docker ARG/ENV; default OFF. Harness-only query override is explicit and reversible.
- One URL state: `/reports/builder/:reportId?mode=write|review|publish`; switching mode preserves the other query values.
- One three-item workspace navigation: Write / Review / Publish, with EN and PL labels and `aria-current`.
- Write keeps editable block cards. Under the flag, Configure / AI / Comments move into the single block kebab, persistent per-card tabs disappear, and only the header Generate/Regenerate action remains.
- Review and Publish render the same whole-document representation as View. Review hosts the existing review/comments contract; Publish hosts the existing `ExportSharePanel` contract.
- TOC and inspector can collapse to icon rails. `tocExpanded`, `rightPanelExpanded`, and `lastMode` persist per user through the existing `/api/preferences` / `user_preferences` mechanism; no migration or new table.
- The release-flag-OFF branch retains the legacy shell.
- Fixed invalid nested-button markup in the existing Review comments header found by the real-shell run.

## Wpis 93 component decision executed

- `ExportSharePanel`: connected in Publish and retained.
- `BrandVoicePanel`, `EntityLinksPanel`, `SourceTraceabilityPanel`, `ScheduleReportModal`: removed after zero-live-import measurement; two source-text inventory tests were updated to stop requiring the deleted Brand Voice file.

Final zero-import command:

```text
rg -l "BrandVoicePanel|EntityLinksPanel|SourceTraceabilityPanel|ScheduleReportModal" src dev-render tests
=> 0 live component files (only this receipt may name them)
```

## Automated evidence

Focused tests:

```text
5 files passed, 25 tests passed
```

Covered contracts:

- exact three-item navigation, active item and callbacks for all modes;
- unknown URL mode fails closed;
- flag exact-true and query override;
- user-scoped preference read/write and zero API traffic with flag OFF;
- adjusted settings toggle inventory tests after dead-component removal.

Mutation:

```text
Mutation: accept `preview` as a fourth URL mode.
Result: 1 failed / 4 passed; expected null, received "preview".
Restore: 5/5 PASS.
```

Foreground TypeScript check:

```text
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false
TSC_RC=2
TSC_ERRORS=156 (inherited line baseline)
RB3_FILE_ERRORS=0
```

ESLint for new/focused RB-3 files: 0 errors. `ReviewPanel.tsx` retains 11 pre-existing warnings and adds no error. Commit hooks passed list canon, artifact canon, triad, density, focus canon, static flag check and language gate.

## Real-shell render evidence

Harness: real `ReportBuilderView` → real `ReportEditor`, 14-section report payload, 1440×900, EN.

Capture assertions for all six pages:

- labels exactly `Write | Review | Publish`;
- active `aria-current` matches requested mode;
- Review and Publish contain the whole-document canvas and their mode-specific right rail;
- zero console/page errors after the Review markup fix.

Screenshots:

- `screenshots/write-en-light-1440x900.png`
- `screenshots/review-en-light-1440x900.png`
- `screenshots/publish-en-light-1440x900.png`
- `screenshots/write-en-dark-1440x900.png`
- `screenshots/review-en-dark-1440x900.png`
- `screenshots/publish-en-dark-1440x900.png`

All six were visually inspected. `screenshots/capture.json` contains the DOM assertions and console results. Reproduction: run the dev-render Vite server on port 3350, then `node docs/program/RB_3_20260917/capture.mjs`.

## Commits before final receipt

- `a0e994b65e` — GO amendments to Step 0 before production code.
- `2c5070ed84` — first production commit; protected DOC-0 files absent from its diff.
- `608635a33e` — four dead components removed.
