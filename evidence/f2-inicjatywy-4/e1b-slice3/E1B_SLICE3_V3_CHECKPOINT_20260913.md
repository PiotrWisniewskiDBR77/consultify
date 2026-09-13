# F2-1 E1 Slice 3 V3 — K7-corrected frozen checkpoint

Verdict requested from independent review: **scoped candidate; full E1 remains HOLD**.

## Delta from historical V2 HOLD

- All three visible date/time renderers in `InitiativeConsultingAnalysisView` receive the active `react-i18next` locale (`resolvedLanguage`, then `language`, then `en`). No formatter relies on the host locale.
- A behavior test switches i18n to Polish and proves both visible date-only and date-time formatters receive `pl`.
- Full `pomiar-jezyka`: **K7 = 275**, below the required baseline ceiling 277; exit 0.

## Final behavior evidence

- Focused route/UI suites: **25/25 tests, 6/6 suites, exit 0**.
- Raw: `e1b-slice3-v3-focused-green.json`, SHA256 `581e4bea2a57ceb1c33a9f80c433d39c54c9bb2f2860c4094eea70367af59a3f`.
- The suite retains V2 proof for synchronous stale-input invalidation, new `analysisId` and `clientRequestId`, frozen title/fallback without UUID, real non-empty Initiative relations, omission of `UNKNOWN` from preview meta, selective decisions, and fail-closed authority.

## PostgreSQL qualification

- V3 changes only frontend formatting and its jsdom test. The server runtime and PG-test blobs did not change after the final exact PostgreSQL run, so the exact V2 proof remains current and was not rerun gratuitously.
- Exact staging schema SHA256: `bf580feb5a9edd7960a2b38708fa31e5d8b16c7014ec82870f700882aa4aba78`; restored public 1809, v8 121, backup schemas 9.
- Actual `ApiGateway.initializeRoutes` + signed JWT + PostgreSQL 18: **5/5**, raw `e1b-slice3-v2-realpg-final.json`, SHA256 `66548392b3872cf47a486b478de0cc1fa38aa0794cd8c7c33cd859852231b5e4`.
- External cleanup all zero; container 0, volume 0, listener 6455 = 0.

## Visual and flag constraints

- Wpis 11: typed widths keep title broad and compact fields narrow; panel fills available height; preview has frozen Initiative relations rather than an empty frame; `UNKNOWN` is omitted from meta while retained explicitly in the table.
- Wpis 12 / DEC-492: existing UI and server flags still require exact `true`; no default changed. Full stage remains OFF until owner acceptance.
- The slice does not build on `InitiativePreparationReadView`; Work report replacement remains the later E4 dependency. Rebase onto the shared canon sweep waits for CTO's merge announcement.

## Static gates

- Server typecheck: exit 0.
- Scoped Prettier and ESLint for the V3 files: exit 0.
- `git diff --check`, `check:list-canon`, and `check:artefakt`: exit 0.
- Full frontend typecheck is classified in the V3 evidence; repository-wide inherited diagnostics remain a qualification and the exact inherited Hub TS2345 expression is unchanged from HEAD.
- Locale diffs remain exactly one intentional `initiatives.analysis` hunk per language; EN/PL analysis key parity is 36/36.

## Preserved gates

- **BLOCKED:** strict full migration remains stopped by inherited migration `919_z139_full_scope_double_escape_reconciliation.sql` (`INSERT has more expressions than target columns`); no workaround was used.
- **EVIDENCE_MISSING:** real configured model quality on two organization contexts.
- **PARTIAL:** canonical PMO general-manager authority discovery. The UI fails closed with zero writes.
- **HOLD full E1:** remaining I1.6–I1.18, browser acceptance, real-model quality, strict migration readiness, suppression/re-proposal, and E2–E5 remain open.
