# Independent review — F2-1 E1 Slice 3 V4

Date: 2026-09-13
Reviewer: independent Codex reviewer, separate from the V4 correction author

**Verdict: ACCEPT for the scoped Slice 3 commit. Full F2-1 E1 remains HOLD.**

## Independent verification

- `FREEZE_MANIFEST_V4.json` SHA-256: `933151dce148cb1469efbfebdd7e896503594866536a50e44b5d07737c6c4f8f`.
- Manifest denominator: **137/137 exact**, drift 0. Every declared file independently matched its byte count, SHA-256 and Git blob.
- Focused independent rerun: **25/25 PASS**, 3/3 test files, exit 0:
  - `portfolioConsultingAnalysisRuntime.routes.test.ts`;
  - `InitiativeConsultingAnalysisView.behavior.test.tsx`;
  - `InitiativesHub.fourButtonsE1.test.tsx`.
- Independent Polish-content guard: `i18nTrescPolska.test.ts` **3/3 PASS**, exit 0.
- Independent full language measurement: exit 0; no metric increased and K7 remains **275**, two below the ceiling 277.
- The V4 correction is narrow and semantic: `initiatives.analysis.parking` is `Odłożenie` in Polish and `Parking` in English. No language baseline was changed.

## Skeptical review of the earlier P1 findings

- **Stale A→B and scope changes:** option loads use an abort controller plus generation checks; analysis output is keyed to the current organization-and-actor `scopeKey`; a scope change synchronously invalidates the rendered analysis, selection and request identity. The focused suite independently covers delayed option responses and prior-scope analysis suppression.
- **Analysis identity and idempotency:** changing the scenario or context clears the retained request object; the next run receives a new `analysisId` and `clientRequestId`. A stable pair is retained only for retrying the same frozen request.
- **Frozen Initiative label:** preview relations resolve `facts.name`, then `facts.title`, from the persisted analysis snapshot. Missing labels render the honest localized `Unnamed Initiative` fallback; raw UUIDs are not exposed.
- **DEC-479 disposition:** UI and route contract use only `IN`, `PARKING`, and `ARCHIVE`. Reason is mandatory for every decision; return condition is mandatory for `PARKING` and `ARCHIVE`; the persisted disposition includes the frozen analysis/item snapshot. This stays separate from lifecycle status.
- **Wpis 11 layout:** compact columns have typed pixel widths while the analysis title remains flexible; the panel uses the available viewport height; preview contains the rationale plus five property blocks; Initiative relations are named and non-empty for rendered analysis items; `UNKNOWN` is omitted from preview meta while remaining explicit in the table.
- **Flag and authority:** the F2-1 feature flag remains default OFF and enables only for the exact string `true`. Capability resolution is fail-closed: loading, error, missing capability, or forbidden self-approval leaves the decision button disabled and does not issue writes. The signed Gateway/JWT/PostgreSQL proof remains qualified for this UI-only V4 correction because the server and PG test blobs are unchanged from the exact 5/5 run.

## Preserved qualifications

- **BLOCKED:** strict full migration remains stopped at inherited migration `919_z139_full_scope_double_escape_reconciliation.sql`; no bypass was used.
- **EVIDENCE_MISSING:** real configured model quality has not been proven on two organization contexts.
- **PARTIAL:** canonical PMO general-manager authority discovery is incomplete; current UI behavior fails closed.
- **HOLD full E1:** I1.6–I1.18, browser owner acceptance under DEC-492, real-model evidence, strict migration readiness, suppression/re-proposal, and E2–E5 remain outside this scoped acceptance.

