# FEEDBACK-1/1e v2 — Execution → Work language boundary

**READY FOR INDEPENDENT REVIEW (WIP, not committed).** W151 is fixed without moving the title column out of `FilterableTable`'s native primary-cell path. Persisted content is marked on the canonical `<td>` through the additive `cellAttributes` contract, while row height, one-line ellipsis and the overflow tooltip remain identical to the base line.

- Base measured: `5f86e971f0`
- Branch: `codex/feedback-1-1e-fix-v2-20260917`
- Scope markers for the later final commit: `[ODMROZENIE 06_EXECUTION DEC-575]`, `[ODMROZENIE 02_INTERVIEW DEC-575]` and `[ODMROZENIE WSPOLNE DEC-575]`
- Database/migration/flag: none
- Commit/push: none at this review gate

## W151 behavior proof

The held implementation used `column.render` for the title and React wrappers for initiative/person values. That routed cells through `CELL_ELEMENT_CLAMP_CLASS`, changed typography from 14/20 px to 16/24 px, removed the native one-line tooltip path and raised representative rows from 56.5/57 px to 72.5/73 px.

The v2 implementation adds a metadata-only `TableColumn.cellAttributes(row)` contract to the canonical `<td>`. It accepts `data-*`, `aria-*`, `translate`, `lang` and `dir`; its type excludes `className`, `style` and event handlers. The table remains the sole owner of row geometry, pinned offsets and interactions. The title has no `render`; initiative/person keep their prior plain-string renderer when they contain persisted data. System fallbacks and localized role labels remain outside the user-content boundary.

The real dev-render shell was measured at 1440×900, device scale factor 2, EN/light, `uwagi=0`, using the same `getBoundingClientRect()` probe as the CTO W151 review:

- base historical row heights: `[56.5, 57, 57, 57, 57, 73]`;
- candidate row heights: `[56.5, 57, 57, 57, 57, 73]`;
- candidate primary-cell heights: `[56.5, 57, 57, 57, 57, 73]`;
- 6/6 title `<td>` nodes: `data-language-source="user-content"`, `translate="no"`;
- 6/6 titles: canonical overflow-tooltip trigger present and `text-sm block truncate` retained;
- full machine-readable result: `POMIAR_W151_V2.json`.

W160's schema guard was reproduced RED on `a1932f5caa`: the guard found two literal test-DDL statements in `interviewAnswerDecisionMigration.test.ts`. The source test now recognizes table-definition statements through a parsed regular-expression predicate, without embedding or executing test DDL and without changing `ALLOWED_TEST_DDL_BY_FILE`. The migration contract remains covered by its original four assertions.

The focused behavior test was first run against the held implementation and failed 2/2 because the attribute was absent on `<td>`. After the v2 change it passes 2/2 and asserts the `<td>` attributes, canonical row classes, native overflow-tooltip trigger, one-line truncation, and absence of `line-clamp-2` in the title cell.

## Verification

- `ExecutionWorkSurface.languageBoundary.test.tsx`: 2/2 PASS, `--retry=0`.
- `jezykRealizacji.source.test.ts`: 4/4 PASS, `--retry=0`.
- `ExecutionWorkSurface.daneRealne.test.tsx`: 8/8 PASS, `--retry=0`.
- `FilterableTable.overflowTooltipGuard.test.tsx` + `FilterableTable.cellWordBreak.test.tsx`: 7/7 PASS, `--retry=0`.
- `FilterableTable.pinnedAndGroups.test.tsx`: 7/7 PASS, including metadata on a pinned cell, preserved sticky offset/width/canonical classes and compile-time rejection of `className`, `style` and `onClick`.
- `interviewAnswerDecisionMigration.test.ts` + `noRuntimeDdl.test.ts`: RED 6/7 before the source fix; GREEN 7/7 after it, `--retry=0`; allowlist unchanged.
- Focused total after the review fix: 8 files / 35 tests PASS, `--retry=0`.
- Full TypeScript without timeout:
  - base `5f86e971f0`: frontend RC=2 / 169 errors; server RC=0 / 0 errors;
  - candidate: frontend RC=2 / 169 errors; server RC=0 / 0 errors;
  - delta: 0 / 0.
- `git diff --check`: PASS.
- Rebase check `a1932f5caa → 51e406fc19 → 5f86e971f0`: no base/package file overlap and no apply conflict; focused tests, full TSC and browser measurement repeated on the final base.

No staging write, deployment, Railway change, migration, protected-ref push or `--no-verify` was performed.
