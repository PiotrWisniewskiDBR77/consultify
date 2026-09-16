# FEEDBACK-1 1a — Materials / Sheets organization access

**Verdict: READY FOR CTO REVIEW.** Materials opens a known generated workbook directly in Spreadsheet Studio without probing unrelated Table Platform or artifact identifiers. Governed table exports still resolve through their tenant-scoped Table Platform path, and ambiguous legacy sheet rows retain the runtime resolver.

## Scope and diagnosis

- Staging smoke reported `GET /api/table-platform/tables/3ec6de05-dbc1-406e-aa00-fd0bd3e8de22 -> 403` and `GET /api/artifacts/3ec6de05-dbc1-406e-aa00-fd0bd3e8de22/action-target -> 404` before the workbook rendered.
- The identifier was a `generated_workbooks.id`. The Materials row already carried the current-writer marker `originSummary.sheetCount + originSummary.source`, but the open handler ignored that classification and probed the id as both a `tp_tables.id` and an artifact id.
- The UI now bypasses both probes only for positively identified workbooks. `table_export` rows keep the Table Platform resolver. Rows without a positive marker remain unresolved until runtime, preserving legacy compatibility.
- During review, `PermissionsService.canAccessBase` was found to permit a base creator before comparing organizations. Organization equality is now mandatory, so creator identity cannot cross the tenant boundary.

## Behavioural evidence

- Focused UI/classification/navigation tests: **10/10 PASS**.
  - known workbook -> `/excele?artifactId=...`, no Table Platform probe;
  - governed table export -> canonical Table Studio path;
  - ambiguous legacy sheet -> runtime resolver remains active.
- Real PostgreSQL + mounted HTTP routes + real HS256 JWT + ACTIVE memberships: **6/6 PASS**.
  - same-organization ADMIN who is not the creator: table `200`;
  - cross-organization ADMIN: table `403`;
  - creator presenting a token for another active organization: table `403`;
  - organization-visible table artifact action target: same-org `200`, cross-org `404`;
  - readback proves separate canonical fixtures: `table_export -> tp_tables.id` and `workbook -> generated_workbooks.id`.
- Independent review: **ACCEPT, 0 P0 / 0 P1 / 0 P2**.
- `git diff --check`: PASS.

## Validation after final rebase

- Rebased on line `849c6dad12` without conflicts.
- Front TypeScript on the same clean-install `node_modules`: line `RC=2 / 152`, candidate `RC=2 / 152`; delta `0`.
- Server TypeScript on the same environment: line `RC=0 / 0`, candidate `RC=0 / 0`; delta `0`. Output files contain an explicit completion marker, so the zero result is not inferred from an empty or killed process.
- Final SHA and exact backup ref are recorded in the file-channel handoff after freeze.

## Limits

- No staging write, deploy, migration, or protected-branch push was performed.
- The RealPG fixture schema lacks unrelated newer backfill tables (`wave5_artifacts`, `document_studio_templates`); those fail-soft log messages do not affect the mounted table or artifact route assertions.
